import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

/**
 * Direct tests of the PRODUCTION createLending() implementation
 * (src/lib/server/lendingPayments.ts) running against an in-memory SQLite
 * database — same technique as tests/unit-test/deleteLending.test.ts.
 *
 * The $lib/database mock replaces ONLY the connection factory (getSQLiteDb)
 * with an in-memory database. withTransaction, the tx helpers, and the whole
 * lendingPayments + recordLendingTransaction modules are imported unmodified,
 * so these tests exercise the REAL BEGIN/COMMIT/ROLLBACK path and can prove
 * rollback of the lending + linked category/transaction writes.
 *
 * createLending() must create a lending AND its linked category/ledger
 * transaction atomically:
 *   A. a successful CREATE COMMITs — lending, linked transaction and
 *      auto-created category all persist
 *   B. an existing category is reused (no duplicate)
 *   C. a failed CREATE ROLLs BACK — a forced failure during the category
 *      operation also removes the already-inserted lending
 *   D. no orphan category — a forced failure during the transaction INSERT
 *      rolls back the newly-created category too
 *   E. recordAsTransaction=false creates only the lending
 *   F. ownership is scoped to the caller's user_id
 *
 * The final describe is a STRUCTURAL check of the Postgres/Drizzle path: the
 * CREATE must run through db.transaction/tx (lending + category + transaction
 * all via tx) and never touch the global db. It does NOT claim to prove real
 * Postgres rollback.
 */
const SQLITE_FIXTURE_SCHEMA = `
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'expense',
  budget_limit REAL,
  UNIQUE (user_id, name)
);

CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  description TEXT NOT NULL,
  date TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE lendings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  borrower_name TEXT NOT NULL,
  amount REAL NOT NULL,
  interest_rate REAL NOT NULL DEFAULT 0,
  date_lent TEXT NOT NULL,
  due_date TEXT,
  direction TEXT NOT NULL DEFAULT 'lent',
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE lending_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lending_id INTEGER NOT NULL REFERENCES lendings(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  payment_date TEXT NOT NULL,
  notes TEXT,
  transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
  payment_type TEXT NOT NULL DEFAULT 'payment',
  reference TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

describe('createLending — SQLite production implementation (in-memory better-sqlite3)', () => {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	sqlite.exec(SQLITE_FIXTURE_SCHEMA);

	let createLending: (userId: number, input: any) => Promise<{ success: true }>;
	let seq = 0;

	beforeAll(async () => {
		// Route the REAL query.ts connection factory to the in-memory DB.
		vi.doMock('$lib/database', () => ({
			usePostgres: false,
			getPgPool: () => Promise.reject(new Error('getPgPool should not be called on SQLite path')),
			getSQLiteDb: () => Promise.resolve(sqlite),
			initDb: async () => {},
			closeDb: async () => {}
		}));
		vi.resetModules();
		const mod = await import('$lib/server/lendingPayments');
		createLending = mod.createLending;
	});

	beforeEach(() => {
		// Children first, then parents — avoids FK ordering ambiguity on cascade.
		sqlite.exec(
			'DELETE FROM lending_payments; DELETE FROM transactions; DELETE FROM lendings; DELETE FROM categories; DELETE FROM users;'
		);
	});

	function createUser(): number {
		const username = `user_${++seq}`;
		sqlite.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, 'hash');
		return (sqlite.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: number }).id;
	}

	function count(sql: string, ...params: unknown[]): number {
		return (sqlite.prepare(sql).get(...(params as never[])) as { c: number }).c;
	}

	function baseInput(overrides: Partial<Record<string, unknown>> = {}): any {
		return {
			borrowerName: 'Alice',
			amount: 1000,
			interestRate: 0,
			dateLent: '2026-01-01',
			dueDate: null,
			notes: null,
			direction: 'lent',
			recordAsTransaction: true,
			...overrides
		};
	}

	it('COMMITs lending + linked transaction + auto-created category when recordAsTransaction=true (Test A)', async () => {
		const uid = createUser();
		const result = await createLending(uid, baseInput({
			borrowerName: 'Alice',
			amount: 5000,
			interestRate: 2.5,
			dateLent: '2026-01-01',
			dueDate: '2026-12-31',
			notes: 'friend'
		}));

		expect(result.success).toBe(true);

		const lending = sqlite.prepare('SELECT * FROM lendings WHERE user_id = ?').get(uid) as Record<string, unknown>;
		expect(lending).toBeDefined();
		expect(lending.borrower_name).toBe('Alice');
		expect(lending.amount).toBe(5000);
		expect(lending.interest_rate).toBe(2.5);
		expect(lending.date_lent).toBe('2026-01-01');
		expect(lending.due_date).toBe('2026-12-31');
		expect(lending.notes).toBe('friend');
		expect(lending.direction).toBe('lent');
		expect(lending.status).toBe('active');

		const tx = sqlite.prepare('SELECT * FROM transactions WHERE user_id = ?').get(uid) as Record<string, unknown>;
		expect(tx).toBeDefined();
		expect(tx.description).toBe('Lent to Alice');
		expect(tx.amount).toBe(5000);
		expect(tx.type).toBe('expense');
		expect(tx.date).toBe('2026-01-01');

		const cat = sqlite.prepare('SELECT * FROM categories WHERE user_id = ? AND name = ?').get(uid, 'Lending Recovery') as Record<string, unknown>;
		expect(cat).toBeDefined();
		expect(cat.type).toBe('expense');
		expect(cat.color).toBe('#8b5cf6');
		expect(cat.icon).toBe('💳');
		expect(tx.category_id).toBe(cat.id);
	});

	it('creates the borrowed direction correctly (income + "Debt Repayment" category)', async () => {
		const uid = createUser();
		const result = await createLending(uid, baseInput({
			borrowerName: 'Bob',
			amount: 3000,
			direction: 'borrowed'
		}));

		expect(result.success).toBe(true);

		const lending = sqlite.prepare('SELECT * FROM lendings WHERE user_id = ?').get(uid) as Record<string, unknown>;
		expect(lending.borrower_name).toBe('Bob');
		expect(lending.direction).toBe('borrowed');

		const tx = sqlite.prepare('SELECT * FROM transactions WHERE user_id = ?').get(uid) as Record<string, unknown>;
		expect(tx.description).toBe('Borrowed from Bob');
		expect(tx.type).toBe('income');

		const cat = sqlite.prepare('SELECT * FROM categories WHERE user_id = ? AND name = ?').get(uid, 'Debt Repayment') as Record<string, unknown>;
		expect(cat).toBeDefined();
		expect(cat.type).toBe('income');
	});

	it('reuses an existing category instead of creating a duplicate (Test B)', async () => {
		const uid = createUser();
		sqlite.prepare('INSERT INTO categories (user_id, name, color, icon, type) VALUES (?, ?, ?, ?, ?)')
			.run(uid, 'Lending Recovery', '#8b5cf6', '💳', 'expense');
		const originalCatId = (sqlite.prepare('SELECT id FROM categories WHERE user_id = ? AND name = ?').get(uid, 'Lending Recovery') as { id: number }).id;

		const result = await createLending(uid, baseInput({ borrowerName: 'Alice' }));
		expect(result.success).toBe(true);

		// Exactly one category row, and the transaction points at it.
		expect(count('SELECT COUNT(*) AS c FROM categories WHERE user_id = ? AND name = ?', uid, 'Lending Recovery')).toBe(1);
		const tx = sqlite.prepare('SELECT * FROM transactions WHERE user_id = ?').get(uid) as Record<string, unknown>;
		expect(tx.category_id).toBe(originalCatId);
	});

	it('ROLLs BACK the lending when the category operation fails after the lending INSERT (Test C)', async () => {
		const uid = createUser();
		// No 'Lending Recovery' category exists for this user, so the helper will
		// INSERT one — block that INSERT after the lending row was already written.
		sqlite.exec(`
			CREATE TRIGGER block_category_create
			BEFORE INSERT ON categories
			WHEN NEW.user_id = ${uid} AND NEW.name = 'Lending Recovery'
			BEGIN
				SELECT RAISE(ABORT, 'forced category failure');
			END
		`);
		try {
			await expect(createLending(uid, baseInput({ borrowerName: 'Alice' })))
				.rejects.toThrow('forced category failure');

			// Lending, transaction, and category are all gone — the lending INSERT
			// did not survive the rollback.
			expect(count('SELECT COUNT(*) AS c FROM lendings WHERE user_id = ?', uid)).toBe(0);
			expect(count('SELECT COUNT(*) AS c FROM transactions WHERE user_id = ?', uid)).toBe(0);
			expect(count('SELECT COUNT(*) AS c FROM categories WHERE user_id = ?', uid)).toBe(0);
		} finally {
			sqlite.exec('DROP TRIGGER IF EXISTS block_category_create');
		}
	});

	it('ROLLs BACK a newly-created category when the transaction INSERT fails — no orphan (Test D)', async () => {
		const uid = createUser();
		// The category is created first inside the tx; the transaction INSERT then
		// fails. Both must roll back — the category must not survive as an orphan.
		sqlite.exec(`
			CREATE TRIGGER block_transaction_create
			BEFORE INSERT ON transactions
			WHEN NEW.user_id = ${uid} AND NEW.description = 'Lent to blocked'
			BEGIN
				SELECT RAISE(ABORT, 'forced transaction failure');
			END
		`);
		try {
			await expect(createLending(uid, baseInput({ borrowerName: 'blocked' })))
				.rejects.toThrow('forced transaction failure');

			expect(count('SELECT COUNT(*) AS c FROM lendings WHERE user_id = ?', uid)).toBe(0);
			expect(count('SELECT COUNT(*) AS c FROM transactions WHERE user_id = ?', uid)).toBe(0);
			// No orphan category either.
			expect(count('SELECT COUNT(*) AS c FROM categories WHERE user_id = ?', uid)).toBe(0);
		} finally {
			sqlite.exec('DROP TRIGGER IF EXISTS block_transaction_create');
		}
	});

	it('creates only the lending when recordAsTransaction=false — no transaction, no category (Test E)', async () => {
		const uid = createUser();
		const result = await createLending(uid, baseInput({
			borrowerName: 'Bob',
			direction: 'borrowed',
			recordAsTransaction: false
		}));

		expect(result.success).toBe(true);

		const lending = sqlite.prepare('SELECT * FROM lendings WHERE user_id = ?').get(uid) as Record<string, unknown>;
		expect(lending).toBeDefined();
		expect(lending.borrower_name).toBe('Bob');
		expect(lending.direction).toBe('borrowed');
		expect(count('SELECT COUNT(*) AS c FROM transactions WHERE user_id = ?', uid)).toBe(0);
		expect(count('SELECT COUNT(*) AS c FROM categories WHERE user_id = ?', uid)).toBe(0);
	});

	it('scopes all writes to the caller; another user is untouched (Test F)', async () => {
		const uidA = createUser();
		const uidB = createUser();

		// B has pre-existing data (a lending + a category with the same name).
		sqlite.prepare('INSERT INTO lendings (user_id, borrower_name, amount, date_lent, direction) VALUES (?, ?, ?, ?, ?)')
			.run(uidB, 'B-original', 100, '2026-01-01', 'borrowed');
		sqlite.prepare('INSERT INTO categories (user_id, name, color, icon, type) VALUES (?, ?, ?, ?, ?)')
			.run(uidB, 'Debt Repayment', '#ef4444', '💸', 'income');
		const bCatId = (sqlite.prepare('SELECT id FROM categories WHERE user_id = ? AND name = ?').get(uidB, 'Debt Repayment') as { id: number }).id;

		await createLending(uidA, baseInput({
			borrowerName: 'A-person',
			amount: 3000,
			direction: 'borrowed'
		}));

		// A's rows are scoped to A.
		const aLending = sqlite.prepare('SELECT * FROM lendings WHERE user_id = ?').all(uidA) as Record<string, unknown>[];
		expect(aLending).toHaveLength(1);
		expect(aLending[0].borrower_name).toBe('A-person');
		const aTx = sqlite.prepare('SELECT * FROM transactions WHERE user_id = ?').get(uidA) as Record<string, unknown>;
		expect(aTx).toBeDefined();
		const aCat = sqlite.prepare('SELECT * FROM categories WHERE user_id = ?').get(uidA) as Record<string, unknown>;
		expect(aCat.name).toBe('Debt Repayment');
		expect(aTx.category_id).toBe(aCat.id);

		// B's pre-existing data is intact, and A did not reuse B's category.
		expect(count('SELECT COUNT(*) AS c FROM lendings WHERE user_id = ? AND borrower_name = ?', uidB, 'B-original')).toBe(1);
		expect(count('SELECT COUNT(*) AS c FROM categories WHERE user_id = ? AND name = ?', uidB, 'Debt Repayment')).toBe(1);
		expect(aCat.id).not.toBe(bCatId);
	});

	it('leaves the connection usable after a failed CREATE (no lingering open transaction)', async () => {
		const uid = createUser();
		sqlite.exec(`
			CREATE TRIGGER block_category_create_2
			BEFORE INSERT ON categories
			WHEN NEW.user_id = ${uid}
			BEGIN
				SELECT RAISE(ABORT, 'forced category failure');
			END
		`);
		try {
			await expect(createLending(uid, baseInput({ borrowerName: 'Alice' })))
				.rejects.toThrow('forced category failure');

			// A fresh CREATE on the same connection commits.
			const ok = await createLending(uid, baseInput({ borrowerName: 'Survivor', recordAsTransaction: false }));
			expect(ok.success).toBe(true);
			expect(count('SELECT COUNT(*) AS c FROM lendings WHERE user_id = ?', uid)).toBe(1);
		} finally {
			sqlite.exec('DROP TRIGGER IF EXISTS block_category_create_2');
		}
	});
});

describe('createLending — Drizzle/Postgres structural (tx used, global db never touched)', () => {
	let getDrizzle: any;
	let createLending: (userId: number, input: any) => Promise<{ success: true }>;

	beforeAll(async () => {
		vi.doMock('$lib/database', () => ({
			usePostgres: true,
			getPgPool: vi.fn(),
			getSQLiteDb: vi.fn(),
			initDb: async () => {},
			closeDb: async () => {}
		}));
		vi.doMock('$lib/database/drizzle', () => ({
			getDrizzle: vi.fn()
		}));
		vi.resetModules();
		getDrizzle = (await import('$lib/database/drizzle')).getDrizzle;
		const mod = await import('$lib/server/lendingPayments');
		createLending = mod.createLending;
	});

	function fakeTx() {
		return {
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(async () => [])
				}))
			})),
			insert: vi.fn(() => ({
				values: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 7 }]) }))
			}))
		};
	}

	function fakeDb(tx: ReturnType<typeof fakeTx>) {
		return {
			transaction: vi.fn((cb: (t: typeof tx) => Promise<{ success: true }>) => cb(tx)),
			select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn() })) })),
			insert: vi.fn(() => ({ values: vi.fn() }))
		};
	}

	it('runs lending + category + transaction through db.transaction/tx and never the global db', async () => {
		const tx = fakeTx();
		const db = fakeDb(tx);
		getDrizzle.mockResolvedValue(db);

		const result = await createLending(1, {
			borrowerName: 'Alice', amount: 1000, interestRate: 0,
			dateLent: '2026-01-01', dueDate: null, notes: null,
			direction: 'lent', recordAsTransaction: true
		});

		expect(result.success).toBe(true);
		expect(db.transaction).toHaveBeenCalledTimes(1);
		// lending INSERT + category INSERT + transaction INSERT all via tx
		expect(tx.insert).toHaveBeenCalledTimes(3);
		// category lookup via tx.select
		expect(tx.select).toHaveBeenCalledTimes(1);
		// the global db was never touched inside the transaction
		expect(db.insert).not.toHaveBeenCalled();
		expect(db.select).not.toHaveBeenCalled();
	});

	it('creates only the lending via tx when recordAsTransaction=false', async () => {
		const tx = fakeTx();
		const db = fakeDb(tx);
		getDrizzle.mockResolvedValue(db);

		const result = await createLending(1, {
			borrowerName: 'Bob', amount: 2000, interestRate: 0,
			dateLent: '2026-01-01', dueDate: null, notes: null,
			direction: 'borrowed', recordAsTransaction: false
		});

		expect(result.success).toBe(true);
		expect(db.transaction).toHaveBeenCalledTimes(1);
		expect(tx.insert).toHaveBeenCalledTimes(1);
		expect(tx.select).not.toHaveBeenCalled();
		expect(db.insert).not.toHaveBeenCalled();
		expect(db.select).not.toHaveBeenCalled();
	});
});

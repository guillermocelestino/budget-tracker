import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

/**
 * Direct tests of the PRODUCTION deleteLending() implementation
 * (src/lib/server/lendingPayments.ts) running against an in-memory SQLite
 * database — same technique as tests/unit-test/withTransaction.test.ts.
 *
 * The $lib/database mock replaces ONLY the connection factory (getSQLiteDb)
 * with an in-memory database. withTransaction, the tx helpers, and the whole
 * lendingPayments module are imported unmodified, so these tests exercise the
 * REAL BEGIN/COMMIT/ROLLBACK path and can prove rollback.
 *
 * deleteLending() must delete a lending AND its linked transactions atomically:
 *   A. a successful delete COMMITs — lending, payments (cascade) and linked
 *      transactions all disappear, unrelated rows are untouched
 *   B. a failed delete ROLLs BACK — a forced failure AFTER linked transactions
 *      have been deleted restores lending, payments, and linked transactions
 *   C. ownership is scoped to the caller's user_id
 *   D. no orphaned linked transactions are left behind
 *   E. a missing lending returns false (no error)
 *
 * The final describe is a STRUCTURAL check of the Postgres/Drizzle path: the
 * delete must run through db.transaction/tx and never touch the global db
 * (which on Postgres would use another pooled connection and escape the
 * transaction). It does NOT claim to prove real Postgres rollback.
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

describe('deleteLending — SQLite production implementation (in-memory better-sqlite3)', () => {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	sqlite.exec(SQLITE_FIXTURE_SCHEMA);

	let deleteLending: (userId: number, lendingId: number) => Promise<boolean>;
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
		deleteLending = mod.deleteLending;
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

	function createCategory(userId: number, name: string): number {
		sqlite.prepare('INSERT INTO categories (user_id, name, color, icon, type) VALUES (?, ?, ?, ?, ?)')
			.run(userId, name, '#6366f1', '📁', 'expense');
		return (sqlite.prepare('SELECT id FROM categories WHERE user_id = ? AND name = ?').get(userId, name) as { id: number }).id;
	}

	function createLending(userId: number, borrowerName: string): number {
		sqlite.prepare('INSERT INTO lendings (user_id, borrower_name, amount, interest_rate, date_lent, direction, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
			.run(userId, borrowerName, 1000, 0, '2026-01-01', 'lent', 'active');
		return (sqlite.prepare('SELECT id FROM lendings WHERE user_id = ? AND borrower_name = ?').get(userId, borrowerName) as { id: number }).id;
	}

	function createTransaction(userId: number, categoryId: number, description: string, amount = 100): number {
		sqlite.prepare('INSERT INTO transactions (user_id, amount, description, date, category_id, type) VALUES (?, ?, ?, ?, ?, ?)')
			.run(userId, amount, description, '2026-01-01', categoryId, 'expense');
		return (sqlite.prepare('SELECT id FROM transactions WHERE user_id = ? AND description = ?').get(userId, description) as { id: number }).id;
	}

	function createPayment(userId: number, lendingId: number, transactionId: number | null): number {
		sqlite.prepare('INSERT INTO lending_payments (lending_id, user_id, amount, payment_date, transaction_id, payment_type) VALUES (?, ?, ?, ?, ?, ?)')
			.run(lendingId, userId, 100, '2026-01-15', transactionId, 'payment');
		return (sqlite.prepare('SELECT id FROM lending_payments WHERE lending_id = ? ORDER BY id DESC LIMIT 1').get(lendingId) as { id: number }).id;
	}

	function count(sql: string, ...params: unknown[]): number {
		return (sqlite.prepare(sql).get(...(params as never[])) as { c: number }).c;
	}

	it('COMMITs the delete: lending, payments (cascade) and linked transactions are gone, unrelated rows untouched', async () => {
		const uid = createUser();
		const cat = createCategory(uid, 'Cat');
		const lendingId = createLending(uid, 'Alice');
		const txLinked = createTransaction(uid, cat, 'Lent to Alice', 500);
		createPayment(uid, lendingId, txLinked);
		const txUnrelated = createTransaction(uid, cat, 'Groceries', 200);

		const deleted = await deleteLending(uid, lendingId);

		expect(deleted).toBe(true);
		expect(count('SELECT COUNT(*) AS c FROM lendings WHERE id = ?', lendingId)).toBe(0);
		// Payments were cascade-deleted with the lending.
		expect(count('SELECT COUNT(*) AS c FROM lending_payments WHERE lending_id = ?', lendingId)).toBe(0);
		// The linked transaction was deleted inside the same transaction.
		expect(count('SELECT COUNT(*) AS c FROM transactions WHERE id = ?', txLinked)).toBe(0);
		// Unrelated transaction survived.
		expect(count('SELECT COUNT(*) AS c FROM transactions WHERE id = ?', txUnrelated)).toBe(1);
	});

	it('ROLLs BACK the whole delete when the lending DELETE fails after linked transactions were deleted', async () => {
		const uid = createUser();
		const cat = createCategory(uid, 'Cat');
		const lendingId = createLending(uid, 'SENTINEL'); // trigger keyed on this name
		const tx1 = createTransaction(uid, cat, 'Lent to SENTINEL 1', 300);
		const tx2 = createTransaction(uid, cat, 'Lent to SENTINEL 2', 200);
		createPayment(uid, lendingId, tx1);
		createPayment(uid, lendingId, tx2);

		// Deliberate failure: a BEFORE DELETE trigger on lendings fires AFTER the
		// linked-transaction deletes have already run inside the transaction.
		// RAISE(ABORT) fails the DELETE statement but leaves the transaction open,
		// so the production withTransaction() catch path must ROLLBACK explicitly.
		sqlite.exec(`
			CREATE TRIGGER block_sentinel_lending_delete
			BEFORE DELETE ON lendings
			WHEN OLD.borrower_name = 'SENTINEL'
			BEGIN
				SELECT RAISE(ABORT, 'forced failure');
			END
		`);
		try {
			await expect(deleteLending(uid, lendingId)).rejects.toThrow('forced failure');

			// Everything rolled back: lending, payments, AND the linked transactions.
			expect(count('SELECT COUNT(*) AS c FROM lendings WHERE id = ?', lendingId)).toBe(1);
			expect(count('SELECT COUNT(*) AS c FROM lending_payments WHERE lending_id = ?', lendingId)).toBe(2);
			expect(count('SELECT COUNT(*) AS c FROM transactions WHERE id = ?', tx1)).toBe(1);
			expect(count('SELECT COUNT(*) AS c FROM transactions WHERE id = ?', tx2)).toBe(1);
			// The payments still reference their transactions — the SET NULL
			// cascade did not survive the rollback either.
			const refs = (sqlite.prepare('SELECT transaction_id FROM lending_payments WHERE lending_id = ? ORDER BY id').all(lendingId) as { transaction_id: number | null }[])
				.map((r) => r.transaction_id);
			expect(refs).toEqual([tx1, tx2]);
		} finally {
			sqlite.exec('DROP TRIGGER IF EXISTS block_sentinel_lending_delete');
		}
	});

	it('scopes the delete to the caller: another user\'s lending is untouched and un-deletable', async () => {
		const uidA = createUser();
		const uidB = createUser();
		const catA = createCategory(uidA, 'CatA');
		const catB = createCategory(uidB, 'CatB');

		const lendingA = createLending(uidA, 'A person');
		const txA = createTransaction(uidA, catA, 'Lent to A person');
		createPayment(uidA, lendingA, txA);

		const lendingB = createLending(uidB, 'B person');
		const txB = createTransaction(uidB, catB, 'Lent to B person');
		createPayment(uidB, lendingB, txB);

		const deleted = await deleteLending(uidA, lendingA);
		expect(deleted).toBe(true);
		// A's lending, payment, and linked transaction are gone.
		expect(count('SELECT COUNT(*) AS c FROM lendings WHERE id = ?', lendingA)).toBe(0);
		expect(count('SELECT COUNT(*) AS c FROM lending_payments WHERE lending_id = ?', lendingA)).toBe(0);
		expect(count('SELECT COUNT(*) AS c FROM transactions WHERE id = ?', txA)).toBe(0);

		// B's records are untouched...
		expect(count('SELECT COUNT(*) AS c FROM lendings WHERE id = ?', lendingB)).toBe(1);
		expect(count('SELECT COUNT(*) AS c FROM lending_payments WHERE lending_id = ?', lendingB)).toBe(1);
		expect(count('SELECT COUNT(*) AS c FROM transactions WHERE id = ?', txB)).toBe(1);

		// ...and A cannot delete B's lending (ownership scoping on the SELECT/DELETE).
		const cross = await deleteLending(uidA, lendingB);
		expect(cross).toBe(false);
		expect(count('SELECT COUNT(*) AS c FROM lendings WHERE id = ?', lendingB)).toBe(1);
		expect(count('SELECT COUNT(*) AS c FROM transactions WHERE id = ?', txB)).toBe(1);
	});

	it('leaves no orphaned linked transactions after a successful delete', async () => {
		const uid = createUser();
		const cat = createCategory(uid, 'Cat');
		const lendingId = createLending(uid, 'No-orphans');
		const linked1 = createTransaction(uid, cat, 'Lent to No-orphans 1');
		const linked2 = createTransaction(uid, cat, 'Lent to No-orphans 2');
		createPayment(uid, lendingId, linked1);
		createPayment(uid, lendingId, linked2);
		const unrelated = createTransaction(uid, cat, 'Salary', 1000);

		await deleteLending(uid, lendingId);

		// Both linked transactions were deleted; the unrelated one remains.
		expect(count(`SELECT COUNT(*) AS c FROM transactions WHERE id IN (${linked1}, ${linked2})`)).toBe(0);
		expect(count('SELECT COUNT(*) AS c FROM transactions WHERE id = ?', unrelated)).toBe(1);
	});

	it('returns false (no error) when the lending does not exist', async () => {
		const uid = createUser();
		const deleted = await deleteLending(uid, 999999);
		expect(deleted).toBe(false);
	});

	it('deletes a lending that has no payments or linked transactions', async () => {
		const uid = createUser();
		const lendingId = createLending(uid, 'Solo');
		const deleted = await deleteLending(uid, lendingId);
		expect(deleted).toBe(true);
		expect(count('SELECT COUNT(*) AS c FROM lendings WHERE id = ?', lendingId)).toBe(0);
	});

	it('leaves the connection usable after a failed delete (no lingering open transaction)', async () => {
		const uid = createUser();
		const cat = createCategory(uid, 'Cat');
		const lendingId = createLending(uid, 'SENTINEL2');
		createPayment(uid, lendingId, createTransaction(uid, cat, 'Lent to SENTINEL2'));

		sqlite.exec(`
			CREATE TRIGGER block_sentinel2_lending_delete
			BEFORE DELETE ON lendings
			WHEN OLD.borrower_name = 'SENTINEL2'
			BEGIN
				SELECT RAISE(ABORT, 'forced failure');
			END
		`);
		try {
			await expect(deleteLending(uid, lendingId)).rejects.toThrow('forced failure');

			// A fresh delete (of a different lending) on the same connection works.
			const other = createLending(uid, 'Other');
			const ok = await deleteLending(uid, other);
			expect(ok).toBe(true);
			expect(count('SELECT COUNT(*) AS c FROM lendings WHERE id = ?', other)).toBe(0);
		} finally {
			sqlite.exec('DROP TRIGGER IF EXISTS block_sentinel2_lending_delete');
		}
	});
});

describe('deleteLending — Drizzle/Postgres structural (tx used, global db never touched)', () => {
	let getDrizzle: any;
	let deleteLending: (userId: number, lendingId: number) => Promise<boolean>;

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
		deleteLending = mod.deleteLending;
	});

	it('runs all reads and deletes through db.transaction/tx and never the global db', async () => {
		const tx = {
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(async () => [
						{ transaction_id: 10 },
						{ transaction_id: 20 }
					])
				}))
			})),
			delete: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 7 }]) })) }))
		};
		const db = {
			transaction: vi.fn((cb: (t: typeof tx) => Promise<boolean>) => cb(tx)),
			select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn() })) })),
			delete: vi.fn(() => ({ where: vi.fn() }))
		};
		getDrizzle.mockResolvedValue(db);

		const result = await deleteLending(1, 7);

		expect(result).toBe(true);
		expect(db.transaction).toHaveBeenCalledTimes(1);
		// Linked ids were found via tx.select, not db.select...
		expect(tx.select).toHaveBeenCalledTimes(1);
		// ...and both linked deletes + the lending delete went through tx.delete.
		expect(tx.delete).toHaveBeenCalledTimes(3);
		// The global db was never touched inside the transaction (Postgres would
		// otherwise use a different pooled connection and escape atomicity).
		expect(db.select).not.toHaveBeenCalled();
		expect(db.delete).not.toHaveBeenCalled();
	});

	it('returns false when the lending is not found (no row returned)', async () => {
		const tx = {
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(async () => [])
				}))
			})),
			delete: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => []) })) }))
		};
		const db = {
			transaction: vi.fn((cb: (t: typeof tx) => Promise<boolean>) => cb(tx)),
			select: vi.fn(),
			delete: vi.fn()
		};
		getDrizzle.mockResolvedValue(db);

		const result = await deleteLending(1, 999);

		expect(result).toBe(false);
		expect(db.transaction).toHaveBeenCalledTimes(1);
		expect(db.select).not.toHaveBeenCalled();
		expect(db.delete).not.toHaveBeenCalled();
	});
});

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

/**
 * Direct tests of the PRODUCTION updateLending() implementation
 * (src/lib/server/lendingPayments.ts) running against an in-memory SQLite
 * database — same technique as createLending.test.ts.
 *
 * The $lib/database mock replaces ONLY the connection factory (getSQLiteDb)
 * with an in-memory database. withTransaction, the tx helpers, and the whole
 * lendingPayments module are imported unmodified, so these tests exercise the
 * REAL BEGIN/COMMIT/ROLLBACK path.
 *
 * updateLending() is the single source of truth for the lending-update rules
 * shared by the lending/borrowed page actions and the API PUT:
 *   A. a full update COMMITs when no payments exist (amount/date_lent editable)
 *   B. the payment lock — with a payment present, amount/date_lent are IGNORED
 *      while metadata (borrower_name/interest_rate/due_date/notes) still updates
 *   C. ownership — another user's lending is rejected and untouched
 *   D. a missing lending is rejected
 *   E. a non-positive amount is rejected when no payments exist
 *   F. status is never client-settable — the status cache stays derived
 *   G. a failed UPDATE ROLLs BACK and leaves the connection usable
 *
 * The final describe is a STRUCTURAL check of the Postgres/Drizzle path: the
 * UPDATE must run through db.transaction/tx (select + update all via tx), never
 * touch the global db, and the payment-lock branch must not write amount/date.
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

describe('updateLending — SQLite production implementation (in-memory better-sqlite3)', () => {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	sqlite.exec(SQLITE_FIXTURE_SCHEMA);

	let updateLending: (userId: number, lendingId: number, input: any) => Promise<{ success: true }>;
	let seq = 0;

	beforeAll(async () => {
		vi.doMock('$lib/database', () => ({
			usePostgres: false,
			getPgPool: () => Promise.reject(new Error('getPgPool should not be called on SQLite path')),
			getSQLiteDb: () => Promise.resolve(sqlite),
			initDb: async () => {},
			closeDb: async () => {}
		}));
		vi.resetModules();
		const mod = await import('$lib/server/lendingPayments');
		updateLending = mod.updateLending;
	});

	beforeEach(() => {
		sqlite.exec(
			'DELETE FROM lending_payments; DELETE FROM transactions; DELETE FROM lendings; DELETE FROM categories; DELETE FROM users;'
		);
	});

	function createUser(): number {
		const username = `user_${++seq}`;
		sqlite.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, 'hash');
		return (sqlite.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: number }).id;
	}

	function insertLending(uid: number, overrides: Record<string, unknown> = {}): number {
		const {
			borrower_name = 'Alice',
			amount = 1000,
			interest_rate = 0,
			date_lent = '2026-01-01',
			due_date = null,
			direction = 'lent',
			status = 'active',
			notes = null
		} = overrides;
		const info = sqlite
			.prepare(
				`INSERT INTO lendings (user_id, borrower_name, amount, interest_rate, date_lent, due_date, direction, status, notes)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.run(uid, borrower_name, amount, interest_rate, date_lent, due_date, direction, status, notes);
		return Number(info.lastInsertRowid);
	}

	function insertPayment(uid: number, lendingId: number, amount = 100): void {
		sqlite
			.prepare(
				`INSERT INTO lending_payments (lending_id, user_id, amount, payment_date, payment_type)
				 VALUES (?, ?, ?, '2026-02-01', 'payment')`
			)
			.run(lendingId, uid, amount);
	}

	function getLending(id: number): Record<string, unknown> {
		return sqlite.prepare('SELECT * FROM lendings WHERE id = ?').get(id) as Record<string, unknown>;
	}

	function input(overrides: Partial<Record<string, unknown>> = {}): any {
		return {
			borrowerName: 'Renamed',
			amount: 2000,
			interestRate: 5,
			dateLent: '2026-03-01',
			dueDate: '2026-12-31',
			notes: 'new note',
			...overrides
		};
	}

	it('COMMITs a full update when no payments exist — amount/date_lent editable (Test A)', async () => {
		const uid = createUser();
		const id = insertLending(uid, { amount: 1000 });

		const result = await updateLending(uid, id, input());

		expect(result).toEqual({ success: true });
		const row = getLending(id);
		expect(row.borrower_name).toBe('Renamed');
		expect(row.amount).toBe(2000);
		expect(row.interest_rate).toBe(5);
		expect(row.date_lent).toBe('2026-03-01');
		expect(row.due_date).toBe('2026-12-31');
		expect(row.notes).toBe('new note');
		// status is derived, never written by an update
		expect(row.status).toBe('active');
	});

	it('locks amount and date_lent when a payment exists — metadata still updates (Test B)', async () => {
		const uid = createUser();
		const id = insertLending(uid, { amount: 1000 });
		insertPayment(uid, id, 200);

		const result = await updateLending(uid, id, input({
			borrowerName: 'MetaOnly',
			amount: 9999,
			dateLent: '2099-01-01'
		}));

		expect(result).toEqual({ success: true });
		const row = getLending(id);
		expect(row.borrower_name).toBe('MetaOnly');
		expect(row.interest_rate).toBe(5);
		expect(row.due_date).toBe('2026-12-31');
		expect(row.notes).toBe('new note');
		// amount/date_lent are locked — untouched
		expect(row.amount).toBe(1000);
		expect(row.date_lent).toBe('2026-01-01');
		// derived status unchanged (remaining = 800 > 0)
		expect(row.status).toBe('active');
	});

	it('rejects updating another user’s lending and leaves it untouched (Test C)', async () => {
		const uidA = createUser();
		const uidB = createUser();
		const id = insertLending(uidA, {});

		await expect(updateLending(uidB, id, input({ borrowerName: 'Hacker' })))
			.rejects.toThrow('Lending not found');

		const row = getLending(id);
		expect(row.borrower_name).toBe('Alice');
		expect(row.amount).toBe(1000);
	});

	it('rejects a missing lending (Test D)', async () => {
		const uid = createUser();
		await expect(updateLending(uid, 9999, input()))
			.rejects.toThrow('Lending not found');
	});

	it('rejects a non-positive amount when no payments exist (Test E)', async () => {
		const uid = createUser();
		const id = insertLending(uid, {});

		for (const bad of [0, -5, NaN]) {
			await expect(updateLending(uid, id, input({ amount: bad })))
				.rejects.toThrow('Amount must be a positive number');
		}
		expect(getLending(id).borrower_name).toBe('Alice');
	});

	it('never lets the client set status — the cache stays derived (Test F)', async () => {
		const uid = createUser();
		// Lending with a payment: remaining = 900, so derived status is 'active'.
		const id = insertLending(uid, { amount: 1000 });
		insertPayment(uid, id, 100);

		// There is no status field in the service input, so a client cannot
		// force 'paid'. Metadata + the lock still apply.
		await updateLending(uid, id, input({ amount: 1, dateLent: '2099-01-01' }));

		const row = getLending(id);
		expect(row.status).toBe('active');
		expect(row.amount).toBe(1000); // locked
	});

	it('ROLLs BACK a failed UPDATE and leaves the connection usable (Test G)', async () => {
		const uid = createUser();
		const id = insertLending(uid, {});

		sqlite.exec(`
			CREATE TRIGGER block_lending_update
			BEFORE UPDATE ON lendings
			WHEN NEW.user_id = ${uid}
			BEGIN
				SELECT RAISE(ABORT, 'forced update failure');
			END
		`);
		try {
			await expect(updateLending(uid, id, input({ borrowerName: 'ShouldNotPersist' })))
				.rejects.toThrow('forced update failure');

			const row = getLending(id);
			expect(row.borrower_name).toBe('Alice');
			expect(row.amount).toBe(1000);
		} finally {
			sqlite.exec('DROP TRIGGER IF EXISTS block_lending_update');
		}

		// A fresh UPDATE on the same connection commits.
		const ok = await updateLending(uid, id, input({ borrowerName: 'Survivor' }));
		expect(ok).toEqual({ success: true });
		expect(getLending(id).borrower_name).toBe('Survivor');
	});
});

describe('updateLending — Drizzle/Postgres structural (tx used, global db never touched)', () => {
	let getDrizzle: any;
	let updateLending: (userId: number, lendingId: number, input: any) => Promise<{ success: true }>;

	const TABLE_NAME = Symbol.for('drizzle:Name');
	function tableNameOf(table: unknown): string {
		return (table as Record<symbol, string> | undefined)?.[TABLE_NAME] ?? 'unknown';
	}

	function makeFakeTx(options: { existing?: unknown; paymentCount?: number }) {
		const calls: { setPayloads: Record<string, unknown>[] } = { setPayloads: [] };
		const tx = {
			calls,
			select: vi.fn((_fields?: Record<string, unknown>) => ({
				from: vi.fn((table: unknown) => ({
					where: vi.fn(async () => {
						const name = tableNameOf(table);
						if (name === 'lendings') {
							return options.existing !== undefined ? [options.existing] : [];
						}
						return [{ count: options.paymentCount ?? 0 }];
					})
				}))
			})),
			update: vi.fn(() => ({
				set: vi.fn((values: Record<string, unknown>) => {
					calls.setPayloads.push(values);
					return { where: vi.fn(async () => ({ rows: [] })) };
				})
			}))
		};
		return tx;
	}

	function fakeDb(tx: ReturnType<typeof makeFakeTx>) {
		return {
			transaction: vi.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
			select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn() })) })),
			update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) }))
		};
	}

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
		updateLending = mod.updateLending;
	});

	const input = {
		borrowerName: 'Renamed',
		amount: 2000,
		interestRate: 5,
		dateLent: '2026-03-01',
		dueDate: '2026-12-31',
		notes: 'new note'
	};

	it('runs the ownership check + payment count + UPDATE all through tx and never the global db', async () => {
		const tx = makeFakeTx({ existing: { id: 1 }, paymentCount: 0 });
		const db = fakeDb(tx);
		getDrizzle.mockResolvedValue(db);

		const result = await updateLending(1, 1, input);

		expect(result).toEqual({ success: true });
		expect(db.transaction).toHaveBeenCalledTimes(1);
		// lendings ownership SELECT + lending_payments count SELECT
		expect(tx.select).toHaveBeenCalledTimes(2);
		expect(tx.update).toHaveBeenCalledTimes(1);
		// the global db was never touched inside the transaction
		expect(db.select).not.toHaveBeenCalled();
		expect(db.update).not.toHaveBeenCalled();
	});

	it('no-payment branch writes amount/date_lent (and never status)', async () => {
		const tx = makeFakeTx({ existing: { id: 1 }, paymentCount: 0 });
		getDrizzle.mockResolvedValue(fakeDb(tx));

		await updateLending(1, 1, input);

		const payload = tx.calls.setPayloads[0];
		expect(payload.amount).toBe('2000');
		expect(payload.date_lent).toBe('2026-03-01');
		expect(payload.borrower_name).toBe('Renamed');
		expect(payload.notes).toBe('new note');
		expect('status' in payload).toBe(false);
	});

	it('payment-lock branch does NOT write amount/date_lent (or status)', async () => {
		const tx = makeFakeTx({ existing: { id: 1 }, paymentCount: 1 });
		getDrizzle.mockResolvedValue(fakeDb(tx));

		await updateLending(1, 1, input);

		const payload = tx.calls.setPayloads[0];
		expect('amount' in payload).toBe(false);
		expect('date_lent' in payload).toBe(false);
		expect('status' in payload).toBe(false);
		expect(payload.borrower_name).toBe('Renamed');
		expect(payload.notes).toBe('new note');
		expect(payload.interest_rate).toBe('5');
		expect(payload.due_date).toBe('2026-12-31');
	});

	it('enforces ownership inside the transaction — no UPDATE for a missing lending', async () => {
		const tx = makeFakeTx({ existing: undefined, paymentCount: 0 });
		getDrizzle.mockResolvedValue(fakeDb(tx));

		await expect(updateLending(1, 999, input))
			.rejects.toThrow('Lending not found');
		expect(tx.update).not.toHaveBeenCalled();
	});
});

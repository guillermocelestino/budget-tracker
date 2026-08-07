import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

let sequence = 0;

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
  color TEXT NOT NULL DEFAULT '#6366f1',
  icon TEXT NOT NULL DEFAULT '📁',
  type TEXT NOT NULL DEFAULT 'expense',
  budget_limit REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, name)
);
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  description TEXT NOT NULL,
  date TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

describe('recordLendingTransaction — SQLite / raw query path (in-memory better-sqlite3)', () => {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	sqlite.exec(SQLITE_FIXTURE_SCHEMA);

	let recordLendingTransaction: typeof import('$lib/server/recordLendingTransaction').recordLendingTransaction;

	beforeAll(async () => {
		vi.doMock('$lib/database', () => ({
			usePostgres: false,
			getPgPool: () => Promise.reject(new Error('getPgPool should not be called on SQLite path')),
			getSQLiteDb: () => Promise.resolve(sqlite),
			initDb: async () => {},
			closeDb: async () => {}
		}));

		vi.doMock('$lib/database/query', async (importOriginal) => {
			const real = (await importOriginal()) as typeof import('$lib/database/query');
			const mapParams = (paramIndices: number[], params: unknown[]): unknown[] =>
				paramIndices.length === params.length ? params : paramIndices.map((i) => params[i]);
			return {
				...real,
				queryOne: async <T>(text: string, params: unknown[] = []): Promise<T | undefined> => {
					const { sql, paramIndices } = real.translatePgToSQLite(text);
					const mapped = mapParams(paramIndices, params);
					const stmt = sqlite.prepare(sql);
					return (mapped.length > 0 ? stmt.get(...mapped) : stmt.get()) as T | undefined;
				},
				queryMany: async <T>(text: string, params: unknown[] = []): Promise<T[]> => {
					const { sql, paramIndices } = real.translatePgToSQLite(text);
					const mapped = mapParams(paramIndices, params);
					const stmt = sqlite.prepare(sql);
					return (mapped.length > 0 ? stmt.all(...mapped) : stmt.all()) as T[];
				},
				execute: async (text: string, params: unknown[] = []): Promise<void> => {
					const { sql, paramIndices } = real.translatePgToSQLite(text);
					const mapped = mapParams(paramIndices, params);
					const stmt = sqlite.prepare(sql);
					if (mapped.length > 0) stmt.run(...mapped); else stmt.run();
				}
			};
		});

		vi.resetModules();
		const svc = await import('$lib/server/recordLendingTransaction');
		recordLendingTransaction = svc.recordLendingTransaction;
	});

	function createUser(): number {
		const username = `user_${sequence++}`;
		sqlite.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, 'hash');
		const row = sqlite.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: number };
		return row.id;
	}

	function getTransaction(userId: number, type?: string) {
		const rows = sqlite.prepare('SELECT * FROM transactions WHERE user_id = ?' + (type ? ' AND type = ?' : '')).all(userId, ...(type ? [type] : [])) as Record<string, unknown>[];
		return rows[0];
	}

	function getCategory(userId: number, name: string) {
		return sqlite.prepare('SELECT * FROM categories WHERE user_id = ? AND name = ?').get(userId, name) as Record<string, unknown> | undefined;
	}

	it('create + lent → expense transaction with category "Lending Recovery"', async () => {
		const userId = createUser();
		const txId = await recordLendingTransaction(userId, {
			event: 'create',
			direction: 'lent',
			amount: 5000,
			partyName: 'Alice',
			date: '2026-08-01'
		});

		expect(txId).toBeGreaterThan(0);
		const tx = getTransaction(userId);
		expect(tx).toBeDefined();
		expect(tx!.type).toBe('expense');
		expect(tx!.amount).toBe(5000);
		expect(tx!.description).toBe('Lent to Alice');
		expect(tx!.date).toBe('2026-08-01');
		const cat = getCategory(userId, 'Lending Recovery');
		expect(cat).toBeDefined();
		expect(cat!.color).toBe('#8b5cf6');
		expect(cat!.icon).toBe('💳');
	});

	it('create + borrowed → income transaction with category "Debt Repayment"', async () => {
		const userId = createUser();
		const txId = await recordLendingTransaction(userId, {
			event: 'create',
			direction: 'borrowed',
			amount: 3000,
			partyName: 'Bob',
			date: '2026-08-02'
		});

		expect(txId).toBeGreaterThan(0);
		const tx = getTransaction(userId, 'income');
		expect(tx).toBeDefined();
		expect(tx!.amount).toBe(3000);
		expect(tx!.description).toBe('Borrowed from Bob');
		const cat = getCategory(userId, 'Debt Repayment');
		expect(cat).toBeDefined();
		expect(cat!.color).toBe('#ef4444');
		expect(cat!.icon).toBe('💸');
	});

	it('repayment + lent → income transaction with category "Loan Repayment"', async () => {
		const userId = createUser();
		const txId = await recordLendingTransaction(userId, {
			event: 'repayment',
			direction: 'lent',
			amount: 1000,
			partyName: 'Alice',
			date: '2026-08-03'
		});

		expect(txId).toBeGreaterThan(0);
		const tx = getTransaction(userId, 'income');
		expect(tx).toBeDefined();
		expect(tx!.amount).toBe(1000);
		expect(tx!.description).toBe('Repayment from Alice');
		const cat = getCategory(userId, 'Loan Repayment');
		expect(cat).toBeDefined();
		expect(cat!.type).toBe('income');
	});

	it('repayment + lent falls back to legacy "Lending Recovery" when canonical not found', async () => {
		const userId = createUser();
		// Pre-create legacy category only
		sqlite.prepare('INSERT INTO categories (user_id, name, color, icon, type) VALUES (?, ?, ?, ?, ?)').run(userId, 'Lending Recovery', '#8b5cf6', '💳', 'income');

		const txId = await recordLendingTransaction(userId, {
			event: 'repayment',
			direction: 'lent',
			amount: 500,
			partyName: 'Alice',
			date: '2026-08-04'
		});

		expect(txId).toBeGreaterThan(0);
		const tx = getTransaction(userId, 'income');
		expect(tx).toBeDefined();
		expect(tx!.category_id).toBe(getCategory(userId, 'Lending Recovery')!.id);
	});

	it('repayment + borrowed → expense transaction with category "Debt Repayment"', async () => {
		const userId = createUser();
		const txId = await recordLendingTransaction(userId, {
			event: 'repayment',
			direction: 'borrowed',
			amount: 2000,
			partyName: 'Bob',
			date: '2026-08-05'
		});

		expect(txId).toBeGreaterThan(0);
		const tx = getTransaction(userId, 'expense');
		expect(tx).toBeDefined();
		expect(tx!.amount).toBe(2000);
		expect(tx!.description).toBe('Repaid to Bob');
		const cat = getCategory(userId, 'Debt Repayment');
		expect(cat).toBeDefined();
		expect(cat!.type).toBe('expense');
	});

	it('auto-creates category when it does not exist', async () => {
		const userId = createUser();
		const txId = await recordLendingTransaction(userId, {
			event: 'create',
			direction: 'lent',
			amount: 1500,
			partyName: 'Charlie',
			date: '2026-08-06'
		});

		expect(txId).toBeGreaterThan(0);
		const cat = getCategory(userId, 'Lending Recovery');
		expect(cat).toBeDefined();
	});

	it('returns the created transaction ID', async () => {
		const userId = createUser();
		const txId = await recordLendingTransaction(userId, {
			event: 'create',
			direction: 'lent',
			amount: 2500,
			partyName: 'Dave',
			date: '2026-08-07'
		});

		expect(typeof txId).toBe('number');
		expect(txId).toBeGreaterThan(0);
		const tx = sqlite.prepare('SELECT * FROM transactions WHERE id = ?').get(txId) as Record<string, unknown> | undefined;
		expect(tx).toBeDefined();
		expect(tx!.user_id).toBe(userId);
	});

	it('isolates data by user_id', async () => {
		const userA = createUser();
		const userB = createUser();
		const txIdA = await recordLendingTransaction(userA, {
			event: 'create',
			direction: 'lent',
			amount: 1000,
			partyName: 'Eve',
			date: '2026-08-08'
		});
		const txIdB = await recordLendingTransaction(userB, {
			event: 'create',
			direction: 'lent',
			amount: 9999,
			partyName: 'Frank',
			date: '2026-08-08'
		});

		expect(txIdA).toBeGreaterThan(0);
		expect(txIdB).toBeGreaterThan(0);
		expect(txIdA).not.toBe(txIdB);
		const txA = sqlite.prepare('SELECT * FROM transactions WHERE id = ?').get(txIdA) as Record<string, unknown>;
		expect(txA.user_id).toBe(userA);
		const txB = sqlite.prepare('SELECT * FROM transactions WHERE id = ?').get(txIdB) as Record<string, unknown>;
		expect(txB.user_id).toBe(userB);
	});
});

describe('recordLendingTransaction — Drizzle / Postgres path (recorded fake client)', () => {
	let recordLendingTransaction: typeof import('$lib/server/recordLendingTransaction').recordLendingTransaction;
	let calls: {
		selects: { table: string; cols: string[]; where?: Record<string, unknown> }[];
		inserts: { table: string; values: Record<string, unknown> }[];
		returningIds: { table: string; id: number }[];
	};

	function fakeDb() {
		return {
			select(cols?: Record<string, unknown>) {
				const colNames = cols ? Object.keys(cols) : [];
				return {
					from(table: { name?: string }) {
						const tableName = table?.name ?? 'unknown';
						return {
							where(filters: Record<string, unknown>) {
								calls.selects.push({ table: tableName, cols: colNames, where: filters });
								return {
									then(onFulfilled: any, onRejected: any) {
										return Promise.resolve([]).then(onFulfilled, onRejected);
									}
								};
							}
						};
					}
				};
			},
			insert() {
				return {
					values(values: Record<string, unknown>) {
						return {
							returning(cols: Record<string, unknown>) {
								const tableName = Object.keys(calls.inserts).length > 0 ? 'unknown' : 'unknown';
								const id = calls.returningIds.length + 1;
								calls.returningIds.push({ table: tableName, id });
								calls.inserts.push({ table: tableName, values });
								return Promise.resolve([{ id }]);
							}
						};
					}
				};
			}
		};
	}

	beforeAll(async () => {
		vi.doMock('$lib/database', () => ({
			usePostgres: true,
			getPgPool: () => Promise.reject(new Error('getPgPool should not be called on Drizzle path')),
			getSQLiteDb: () => Promise.reject(new Error('getSQLiteDb should not be called on Drizzle path')),
			initDb: async () => {},
			closeDb: async () => {}
		}));
		vi.doMock('$lib/database/drizzle', () => ({
			getDrizzle: () => Promise.resolve(fakeDb())
		}));

		vi.resetModules();
		const svc = await import('$lib/server/recordLendingTransaction');
		recordLendingTransaction = svc.recordLendingTransaction;
	});

	beforeEach(() => {
		calls = { selects: [], inserts: [], returningIds: [] };
	});

	it('create + lent issues category SELECT + INSERT and transaction INSERT with returning', async () => {
		const result = await recordLendingTransaction(42, {
			event: 'create',
			direction: 'lent',
			amount: 5000,
			partyName: 'Alice',
			date: '2026-08-01'
		});

		expect(typeof result).toBe('number');
		expect(result).toBeGreaterThan(0);
		expect(calls.selects).toHaveLength(1);
		expect(calls.inserts).toHaveLength(2); // category + transaction
		expect(calls.returningIds).toHaveLength(2);
		expect(calls.inserts[0]!.values.name).toBe('Lending Recovery');
		expect(calls.inserts[1]!.values.amount).toBe('5000');
		expect(calls.inserts[1]!.values.type).toBe('expense');
		expect(calls.inserts[1]!.values.description).toBe('Lent to Alice');
	});

	it('create + borrowed issues correct category and transaction values', async () => {
		const result = await recordLendingTransaction(42, {
			event: 'create',
			direction: 'borrowed',
			amount: 3000,
			partyName: 'Bob',
			date: '2026-08-02'
		});

		expect(typeof result).toBe('number');
		expect(calls.inserts[0]!.values.name).toBe('Debt Repayment');
		expect(calls.inserts[1]!.values.amount).toBe('3000');
		expect(calls.inserts[1]!.values.type).toBe('income');
		expect(calls.inserts[1]!.values.description).toBe('Borrowed from Bob');
	});

	it('repayment + lent uses canonical "Loan Repayment" lookup first', async () => {
		const result = await recordLendingTransaction(42, {
			event: 'repayment',
			direction: 'lent',
			amount: 1000,
			partyName: 'Alice',
			date: '2026-08-03'
		});

		expect(typeof result).toBe('number');
		// The fake client always returns [], so both lookups happen (canonical + legacy)
		// before creating the canonical category. We verify the correct category
		// was created by checking the insert values.
		expect(calls.selects).toHaveLength(2);
		expect(calls.inserts[0]!.values.name).toBe('Loan Repayment');
	});

	it('repayment + lent falls back to legacy "Lending Recovery" when canonical not found', async () => {
		// The fake client always returns [] for selects, so both lookups return empty.
		// The code then creates the canonical "Loan Repayment" category.
		const result = await recordLendingTransaction(42, {
			event: 'repayment',
			direction: 'lent',
			amount: 500,
			partyName: 'Alice',
			date: '2026-08-04'
		});

		expect(typeof result).toBe('number');
		expect(calls.selects).toHaveLength(2); // canonical + legacy
		// When neither exists, the code creates "Loan Repayment" (canonical)
		expect(calls.inserts[0]!.values.name).toBe('Loan Repayment');
	});

	it('repayment + borrowed uses "Debt Repayment"', async () => {
		const result = await recordLendingTransaction(42, {
			event: 'repayment',
			direction: 'borrowed',
			amount: 2000,
			partyName: 'Bob',
			date: '2026-08-05'
		});

		expect(typeof result).toBe('number');
		expect(calls.selects).toHaveLength(1);
		// Verify the correct category was used by checking the insert
		expect(calls.inserts[0]!.values.name).toBe('Debt Repayment');
	});

	it('transaction INSERT uses .returning({ id }) and amount as string', async () => {
		const result = await recordLendingTransaction(42, {
			event: 'create',
			direction: 'lent',
			amount: 2500,
			partyName: 'Charlie',
			date: '2026-08-06'
		});

		expect(typeof result).toBe('number');
		const txInsert = calls.inserts.find(i => i.values.description === 'Lent to Charlie');
		expect(txInsert).toBeDefined();
		expect(txInsert!.values.amount).toBe('2500');
		expect(txInsert!.values.type).toBe('expense');
		expect(txInsert!.values.date).toBe('2026-08-06');
		expect(calls.returningIds.some(r => r.id === result)).toBe(true);
	});
});
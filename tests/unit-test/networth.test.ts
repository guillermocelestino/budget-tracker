import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

let sequence = 0;

const SQLITE_FIXTURE_SCHEMA = `
CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE categories (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#6366f1', icon TEXT NOT NULL DEFAULT '📁', type TEXT NOT NULL DEFAULT 'expense', budget_limit REAL, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE (user_id, name));
CREATE TABLE transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, amount REAL NOT NULL, description TEXT NOT NULL, date TEXT NOT NULL, category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT, type TEXT NOT NULL CHECK(type IN ('income', 'expense')), created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE lendings (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, borrower_name TEXT NOT NULL, amount REAL NOT NULL, interest_rate REAL, date_lent TEXT NOT NULL, due_date TEXT, status TEXT NOT NULL DEFAULT 'active', notes TEXT, direction TEXT NOT NULL DEFAULT 'lent', created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE lending_payments (id INTEGER PRIMARY KEY AUTOINCREMENT, lending_id INTEGER NOT NULL REFERENCES lendings(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, amount REAL NOT NULL, payment_date TEXT NOT NULL, notes TEXT, transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL, payment_type TEXT NOT NULL DEFAULT 'payment' CHECK (payment_type IN ('payment', 'write_off')), reference TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
`;

describe('networth — SQLite / raw query path (in-memory better-sqlite3)', () => {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	sqlite.exec(SQLITE_FIXTURE_SCHEMA);

	let computeNetWorth: typeof import('$lib/server/networth').computeNetWorth;

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
		const svc = await import('$lib/server/networth');
		computeNetWorth = svc.computeNetWorth;
	});

	function createUser(): number {
		const username = `user_${sequence++}`;
		sqlite.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, 'hash');
		return (sqlite.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: number }).id;
	}

	function createCategory(userId: number): number {
		const name = `category_${sequence++}`;
		sqlite.prepare('INSERT INTO categories (user_id, name, color, icon, type) VALUES (?, ?, ?, ?, ?)').run(userId, name, '#123456', '📁', 'expense');
		return (sqlite.prepare('SELECT id FROM categories WHERE user_id = ? AND name = ?').get(userId, name) as { id: number }).id;
	}

	function addTransaction(userId: number, categoryId: number, type: 'income' | 'expense', amount: number, date: string) {
		sqlite.prepare('INSERT INTO transactions (user_id, amount, description, date, category_id, type) VALUES (?, ?, ?, ?, ?, ?)').run(userId, amount, `tx_${sequence++}`, date, categoryId, type);
	}

	function addLending(userId: number, direction: 'lent' | 'borrowed', amount: number, status: 'active' | 'paid', dueDate: string | null = null) {
		sqlite.prepare('INSERT INTO lendings (user_id, borrower_name, amount, interest_rate, date_lent, due_date, status, direction) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(userId, `lending_${sequence++}`, amount, 0, '2026-01-01', dueDate, status, direction);
	}

	it('returns zero net worth for a user with no data', async () => {
		const userId = createUser();
		const result = await computeNetWorth(userId);
		expect(result.net).toBe(0);
		expect(result.legs).toHaveLength(1);
		expect(result.legs[0]!.key).toBe('cash');
		expect(result.legs[0]!.amount).toBe(0);
		expect(result.cashTrend).toHaveLength(0);
	});

	it('computes cash position from income and expense transactions', async () => {
		const userId = createUser();
		const catId = createCategory(userId);
		addTransaction(userId, catId, 'income', 50000, '2026-08-01');
		addTransaction(userId, catId, 'expense', 2500, '2026-08-02');
		const result = await computeNetWorth(userId);
		expect(result.net).toBe(47500);
		expect(result.legs[0]!.amount).toBe(47500);
	});

	it('includes lent and borrowed positions in net worth', async () => {
		const userId = createUser();
		const catId = createCategory(userId);
		addTransaction(userId, catId, 'income', 10000, '2026-08-01');
		addLending(userId, 'lent', 5000, 'active');
		addLending(userId, 'borrowed', 3000, 'active');
		const result = await computeNetWorth(userId);
		expect(result.net).toBe(12000);
		expect(result.lentToday).toBe(5000);
		expect(result.borrowedToday).toBe(3000);
	});

	it('excludes paid lendings from lent/borrowed positions', async () => {
		const userId = createUser();
		addLending(userId, 'lent', 5000, 'active');
		addLending(userId, 'lent', 2000, 'paid');
		addLending(userId, 'borrowed', 3000, 'active');
		addLending(userId, 'borrowed', 1000, 'paid');
		const result = await computeNetWorth(userId);
		expect(result.lentToday).toBe(5000);
		expect(result.borrowedToday).toBe(3000);
		expect(result.net).toBe(2000);
	});

	it('builds a cumulative cash trend by month', async () => {
		const userId = createUser();
		const catId = createCategory(userId);
		addTransaction(userId, catId, 'income', 1000, '2026-06-15');
		addTransaction(userId, catId, 'expense', 400, '2026-06-20');
		addTransaction(userId, catId, 'income', 2000, '2026-07-10');
		addTransaction(userId, catId, 'expense', 500, '2026-07-15');
		const result = await computeNetWorth(userId);
		expect(result.cashTrend).toHaveLength(2);
		expect(result.cashTrend[0]!.month).toBe('2026-06');
		expect(result.cashTrend[0]!.cash).toBe(600);
		expect(result.cashTrend[1]!.month).toBe('2026-07');
		expect(result.cashTrend[1]!.cash).toBe(2100);
	});

	it('computes deltas from the cash trend', async () => {
		const userId = createUser();
		const catId = createCategory(userId);
		addTransaction(userId, catId, 'income', 1000, '2026-06-15');
		addTransaction(userId, catId, 'income', 2000, '2026-07-10');
		const result = await computeNetWorth(userId);
		expect(result.deltas).toHaveLength(1);
		expect(result.deltas[0]!.amount).toBe(2000);
	});

	it('isolates data by user_id (ownership filtering)', async () => {
		const userA = createUser();
		const userB = createUser();
		const catA = createCategory(userA);
		const catB = createCategory(userB);
		addTransaction(userA, catA, 'income', 10000, '2026-08-01');
		addTransaction(userB, catB, 'income', 99999, '2026-08-01');
		addLending(userA, 'lent', 5000, 'active');
		addLending(userB, 'lent', 99999, 'active');
		const resultA = await computeNetWorth(userA);
		const resultB = await computeNetWorth(userB);
		expect(resultA.net).toBe(15000); // 10000 income + 5000 lent - 0 borrowed
		expect(resultB.net).toBe(199998); // 99999 income + 99999 lent - 0 borrowed
	});
});

describe('networth — Drizzle / Postgres path (recorded fake client)', () => {
	let computeNetWorth: typeof import('$lib/server/networth').computeNetWorth;
	let calls: { selects: { table: string; cols: string[] }[] };

	function fakeDb() {
		// Generic thenable query chain. Every builder method returns the same
		// chain so Drizzle's fluent API (from/leftJoin/on/where/groupBy/orderBy/
		// limit) keeps working; awaiting the chain resolves to an empty row set.
		const chain: any = {
			leftJoin() { return chain; },
			on() { return chain; },
			where() { return chain; },
			groupBy() { return chain; },
			orderBy() { return chain; },
			limit() { return chain; }
		};
		chain.then = (onFulfilled: any, onRejected: any) =>
			Promise.resolve([]).then(onFulfilled, onRejected);
		return {
			select(cols?: Record<string, unknown>) {
				const colNames = cols ? Object.keys(cols) : [];
				return {
					from(table: { name?: string }) {
						const tableName = table?.name ?? 'unknown';
						calls.selects.push({ table: tableName, cols: colNames });
						return chain;
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
		const svc = await import('$lib/server/networth');
		computeNetWorth = svc.computeNetWorth;
	});

	beforeEach(() => {
		calls = { selects: [] };
	});

	it('computeNetWorth issues 5 selects (one per helper) and returns a NetWorthSnapshot', async () => {
		const result = await computeNetWorth(42);
		expect(calls.selects).toHaveLength(5);
		// Verify the column sets selected by each helper:
		// getCashPosition → ['income','expense'], getLentPosition → ['total'],
		// getBorrowedPosition → ['total'], getMonthlyCashFlow → ['month','income','expense'],
		// getUpcomingBorrowedPayments → ['total']
		const colSets = calls.selects.map(s => s.cols.join(','));
		expect(colSets).toContain('income,expense');
		expect(colSets).toContain('month,income,expense');
		expect(colSets.filter(c => c === 'total')).toHaveLength(3);
		expect(result).toHaveProperty('net');
		expect(result).toHaveProperty('legs');
		expect(result).toHaveProperty('cashTrend');
		expect(result).toHaveProperty('lentToday');
		expect(result).toHaveProperty('borrowedToday');
		expect(result).toHaveProperty('caption');
		expect(result).toHaveProperty('projection');
		expect(result).toHaveProperty('biggestMover');
	});

	it('computeNetWorth returns zero net worth when all aggregates are empty', async () => {
		const result = await computeNetWorth(42);
		expect(result.net).toBe(0);
		expect(result.legs).toHaveLength(1);
		expect(result.legs[0]!.key).toBe('cash');
		expect(result.legs[0]!.amount).toBe(0);
	});
});
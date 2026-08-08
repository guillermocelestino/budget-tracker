import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { calculateNextRun } from '$lib/utils/recurring';
import { getToday } from '$lib/utils/format';

/**
 * Focused unit tests for src/lib/server/recurringScheduler.ts.
 *
 * The scheduler dispatches on the module-load constant `usePostgres`:
 *   - Postgres (production) → the Drizzle path (`getDrizzle`)
 *   - SQLite (dev)        → the raw query layer (`queryOne` / `execute`)
 * Both branches are exercised here WITHOUT a live Neon connection:
 *
 *   • SQLite suite — `$lib/database` is mocked (usePostgres: false) and
 *     `$lib/database/query` is mocked so `queryOne`/`execute` run against a real
 *     in-memory better-sqlite3 database, reusing the real `translatePgToSQLite`.
 *   • Drizzle suite — `$lib/database` is mocked (usePostgres: true) and
 *     `$lib/database/drizzle` is mocked to a recorded fake client.
 */

let sequence = 0;

/** Minimal fixture schema — mirrors init.ts DDL for the tables the scheduler uses. */
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
CREATE TABLE recurring_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
  amount REAL NOT NULL,
  description TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  frequency TEXT NOT NULL CHECK(frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
  interval INTEGER NOT NULL DEFAULT 1,
  day_of_week INTEGER CHECK(day_of_week BETWEEN 0 AND 6),
  day_of_month INTEGER CHECK(day_of_month BETWEEN 1 AND 31),
  month_of_year INTEGER CHECK(month_of_year BETWEEN 1 AND 12),
  start_date TEXT NOT NULL,
  end_date TEXT,
  next_run TEXT NOT NULL,
  last_generated_at TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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

describe('recurringScheduler — SQLite / raw query path (in-memory better-sqlite3)', () => {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	sqlite.exec(SQLITE_FIXTURE_SCHEMA);

	let processRecurring: typeof import('$lib/server/recurringScheduler').processRecurringTransactions;
	let runNow: typeof import('$lib/server/recurringScheduler').runRecurringNow;
	let toggle: typeof import('$lib/server/recurringScheduler').toggleRecurringStatus;
	let duplicate: typeof import('$lib/server/recurringScheduler').duplicateRecurringTransaction;

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
					if (mapped.length > 0) {
						stmt.run(...mapped);
					} else {
						stmt.run();
					}
				}
			};
		});

		vi.resetModules();
		const svc = await import('$lib/server/recurringScheduler');
		processRecurring = svc.processRecurringTransactions;
		runNow = svc.runRecurringNow;
		toggle = svc.toggleRecurringStatus;
		duplicate = svc.duplicateRecurringTransaction;
	});

	function createUser(): number {
		const username = `user_${sequence++}`;
		sqlite.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, 'hash');
		const row = sqlite
			.prepare('SELECT id FROM users WHERE username = ?')
			.get(username) as { id: number };
		return row.id;
	}

	function createCategory(userId: number): number {
		const name = `category_${sequence++}`;
		sqlite
			.prepare('INSERT INTO categories (user_id, name, color, icon, type) VALUES (?, ?, ?, ?, ?)')
			.run(userId, name, '#123456', '📁', 'expense');
		const row = sqlite
			.prepare('SELECT id FROM categories WHERE user_id = ? AND name = ?')
			.get(userId, name) as { id: number };
		return row.id;
	}

	function createRecurring(
		userId: number,
		categoryId: number,
		overrides: Partial<Record<string, unknown>> = {}
	): number {
		const defaults: Record<string, unknown> = {
			user_id: userId,
			type: 'expense',
			amount: 100,
			description: `rt_${sequence++}`,
			category_id: categoryId,
			frequency: 'monthly',
			interval: 1,
			day_of_week: null,
			day_of_month: null,
			month_of_year: null,
			start_date: '2026-08-01',
			end_date: null,
			next_run: '2026-08-01',
			last_generated_at: null,
			active: 1
		};
		const values = { ...defaults, ...overrides };
		const cols = Object.keys(values).join(', ');
		const placeholders = Object.keys(values).map(() => '?').join(', ');
		sqlite
			.prepare(`INSERT INTO recurring_transactions (${cols}) VALUES (${placeholders})`)
			.run(...Object.values(values));
		const row = sqlite
			.prepare('SELECT id FROM recurring_transactions WHERE user_id = ? AND description = ?')
			.get(userId, values.description) as { id: number };
		return row.id;
	}

	function countTransactions(userId: number): number {
		const row = sqlite
			.prepare('SELECT COUNT(*) as c FROM transactions WHERE user_id = ?')
			.get(userId) as { c: number };
		return row.c;
	}

	function getRecurring(id: number): Record<string, unknown> | undefined {
		return sqlite
			.prepare('SELECT * FROM recurring_transactions WHERE id = ?')
			.get(id) as Record<string, unknown> | undefined;
	}

	describe('processRecurringTransactions', () => {
		it('processes a due recurring transaction and creates a transaction', async () => {
			const userId = createUser();
			const catId = createCategory(userId);
			const recId = createRecurring(userId, catId, { next_run: '2026-08-01' });

			const count = await processRecurring(userId);

			expect(count).toBe(1);
			expect(countTransactions(userId)).toBe(1);
			const rec = getRecurring(recId)!;
			expect(rec.next_run).toBe(
				calculateNextRun('2026-08-01', 'monthly', 1, null, null, null, '2026-08-01')
			);
			expect(rec.last_generated_at).toBe(getToday());
			expect(rec.active).toBe(1);
		});

		it('does not process a future recurring transaction', async () => {
			const userId = createUser();
			const catId = createCategory(userId);
			createRecurring(userId, catId, { next_run: '2026-09-01' });

			const count = await processRecurring(userId);

			expect(count).toBe(0);
			expect(countTransactions(userId)).toBe(0);
		});

		it('does not process an inactive recurring transaction', async () => {
			const userId = createUser();
			const catId = createCategory(userId);
			createRecurring(userId, catId, { next_run: '2026-08-01', active: 0 });

			const count = await processRecurring(userId);

			expect(count).toBe(0);
			expect(countTransactions(userId)).toBe(0);
		});

		it('does not process an expired recurring transaction (past end_date)', async () => {
			const userId = createUser();
			const catId = createCategory(userId);
			createRecurring(userId, catId, { next_run: '2026-08-01', end_date: '2026-08-05' });

			const count = await processRecurring(userId);

			expect(count).toBe(0);
			expect(countTransactions(userId)).toBe(0);
		});

		it('deactivates a recurring transaction when next run exceeds end_date', async () => {
			const userId = createUser();
			const catId = createCategory(userId);
			const today = getToday();
			const recId = createRecurring(userId, catId, {
				next_run: '2026-08-01',
				end_date: today
			});

			const count = await processRecurring(userId);

			expect(count).toBe(1);
			const rec = getRecurring(recId)!;
			expect(rec.active).toBe(0);
		});

		it('prevents duplicate execution on the same day (next_run advanced)', async () => {
			const userId = createUser();
			const catId = createCategory(userId);
			createRecurring(userId, catId, { next_run: '2026-08-01' });

			await processRecurring(userId);
			const count2 = await processRecurring(userId);

			expect(count2).toBe(0);
			expect(countTransactions(userId)).toBe(1);
		});
	});

	describe('runRecurringNow', () => {
		it('creates a transaction with next_run as the date', async () => {
			const userId = createUser();
			const catId = createCategory(userId);
			const recId = createRecurring(userId, catId, { next_run: '2026-08-15' });

			const result = await runNow(userId, recId);

			expect(result).toEqual({ success: true });
			expect(countTransactions(userId)).toBe(1);
			const txn = sqlite
				.prepare('SELECT date FROM transactions WHERE user_id = ?')
				.get(userId) as { date: string };
			expect(txn.date).toBe('2026-08-15');
			// Schedule unchanged
			const rec = getRecurring(recId)!;
			expect(rec.next_run).toBe('2026-08-15');
		});

		it('returns not found for a nonexistent recurring id', async () => {
			const userId = createUser();

			const result = await runNow(userId, 999_999);

			expect(result).toEqual({ success: false, error: 'Recurring transaction not found' });
		});

		it('returns paused for an inactive recurring transaction', async () => {
			const userId = createUser();
			const catId = createCategory(userId);
			const recId = createRecurring(userId, catId, { active: 0 });

			const result = await runNow(userId, recId);

			expect(result).toEqual({ success: false, error: 'Recurring transaction is paused' });
			expect(countTransactions(userId)).toBe(0);
		});
	});

	describe('toggleRecurringStatus', () => {
		it('toggles active → inactive', async () => {
			const userId = createUser();
			const catId = createCategory(userId);
			const recId = createRecurring(userId, catId, { active: 1 });

			const result = await toggle(userId, recId, false);

			expect(result).toEqual({ success: true });
			expect(getRecurring(recId)!.active).toBe(0);
		});

		it('toggles inactive → active', async () => {
			const userId = createUser();
			const catId = createCategory(userId);
			const recId = createRecurring(userId, catId, { active: 0 });

			const result = await toggle(userId, recId, true);

			expect(result).toEqual({ success: true });
			expect(getRecurring(recId)!.active).toBe(1);
		});

		it('returns not found for a nonexistent recurring id', async () => {
			const userId = createUser();

			const result = await toggle(userId, 999_999, true);

			expect(result).toEqual({ success: false, error: 'Recurring transaction not found' });
		});
	});

	describe('duplicateRecurringTransaction', () => {
		it('creates a duplicate with the same fields and returns the new id', async () => {
			const userId = createUser();
			const catId = createCategory(userId);
			const recId = createRecurring(userId, catId, {
				next_run: '2026-08-20',
				amount: 250,
				description: 'original'
			});

			const result = await duplicate(userId, recId);

			expect(result.success).toBe(true);
			expect(result.id).toBeDefined();
			const dup = getRecurring(result.id!)!;
			expect(dup.amount).toBe(250);
			expect(dup.next_run).toBe('2026-08-20');
			expect(dup.description).toBe('original');
			expect(dup.user_id).toBe(userId);
			expect(dup.category_id).toBe(catId);
		});

		it('returns not found for a nonexistent recurring id', async () => {
			const userId = createUser();

			const result = await duplicate(userId, 999_999);

			expect(result).toEqual({ success: false, error: 'Recurring transaction not found' });
		});
	});
});

describe('recurringScheduler — Drizzle / Postgres path (recorded fake client)', () => {
	let processRecurring: typeof import('$lib/server/recurringScheduler').processRecurringTransactions;
	let runNow: typeof import('$lib/server/recurringScheduler').runRecurringNow;
	let toggle: typeof import('$lib/server/recurringScheduler').toggleRecurringStatus;
	let duplicate: typeof import('$lib/server/recurringScheduler').duplicateRecurringTransaction;
	let calls: {
		selects: number;
		inserts: Record<string, unknown>[];
		updates: Record<string, unknown>[];
		returningIds: number[];
	};
	let recurringRows: Record<string, unknown>[];

	function fakeDb() {
		return {
			select() {
				calls.selects += 1;
				const chain: any = {};
				const methods = ['from', 'where', 'orderBy', 'limit'];
				for (const m of methods) {
					chain[m] = function() {
						return chain;
					};
				}
				chain.then = (onFulfilled: any, onRejected: any) =>
					Promise.resolve(recurringRows).then(onFulfilled, onRejected);
				return chain;
			},
			insert() {
				return {
					values(values: Record<string, unknown>) {
						calls.inserts.push(values);
						return {
							returning() {
								const id = calls.returningIds.length + 1;
								calls.returningIds.push(id);
								return Promise.resolve([{ id }]);
							}
						};
					}
				};
			},
			update() {
				return {
					set(values: Record<string, unknown>) {
						return {
							where() {
								calls.updates.push(values);
								return Promise.resolve(undefined);
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
		const svc = await import('$lib/server/recurringScheduler');
		processRecurring = svc.processRecurringTransactions;
		runNow = svc.runRecurringNow;
		toggle = svc.toggleRecurringStatus;
		duplicate = svc.duplicateRecurringTransaction;
	});

	beforeEach(() => {
		calls = { selects: 0, inserts: [], updates: [], returningIds: [] };
		recurringRows = [];
	});

	it('processRecurringTransactions issues SELECT + INSERT + UPDATE with correct values', async () => {
		recurringRows = [{
			id: 1,
			user_id: 42,
			type: 'expense',
			amount: '100',
			description: 'Netflix',
			category_id: 5,
			frequency: 'monthly',
			interval: 1,
			day_of_week: null,
			day_of_month: null,
			month_of_year: null,
			start_date: '2026-08-01',
			end_date: null,
			next_run: '2026-08-01',
			last_generated_at: null,
			active: true,
			created_at: new Date(),
			updated_at: new Date()
		}];

		const count = await processRecurring(42);

		expect(count).toBe(1);
		expect(calls.selects).toBe(2);
		expect(calls.inserts).toHaveLength(1);
		expect(calls.inserts[0]!.amount).toBe('100');
		expect(calls.inserts[0]!.date).toBe('2026-08-01');
		expect(calls.inserts[0]!.user_id).toBe(42);
		expect(calls.updates).toHaveLength(1);
		expect(calls.updates[0]!.next_run).toBe(
			calculateNextRun('2026-08-01', 'monthly', 1, null, null, null, '2026-08-01')
		);
		expect(calls.updates[0]!.last_generated_at).toBeInstanceOf(Date);
		expect(calls.updates[0]!.active).toBe(true);
	});

	it('processRecurringTransactions returns 0 when no due records', async () => {
		recurringRows = [];

		const count = await processRecurring(42);

		expect(count).toBe(0);
		expect(calls.inserts).toHaveLength(0);
		expect(calls.updates).toHaveLength(0);
	});

	it('runRecurringNow issues SELECT + INSERT and returns success', async () => {
		recurringRows = [{
			id: 1,
			user_id: 42,
			type: 'expense',
			amount: '100',
			description: 'Netflix',
			category_id: 5,
			frequency: 'monthly',
			interval: 1,
			day_of_week: null,
			day_of_month: null,
			month_of_year: null,
			start_date: '2026-08-01',
			end_date: null,
			next_run: '2026-08-15',
			last_generated_at: null,
			active: true,
			created_at: new Date(),
			updated_at: new Date()
		}];

		const result = await runNow(42, 1);

		expect(result).toEqual({ success: true });
		expect(calls.inserts).toHaveLength(1);
		expect(calls.inserts[0]!.date).toBe('2026-08-15');
		expect(calls.updates).toHaveLength(0); // schedule unchanged
	});

	it('runRecurringNow returns not found when no row', async () => {
		recurringRows = [];

		const result = await runNow(42, 999);

		expect(result).toEqual({ success: false, error: 'Recurring transaction not found' });
		expect(calls.inserts).toHaveLength(0);
	});

	it('runRecurringNow returns paused for inactive', async () => {
		recurringRows = [{
			id: 1,
			user_id: 42,
			type: 'expense',
			amount: '100',
			description: 'Netflix',
			category_id: 5,
			frequency: 'monthly',
			interval: 1,
			day_of_week: null,
			day_of_month: null,
			month_of_year: null,
			start_date: '2026-08-01',
			end_date: null,
			next_run: '2026-08-15',
			last_generated_at: null,
			active: false,
			created_at: new Date(),
			updated_at: new Date()
		}];

		const result = await runNow(42, 1);

		expect(result).toEqual({ success: false, error: 'Recurring transaction is paused' });
		expect(calls.inserts).toHaveLength(0);
	});

	it('toggleRecurringStatus issues SELECT + UPDATE with boolean active', async () => {
		recurringRows = [{ id: 1 }];

		const result = await toggle(42, 1, false);

		expect(result).toEqual({ success: true });
		expect(calls.updates).toHaveLength(1);
		expect(calls.updates[0]!.active).toBe(false);
		expect(calls.updates[0]!.updated_at).toBeInstanceOf(Date);
	});

	it('toggleRecurringStatus returns not found when no row', async () => {
		recurringRows = [];

		const result = await toggle(42, 999, true);

		expect(result).toEqual({ success: false, error: 'Recurring transaction not found' });
		expect(calls.updates).toHaveLength(0);
	});

	it('duplicateRecurringTransaction issues SELECT + INSERT with returning id', async () => {
		recurringRows = [{
			id: 1,
			user_id: 42,
			type: 'expense',
			amount: '250',
			description: 'original',
			category_id: 5,
			frequency: 'monthly',
			interval: 1,
			day_of_week: null,
			day_of_month: null,
			month_of_year: null,
			start_date: '2026-08-01',
			end_date: null,
			next_run: '2026-08-20',
			last_generated_at: null,
			active: true,
			created_at: new Date(),
			updated_at: new Date()
		}];

		const result = await duplicate(42, 1);

		expect(result.success).toBe(true);
		expect(result.id).toBe(1);
		expect(calls.inserts).toHaveLength(1);
		expect(calls.inserts[0]!.amount).toBe('250');
		expect(calls.inserts[0]!.next_run).toBe('2026-08-20');
		expect(calls.inserts[0]!.user_id).toBe(42);
		expect(calls.returningIds).toHaveLength(1);
	});

	it('duplicateRecurringTransaction returns not found when no row', async () => {
		recurringRows = [];

		const result = await duplicate(42, 999);

		expect(result).toEqual({ success: false, error: 'Recurring transaction not found' });
		expect(calls.inserts).toHaveLength(0);
	});
});
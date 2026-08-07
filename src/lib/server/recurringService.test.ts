import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import type { RecurringInput } from './recurringService';
import { calculateNextRun } from '$lib/utils/recurring';

/**
 * Focused unit tests for src/lib/server/recurringService.ts (Phase 4C).
 *
 * The service dispatches on the module-load constant `usePostgres`:
 *   - Postgres (production) → the Drizzle path (`getDrizzle`)
 *   - SQLite (dev)        → the raw query layer (`queryOne` / `execute`)
 * Both branches are exercised here WITHOUT a live Neon connection and without
 * touching the on-disk dev database:
 *
 *   • SQLite suite — `$lib/database` is mocked (usePostgres: false) and
 *     `$lib/database/query` is mocked so `queryOne`/`execute` run against a real
 *     in-memory better-sqlite3 database, reusing the real `translatePgToSQLite`.
 *     The service's raw-SQL path therefore executes real SQL + persistence.
 *   • Drizzle suite — `$lib/database` is mocked (usePostgres: true) and
 *     `$lib/database/drizzle` is mocked to a recorded fake client; tests assert
 *     the data payloads the service sends to the ORM (next_run semantics, active
 *     flag, amount coercion, ownership / not-found behavior).
 *
 * Only the database access boundary is mocked — all business logic
 * (validateInput, scheduleChanged, calculateNextRun) runs unmodified.
 */

let sequence = 0;

/** Minimal fixture schema — mirrors init.ts DDL for the tables the service uses. */
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
`;

function makeRecurringInput(overrides: Partial<RecurringInput> = {}): RecurringInput {
	return {
		type: overrides.type ?? 'expense',
		amount: overrides.amount ?? 100,
		description: overrides.description ?? `rt_${sequence++}`,
		category_id: overrides.category_id ?? -1,
		frequency: overrides.frequency ?? 'monthly',
		interval: overrides.interval ?? 1,
		day_of_week: overrides.day_of_week ?? null,
		day_of_month: overrides.day_of_month ?? null,
		month_of_year: overrides.month_of_year ?? null,
		start_date: overrides.start_date ?? '2026-08-01',
		end_date: overrides.end_date ?? null,
		active: overrides.active ?? true
	};
}

describe('recurringService — SQLite / raw query path (in-memory better-sqlite3)', () => {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	sqlite.exec(SQLITE_FIXTURE_SCHEMA);

	let create: typeof import('./recurringService').createRecurringTransaction;
	let update: typeof import('./recurringService').updateRecurringTransaction;

	beforeAll(async () => {
		// `$lib/database`: the service reads `usePostgres` (false → raw path).
		vi.doMock('$lib/database', () => ({
			usePostgres: false,
			getPgPool: () => Promise.reject(new Error('getPgPool should not be called on SQLite path')),
			getSQLiteDb: () => Promise.resolve(sqlite),
			initDb: async () => {},
			closeDb: async () => {}
		}));

		// `$lib/database/query`: keep the real translatePgToSQLite, but point
		// queryOne/execute at the in-memory DB instead of the on-disk data/budget.db.
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
		const svc = await import('./recurringService');
		create = svc.createRecurringTransaction;
		update = svc.updateRecurringTransaction;
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

	function getRow(userId: number, description: string): Record<string, unknown> | undefined {
		return sqlite
			.prepare('SELECT * FROM recurring_transactions WHERE user_id = ? AND description = ?')
			.get(userId, description) as Record<string, unknown> | undefined;
	}

	function countRows(userId: number): number {
		const row = sqlite
			.prepare('SELECT COUNT(*) as c FROM recurring_transactions WHERE user_id = ?')
			.get(userId) as { c: number };
		return row.c;
	}

	it('creates a recurring transaction and computes next_run', async () => {
		const userId = createUser();
		const categoryId = createCategory(userId);
		const inp = makeRecurringInput({ category_id: categoryId, amount: 123.45, description: 'Gym' });

		const res = await create(userId, inp);

		expect(res).toEqual({ success: true });
		const row = getRow(userId, 'Gym');
		expect(row).toBeDefined();
		expect(row!.type).toBe('expense');
		expect(row!.amount).toBe(123.45);
		expect(row!.category_id).toBe(categoryId);
		expect(row!.frequency).toBe('monthly');
		expect(row!.interval).toBe(1);
		expect(row!.start_date).toBe('2026-08-01');
		expect(row!.active).toBe(1);
		expect(row!.next_run).toBe(
			calculateNextRun('2026-08-01', 'monthly', 1, null, null, null, '2026-08-01')
		);
	});

	it('trims the description and stores active=false as 0', async () => {
		const userId = createUser();
		const categoryId = createCategory(userId);
		const inp = makeRecurringInput({
			category_id: categoryId,
			description: '  Padded  ',
			active: false
		});

		const res = await create(userId, inp);

		expect(res).toEqual({ success: true });
		const row = getRow(userId, 'Padded');
		expect(row).toBeDefined();
		expect(row!.active).toBe(0);
	});

	it('returns validation errors for invalid input without inserting a row', async () => {
		const userId = createUser();
		const categoryId = createCategory(userId);
		const bad = makeRecurringInput({
			category_id: categoryId,
			amount: 0,
			description: '   ',
			interval: 0,
			start_date: ''
		});

		const res = await create(userId, bad);

		expect(res.success).toBe(false);
		expect(res.errors).toBeDefined();
		expect(res.errors!.amount).toBeDefined();
		expect(res.errors!.description).toBeDefined();
		expect(res.errors!.interval).toBeDefined();
		expect(res.errors!.start_date).toBeDefined();
		expect(countRows(userId)).toBe(0);
	});

	it('rejects a category owned by a different user', async () => {
		const userA = createUser();
		const userB = createUser();
		const otherCategory = createCategory(userB);
		const inp = makeRecurringInput({ category_id: otherCategory, description: 'not yours' });

		const res = await create(userA, inp);

		expect(res).toEqual({ success: false, error: 'Category not found' });
		expect(getRow(userA, 'not yours')).toBeUndefined();
	});

	it('rejects a nonexistent category', async () => {
		const userId = createUser();

		const res = await create(userId, makeRecurringInput({ category_id: 999_999 }));

		expect(res).toEqual({ success: false, error: 'Category not found' });
	});

	it('preserves next_run when only amount/active change on update', async () => {
		const userId = createUser();
		const categoryId = createCategory(userId);
		const created = makeRecurringInput({ category_id: categoryId, description: 'keep-next' });
		await create(userId, created);

		const before = getRow(userId, 'keep-next')!;
		const originalNextRun = before.next_run as string;

		const res = await update(
			userId,
			before.id as number,
			makeRecurringInput({
				category_id: categoryId,
				description: 'keep-next',
				amount: 999.99,
				active: false
			})
		);

		expect(res).toEqual({ success: true });
		const after = getRow(userId, 'keep-next')!;
		expect(after.next_run).toBe(originalNextRun);
		expect(after.amount).toBe(999.99);
		expect(after.active).toBe(0);
	});

	it('recalculates next_run when a scheduling field changes', async () => {
		const userId = createUser();
		const categoryId = createCategory(userId);
		const created = makeRecurringInput({ category_id: categoryId, description: 'recalc-next' });
		await create(userId, created);

		const before = getRow(userId, 'recalc-next')!;

		const res = await update(
			userId,
			before.id as number,
			makeRecurringInput({ category_id: categoryId, description: 'recalc-next', frequency: 'weekly' })
		);

		expect(res).toEqual({ success: true });
		const after = getRow(userId, 'recalc-next')!;
		expect(after.next_run).toBe(
			calculateNextRun('2026-08-01', 'weekly', 1, null, null, null, '2026-08-01')
		);
		expect(after.next_run).not.toBe(before.next_run);
	});

	it('recalculates next_run when day_of_month changes', async () => {
		const userId = createUser();
		const categoryId = createCategory(userId);
		const created = makeRecurringInput({ category_id: categoryId, description: 'recalc-dom' });
		await create(userId, created);

		const before = getRow(userId, 'recalc-dom')!;

		const res = await update(
			userId,
			before.id as number,
			makeRecurringInput({ category_id: categoryId, description: 'recalc-dom', day_of_month: 15 })
		);

		expect(res).toEqual({ success: true });
		const after = getRow(userId, 'recalc-dom')!;
		expect(after.next_run).toBe(
			calculateNextRun('2026-08-01', 'monthly', 1, null, 15, null, '2026-08-01')
		);
		expect(after.next_run).not.toBe(before.next_run);
	});

	it('returns not found for a nonexistent recurring id', async () => {
		const userId = createUser();
		const categoryId = createCategory(userId);

		const res = await update(userId, 999_999, makeRecurringInput({ category_id: categoryId }));

		expect(res).toEqual({ success: false, error: 'Recurring transaction not found' });
	});

	it('does not allow updating another user’s recurring transaction', async () => {
		const userA = createUser();
		const userB = createUser();
		const categoryA = createCategory(userA);
		await create(userA, makeRecurringInput({ category_id: categoryA, description: 'user-a-only' }));

		const rowId = getRow(userA, 'user-a-only')!.id as number;

		const res = await update(
			userB,
			rowId,
			makeRecurringInput({ category_id: categoryA, description: 'hijack' })
		);

		expect(res).toEqual({ success: false, error: 'Recurring transaction not found' });
	});

	it('validates input on update before looking up the row', async () => {
		const userId = createUser();
		const categoryId = createCategory(userId);

		const res = await update(
			userId,
			999_999,
			makeRecurringInput({ category_id: categoryId, amount: 0 })
		);

		expect(res.success).toBe(false);
		expect(res.errors).toBeDefined();
	});
});

describe('recurringService — Drizzle / Postgres path (recorded fake client)', () => {
	let create: typeof import('./recurringService').createRecurringTransaction;
	let update: typeof import('./recurringService').updateRecurringTransaction;
	let calls: {
		inserts: Record<string, unknown>[];
		updates: Record<string, unknown>[];
		categorySelects: number;
		recurringSelects: number;
	};
	let categoryRows: Record<string, unknown>[];
	let recurringRows: Record<string, unknown>[];

	function fakeDb() {
		return {
			select(cols?: unknown) {
				return {
					from() {
						return {
							where() {
								if (cols) {
									calls.categorySelects += 1;
									return Promise.resolve(categoryRows);
								}
								calls.recurringSelects += 1;
								return Promise.resolve(recurringRows);
							}
						};
					}
				};
			},
			insert() {
				return {
					values(values: Record<string, unknown>) {
						calls.inserts.push(values);
						return Promise.resolve(undefined);
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
		const svc = await import('./recurringService');
		create = svc.createRecurringTransaction;
		update = svc.updateRecurringTransaction;
	});

	beforeEach(() => {
		calls = { inserts: [], updates: [], categorySelects: 0, recurringSelects: 0 };
		categoryRows = [];
		recurringRows = [];
	});

	it('inserts via Drizzle with trimmed description, string amount, active flag, and computed next_run', async () => {
		categoryRows = [{ id: 5 }];

		const res = await create(
			42,
			makeRecurringInput({ category_id: 5, description: '  Netflix  ', amount: 100, active: true })
		);

		expect(res).toEqual({ success: true });
		expect(calls.inserts).toHaveLength(1);
		const values = calls.inserts[0]!;
		expect(values.user_id).toBe(42);
		expect(values.category_id).toBe(5);
		expect(values.description).toBe('Netflix');
		expect(values.amount).toBe('100');
		expect(values.active).toBe(true);
		expect(values.next_run).toBe(
			calculateNextRun('2026-08-01', 'monthly', 1, null, null, null, '2026-08-01')
		);
	});

	it('rejects a category the user does not own (empty ownership select)', async () => {
		categoryRows = [];

		const res = await create(42, makeRecurringInput({ category_id: 99 }));

		expect(res).toEqual({ success: false, error: 'Category not found' });
		expect(calls.categorySelects).toBe(1);
		expect(calls.inserts).toHaveLength(0);
	});

	it('validates input before consulting the database', async () => {
		const res = await create(42, makeRecurringInput({ amount: 0, interval: 0 }));

		expect(res.success).toBe(false);
		expect(res.errors).toBeDefined();
		expect(calls.categorySelects).toBe(0);
		expect(calls.inserts).toHaveLength(0);
	});

	it('preserves next_run when scheduling fields are unchanged', async () => {
		categoryRows = [{ id: 5 }];
		recurringRows = [
			{
				frequency: 'monthly',
				interval: 1,
				start_date: '2026-08-01',
				day_of_week: null,
				day_of_month: null,
				month_of_year: null,
				next_run: '2026-09-01'
			}
		];

		const res = await update(
			42,
			7,
			makeRecurringInput({ category_id: 5, description: 'keep', amount: 250, active: false })
		);

		expect(res).toEqual({ success: true });
		expect(calls.updates).toHaveLength(1);
		const values = calls.updates[0]!;
		expect(values.next_run).toBe('2026-09-01');
		expect(values.amount).toBe('250');
		expect(values.active).toBe(false);
	});

	it('recalculates next_run when frequency changes', async () => {
		categoryRows = [{ id: 5 }];
		recurringRows = [
			{
				frequency: 'monthly',
				interval: 1,
				start_date: '2026-08-01',
				day_of_week: null,
				day_of_month: null,
				month_of_year: null,
				next_run: '2026-09-01'
			}
		];

		const res = await update(
			42,
			7,
			makeRecurringInput({ category_id: 5, description: 'recalc', frequency: 'weekly' })
		);

		expect(res).toEqual({ success: true });
		expect(calls.updates).toHaveLength(1);
		const values = calls.updates[0]!;
		expect(values.next_run).toBe(
			calculateNextRun('2026-08-01', 'weekly', 1, null, null, null, '2026-08-01')
		);
		expect(values.next_run).not.toBe('2026-09-01');
	});

	it('returns not found when the recurring transaction is missing', async () => {
		recurringRows = [];
		categoryRows = [{ id: 5 }];

		const res = await update(42, 7, makeRecurringInput({ category_id: 5 }));

		expect(res).toEqual({ success: false, error: 'Recurring transaction not found' });
		expect(calls.updates).toHaveLength(0);
	});

	it('does not find another user’s recurring transaction (fetch is user-scoped)', async () => {
		recurringRows = [];
		categoryRows = [{ id: 5 }];

		const res = await update(99, 7, makeRecurringInput({ category_id: 5 }));

		expect(res).toEqual({ success: false, error: 'Recurring transaction not found' });
	});
});

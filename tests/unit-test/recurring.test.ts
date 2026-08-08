import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

let sequence = 0;

/** Minimal fixture schema — mirrors init.ts DDL for the tables recurringService uses. */
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

describe('recurringService — SQLite / raw query path (in-memory better-sqlite3)', () => {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	sqlite.exec(SQLITE_FIXTURE_SCHEMA);

	let listRecurringTransactions: typeof import('$lib/server/recurringService').listRecurringTransactions;
	let getRecurringById: typeof import('$lib/server/recurringService').getRecurringById;
	let createRecurringTransaction: typeof import('$lib/server/recurringService').createRecurringTransaction;
	let updateRecurringTransaction: typeof import('$lib/server/recurringService').updateRecurringTransaction;
	let getActiveRecurringCount: typeof import('$lib/server/recurringService').getActiveRecurringCount;
	let getUpcomingRecurring: typeof import('$lib/server/recurringService').getUpcomingRecurring;

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
		const svc = await import('$lib/server/recurringService');
		listRecurringTransactions = svc.listRecurringTransactions;
		getRecurringById = svc.getRecurringById;
		createRecurringTransaction = svc.createRecurringTransaction;
		updateRecurringTransaction = svc.updateRecurringTransaction;
		getActiveRecurringCount = svc.getActiveRecurringCount;
		getUpcomingRecurring = svc.getUpcomingRecurring;
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

	function addRecurring(
		userId: number,
		categoryId: number,
		overrides: Partial<{
			type: string;
			amount: number;
			description: string;
			frequency: string;
			interval: number;
			start_date: string;
			end_date: string | null;
			next_run: string;
			active: boolean;
		}> = {}
	): number {
		const info = sqlite
			.prepare(
				`INSERT INTO recurring_transactions
				 (user_id, type, amount, description, category_id, frequency, interval, start_date, end_date, next_run, active)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.run(
				userId,
				overrides.type ?? 'expense',
				overrides.amount ?? 100,
				overrides.description ?? `recurring_${sequence++}`,
				categoryId,
				overrides.frequency ?? 'monthly',
				overrides.interval ?? 1,
				overrides.start_date ?? '2026-01-01',
				overrides.end_date ?? null,
				overrides.next_run ?? '2026-08-01',
				(overrides.active ?? true) ? 1 : 0
			);
		return Number(info.lastInsertRowid);
	}

	it('lists all recurring transactions (no filters)', async () => {
		const userId = createUser();
		const catId = createCategory(userId);
		addRecurring(userId, catId, { description: 'Rent', amount: 5000, next_run: '2026-08-01' });
		addRecurring(userId, catId, { description: 'Netflix', amount: 500, next_run: '2026-08-15' });

		const result = await listRecurringTransactions(userId, {}, 1, 20);

		expect(result.items).toHaveLength(2);
		expect(result.total).toBe(2);
		expect(result.items[0]!.description).toBe('Rent');
		expect(result.items[0]!.category_name).toBe(`category_${catId}`);
	});

	it('lists recurring transactions filtered by active status', async () => {
		const userId = createUser();
		const catId = createCategory(userId);
		addRecurring(userId, catId, { description: 'Active', active: true });
		addRecurring(userId, catId, { description: 'Paused', active: false });

		const active = await listRecurringTransactions(userId, { status: 'active' }, 1, 20);
		const paused = await listRecurringTransactions(userId, { status: 'paused' }, 1, 20);

		expect(active.items).toHaveLength(1);
		expect(active.items[0]!.description).toBe('Active');
		expect(paused.items).toHaveLength(1);
		expect(paused.items[0]!.description).toBe('Paused');
	});

	it('gets a recurring transaction by ID (found)', async () => {
		const userId = createUser();
		const catId = createCategory(userId);
		const id = addRecurring(userId, catId, { description: 'Gym', amount: 1500 });

		const result = await getRecurringById(userId, id);

		expect(result).not.toBeNull();
		expect(result!.id).toBe(id);
		expect(result!.description).toBe('Gym');
		expect(result!.amount).toBe(1500);
	});

	it('returns null when recurring transaction not found', async () => {
		const userId = createUser();
		const result = await getRecurringById(userId, 9999);
		expect(result).toBeNull();
	});

	it('returns null when recurring belongs to another user', async () => {
		const userA = createUser();
		const userB = createUser();
		const catA = createCategory(userA);
		const id = addRecurring(userA, catA, { description: 'Private' });

		const result = await getRecurringById(userB, id);
		expect(result).toBeNull();
	});

	it('creates a recurring transaction with valid data', async () => {
		const userId = createUser();
		const catId = createCategory(userId);

		const result = await createRecurringTransaction(userId, {
			type: 'expense',
			amount: 2000,
			description: 'Internet',
			category_id: catId,
			frequency: 'monthly',
			interval: 1,
			day_of_week: null,
			day_of_month: null,
			month_of_year: null,
			start_date: '2026-08-01',
			end_date: null,
			active: true,
		});

		expect(result.success).toBe(true);
		const count = await getActiveRecurringCount(userId);
		expect(count).toBe(1);
	});

	it('returns validation errors for invalid data', async () => {
		const userId = createUser();
		const catId = createCategory(userId);

		const result = await createRecurringTransaction(userId, {
			type: 'expense',
			amount: 0,
			description: '',
			category_id: catId,
			frequency: 'monthly',
			interval: 1,
			day_of_week: null,
			day_of_month: null,
			month_of_year: null,
			start_date: '2026-08-01',
			end_date: null,
			active: true,
		});

		expect(result.success).toBe(false);
		expect(result.errors).toBeDefined();
		expect(result.errors!.amount).toBeDefined();
		expect(result.errors!.description).toBeDefined();
	});

	it('updates a recurring transaction with valid data', async () => {
		const userId = createUser();
		const catId = createCategory(userId);
		const id = addRecurring(userId, catId, { description: 'Old', amount: 100 });

		const result = await updateRecurringTransaction(userId, id, {
			type: 'expense',
			amount: 250,
			description: 'New',
			category_id: catId,
			frequency: 'monthly',
			interval: 1,
			day_of_week: null,
			day_of_month: null,
			month_of_year: null,
			start_date: '2026-01-01',
			end_date: null,
			active: true,
		});

		expect(result.success).toBe(true);
		const updated = await getRecurringById(userId, id);
		expect(updated!.description).toBe('New');
		expect(updated!.amount).toBe(250);
	});

	it('returns error when updating a non-existent recurring', async () => {
		const userId = createUser();
		const catId = createCategory(userId);

		const result = await updateRecurringTransaction(userId, 9999, {
			type: 'expense',
			amount: 100,
			description: 'Nope',
			category_id: catId,
			frequency: 'monthly',
			interval: 1,
			day_of_week: null,
			day_of_month: null,
			month_of_year: null,
			start_date: '2026-01-01',
			end_date: null,
			active: true,
		});

		expect(result.success).toBe(false);
		expect(result.error).toBe('Recurring transaction not found');
	});

	it('returns upcoming recurring transactions sorted by next_run', async () => {
		const userId = createUser();
		const catId = createCategory(userId);
		addRecurring(userId, catId, { description: 'Later', next_run: '2026-09-01' });
		addRecurring(userId, catId, { description: 'Soon', next_run: '2026-08-10' });
		addRecurring(userId, catId, { description: 'Inactive', next_run: '2026-08-05', active: false });

		const result = await getUpcomingRecurring(userId, 2);

		expect(result).toHaveLength(2);
		expect(result[0]!.description).toBe('Soon');
		expect(result[1]!.description).toBe('Later');
	});
});

describe('recurringService — Drizzle / Postgres path (recorded fake client)', () => {
	let listRecurringTransactions: typeof import('$lib/server/recurringService').listRecurringTransactions;
	let getRecurringById: typeof import('$lib/server/recurringService').getRecurringById;
	let createRecurringTransaction: typeof import('$lib/server/recurringService').createRecurringTransaction;
	let updateRecurringTransaction: typeof import('$lib/server/recurringService').updateRecurringTransaction;
	let getActiveRecurringCount: typeof import('$lib/server/recurringService').getActiveRecurringCount;
	let getUpcomingRecurring: typeof import('$lib/server/recurringService').getUpcomingRecurring;

	function makeDrizzleData(data: any[]) {
		const chain: any = {};
		const methods = [
			'select', 'from', 'where', 'leftJoin', 'on', 'groupBy', 'orderBy',
			'limit', 'offset', 'insert', 'values', 'update', 'set', 'delete', 'returning'
		];
		for (const m of methods) {
			chain[m] = vi.fn(function() { return chain; });
		}
		chain.then = (onFulfilled: any, onRejected: any) =>
			Promise.resolve(data).then(onFulfilled, onRejected);
		return chain;
	}

	function fakeDb() {
		return {
			// Distinguish query types by the selected columns:
			//  - { count } → COUNT query → [{ count: 0 }]
			//  - { id }    → category ownership check → [{ id: 1 }] (owned)
			//  - otherwise → data query → []
			select: vi.fn((cols?: Record<string, unknown>) => {
				const keys = cols ? Object.keys(cols) : [];
				if (keys.length === 1 && 'count' in cols!) return makeDrizzleData([{ count: 0 }]);
				if (keys.length === 1 && 'id' in cols!) return makeDrizzleData([{ id: 1 }]);
				return makeDrizzleData([]);
			}),
			insert: vi.fn(() => makeDrizzleData([{ id: 1 }])),
			update: vi.fn(() => makeDrizzleData([])),
			delete: vi.fn(() => makeDrizzleData([]))
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
		const svc = await import('$lib/server/recurringService');
		listRecurringTransactions = svc.listRecurringTransactions;
		getRecurringById = svc.getRecurringById;
		createRecurringTransaction = svc.createRecurringTransaction;
		updateRecurringTransaction = svc.updateRecurringTransaction;
		getActiveRecurringCount = svc.getActiveRecurringCount;
		getUpcomingRecurring = svc.getUpcomingRecurring;
	});

	it('lists recurring transactions via Drizzle', async () => {
		const result = await listRecurringTransactions(42, {}, 1, 20);
		expect(result.items).toHaveLength(0);
		expect(result.total).toBe(0);
		expect(result.page).toBe(1);
		expect(result.totalPages).toBe(0);
	});

	it('gets a recurring transaction by ID via Drizzle (not found → null)', async () => {
		const result = await getRecurringById(42, 1);
		expect(result).toBeNull();
	});

	it('creates a recurring transaction via Drizzle', async () => {
		const result = await createRecurringTransaction(42, {
			type: 'expense',
			amount: 100,
			description: 'Test',
			category_id: 1,
			frequency: 'monthly',
			interval: 1,
			day_of_week: null,
			day_of_month: null,
			month_of_year: null,
			start_date: '2026-01-01',
			end_date: null,
			active: true,
		});
		expect(result.success).toBe(true);
	});

	it('updates a recurring transaction via Drizzle (not found → error)', async () => {
		const result = await updateRecurringTransaction(42, 1, {
			type: 'expense',
			amount: 100,
			description: 'Test',
			category_id: 1,
			frequency: 'monthly',
			interval: 1,
			day_of_week: null,
			day_of_month: null,
			month_of_year: null,
			start_date: '2026-01-01',
			end_date: null,
			active: true,
		});
		expect(result.success).toBe(false);
		expect(result.error).toBe('Recurring transaction not found');
	});

	it('gets active recurring count via Drizzle', async () => {
		const count = await getActiveRecurringCount(42);
		expect(count).toBe(0);
	});

	it('gets upcoming recurring via Drizzle', async () => {
		const result = await getUpcomingRecurring(42, 3);
		expect(result).toHaveLength(0);
	});
});
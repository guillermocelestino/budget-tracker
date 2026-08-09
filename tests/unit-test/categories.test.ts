import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { and, eq, sql, asc, ilike } from 'drizzle-orm';

let sequence = 0;

/**
 * Minimal fixture schema — mirrors init.ts DDL for the tables categories.ts uses:
 * users (FK parent), categories (the subject), recurring_transactions (counts).
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

describe('categories — SQLite / raw query path (in-memory better-sqlite3)', () => {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	sqlite.exec(SQLITE_FIXTURE_SCHEMA);

	let svc: typeof import('$lib/server/categories');

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
					const { sql: sqlText, paramIndices } = real.translatePgToSQLite(text);
					const mapped = mapParams(paramIndices, params);
					const stmt = sqlite.prepare(sqlText);
					return (mapped.length > 0 ? stmt.get(...mapped) : stmt.get()) as T | undefined;
				},
				queryMany: async <T>(text: string, params: unknown[] = []): Promise<T[]> => {
					const { sql: sqlText, paramIndices } = real.translatePgToSQLite(text);
					const mapped = mapParams(paramIndices, params);
					const stmt = sqlite.prepare(sqlText);
					return (mapped.length > 0 ? stmt.all(...mapped) : stmt.all()) as T[];
				},
				execute: async (text: string, params: unknown[] = []): Promise<void> => {
					const { sql: sqlText, paramIndices } = real.translatePgToSQLite(text);
					const mapped = mapParams(paramIndices, params);
					const stmt = sqlite.prepare(sqlText);
					if (mapped.length > 0) stmt.run(...mapped); else stmt.run();
				}
			};
		});

		vi.resetModules();
		svc = await import('$lib/server/categories');
	});

	function createUser(): number {
		const username = `user_${sequence++}`;
		sqlite.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, 'hash');
		return (sqlite.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: number }).id;
	}

	function createCategory(
		userId: number,
		overrides: Partial<{
			name: string;
			color: string;
			icon: string;
			type: 'income' | 'expense';
			budget_limit: number | null;
		}> = {}
	): number {
		const name = overrides.name ?? `category_${sequence++}`;
		const info = sqlite
			.prepare(
				`INSERT INTO categories (user_id, name, color, icon, type, budget_limit)
				 VALUES (?, ?, ?, ?, ?, ?)`
			)
			.run(
				userId,
				name,
				overrides.color ?? '#123456',
				overrides.icon ?? '📁',
				overrides.type ?? 'expense',
				overrides.budget_limit ?? null
			);
		return Number(info.lastInsertRowid);
	}

	function addRecurring(userId: number, categoryId: number): void {
		sqlite
			.prepare(
				`INSERT INTO recurring_transactions
				 (user_id, type, amount, description, category_id, frequency, interval, start_date, next_run, active)
				 VALUES (?, 'expense', ?, ?, ?, 'monthly', 1, '2026-01-01', '2026-08-01', 1)`
			)
			.run(userId, 100, `recurring_${sequence++}`, categoryId);
	}

	it('lists a user\'s categories ordered by name, mapped without user_id', async () => {
		const userId = createUser();
		createCategory(userId, { name: 'Rent', budget_limit: 5000 });
		createCategory(userId, { name: 'Food', type: 'income' });

		const result = await svc.getCategories(userId);

		expect(result.map((c) => c.name)).toEqual(['Food', 'Rent']);
		expect(result[0]).toMatchObject({
			id: expect.any(Number),
			name: 'Food',
			type: 'income',
			budget_limit: null,
		});
		// The domain Category type intentionally excludes user_id.
		expect(result[0]).not.toHaveProperty('user_id');
		expect(typeof result[0]!.created_at).toBe('string');
		expect(result[1]!.budget_limit).toBe(5000);
	});

	it('getCategories does not return categories owned by another user', async () => {
		const userA = createUser();
		const userB = createUser();
		createCategory(userA, { name: 'Mine' });
		createCategory(userB, { name: 'Theirs' });

		const result = await svc.getCategories(userA);

		expect(result.map((c) => c.name)).toEqual(['Mine']);
	});

	it('getCategory returns a category by id', async () => {
		const userId = createUser();
		const catId = createCategory(userId, { name: 'Food', icon: '🍔', color: '#ef4444', budget_limit: 2500 });

		const result = await svc.getCategory(userId, catId);

		expect(result).not.toBeNull();
		expect(result!.id).toBe(catId);
		expect(result!.name).toBe('Food');
		expect(result!.icon).toBe('🍔');
		expect(result!.color).toBe('#ef4444');
		expect(result!.type).toBe('expense');
		expect(result!.budget_limit).toBe(2500);
		expect(result).not.toHaveProperty('user_id');
	});

	it('getCategory returns null when not found', async () => {
		const userId = createUser();
		const result = await svc.getCategory(userId, 9999);
		expect(result).toBeNull();
	});

	it('getCategory returns null for a category owned by another user', async () => {
		const userA = createUser();
		const userB = createUser();
		const catId = createCategory(userA, { name: 'Private' });

		const result = await svc.getCategory(userB, catId);
		expect(result).toBeNull();
	});

	it('checkCategoryNameExists returns true when the name exists', async () => {
		const userId = createUser();
		createCategory(userId, { name: 'Food' });

		const exists = await svc.checkCategoryNameExists(userId, 'Food');
		expect(exists).toBe(true);
	});

	it('checkCategoryNameExists returns false when the name does not exist', async () => {
		const userId = createUser();
		const exists = await svc.checkCategoryNameExists(userId, 'Nope');
		expect(exists).toBe(false);
	});

	it('checkCategoryNameExists ignores other users\' category names', async () => {
		const userA = createUser();
		const userB = createUser();
		createCategory(userA, { name: 'Food' });

		const existsForB = await svc.checkCategoryNameExists(userB, 'Food');
		expect(existsForB).toBe(false);
	});

	it('checkCategoryNameExists with excludeId ignores the category itself (update flow)', async () => {
		const userId = createUser();
		const catId = createCategory(userId, { name: 'Food' });

		// Same name, excluding its own id → not a duplicate.
		const dup = await svc.checkCategoryNameExists(userId, 'Food', catId);
		expect(dup).toBe(false);

		// A different category owning the name → still a duplicate.
		const otherId = createCategory(userId, { name: 'Travel' });
		const dup2 = await svc.checkCategoryNameExists(userId, 'Food', otherId);
		expect(dup2).toBe(true);
	});

	it('checkCategoryNameExists trims whitespace', async () => {
		const userId = createUser();
		createCategory(userId, { name: 'Food' });
		const exists = await svc.checkCategoryNameExists(userId, '  Food  ');
		expect(exists).toBe(true);
	});

	describe('searchCategories', () => {
		it('searches categories by name substring', async () => {
			const userId = createUser();
			createCategory(userId, { name: 'Groceries', icon: '🛒', color: '#27ae60' });
			createCategory(userId, { name: 'Electronics', icon: '📱', color: '#3498db' });
			createCategory(userId, { name: 'Rent', icon: '🏠', color: '#e74c3c' });

			const results = await svc.searchCategories(userId, 'gro');

			expect(results).toHaveLength(1);
			expect(results[0].name).toBe('Groceries');
			expect(results[0].icon).toBe('🛒');
			expect(results[0].color).toBe('#27ae60');
			expect(results[0].type).toBe('expense');
		});

		it('returns empty array when no matches', async () => {
			const userId = createUser();
			createCategory(userId, { name: 'Food' });

			const results = await svc.searchCategories(userId, 'xyz');

			expect(results).toHaveLength(0);
		});

		it('orders by name ASC and limits to 5', async () => {
			const userId = createUser();
			createCategory(userId, { name: 'Zebra' });
			createCategory(userId, { name: 'Alpha' });
			createCategory(userId, { name: 'Beta' });
			createCategory(userId, { name: 'Gamma' });
			createCategory(userId, { name: 'Delta' });
			createCategory(userId, { name: 'Epsilon' });

			const results = await svc.searchCategories(userId, '');

			expect(results).toHaveLength(5);
			expect(results.map(r => r.name)).toEqual(['Alpha', 'Beta', 'Delta', 'Epsilon', 'Gamma']);
		});

		it('is user-isolated', async () => {
			const userA = createUser();
			const userB = createUser();
			createCategory(userA, { name: 'Food' });
			createCategory(userB, { name: 'Food' });

			const results = await svc.searchCategories(userA, 'foo');

			expect(results).toHaveLength(1);
			expect(results[0].name).toBe('Food');
		});

		it('returns only id, name, icon, color, type (no budget_limit or created_at)', async () => {
			const userId = createUser();
			createCategory(userId, { name: 'Test', budget_limit: 1000 });

			const results = await svc.searchCategories(userId, 'test');

			expect(results).toHaveLength(1);
			expect(Object.keys(results[0]).sort()).toEqual(['color', 'icon', 'id', 'name', 'type']);
			expect(results[0]).not.toHaveProperty('budget_limit');
			expect(results[0]).not.toHaveProperty('created_at');
		});
	});

	it('createCategory creates with defaults (color/icon/type) and returns the new id', async () => {
		const userId = createUser();
		const id = await svc.createCategory(userId, { name: 'Rent' });

		const created = await svc.getCategory(userId, id);
		expect(created).not.toBeNull();
		expect(created!.name).toBe('Rent');
		expect(created!.color).toBe('#6366f1');
		expect(created!.icon).toBe('📁');
		expect(created!.type).toBe('expense');
		expect(created!.budget_limit).toBeNull();
	});

	it('createCategory trims the name and persists explicit fields', async () => {
		const userId = createUser();
		const id = await svc.createCategory(userId, {
			name: '  Groceries  ',
			color: '#27ae60',
			icon: '🛒',
			type: 'expense',
			budget_limit: 1500,
		});

		const created = await svc.getCategory(userId, id);
		expect(created!.name).toBe('Groceries');
		expect(created!.color).toBe('#27ae60');
		expect(created!.icon).toBe('🛒');
		expect(created!.budget_limit).toBe(1500);
	});

	it('createCategory supports income type', async () => {
		const userId = createUser();
		const id = await svc.createCategory(userId, { name: 'Salary', type: 'income' });
		const created = await svc.getCategory(userId, id);
		expect(created!.type).toBe('income');
	});

	it('updateCategory updates name/color/icon/budget_limit and returns true', async () => {
		const userId = createUser();
		const catId = createCategory(userId, { name: 'Old', budget_limit: 100 });

		const ok = await svc.updateCategory(userId, catId, {
			name: 'New',
			color: '#8b5cf6',
			icon: '✨',
			budget_limit: 999,
		});

		expect(ok).toBe(true);
		const updated = await svc.getCategory(userId, catId);
		expect(updated!.name).toBe('New');
		expect(updated!.color).toBe('#8b5cf6');
		expect(updated!.icon).toBe('✨');
		expect(updated!.budget_limit).toBe(999);
	});

	it('updateCategory updates the type on SQLite', async () => {
		const userId = createUser();
		const catId = createCategory(userId, { name: 'Side Hustle', type: 'expense' });

		const ok = await svc.updateCategory(userId, catId, { type: 'income' });

		expect(ok).toBe(true);
		const updated = await svc.getCategory(userId, catId);
		expect(updated!.type).toBe('income');
	});

	it('updateCategory clears budget_limit with null', async () => {
		const userId = createUser();
		const catId = createCategory(userId, { name: 'Rent', budget_limit: 5000 });

		const ok = await svc.updateCategory(userId, catId, { budget_limit: null });

		expect(ok).toBe(true);
		const updated = await svc.getCategory(userId, catId);
		expect(updated!.budget_limit).toBeNull();
	});

	it('updateCategory returns false for a nonexistent category', async () => {
		const userId = createUser();
		const ok = await svc.updateCategory(userId, 9999, { name: 'Ghost' });
		expect(ok).toBe(false);
	});

	it('updateCategory does not modify a category owned by another user', async () => {
		const userA = createUser();
		const userB = createUser();
		const catId = createCategory(userA, { name: 'Theirs' });

		const ok = await svc.updateCategory(userB, catId, { name: 'Hijacked' });

		expect(ok).toBe(false);
		const unchanged = await svc.getCategory(userA, catId);
		expect(unchanged!.name).toBe('Theirs');
	});

	it('updateCategory with no fields returns true without changing anything', async () => {
		const userId = createUser();
		const catId = createCategory(userId, { name: 'Stable' });

		const ok = await svc.updateCategory(userId, catId, {});

		expect(ok).toBe(true);
		const unchanged = await svc.getCategory(userId, catId);
		expect(unchanged!.name).toBe('Stable');
	});

	it('deleteCategory deletes and returns true', async () => {
		const userId = createUser();
		const catId = createCategory(userId, { name: 'Gone' });

		const ok = await svc.deleteCategory(userId, catId);

		expect(ok).toBe(true);
		expect(await svc.getCategory(userId, catId)).toBeNull();
	});

	it('deleteCategory returns false for a nonexistent category', async () => {
		const userId = createUser();
		const ok = await svc.deleteCategory(userId, 9999);
		expect(ok).toBe(false);
	});

	it('deleteCategory does not delete a category owned by another user', async () => {
		const userA = createUser();
		const userB = createUser();
		const catId = createCategory(userA, { name: 'Theirs' });

		const ok = await svc.deleteCategory(userB, catId);

		expect(ok).toBe(false);
		expect(await svc.getCategory(userA, catId)).not.toBeNull();
	});

	it('getTotalBudgeted sums expense budgets only, isolated by user', async () => {
		const userA = createUser();
		const userB = createUser();
		createCategory(userA, { name: 'Rent', type: 'expense', budget_limit: 5000 });
		createCategory(userA, { name: 'Groceries', type: 'expense', budget_limit: 2500 });
		createCategory(userA, { name: 'Salary', type: 'income', budget_limit: 100000 });
		createCategory(userB, { name: 'Theirs', type: 'expense', budget_limit: 99999 });

		const totalA = await svc.getTotalBudgeted(userA);
		const totalB = await svc.getTotalBudgeted(userB);

		expect(totalA).toBe(7500);
		expect(totalB).toBe(99999);
	});

	it('getTotalBudgeted returns 0 with no expense budgets', async () => {
		const userId = createUser();
		createCategory(userId, { name: 'No Budget' });
		expect(await svc.getTotalBudgeted(userId)).toBe(0);
	});

	it('getRecurringCountsByCategory counts recurring transactions per category, isolated by user', async () => {
		const userA = createUser();
		const userB = createUser();
		const catA1 = createCategory(userA, { name: 'A1' });
		const catA2 = createCategory(userA, { name: 'A2' });
		const catB = createCategory(userB, { name: 'B1' });

		addRecurring(userA, catA1);
		addRecurring(userA, catA1);
		addRecurring(userA, catA2);
		addRecurring(userB, catB);
		addRecurring(userB, catB);
		addRecurring(userB, catB);
		addRecurring(userB, catB);
		addRecurring(userB, catB);

		const countsA = await svc.getRecurringCountsByCategory(userA);
		const countsB = await svc.getRecurringCountsByCategory(userB);

		expect(countsA[catA1]).toBe(2);
		expect(countsA[catA2]).toBe(1);
		expect(countsA[catB]).toBeUndefined(); // User B's count must not leak in.
		expect(countsB[catB]).toBe(5);
		expect(countsB[catA1]).toBeUndefined();
	});

	it('getRecurringCountsByCategory returns an empty record for a user with no recurring rows', async () => {
		const userId = createUser();
		const counts = await svc.getRecurringCountsByCategory(userId);
		expect(counts).toEqual({});
	});
});

describe('categories — Drizzle / Postgres path (recorded fake client)', () => {
	let svc: typeof import('$lib/server/categories');
	let categoriesTable: typeof import('$lib/database/schema').categories;
	let recurringTransactionsTable: typeof import('$lib/database/schema').recurringTransactions;

	type SelectCall = {
		table: string;
		cols: string;
		whereArgs: unknown[];
		orderBy: boolean;
		limit: boolean;
		groupByArgs: unknown[];
	};
	type InsertCall = { table: string; values: Record<string, unknown> | null; returning: boolean };
	type UpdateCall = { table: string; set: Record<string, unknown> | null; whereArgs: unknown[] };
	type DeleteCall = { table: string; whereArgs: unknown[]; returning: boolean };

	let calls: {
		selects: SelectCall[];
		inserts: InsertCall[];
		updates: UpdateCall[];
		deletes: DeleteCall[];
	};
	let selectRowsByCols: Record<string, unknown[]>;
	let insertResult: { id: number }[];
	let deleteResult: { id: number }[];

	/** Sorted column-key of the full category row select used by getCategories/getCategory. */
	const CATEGORY_COLS = 'budget_limit,color,created_at,icon,id,name,type,user_id';

	function tableName(t: unknown): string {
		if (t === categoriesTable) return 'categories';
		if (t === recurringTransactionsTable) return 'recurring_transactions';
		return 'unknown';
	}

	function makeChain(data: unknown[], onCall?: (kind: string, args: unknown[]) => void) {
		const chain: Record<string, (...args: unknown[]) => unknown> = {};
		const methods = [
			'select', 'from', 'leftJoin', 'on', 'where', 'groupBy', 'orderBy',
			'limit', 'offset', 'insert', 'values', 'update', 'set', 'delete', 'returning'
		];
		for (const m of methods) {
			chain[m] = (...args: unknown[]) => {
				onCall?.(m, args);
				return chain;
			};
		}
		(chain as { then: unknown }).then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
			Promise.resolve(data).then(onFulfilled, onRejected);
		return chain as unknown as any;
	}

	function fakeDb() {
		return {
			select: (cols?: Record<string, unknown>) => {
				const key = cols ? Object.keys(cols).sort().join(',') : '';
				const rec: SelectCall = { table: '', cols: key, whereArgs: [], orderBy: false, limit: false, groupByArgs: [] };
				calls.selects.push(rec);
				return makeChain(selectRowsByCols[key] ?? [], (kind, args) => {
					if (kind === 'from') rec.table = tableName(args[0]);
					else if (kind === 'where') rec.whereArgs.push(args[0]);
					else if (kind === 'orderBy') rec.orderBy = true;
					else if (kind === 'limit') rec.limit = true;
					else if (kind === 'groupBy') rec.groupByArgs = args;
				});
			},
			insert: (table: unknown) => {
				const rec: InsertCall = { table: tableName(table), values: null, returning: false };
				calls.inserts.push(rec);
				return makeChain(insertResult, (kind, args) => {
					if (kind === 'values') rec.values = args[0] as Record<string, unknown>;
					else if (kind === 'returning') rec.returning = true;
				});
			},
			update: (table: unknown) => {
				const rec: UpdateCall = { table: tableName(table), set: null, whereArgs: [] };
				calls.updates.push(rec);
				return makeChain([], (kind, args) => {
					if (kind === 'set') rec.set = args[0] as Record<string, unknown>;
					else if (kind === 'where') rec.whereArgs.push(args[0]);
				});
			},
			delete: (table: unknown) => {
				const rec: DeleteCall = { table: tableName(table), whereArgs: [], returning: false };
				calls.deletes.push(rec);
				return makeChain(deleteResult, (kind, args) => {
					if (kind === 'where') rec.whereArgs.push(args[0]);
					else if (kind === 'returning') rec.returning = true;
				});
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
		// Import after resetModules so these reference the SAME table objects the service imported.
		const schema = await import('$lib/database/schema');
		categoriesTable = schema.categories;
		recurringTransactionsTable = schema.recurringTransactions;
		svc = await import('$lib/server/categories');
	});

	beforeEach(() => {
		calls = { selects: [], inserts: [], updates: [], deletes: [] };
		selectRowsByCols = {};
		insertResult = [];
		deleteResult = [];
	});

	it('getCategories selects the full row from categories with user ownership and maps it', async () => {
		selectRowsByCols[CATEGORY_COLS] = [{
			id: 1,
			user_id: 42,
			name: 'Food',
			color: '#123456',
			icon: '🍔',
			type: 'expense',
			budget_limit: '5000', // NUMERIC → string on Postgres
			created_at: new Date('2026-08-01T00:00:00.000Z'),
		}];

		const result = await svc.getCategories(42);

		expect(result).toEqual([{
			id: 1,
			name: 'Food',
			color: '#123456',
			icon: '🍔',
			type: 'expense',
			budget_limit: 5000,
			created_at: '2026-08-01T00:00:00.000Z',
		}]);
		expect(result[0]).not.toHaveProperty('user_id');
		expect(calls.selects).toHaveLength(1);
		expect(calls.selects[0]!.table).toBe('categories');
		expect(calls.selects[0]!.cols).toBe(CATEGORY_COLS);
		expect(calls.selects[0]!.whereArgs).toEqual([eq(categoriesTable.user_id, 42)]);
		expect(calls.selects[0]!.orderBy).toBe(true);
	});

	it('getCategory selects with user + id ownership conditions and limit(1)', async () => {
		selectRowsByCols[CATEGORY_COLS] = [{
			id: 7,
			user_id: 42,
			name: 'Travel',
			color: '#2ba8a2',
			icon: '✈️',
			type: 'expense',
			budget_limit: null,
			created_at: new Date('2026-07-15T12:30:00.000Z'),
		}];

		const result = await svc.getCategory(42, 7);

		expect(result).not.toBeNull();
		expect(result!.id).toBe(7);
		expect(result!.budget_limit).toBeNull();
		expect(result!.created_at).toBe('2026-07-15T12:30:00.000Z');
		expect(calls.selects[0]!.table).toBe('categories');
		expect(calls.selects[0]!.whereArgs).toEqual([and(eq(categoriesTable.user_id, 42), eq(categoriesTable.id, 7))]);
		expect(calls.selects[0]!.limit).toBe(true);
	});

	it('getCategory returns null when the Drizzle query yields no row', async () => {
		selectRowsByCols[CATEGORY_COLS] = [];
		const result = await svc.getCategory(42, 7);
		expect(result).toBeNull();
		expect(calls.selects[0]!.whereArgs).toEqual([and(eq(categoriesTable.user_id, 42), eq(categoriesTable.id, 7))]);
	});

	it('checkCategoryNameExists matches user + name, found → true', async () => {
		selectRowsByCols['id'] = [{ id: 3 }];
		const exists = await svc.checkCategoryNameExists(42, 'Food');
		expect(exists).toBe(true);
		expect(calls.selects[0]!.table).toBe('categories');
		expect(calls.selects[0]!.cols).toBe('id');
		expect(calls.selects[0]!.whereArgs).toEqual([and(eq(categoriesTable.user_id, 42), eq(categoriesTable.name, 'Food'))]);
		expect(calls.selects[0]!.limit).toBe(true);
	});

	it('checkCategoryNameExists no match → false', async () => {
		selectRowsByCols['id'] = [];
		const exists = await svc.checkCategoryNameExists(42, 'Nope');
		expect(exists).toBe(false);
	});

	it('checkCategoryNameExists adds the exclude-id condition', async () => {
		selectRowsByCols['id'] = [{ id: 9 }];
		const exists = await svc.checkCategoryNameExists(42, 'Food', 9);
		expect(exists).toBe(true);
		expect(calls.selects[0]!.whereArgs).toEqual([
			and(
				eq(categoriesTable.user_id, 42),
				eq(categoriesTable.name, 'Food'),
				sql`${categoriesTable.id} != ${9}`
			)
		]);
	});

	it('createCategory inserts with defaults and returns the returned id', async () => {
		insertResult = [{ id: 11 }];
		const id = await svc.createCategory(42, { name: 'Rent' });
		expect(id).toBe(11);

		expect(calls.inserts).toHaveLength(1);
		expect(calls.inserts[0]!.table).toBe('categories');
		expect(calls.inserts[0]!.returning).toBe(true);
		expect(calls.inserts[0]!.values).toEqual({
			user_id: 42,
			name: 'Rent',
			color: '#6366f1',
			icon: '📁',
			type: 'expense',
			budget_limit: null,
		});
	});

	it('createCategory stores numeric budget_limit as a string and supports income type', async () => {
		insertResult = [{ id: 12 }];
		await svc.createCategory(42, { name: 'Salary', type: 'income', budget_limit: 1500 });
		expect(calls.inserts[0]!.values).toEqual({
			user_id: 42,
			name: 'Salary',
			color: '#6366f1',
			icon: '📁',
			type: 'income',
			budget_limit: '1500',
		});
	});

	it('updateCategory sets the type through Drizzle (approved optional type param)', async () => {
		// Precondition: the existing category must be found (user + id).
		selectRowsByCols[CATEGORY_COLS] = [{
			id: 5,
			user_id: 42,
			name: 'Side Hustle',
			color: '#123456',
			icon: '📁',
			type: 'expense',
			budget_limit: null,
			created_at: new Date('2026-08-01T00:00:00.000Z'),
		}];

		const ok = await svc.updateCategory(42, 5, { type: 'income' });

		expect(ok).toBe(true);
		expect(calls.selects).toHaveLength(1); // ownership precondition
		expect(calls.selects[0]!.whereArgs).toEqual([and(eq(categoriesTable.user_id, 42), eq(categoriesTable.id, 5))]);
		expect(calls.updates).toHaveLength(1);
		expect(calls.updates[0]!.table).toBe('categories');
		expect(calls.updates[0]!.set).toEqual({ type: 'income' });
		expect(calls.updates[0]!.whereArgs).toEqual([and(eq(categoriesTable.user_id, 42), eq(categoriesTable.id, 5))]);
	});

	it('updateCategory maps other fields to the Drizzle set payload', async () => {
		selectRowsByCols[CATEGORY_COLS] = [{
			id: 5,
			user_id: 42,
			name: 'Old',
			color: '#123456',
			icon: '📁',
			type: 'expense',
			budget_limit: '100',
			created_at: new Date('2026-08-01T00:00:00.000Z'),
		}];

		const ok = await svc.updateCategory(42, 5, { name: 'New', color: '#27ae60', budget_limit: 2500 });

		expect(ok).toBe(true);
		expect(calls.updates[0]!.set).toEqual({ name: 'New', color: '#27ae60', budget_limit: '2500' });
	});

	it('updateCategory returns false and issues no update when the category is not found', async () => {
		selectRowsByCols[CATEGORY_COLS] = [];
		const ok = await svc.updateCategory(42, 9999, { name: 'Ghost' });
		expect(ok).toBe(false);
		expect(calls.updates).toHaveLength(0);
	});

	it('deleteCategory deletes through Drizzle with ownership + returning', async () => {
		deleteResult = [{ id: 8 }];
		const deleted = await svc.deleteCategory(42, 8);
		expect(deleted).toBe(true);

		expect(calls.deletes).toHaveLength(1);
		expect(calls.deletes[0]!.table).toBe('categories');
		expect(calls.deletes[0]!.whereArgs).toEqual([and(eq(categoriesTable.user_id, 42), eq(categoriesTable.id, 8))]);
		expect(calls.deletes[0]!.returning).toBe(true);
	});

	it('deleteCategory returns false when returning yields no row', async () => {
		deleteResult = [];
		const deleted = await svc.deleteCategory(42, 8);
		expect(deleted).toBe(false);
		expect(calls.deletes[0]!.whereArgs).toEqual([and(eq(categoriesTable.user_id, 42), eq(categoriesTable.id, 8))]);
	});

	it('getTotalBudgeted aggregates expense budgets with ownership condition', async () => {
		selectRowsByCols['total'] = [{ total: '2500' }];
		const total = await svc.getTotalBudgeted(42);
		expect(total).toBe(2500);
		expect(calls.selects[0]!.table).toBe('categories');
		expect(calls.selects[0]!.cols).toBe('total');
		expect(calls.selects[0]!.whereArgs).toEqual([
			and(eq(categoriesTable.user_id, 42), eq(categoriesTable.type, 'expense')),
		]);
	});

	it('getTotalBudgeted returns 0 when the aggregate is empty', async () => {
		selectRowsByCols['total'] = [];
		const total = await svc.getTotalBudgeted(42);
		expect(total).toBe(0);
	});

	it('getRecurringCountsByCategory aggregates on recurring_transactions grouped by category, isolated by user', async () => {
		selectRowsByCols['category_id,cnt'] = [
			{ category_id: 1, cnt: 2 },
			{ category_id: null, cnt: 3 }, // null category rows are skipped
		];

		const counts = await svc.getRecurringCountsByCategory(42);

		expect(counts).toEqual({ 1: 2 });
		expect(calls.selects[0]!.table).toBe('recurring_transactions');
		expect(calls.selects[0]!.cols).toBe('category_id,cnt');
		expect(calls.selects[0]!.whereArgs).toEqual([eq(recurringTransactionsTable.user_id, 42)]);
		expect(calls.selects[0]!.groupByArgs).toEqual([recurringTransactionsTable.category_id]);
	});

	it('getRecurringCountsByCategory returns an empty record when no rows', async () => {
		selectRowsByCols['category_id,cnt'] = [];
		const counts = await svc.getRecurringCountsByCategory(42);
		expect(counts).toEqual({});
	});

	describe('searchCategories', () => {
		it('searches categories via Drizzle with ilike and orders by name ASC', async () => {
			selectRowsByCols['color,icon,id,name,type'] = [{
				id: 1,
				name: 'Groceries',
				icon: '🛒',
				color: '#27ae60',
				type: 'expense'
			}];

			const results = await svc.searchCategories(42, 'gro');

			expect(calls.selects).toHaveLength(1);
			expect(calls.selects[0]!.table).toBe('categories');
			expect(calls.selects[0]!.cols).toBe('color,icon,id,name,type');
			expect(calls.selects[0]!.whereArgs).toEqual([
				and(eq(categoriesTable.user_id, 42), ilike(categoriesTable.name, '%gro%'))
			]);
			expect(calls.selects[0]!.orderBy).toBe(true);
			expect(calls.selects[0]!.limit).toBe(true);
			expect(results).toHaveLength(1);
			expect(results[0].name).toBe('Groceries');
			expect(results[0].icon).toBe('🛒');
			expect(results[0].color).toBe('#27ae60');
			expect(results[0].type).toBe('expense');
		});

		it('returns empty array when no matches', async () => {
			selectRowsByCols['color,icon,id,name,type'] = [];

			const results = await svc.searchCategories(42, 'xyz');

			expect(results).toHaveLength(0);
		});

		it('limits to 5 results', async () => {
			selectRowsByCols['color,icon,id,name,type'] = [];

			await svc.searchCategories(42, 'test');

			expect(calls.selects[0]!.limit).toBe(true);
		});

		it('selects only the five specified fields', async () => {
			selectRowsByCols['color,icon,id,name,type'] = [];

			await svc.searchCategories(42, 'test');

			expect(calls.selects[0]!.cols).toBe('color,icon,id,name,type');
		});
	});
});

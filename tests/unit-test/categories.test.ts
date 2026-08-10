import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { and, eq, sql, ilike } from 'drizzle-orm';

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
			getPgPool: () => Promise.reject(new Error('getPgPool should not be called on Drizzle path')),
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

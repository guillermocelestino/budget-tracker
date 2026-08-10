import { describe, it, expect, beforeAll, vi } from 'vitest';

describe('recurringService — Drizzle / Postgres path (recorded fake client)', () => {
	let listRecurringTransactions: typeof import('$lib/server/services/recurringService').listRecurringTransactions;
	let getRecurringById: typeof import('$lib/server/services/recurringService').getRecurringById;
	let createRecurringTransaction: typeof import('$lib/server/services/recurringService').createRecurringTransaction;
	let updateRecurringTransaction: typeof import('$lib/server/services/recurringService').updateRecurringTransaction;
	let getActiveRecurringCount: typeof import('$lib/server/services/recurringService').getActiveRecurringCount;
	let getUpcomingRecurring: typeof import('$lib/server/services/recurringService').getUpcomingRecurring;

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
		vi.doMock('$lib/server/db', () => ({
			getPgPool: () => Promise.reject(new Error('getPgPool should not be called on Drizzle path')),
			initDb: async () => {},
			closeDb: async () => {}
		}));
		vi.doMock('$lib/server/db/drizzle', () => ({
			getDrizzle: () => Promise.resolve(fakeDb())
		}));
		vi.resetModules();
		const svc = await import('$lib/server/services/recurringService');
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
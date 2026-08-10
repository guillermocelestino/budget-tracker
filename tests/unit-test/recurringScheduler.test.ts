import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { calculateNextRun } from '$lib/utils/recurring';

/**
 * Focused unit tests for src/lib/server/recurringScheduler.ts.
 *
 * PostgreSQL-only (Drizzle): `$lib/database/drizzle` is mocked to a recorded
 * fake client so scheduler behavior is exercised without a live Neon connection.
 */

describe('recurringScheduler — Drizzle / Postgres path (recorded fake client)', () => {
	let processRecurring: typeof import('$lib/server/recurringScheduler').processRecurringTransactions;
	let runNow: typeof import('$lib/server/recurringScheduler').runRecurringNow;
	let toggle: typeof import('$lib/server/recurringScheduler').toggleRecurringStatus;
	let duplicate: typeof import('$lib/server/recurringScheduler').duplicateRecurringTransaction;
	let calls: {
		selects: number; // db.select — the due query (outside any transaction)
		txSelects: number; // tx.select — inside db.transaction
		inserts: Record<string, unknown>[]; // db.insert — global writes
		txInserts: Record<string, unknown>[]; // tx.insert — inside db.transaction
		updates: Record<string, unknown>[]; // db.update — global writes
		txUpdates: Record<string, unknown>[]; // tx.update — inside db.transaction
		returningIds: number[];
		transactions: number; // db.transaction calls
	};
	let recurringRows: Record<string, unknown>[];
	let categoryRows: Record<string, unknown>[];

	function makeQueryClient(counters: {
		select: () => void;
		insert: (values: Record<string, unknown>) => void;
		update: (values: Record<string, unknown>) => void;
	}) {
		return {
			select() {
				counters.select();
				const chain: any = {};
				const methods = ['from', 'where', 'orderBy', 'limit'];
				for (const m of methods) {
					chain[m] = function (table?: { name?: string }) {
						if (m === 'from') chain.__table = table?.name ?? 'unknown';
						return chain;
					};
				}
				chain.then = (onFulfilled: any, onRejected: any) => {
					// Drizzle schema tables expose `.name`; the scheduler queries
					// recurring_transactions while createTransactionInTxDrizzle queries
					// categories — key the fake's response off the FROM table so the
					// category ownership check passes for the tx path.
					const data = chain.__table === 'categories' ? categoryRows : recurringRows;
					return Promise.resolve(data).then(onFulfilled, onRejected);
				};
				return chain;
			},
			insert() {
				return {
					values(values: Record<string, unknown>) {
						counters.insert(values);
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
								counters.update(values);
								return Promise.resolve(undefined);
							}
						};
					}
				};
			}
		};
	}

	function fakeDb() {
		// Two distinct clients: the global `db` (outside any transaction) and the
		// `tx` handed to the db.transaction callback. The scheduler may only touch
		// the global db for the due-recurring SELECT; every write must go through tx.
		const db = makeQueryClient({
			select: () => { calls.selects += 1; },
			insert: (values) => { calls.inserts.push(values); },
			update: (values) => { calls.updates.push(values); }
		});
		const tx = makeQueryClient({
			select: () => { calls.txSelects += 1; },
			insert: (values) => { calls.txInserts.push(values); },
			update: (values) => { calls.txUpdates.push(values); }
		});
		return {
			...db,
			transaction(cb: (t: ReturnType<typeof makeQueryClient>) => unknown) {
				calls.transactions += 1;
				return cb(tx);
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
		const svc = await import('$lib/server/recurringScheduler');
		processRecurring = svc.processRecurringTransactions;
		runNow = svc.runRecurringNow;
		toggle = svc.toggleRecurringStatus;
		duplicate = svc.duplicateRecurringTransaction;
	});

	beforeEach(() => {
		calls = {
			selects: 0,
			txSelects: 0,
			inserts: [],
			txInserts: [],
			updates: [],
			txUpdates: [],
			returningIds: [],
			transactions: 0
		};
		recurringRows = [];
		categoryRows = [{ id: 5 }];
	});

	it('processRecurringTransactions wraps each due item in db.transaction and uses tx only', async () => {
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
		// One transaction per due item.
		expect(calls.transactions).toBe(1);
		// The due-recurring query ran on the global db...
		expect(calls.selects).toBe(1);
		// ...but the transaction INSERT, category ownership check, and schedule
		// UPDATE all ran through the supplied tx.
		expect(calls.txSelects).toBe(1);
		expect(calls.txInserts).toHaveLength(1);
		expect(calls.txInserts[0]!.amount).toBe('100');
		expect(calls.txInserts[0]!.date).toBe('2026-08-01');
		expect(calls.txInserts[0]!.user_id).toBe(42);
		expect(calls.txUpdates).toHaveLength(1);
		expect(calls.txUpdates[0]!.next_run).toBe(
			calculateNextRun('2026-08-01', 'monthly', 1, null, null, null, '2026-08-01')
		);
		expect(calls.txUpdates[0]!.last_generated_at).toBeInstanceOf(Date);
		expect(calls.txUpdates[0]!.active).toBe(true);
		// The global db was never written inside the transaction.
		expect(calls.inserts).toHaveLength(0);
		expect(calls.updates).toHaveLength(0);
	});

	it('processRecurringTransactions wraps EACH due item in its own transaction (two items → two transactions)', async () => {
		recurringRows = [{
			id: 1,
			user_id: 42,
			type: 'expense',
			amount: '100',
			description: 'Netflix A',
			category_id: 5,
			frequency: 'monthly',
			interval: 1,
			day_of_week: null,
			day_of_month: null,
			month_of_year: null,
			start_date: '2026-08-01',
			end_date: null,
			next_run: '2026-07-01',
			last_generated_at: null,
			active: true,
			created_at: new Date(),
			updated_at: new Date()
		}, {
			id: 2,
			user_id: 42,
			type: 'expense',
			amount: '250',
			description: 'Netflix B',
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

		expect(count).toBe(2);
		expect(calls.transactions).toBe(2);
		expect(calls.txInserts).toHaveLength(2);
		expect(calls.txUpdates).toHaveLength(2);
		expect(calls.selects).toBe(1);
		expect(calls.inserts).toHaveLength(0);
		expect(calls.updates).toHaveLength(0);
	});

	it('processRecurringTransactions returns 0 when no due records', async () => {
		recurringRows = [];

		const count = await processRecurring(42);

		expect(count).toBe(0);
		expect(calls.transactions).toBe(0);
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
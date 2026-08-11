import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

describe('transactions service — Drizzle / Postgres path (recorded fake client)', () => {
	let listTransactions: typeof import('$lib/server/services/transactions').listTransactions;
	let getTransaction: typeof import('$lib/server/services/transactions').getTransaction;
	let createTransaction: typeof import('$lib/server/services/transactions').createTransaction;
	let updateTransaction: typeof import('$lib/server/services/transactions').updateTransaction;
	let deleteTransaction: typeof import('$lib/server/services/transactions').deleteTransaction;
	let deleteTransactions: typeof import('$lib/server/services/transactions').deleteTransactions;
	let getMonthlySummary: typeof import('$lib/server/services/transactions').getMonthlySummary;
	let getRecentTransactions: typeof import('$lib/server/services/transactions').getRecentTransactions;
	let getMonthlyReport: typeof import('$lib/server/services/transactions').getMonthlyReport;
	let getCategoryReport: typeof import('$lib/server/services/transactions').getCategoryReport;
	let searchTransactions: typeof import('$lib/server/services/transactions').searchTransactions;
	let getCategorySpending: typeof import('$lib/server/services/transactions').getCategorySpending;
	let getCategoryUsage: typeof import('$lib/server/services/transactions').getCategoryUsage;
	let getCategorySpendingReport: typeof import('$lib/server/services/transactions').getCategorySpendingReport;
	let getTransactionCountForMonth: typeof import('$lib/server/services/transactions').getTransactionCountForMonth;
	let getAllTimeTransactionCount: typeof import('$lib/server/services/transactions').getAllTimeTransactionCount;
	let getYTDSummary: typeof import('$lib/server/services/transactions').getYTDSummary;
	let getMonthlyTrends: typeof import('$lib/server/services/transactions').getMonthlyTrends;
	let getCashBalance: typeof import('$lib/server/services/transactions').getCashBalance;
	let getMonthlyCashFlows: typeof import('$lib/server/services/transactions').getMonthlyCashFlows;
	let getTransactionsForDuplicateCheck: typeof import('$lib/server/services/transactions').getTransactionsForDuplicateCheck;

	let calls: {
		selects: number;
		inserts: Record<string, unknown>[];
		updates: Record<string, unknown>[];
		deletes: number;
		transactions: number;
	};

	let selectRows: Record<string, unknown>[];
	let insertResult: { id: number }[];
	let deleteResult: { id: number }[];

	function fakeDb() {
		const builder = {
			select(fields?: unknown) {
				const selectChain: any = {};
				const methods = [
					'from', 'leftJoin', 'innerJoin', 'join', 'where', 'groupBy', 'orderBy', 'limit', 'offset'
				];
				for (const m of methods) {
					selectChain[m] = function() {
						return selectChain;
					};
				}
				selectChain.then = function(onfulfilled: any) {
					calls.selects += 1;
					return Promise.resolve(selectRows).then(onfulfilled);
				};
				return selectChain;
			},
			insert(table: unknown) {
				return {
					values(values: Record<string, unknown>) {
						calls.inserts.push(values);
						return {
							returning() {
								return Promise.resolve(insertResult);
							}
						};
					}
				};
			},
			update(table: unknown) {
				return {
					set(values: Record<string, unknown>) {
						calls.updates.push(values);
						return {
							where() {
								return Promise.resolve(true);
							}
						};
					}
				};
			},
			delete(table: unknown) {
				return {
					where() {
						calls.deletes += 1;
						return {
							returning() {
								return Promise.resolve(deleteResult);
							}
						};
					}
				};
			},
			transaction(callback: any) {
				calls.transactions += 1;
				return callback(builder);
			}
		};
		return builder;
	}

	beforeAll(async () => {
		vi.doMock('$lib/server/db', () => ({
			getPgPool: () => Promise.reject(new Error('getPgPool should not be called')),
			initDb: async () => {},
			closeDb: async () => {}
		}));

		vi.doMock('$lib/server/db/drizzle', () => ({
			getDrizzle: () => Promise.resolve(fakeDb() as any)
		}));

		vi.resetModules();
		const svc = await import('$lib/server/services/transactions');
		listTransactions = svc.listTransactions;
		getTransaction = svc.getTransaction;
		createTransaction = svc.createTransaction;
		updateTransaction = svc.updateTransaction;
		deleteTransaction = svc.deleteTransaction;
		deleteTransactions = svc.deleteTransactions;
		getMonthlySummary = svc.getMonthlySummary;
		getRecentTransactions = svc.getRecentTransactions;
		getMonthlyReport = svc.getMonthlyReport;
		getCategoryReport = svc.getCategoryReport;
		searchTransactions = svc.searchTransactions;
		getCategorySpending = svc.getCategorySpending;
		getCategoryUsage = svc.getCategoryUsage;
		getCategorySpendingReport = svc.getCategorySpendingReport;
		getTransactionCountForMonth = svc.getTransactionCountForMonth;
		getAllTimeTransactionCount = svc.getAllTimeTransactionCount;
		getYTDSummary = svc.getYTDSummary;
		getMonthlyTrends = svc.getMonthlyTrends;
		getCashBalance = svc.getCashBalance;
		getMonthlyCashFlows = svc.getMonthlyCashFlows;
		getTransactionsForDuplicateCheck = svc.getTransactionsForDuplicateCheck;
	});

	beforeEach(() => {
		calls = { selects: 0, inserts: [], updates: [], deletes: 0, transactions: 0 };
		selectRows = [];
		insertResult = [];
		deleteResult = [];
	});

	it('creates via Drizzle with string amount and correct user ID', async () => {
		// Mock verifyCategoryOwnership check
		selectRows = [{ id: 5 }]; // Category exists and is owned
		insertResult = [{ id: 42 }];

		const id = await createTransaction(12, {
			type: 'expense',
			amount: 250,
			description: 'Dinner',
			date: '2026-08-01',
			category_id: 5
		});

		expect(id).toBe(42);
		expect(calls.inserts).toHaveLength(1);
		expect(calls.inserts[0].user_id).toBe(12);
		expect(calls.inserts[0].amount).toBe('250');
		expect(calls.inserts[0].description).toBe('Dinner');
	});

	it('create without source_of_funds stores NULL (unspecified)', async () => {
		selectRows = [{ id: 5 }]; // category ownership check
		insertResult = [{ id: 43 }];

		await createTransaction(12, {
			type: 'income',
			amount: 100,
			description: 'Salary',
			date: '2026-08-01',
			category_id: 5
		});

		expect(calls.inserts[0].source_of_funds).toBeNull();
	});

	it('create with source_of_funds persists it (trimmed)', async () => {
		selectRows = [{ id: 5 }];
		insertResult = [{ id: 44 }];

		await createTransaction(12, {
			type: 'expense',
			amount: 80,
			description: 'Groceries',
			date: '2026-08-02',
			category_id: 5,
			source_of_funds: "  Mother's Money  "
		});

		expect(calls.inserts[0].source_of_funds).toBe("Mother's Money");
	});

	it('create with empty/whitespace source_of_funds normalizes to NULL', async () => {
		selectRows = [{ id: 5 }];
		insertResult = [{ id: 45 }];

		await createTransaction(12, {
			type: 'expense',
			amount: 10,
			description: 'Coffee',
			date: '2026-08-03',
			category_id: 5,
			source_of_funds: '   '
		});

		expect(calls.inserts[0].source_of_funds).toBeNull();
	});

	it('update with source_of_funds writes it', async () => {
		selectRows = [{ id: 42, amount: '250', description: 'Dinner', date: '2026-08-01', category_id: 5, type: 'expense' }];

		const ok = await updateTransaction(12, 42, { source_of_funds: 'Aunt' });

		expect(ok).toBe(true);
		expect(calls.updates[0].source_of_funds).toBe('Aunt');
	});

	it('update clearing source_of_funds (empty string) writes NULL', async () => {
		selectRows = [{ id: 42, amount: '250', description: 'Dinner', date: '2026-08-01', category_id: 5, type: 'expense', source_of_funds: 'Old' }];

		const ok = await updateTransaction(12, 42, { source_of_funds: '' });

		expect(ok).toBe(true);
		expect(calls.updates[0].source_of_funds).toBeNull();
	});

	it('partial update omitting source_of_funds preserves it (not written)', async () => {
		selectRows = [{ id: 42, amount: '250', description: 'Dinner', date: '2026-08-01', category_id: 5, type: 'expense', source_of_funds: 'Keep me' }];

		const ok = await updateTransaction(12, 42, { description: 'Updated dinner' });

		expect(ok).toBe(true);
		expect(calls.updates[0].source_of_funds).toBeUndefined();
		expect(calls.updates[0].description).toBe('Updated dinner');
	});

	it('maps source_of_funds from SELECT rows (getTransaction)', async () => {
		selectRows = [{ id: 42, amount: '250', description: 'Dinner', date: '2026-08-01', category_id: 5, type: 'expense', source_of_funds: "Mother's Money" }];

		const tx = await getTransaction(12, 42);
		expect(tx).not.toBeNull();
		expect(tx!.source_of_funds).toBe("Mother's Money");
	});

	it('maps missing source_of_funds to null (getTransaction)', async () => {
		selectRows = [{ id: 42, amount: '250', description: 'Dinner', date: '2026-08-01', category_id: 5, type: 'expense' }];

		const tx = await getTransaction(12, 42);
		expect(tx).not.toBeNull();
		expect(tx!.source_of_funds).toBeNull();
	});

	it('financial calculations are unaffected by source_of_funds', async () => {
		// getCashBalance only reads the SUM(...) alias fields; rows carrying
		// source_of_funds must not change the income−expense result.
		selectRows = [{ income: '500', expense: '200', source_of_funds: 'irrelevant' }];

		const balance = await getCashBalance(12);
		expect(balance).toBe(300);
	});

	it('deletes via Drizzle utilizing .returning({ id })', async () => {
		deleteResult = [{ id: 99 }];

		const deleted = await deleteTransaction(12, 99);
		expect(deleted).toBe(true);
		expect(calls.deletes).toBe(1);
	});

	it('deletes multiple atomically using Drizzle transaction and returning count', async () => {
		deleteResult = [{ id: 1 }, { id: 2 }];

		const count = await deleteTransactions(12, [1, 2]);
		expect(count).toBe(2);
		expect(calls.transactions).toBe(1);
	});

	it('selects monthly summary via Drizzle', async () => {
		selectRows = [{ totalIncome: '100', totalExpenses: '70' }];

		const summary = await getMonthlySummary(12, '2026-08');
		expect(summary.totalIncome).toBe(100);
		expect(summary.totalExpenses).toBe(70);
	});

	it('selects recent transactions via Drizzle', async () => {
		selectRows = [
			{ id: 2, amount: '50', description: 'T2', date: '2026-08-02', type: 'expense' },
			{ id: 1, amount: '100', description: 'T1', date: '2026-08-01', type: 'income' }
		];

		const recent = await getRecentTransactions(12, 2);
		expect(recent).toHaveLength(2);
		expect(recent[0].description).toBe('T2');
	});

	it('selects monthly report via Drizzle', async () => {
		selectRows = [{ month: '2026-08', income: '100', expense: '50' }];

		const report = await getMonthlyReport(12, 2026);
		expect(report).toHaveLength(1);
		expect(report[0].month).toBe('2026-08');
		expect(report[0].income).toBe(100);
		expect(report[0].expense).toBe(50);
	});

	it('selects category report via Drizzle', async () => {
		selectRows = [
			{ category_id: 1, category_name: 'Food', category_color: '#fff', total: '400' },
			{ category_id: 2, category_name: 'Utilities', category_color: '#000', total: '200' }
		];

		const report = await getCategoryReport(12, '2026-08', 'expense');
		expect(report).toHaveLength(2);
		expect(report[0].category_name).toBe('Food');
		expect(report[0].total).toBe(400);
	});

	it('searches transactions via Drizzle', async () => {
		selectRows = [{ id: 1, amount: '250', description: 'Walmart buy', date: '2026-08-01', type: 'expense' }];

		const results = await searchTransactions(12, 'walmart');
		expect(results).toHaveLength(1);
		expect(results[0].description).toBe('Walmart buy');
	});

	it('selects category spending via Drizzle', async () => {
		selectRows = [{ category_id: 5, income: '150', expense: '50' }];

		const spending = await getCategorySpending(12, '2026-08');
		expect(spending).toHaveLength(1);
		expect(spending[0].category_id).toBe(5);
		expect(spending[0].income).toBe(150);
		expect(spending[0].expense).toBe(50);
	});

	it('selects category usage via Drizzle', async () => {
		selectRows = [{ category_id: 5, cnt: 1, last_used: '2026-08-01' }];

		const usage = await getCategoryUsage(12);
		expect(usage).toHaveLength(1);
		expect(usage[0].category_id).toBe(5);
		expect(usage[0].cnt).toBe(1);
		expect(usage[0].last_used).toBe('2026-08-01');
	});

	it('selects category spending report via Drizzle', async () => {
		selectRows = [
			{ category_id: 1, category_name: 'Food', category_color: '#fff', total: '100' },
			{ category_id: 2, category_name: 'Utilities', category_color: '#000', total: '0' }
		];

		const report = await getCategorySpendingReport(12, '2026-08', 'expense');
		expect(report).toHaveLength(2);
		expect(report[0].total).toBe(100);
		expect(report[1].total).toBe(0);
	});

	it('gets transaction count for month via Drizzle', async () => {
		selectRows = [{ count: 5 }];

		const count = await getTransactionCountForMonth(12, '2026-08');
		expect(count).toBe(5);
	});

	it('gets all-time transaction count via Drizzle', async () => {
		selectRows = [{ count: 12 }];

		const count = await getAllTimeTransactionCount(12);
		expect(count).toBe(12);
	});

	it('gets YTD summary via Drizzle', async () => {
		selectRows = [{ income: '500', expense: '200' }];

		const ytd = await getYTDSummary(12, 2026, 3);
		expect(ytd.income).toBe(500);
		expect(ytd.expense).toBe(200);
	});

	it('selects monthly trends via Drizzle', async () => {
		selectRows = [{ month: '2026-08', income: '100', expense: '50' }];

		const trends = await getMonthlyTrends(12, '2026-08-01');
		expect(trends).toHaveLength(1);
		expect(trends[0].month).toBe('2026-08');
		expect(trends[0].income).toBe(100);
		expect(trends[0].expense).toBe(50);
		expect(calls.selects).toBe(1);
	});

	it('selects cash balance via Drizzle', async () => {
		selectRows = [{ income: '500', expense: '200' }];

		const balance = await getCashBalance(12);
		expect(balance).toBe(300);
		expect(calls.selects).toBe(1);
	});

	it('selects monthly cash flows via Drizzle', async () => {
		selectRows = [{ month: '2026-08', income: '100', expense: '40' }];

		const flows = await getMonthlyCashFlows(12);
		expect(flows).toHaveLength(1);
		expect(flows[0].month).toBe('2026-08');
		expect(flows[0].net).toBe(60);
		expect(calls.selects).toBe(1);
	});

	it('selects transactions for duplicate check via Drizzle', async () => {
		selectRows = [{ date: '2026-08-01', amount: '100', description: 'T1', category_id: 5 }];

		const dups = await getTransactionsForDuplicateCheck(12);
		expect(dups).toHaveLength(1);
		expect(dups[0].description).toBe('T1');
		expect(dups[0].amount).toBe(100);
		expect(dups[0].category_id).toBe(5);
		expect(calls.selects).toBe(1);
	});

	describe('listTransactions pagination and date range filtering', () => {
		it('supports standard limit of 20 by default', async () => {
			selectRows = [{ count: 45 }];
			const result = await listTransactions(12, {}, 1, 20);
			expect(result.page).toBe(1);
			expect(result.total).toBe(45);
			expect(result.totalPages).toBe(3); // 45 / 20 ceil = 3
		});

		it('supports large page sizes (50, 100, 200, 500)', async () => {
			selectRows = [{ count: 247 }];
			const result50 = await listTransactions(12, {}, 2, 50);
			expect(result50.page).toBe(2);
			expect(result50.total).toBe(247);
			expect(result50.totalPages).toBe(5); // 247 / 50 ceil = 5

			const result200 = await listTransactions(12, {}, 1, 200);
			expect(result200.totalPages).toBe(2); // 247 / 200 ceil = 2

			const result500 = await listTransactions(12, {}, 1, 500);
			expect(result500.totalPages).toBe(1); // 247 / 500 ceil = 1
		});

		it('supports All (unpaginated query when limit is undefined or 0)', async () => {
			selectRows = [
				{ id: 1, amount: '10', description: 'Item 1', date: '2026-01-01', category_id: 1, type: 'expense' },
				{ id: 2, amount: '20', description: 'Item 2', date: '2026-01-02', category_id: 1, type: 'expense' }
			];
			const resultAll = await listTransactions(12, {});
			expect(resultAll.page).toBe(1);
			expect(resultAll.totalPages).toBe(1);
			expect(resultAll.items).toHaveLength(2);
		});

		it('accepts date_from only for filtering >= date_from', async () => {
			selectRows = [{ count: 10 }];
			const result = await listTransactions(12, { date_from: '2026-01-01' }, 1, 20);
			expect(result.total).toBe(10);
			expect(calls.selects).toBe(2); // count query + data query
		});

		it('accepts date_to only for filtering <= date_to', async () => {
			selectRows = [{ count: 15 }];
			const result = await listTransactions(12, { date_to: '2026-03-31' }, 1, 20);
			expect(result.total).toBe(15);
		});

		it('accepts both date_from and date_to for inclusive range', async () => {
			selectRows = [{ count: 8 }];
			const result = await listTransactions(12, { date_from: '2026-01-01', date_to: '2026-03-31' }, 1, 20);
			expect(result.total).toBe(8);
		});
	});
});

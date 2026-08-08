import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { transactions, categories } from '$lib/database/schema';
import type { Transaction, TransactionType } from '$lib/types';

// Fixture DDL matching schema
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

let sequence = 1;

describe('transactions service — SQLite / raw query path (in-memory better-sqlite3)', () => {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	sqlite.exec(SQLITE_FIXTURE_SCHEMA);

	let listTransactions: typeof import('$lib/server/transactions').listTransactions;
	let getTransaction: typeof import('$lib/server/transactions').getTransaction;
	let getAllForBalance: typeof import('$lib/server/transactions').getAllForBalance;
	let createTransaction: typeof import('$lib/server/transactions').createTransaction;
	let updateTransaction: typeof import('$lib/server/transactions').updateTransaction;
	let deleteTransaction: typeof import('$lib/server/transactions').deleteTransaction;
	let deleteTransactions: typeof import('$lib/server/transactions').deleteTransactions;
	let getMonthlySummary: typeof import('$lib/server/transactions').getMonthlySummary;
	let getRecentTransactions: typeof import('$lib/server/transactions').getRecentTransactions;
	let getMonthlyReport: typeof import('$lib/server/transactions').getMonthlyReport;
	let getCategoryReport: typeof import('$lib/server/transactions').getCategoryReport;
	let searchTransactions: typeof import('$lib/server/transactions').searchTransactions;
	let getCategorySpending: typeof import('$lib/server/transactions').getCategorySpending;
	let getCategoryUsage: typeof import('$lib/server/transactions').getCategoryUsage;

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
				},
				withTransaction: async <T>(
					callback: (helpers: {
						queryOne: <U>(text: string, params?: unknown[]) => Promise<U | undefined>;
						queryMany: <U>(text: string, params?: unknown[]) => Promise<U[]>;
						execute: (text: string, params?: unknown[]) => Promise<void>;
					}) => Promise<T>
				): Promise<T> => {
					sqlite.exec('BEGIN');
					try {
						const helpers = {
							queryOne: async <U>(text: string, params: unknown[] = []): Promise<U | undefined> => {
								const { sql, paramIndices } = real.translatePgToSQLite(text);
								const stmt = sqlite.prepare(sql);
								const mapped = mapParams(paramIndices, params);
								return (mapped.length > 0 ? stmt.get(...mapped) : stmt.get()) as U | undefined;
							},
							queryMany: async <U>(text: string, params: unknown[] = []): Promise<U[]> => {
								const { sql, paramIndices } = real.translatePgToSQLite(text);
								const stmt = sqlite.prepare(sql);
								const mapped = mapParams(paramIndices, params);
								return (mapped.length > 0 ? stmt.all(...mapped) : stmt.all()) as U[];
							},
							execute: async (text: string, params: unknown[] = []): Promise<void> => {
								const { sql, paramIndices } = real.translatePgToSQLite(text);
								const stmt = sqlite.prepare(sql);
								const mapped = mapParams(paramIndices, params);
								if (mapped.length > 0) {
									stmt.run(...mapped);
								} else {
									stmt.run();
								}
							}
						};
						const result = await callback(helpers);
						sqlite.exec('COMMIT');
						return result;
					} catch (e) {
						sqlite.exec('ROLLBACK');
						throw e;
					}
				}
			};
		});

		vi.resetModules();
		const svc = await import('$lib/server/transactions');
		listTransactions = svc.listTransactions;
		getTransaction = svc.getTransaction;
		getAllForBalance = svc.getAllForBalance;
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
	});

	function createUser(username: string): number {
		sqlite.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, 'hash');
		const row = sqlite.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: number };
		return row.id;
	}

	function createCategory(userId: number, name: string, type: 'income' | 'expense' = 'expense'): number {
		sqlite.prepare('INSERT INTO categories (user_id, name, color, icon, type) VALUES (?, ?, ?, ?, ?)').run(userId, name, '#6366f1', '📁', type);
		const row = sqlite.prepare('SELECT id FROM categories WHERE user_id = ? AND name = ?').get(userId, name) as { id: number };
		return row.id;
	}

	function addTransaction(userId: number, amount: number, description: string, date: string, categoryId: number, type: TransactionType): number {
		sqlite.prepare('INSERT INTO transactions (user_id, amount, description, date, category_id, type) VALUES (?, ?, ?, ?, ?, ?)')
			.run(userId, amount, description, date, categoryId, type);
		const row = sqlite.prepare('SELECT id FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(userId) as { id: number };
		return row.id;
	}

	it('handles listing transactions with various filters, pagination, and sorting', async () => {
		const userA = createUser(`user_list_${sequence++}`);
		const catFood = createCategory(userA, 'Food & Dining', 'expense');
		const catSalary = createCategory(userA, 'Salary', 'income');

		// Seed transactions
		addTransaction(userA, 150, 'Grocery buy', '2026-08-01', catFood, 'expense');
		addTransaction(userA, 5000, 'Salary payday', '2026-08-02', catSalary, 'income');
		addTransaction(userA, 250, 'Restaurant dinner', '2026-08-03', catFood, 'expense');
		addTransaction(userA, 80, 'Coffee shop', '2026-08-04', catFood, 'expense');

		// 1. No filters: return all 4 items ordered by date DESC, id DESC
		const resAll = await listTransactions(userA);
		expect(resAll.total).toBe(4);
		expect(resAll.items).toHaveLength(4);
		expect(resAll.items[0].description).toBe('Coffee shop'); // 2026-08-04
		expect(resAll.items[1].description).toBe('Restaurant dinner'); // 2026-08-03
		expect(resAll.items[2].description).toBe('Salary payday'); // 2026-08-02
		expect(resAll.items[3].description).toBe('Grocery buy'); // 2026-08-01

		// Verify fields and types
		expect(resAll.items[0].amount).toBe(80);
		expect(typeof resAll.items[0].amount).toBe('number');
		expect(resAll.items[0].category_name).toBe('Food & Dining');
		expect(resAll.items[0].category_color).toBe('#6366f1');

		// 2. Type filter
		const resIncome = await listTransactions(userA, { type: 'income' });
		expect(resIncome.total).toBe(1);
		expect(resIncome.items[0].description).toBe('Salary payday');

		// 3. Category filter
		const resFood = await listTransactions(userA, { category_id: catFood });
		expect(resFood.total).toBe(3);

		// 4. Date range filter
		const resDates = await listTransactions(userA, { date_from: '2026-08-02', date_to: '2026-08-03' });
		expect(resDates.total).toBe(2);
		expect(resDates.items.map(i => i.description)).toContain('Salary payday');
		expect(resDates.items.map(i => i.description)).toContain('Restaurant dinner');

		// 5. Search filter (description or category name)
		const resSearchDesc = await listTransactions(userA, { search: 'Grocery' });
		expect(resSearchDesc.total).toBe(1);
		expect(resSearchDesc.items[0].description).toBe('Grocery buy');

		const resSearchCat = await listTransactions(userA, { search: 'Salary' });
		expect(resSearchCat.total).toBe(1);
		expect(resSearchCat.items[0].description).toBe('Salary payday');

		// 6. Pagination page 1 limit 2
		const resPag1 = await listTransactions(userA, {}, 1, 2);
		expect(resPag1.total).toBe(4);
		expect(resPag1.items).toHaveLength(2);
		expect(resPag1.items[0].description).toBe('Coffee shop');
		expect(resPag1.items[1].description).toBe('Restaurant dinner');

		// 7. Pagination page 2 limit 2
		const resPag2 = await listTransactions(userA, {}, 2, 2);
		expect(resPag2.items).toHaveLength(2);
		expect(resPag2.items[0].description).toBe('Salary payday');
		expect(resPag2.items[1].description).toBe('Grocery buy');

		// 8. Pagination page beyond total
		const resPagOut = await listTransactions(userA, {}, 5, 2);
		expect(resPagOut.items).toHaveLength(0);

		// 9. Limit clamping (>100)
		const resClamp = await listTransactions(userA, {}, 1, 250);
		// limit clamped to 100
		expect(resClamp.items).toHaveLength(4);

		// 10. Custom sorting
		const resSortAmountAsc = await listTransactions(userA, { sort: 'amount', order: 'asc' });
		expect(resSortAmountAsc.items[0].amount).toBe(80);
		expect(resSortAmountAsc.items[3].amount).toBe(5000);
	});

	it('handles getTransaction, returning null when wrong user or not found', async () => {
		const userA = createUser(`user_get_${sequence++}`);
		const userB = createUser(`user_get_${sequence++}`);
		const catA = createCategory(userA, 'Cat A');

		const txId = addTransaction(userA, 100, 'Tx A', '2026-08-01', catA, 'expense');

		// User A retrieves transaction: found
		const tFound = await getTransaction(userA, txId);
		expect(tFound).not.toBeNull();
		expect(tFound!.description).toBe('Tx A');
		expect(tFound!.amount).toBe(100);
		expect(tFound!.category_name).toBe('Cat A');

		// User B tries to retrieve A's transaction: null
		const tWrongUser = await getTransaction(userB, txId);
		expect(tWrongUser).toBeNull();

		// Nonexistent ID: null
		const tNone = await getTransaction(userA, 99999);
		expect(tNone).toBeNull();
	});

	it('handles getAllForBalance with ascending date order and user scoping', async () => {
		const userA = createUser(`user_bal_${sequence++}`);
		const userB = createUser(`user_bal_${sequence++}`);
		const catA = createCategory(userA, 'Cat A');
		const catB = createCategory(userB, 'Cat B');

		const id1 = addTransaction(userA, 100, 'Tx 1', '2026-08-03', catA, 'expense');
		const id2 = addTransaction(userA, 200, 'Tx 2', '2026-08-01', catA, 'expense');
		const id3 = addTransaction(userA, 50, 'Tx 3', '2026-08-02', catA, 'expense');
		// Add tie-breaker on date
		const id4 = addTransaction(userA, 300, 'Tx 4', '2026-08-02', catA, 'income');

		addTransaction(userB, 999, 'Tx B', '2026-08-01', catB, 'expense');

		const res = await getAllForBalance(userA);
		expect(res).toHaveLength(4);
		// Sorted by date ASC: Tx 2 (08-01) -> Tx 3 (08-02) -> Tx 4 (08-02, tie-breaker id ASC) -> Tx 1 (08-03)
		expect(res[0].id).toBe(id2);
		expect(res[1].id).toBe(id3);
		expect(res[2].id).toBe(id4);
		expect(res[3].id).toBe(id1);

		// Assert minimal fields are mapped
		expect(res[0].amount).toBe(200);
		expect(res[0].type).toBe('expense');
		expect(res[0].date).toBe('2026-08-01');
	});

	it('enforces validation and category ownership on createTransaction', async () => {
		const userA = createUser(`user_crud_c_${sequence++}`);
		const userB = createUser(`user_crud_c_${sequence++}`);
		const catA = createCategory(userA, 'Cat A');
		const catB = createCategory(userB, 'Cat B');

		// 1. Valid insert
		const txId = await createTransaction(userA, {
			type: 'expense',
			amount: 50,
			description: 'Valid tx',
			date: '2026-08-01',
			category_id: catA
		});
		expect(txId).toBeGreaterThan(0);

		// 2. Insert with invalid category (user doesn't own B's category)
		await expect(
			createTransaction(userA, {
				type: 'expense',
				amount: 50,
				description: 'Invalid cat',
				date: '2026-08-01',
				category_id: catB
			})
		).rejects.toThrow('Category not found');

		// 3. Validation rule check: amount is 0
		await expect(
			createTransaction(userA, {
				type: 'expense',
				amount: 0,
				description: 'Zero amount',
				date: '2026-08-01',
				category_id: catA
			})
		).rejects.toThrow();
	});

	it('enforces validation, transaction ownership, and category ownership on updateTransaction', async () => {
		const userA = createUser(`user_crud_u_${sequence++}`);
		const userB = createUser(`user_crud_u_${sequence++}`);
		const catA = createCategory(userA, 'Cat A');
		const catB = createCategory(userB, 'Cat B');

		const txId = addTransaction(userA, 100, 'Original', '2026-08-01', catA, 'expense');

		// 1. Valid update
		const updated = await updateTransaction(userA, txId, {
			description: 'Updated description',
			amount: 150
		});
		expect(updated).toBe(true);

		const after = await getTransaction(userA, txId);
		expect(after!.description).toBe('Updated description');
		expect(after!.amount).toBe(150);

		// 2. Update with category from another user (fails)
		await expect(
			updateTransaction(userA, txId, {
				category_id: catB
			})
		).rejects.toThrow('Category not found');

		// 3. Update another user's transaction (returns false)
		const updatedOther = await updateTransaction(userB, txId, {
			description: 'Hijacked'
		});
		expect(updatedOther).toBe(false);
	});

	it('handles deleteTransaction correctly', async () => {
		const userA = createUser(`user_crud_d_${sequence++}`);
		const userB = createUser(`user_crud_d_${sequence++}`);
		const catA = createCategory(userA, 'Cat A');

		const txId = addTransaction(userA, 100, 'To Delete', '2026-08-01', catA, 'expense');

		// B tries to delete A's: returns false
		const deletedB = await deleteTransaction(userB, txId);
		expect(deletedB).toBe(false);
		expect(await getTransaction(userA, txId)).not.toBeNull();

		// A deletes A's: returns true
		const deletedA = await deleteTransaction(userA, txId);
		expect(deletedA).toBe(true);
		expect(await getTransaction(userA, txId)).toBeNull();
	});

	it('handles deleteTransactions bulk delete atomically and safely', async () => {
		const userA = createUser(`user_bulk_${sequence++}`);
		const userB = createUser(`user_bulk_${sequence++}`);
		const catA = createCategory(userA, 'Cat A');
		const catB = createCategory(userB, 'Cat B');

		const id1 = addTransaction(userA, 10, 'A1', '2026-08-01', catA, 'expense');
		const id2 = addTransaction(userA, 20, 'A2', '2026-08-02', catA, 'expense');
		const idB = addTransaction(userB, 30, 'B1', '2026-08-03', catB, 'expense');

		// Empty IDs list: returns 0
		const delEmpty = await deleteTransactions(userA, []);
		expect(delEmpty).toBe(0);

		// User A deletes id1, id2, and idB: deletes only A1 and A2 (returns 2)
		const delCount = await deleteTransactions(userA, [id1, id2, idB]);
		expect(delCount).toBe(2);

		// Verify A's are deleted, B's is not
		expect(await getTransaction(userA, id1)).toBeNull();
		expect(await getTransaction(userA, id2)).toBeNull();
		expect(await getTransaction(userB, idB)).not.toBeNull();
	});

	it('handles getMonthlySummary correctly', async () => {
		const userA = createUser(`user_ms_${sequence++}`);
		const catA = createCategory(userA, 'Cat A');

		addTransaction(userA, 100, 'T1', '2026-08-01', catA, 'income');
		addTransaction(userA, 50, 'T2', '2026-08-15', catA, 'expense');
		addTransaction(userA, 20, 'T3', '2026-08-31', catA, 'expense');
		addTransaction(userA, 300, 'T4', '2026-09-01', catA, 'income'); // other month

		const summary = await getMonthlySummary(userA, '2026-08');
		expect(summary.totalIncome).toBe(100);
		expect(summary.totalExpenses).toBe(70);
	});

	it('handles getRecentTransactions correctly without count queries', async () => {
		const userA = createUser(`user_rt_${sequence++}`);
		const catA = createCategory(userA, 'Cat A');

		addTransaction(userA, 10, 'T1', '2026-08-01', catA, 'expense');
		addTransaction(userA, 20, 'T2', '2026-08-02', catA, 'expense');
		addTransaction(userA, 30, 'T3', '2026-08-03', catA, 'expense');

		const recent = await getRecentTransactions(userA, 2);
		expect(recent).toHaveLength(2);
		expect(recent[0].description).toBe('T3'); // date DESC
		expect(recent[1].description).toBe('T2');
	});

	it('handles getMonthlyReport correctly', async () => {
		const userA = createUser(`user_mr_${sequence++}`);
		const catA = createCategory(userA, 'Cat A');

		addTransaction(userA, 100, 'T1', '2026-08-01', catA, 'income');
		addTransaction(userA, 50, 'T2', '2026-08-15', catA, 'expense');
		addTransaction(userA, 300, 'T3', '2027-08-01', catA, 'income'); // other year

		const report = await getMonthlyReport(userA, 2026);
		expect(report).toHaveLength(1);
		expect(report[0].month).toBe('2026-08');
		expect(report[0].income).toBe(100);
		expect(report[0].expense).toBe(50);
	});

	it('handles getCategoryReport correctly', async () => {
		const userA = createUser(`user_cr_${sequence++}`);
		const catA = createCategory(userA, 'Food');
		const catB = createCategory(userA, 'Utilities');

		addTransaction(userA, 100, 'T1', '2026-08-01', catA, 'expense');
		addTransaction(userA, 200, 'T2', '2026-08-02', catB, 'expense');
		addTransaction(userA, 300, 'T3', '2026-08-03', catA, 'expense');

		const report = await getCategoryReport(userA, '2026-08', 'expense');
		expect(report).toHaveLength(2);
		// Sorted by total DESC: catA total is 400, catB total is 200
		expect(report[0].category_name).toBe('Food');
		expect(report[0].total).toBe(400);
		expect(report[1].category_name).toBe('Utilities');
		expect(report[1].total).toBe(200);
	});

	it('handles searchTransactions correctly', async () => {
		const userA = createUser(`user_st_${sequence++}`);
		const catA = createCategory(userA, 'Food');
		addTransaction(userA, 250, 'Walmart grocery buy', '2026-08-01', catA, 'expense');

		const results = await searchTransactions(userA, 'walmart');
		expect(results).toHaveLength(1);
		expect(results[0].description).toBe('Walmart grocery buy');
	});

	it('handles getCategorySpending correctly', async () => {
		const userA = createUser(`user_cs_${sequence++}`);
		const catA = createCategory(userA, 'Food');

		addTransaction(userA, 150, 'T1', '2026-08-01', catA, 'income');
		addTransaction(userA, 50, 'T2', '2026-08-15', catA, 'expense');

		const spending = await getCategorySpending(userA, '2026-08');
		expect(spending).toHaveLength(1);
		expect(spending[0].category_id).toBe(catA);
		expect(spending[0].income).toBe(150);
		expect(spending[0].expense).toBe(50);
	});

	it('handles getCategoryUsage correctly', async () => {
		const userA = createUser(`user_cu_${sequence++}`);
		const catA = createCategory(userA, 'Food');

		addTransaction(userA, 150, 'T1', '2026-08-01', catA, 'income');

		const usage = await getCategoryUsage(userA);
		expect(usage).toHaveLength(1);
		expect(usage[0].category_id).toBe(catA);
		expect(usage[0].cnt).toBe(1);
		expect(usage[0].last_used).toBe('2026-08-01');
	});
});

describe('transactions service — Drizzle / Postgres path (recorded fake client)', () => {
	let listTransactions: typeof import('$lib/server/transactions').listTransactions;
	let getTransaction: typeof import('$lib/server/transactions').getTransaction;
	let getAllForBalance: typeof import('$lib/server/transactions').getAllForBalance;
	let createTransaction: typeof import('$lib/server/transactions').createTransaction;
	let updateTransaction: typeof import('$lib/server/transactions').updateTransaction;
	let deleteTransaction: typeof import('$lib/server/transactions').deleteTransaction;
	let deleteTransactions: typeof import('$lib/server/transactions').deleteTransactions;
	let getMonthlySummary: typeof import('$lib/server/transactions').getMonthlySummary;
	let getRecentTransactions: typeof import('$lib/server/transactions').getRecentTransactions;
	let getMonthlyReport: typeof import('$lib/server/transactions').getMonthlyReport;
	let getCategoryReport: typeof import('$lib/server/transactions').getCategoryReport;
	let searchTransactions: typeof import('$lib/server/transactions').searchTransactions;
	let getCategorySpending: typeof import('$lib/server/transactions').getCategorySpending;
	let getCategoryUsage: typeof import('$lib/server/transactions').getCategoryUsage;

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
		vi.doMock('$lib/database', () => ({
			usePostgres: true,
			getPgPool: () => Promise.reject(new Error('getPgPool should not be called')),
			getSQLiteDb: () => Promise.reject(new Error('getSQLiteDb should not be called')),
			initDb: async () => {},
			closeDb: async () => {}
		}));

		vi.doMock('$lib/database/drizzle', () => ({
			getDrizzle: () => Promise.resolve(fakeDb() as any)
		}));

		vi.resetModules();
		const svc = await import('$lib/server/transactions');
		listTransactions = svc.listTransactions;
		getTransaction = svc.getTransaction;
		getAllForBalance = svc.getAllForBalance;
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
});

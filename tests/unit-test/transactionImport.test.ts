import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// Drizzle `pgTable` objects expose their name under this internal symbol, not
// `.name`. The fake client uses it so inserts/selects are recorded with the
// real table name ('transactions' / 'categories').
const TABLE_NAME = Symbol.for('drizzle:Name');

// Recursively collect primitive param values from a Drizzle SQL expression
// (e.g. `eq(transactions.user_id, 42)` → contains 42) so the test can assert
// the SELECT is scoped to the right user without a live database.
function collectParamValues(node: unknown, out: (number | string)[] = []): (number | string)[] {
	if (node == null) return out;
	if (Array.isArray(node)) {
		for (const n of node) collectParamValues(n, out);
		return out;
	}
	if (typeof node === 'object') {
		const obj = node as Record<string, unknown>;
		if (typeof obj.value === 'number' || typeof obj.value === 'string') out.push(obj.value);
		for (const k of Object.keys(obj)) {
			if (['encoder', 'decoder', 'usedTables', 'table', 'columns', 'mapTo', 'mapFrom'].includes(k)) continue;
			collectParamValues(obj[k], out);
		}
	}
	return out;
}

function tableNameOf(table: unknown): string {
	return (table as Record<symbol, string> | undefined)?.[TABLE_NAME] ?? 'unknown';
}

// Drizzle's `sql` template inlines primitive params (this version) as raw
// strings in queryChunks rather than as `.value` objects, so find them by
// scanning the expression tree for the bare string. Cycle-safe: encoder /
// decoder graphs are not traversed.
function containsRawString(node: unknown, needle: string): boolean {
	if (node === needle) return true;
	if (Array.isArray(node)) return node.some(n => containsRawString(n, needle));
	if (typeof node === 'object' && node !== null) {
		for (const k of Object.keys(node)) {
			if (['encoder', 'decoder', 'usedTables', 'table', 'columns', 'mapTo', 'mapFrom'].includes(k)) continue;
			if (containsRawString((node as Record<string, unknown>)[k], needle)) return true;
		}
	}
	return false;
}

describe('transactionImport — Drizzle / Postgres path (recorded fake client)', () => {
	let importTransactionsForUser: typeof import('$lib/server/services/transactionImport').importTransactionsForUser;
	let calls: {
		selects: { table: string; cols: string[] }[]; // global db.select
		wheres: { table: string; args: unknown[] }[]; // global db.where
		inserts: { table: string; values: Record<string, unknown> }[]; // global db.insert — global writes
		txSelects: { table: string; cols: string[] }[]; // tx.select — inside db.transaction
		txWheres: { table: string; args: unknown[] }[]; // tx.where
		txInserts: { table: string; values: Record<string, unknown> }[]; // tx.insert
		transactions: number; // db.transaction calls
	};

	// Fake client where `.where()` is BOTH chainable (`.limit(n)`) AND thenable —
	// the service needs the thenable form for the dedup SELECT and the `.limit(1)`
	// form for per-row category lookups / ownership checks.
	function makeQueryClient(opts: {
		whereResult: unknown[];
		select?: (table: string, cols: string[]) => void;
		where?: (table: string, args: unknown[]) => void;
		insert?: (table: string, values: Record<string, unknown>) => void;
	}) {
		const select = opts.select ?? (() => {});
		const whereCb = opts.where ?? (() => {});
		const insert = opts.insert ?? (() => {});
		return {
			select(cols?: Record<string, unknown>) {
				const colNames = cols ? Object.keys(cols) : [];
				return {
					from(table: unknown) {
						const tableName = tableNameOf(table);
						select(tableName, colNames);
						return {
							where(...args: unknown[]) {
								whereCb(tableName, args);
								return {
									limit(n: number) {
										return Promise.resolve(opts.whereResult.slice(0, n));
									},
									then(onFulfilled: any, onRejected: any) {
										return Promise.resolve(opts.whereResult).then(onFulfilled, onRejected);
									}
								};
							}
						};
					}
				};
			},
			insert(table: unknown) {
				const tableName = tableNameOf(table);
				return {
					values(values: Record<string, unknown>) {
						insert(tableName, values);
						return {
							returning() {
								return Promise.resolve([{ id: 1 }]);
							}
						};
					}
				};
			}
		};
	}

	function fakeDb() {
		// The global `db` (dedup SELECT only) and the `tx` handed to the
		// db.transaction callback (every category lookup + insert) are separate
		// clients, so the structural test can prove no global DB writes happen
		// inside the transaction. The tx resolves every category lookup/ownership
		// check to { id: 1 }; the global db resolves the dedup SELECT to [].
		const db = makeQueryClient({
			whereResult: [],
			select: (table, cols) => { calls.selects.push({ table, cols }); },
			where: (table, args) => { calls.wheres.push({ table, args }); },
			insert: (table, values) => { calls.inserts.push({ table, values }); }
		});
		const tx = makeQueryClient({
			whereResult: [{ id: 1 }],
			select: (table, cols) => { calls.txSelects.push({ table, cols }); },
			where: (table, args) => { calls.txWheres.push({ table, args }); },
			insert: (table, values) => { calls.txInserts.push({ table, values }); }
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
		vi.doMock('$lib/server/db', () => ({
			getPgPool: () => Promise.reject(new Error('getPgPool should not be called on Drizzle path')),
			initDb: async () => {},
			closeDb: async () => {}
		}));
		vi.doMock('$lib/server/db/drizzle', () => ({
			getDrizzle: () => Promise.resolve(fakeDb())
		}));
		// Pre-flight user-category snapshot. queryOne/execute/withTransaction must
		// never run on the Drizzle path — the write phase is tx-only.
		vi.doMock('$lib/server/db/query', () => ({
			queryOne: async () => { throw new Error('queryOne should not be called on Drizzle path'); },
			queryMany: async <T>(): Promise<T[]> => [
				{ id: 1, name: 'Food', type: 'expense' },
				{ id: 2, name: 'Transport', type: 'expense' }
			] as T[],
			execute: async () => { throw new Error('execute should not be called on Drizzle path'); },
			withTransaction: async () => { throw new Error('withTransaction should not be called on Drizzle path'); }
		}));

		vi.resetModules();
		const svc = await import('$lib/server/services/transactionImport');
		importTransactionsForUser = svc.importTransactionsForUser;
	});

	beforeEach(() => {
		calls = {
			selects: [],
			wheres: [],
			inserts: [],
			txSelects: [],
			txWheres: [],
			txInserts: [],
			transactions: 0
		};
	});

	const CONFIG = JSON.stringify({ typeRule: 'column' });

	function csv(headers: string, ...rows: string[]): File {
		return new File([[headers, ...rows].join('\n')], 'import.csv', { type: 'text/csv' });
	}

	it('queries existing transactions for duplicate detection scoped to the user, before the transaction', async () => {
		const file = csv('Date,Description,Amount,Type,Category',
			'2026-08-01,Groceries,50,expense,Food');
		const result = await importTransactionsForUser(42, file, CONFIG) as any;

		expect(result.success).toBe(true);
		expect(result.imported).toBe(1);
		// Exactly ONE global SELECT — the dedup lookup — on transactions, with a
		// WHERE filter carrying the user id.
		expect(calls.selects).toHaveLength(1);
		expect(calls.selects[0]!.table).toBe('transactions');
		expect(calls.selects[0]!.cols).toContain('date');
		expect(calls.selects[0]!.cols).toContain('amount');
		expect(calls.selects[0]!.cols).toContain('description');
		expect(calls.selects[0]!.cols).toContain('category_id');
		expect(calls.wheres).toHaveLength(1);
		expect(calls.wheres[0]!.table).toBe('transactions');
		const params = collectParamValues(calls.wheres[0]!.args[0]);
		expect(params).toContain(42);
	});

	it('wraps the entire import in one db.transaction and uses tx for every write', async () => {
		const file = csv('Date,Description,Amount,Type,Category',
			'2026-08-01,Groceries,50,expense,Food',
			'2026-08-02,Bus fare,20,expense,Transport');
		const result = await importTransactionsForUser(42, file, CONFIG) as any;

		expect(result.success).toBe(true);
		expect(result.imported).toBe(2);
		// Exactly ONE transaction wraps the whole import.
		expect(calls.transactions).toBe(1);
		// Every insert ran through the tx client — one per imported row.
		expect(calls.txInserts).toHaveLength(2);
		expect(calls.txInserts.every(i => i.table === 'transactions')).toBe(true);
		expect(calls.txInserts[0]!.values.user_id).toBe(42);
		// numeric column stored as string per schema
		expect(calls.txInserts[0]!.values.amount).toBe('50');
		expect(calls.txInserts[0]!.values.category_id).toBe(1);
		expect(calls.txInserts[0]!.values.description).toBe('Groceries');
		expect(calls.txInserts[0]!.values.type).toBe('expense');
		// Per-row category name lookups AND ownership checks also ran via tx.
		expect(calls.txSelects.length).toBeGreaterThanOrEqual(4);
		expect(calls.txSelects.every(s => s.table === 'categories')).toBe(true);
		// The per-row name lookup WHERE carries the user id and the normalized
		// name (the name is inlined as a raw string chunk in this drizzle
		// version — see containsRawString; user id is captured by collectParamValues).
		const firstLookupParams = collectParamValues(calls.txWheres[0]!.args[0]);
		expect(firstLookupParams).toContain(42);
		expect(containsRawString(calls.txWheres[0]!.args[0], 'food')).toBe(true);
		// No global DB writes happened inside the transaction.
		expect(calls.inserts).toHaveLength(0);
		// The dedup SELECT still ran on the global db, before the transaction.
		expect(calls.selects).toHaveLength(1);
	});

	it('imports a Source of Funds column into the tx insert', async () => {
		const file = csv('Date,Description,Amount,Type,Category,Source of Funds',
			"2026-08-01,Groceries,50,expense,Food,Mother's Money");
		const result = await importTransactionsForUser(42, file, CONFIG) as any;

		expect(result.success).toBe(true);
		expect(result.imported).toBe(1);
		expect(calls.txInserts).toHaveLength(1);
		expect(calls.txInserts[0]!.values.source_of_funds).toBe("Mother's Money");
	});

	it('imports rows without a Source of Funds column as NULL (never auto-assigns)', async () => {
		const file = csv('Date,Description,Amount,Type,Category',
			'2026-08-01,Groceries,50,expense,Food');
		const result = await importTransactionsForUser(42, file, CONFIG) as any;

		expect(result.success).toBe(true);
		expect(result.imported).toBe(1);
		expect(calls.txInserts).toHaveLength(1);
		expect(calls.txInserts[0]!.values.source_of_funds).toBeNull();
	});
});

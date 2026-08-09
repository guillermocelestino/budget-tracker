import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

let sequence = 0;

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
  type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

describe('transactionImport — SQLite / raw query path (in-memory better-sqlite3)', () => {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	sqlite.exec(SQLITE_FIXTURE_SCHEMA);

	let importTransactionsForUser: typeof import('$lib/server/transactionImport').importTransactionsForUser;

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
		const svc = await import('$lib/server/transactionImport');
		importTransactionsForUser = svc.importTransactionsForUser;
	});

	beforeEach(() => {
		sqlite.exec('DELETE FROM transactions; DELETE FROM categories; DELETE FROM users;');
	});

	function createUser(): number {
		const username = `user_${sequence++}`;
		sqlite.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, 'hash');
		const row = sqlite.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: number };
		return row.id;
	}

	function createCategory(userId: number, name: string, type = 'expense'): void {
		sqlite.prepare('INSERT INTO categories (user_id, name, color, icon, type) VALUES (?, ?, ?, ?, ?)').run(userId, name, '#6366f1', '📁', type);
	}

	function countTransactions(userId: number): number {
		const row = sqlite.prepare('SELECT COUNT(*) as c FROM transactions WHERE user_id = ?').get(userId) as { c: number };
		return row.c;
	}

	function csv(headers: string, ...rows: string[]): File {
		return new File([[headers, ...rows].join('\n')], 'import.csv', { type: 'text/csv' });
	}

	// Explicit Type column + typeRule 'column' so the derived type is
	// deterministic regardless of amount sign.
	const CONFIG = JSON.stringify({ typeRule: 'column' });

	it('imports valid rows into transactions and returns correct statistics', async () => {
		const userId = createUser();
		createCategory(userId, 'Food');
		createCategory(userId, 'Transport');
		createCategory(userId, 'Salary', 'income');

		const file = csv('Date,Description,Amount,Type,Category',
			'2026-08-01,Groceries,50,expense,Food',
			'2026-08-02,Bus fare,20,expense,Transport',
			'2026-08-03,Paycheck,1000,income,Salary');

		const result = await importTransactionsForUser(userId, file, CONFIG) as any;

		expect(result.success).toBe(true);
		expect(result.imported).toBe(3);
		expect(result.total).toBe(3);
		expect(result.skippedDuplicates).toBe(0);
		expect(result.skippedInvalid).toBe(0);
		expect(countTransactions(userId)).toBe(3);

		const rows = sqlite.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY date').all(userId) as Record<string, unknown>[];
		expect(rows[0]!.description).toBe('Groceries');
		expect(rows[0]!.amount).toBe(50);
		expect(rows[0]!.type).toBe('expense');
		expect(rows[1]!.description).toBe('Bus fare');
		expect(rows[2]!.description).toBe('Paycheck');
		expect(rows[2]!.amount).toBe(1000);
		expect(rows[2]!.type).toBe('income');
	});

	it('isolates data by user_id', async () => {
		const userA = createUser();
		const userB = createUser();
		createCategory(userA, 'Food');
		createCategory(userB, 'Food');

		const fileA = csv('Date,Description,Amount,Type,Category',
			'2026-08-01,Groceries,50,expense,Food');
		const fileB = csv('Date,Description,Amount,Type,Category',
			'2026-08-01,Groceries,50,expense,Food');

		await importTransactionsForUser(userA, fileA, CONFIG) as any;
		await importTransactionsForUser(userB, fileB, CONFIG) as any;

		expect(countTransactions(userA)).toBe(1);
		expect(countTransactions(userB)).toBe(1);
	});

	it('soft-skips a missing category while other valid rows still commit', async () => {
		const userId = createUser();
		createCategory(userId, 'Food');
		createCategory(userId, 'Transport');

		// Validation and the per-row category lookup both normalize names via
		// LOWER(TRIM(...)), so the per-row "Category not found" branch is only
		// reachable through a race: a category that exists at validation time is
		// gone by the time its row reaches the write loop. Simulate that race
		// deterministically: after the FIRST row's insert, rename the 'Food'
		// category so the second row's in-transaction lookup misses. (Renaming
		// — not deleting — keeps the FK RESTRICT on the already-inserted row.)
		sqlite.exec(`
			CREATE TRIGGER simulate_category_removed
			BEFORE INSERT ON transactions
			WHEN NEW.description = 'Groceries'
			BEGIN
				UPDATE categories SET name = 'Renamed Away' WHERE user_id = ${userId} AND name = 'Food';
			END
		`);
		try {
			const file = csv('Date,Description,Amount,Type,Category',
				'2026-08-01,Groceries,50,expense,Food',
				'2026-08-02,Lunch,30,expense,Food',
				'2026-08-03,Bus fare,20,expense,Transport');

			const result = await importTransactionsForUser(userId, file, CONFIG) as any;

			expect(result.success).toBe(true);
			expect(result.imported).toBe(2); // Groceries + Bus fare commit
			expect(result.total).toBe(3);
			expect(result.skippedInvalid).toBe(0);
			expect(result.skippedDuplicates).toBe(0);
			expect(countTransactions(userId)).toBe(2);

			const descriptions = (sqlite.prepare('SELECT description FROM transactions WHERE user_id = ?').all(userId) as { description: string }[])
				.map(r => r.description);
			expect(descriptions).toContain('Groceries');
			expect(descriptions).toContain('Bus fare');
			expect(descriptions).not.toContain('Lunch');
			// The soft-skip is reported in details — not a hard failure. The
			// category name in the message is the normalized (lowercased) form,
			// exactly as the previous route reported it.
			expect(result.details).toContain('Row 2: Category "food" not found');
		} finally {
			sqlite.exec('DROP TRIGGER IF EXISTS simulate_category_removed');
		}
	});

	it('ROLLs BACK the entire import when a later row fails — zero imported rows remain, connection usable', async () => {
		const userId = createUser();
		createCategory(userId, 'Food');

		// Row 2's transaction INSERT is forced to fail after row 1 already
		// inserted inside the same transaction.
		sqlite.exec(`
			CREATE TRIGGER block_import_row_2
			BEFORE INSERT ON transactions
			WHEN NEW.description = 'Second'
			BEGIN
				SELECT RAISE(ABORT, 'forced row 2 failure');
			END
		`);
		try {
			const file = csv('Date,Description,Amount,Type,Category',
				'2026-08-01,First,50,expense,Food',
				'2026-08-02,Second,100,expense,Food');

			await expect(importTransactionsForUser(userId, file, CONFIG)).rejects.toThrow('forced row 2 failure');

			// Nothing from the failed import persisted — not even row 1.
			expect(countTransactions(userId)).toBe(0);
		} finally {
			sqlite.exec('DROP TRIGGER IF EXISTS block_import_row_2');
		}

		// The connection is usable after the rollback — a clean import commits.
		const retryFile = csv('Date,Description,Amount,Type,Category',
			'2026-08-03,Retry,10,expense,Food');
		const retry = await importTransactionsForUser(userId, retryFile, CONFIG) as any;
		expect(retry.success).toBe(true);
		expect(retry.imported).toBe(1);
		expect(countTransactions(userId)).toBe(1);
	});
});

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
	let importTransactionsForUser: typeof import('$lib/server/transactionImport').importTransactionsForUser;
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
		// Pre-flight user-category snapshot. queryOne/execute/withTransaction must
		// never run on the Drizzle path — the write phase is tx-only.
		vi.doMock('$lib/database/query', () => ({
			queryOne: async () => { throw new Error('queryOne should not be called on Drizzle path'); },
			queryMany: async <T>(): Promise<T[]> => [
				{ id: 1, name: 'Food', type: 'expense' },
				{ id: 2, name: 'Transport', type: 'expense' }
			] as T[],
			execute: async () => { throw new Error('execute should not be called on Drizzle path'); },
			withTransaction: async () => { throw new Error('withTransaction should not be called on Drizzle path'); }
		}));

		vi.resetModules();
		const svc = await import('$lib/server/transactionImport');
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
});

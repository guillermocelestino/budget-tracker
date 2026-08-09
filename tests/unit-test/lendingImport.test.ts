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
CREATE TABLE lendings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  borrower_name TEXT NOT NULL,
  amount REAL NOT NULL,
  interest_rate REAL DEFAULT 0,
  date_lent TEXT NOT NULL,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  direction TEXT NOT NULL DEFAULT 'lent',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE lending_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lending_id INTEGER NOT NULL REFERENCES lendings(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  payment_date TEXT NOT NULL,
  notes TEXT,
  transaction_id INTEGER,
  payment_type TEXT NOT NULL DEFAULT 'payment',
  reference TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

describe('lendingImport — SQLite / raw query path (in-memory better-sqlite3)', () => {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	sqlite.exec(SQLITE_FIXTURE_SCHEMA);

	let importLendingsForUser: typeof import('$lib/server/lendingImport').importLendingsForUser;

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
		const svc = await import('$lib/server/lendingImport');
		importLendingsForUser = svc.importLendingsForUser;
	});

	function createUser(): number {
		const username = `user_${sequence++}`;
		sqlite.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, 'hash');
		const row = sqlite.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: number };
		return row.id;
	}

	function createLending(userId: number, borrowerName: string, amount: number, dateLent: string) {
		sqlite.prepare('INSERT INTO lendings (user_id, borrower_name, amount, date_lent, direction, status) VALUES (?, ?, ?, ?, ?, ?)').run(userId, borrowerName, amount, dateLent, 'lent', 'active');
	}

	function getLendings(userId: number) {
		return sqlite.prepare('SELECT * FROM lendings WHERE user_id = ?').all(userId) as Record<string, unknown>[];
	}

	function getPayments(lendingId: number) {
		return sqlite.prepare('SELECT * FROM lending_payments WHERE lending_id = ?').all(lendingId) as Record<string, unknown>[];
	}

	it('imports valid rows and returns correct statistics', async () => {
		const userId = createUser();
		const csv = `Person,Amount,Date Lent,Notes,Status\nAlice,1000,2026-08-01,Test,active\nBob,2000,2026-08-02,Test2,active`;
		const file = new File([csv], 'import.csv', { type: 'text/csv' });
		const result = await importLendingsForUser(userId, file, '{}', 'lent') as any;

		expect(result.success).toBe(true);
		expect(result.imported).toBe(2);
		expect(result.total).toBe(2);
		expect(result.skippedDuplicates).toBe(0);
		expect(result.skippedInvalid).toBe(0);
		expect(result.newPeople).toHaveLength(2);
		const lendings = getLendings(userId);
		expect(lendings).toHaveLength(2);
	});

	it('skips duplicate rows', async () => {
		const userId = createUser();
		createLending(userId, 'Alice', 1000, '2026-08-01');
		const csv = `Person,Amount,Date Lent,Notes,Status\nAlice,1000,2026-08-01,Test,active`;
		const file = new File([csv], 'import.csv', { type: 'text/csv' });
		const result = await importLendingsForUser(userId, file, '{}', 'lent') as any;

		expect(result.success).toBe(true);
		expect(result.imported).toBe(0);
		expect(result.skippedDuplicates).toBe(1);
		const lendings = getLendings(userId);
		expect(lendings).toHaveLength(1);
	});

	it('creates lending_payment when recovered_amount > 0', async () => {
		const userId = createUser();
		const csv = `Person,Amount,Date Lent,Amount Recovered,Notes,Status\nAlice,1000,2026-08-01,500,Test,active`;
		const file = new File([csv], 'import.csv', { type: 'text/csv' });
		const result = await importLendingsForUser(userId, file, '{}', 'lent') as any;

		expect(result.success).toBe(true);
		expect(result.imported).toBe(1);
		const lendings = getLendings(userId);
		expect(lendings).toHaveLength(1);
		const payments = getPayments(lendings[0]!.id as number);
		expect(payments).toHaveLength(1);
		expect(payments[0]!.amount).toBe(500);
		expect(payments[0]!.payment_date).toBe('2026-08-01');
		expect(payments[0]!.notes).toBe('Imported');
	});

	it('does not create lending_payment when recovered_amount = 0', async () => {
		const userId = createUser();
		const csv = `Person,Amount,Date Lent,Notes,Status\nAlice,1000,2026-08-01,Test,active`;
		const file = new File([csv], 'import.csv', { type: 'text/csv' });
		const result = await importLendingsForUser(userId, file, '{}', 'lent') as any;

		expect(result.success).toBe(true);
		expect(result.imported).toBe(1);
		const lendings = getLendings(userId);
		expect(lendings).toHaveLength(1);
		const payments = getPayments(lendings[0]!.id as number);
		expect(payments).toHaveLength(0);
	});

	it('isolates data by user_id', async () => {
		const userA = createUser();
		const userB = createUser();
		const csvA = `Person,Amount,Date Lent,Notes,Status\nAlice,1000,2026-08-01,Test,active`;
		const csvB = `Person,Amount,Date Lent,Notes,Status\nBob,2000,2026-08-02,Test2,active`;
		const fileA = new File([csvA], 'importA.csv', { type: 'text/csv' });
		const fileB = new File([csvB], 'importB.csv', { type: 'text/csv' });
		await importLendingsForUser(userA, fileA, '{}', 'lent') as any;
		await importLendingsForUser(userB, fileB, '{}', 'lent') as any;

		expect(getLendings(userA)).toHaveLength(1);
		expect(getLendings(userB)).toHaveLength(1);
		expect(getLendings(userA)[0]!.borrower_name).toBe('Alice');
		expect(getLendings(userB)[0]!.borrower_name).toBe('Bob');
	});

	it('returns empty import when validRows is empty', async () => {
		const userId = createUser();
		const csv = `Person,Amount,Date Lent,Notes,Status\nAlice,invalid,2026-08-01,Test,active`;
		const file = new File([csv], 'import.csv', { type: 'text/csv' });
		const result = await importLendingsForUser(userId, file, '{}', 'lent') as any;

		// fail(400, { error, details }) → { status: 400, data: { error, details } }
		expect(result.status).toBe(400);
		expect(result.data.error).toContain('Validation failed');
	});

	it('preserves date values correctly', async () => {
		const userId = createUser();
		const csv = `Person,Amount,Date Lent,Due Date,Notes,Status\nAlice,1000,2026-08-15,2026-12-31,Test,active`;
		const file = new File([csv], 'import.csv', { type: 'text/csv' });
		const result = await importLendingsForUser(userId, file, '{}', 'lent') as any;

		expect(result.success).toBe(true);
		const lendings = getLendings(userId);
		expect(lendings[0]!.date_lent).toBe('2026-08-15');
		expect(lendings[0]!.due_date).toBe('2026-12-31');
	});

	it('ROLLs BACK the entire import when a later row fails — no partial records persist', async () => {
		const userId = createUser();
		// Row 2's lending INSERT is forced to fail after row 1 already inserted.
		sqlite.exec(`
			CREATE TRIGGER block_import_row_2
			BEFORE INSERT ON lendings
			WHEN NEW.borrower_name = 'Bob'
			BEGIN
				SELECT RAISE(ABORT, 'forced row 2 failure');
			END
		`);
		try {
			const csv = `Person,Amount,Date Lent,Notes,Status\nAlice,1000,2026-08-01,Test,active\nBob,2000,2026-08-02,Test2,active`;
			const file = new File([csv], 'import.csv', { type: 'text/csv' });
			await expect(importLendingsForUser(userId, file, '{}', 'lent')).rejects.toThrow('forced row 2 failure');

			// Nothing from the failed import persisted — not even row 1's lending.
			expect(getLendings(userId)).toHaveLength(0);
			const payments = sqlite
				.prepare('SELECT COUNT(*) as c FROM lending_payments WHERE user_id = ?')
				.get(userId) as { c: number };
			expect(payments.c).toBe(0);
		} finally {
			sqlite.exec('DROP TRIGGER IF EXISTS block_import_row_2');
		}

		// The connection is usable after the rollback — a clean import commits.
		const retryCsv = `Person,Amount,Date Lent,Notes,Status\nCarol,3000,2026-08-03,Test3,active`;
		const retryFile = new File([retryCsv], 'retry.csv', { type: 'text/csv' });
		const retry = await importLendingsForUser(userId, retryFile, '{}', 'lent') as any;
		expect(retry.success).toBe(true);
		expect(retry.imported).toBe(1);
		expect(getLendings(userId)).toHaveLength(1);
	});

	it('ROLLs BACK the lending when its recovered payment fails — no orphan lending', async () => {
		const userId = createUser();
		// The payment INSERT fails after the lending was inserted in the same row.
		sqlite.exec(`
			CREATE TRIGGER block_import_payment
			BEFORE INSERT ON lending_payments
			BEGIN
				SELECT RAISE(ABORT, 'forced payment failure');
			END
		`);
		try {
			const csv = `Person,Amount,Date Lent,Amount Recovered,Notes,Status\nAlice,1000,2026-08-01,500,Test,active`;
			const file = new File([csv], 'import.csv', { type: 'text/csv' });
			await expect(importLendingsForUser(userId, file, '{}', 'lent')).rejects.toThrow('forced payment failure');

			// The lending inserted earlier in the same transaction is gone too.
			expect(getLendings(userId)).toHaveLength(0);
			const payments = sqlite
				.prepare('SELECT COUNT(*) as c FROM lending_payments WHERE user_id = ?')
				.get(userId) as { c: number };
			expect(payments.c).toBe(0);
		} finally {
			sqlite.exec('DROP TRIGGER IF EXISTS block_import_payment');
		}
	});
});

// Drizzle `pgTable` objects expose their name under this internal symbol, not
// `.name`. The fake client uses it so inserts/selects are recorded with the
// real table name ('lendings' / 'lending_payments').
const TABLE_NAME = Symbol.for('drizzle:Name');

// Recursively collect primitive param values from a Drizzle SQL expression
// (e.g. `eq(lendings.user_id, 42)` → contains 42) so the test can assert the
// SELECT is scoped to the right user without a live database.
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

describe('lendingImport — Drizzle / Postgres path (recorded fake client)', () => {
	let importLendingsForUser: typeof import('$lib/server/lendingImport').importLendingsForUser;
	let calls: {
		selects: { table: string; cols: string[] }[];
		wheres: { table: string; args: unknown[] }[];
		inserts: { table: string; values: Record<string, unknown> }[]; // db.insert — global writes
		txInserts: { table: string; values: Record<string, unknown> }[]; // tx.insert — inside db.transaction
		returningIds: { table: string; id: number }[];
		transactions: number; // db.transaction calls
	};

	function makeQueryClient(counters: {
		select: (table: string, cols: string[]) => void;
		where: (table: string, args: unknown[]) => void;
		insert: (table: string, values: Record<string, unknown>) => void;
	}) {
		return {
			select(cols?: Record<string, unknown>) {
				const colNames = cols ? Object.keys(cols) : [];
				return {
					from(table: unknown) {
						const tableName = tableNameOf(table);
						counters.select(tableName, colNames);
						return {
							where(...args: unknown[]) {
								counters.where(tableName, args);
								return {
									then(onFulfilled: any, onRejected: any) {
										return Promise.resolve([]).then(onFulfilled, onRejected);
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
						// Record the insert here (at .values()) because the module's
						// lending_payments insert does NOT chain .returning().
						counters.insert(tableName, values);
						const id = calls.returningIds.length + 1;
						return {
							returning(cols: Record<string, unknown>) {
								calls.returningIds.push({ table: tableName, id });
								return Promise.resolve([{ id }]);
							}
						};
					}
				};
			}
		};
	}

	function fakeDb() {
		// The global `db` (dedup SELECT only) and the `tx` handed to the
		// db.transaction callback (every insert) are separate clients, so the
		// structural test can prove no global DB writes happen inside the
		// transaction.
		const db = makeQueryClient({
			select: (table, cols) => { calls.selects.push({ table, cols }); },
			where: (table, args) => { calls.wheres.push({ table, args }); },
			insert: (table, values) => { calls.inserts.push({ table, values }); }
		});
		const tx = makeQueryClient({
			select: () => {},
			where: () => {},
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

		vi.resetModules();
		const svc = await import('$lib/server/lendingImport');
		importLendingsForUser = svc.importLendingsForUser;
	});

	beforeEach(() => {
		calls = {
			selects: [],
			wheres: [],
			inserts: [],
			txInserts: [],
			returningIds: [],
			transactions: 0
		};
	});

	it('queries existing lendings for duplicate detection scoped to the user', async () => {
		const csv = `Person,Amount,Date Lent,Notes,Status\nAlice,1000,2026-08-01,Test,active`;
		const file = new File([csv], 'import.csv', { type: 'text/csv' });
		const result = await importLendingsForUser(42, file, '{}', 'lent') as any;

		expect(result.success).toBe(true);
		expect(calls.selects).toHaveLength(1);
		expect(calls.selects[0]!.table).toBe('lendings');
		expect(calls.selects[0]!.cols).toContain('borrower_name');
		expect(calls.selects[0]!.cols).toContain('amount');
		// Dedup SELECT carries a WHERE filter on the user id
		expect(calls.wheres).toHaveLength(1);
		expect(calls.wheres[0]!.table).toBe('lendings');
		const params = collectParamValues(calls.wheres[0]!.args[0]);
		expect(params).toContain(42);
	});

	it('inserts lendings with correct mapped values and uses .returning({ id })', async () => {
		const csv = `Person,Amount,Date Lent,Notes,Status\nAlice,1000,2026-08-01,Test,active`;
		const file = new File([csv], 'import.csv', { type: 'text/csv' });
		const result = await importLendingsForUser(42, file, '{}', 'lent') as any;

		expect(result.success).toBe(true);
		expect(result.imported).toBe(1);
		expect(calls.txInserts).toHaveLength(1);
		expect(calls.txInserts[0]!.table).toBe('lendings');
		expect(calls.txInserts[0]!.values.borrower_name).toBe('Alice');
		// numeric columns are stored as strings (schema: numeric → Drizzle string)
		expect(calls.txInserts[0]!.values.amount).toBe('1000');
		expect(calls.txInserts[0]!.values.interest_rate).toBe('0');
		expect(calls.txInserts[0]!.values.date_lent).toBe('2026-08-01');
		expect(calls.txInserts[0]!.values.direction).toBe('lent');
		expect(calls.txInserts[0]!.values.status).toBe('active');
		// inserted lending ID is returned via .returning({ id }) — not a SELECT
		expect(calls.returningIds).toHaveLength(1);
		expect(calls.returningIds[0]!.table).toBe('lendings');
		expect(calls.returningIds[0]!.id).toBe(result.imported);
	});

	it('creates lending_payment when recovered_amount > 0 using the returned lending ID', async () => {
		const csv = `Person,Amount,Date Lent,Amount Recovered,Notes,Status\nAlice,1000,2026-08-01,500,Test,active`;
		const file = new File([csv], 'import.csv', { type: 'text/csv' });
		const result = await importLendingsForUser(42, file, '{}', 'lent') as any;

		expect(result.success).toBe(true);
		expect(result.imported).toBe(1);
		expect(calls.txInserts).toHaveLength(2); // lending + payment
		// payment row references the ID returned by the lending insert
		expect(calls.returningIds[0]!.table).toBe('lendings');
		const paymentInsert = calls.txInserts.find(i => i.table === 'lending_payments');
		expect(paymentInsert).toBeDefined();
		expect(paymentInsert!.values.lending_id).toBe(calls.returningIds[0]!.id);
		expect(paymentInsert!.values.user_id).toBe(42);
		// numeric amount stored as string per schema
		expect(paymentInsert!.values.amount).toBe('500');
		expect(paymentInsert!.values.payment_date).toBe('2026-08-01');
		expect(paymentInsert!.values.notes).toBe('Imported');
		expect(paymentInsert!.values.payment_type).toBe('payment');
	});

	it('does not create lending_payment when recovered_amount = 0', async () => {
		const csv = `Person,Amount,Date Lent,Notes,Status\nAlice,1000,2026-08-01,Test,active`;
		const file = new File([csv], 'import.csv', { type: 'text/csv' });
		const result = await importLendingsForUser(42, file, '{}', 'lent') as any;

		expect(result.success).toBe(true);
		expect(result.imported).toBe(1);
		expect(calls.txInserts).toHaveLength(1); // lending only
		const paymentInsert = calls.txInserts.find(i => i.table === 'lending_payments');
		expect(paymentInsert).toBeUndefined();
	});

	it('returns correct import statistics', async () => {
		const csv = `Person,Amount,Date Lent,Notes,Status\nAlice,1000,2026-08-01,Test,active\nAlice,1000,2026-08-01,Test,active\nBob,2000,2026-08-02,Test2,active`;
		const file = new File([csv], 'import.csv', { type: 'text/csv' });
		const result = await importLendingsForUser(42, file, '{}', 'lent') as any;

		expect(result.success).toBe(true);
		expect(result.imported).toBe(2);
		expect(result.total).toBe(3);
		expect(result.skippedDuplicates).toBe(1);
		expect(result.skippedInvalid).toBe(0);
		expect(result.newPeople).toHaveLength(2);
	});

	it('wraps the entire import in one db.transaction and uses tx for every write', async () => {
		const csv = `Person,Amount,Date Lent,Amount Recovered,Notes,Status\nAlice,1000,2026-08-01,500,Test,active\nBob,2000,2026-08-02,0,Test2,active`;
		const file = new File([csv], 'import.csv', { type: 'text/csv' });
		const result = await importLendingsForUser(42, file, '{}', 'lent') as any;

		expect(result.success).toBe(true);
		expect(result.imported).toBe(2);
		// Exactly ONE transaction wraps the whole import.
		expect(calls.transactions).toBe(1);
		// Every insert ran through the tx client: 2 lendings + 1 payment.
		expect(calls.txInserts).toHaveLength(3);
		expect(calls.txInserts.filter(i => i.table === 'lendings')).toHaveLength(2);
		expect(calls.txInserts.filter(i => i.table === 'lending_payments')).toHaveLength(1);
		// The recovered payment references the id returned by the lending insert.
		expect(calls.returningIds).toHaveLength(2);
		const paymentInsert = calls.txInserts.find(i => i.table === 'lending_payments');
		expect(paymentInsert!.values.lending_id).toBe(calls.returningIds[0]!.id);
		// No global DB writes happened inside the transaction.
		expect(calls.inserts).toHaveLength(0);
		// The dedup SELECT still ran on the global db, before the transaction.
		expect(calls.selects).toHaveLength(1);
	});
});
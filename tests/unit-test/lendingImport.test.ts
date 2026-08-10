import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

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
			getPgPool: () => Promise.reject(new Error('getPgPool should not be called on Drizzle path')),
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
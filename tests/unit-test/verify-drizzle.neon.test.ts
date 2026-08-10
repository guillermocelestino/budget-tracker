/**
 * Checkpoint 2 — Real Neon + Drizzle verification (vitest harness).
 *
 * Drives the REAL Drizzle PostgreSQL branches of the already-migrated server
 * modules against the local-dev Neon database (no mocks, no schema changes):
 *   lendingPayments, recurringService, recurringScheduler, networth,
 *   recordLendingTransaction, lendingImport.
 *
 * WHY VITEST (not tsx): the migrated modules transitively import
 * `$lib/client/stores/preferences.svelte.ts` (via `format.ts`), which uses Svelte 5
 * runes (`$state`/`$derived`). tsx/esbuild cannot compile runes — vitest can,
 * via the project's Svelte plugin (the same runner the unit tests use).
 *
 * SAFETY:
 *   • Opt-in ONLY: runs when VERIFY_NEON=1 in the environment. Plain
 *     `npm run test:unit` and CI never touch a database.
 *   • Uses LOCAL_DEV_DATABASE_URL ONLY (shell var first, then .env). Refuses to
 *     fall back to .env's DATABASE_URL (production risk).
 *   • Dedicated `__neon_drizzle_<ts>` test users; every write is scoped to them.
 *   • Committed writes (the payment functions open their own db.transaction, so
 *     the rollback-sentinel pattern is NOT usable) — teardown is a CASCADE user
 *     delete in afterAll, plus a pre-run sweep so re-runs are idempotent.
 *   • No DDL, no TRUNCATE, no drizzle-kit, no db:migrate. Non-test rows untouched.
 *
 * Run:
 *   VERIFY_NEON=1 npx vitest run --config vite.config.ts tests/unit-test/verify-drizzle.neon.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { TransactionType, RecurringFrequency } from '$lib/types';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface RecurringInput {
	type: TransactionType;
	amount: number;
	description: string;
	category_id: number;
	frequency: RecurringFrequency;
	interval: number;
	day_of_week: number | null;
	day_of_month: number | null;
	month_of_year: number | null;
	start_date: string;
	end_date: string | null;
	active: boolean;
}

interface ImportResult {
	success?: boolean;
	imported?: number;
	skippedDuplicates?: number;
	skippedInvalid?: number;
	total?: number;
	newPeople?: string[];
	status?: number;
	data?: { error?: string };
}

function readDotEnv(): Record<string, string> {
	const result: Record<string, string> = {};
	try {
		const text = readFileSync(join(__dirname, '..', '..', '.env'), 'utf8');
		for (const raw of text.split('\n')) {
			const line = raw.trim();
			if (!line || line.startsWith('#')) continue;
			const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
			if (!m) continue;
			let value = m[2].trim();
			if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
				value = value.slice(1, -1);
			}
			result[m[1]] = value;
		}
	} catch {
		// no .env file — rely on the shell environment only
	}
	return result;
}

const env = readDotEnv();
const localDevUrl = process.env.LOCAL_DEV_DATABASE_URL || env['LOCAL_DEV_DATABASE_URL'];
const canRun = process.env.VERIFY_NEON === '1' && !!localDevUrl;

const results: { name: string; ok: boolean; detail?: string }[] = [];
function check(name: string, ok: boolean, detail?: string): void {
	results.push({ name, ok, detail });
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

let q: typeof import('$lib/server/db/query.js');
let lp: typeof import('$lib/server/services/lendingPayments.js');
let rs: typeof import('$lib/server/services/recurringService.js');
let sch: typeof import('$lib/server/services/recurringScheduler.js');
let nw: typeof import('$lib/server/services/networth.js');
let rlt: typeof import('$lib/server/services/recordLendingTransaction.js');
let li: typeof import('$lib/server/services/lendingImport.js');

describe.skipIf(!canRun)('real Neon + Drizzle verification (VERIFY_NEON=1)', () => {
	const allUserIds: number[] = [];

	beforeAll(async () => {
		// Set BEFORE any app module is imported so the resolved database URL
		// (captured at module load in $lib/database/index.ts) points at the
		// local-dev branch.
		process.env.DATABASE_URL = localDevUrl!;
		console.log('\nTarget (local-dev Neon ONLY):', describeUrl(localDevUrl!));
		if (env['DATABASE_URL']) {
			console.log(`NOTE — .env DATABASE_URL (${describeUrl(env['DATABASE_URL'])}) exists — intentionally NOT used.`);
		}

		const indexM = await import('$lib/server/db/index.js');
		q = await import('$lib/server/db/query.js');
		lp = await import('$lib/server/services/lendingPayments.js');
		rs = await import('$lib/server/services/recurringService.js');
		sch = await import('$lib/server/services/recurringScheduler.js');
		nw = await import('$lib/server/services/networth.js');
		rlt = await import('$lib/server/services/recordLendingTransaction.js');
		li = await import('$lib/server/services/lendingImport.js');

		// Postgres-only runtime: the removed SQLite-detection flag is replaced by
		// a check on the resolved connection the test will actually drive. The
		// runtime is canonical on `DATABASE_URL` (the deprecated `POSTGRES_URL`
		// alias is accepted too) and must be a PostgreSQL/Neon URL — fail loudly
		// rather than silently running against anything else.
		const resolvedUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
		if (!resolvedUrl || !/^postgres(ql)?:\/\//i.test(resolvedUrl)) {
			throw new Error('Resolved DATABASE_URL is not a PostgreSQL/Neon URL — DATABASE_URL was set from LOCAL_DEV_DATABASE_URL; verify the value.');
		}
		await indexM.getPgPool(); // runs initDb() once (idempotent on the live local-dev branch)

		// Sweep any stale test users from an interrupted previous run.
		await q.execute(`DELETE FROM users WHERE username LIKE '\\_\\_neon\\_drizzle\\_%'`);
	}, 120_000);

	afterAll(async () => {
		if (allUserIds.length > 0) {
			try {
				await q.execute(`DELETE FROM users WHERE id = ANY($1::int[])`, [allUserIds]);
				const left = await q.queryMany<{ id: number }>(`SELECT id FROM users WHERE id = ANY($1::int[])`, [allUserIds]);
				check('Cleanup: test users removed (CASCADE)', left.length === 0, `remaining=${left.length}`);

				const childTables = ['transactions', 'lendings', 'recurring_transactions', 'categories', 'lending_payments'] as const;
				for (const table of childTables) {
					const rows = await q.queryMany<{ id: number }>(`SELECT id FROM ${table} WHERE user_id = ANY($1::int[])`, [allUserIds]);
					check(`Cleanup: no orphan rows in ${table}`, rows.length === 0, `count=${rows.length}`);
				}
			} catch (err) {
				check('Cleanup', false, `cleanup threw: ${err instanceof Error ? err.message : String(err)}`);
			}
		}
		delete process.env.DATABASE_URL;
	}, 120_000);

	it('runs all real-Neon Drizzle scenarios', async () => {
		const TS = Date.now();
		const PREFIX = `__neon_drizzle_${TS}`;
		const heading = (title: string): void => console.log(`\n── ${title} ──`);

		const createUser = async (tag: string): Promise<number> => {
			const username = `${PREFIX}_${tag}`;
			await q.execute(`INSERT INTO users (username, password_hash) VALUES ($1, $2)`, [username, 'verify-dummy-hash']);
			const u = await q.queryOne<{ id: number }>(`SELECT id FROM users WHERE username = $1`, [username]);
			if (!u) throw new Error(`Failed to create test user ${username}`);
			allUserIds.push(u.id);
			return u.id;
		};

		const createCategory = async (userId: number, name: string, type: string): Promise<number> => {
			await q.execute(
				`INSERT INTO categories (user_id, name, color, icon, type) VALUES ($1, $2, $3, $4, $5)`,
				[userId, name, '#000000', '📁', type]
			);
			const c = await q.queryOne<{ id: number }>(`SELECT id FROM categories WHERE user_id = $1 AND name = $2`, [userId, name]);
			if (!c) throw new Error(`Failed to create category ${name}`);
			return c.id;
		};

		const expectThrows = async (name: string, fragment: string, fn: () => Promise<unknown>): Promise<void> => {
			let threw = false;
			let message = '';
			try {
				await fn();
			} catch (err) {
				threw = true;
				message = err instanceof Error ? err.message : String(err);
			}
			check(name, threw && message.includes(fragment), `threw=${threw} message="${message}"`);
		};

		// ─────────────────────────── lendingPayments ───────────────────────────
		heading('lendingPayments — getLendingsWithPayments / getLendingWithPayments');
		const A = await createUser('a');
		const payer = `${PREFIX}_payer`;
		await q.execute(
			`INSERT INTO lendings (user_id, borrower_name, amount, interest_rate, date_lent, due_date, status, direction)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			[A, payer, 1000, null, '2026-08-08', '2026-12-31', 'active', 'lent']
		);
		const L1 = (await q.queryOne<{ id: number }>(`SELECT id FROM lendings WHERE user_id = $1 AND borrower_name = $2`, [A, payer]))!.id;

		const initial = (await lp.getLendingsWithPayments(A, 'lent')).find((r) => r.id === L1);
		check('getLendingsWithPayments returns the lending', !!initial);
		check('lending.amount → JS number', typeof initial?.amount === 'number', `type=${typeof initial?.amount} value=${initial?.amount}`);
		check('lending.amount value 1000', initial?.amount === 1000, String(initial?.amount));
		check('interest_rate null → 0', initial?.interest_rate === 0, String(initial?.interest_rate));
		check('date_lent → YYYY-MM-DD string', initial?.date_lent === '2026-08-08', String(initial?.date_lent));
		check('due_date → YYYY-MM-DD string', initial?.due_date === '2026-12-31', String(initial?.due_date));
		check('notes null preserved', initial?.notes === null, String(initial?.notes));
		check('cash_paid 0', initial?.cash_paid === 0, String(initial?.cash_paid));
		check('remaining 1000', initial?.remaining === 1000, String(initial?.remaining));
		check('derived_status active', initial?.derived_status === 'active', String(initial?.derived_status));
		check('status cache active', initial?.status === 'active', String(initial?.status));
		check(
			'created_at → string (toSqliteTimestamp)',
			typeof initial?.created_at === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(initial?.created_at ?? ''),
			initial?.created_at
		);

		const single = await lp.getLendingWithPayments(A, L1);
		check(
			'getLendingWithPayments matches',
			single?.id === L1 && single?.amount === 1000 && single?.derived_status === 'active',
			`id=${single?.id} status=${single?.derived_status}`
		);

		check('getLendingsWithPayments(borrowed) → []', (await lp.getLendingsWithPayments(A, 'borrowed')).length === 0);

		heading('lendingPayments — recordPayment (createTransaction)');
		const p1 = await lp.recordPayment(A, {
			lendingId: L1,
			amount: 400,
			paymentDate: '2026-08-09',
			notes: 'p1',
			paymentType: 'payment',
			createTransaction: true
		});
		check('recordPayment returns paymentId', typeof p1.paymentId === 'number' && p1.paymentId > 0, `paymentId=${p1.paymentId}`);
		check('recordPayment returns transactionId', typeof p1.transactionId === 'number' && p1.transactionId !== null, `transactionId=${String(p1.transactionId)}`);

		const pay1 = await q.queryOne<{ amount: string; payment_type: string; transaction_id: number | null; payment_date: string }>(
			`SELECT amount, payment_type, transaction_id, TO_CHAR(payment_date, 'YYYY-MM-DD') AS payment_date FROM lending_payments WHERE id = $1`,
			[p1.paymentId]
		);
		check('payment row inserted', !!pay1, JSON.stringify(pay1));
		check('payment amount 400', Number(pay1?.amount) === 400, String(pay1?.amount));
		check('payment payment_type = payment', pay1?.payment_type === 'payment', String(pay1?.payment_type));
		check('payment transaction_id linked', pay1?.transaction_id === p1.transactionId, String(pay1?.transaction_id));
		check('payment payment_date → YYYY-MM-DD string', pay1?.payment_date === '2026-08-09', String(pay1?.payment_date));

		const txn1 = await q.queryOne<{ amount: string; description: string; type: string; category_name: string }>(
			`SELECT t.amount, t.description, t.type, c.name AS category_name
			 FROM transactions t JOIN categories c ON c.id = t.category_id WHERE t.id = $1`,
			[p1.transactionId!]
		);
		check('linked transaction exists', !!txn1);
		check('linked txn amount 400', Number(txn1?.amount) === 400, String(txn1?.amount));
		check('linked txn description', txn1?.description === `Repayment from ${payer}`, String(txn1?.description));
		check('linked txn type income', txn1?.type === 'income', String(txn1?.type));
		check('repayment category auto-created (Loan Repayment)', txn1?.category_name === 'Loan Repayment', String(txn1?.category_name));

		const after1 = (await lp.getLendingWithPayments(A, L1))!;
		check('remaining 600 after payment', after1.remaining === 600, String(after1.remaining));
		check('cash_paid 400', after1.cash_paid === 400, String(after1.cash_paid));
		check('status still active', after1.status === 'active', after1.status);

		heading('lendingPayments — getPaymentHistory / getLendingTotals');
		const hist = await lp.getPaymentHistory(A, L1);
		check('payment history length 1', hist.length === 1, `len=${hist.length}`);
		check('payment history amount 400', hist[0]?.amount === 400, String(hist[0]?.amount));
		check(
			'payment history created_at → ISO string',
			typeof hist[0]?.created_at === 'string' && hist[0]?.created_at.includes('T'),
			String(hist[0]?.created_at)
		);

		const totals = await lp.getLendingTotals(A, 'lent');
		check('totals.total 1000', totals.total === 1000, String(totals.total));
		check('totals.cashPaid 400', totals.cashPaid === 400, String(totals.cashPaid));
		check('totals.writtenOff 0', totals.writtenOff === 0, String(totals.writtenOff));
		check('totals.outstanding 600', totals.outstanding === 600, String(totals.outstanding));
		check('totals are JS numbers', typeof totals.total === 'number' && typeof totals.cashPaid === 'number');

		heading('lendingPayments — updatePayment (syncs linked txn, recalc status)');
		await lp.updatePayment(A, p1.paymentId, { amount: 600, paymentDate: '2026-08-10', notes: 'p1b' });
		const pay1b = await q.queryOne<{ amount: string }>(`SELECT amount FROM lending_payments WHERE id = $1`, [p1.paymentId]);
		check('payment amount updated to 600', Number(pay1b?.amount) === 600, String(pay1b?.amount));
		const txn1b = await q.queryOne<{ amount: string; date: string }>(
			`SELECT amount, TO_CHAR(date, 'YYYY-MM-DD') AS date FROM transactions WHERE id = $1`,
			[p1.transactionId!]
		);
		check('linked txn amount synced to 600', Number(txn1b?.amount) === 600, String(txn1b?.amount));
		check('linked txn date synced', txn1b?.date === '2026-08-10', String(txn1b?.date));
		const afterUpdate = (await lp.getLendingWithPayments(A, L1))!;
		check('remaining 400 after update', afterUpdate.remaining === 400, String(afterUpdate.remaining));
		check('cash_paid 600', afterUpdate.cash_paid === 600, String(afterUpdate.cash_paid));

		heading('lendingPayments — overpayment rejection');
		await expectThrows('overpayment throws', 'Payment amount cannot exceed remaining balance', () =>
			lp.recordPayment(A, {
				lendingId: L1,
				amount: 500,
				paymentDate: '2026-08-10',
				notes: 'x',
				paymentType: 'payment',
				createTransaction: true
			})
		);
		const payCountAfterReject = (
			await q.queryMany<{ id: number }>(`SELECT id FROM lending_payments WHERE lending_id = $1`, [L1])
		).length;
		check('overpayment left no payment row', payCountAfterReject === 1, `count=${payCountAfterReject}`);

		heading('lendingPayments — full settle → paid, recalcStatusCache');
		const p2 = await lp.recordPayment(A, {
			lendingId: L1,
			amount: 400,
			paymentDate: '2026-08-11',
			notes: 'p2',
			paymentType: 'payment',
			createTransaction: false
		});
		check('p2 transactionId null (no linked txn)', p2.transactionId === null, String(p2.transactionId));
		const settled = (await lp.getLendingWithPayments(A, L1))!;
		check('remaining 0 after settle', settled.remaining === 0, String(settled.remaining));
		check('derived_status paid', settled.derived_status === 'paid', settled.derived_status);
		check('status cache paid', settled.status === 'paid', settled.status);
		const recalc = await lp.recalcStatusCache(A, L1);
		check('recalcStatusCache returns paid', recalc === 'paid', recalc);

		heading('lendingPayments — deletePayment reopens loan');
		await lp.deletePayment(A, p1.paymentId);
		const reopened = (await lp.getLendingWithPayments(A, L1))!;
		// After deleting p1 (600), the only remaining payment is p2 (400): 1000 − 400 = 600.
		check('remaining 600 after delete', reopened.remaining === 600, String(reopened.remaining));
		check('status active after delete', reopened.status === 'active', reopened.status);
		const txn1gone = await q.queryOne<{ id: number }>(`SELECT id FROM transactions WHERE id = $1`, [p1.transactionId!]);
		check('linked transaction deleted with payment', !txn1gone);
		// POSITIVE GUARD: the Drizzle query recalcStatusCache now runs must
		// reference the lending via a bind parameter (`$n`), never the broken
		// bare `"id"` column that Postgres binds to the innermost scope (Bug A).
		// The query shape mirrors the fixed source (p.lending_id = ${lendingId}).
		{
			const drizzleM = await import('$lib/server/db/drizzle');
			const schemaM = await import('$lib/server/db/schema');
			const { sql: dSql, and: dAnd, eq: dEq } = await import('drizzle-orm');
			const dbgDrizzle = await drizzleM.getDrizzle();
			const probe = dbgDrizzle
				.select({
					amount: schemaM.lendings.amount,
					resolved: dSql<string>`COALESCE((SELECT SUM(p.amount) FROM ${schemaM.lendingPayments} p WHERE p.lending_id = ${L1} AND p.payment_type IN ('payment', 'write_off')), 0)`
				})
				.from(schemaM.lendings)
				.where(dAnd(dEq(schemaM.lendings.user_id, A), dEq(schemaM.lendings.id, L1)))
				.limit(1);
			const sqlOut = probe.toSQL();
			const subqueryBindsParam = /lending_id\s*=\s*\$\d+/.test(sqlOut.sql);
			const subqueryBareColumn = /lending_id\s*=\s*"\w+"\s+AND/.test(sqlOut.sql);
			check(
				'recalc subquery correlates via bind param (no bare "id")',
				subqueryBindsParam && !subqueryBareColumn,
				sqlOut.sql.replace(/\s+/g, ' ')
			);
		}
		const recalc2 = await lp.recalcStatusCache(A, L1);
		check('recalcStatusCache returns active after reopen', recalc2 === 'active', recalc2);

		heading('lendingPayments — hasPayments / deleteLinkedTransactions (FK SET NULL)');
		check('hasPayments true', (await lp.hasPayments(A, L1)) === true);
		const p3 = await lp.recordPayment(A, {
			lendingId: L1,
			amount: 200,
			paymentDate: '2026-08-12',
			notes: 'p3',
			paymentType: 'payment',
			createTransaction: true
		});
		check('p3 creates linked txn', typeof p3.transactionId === 'number', `transactionId=${String(p3.transactionId)}`);
		await lp.deleteLinkedTransactions(A, L1);
		const p3row = await q.queryOne<{ transaction_id: number | null }>(`SELECT transaction_id FROM lending_payments WHERE id = $1`, [p3.paymentId]);
		check('deleteLinkedTransactions → FK SET NULL', p3row?.transaction_id === null, `transaction_id=${String(p3row?.transaction_id)}`);
		const txn3gone = await q.queryOne<{ id: number }>(`SELECT id FROM transactions WHERE id = $1`, [p3.transactionId!]);
		check('deleteLinkedTransactions removes txn row', !txn3gone);

		heading('lendingPayments — write-off');
		await q.execute(
			`INSERT INTO lendings (user_id, borrower_name, amount, date_lent, status, direction) VALUES ($1, $2, $3, $4, $5, $6)`,
			[A, `${PREFIX}_writeoff`, 500, '2026-08-08', 'active', 'lent']
		);
		const Lwo = (await q.queryOne<{ id: number }>(`SELECT id FROM lendings WHERE user_id = $1 AND borrower_name = $2`, [A, `${PREFIX}_writeoff`]))!.id;
		check('hasPayments false before write-off', (await lp.hasPayments(A, Lwo)) === false);
		const wo = await lp.recordPayment(A, {
			lendingId: Lwo,
			amount: 500,
			paymentDate: '2026-08-08',
			notes: 'wo',
			paymentType: 'write_off',
			createTransaction: true
		});
		check('write-off transactionId null (no linked txn)', wo.transactionId === null, `transactionId=${String(wo.transactionId)}`);
		const woLending = (await lp.getLendingWithPayments(A, Lwo))!;
		check('write-off → paid', woLending.derived_status === 'paid' && woLending.status === 'paid', `${woLending.derived_status}/${woLending.status}`);
		check('write-off cash_paid 0 / written_off 500', woLending.cash_paid === 0 && woLending.written_off === 500, `cash=${woLending.cash_paid} woff=${woLending.written_off}`);

		const totalsAfter = await lp.getLendingTotals(A, 'lent');
		check('totals after write-off: total 1500', totalsAfter.total === 1500, String(totalsAfter.total));
		check('totals after write-off: cashPaid 600', totalsAfter.cashPaid === 600, String(totalsAfter.cashPaid));
		check('totals after write-off: writtenOff 500', totalsAfter.writtenOff === 500, String(totalsAfter.writtenOff));
		check('totals after write-off: outstanding 400', totalsAfter.outstanding === 400, String(totalsAfter.outstanding));

		const loanCats = await q.queryMany<{ id: number }>(`SELECT id FROM categories WHERE user_id = $1 AND name = 'Loan Repayment'`, [A]);
		check('Loan Repayment category created once', loanCats.length === 1, `count=${loanCats.length}`);

		// ─────────────────────────── recurringService ──────────────────────────
		heading('recurringService — createRecurringTransaction');
		const C = await createUser('c');
		const cCat = await createCategory(C, `${PREFIX}_recurring`, 'expense');
		const B = await createUser('b');
		const bCat = await createCategory(B, `${PREFIX}_other`, 'expense');

		const makeRecurringInput = (over: Partial<RecurringInput> = {}): RecurringInput => ({
			type: 'expense',
			amount: 100,
			description: 'Verify Rent',
			category_id: cCat,
			frequency: 'monthly',
			interval: 1,
			day_of_week: null,
			day_of_month: null,
			month_of_year: null,
			start_date: '2026-08-08',
			end_date: null,
			active: true,
			...over
		});

		const created = await rs.createRecurringTransaction(C, makeRecurringInput());
		check('createRecurringTransaction success', created.success === true, JSON.stringify(created));
		const recRow = await q.queryOne<{
			id: number;
			amount: string;
			active: boolean;
			frequency: string;
			interval: number;
			next_run: string;
			start_date: string;
		}>(
			`SELECT id, amount, active, frequency, interval, TO_CHAR(next_run, 'YYYY-MM-DD') AS next_run,
			        TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date
			 FROM recurring_transactions WHERE user_id = $1 AND description = $2`,
			[C, 'Verify Rent']
		);
		const recId = recRow!.id;
		check('recurring row inserted', !!recRow);
		check('recurring amount 100 (numeric)', Number(recRow?.amount) === 100, String(recRow?.amount));
		check('recurring active → boolean true', recRow?.active === true, `active=${String(recRow?.active)} (${typeof recRow?.active})`);
		check('recurring next_run 2026-09-08', recRow?.next_run === '2026-09-08', String(recRow?.next_run));
		check('recurring frequency monthly', recRow?.frequency === 'monthly', String(recRow?.frequency));
		check('recurring interval 1', recRow?.interval === 1, String(recRow?.interval));

		const crossUser = await rs.createRecurringTransaction(C, makeRecurringInput({ category_id: bCat }));
		check('category ownership rejected', crossUser.success === false && crossUser.error === 'Category not found', JSON.stringify(crossUser));

		const invalid = await rs.createRecurringTransaction(C, makeRecurringInput({ amount: 0 }));
		check('validation rejects amount 0', invalid.success === false && invalid.errors?.amount === 'Enter a valid amount', JSON.stringify(invalid));
		const recCountAfterInvalid = (await q.queryMany<{ id: number }>(`SELECT id FROM recurring_transactions WHERE user_id = $1`, [C])).length;
		check('no row inserted on invalid', recCountAfterInvalid === 1, `count=${recCountAfterInvalid}`);

		heading('recurringService — updateRecurringTransaction');
		const upd = await rs.updateRecurringTransaction(C, recId, makeRecurringInput({ amount: 150, frequency: 'weekly' }));
		check('updateRecurringTransaction success', upd.success === true, JSON.stringify(upd));
		const updRow = await q.queryOne<{ amount: string; frequency: string; next_run: string }>(
			`SELECT amount, frequency, TO_CHAR(next_run, 'YYYY-MM-DD') AS next_run FROM recurring_transactions WHERE id = $1`,
			[recId]
		);
		check('update amount 150', Number(updRow?.amount) === 150, String(updRow?.amount));
		check('update frequency weekly', updRow?.frequency === 'weekly', String(updRow?.frequency));
		check('next_run recalculated to 2026-08-15 (weekly)', updRow?.next_run === '2026-08-15', String(updRow?.next_run));

		const upd2 = await rs.updateRecurringTransaction(C, recId, makeRecurringInput({ amount: 200, frequency: 'weekly' }));
		check('update success (amount-only change)', upd2.success === true, JSON.stringify(upd2));
		const updRow2 = await q.queryOne<{ amount: string; next_run: string }>(
			`SELECT amount, TO_CHAR(next_run, 'YYYY-MM-DD') AS next_run FROM recurring_transactions WHERE id = $1`,
			[recId]
		);
		check('amount updated to 200', Number(updRow2?.amount) === 200, String(updRow2?.amount));
		check('next_run PRESERVED when schedule unchanged', updRow2?.next_run === '2026-08-15', String(updRow2?.next_run));

		const updCross = await rs.updateRecurringTransaction(C, recId, makeRecurringInput({ category_id: bCat }));
		check('update rejects foreign category', updCross.success === false && updCross.error === 'Category not found', JSON.stringify(updCross));
		const updRowCross = await q.queryOne<{ category_id: number }>(`SELECT category_id FROM recurring_transactions WHERE id = $1`, [recId]);
		check('foreign-category update left row unchanged', updRowCross?.category_id === cCat, `category_id=${updRowCross?.category_id}`);

		const updMissing = await rs.updateRecurringTransaction(C, 99999999, makeRecurringInput());
		check('update missing recurring → not found', updMissing.success === false && updMissing.error === 'Recurring transaction not found', JSON.stringify(updMissing));

		// ─────────────────────────── recurringScheduler ─────────────────────────
		heading('recurringScheduler — toggle / process / runNow / duplicate');
		await sch.toggleRecurringStatus(C, recId, false);
		const pausedRow = await q.queryOne<{ active: boolean }>(`SELECT active FROM recurring_transactions WHERE id = $1`, [recId]);
		check('toggle → active false (boolean)', pausedRow?.active === false, `active=${String(pausedRow?.active)} (${typeof pausedRow?.active})`);
		check('process returns 0 when paused', (await sch.processRecurringTransactions(C)) === 0);

		await sch.toggleRecurringStatus(C, recId, true);
		await q.execute(`UPDATE recurring_transactions SET next_run = '2020-01-01' WHERE id = $1`, [recId]);
		const gen = await sch.processRecurringTransactions(C);
		check('processRecurringTransactions generates a transaction', gen >= 1, `generated=${gen}`);
		const schedTxn = await q.queryOne<{ amount: string; description: string; type: string; category_id: number; date: string }>(
			`SELECT amount, description, type, category_id, TO_CHAR(date, 'YYYY-MM-DD') AS date
			 FROM transactions WHERE user_id = $1 AND description = $2 AND TO_CHAR(date, 'YYYY-MM-DD') = '2020-01-01'`,
			[C, 'Verify Rent']
		);
		check('scheduler created transaction row', !!schedTxn);
		check('scheduler txn amount 200', Number(schedTxn?.amount) === 200, String(schedTxn?.amount));
		check('scheduler txn type expense', schedTxn?.type === 'expense', String(schedTxn?.type));
		check('scheduler txn category', schedTxn?.category_id === cCat, String(schedTxn?.category_id));
		check('scheduler txn date = next_run', schedTxn?.date === '2020-01-01', String(schedTxn?.date));
		const rolledRow = await q.queryOne<{ next_run: string; last_generated_at: unknown; active: boolean }>(
			`SELECT TO_CHAR(next_run, 'YYYY-MM-DD') AS next_run, last_generated_at, active FROM recurring_transactions WHERE id = $1`,
			[recId]
		);
		check('next_run rolled forward (→ start_date 2026-08-08)', rolledRow?.next_run === '2026-08-08', String(rolledRow?.next_run));
		check('last_generated_at set', rolledRow?.last_generated_at !== null, String(rolledRow?.last_generated_at));
		check('active still true', rolledRow?.active === true, String(rolledRow?.active));

		await q.execute(`UPDATE recurring_transactions SET next_run = '2030-01-01' WHERE id = $1`, [recId]);
		check('process returns 0 when next_run in future', (await sch.processRecurringTransactions(C)) === 0);

		heading('recurringScheduler — runRecurringNow');
		const runNow = await sch.runRecurringNow(C, recId);
		check('runRecurringNow success', runNow.success === true, JSON.stringify(runNow));
		const runNowTxn = await q.queryOne<{ date: string }>(
			`SELECT TO_CHAR(date, 'YYYY-MM-DD') AS date FROM transactions WHERE user_id = $1 AND description = $2 AND TO_CHAR(date, 'YYYY-MM-DD') = '2030-01-01'`,
			[C, 'Verify Rent']
		);
		check('runRecurringNow created txn at next_run', !!runNowTxn, `date=${String(runNowTxn?.date)}`);
		const runNowSchedule = await q.queryOne<{ next_run: string }>(
			`SELECT TO_CHAR(next_run, 'YYYY-MM-DD') AS next_run FROM recurring_transactions WHERE id = $1`,
			[recId]
		);
		check('runRecurringNow did NOT change schedule', runNowSchedule?.next_run === '2030-01-01', String(runNowSchedule?.next_run));

		await sch.toggleRecurringStatus(C, recId, false);
		const runNowPaused = await sch.runRecurringNow(C, recId);
		check('runRecurringNow paused → error', runNowPaused.success === false && runNowPaused.error === 'Recurring transaction is paused', JSON.stringify(runNowPaused));
		await sch.toggleRecurringStatus(C, recId, true);

		heading('recurringScheduler — duplicateRecurringTransaction');
		const dup = await sch.duplicateRecurringTransaction(C, recId);
		check('duplicate success + id', dup.success === true && typeof dup.id === 'number' && dup.id! > 0, `id=${String(dup.id)}`);
		const dupRow = await q.queryOne<{ description: string; amount: string; next_run: string }>(
			`SELECT description, amount, TO_CHAR(next_run, 'YYYY-MM-DD') AS next_run FROM recurring_transactions WHERE id = $1`,
			[dup.id!]
		);
		check('duplicate row exists with same data', dupRow?.description === 'Verify Rent' && Number(dupRow?.amount) === 200 && dupRow?.next_run === '2030-01-01', JSON.stringify(dupRow));

		// ─────────────────────────── networth ───────────────────────────
		heading('networth — computeNetWorth (SUM aggregates, to_char GROUP BY)');
		const D = await createUser('d');
		const dIncome = await createCategory(D, `${PREFIX}_income`, 'income');
		const dExpense = await createCategory(D, `${PREFIX}_expense`, 'expense');
		await q.execute(`INSERT INTO transactions (user_id, amount, description, date, category_id, type) VALUES ($1, $2, $3, $4, $5, $6)`, [D, 1000, 'NW income', '2026-08-01', dIncome, 'income']);
		await q.execute(`INSERT INTO transactions (user_id, amount, description, date, category_id, type) VALUES ($1, $2, $3, $4, $5, $6)`, [D, 200, 'NW expense', '2026-08-02', dExpense, 'expense']);
		await q.execute(`INSERT INTO lendings (user_id, borrower_name, amount, date_lent, status, direction) VALUES ($1, $2, $3, $4, $5, $6)`, [D, 'NW Lent', 500, '2026-08-01', 'active', 'lent']);
		await q.execute(
			`INSERT INTO lendings (user_id, borrower_name, amount, date_lent, due_date, status, direction) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			[D, 'NW Borrowed', 300, '2026-08-01', '2026-09-01', 'active', 'borrowed']
		);

		const snapshot = await nw.computeNetWorth(D);
		check('net = cash + lent − borrowed = 1000', snapshot.net === 1000, `net=${snapshot.net}`);
		check('cash = 1000 − 200 = 800', snapshot.legs.find((l) => l.key === 'cash')?.amount === 800, JSON.stringify(snapshot.legs));
		check('lentToday 500', snapshot.lentToday === 500, String(snapshot.lentToday));
		check('borrowedToday 300', snapshot.borrowedToday === 300, String(snapshot.borrowedToday));
		check('legs: cash + lent + borrowed', snapshot.legs.length === 3, `len=${snapshot.legs.length}`);
		check('cashTrend month 2026-08', snapshot.cashTrend[0]?.month === '2026-08', String(snapshot.cashTrend[0]?.month));
		check('cashTrend cash 800', snapshot.cashTrend[0]?.cash === 800, String(snapshot.cashTrend[0]?.cash));
		check('biggestMover cash 800', snapshot.biggestMover?.key === 'cash' && snapshot.biggestMover?.amount === 800, JSON.stringify(snapshot.biggestMover));
		check('projection set (borrowed active, <3mo trend)', snapshot.projection?.text?.includes('₱300') ?? false, String(snapshot.projection?.text));

		// ─────────────────────────── recordLendingTransaction ───────────────────────────
		heading('recordLendingTransaction — event/direction mapping + category fallback');
		const E = await createUser('e');
		const t1 = await rlt.recordLendingTransaction(E, { event: 'create', direction: 'lent', amount: 500, partyName: 'NeonCheck', date: '2026-08-05' });
		check('create+lent returns txn id', typeof t1 === 'number' && t1! > 0, `id=${t1}`);
		const t1r = await q.queryOne<{ description: string; type: string; amount: string; category_name: string }>(
			`SELECT t.description, t.type, t.amount, c.name AS category_name FROM transactions t JOIN categories c ON c.id = t.category_id WHERE t.id = $1`,
			[t1!]
		);
		check('create+lent description', t1r?.description === 'Lent to NeonCheck', String(t1r?.description));
		check('create+lent type expense', t1r?.type === 'expense', String(t1r?.type));
		check('create+lent amount 500', Number(t1r?.amount) === 500, String(t1r?.amount));
		check('create+lent category Lending Recovery', t1r?.category_name === 'Lending Recovery', String(t1r?.category_name));

		const t2 = await rlt.recordLendingTransaction(E, { event: 'repayment', direction: 'lent', amount: 100, partyName: 'NeonCheck', date: '2026-08-06' });
		const t2r = await q.queryOne<{ description: string; type: string; category_name: string }>(
			`SELECT t.description, t.type, c.name AS category_name FROM transactions t JOIN categories c ON c.id = t.category_id WHERE t.id = $1`,
			[t2!]
		);
		check('repayment+lent description', t2r?.description === 'Repayment from NeonCheck', String(t2r?.description));
		check('repayment+lent type income', t2r?.type === 'income', String(t2r?.type));
		check('repayment+lent category fallback → Lending Recovery (no duplicate)', t2r?.category_name === 'Lending Recovery', String(t2r?.category_name));

		const t3 = await rlt.recordLendingTransaction(E, { event: 'create', direction: 'borrowed', amount: 300, partyName: 'Bank', date: '2026-08-05' });
		const t3r = await q.queryOne<{ description: string; type: string; category_name: string }>(
			`SELECT t.description, t.type, c.name AS category_name FROM transactions t JOIN categories c ON c.id = t.category_id WHERE t.id = $1`,
			[t3!]
		);
		check('create+borrowed description', t3r?.description === 'Borrowed from Bank', String(t3r?.description));
		check('create+borrowed type income', t3r?.type === 'income', String(t3r?.type));
		check('create+borrowed category Debt Repayment', t3r?.category_name === 'Debt Repayment', String(t3r?.category_name));

		const t4 = await rlt.recordLendingTransaction(E, { event: 'repayment', direction: 'borrowed', amount: 100, partyName: 'Bank', date: '2026-08-06' });
		const t4r = await q.queryOne<{ description: string; type: string; category_name: string }>(
			`SELECT t.description, t.type, c.name AS category_name FROM transactions t JOIN categories c ON c.id = t.category_id WHERE t.id = $1`,
			[t4!]
		);
		check('repayment+borrowed description', t4r?.description === 'Repaid to Bank', String(t4r?.description));
		check('repayment+borrowed type expense', t4r?.type === 'expense', String(t4r?.type));
		check('repayment+borrowed category Debt Repayment (reused)', t4r?.category_name === 'Debt Repayment', String(t4r?.category_name));

		const eCatCounts = await q.queryOne<{ recovery: number; debt: number; loan: number }>(
			`SELECT
				(SELECT COUNT(*)::int FROM categories WHERE user_id = $1 AND name = 'Lending Recovery') AS recovery,
				(SELECT COUNT(*)::int FROM categories WHERE user_id = $1 AND name = 'Debt Repayment') AS debt,
				(SELECT COUNT(*)::int FROM categories WHERE user_id = $1 AND name = 'Loan Repayment') AS loan`,
			[E]
		);
		check('Lending Recovery created once', eCatCounts?.recovery === 1, JSON.stringify(eCatCounts));
		check('Debt Repayment created once', eCatCounts?.debt === 1, JSON.stringify(eCatCounts));
		check('Loan Repayment NOT created (fallback reuses legacy)', eCatCounts?.loan === 0, JSON.stringify(eCatCounts));

		// ─────────────────────────── lendingImport ───────────────────────────
		heading('lendingImport — importLendingsForUser (CSV)');
		const F = await createUser('f');
		const csv = [
			'person_name,amount,date_lent,due_date,interest_rate,notes,status,Amount Recovered',
			'Imported One,1200,2026-03-10,2026-09-10,5.5,Verify import,active,0',
			'Imported Two,800,2026-04-01,,0,,active,300'
		].join('\n');
		const file = new File([csv], 'verify-import.csv', { type: 'text/csv' });

		const res = (await li.importLendingsForUser(F, file, JSON.stringify({ dateFormat: 'YYYY-MM-DD' }), 'lent')) as unknown as ImportResult;
		check('import success + imported 2', res?.success === true && res?.imported === 2, JSON.stringify(res));
		check('import newPeople length 2', Array.isArray(res?.newPeople) && res.newPeople.length === 2, JSON.stringify(res?.newPeople));

		const impLendings = await q.queryMany<{
			borrower_name: string;
			amount: string;
			interest_rate: string;
			date_lent: string;
			due_date: string | null;
			direction: string;
			status: string;
		}>(
			`SELECT borrower_name, amount, interest_rate, TO_CHAR(date_lent, 'YYYY-MM-DD') AS date_lent,
			        TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date, direction, status
			 FROM lendings WHERE user_id = $1 ORDER BY borrower_name ASC`,
			[F]
		);
		check('2 lendings imported', impLendings.length === 2, `len=${impLendings.length}`);
		const one = impLendings.find((l) => l.borrower_name === 'Imported One');
		check('row1 amount 1200', Number(one?.amount) === 1200, String(one?.amount));
		check('row1 interest 5.5', Number(one?.interest_rate) === 5.5, String(one?.interest_rate));
		check('row1 due_date 2026-09-10', one?.due_date === '2026-09-10', String(one?.due_date));
		const two = impLendings.find((l) => l.borrower_name === 'Imported Two');
		check('row2 interest 0', Number(two?.interest_rate) === 0, String(two?.interest_rate));
		check('row2 due_date null', two?.due_date === null, String(two?.due_date));
		check('row2 direction lent', two?.direction === 'lent', String(two?.direction));

		const impPay = await q.queryOne<{ amount: string; notes: string; payment_type: string; payment_date: string }>(
			`SELECT amount, notes, payment_type, TO_CHAR(payment_date, 'YYYY-MM-DD') AS payment_date FROM lending_payments WHERE user_id = $1`,
			[F]
		);
		check('recovered payment row created', !!impPay, JSON.stringify(impPay));
		check('recovered payment amount 300', Number(impPay?.amount) === 300, String(impPay?.amount));
		check('recovered payment notes Imported', impPay?.notes === 'Imported', String(impPay?.notes));
		check('recovered payment type payment', impPay?.payment_type === 'payment', String(impPay?.payment_type));

		const res2 = (await li.importLendingsForUser(F, file, JSON.stringify({ dateFormat: 'YYYY-MM-DD' }), 'lent')) as unknown as ImportResult;
		check('re-import skips duplicates', res2?.success === true && res2?.imported === 0 && res2?.skippedDuplicates === 2, JSON.stringify(res2));
		const impCount2 = (await q.queryMany<{ id: number }>(`SELECT id FROM lendings WHERE user_id = $1`, [F])).length;
		check('no duplicate lendings inserted', impCount2 === 2, `count=${impCount2}`);

		const badFile = new File(['a,b\n1,2'], 'bad.csv', { type: 'text/csv' });
		const badRes = (await li.importLendingsForUser(F, badFile, '', 'lent')) as unknown as ImportResult;
		check('import returns fail(400) on unmappable columns', badRes?.status === 400 && typeof badRes?.data?.error === 'string', JSON.stringify(badRes));

		const failures = results.filter((r) => !r.ok);
		expect(failures, failures.length ? failures.map((f) => `${f.name}: ${f.detail ?? ''}`).join('\n') : 'all checks passed').toEqual([]);
	}, 180_000);
});

function describeUrl(url: string): string {
	try {
		const u = new URL(url);
		return `${u.host}${u.pathname}`;
	} catch {
		return '<unparseable-url>';
	}
}

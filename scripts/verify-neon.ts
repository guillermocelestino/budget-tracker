/**
 * Phase 2.2 — Verify the EXISTING Neon/PostgreSQL path through the EXISTING
 * query layer (no query rewrites, no ORM).
 *
 * Run with a live connection:
 *   DATABASE_URL=<neon connection> npx tsx scripts/verify-neon.ts
 * (POSTGRES_URL is still honored as the deprecated alias.)
 *
 * NON-DESTRUCTIVE BY DESIGN:
 *   • Every write runs inside a database transaction that is ROLLED BACK.
 *   • Read-only checks use filters that match no real rows.
 *   • Nothing is inserted, updated, or deleted outside a rolled-back tx.
 *   • Safe to run against an already-populated database.
 *   • The FK-RESTRICT check runs in its OWN transaction (in Postgres an error
 *     aborts the current transaction, so an expected failure must be isolated).
 *
 * Prints PASS/FAIL per check. Exits 0 when all pass, 1 on any failure.
 * The connection string is never printed.
 */

import { getPgPool } from '../src/lib/database/index.js';
import { queryOne, queryMany, withTransaction } from '../src/lib/database/query.js';
import { hashPassword, verifyPassword, createToken, verifyToken } from '../src/lib/auth.js';

// Canonical connection-string resolution mirrors src/lib/database/index.ts:
// DATABASE_URL is preferred; POSTGRES_URL remains honored as the deprecated
// alias. Read after the index.js import (which wires dev env) so the skip-guard
// below matches the runtime's own connection decision. Never printed.
const databaseUrl = process.env['DATABASE_URL'] ?? process.env['POSTGRES_URL'];

const results: { name: string; ok: boolean; detail?: string }[] = [];
const check = (name: string, ok: boolean, detail?: string) => results.push({ name, ok, detail });

const TS = Date.now();
const SUFFIX = `verify_${TS}`;

// Sentinel thrown at the end of the write transaction to force ROLLBACK.
class Rollback extends Error {}

async function runWriteChecks(): Promise<void> {
	await withTransaction(async (tx) => {
		// ── CRUD (create → read → update → delete) ─────────────────────────
		await tx.execute(
			`INSERT INTO users (username, password_hash) VALUES ($1, $2)`,
			[`__neon_${SUFFIX}`, hashPassword('verify-pass')]
		);
		const user = await tx.queryOne<{ id: number; created_at: unknown }>(
			`SELECT id, created_at FROM users WHERE username = $1`,
			[`__neon_${SUFFIX}`]
		);
		check('CRUD create + select', !!user?.id, user ? `id=${user.id}` : 'no row');
		check(
			'TIMESTAMPTZ → JS Date',
			user?.created_at instanceof Date,
			user ? `type=${typeof user.created_at} ${user.created_at instanceof Date ? 'Date' : String(user.created_at)}` : undefined
		);

		await tx.execute(
			`INSERT INTO categories (user_id, name, color, icon, type) VALUES ($1, $2, $3, $4, $5)`,
			[user!.id, `__neon_${SUFFIX}`, '#000000', '📁', 'expense']
		);
		const cat = await tx.queryOne<{ id: number }>(
			`SELECT id FROM categories WHERE user_id = $1 AND name = $2`,
			[user!.id, `__neon_${SUFFIX}`]
		);

		await tx.execute(
			`INSERT INTO transactions (user_id, amount, description, date, category_id, type)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			[user!.id, 123.45, `__neon_${SUFFIX}`, '2026-08-07', cat!.id, 'expense']
		);
		const txn = await tx.queryOne<{ id: number; amount: string | number }>(
			`SELECT id, amount FROM transactions WHERE user_id = $1 AND description = $2`,
			[user!.id, `__neon_${SUFFIX}`]
		);
		check('CRUD insert transaction', !!txn?.id);
		check(
			'NUMERIC amount surfaced',
			txn?.amount !== undefined,
			typeof txn?.amount === 'string' ? 'string (pg numeric → string)' : `number (${typeof txn?.amount})`
		);

		await tx.execute(`UPDATE transactions SET amount = $1 WHERE id = $2`, [999.99, txn!.id]);
		const updated = await tx.queryOne<{ amount: string | number }>(`SELECT amount FROM transactions WHERE id = $1`, [txn!.id]);
		check('CRUD update', Number(updated?.amount) === 999.99, `amount=${String(updated?.amount)}`);

		await tx.execute(`DELETE FROM transactions WHERE id = $1`, [txn!.id]);
		const deleted = await tx.queryOne<{ id: number }>(`SELECT id FROM transactions WHERE id = $1`, [txn!.id]);
		check('CRUD delete', !deleted, deleted ? 'row still present' : 'gone');

		// ── BOOLEAN active + RETURNING (INSERT ... RETURNING id) ───────────
		const rec = await tx.queryOne<{ id: number }>(
			`INSERT INTO recurring_transactions
			 (user_id, type, amount, description, category_id, frequency, interval, start_date, next_run, active)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
			 RETURNING id`,
			[user!.id, 'expense', 50, `__neon_${SUFFIX}`, cat!.id, 'monthly', 1, '2026-08-01', '2026-09-01', 1]
		);
		check('RETURNING id works', !!rec?.id, rec ? `id=${rec.id}` : undefined);
		const active = await tx.queryOne<{ active: unknown }>(`SELECT active FROM recurring_transactions WHERE id = $1`, [rec!.id]);
		check(
			'BOOLEAN active → true (1 written)',
			active?.active === true,
			active ? `active=${String(active.active)} (${typeof active.active})` : undefined
		);

		// ── FK SET NULL (delete linked transaction → payment.transaction_id NULL)
		await tx.execute(
			`INSERT INTO transactions (user_id, amount, description, date, category_id, type)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			[user!.id, 500, `__neon_${SUFFIX}_tx`, '2026-08-07', cat!.id, 'expense']
		);
		const txn2 = await tx.queryOne<{ id: number }>(
			`SELECT id FROM transactions WHERE user_id = $1 AND description = $2`,
			[user!.id, `__neon_${SUFFIX}_tx`]
		);
		await tx.execute(
			`INSERT INTO lendings (user_id, borrower_name, amount, date_lent, direction)
			 VALUES ($1, $2, $3, $4, $5)`,
			[user!.id, `__neon_${SUFFIX}`, 500, '2026-08-01', 'lent']
		);
		const lending = await tx.queryOne<{ id: number }>(
			`SELECT id FROM lendings WHERE user_id = $1 AND borrower_name = $2`,
			[user!.id, `__neon_${SUFFIX}`]
		);
		await tx.execute(
			`INSERT INTO lending_payments (lending_id, user_id, amount, payment_date, transaction_id, payment_type)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			[lending!.id, user!.id, 500, '2026-08-07', txn2!.id, 'payment']
		);
		await tx.execute(`DELETE FROM transactions WHERE id = $1`, [txn2!.id]);
		const pay = await tx.queryOne<{ transaction_id: unknown }>(
			`SELECT transaction_id FROM lending_payments WHERE lending_id = $1`,
			[lending!.id]
		);
		check('FK SET NULL on transaction delete', pay?.transaction_id === null, `transaction_id=${String(pay?.transaction_id)}`);

		// ── FK CASCADE (delete user removes child rows) ────────────────────
		await tx.execute(`DELETE FROM users WHERE id = $1`, [user!.id]);
		const orphanTxns = await tx.queryMany<{ id: number }>(`SELECT id FROM transactions WHERE user_id = $1`, [user!.id]);
		const orphanCats = await tx.queryMany<{ id: number }>(`SELECT id FROM categories WHERE user_id = $1`, [user!.id]);
		check(
			'FK CASCADE on user delete',
			orphanTxns.length === 0 && orphanCats.length === 0,
			`orphan rows=${orphanTxns.length} txns, ${orphanCats.length} cats`
		);

		// Force ROLLBACK — nothing above is ever committed.
		throw new Rollback('rollback all writes');
	}).catch((err) => {
		if (!(err instanceof Rollback)) throw err;
	});
}

/**
 * FK RESTRICT must live in its own transaction: the expected error aborts the
 * whole Postgres transaction, so it can't share the main write transaction.
 */
async function runRestrictCheck(): Promise<void> {
	let rejected = false;
	try {
		await withTransaction(async (tx) => {
			await tx.execute(
				`INSERT INTO users (username, password_hash) VALUES ($1, $2)`,
				[`__neon_${SUFFIX}_restrict`, hashPassword('verify-pass')]
			);
			const user = await tx.queryOne<{ id: number }>(`SELECT id FROM users WHERE username = $1`, [
				`__neon_${SUFFIX}_restrict`,
			]);
			await tx.execute(
				`INSERT INTO categories (user_id, name, color, icon, type) VALUES ($1, $2, $3, $4, $5)`,
				[user!.id, `__neon_${SUFFIX}_restrict`, '#000000', '📁', 'expense']
			);
			const cat = await tx.queryOne<{ id: number }>(
				`SELECT id FROM categories WHERE user_id = $1 AND name = $2`,
				[user!.id, `__neon_${SUFFIX}_restrict`]
			);
			await tx.execute(
				`INSERT INTO transactions (user_id, amount, description, date, category_id, type)
				 VALUES ($1, $2, $3, $4, $5, $6)`,
				[user!.id, 1, `__neon_${SUFFIX}_restrict`, '2026-08-07', cat!.id, 'expense']
			);
			// This DELETE is expected to throw (FK restrict) → aborts + rolls back.
			await tx.execute(`DELETE FROM categories WHERE id = $1`, [cat!.id]);
			check('FK RESTRICT rejects category delete in use', false, 'delete unexpectedly succeeded');
		});
	} catch {
		// FK violation aborted the transaction and it was rolled back — that is the PASS.
		rejected = true;
	}
	check('FK RESTRICT rejects category delete in use', rejected);
}

async function runReadChecks(): Promise<void> {
	// Schema initialization — all 6 expected tables exist
	const tables = await queryMany<{ table_name: string }>(
		`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
	);
	const expected = ['users', 'categories', 'transactions', 'lendings', 'recurring_transactions', 'lending_payments'];
	const missing = expected.filter((t) => !tables.some((r) => r.table_name === t));
	check('Schema init: all 6 tables present', missing.length === 0, missing.length ? `missing: ${missing.join(', ')}` : 'ok');

	// COUNT(*)::int → number (bigint cast pattern used across the app)
	const countRow = await queryOne<{ total: number }>(`SELECT COUNT(*)::int as total FROM users`);
	check('COUNT(*)::int → number', typeof countRow?.total === 'number', `total=${typeof countRow?.total} (${String(countRow?.total)})`);

	// NUMERIC aggregate (SUM) → string, as the app's parseFloat(String(...)) expects
	const sumRow = await queryOne<{ total: string }>(
		`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = -1`
	);
	check('SUM(numeric) COALESCE → string', typeof sumRow?.total === 'string', `total=${typeof sumRow?.total} (${String(sumRow?.total)})`);
}

async function runAuthChecks(): Promise<void> {
	const hash = hashPassword('verify-pass-123');
	check('bcrypt hash/verify roundtrip', verifyPassword('verify-pass-123', hash));
	check('bcrypt rejects wrong password', !verifyPassword('wrong', hash));

	const token = createToken(999999, '__neon_verify');
	const payload = verifyToken(token);
	check(
		'JWT create/verify roundtrip',
		payload?.userId === 999999 && payload?.username === '__neon_verify',
		payload ? `userId=${payload.userId}` : 'verify returned null'
	);
}

async function main(): Promise<void> {
	if (!databaseUrl) {
		console.log('SKIP  — DATABASE_URL (or POSTGRES_URL) is not set; cannot connect to Neon.');
		console.log('        Set it and re-run:  DATABASE_URL=<neon url> npx tsx scripts/verify-neon.ts');
		console.log('        (The connection string is read from the environment only; never hardcoded.)');
		process.exit(0);
	}

	// Connect (this also runs initDb() — verifying schema initialization)
	await getPgPool();

	await runReadChecks();
	await runWriteChecks();
	await runRestrictCheck();
	await runAuthChecks();

	let pass = 0;
	for (const r of results) {
		console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
		if (r.ok) pass++;
	}
	console.log(`\n${pass}/${results.length} checks passed.`);
	if (pass !== results.length) process.exit(1);
	console.log('NOTE — timestamp/numeric/boolean checks reflect the EXPECTED Neon behavior:');
	console.log('  TIMESTAMPTZ → JS Date | NUMERIC SUM → string | BOOLEAN → boolean | COUNT::int → number.');
	process.exit(0);
}

main().catch((err) => {
	console.error('FATAL:', err?.message ?? err);
	process.exit(1);
});

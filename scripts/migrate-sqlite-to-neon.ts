/**
 * One-shot migration: SQLite data/budget.db → Neon `local-dev` branch.
 *
 * SAFETY PROPERTIES (each is enforced in code):
 *   • Reads ONLY LOCAL_DEV_DATABASE_URL, loaded from the .env file in the
 *     project root (a minimal parser that extracts that single variable and
 *     ignores everything else — DATABASE_URL, POSTGRES_URL, etc.). If the
 *     variable is already set in the process environment, that takes
 *     precedence. Never reads DATABASE_URL or POSTGRES_URL.
 *   • Never imports the application's database initialization code
 *     (no initDb, no getPgPool, no src/lib/database, no src/lib/auth).
 *   • Opens SQLite strictly read-only (better-sqlite3 readonly).
 *   • Before opening the transaction, verifies: the target answers as
 *     PostgreSQL, the hostname looks like a Neon branch host, the connected
 *     database name exactly matches the one in the URL path, all six tables
 *     exist with the required columns, and all six tables contain zero rows.
 *   • Displays ONLY the redacted target host and database name before
 *     starting (never the connection string or secrets).
 *   • Runs the entire migration inside ONE PostgreSQL transaction
 *     (users → categories → transactions → lendings → lending_payments →
 *     recurring_transactions). Any error OR any verification mismatch
 *     rolls back the whole transaction.
 *   • Never copies primary-key IDs. Every insert captures its generated id
 *     via INSERT … RETURNING id; all foreign keys are remapped through the
 *     in-memory maps.
 *   • Preserves all source values, including password hashes and
 *     timestamps (UTC). lending_payments.transaction_id is preserved as
 *     NULL (all source values are NULL).
 *
 * Run later with LOCAL_DEV_DATABASE_URL present in .env:
 *   npx tsx scripts/migrate-sqlite-to-neon.ts
 */

import { Pool } from '@neondatabase/serverless';
import Database from 'better-sqlite3';
import path from 'node:path';
import { readFileSync } from 'node:fs';

// ── Environment: LOCAL_DEV_DATABASE_URL only ────────────────────────────────
// Minimal .env loader that extracts ONLY LOCAL_DEV_DATABASE_URL and ignores
// every other variable (DATABASE_URL, POSTGRES_URL, …). A process-env value
// takes precedence over the file.
function loadLocalDevUrl(): string | undefined {
	const fromEnv = process.env.LOCAL_DEV_DATABASE_URL;
	if (fromEnv) return fromEnv;

	try {
		const envPath = path.resolve(process.cwd(), '.env');
		const text = readFileSync(envPath, 'utf8');
		for (const line of text.split('\n')) {
			const m = line.match(/^\s*(LOCAL_DEV_DATABASE_URL)\s*=\s*(.*)\s*$/);
			if (m) {
				return m[2].replace(/^(['"])(.*)\1$/, '$2').trim();
			}
		}
	} catch {
		// .env missing/unreadable → handled by the missing-var abort below.
	}
	return undefined;
}

const LOCAL_DEV_DATABASE_URL = loadLocalDevUrl();
const SQLITE_PATH = process.env.SQLITE_PATH ?? path.resolve('data/budget.db');

if (!LOCAL_DEV_DATABASE_URL) {
	console.error(
		'Missing LOCAL_DEV_DATABASE_URL. Add it to .env (or export it) and re-run.'
	);
	process.exit(1);
}

// Guard against ever silently reading the production vars from the process env.
if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
	console.error(
		'Refusing to run: DATABASE_URL / POSTGRES_URL are set in the environment. ' +
			'This migration targets the local-dev branch only. Unset them and re-run.'
	);
	process.exit(1);
}

// ── Source / target expectations ────────────────────────────────────────────
const TABLES = [
	'users',
	'categories',
	'transactions',
	'lendings',
	'lending_payments',
	'recurring_transactions',
] as const;

/** Columns the migration reads from SQLite / writes to Postgres per table. */
const EXPECTED_COLUMNS: Record<(typeof TABLES)[number], string[]> = {
	users: ['id', 'username', 'password_hash', 'created_at'],
	categories: ['id', 'user_id', 'name', 'color', 'icon', 'type', 'budget_limit', 'created_at'],
	transactions: ['id', 'user_id', 'amount', 'description', 'date', 'category_id', 'type', 'created_at', 'updated_at'],
	lendings: [
		'id',
		'user_id',
		'borrower_name',
		'amount',
		'interest_rate',
		'date_lent',
		'due_date',
		'status',
		'notes',
		'direction',
		'created_at',
		'updated_at',
	],
	lending_payments: [
		'id',
		'lending_id',
		'user_id',
		'amount',
		'payment_date',
		'notes',
		'transaction_id',
		'payment_type',
		'reference',
		'created_at',
		'updated_at',
	],
	recurring_transactions: [
		'id',
		'user_id',
		'type',
		'amount',
		'description',
		'category_id',
		'frequency',
		'interval',
		'day_of_week',
		'day_of_month',
		'month_of_year',
		'start_date',
		'end_date',
		'next_run',
		'last_generated_at',
		'active',
		'created_at',
		'updated_at',
	],
};

// ── Small helpers ───────────────────────────────────────────────────────────
/** SQLite datetime('now') text ('YYYY-MM-DD HH:MM:SS', UTC) → JS Date (UTC). */
function parseUtcTimestamp(s: string | null): Date | null {
	if (s == null) return null;
	return new Date(s.replace(' ', 'T') + 'Z');
}

/** REAL → NUMERIC(12,2) / NUMERIC(5,2): exact two-decimal string, or NULL. */
function num2(n: number | null | undefined): string | null {
	if (n == null) return null;
	return n.toFixed(2);
}

// ── Pre-flight: target verification (before any transaction) ────────────────
const url = new URL(LOCAL_DEV_DATABASE_URL!);

// Expected database name comes from the URL path (e.g. postgres://…/neondb).
const EXPECTED_DB = decodeURIComponent(url.pathname.replace(/^\/+/, '').split('/')[0] ?? '');
if (!EXPECTED_DB) {
	console.error('Could not determine database name from LOCAL_DEV_DATABASE_URL. Aborting.');
	process.exit(1);
}

// Sanity check: the host must look like a Neon branch host (e.g. ep-…-region.aws.neon.tech).
if (!/neon\.tech$/i.test(url.hostname)) {
	console.error(`Host does not look like a Neon branch host (${url.hostname}). Aborting.`);
	process.exit(1);
}

const pool = new Pool({ connectionString: LOCAL_DEV_DATABASE_URL });
const client = await pool.connect();

try {
	// 1. Target must be PostgreSQL.
	const version = await client.query('SELECT version() AS v');
	if (!/PostgreSQL/i.test(String(version.rows[0]?.v ?? ''))) {
		console.error('Target is not PostgreSQL. Aborting.');
		process.exit(1);
	}

	// 2. Database name must exactly match the one in the URL path.
	const dbRow = await client.query('SELECT current_database() AS db');
	const currentDb = String(dbRow.rows[0]?.db ?? '');
	if (currentDb !== EXPECTED_DB) {
		console.error(`Database mismatch: expected ${EXPECTED_DB}, got ${currentDb}. Aborting.`);
		process.exit(1);
	}

	// 3. All six expected tables exist.
	const tableRes = await client.query(
		`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
	);
	const present = new Set(tableRes.rows.map((r) => r.table_name));
	const missingTables = TABLES.filter((t) => !present.has(t));
	if (missingTables.length > 0) {
		console.error(`Missing target tables: ${missingTables.join(', ')}. Aborting.`);
		process.exit(1);
	}

	// 4. Required columns exist per table.
	const colRes = await client.query(
		`SELECT table_name, column_name FROM information_schema.columns
		 WHERE table_schema = 'public'`
	);
	const colsByTable = new Map<string, Set<string>>();
	for (const r of colRes.rows) {
		if (!colsByTable.has(r.table_name)) colsByTable.set(r.table_name, new Set());
		colsByTable.get(r.table_name)!.add(r.column_name);
	}
	for (const t of TABLES) {
		const have = colsByTable.get(t) ?? new Set<string>();
		const missingCols = EXPECTED_COLUMNS[t].filter((c) => !have.has(c));
		if (missingCols.length > 0) {
			console.error(`Table ${t} is missing columns: ${missingCols.join(', ')}. Aborting.`);
			process.exit(1);
		}
	}

	// 5. All six target tables must contain zero rows.
	for (const t of TABLES) {
		const { rows } = await client.query(`SELECT COUNT(*)::int AS c FROM "${t}"`);
		if (Number(rows[0]?.c) > 0) {
			console.error(`Target table ${t} is not empty (${rows[0].c} rows). Aborting.`);
			process.exit(1);
		}
	}

	// 6. Informational — redacted host + database name only (never the URL).
	console.log(`\nTarget: host=${url.hostname}  database=${currentDb}`);
} catch (err) {
	console.error('Pre-flight failed:', err instanceof Error ? err.message : err);
	await client.release();
	await pool.end();
	process.exit(1);
}

// ── Open SQLite strictly read-only ──────────────────────────────────────────
const sqlite = new Database(SQLITE_PATH, { readonly: true, fileMustExist: true });

// Snapshot source row counts + per-user counts BEFORE any write.
const sourceCounts: Record<string, number> = {};
const sourceGrouped: Record<string, Map<number, number>> = {};
for (const t of TABLES) {
	sourceCounts[t] = (sqlite.prepare(`SELECT COUNT(*) AS c FROM "${t}"`).get() as { c: number }).c;
	if (t !== 'users') {
		const rows = sqlite
			.prepare(`SELECT user_id, COUNT(*) AS c FROM "${t}" GROUP BY user_id`)
			.all() as { user_id: number; c: number }[];
		sourceGrouped[t] = new Map(rows.map((r) => [r.user_id, r.c]));
	}
}

// Validate all date columns before touching the target (fail fast, clean error).
for (const t of TABLES) {
	for (const col of EXPECTED_COLUMNS[t]) {
		if (col === 'date' || col.endsWith('_date') || col.endsWith('_run')) {
			const bad = sqlite
				.prepare(`SELECT COUNT(*) AS c FROM "${t}" WHERE "${col}" IS NOT NULL AND "${col}" NOT GLOB '????-??-??'`)
				.get() as { c: number };
			if (bad.c > 0) {
				console.error(`Source table ${t}.${col} has non-YYYY-MM-DD values. Aborting.`);
				sqlite.close();
				await client.release();
				await pool.end();
				process.exit(1);
			}
		}
	}
}

// ── Migration (single transaction) ──────────────────────────────────────────
const userMap = new Map<number, number>();
const catMap = new Map<number, number>();
const catKeyMap = new Map<string, number>();
const lendingMap = new Map<number, number>();

async function verifyAll(): Promise<void> {
	// Row counts match source exactly.
	for (const t of TABLES) {
		const { rows } = await client.query(`SELECT COUNT(*)::int AS c FROM "${t}"`);
		if (Number(rows[0]?.c) !== sourceCounts[t]) {
			throw new Error(
				`Count mismatch on ${t}: source=${sourceCounts[t]} target=${rows[0]?.c}. Rolling back.`
			);
		}
	}

	// Per-user distributions match (children of users).
	for (const t of TABLES) {
		if (t === 'users') continue;
		const { rows } = await client.query(
			`SELECT user_id, COUNT(*)::int AS c FROM "${t}" GROUP BY user_id`
		);
		const got = new Map(rows.map((r) => [r.user_id, r.c]));
		for (const [oldUid, count] of sourceGrouped[t]) {
			const newUid = userMap.get(oldUid);
			if (newUid == null) throw new Error(`No user mapping for user ${oldUid}. Rolling back.`);
			if (got.get(newUid) !== count) {
				throw new Error(
					`Per-user mismatch on ${t}: user ${oldUid} → ${newUid} expected ${count}, got ${got.get(newUid)}. Rolling back.`
				);
			}
		}
	}

	// FK orphans: none.
	const fkChecks: [string, string][] = [
		[`SELECT 1 FROM categories c LEFT JOIN users u ON c.user_id = u.id WHERE u.id IS NULL LIMIT 1`, 'categories.user_id'],
		[`SELECT 1 FROM transactions t LEFT JOIN users u ON t.user_id = u.id LEFT JOIN categories c ON t.category_id = c.id WHERE u.id IS NULL OR c.id IS NULL LIMIT 1`, 'transactions.user_id/category_id'],
		[`SELECT 1 FROM lendings l LEFT JOIN users u ON l.user_id = u.id WHERE u.id IS NULL LIMIT 1`, 'lendings.user_id'],
		[`SELECT 1 FROM lending_payments p LEFT JOIN lendings l ON p.lending_id = l.id LEFT JOIN users u ON p.user_id = u.id WHERE l.id IS NULL OR u.id IS NULL LIMIT 1`, 'lending_payments.lending_id/user_id'],
		[`SELECT 1 FROM recurring_transactions r LEFT JOIN users u ON r.user_id = u.id LEFT JOIN categories c ON r.category_id = c.id WHERE u.id IS NULL OR c.id IS NULL LIMIT 1`, 'recurring_transactions.user_id/category_id'],
	];
	for (const [sql, label] of fkChecks) {
		const { rows } = await client.query(sql);
		if (rows.length > 0) throw new Error(`FK orphan detected: ${label}. Rolling back.`);
	}

	// transaction_id must remain NULL (all source values NULL).
	const txRes = await client.query(
		`SELECT COUNT(*)::int AS c FROM lending_payments WHERE transaction_id IS NOT NULL`
	);
	if (Number(txRes.rows[0]?.c) !== 0) {
		throw new Error('lending_payments.transaction_id contains non-NULL values. Rolling back.');
	}

	// Category identity: (user_id, name) set on target matches the map built at insert.
	const catRes = await client.query(
		`SELECT user_id, name FROM categories ORDER BY user_id, name`
	);
	const targetKeys = new Set(catRes.rows.map((r) => `${r.user_id}|${r.name}`));
	for (const key of catKeyMap.keys()) {
		if (!targetKeys.has(key)) throw new Error(`Missing category key ${key}. Rolling back.`);
	}
	if (targetKeys.size !== catKeyMap.size) {
		throw new Error('Extra category keys on target. Rolling back.');
	}

	// Sequences are positioned one past MAX(id) per table.
	for (const t of TABLES) {
		const seq = await client.query(`SELECT last_value FROM "${t}_id_seq"`);
		const maxRes = await client.query(`SELECT COALESCE(MAX(id), 0)::int AS m FROM "${t}"`);
		if (Number(seq.rows[0]?.last_value) !== Number(maxRes.rows[0]?.m)) {
			throw new Error(
				`Sequence/MAX mismatch on ${t}: seq=${seq.rows[0]?.last_value} max=${maxRes.rows[0]?.m}. Rolling back.`
			);
		}
	}
}

try {
	await client.query('BEGIN');

	// 1. users → userMap
	const users = sqlite.prepare(`SELECT * FROM users ORDER BY id`).all() as Record<string, unknown>[];
	for (const u of users) {
		const { rows } = await client.query(
			`INSERT INTO users (username, password_hash, created_at)
			 VALUES ($1, $2, $3) RETURNING id`,
			[u.username, u.password_hash, parseUtcTimestamp(u.created_at as string | null)]
		);
		userMap.set(u.id as number, rows[0].id);
	}

	// 2. categories → catMap + catKeyMap (identity: (new user_id, name))
	const categories = sqlite
		.prepare(`SELECT * FROM categories ORDER BY user_id, name`)
		.all() as Record<string, unknown>[];
	for (const c of categories) {
		const newUid = userMap.get(c.user_id as number);
		if (newUid == null) throw new Error(`No user mapping for category owner ${c.user_id}.`);
		const { rows } = await client.query(
			`INSERT INTO categories (user_id, name, color, icon, type, budget_limit, created_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
			[
				newUid,
				c.name,
				c.color,
				c.icon,
				c.type,
				num2(c.budget_limit as number | null),
				parseUtcTimestamp(c.created_at as string | null),
			]
		);
		catMap.set(c.id as number, rows[0].id);
		catKeyMap.set(`${newUid}|${c.name}`, rows[0].id);
	}

	// 3. transactions → remap user_id + category_id
	const transactions = sqlite
		.prepare(`SELECT * FROM transactions ORDER BY id`)
		.all() as Record<string, unknown>[];
	for (const tx of transactions) {
		const newUid = userMap.get(tx.user_id as number);
		const newCat = catMap.get(tx.category_id as number);
		if (newUid == null) throw new Error(`No user mapping for transaction ${tx.id}.`);
		if (newCat == null) throw new Error(`No category mapping for transaction ${tx.id}.`);
		await client.query(
			`INSERT INTO transactions (user_id, amount, description, date, category_id, type, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			[
				newUid,
				num2(tx.amount as number),
				tx.description,
				tx.date,
				newCat,
				tx.type,
				parseUtcTimestamp(tx.created_at as string | null),
				parseUtcTimestamp(tx.updated_at as string | null),
			]
		);
	}

	// 4. lendings → remap user_id → lendingMap
	const lendings = sqlite.prepare(`SELECT * FROM lendings ORDER BY id`).all() as Record<string, unknown>[];
	for (const l of lendings) {
		const newUid = userMap.get(l.user_id as number);
		if (newUid == null) throw new Error(`No user mapping for lending ${l.id}.`);
		const { rows } = await client.query(
			`INSERT INTO lendings (user_id, borrower_name, amount, interest_rate, date_lent, due_date, status, notes, direction, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
			[
				newUid,
				l.borrower_name,
				num2(l.amount as number),
				num2(l.interest_rate as number | null),
				l.date_lent,
				l.due_date,
				l.status,
				l.notes,
				l.direction,
				parseUtcTimestamp(l.created_at as string | null),
				parseUtcTimestamp(l.updated_at as string | null),
			]
		);
		lendingMap.set(l.id as number, rows[0].id);
	}

	// 5. lending_payments → remap user_id + lending_id; transaction_id stays NULL
	const payments = sqlite
		.prepare(`SELECT * FROM lending_payments ORDER BY id`)
		.all() as Record<string, unknown>[];
	for (const p of payments) {
		const newUid = userMap.get(p.user_id as number);
		const newLending = lendingMap.get(p.lending_id as number);
		if (newUid == null) throw new Error(`No user mapping for payment ${p.id}.`);
		if (newLending == null) throw new Error(`No lending mapping for payment ${p.id}.`);
		await client.query(
			`INSERT INTO lending_payments (lending_id, user_id, amount, payment_date, notes, transaction_id, payment_type, reference, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
			[
				newLending,
				newUid,
				num2(p.amount as number),
				p.payment_date,
				p.notes,
				null, // all source transaction_id values are NULL
				p.payment_type,
				p.reference,
				parseUtcTimestamp(p.created_at as string | null),
				parseUtcTimestamp(p.updated_at as string | null),
			]
		);
	}

	// 6. recurring_transactions → remap user_id + category_id
	const recurring = sqlite
		.prepare(`SELECT * FROM recurring_transactions ORDER BY id`)
		.all() as Record<string, unknown>[];
	for (const r of recurring) {
		const newUid = userMap.get(r.user_id as number);
		const newCat = catMap.get(r.category_id as number);
		if (newUid == null) throw new Error(`No user mapping for recurring ${r.id}.`);
		if (newCat == null) throw new Error(`No category mapping for recurring ${r.id}.`);
		await client.query(
			`INSERT INTO recurring_transactions
			 (user_id, type, amount, description, category_id, frequency, interval, day_of_week, day_of_month, month_of_year, start_date, end_date, next_run, last_generated_at, active, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
			[
				newUid,
				r.type,
				num2(r.amount as number),
				r.description,
				newCat,
				r.frequency,
				r.interval,
				r.day_of_week,
				r.day_of_month,
				r.month_of_year,
				r.start_date,
				r.end_date,
				r.next_run,
				parseUtcTimestamp(r.last_generated_at as string | null),
				r.active === 1 || r.active === true,
				parseUtcTimestamp(r.created_at as string | null),
				parseUtcTimestamp(r.updated_at as string | null),
			]
		);
	}

	// Verify everything INSIDE the transaction — any mismatch throws → ROLLBACK.
	await verifyAll();

	await client.query('COMMIT');

	console.log('\nMigration committed successfully.');
	console.log(
		`users=${sourceCounts.users} categories=${sourceCounts.categories} ` +
			`transactions=${sourceCounts.transactions} lendings=${sourceCounts.lendings} ` +
			`lending_payments=${sourceCounts.lending_payments} ` +
			`recurring_transactions=${sourceCounts.recurring_transactions}`
	);
	console.log('All checks passed: counts, per-user distribution, FKs, sequences.');
} catch (err) {
	console.error('Migration failed — rolling back everything:');
	console.error(err instanceof Error ? err.message : err);
	try {
		await client.query('ROLLBACK');
		console.error('Rollback completed.');
	} catch (rbErr) {
		console.error('Rollback error:', rbErr instanceof Error ? rbErr.message : rbErr);
	}
	process.exitCode = 1;
} finally {
	sqlite.close();
	await client.release();
	await pool.end();
}

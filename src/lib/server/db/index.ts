import './loadEnv'; // dev-only: wire LOCAL_DEV_DATABASE_URL → DATABASE_URL (see loadEnv.ts)
import { Pool, types } from '@neondatabase/serverless';

// Postgres returns NUMERIC (OID 1700) columns as strings to avoid precision
// loss; SQLite returns them as JS numbers. Coerce to numbers so both backends
// behave identically (the app's types are `number`). Registered once at module
// load; affects every connection from the shared Pool.
types.setTypeParser(1700, (value: string) => parseFloat(value));

/**
 * Canonical database connection string.
 * `DATABASE_URL` is the canonical name; `POSTGRES_URL` is a deprecated alias
 * kept for backwards compatibility during the Neon migration. Both point at
 * the same Neon/Postgres connection (never hardcoded, always from the env).
 */
const databaseUrl = process.env['DATABASE_URL'] ?? process.env['POSTGRES_URL'];

let pgPool: Pool | null = null;
let dbInitialized = false;

export async function initDb(): Promise<void> {
	// Dynamic import to avoid init.ts loading better-sqlite3 at module load time
	const { initDb: runInitDb } = await import('./init');
	await runInitDb();
}

export async function getPgPool(): Promise<Pool> {
	// Lazy-init: ensure schema exists before first DB access.
	// Flag is set BEFORE calling initDb() to prevent re-entrant
	// recursion if initDb() itself calls getPgPool().
	if (!dbInitialized) {
		dbInitialized = true;
		await initDb();
	}
	if (!pgPool) {
		if (!databaseUrl) {
			throw new Error('DATABASE_URL (or the deprecated POSTGRES_URL alias) is not set. Configure DATABASE_URL in your environment.');
		}
		pgPool = new Pool({
			connectionString: databaseUrl
		});
	}
	return pgPool;
}

export async function closeDb(): Promise<void> {
	if (pgPool) {
		await pgPool.end();
		pgPool = null;
	}
}
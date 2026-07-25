import { Pool } from '@neondatabase/serverless';
import path from 'node:path';
import fs from 'node:fs';
import type { Database } from 'better-sqlite3';

export const usePostgres = process.env['POSTGRES_URL'] !== undefined;

let pgPool: Pool | null = null;
let sqliteDb: Database | null = null;
let dbInitialized = false;

export async function initDb(): Promise<void> {
	// Dynamic import to avoid init.ts loading better-sqlite3 at module load time
	const { initDb: runInitDb } = await import('./init');
	await runInitDb();
}

export async function getPgPool(): Promise<Pool> {
	// Lazy-init: ensure schema exists before first DB access.
	// Flag is set BEFORE calling initDb() to prevent re-entrant
	// recursion if initDb() itself calls getSQLiteDb().
	if (!dbInitialized) {
		dbInitialized = true;
		await initDb();
	}
	if (!pgPool) {
		pgPool = new Pool({
			connectionString: process.env['POSTGRES_URL']!
		});
	}
	return pgPool;
}

export async function getSQLiteDb(): Promise<Database> {
	// Fail fast: SQLite is not available on Vercel's read-only filesystem
	if (process.env['VERCEL'] && !usePostgres) {
		throw new Error(
			'POSTGRES_URL environment variable is not set. ' +
			'SQLite is not available on Vercel. Set POSTGRES_URL in Vercel project settings.'
		);
	}

	// Lazy-init: ensure schema exists before first DB access.
	// Flag is set BEFORE calling initDb() to prevent re-entrant
	// recursion if initDb() itself calls getSQLiteDb().
	if (!dbInitialized) {
		dbInitialized = true;
		await initDb();
	}

	if (!sqliteDb) {
		const { default: Database } = await import('better-sqlite3');
		const dbDir = path.join(process.cwd(), 'data');
		if (!fs.existsSync(dbDir)) {
			try {
				fs.mkdirSync(dbDir, { recursive: true });
			} catch (err) {
				throw new Error(
					`Cannot create data directory at ${dbDir}. Check filesystem permissions.`,
					{ cause: err }
				);
			}
		}
		sqliteDb = new Database(path.join(dbDir, 'budget.db'));
		sqliteDb.pragma('journal_mode = WAL');
		sqliteDb.pragma('foreign_keys = ON');
	}
	return sqliteDb;
}

export async function closeDb(): Promise<void> {
	if (pgPool) {
		await pgPool.end();
		pgPool = null;
	}
	if (sqliteDb) {
		sqliteDb.close();
		sqliteDb = null;
	}
}

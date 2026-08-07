import { drizzle } from 'drizzle-orm/neon-serverless';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';
import { getPgPool } from './index';

/**
 * Drizzle client for the Neon/Postgres path ONLY.
 *
 * Phase 4 pilot — the existing raw query layer (src/lib/database/query.ts)
 * remains the primary access path for both SQLite and Postgres. Drizzle is
 * additive: services dispatch to it when `usePostgres` is true and keep using
 * `queryOne`/`queryMany`/`execute`/`withTransaction` on the SQLite path.
 *
 * The client reuses the existing lazy-initialized Neon pool from
 * `getPgPool()` — no second connection strategy, no direct access to
 * DATABASE_URL here (connection creation is owned by src/lib/database/index.ts).
 *
 * The client is cached as a promise so a serverless instance reuses one
 * Drizzle instance across requests once the pool exists.
 */
let dbPromise: Promise<NeonDatabase<typeof schema>> | null = null;

export function getDrizzle(): Promise<NeonDatabase<typeof schema>> {
	if (!dbPromise) {
		dbPromise = getPgPool().then((pool) => drizzle(pool, { schema }));
	}
	return dbPromise;
}

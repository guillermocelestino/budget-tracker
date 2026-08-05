import { usePostgres, getPgPool, getSQLiteDb } from './index';

interface TranslatedQuery {
    sql: string;
    paramIndices: number[]; // Maps each ? position to the original param index (0-based)
}

/**
 * Translate PostgreSQL SQL to SQLite, handling parameter placeholders correctly.
 * In Postgres, $N can be reused (e.g., $2 appears twice = same parameter).
 * In SQLite, each ? is a separate positional parameter, so we need to track mapping.
 */
export function translatePgToSQLite(sql: string): TranslatedQuery {
    // First, apply all SQL dialect conversions (ILIKE, casts, TO_CHAR, EXTRACT, NOW, etc.)
    let result = sql
        // Replace ILIKE with LIKE for SQLite (case‑insensitive for ASCII)
        .replace(/\bILIKE\b/gi, 'LIKE')
        // Postgres cast syntax ::int, ::numeric → remove (MUST come before EXTRACT)
        .replace(/::\w+(?:\(\d+(?:,\d+)?\))?/g, '')
        // TO_CHAR(date, 'YYYY-MM') → strftime('%Y-%m', date)
        .replace(/TO_CHAR\(([^,]+),\s*'YYYY-MM'\)/gi, "strftime('%Y-%m', $1)")
        // TO_CHAR(date, 'YYYY') → strftime('%Y', date)
        .replace(/TO_CHAR\(([^,]+),\s*'YYYY'\)/gi, "strftime('%Y', $1)")
        // EXTRACT(YEAR FROM <expr>) → CAST(strftime('%Y', <expr>) AS INTEGER)
        .replace(/EXTRACT\(YEAR\s+FROM\s+((?:[^()]|\([^()]*\))+)\)/gi,
            (_, expr) => `CAST(strftime('%Y', ${expr}) AS INTEGER)`)
        // EXTRACT(MONTH FROM <expr>) → CAST(strftime('%m', <expr>) AS INTEGER)
        .replace(/EXTRACT\(MONTH\s+FROM\s+((?:[^()]|\([^()]*\))+)\)/gi,
            (_, expr) => `CAST(strftime('%m', ${expr}) AS INTEGER)`)
        // NOW() → datetime('now')
        .replace(/\bNOW\(\)/gi, "datetime('now')")
        // CURRENT_DATE → date('now')
        .replace(/\bCURRENT_DATE\b/gi, "date('now')")
        // CURRENT_TIMESTAMP → datetime('now')
        .replace(/\bCURRENT_TIMESTAMP\b/gi, "datetime('now')")
        // Empty parentheses from line-wrapping
        .replace(/\(\s*\)/g, '()');

    // Track parameter mapping: for each ? position, which original param index (0-based) it maps to
    const paramIndices: number[] = [];

    // Replace $N with ? and track mapping for EACH occurrence
    result = result.replace(/\$(\d+)/g, (_, numStr) => {
        const pgNum = parseInt(numStr, 10);
        // Each $N occurrence maps to the same original parameter index (pgNum - 1)
        paramIndices.push(pgNum - 1);
        return '?';
    });

    return { sql: result, paramIndices };
}

/**
 * Apply parameter mapping for SQLite - expands params array to match ? positions
 */
function mapParamsForSqlite(params: unknown[], paramIndices: number[]): unknown[] {
    if (paramIndices.length === params.length) {
        // Simple case: 1:1 mapping (no duplicate parameters)
        return params;
    }
    // Map each ? position to the correct original parameter
    return paramIndices.map(idx => params[idx]);
}

export async function queryOne<T>(text: string, params: unknown[] = []): Promise<T | undefined> {
	if (usePostgres) {
		const client = await getPgPool().connect();
		try {
			const { rows } = await client.query(text, params);
			return rows[0] as T | undefined;
		} finally {
			client.release();
		}
	} else {
		const { sql, paramIndices } = translatePgToSQLite(text);
		const db = await getSQLiteDb();
		const stmt = db.prepare(sql);
		const mappedParams = mapParamsForSqlite(params, paramIndices);
		const result = mappedParams.length > 0 ? stmt.get(...mappedParams) : stmt.get();
		return result as T | undefined;
	}
}

export async function queryMany<T>(text: string, params: unknown[] = []): Promise<T[]> {
	if (usePostgres) {
		const client = await getPgPool().connect();
		try {
			const { rows } = await client.query(text, params);
			return rows as T[];
		} finally {
			client.release();
		}
	} else {
		const { sql, paramIndices } = translatePgToSQLite(text);
		const db = await getSQLiteDb();
		const stmt = db.prepare(sql);
		const mappedParams = mapParamsForSqlite(params, paramIndices);
		const result = mappedParams.length > 0 ? stmt.all(...mappedParams) : stmt.all();
		return result as T[];
	}
}

export async function execute(text: string, params: unknown[] = []): Promise<void> {
	if (usePostgres) {
		const client = await getPgPool().connect();
		try {
			await client.query(text, params);
		} finally {
			client.release();
		}
	} else {
		const { sql, paramIndices } = translatePgToSQLite(text);
		const db = await getSQLiteDb();
		const stmt = db.prepare(sql);
		const mappedParams = mapParamsForSqlite(params, paramIndices);
		if (mappedParams.length > 0) {
			stmt.run(...mappedParams);
		} else {
			stmt.run();
		}
	}
}
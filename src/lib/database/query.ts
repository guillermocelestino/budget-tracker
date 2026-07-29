import { usePostgres, getPgPool, getSQLiteDb } from './index';

export function translatePgToSQLite(sql: string): string {
    // Basic PostgreSQL → SQLite conversion
    // Replace ILIKE (case‑insensitive LIKE) with SQLite's LIKE (which is case‑insensitive for ASCII)
    // This simple substitution works because the app builds the pattern with %…% already.
    // If you need true Unicode case‑insensitivity you could use LOWER(col) LIKE LOWER(val), but
    // for now the built‑in LIKE is sufficient.
    // NOTE: we apply this replacement before the other regexes to avoid accidental
    // interference with other clauses.
    // The replacement is done using a word boundary to avoid matching identifiers.
    // Example: "t.description ILIKE $2" → "t.description LIKE $2"
    // It will also replace any stray "ILIKE" occurrences.
    // The rest of the function proceeds with existing translations.

	return sql
        // Replace ILIKE with LIKE for SQLite (case‑insensitive for ASCII)
        .replace(/\bILIKE\b/gi, 'LIKE')
		// Postgres parameter placeholders $1, $2 → ?
		.replace(/\$\d+/g, '?')
		// Postgres cast syntax ::int, ::numeric → remove (MUST come before EXTRACT)
		.replace(/::\w+(?:\(\d+(?:,\d+)?\))?/g, '')
		// TO_CHAR(date, 'YYYY-MM') → strftime('%Y-%m', date)
		// Supports table-qualified columns like t.date (the [^,]+ captures dots)
		.replace(/TO_CHAR\(([^,]+),\s*'YYYY-MM'\)/gi, "strftime('%Y-%m', $1)")
		// TO_CHAR(date, 'YYYY') → strftime('%Y', date)
		.replace(/TO_CHAR\(([^,]+),\s*'YYYY'\)/gi, "strftime('%Y', $1)")
		// EXTRACT(YEAR FROM <expr>) → CAST(strftime('%Y', <expr>) AS INTEGER)
		// Handles nested parens up to one level deep
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
		const sql = translatePgToSQLite(text);
		const db = await getSQLiteDb();
		const stmt = db.prepare(sql);
		const result = params.length > 0 ? stmt.get(...params) : stmt.get();
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
		const sql = translatePgToSQLite(text);
		const db = await getSQLiteDb();
		const stmt = db.prepare(sql);
		const result = params.length > 0 ? stmt.all(...params) : stmt.all();
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
		const sql = translatePgToSQLite(text);
		const db = await getSQLiteDb();
		const stmt = db.prepare(sql);
		if (params.length > 0) {
			stmt.run(...params);
		} else {
			stmt.run();
		}
	}
}

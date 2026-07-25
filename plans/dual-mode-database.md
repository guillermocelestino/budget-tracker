# Dual-Mode Database: SQLite (Dev) + Postgres (Vercel)

## Context

The app was migrated to Postgres but local development fails without `POSTGRES_URL`. Solution: auto-detect — use SQLite locally (no setup), use Postgres on Vercel (when env var is set).

## Approach

Keep the route files in their current Postgres SQL style (`$1` params, `TO_CHAR`, `NOW()`). The query helper layer translates to SQLite on the fly when needed:

| SQL Feature | Postgres (Vercel) | SQLite (local) |
|-------------|-------------------|----------------|
| Params | `$1, $2, ...` | Auto-convert to `?, ?` |
| Date format | `TO_CHAR(date, 'YYYY-MM')` | `strftime('%Y-%m', date)` |
| Year extract | `EXTRACT(YEAR FROM date)` | `CAST(strftime('%Y', date) AS INTEGER)` |
| Now | `NOW()` | `datetime('now')` |
| Today | `CURRENT_DATE` | `date('now')` |
| Cast syntax | `::int`, `::numeric` | Stripped |

## Changes

### 1. Reinstall better-sqlite3
```bash
npm install better-sqlite3 && npm install -D @types/better-sqlite3
```

### 2. Rewrite `src/lib/database/index.ts`
Detect mode based on `POSTGRES_URL`:

```ts
const usePostgres = !!process.env['POSTGRES_URL'];
```
Expose both `getPostgresPool()` and `getSQLiteDb()` — the query layer picks the right one.

### 3. Rewrite `src/lib/database/query.ts`
The core of the dual-mode support. Each helper function:

```ts
export async function queryMany<T>(text: string, params?: unknown[]): Promise<T[]> {
    if (usePostgres) {
        // Use Neon pool (async, as-is)
        ...
    } else {
        // Use better-sqlite3 with Postgres→SQLite translation
        const sql = translatePgToSQLite(text);
        const stmt = sqliteDb.prepare(sql);
        const p = convertParams(params); // $N → ?
        return stmt.all(...p) as T[];
    }
}
```

Translation function:
- `$1, $2, $3` → `?, ?, ?` (simple counter-based replacement)
- `TO_CHAR(date, 'YYYY-MM')` → `strftime('%Y-%m', date)`
- `EXTRACT(YEAR FROM date)` → `CAST(strftime('%Y', date) AS INTEGER)`
- `EXTRACT(YEAR FROM` → `CAST(strftime('%Y',` (general form)
- `NOW()` → `datetime('now')`
- `CURRENT_DATE` → `date('now')`
- Strip `::int`, `::numeric` Postgres cast suffixes

### 4. Rewrite `src/lib/database/init.ts`
Dual-mode schema:
- Postgres mode: existing Postgres DDL (SERIAL, TIMESTAMPTZ)
- SQLite mode: original SQLite DDL (INTEGER PRIMARY KEY AUTOINCREMENT, TEXT)

### Files Modified

| File | Change |
|------|--------|
| `src/lib/database/index.ts` | Dual-mode: detect env var, expose both connections |
| `src/lib/database/query.ts` | Dual-mode helpers + SQL translation layer |
| `src/lib/database/init.ts` | Dual-schema: pick DDL based on mode |
| `package.json` | Re-add better-sqlite3 + @types |

### Files Unchanged

All route files — they keep Postgres-style queries. The query layer handles translation transparently.

## Verification

1. `npm run dev` → starts with SQLite (no env vars needed)
2. Login, browse, create/edit transactions/categories — all work
3. `POSTGRES_URL=postgres://... npm run dev` → starts with Postgres
4. `npm run build` → vercel adapter + Postgres mode for production

# Dual-Mode Database Compatibility Audit & Fix Plan

## Context

This app uses a **dual-mode database architecture**: SQLite (`better-sqlite3`) for local development, and Postgres (`@neondatabase/serverless`) for Vercel production. The auto-detection is based on whether `POSTGRES_URL` is set. A SQL translation layer in `query.ts` converts Postgres-specific syntax to SQLite on the fly, so route files write Postgres-style SQL and work in both modes.

The existing `plans/dual-mode-database.md` describes the architecture. This document audits **runtime compatibility** across all APIs — local dev vs Vercel — and maps out the fixes needed.

---

## Audit Summary: 11 Issues Found

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | CRITICAL | `src/lib/database/index.ts:22` | SQLite `process.cwd()+'data/'` is not writable on Vercel |
| 2 | CRITICAL | `package.json` + `index.ts:1` | `better-sqlite3` native module bundled on Vercel unnecessarily |
| 3 | HIGH | `src/hooks.server.ts:5` | `initDb()` runs on every cold start |
| 4 | HIGH | `src/lib/auth.ts:4` | Hardcoded fallback JWT secret |
| 5 | MEDIUM | `src/lib/database/query.ts:3-24` | SQL translation regex misses nested expressions |
| 6 | MEDIUM | `src/routes/api/transactions/+server.ts:43` | Dynamic `ORDER BY` string interpolation |
| 7 | MEDIUM | Various API files | `SUM` returns string on Postgres vs number on SQLite |
| 8 | LOW | `src/routes/api/transactions/+server.ts:17-50` | Fragile dynamic `$n` placeholder numbering |
| 9 | LOW | `src/routes/api/categories/+server.ts:46` | Race condition: `ORDER BY id DESC LIMIT 1` vs `RETURNING` |
| 10 | LOW | `src/lib/database/index.ts:22` | No graceful handling when `data/` creation fails |
| 11 | LOW | `src/lib/database/index.ts:6` | No startup validation of `POSTGRES_URL` / `JWT_SECRET` |

**Good news for production**: On Vercel, `POSTGRES_URL` is auto-provided when Postgres storage is linked, so the SQLite code path is never hit in a correctly configured deployment. All fixes below either reduce risk or improve robustness.

---

## Detailed Issues & Fixes

### Issue 1 (CRITICAL): SQLite Path Not Writable on Vercel

**File**: `src/lib/database/index.ts` lines 20–31

```typescript
export function getSQLiteDb(): Database.Database {
    if (!sqliteDb) {
        const dbDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });  // FAILS on Vercel
        }
        sqliteDb = new Database(path.join(dbDir, 'budget.db'));
        ...
    }
    return sqliteDb;
}
```

**Problem**: On Vercel's serverless runtime, `process.cwd()` points to a read-only deployment directory. `fs.mkdirSync` throws if the `data/` directory doesn't exist.

**Fix**: Add a fast-fail guard at the top of `getSQLiteDb()`. On Vercel (detected by `process.env.VERCEL`), if `usePostgres` is false, throw an explicit error indicating `POSTGRES_URL` must be set. Also catch the mkdir error gracefully.

```typescript
export function getSQLiteDb(): Database.Database {
    if (!sqliteDb) {
        // Fail fast: if we're on Vercel but don't have POSTGRES_URL, warn explicitly
        if (process.env['VERCEL'] && !usePostgres) {
            throw new Error(
                'POSTGRES_URL environment variable is not set. ' +
                'SQLite is not available on Vercel. Set POSTGRES_URL in Vercel project settings.'
            );
        }
        const dbDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dbDir)) {
            try {
                fs.mkdirSync(dbDir, { recursive: true });
            } catch (err) {
                throw new Error(`Cannot create data directory at ${dbDir}. Check filesystem permissions.`, { cause: err });
            }
        }
        sqliteDb = new Database(path.join(dbDir, 'budget.db'));
        sqliteDb.pragma('journal_mode = WAL');
        sqliteDb.pragma('foreign_keys = ON');
    }
    return sqliteDb;
}
```

**Verification**: Create a test that mocks `process.cwd()` to return a read-only path and confirm a descriptive error is thrown.

---

### Issue 2 (CRITICAL): `better-sqlite3` Native Module Bundled on Vercel

**Files**: `package.json`, `src/lib/database/index.ts:1`

**Problem**: `better-sqlite3` is a native C++ addon. Even though the SQLite path is guarded by `usePostgres`, the static `import` statement runs at module load time. Vercel's build may fail to compile the native binary for the serverless environment. Additionally, the synchronous API blocks the Node.js event loop.

**Fix**: Convert the SQLite import to a **dynamic import** that only executes when SQLite mode is active. This allows tree-shaking to exclude the native addon from the Vercel bundle.

```typescript
// src/lib/database/index.ts

let sqliteDb: Database.Database | null = null;

export async function getSQLiteDb(): Promise<Database.Database> {
    if (!sqliteDb) {
        // Dynamic import — only resolved when SQLite mode is active
        const { default: Database } = await import('better-sqlite3');
        const dbDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dbDir)) {
            try {
                fs.mkdirSync(dbDir, { recursive: true });
            } catch (err) {
                throw new Error(`Cannot create data directory at ${dbDir}.`, { cause: err });
            }
        }
        sqliteDb = new Database(path.join(dbDir, 'budget.db'));
        sqliteDb.pragma('journal_mode = WAL');
        sqliteDb.pragma('foreign_keys = ON');
    }
    return sqliteDb;
}
```

This requires making `getSQLiteDb()` return a `Promise<Database.Database>` and updating `query.ts` to `await getSQLiteDb()` in the SQLite branch. Also move `better-sqlite3` to an `optionalDependencies` entry in `package.json` so missing native binary doesn't break the install — though this is secondary to the dynamic import fix.

**Verification**: `npm run build` on a clean checkout and confirm the Vercel bundle does not include the native `better-sqlite3` binary. Check with `vercel build --dry-run` or by inspecting `.vercel/output`.

---

### Issue 3 (HIGH): `initDb()` Runs on Every Cold Start

**File**: `src/hooks.server.ts` lines 1–5

```typescript
import { initDb } from '$lib/database/init';
...
await initDb();  // Runs on EVERY serverless cold start

export const handle: Handle = async ({ event, resolve }) => { ... }
```

**Problem**: Every cold start of any serverless function triggers schema creation queries (`CREATE TABLE IF NOT EXISTS ...`). On Vercel's pay-per-invocation model this is wasted CPU and latency on non-first invocations.

**Fix**: Add a module-level flag so `initDb()` runs at most once per process lifetime:

```typescript
// hooks.server.ts
import { initDb } from '$lib/database/init';
import { verifyToken } from '$lib/auth';
import type { Handle } from '@sveltejs/kit';

let dbInitialized = false;

async function ensureDb() {
    if (!dbInitialized) {
        await initDb();
        dbInitialized = true;
    }
}

export const handle: Handle = async ({ event, resolve }) => {
    // Initialize DB on first request (not at module load time)
    await ensureDb();
    ...
};
```

Or better: move `initDb()` to be called lazily inside `getPgPool()` / `getSQLiteDb()` so it initializes on first database access rather than on every request's auth check.

**Verification**: Add logging to `initDb()` and trigger multiple cold starts (e.g., by redeploying or hitting different API routes after expiration). Confirm initialization runs exactly once.

---

### Issue 4 (HIGH): Hardcoded JWT Secret Fallback

**File**: `src/lib/auth.ts` line 4

```typescript
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'budget-tracker-dev-secret-change-in-production';
```

**Problem**: If `JWT_SECRET` is not set on Vercel, the app uses a publicly known secret, allowing attackers to forge valid session tokens.

**Fix**: Fail fast at startup if `JWT_SECRET` is missing in production (when `POSTGRES_URL` is set, indicating Vercel):

```typescript
const JWT_SECRET = process.env['JWT_SECRET'] ?? (usePostgres
    ? (() => { throw new Error('JWT_SECRET must be set in Vercel project settings'); })()
    : 'budget-tracker-dev-secret-change-in-production');
```

Or more cleanly, validate at the top of `hooks.server.ts`:

```typescript
if (usePostgres && !process.env['JWT_SECRET']) {
    throw new Error('JWT_SECRET environment variable is required when POSTGRES_URL is set. Set it in Vercel project settings.');
}
```

Also create a `.env.example` file documenting all required env vars:

```
POSTGRES_URL=     # Set automatically by Vercel Postgres
JWT_SECRET=       # Required: generate with: openssl rand -base64 32
```

**Verification**: Deploy to Vercel preview with `JWT_SECRET` unset and confirm the deployment fails with a descriptive error in the function logs.

---

### Issue 5 (MEDIUM): SQL Translation Regex Edge Cases

**File**: `src/lib/database/query.ts` lines 3–24

The `translatePgToSQLite` function has issues with nested expressions:

```typescript
// Line 12 and 14 both try to match EXTRACT(YEAR FROM <word>) — line 14 overwrites line 12
.replace(/EXTRACT\(YEAR\s+FROM\s+(\w+)\)/gi, "CAST(strftime('%Y', $1) AS INTEGER)")
.replace(/EXTRACT\(YEAR\s+FROM\s+([^)]+)\)/gi, "CAST(strftime('%Y', $1) AS INTEGER)")
// The [^)]+ stops at the first ), breaking: EXTRACT(YEAR FROM COALESCE(date, CURRENT_DATE))
```

**Fix**: Simplify by removing the redundant first pattern, and improve the second pattern to handle nested parens:

```typescript
function translatePgToSQLite(sql: string): string {
    return sql
        // Postgres parameter placeholders $1, $2 → ?
        .replace(/\$\d+/g, '?')
        // TO_CHAR(date, 'YYYY-MM') → strftime('%Y-%m', date)
        .replace(/TO_CHAR\(([^,]+),\s*'YYYY-MM'\)/gi, "strftime('%Y-%m', $1)")
        // TO_CHAR(date, 'YYYY') → strftime('%Y', date)
        .replace(/TO_CHAR\(([^,]+),\s*'YYYY'\)/gi, "strftime('%Y', $1)")
        // EXTRACT(YEAR FROM <expr>) → CAST(strftime('%Y', <expr>) AS INTEGER)
        // Handles nested parens by matching the outermost closing paren of the EXTRACT call
        .replace(/EXTRACT\(YEAR\s+FROM\s+((?:[^()]|\([^()]*\))+)\)/gi,
            (_, expr) => `CAST(strftime('%Y', ${expr}) AS INTEGER)`)
        // NOW() → datetime('now')
        .replace(/\bNOW\(\)/gi, "datetime('now')")
        // CURRENT_DATE → date('now')
        .replace(/\bCURRENT_DATE\b/gi, "date('now')")
        // CURRENT_TIMESTAMP → datetime('now')
        .replace(/\bCURRENT_TIMESTAMP\b/gi, "datetime('now')")
        // Postgres cast syntax ::int, ::numeric → remove
        .replace(/::\w+(?:\(\d+(?:,\d+)?\))?/g, '');
}
```

Also add unit tests for the translation function covering all current query patterns:

```typescript
// src/lib/database/query.test.ts (vitest)
import { describe, it, expect } from 'vitest';
import { translatePgToSQLite } from './query';

describe('translatePgToSQLite', () => {
    it('converts $n params to ?', () => {
        expect(translatePgToSQLite('SELECT * FROM t WHERE a = $1 AND b = $2'))
            .toBe('SELECT * FROM t WHERE a = ? AND b = ?');
    });
    it('converts TO_CHAR YYYY-MM', () => {
        expect(translatePgToSQLite("TO_CHAR(date, 'YYYY-MM')"))
            .toBe("strftime('%Y-%m', date)");
    });
    it('converts EXTRACT YEAR FROM simple column', () => {
        expect(translatePgToSQLite('EXTRACT(YEAR FROM date)'))
            .toBe('CAST(strftime(\'%Y\', date) AS INTEGER)');
    });
    it('handles table-qualified column names', () => {
        expect(translatePgToSQLite('EXTRACT(YEAR FROM t.date)'))
            .toBe('CAST(strftime(\'%Y\', t.date) AS INTEGER)');
    });
    it('handles CURRENT_DATE', () => {
        expect(translatePgToSQLite('WHERE date = CURRENT_DATE'))
            .toBe("WHERE date = date('now')");
    });
});
```

**Verification**: Run the test suite after changes. Manually test all report pages (monthly, by-category) which use the most complex SQL.

---

### Issue 6 (MEDIUM): Dynamic `ORDER BY` String Interpolation

**Files**:
- `src/routes/api/transactions/+server.ts` line 43
- `src/routes/transactions/+page.server.ts` line 44

```typescript
ORDER BY t.${sort} ${order}
```

**Problem**: Column names are interpolated directly into SQL. Currently safe because `sort` is validated against `['date', 'amount']` and `order` against `['ASC', 'DESC']`, but brittle if future developers add columns.

**Fix**: Keep the allowlist validation but also assert at runtime:

```typescript
const sortCol = sort === 'amount' ? 'amount' : 'date';
const sortDir = order === 'asc' ? 'ASC' : 'DESC';
```

Add a defensive assertion:

```typescript
if (!['date', 'amount'].includes(sort)) throw new Error(`Invalid sort column: ${sort}`);
```

**Verification**: Add a test that passes `sort=invalid_column` and confirm the API returns 400 or the page handles it gracefully.

---

### Issue 7 (MEDIUM): `SUM` Returns String on Postgres, Number on SQLite

**Files**: Multiple API files type `total: string` for aggregated columns.

**Problem**: Postgres returns numeric aggregates as strings (to preserve precision in NUMERIC columns). SQLite returns native numbers. The consuming code always calls `parseFloat()` so it works, but the TypeScript types are misleading.

**Fix**: Normalize at the query layer — stringify SQLite numbers to match Postgres behavior, or use a consistent `as number` cast in the consuming code. The cleanest fix is to update the TypeScript types to `number | string` and ensure `parseFloat` is always called (it already is everywhere).

```typescript
// In src/lib/types.ts, update aggregate types:
type SpendingResult = { category_id: number; total: number | string };
```

No code changes required in consuming files — `parseFloat` handles both.

**Verification**: Check that dashboard and categories pages display correct totals in both local (SQLite) and Vercel (Postgres) modes.

---

### Issues 8–11 (LOW Priority — Deferred)

These are low-severity latent issues that don't affect the current codebase:

- **Issue 8** (dynamic `$n` numbering): Works correctly today. Fragile if code changes — document the pattern.
- **Issue 9** (race condition with `ORDER BY DESC LIMIT 1`): Acceptable for single-user app. Consider adding `RETURNING` support in `query.ts` using a Postgres-only code path when `usePostgres = true` in a future iteration.
- **Issue 10** (graceful data/ dir): Already addressed by Issue 1's error handling.
- **Issue 11** (env var validation): Addressed by Issue 4's startup validation.

---

## Implementation Order

| Phase | Priority | Changes |
|-------|----------|---------|
| 1 | CRITICAL | **Validate env setup**: add `POSTGRES_URL` fast-fail + `JWT_SECRET` check in `hooks.server.ts`. Create `.env.example`. |
| 2 | CRITICAL | **Dynamic import** of `better-sqlite3` in `index.ts` + make `getSQLiteDb()` async. Update `query.ts` to await it. |
| 3 | HIGH | **Lazy `initDb()`**: move to one-time initialization in `getPgPool()`/`getSQLiteDb()` instead of on every request. |
| 4 | MEDIUM | **Fix SQL translation regex**: update `translatePgToSQLite` with correct nested-paren handling. Add vitest tests. |
| 5 | MEDIUM | **Normalize SUM types**: update TypeScript types to `number \| string`. |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/database/index.ts` | Make `getSQLiteDb()` async with dynamic import; add Vercel fast-fail; add descriptive error on `data/` creation failure |
| `src/lib/database/query.ts` | `await getSQLiteDb()` instead of sync call; update `translatePgToSQLite` regex |
| `src/hooks.server.ts` | Add `JWT_SECRET` / `POSTGRES_URL` validation; lazy `initDb()` via flag |
| `src/lib/auth.ts` | Fail fast if `JWT_SECRET` missing in Postgres mode |
| `src/lib/types.ts` | Update aggregate `total` fields to `number \| string` |
| `.env.example` | Document required environment variables |
| `package.json` | Move `better-sqlite3` to `optionalDependencies` (optional, secondary to dynamic import) |
| `src/lib/database/query.test.ts` | **New file** — unit tests for `translatePgToSQLite` |

---

## Verification Checklist

1. **Local dev (no env vars)**: `npm run dev` → starts with SQLite, all routes work, data persists in `data/budget.db`
2. **Local with Postgres**: `POSTGRES_URL=... npm run dev` → uses Postgres, all routes work
3. **Vercel deploy**: With `POSTGRES_URL` and `JWT_SECRET` set, deploy succeeds and all routes work
4. **Vercel misconfiguration test**: Deploy without `POSTGRES_URL` → function throws descriptive error (not a filesystem crash)
5. **Report pages**: Monthly reports and category reports render correct numbers in both modes
6. **SQL translation tests**: `npm test` passes for the new `query.test.ts`
7. **No native module in bundle**: Vercel function bundle does not include `better-sqlite3` native binary
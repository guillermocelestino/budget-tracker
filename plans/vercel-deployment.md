# Vercel Deployment Plan (Hobby Plan)

## Context

Deploy the budget tracker to Vercel's free hobby plan. The main blocker is **`better-sqlite3`** — a native C++ addon that cannot run in Vercel's serverless functions. Decision: migrate to **Vercel Postgres** (native Vercel product, free tier: 1GB storage, 100h compute/month).

This requires:
1. Replacing better-sqlite3 with `@vercel/postgres` (async, serverless-compatible)
2. Converting all synchronous DB calls to async
3. Rewriting SQLite-specific SQL to Postgres-compatible SQL
4. Configuring the Vercel adapter

---

## Migration Summary

| Change | Effort | Files Affected |
|--------|--------|---------------|
| Swap DB driver (sync→async) | Medium | 17 server files |
| Rewrite SQLite SQL → Postgres | Low | 3 core files (schema) + minor query fixes |
| Add Vercel adapter + config | Low | 1 new file, 1 modified |
| Set environment variables | Low | Vercel dashboard |
| Remove native addon dependency | Low | 1 file |

---

## Step-by-Step Plan

### Step 1: Install & remove packages

```bash
npm uninstall better-sqlite3 @types/better-sqlite3 @sveltejs/adapter-auto
npm install @vercel/postgres @sveltejs/adapter-vercel
npm install -D @types/pg  # types for Postgres/pg
```

### Step 2: Create `svelte.config.js`

New file at project root:

```js
import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
    preprocess: vitePreprocess(),
    kit: {
        adapter: adapter()
    }
};
```

Remove the unused adapter import from `vite.config.ts`.

### Step 3: Rewrite database module (`src/lib/database/index.ts`)

Replace better-sqlite3 singleton with `@vercel/postgres` client:

```ts
import { createPool } from '@vercel/postgres';

let pool: ReturnType<typeof createPool> | null = null;

export function getDb() {
    if (!pool) {
        pool = createPool({
            connectionString: process.env['POSTGRES_URL']
        });
    }
    return pool;
}
```

`POSTGRES_URL` is auto-populated by Vercel when Postgres is provisioned. For local dev, create a `.env` file with `POSTGRES_URL=postgres://...` (connection string from Vercel dashboard).

### Step 4: Rewrite schema + seed (`src/lib/database/init.ts`)

Convert DDL from SQLite to Postgres:

| SQLite | Postgres |
|--------|----------|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` |
| `REAL` | `NUMERIC(12,2)` |
| `TEXT NOT NULL` | `TEXT NOT NULL` (same) |
| `DEFAULT (datetime('now'))` | `DEFAULT NOW()` |
| `CHECK(amount > 0)` | `CHECK(amount > 0)` (same) |
| `ON DELETE RESTRICT` | `ON DELETE RESTRICT` (same) |
| `CREATE INDEX` | `CREATE INDEX` (same) |

Example Postgres schema:

```sql
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#6366f1',
    icon TEXT NOT NULL DEFAULT '📁',
    budget_limit NUMERIC(12,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    amount NUMERIC(12,2) NOT NULL CHECK(amount > 0),
    description TEXT NOT NULL,
    date DATE NOT NULL,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Seed function becomes async and uses the async query API.

### Step 5: Rewrite queries in all server files

**Pattern change**: every `db.prepare('...').get(...)` / `.all(...)` / `.run(...)` becomes an await call through `@vercel/postgres`.

New database helper module (`src/lib/database/query.ts`) — provides convenience wrappers that match the old API:

```ts
import { getDb } from './index';

export async function queryOne<T>(text: string, params?: any[]): Promise<T | undefined> {
    const client = await getDb().connect();
    try {
        const { rows } = await client.query(text, params);
        return rows[0] as T;
    } finally {
        client.release();
    }
}

export async function queryMany<T>(text: string, params?: any[]): Promise<T[]> {
    const client = await getDb().connect();
    try {
        const { rows } = await client.query(text, params);
        return rows as T[];
    } finally {
        client.release();
    }
}

export async function execute(text: string, params?: any[]): Promise<void> {
    const client = await getDb().connect();
    try {
        await client.query(text, params);
    } finally {
        client.release();
    }
}
```

**SQLite → Postgres query changes** needed across all files:

| SQLite | Postgres | Affected Files |
|--------|----------|---------------|
| `strftime('%Y-%m', date)` | `TO_CHAR(date, 'YYYY-MM')` | reports, categories |
| `strftime('%Y', date)` | `EXTRACT(YEAR FROM date)` | reports |
| `strftime('%Y-%m', date) = ?` | `TO_CHAR(date, 'YYYY-MM') = $1` | reports, categories |
| `datetime('now')` | `NOW()` | edit transaction |
| `CAST(... as REAL)` | `CAST(... as NUMERIC)` (or omit) | reports |
| `?` placeholders | `$1, $2, ...` numbered | ALL files |
| `.get(...)` | `await queryOne(...)` | ALL files |
| `.all(...)` | `await queryMany(...)` | ALL files |
| `.run(...)` | `await execute(...)` | ALL files |

All `load()` functions and `actions` become `async` (if not already).

### Step 6: Update `hooks.server.ts`

`initDb()` becomes async — call it with `await`:

```ts
await initDb();
```

Also guard the production seed: only seed admin user if an env var `SEED_ADMIN=true` is set, so hardcoded credentials aren't auto-created in production.

### Step 7: Environment variables

Set in Vercel dashboard (Settings → Environment Variables):
- `POSTGRES_URL` — auto-set by Vercel Postgres integration
- `JWT_SECRET` — a strong random string
- `SEED_ADMIN` — set to `true` only for initial setup, then remove

### Step 8: Provision Vercel Postgres

In Vercel dashboard:
1. Go to Storage → Create Database → Postgres → Hobby plan
2. Select the project
3. The `POSTGRES_URL` env var is auto-injected
4. Vercel automatically runs schema/seed once on first deploy

### Step 9: Deploy

```bash
npm run build    # verify it builds
npx vercel       # or connect via Vercel dashboard git import
```

First deploy will run `initDb()` which creates tables and seeds default categories + admin user.

---

## Files to Create (2)

| File | Purpose |
|------|---------|
| `svelte.config.js` | Vercel adapter configuration |
| `src/lib/database/query.ts` | Async query helpers (queryOne, queryMany, execute) |

## Files to Modify (4)

| File | Change |
|------|--------|
| `src/lib/database/index.ts` | Replace better-sqlite3 with @vercel/postgres pool |
| `src/lib/database/init.ts` | Rewrite DDL to Postgres, make async, guard seed |
| `src/hooks.server.ts` | Make initDb() call async |
| `vite.config.ts` | Remove unused adapter import |

## Files to Rewrite (14 server files — async + SQL syntax changes)

All files that call `getDb()` need conversion. Pattern change is mechanical:

**Before** (SQLite sync):
```ts
export function load() {
    const db = getDb();
    return { cats: db.prepare('SELECT * FROM categories').all() as Category[] };
}
```

**After** (Postgres async):
```ts
export async function load() {
    return { cats: await queryMany<Category>('SELECT * FROM categories') };
}
```

List of files:
- `src/routes/+page.server.ts` (dashboard)
- `src/routes/login/+page.server.ts`
- `src/routes/categories/+page.server.ts`
- `src/routes/transactions/+page.server.ts`
- `src/routes/transactions/new/+page.server.ts`
- `src/routes/transactions/[id]/edit/+page.server.ts`
- `src/routes/reports/+page.server.ts`
- `src/routes/api/categories/+server.ts`
- `src/routes/api/categories/[id]/+server.ts`
- `src/routes/api/transactions/+server.ts`
- `src/routes/api/transactions/[id]/+server.ts`
- `src/routes/api/reports/monthly/+server.ts`
- `src/routes/api/reports/by-category/+server.ts`

---

## Postgres-Specific Query Details

### Reports page queries

```sql
-- monthly data: SQLite used strftime('%Y-%m', date)
SELECT TO_CHAR(date, 'YYYY-MM') as month, ... FROM transactions
WHERE EXTRACT(YEAR FROM date) = $1
GROUP BY month ORDER BY month ASC

-- category data
SELECT c.id as category_id, c.name as category_name, c.color as category_color,
       COALESCE(SUM(t.amount), 0) as total
FROM categories c
LEFT JOIN transactions t ON t.category_id = c.id
    AND TO_CHAR(t.date, 'YYYY-MM') = $1
    AND t.type = 'expense'
GROUP BY c.id ORDER BY total DESC

-- month summary
SELECT ... FROM transactions WHERE TO_CHAR(date, 'YYYY-MM') = $1
```

### Update timestamp (edit transaction)

```sql
-- SQLite: updated_at = datetime('now')
UPDATE transactions SET amount = $1, ..., updated_at = NOW() WHERE id = $9
```

---

## Verification

1. `npm run build` — must succeed with zero errors
2. `npm run dev` — must start and work locally (requires local Postgres or env pointing to Vercel Postgres)
3. Test all features end-to-end:
   - Login
   - View dashboard
   - Create/edit/delete transaction
   - Create/edit/delete category
   - View reports
4. `npx vercel` — deploy preview
5. Test on preview URL
6. Promote to production

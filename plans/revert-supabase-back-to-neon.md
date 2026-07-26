# Plan: Revert Supabase → Back to Neon/Vercel Postgres

## Context

In the previous implementation, we swapped `@neondatabase/serverless` (Neon's Postgres driver) for the generic `pg` package to prepare for a Supabase connection. However, Supabase is no longer the plan — we want to keep using **Vercel Postgres** (which runs on Neon) for production deployment.

The good news: the multi-tenancy changes (`user_id` columns, `celestinobelle` user seeding, per-user data filtering) are all **correct and should stay**. Only the database driver swap needs to be reverted.

## What to Revert

Only **3 files** need changes. Everything else (schema, seed data, per-user queries) stays as-is.

### 1. `src/lib/database/index.ts` — Revert Pool import

**Current:**
```ts
import { Pool } from 'pg';
```

**Revert to:**
```ts
import { Pool } from '@neondatabase/serverless';
```

The `Pool` API is identical between the two packages (`connect()`, `query()`, `release()`), so no other code in this file changes.

### 2. `package.json` — Swap packages

```bash
npm uninstall pg
npm install @neondatabase/serverless
```

Also keep `@types/pg` — it's still needed as a transitive type reference for Postgres query results.

### 3. `.env.example` — Revert comment back to Neon

Revert the Supabase-specific instructions and go back to mentioning `@neondatabase/serverless` / Vercel Postgres.

**Revert to:**
```
# PostgreSQL connection string (production / Vercel mode)
# When set, the app uses Postgres via @neondatabase/serverless.
# When unset, the app uses SQLite (better-sqlite3) for local development.
# On Vercel, this is auto-provided when Postgres storage is linked.
POSTGRES_URL=
```

## What Stays the Same

| Change | Status |
|---|---|
| `user_id` column in `categories` and `transactions` tables | ✅ Keep |
| `celestinobelle` / `Pangdiin@123` user seeding | ✅ Keep |
| Per-user category seeding (11 categories × 2 users) | ✅ Keep |
| `WHERE user_id = $1` filters in all ~14 server routes | ✅ Keep |
| `UNIQUE(user_id, name)` constraint on categories | ✅ Keep |
| All per-user query scoping in `+page.server.ts` and API routes | ✅ Keep |
| `ON DELETE CASCADE` on user_id foreign keys | ✅ Keep |

## Verification

1. **Build check**: `npm run build` — should compile without errors
2. **Test check**: `npm test` — all 17 SQL translation tests should still pass
3. **Local dev**: Delete `data/budget.db`, start dev server → both users (`pangdiin` and `celestinobelle`) seed correctly with their own categories
4. **No behavioral change**: Multi-tenancy works exactly as implemented — only the Postgres driver changes back

## Summary of File Changes

```
Reverted:  src/lib/database/index.ts   (import Pool from @neondatabase/serverless)
Reverted:  .env.example                (comment mentions Neon again)
Reverted:  package.json                (@neondatabase/serverless reinstalled, pg removed)
```

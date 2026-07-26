# Plan: Supabase Migration + Multi-Tenant Users

## Context

The budget tracker currently stores all data in a shared namespace — every user sees the same categories and transactions. There's only one seeded user (`pangdiin`), and no `user_id` column exists on any table. The app also uses Neon for Postgres on Vercel, but the request is to switch to Supabase as the Postgres provider while adding proper per-user data isolation.

## Objectives

1. **Switch from Neon to Supabase** as the production Postgres provider (Vercel deployment)
2. **Add user `celestinobelle`** with password `Pangdiin@123` — seeded in both local (SQLite) and production (Supabase)
3. **Multi-tenancy** — each user gets their own categories, transactions, and dashboard data
4. **Keep dual-mode architecture** — SQLite for local dev, Postgres (Supabase) for production
5. **Keep existing auth** — JWT-based login remains (works fine with multi-tenancy)

## Architecture

### Database Provider Change

| Current | New |
|---|---|
| `@neondatabase/serverless` Pool | `pg` Pool (standard Postgres driver) |
| `POSTGRES_URL` → Neon connection | `POSTGRES_URL` → Supabase connection |

Supabase is standard PostgreSQL, so no SQL changes are needed. The existing query layer (`query.ts`) works as-is with `pg.Pool`.

### Multi-Tenancy Model

Add a `user_id` foreign key to `categories` and `transactions`:

```
users (id, username, password_hash, created_at)
  ↑
categories (id, user_id, name, color, icon, budget_limit, created_at)
  ↑
transactions (id, user_id, category_id, amount, description, date, type, created_at, updated_at)
```

- Every category belongs to exactly one user
- Every transaction belongs to exactly one user
- All queries filter by `user_id` from `event.locals.user.userId`
- Default categories are duplicated per user on seed

## Step-by-Step Implementation

### 1. Install dependencies

```bash
npm uninstall @neondatabase/serverless
npm install pg
npm install -D @types/pg  # upgrade if needed, already present
```

### 2. Schema changes (`src/lib/database/init.ts`)

**Postgres schema:**
- Add `user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE` to `categories`
- Add `user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE` to `transactions`
- Keep existing `category_id` FK unchanged (still references categories)
- Add unique constraint: `UNIQUE (user_id, name)` on categories (each user has unique category names)
- Add index: `idx_categories_user_id`, `idx_transactions_user_id`

**SQLite schema:**
- Same logical changes (`INTEGER NOT NULL REFERENCES users(id)`)
- Same unique constraint and indexes

### 3. Database connection layer (`src/lib/database/index.ts`)

- Replace `import { Pool } from '@neondatabase/serverless'` with `import { Pool } from 'pg'`
- `Pool` constructor and API (`connect()`, `query()`, `client.release()`) are identical — no other code changes needed

### 4. Seed data updates (`src/lib/database/init.ts`)

**Users:**
```sql
-- Keep existing seed for 'pangdiin'
-- Add new user:
INSERT INTO users (username, password_hash) VALUES ('celestinobelle', '<hashed Pangdiin@123>');
```

**Categories (now per-user):**
- Remove global category seeding
- For each user, insert the 11 default categories scoped to that user
- `INSERT INTO categories (user_id, name, color, icon, budget_limit) VALUES ($1, $2, $3, $4, $5)`

**Transaction seeding (optional):**
- Can add a few sample transactions per user for testing

### 5. Auth types — pass userId through queries

The JWT token already contains `userId`. All server load functions and actions receive `event.locals.user.userId`. The plan is to use this value in every query.

### 6. Update all server routes — add `user_id` filter

Every `+page.server.ts` and API `+server.ts` that queries categories or transactions needs a `user_id` filter. The pattern:

```ts
// Before
const categories = await queryMany<Category>('SELECT * FROM categories ORDER BY name ASC');

// After
const categories = await queryMany<Category>(
  'SELECT * FROM categories WHERE user_id = $1 ORDER BY name ASC',
  [event.locals.user.userId]
);
```

**Files to modify:**

| File | Changes |
|---|---|
| `src/routes/+page.server.ts` | Add `user_id` to dashboard summary query and recent transactions |
| `src/routes/categories/+page.server.ts` | Add `user_id` to load, create, update, delete — also add `user_id` to INSERT |
| `src/routes/transactions/+page.server.ts` | Add `user_id` to load (conditions), delete, and the category list |
| `src/routes/transactions/new/+page.server.ts` | Add `user_id` to INSERT |
| `src/routes/transactions/[id]/edit/+page.server.ts` | Add `user_id` to load and UPDATE |
| `src/routes/reports/+page.server.ts` | Add `user_id` to all report queries |
| `src/routes/api/categories/+server.ts` | Add `user_id` to GET, POST |
| `src/routes/api/categories/[id]/+server.ts` | Add `user_id` to GET, PUT, DELETE |
| `src/routes/api/transactions/+server.ts` | Add `user_id` to GET, POST |
| `src/routes/api/transactions/[id]/+server.ts` | Add `user_id` to GET, PUT, DELETE |
| `src/routes/api/reports/monthly/+server.ts` | Add `user_id` to queries |
| `src/routes/api/reports/by-category/+server.ts` | Add `user_id` to queries |

### 7. Category uniqueness — per user

The current `UNIQUE` constraint on `categories.name` becomes `UNIQUE (user_id, name)`. This means two users can have a category named "Salary" but one user can't have duplicates.

### 8. Environment variables

**`.env.example` update:**
- Rename `POSTGRES_URL` description to reference Supabase
- Add note: "Get your Supabase connection string from Project Settings → Database → Connection string (URI). Use the session pooler string for serverless."

For Vercel, set:
- `POSTGRES_URL` = Supabase connection string (session pooler mode, e.g. `postgresql://postgres.xxxxx:password@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true`)
- `JWT_SECRET` = a secure random string (generate with `openssl rand -base64 32`)

For local dev, `POSTGRES_URL` is unset → falls back to SQLite automatically.

### 9. Migration for existing data

Since there's no production data yet (just seeded defaults), the simplest approach:

1. Delete the existing `data/budget.db` file (SQLite will be recreated with new schema)
2. On first run, the new schema creates tables with `user_id` columns
3. Both users (`pangdiin` and `celestinobelle`) get their own default categories seeded

If there IS existing data to preserve, provide a migration SQL script:
```sql
ALTER TABLE categories ADD COLUMN user_id INTEGER REFERENCES users(id);
ALTER TABLE transactions ADD COLUMN user_id INTEGER REFERENCES users(id);
UPDATE categories SET user_id = (SELECT id FROM users WHERE username = 'pangdiin');
UPDATE transactions SET user_id = (SELECT id FROM users WHERE username = 'pangdiin');
ALTER TABLE categories ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE transactions ALTER COLUMN user_id SET NOT NULL;
CREATE UNIQUE INDEX idx_categories_user_name ON categories(user_id, name);
```

## Verification

1. **Local (SQLite):**
   - Delete `data/budget.db` (or run the app fresh)
   - Start the dev server → schema creates with user_id columns
   - Login as `pangdiin` / `Pangdiin@123` → see default categories
   - Create some transactions → log out
   - Login as `celestinobelle` / `Pangdiin@123` → see different default categories (no overlap)
   - Verify pangdiin's data is invisible to celestinobelle

2. **Vercel (Supabase):**
   - Set `POSTGRES_URL` to Supabase connection string
   - Set `JWT_SECRET`
   - Deploy → Supabase tables auto-create with new schema
   - Same multi-user verification as above

3. **Edge cases:**
   - Category name uniqueness is per-user (pangdiin and celestinobelle can both have "Salary")
   - Deleting a user should cascade to their categories and transactions (ON DELETE CASCADE)
   - Reports only show the logged-in user's data

## Future Enhancements (not in scope)

- Supabase Auth UI (replacing custom JWT login)
- Row Level Security (RLS) policies for database-level security
- Real-time updates via Supabase Realtime
- Shared categories (family budget mode)

---

## Summary of File Changes

```
Modified:   src/lib/database/index.ts       (swap Neon Pool → pg Pool)
Modified:   src/lib/database/init.ts        (add user_id to schemas, per-user seeding)
Modified:   src/routes/+page.server.ts      (filter by user_id)
Modified:   src/routes/categories/+page.server.ts  (filter by user_id)
Modified:   src/routes/transactions/+page.server.ts  (filter by user_id)
Modified:   src/routes/transactions/new/+page.server.ts  (filter by user_id)
Modified:   src/routes/transactions/[id]/edit/+page.server.ts  (filter by user_id)
Modified:   src/routes/reports/+page.server.ts  (filter by user_id)
Modified:   src/routes/api/categories/+server.ts  (filter by user_id)
Modified:   src/routes/api/categories/[id]/+server.ts  (filter by user_id)
Modified:   src/routes/api/transactions/+server.ts  (filter by user_id)
Modified:   src/routes/api/transactions/[id]/+server.ts  (filter by user_id)
Modified:   src/routes/api/reports/monthly/+server.ts  (filter by user_id)
Modified:   src/routes/api/reports/by-category/+server.ts  (filter by user_id)
Modified:   .env.example                   (update comments for Supabase)
Removed:    @neondatabase/serverless       (from package.json)
Added:      pg                            (to package.json)
```

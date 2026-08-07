# Neon Database Migration — Phase 1: Audit Only

> **Status:** AUDIT COMPLETE — no files modified, no packages installed, no migrations created.
> Everything below is read-only analysis. See Section **K — STOP**.
>
> **Constraint honored:** connection string is never printed or hardcoded. Only environment variable **names** and their consumption sites are reported. Target env var for the eventual connection: `DATABASE_URL`.

---

## A. Current Architecture

```
┌─────────────┐   SvelteKit (adapter-vercel, PWA)   ┌─────────────────────────────┐
│   Browser   │◄──────────── HTTP / JSON ──────────►│  hooks.server.ts (auth guard)│
│ (Svelte 5)  │                                     │  +page.server.ts (load,      │
└─────────────┘                                     │     actions)                 │
                                                    │  +server.ts (REST /api/*)    │
                                                    └──────────────┬──────────────┘
                                                                   │
                                                    ┌──────────────▼──────────────┐
                                                    │  $lib/database/query.ts      │
                                                    │  queryOne / queryMany /      │
                                                    │  execute / withTransaction   │
                                                    └──────────────┬──────────────┘
                                                                   │  usePostgres flag
                                                    ┌──────────────▼──────────────┐
                                                    │  @neondatabase/serverless    │
                                                    │  Pool (connectionString =    │
                                                    │  process.env.POSTGRES_URL)   │
                                                    └──────────────┬──────────────┘
                                                                   │
                                                    ┌──────────────▼──────────────┐
                                                    │        Neon PostgreSQL      │
                                                    │   (production, Vercel)      │
                                                    └─────────────────────────────┘

              Dev/local path:  translatePgToSQLite()  ─►  better-sqlite3
              (POSTGRES_URL unset)                    data/budget.db (WAL, FK on)
```

- **No ORM.** All SQL is hand-written in **Postgres dialect** (`$1…$n` params), written once and executed two ways:
  - **Neon path** (`POSTGRES_URL` set): SQL runs verbatim through `@neondatabase/serverless` `Pool`.
  - **SQLite path** (unset): `translatePgToSQLite()` regex-translates it (`ILIKE→LIKE`, strips `::casts`, `TO_CHAR→strftime`, `EXTRACT→strftime`, `NOW()→datetime`, `CURRENT_DATE→date`, `$N→?` + param index remap), then runs via `better-sqlite3`.
- **Key fact:** the app **already speaks Postgres natively** and already uses the Neon driver. Neon is the *target* dialect, not a foreign one. The dual-dialect machinery exists to keep local dev on SQLite.

---

## B. Current Database

| Aspect | Current state |
|---|---|
| Database | **Dual:** SQLite (dev/local) + **Neon PostgreSQL** (production) |
| Drivers | `better-sqlite3` ^13.0.1 (synchronous), `@neondatabase/serverless` ^1.1.0 (`Pool`) |
| ORM | **None** — raw parameterized SQL in Postgres dialect |
| Schema location | `src/lib/database/init.ts` — inline DDL (`CREATE TABLE IF NOT EXISTS`, 6 tables + indexes) for **both** dialects in one file |
| Migration system | **None for Postgres.** One SQLite-only script (`src/lib/database/migrations/001_add_type_to_categories.ts`, uses PRAGMA). `init.ts` runs idempotent inline "migrations" (add `direction` col, seed users/categories, seed Loan/Debt Repayment categories, backfill synthetic payments, recalc status cache) on every boot |
| Seed system | `init.ts` (`DEFAULT_USERS`, `DEFAULT_CATEGORIES`, seeded when tables empty) + `scripts/seed-demo.ts` / `.mjs` (`SEED_DEMO=1`, used by Playwright webserver) |
| Connection lifecycle | Module-level lazy singleton `pgPool` / `sqliteDb`; Vercel fail-fast if `VERCEL` set without `POSTGRES_URL` |
| Auth | **JWT** (`jsonwebtoken` + `bcryptjs`), cookie `session`, 7-day expiry — no session store in DB |

---

## C. Schema Inventory

6 tables, all with `user_id` FK → `users.id ON DELETE CASCADE` (multi-user scoped). No soft-delete columns. No JSON columns.

### 1. `users`
| Column | Type (PG) | Null | Default | Notes |
|---|---|---|---|---|
| id | SERIAL PK | | | |
| username | TEXT | NOT NULL | | **UNIQUE** |
| password_hash | TEXT | NOT NULL | | bcrypt |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | |

### 2. `categories`
| Column | Type (PG) | Null | Default | Notes |
|---|---|---|---|---|
| id | SERIAL PK | | | |
| user_id | INT → users | NOT NULL | | FK **CASCADE** |
| name | TEXT | NOT NULL | | **UNIQUE(user_id, name)** |
| color | TEXT | NOT NULL | `'#6366f1'` | |
| icon | TEXT | NOT NULL | `'📁'` | |
| type | TEXT | NOT NULL | `'expense'` | enum `income`/`expense` (CHECK) |
| budget_limit | NUMERIC(12,2) | NULL | | |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | |
| Index: `idx_categories_user_id` |

### 3. `transactions`
| Column | Type (PG) | Null | Default | Notes |
|---|---|---|---|---|
| id | SERIAL PK | | | |
| user_id | INT → users | NOT NULL | | FK **CASCADE** |
| amount | NUMERIC(12,2) | NOT NULL | | |
| description | TEXT | NOT NULL | | |
| date | DATE | NOT NULL | | stored as `'YYYY-MM-DD'` |
| category_id | INT → categories | NOT NULL | | FK **RESTRICT** (can't delete in-use category) |
| type | TEXT | NOT NULL | | CHECK `income`/`expense` |
| created_at / updated_at | TIMESTAMPTZ | NOT NULL | NOW() | |
| Indexes: `user_id`, `date DESC`, `category_id`, `type` |

### 4. `lendings`
| Column | Type (PG) | Null | Default | Notes |
|---|---|---|---|---|
| id | SERIAL PK | | | |
| user_id | INT → users | NOT NULL | | FK **CASCADE** |
| borrower_name | TEXT | NOT NULL | | free text (no people table) |
| amount | NUMERIC(12,2) | NOT NULL | | |
| interest_rate | NUMERIC(5,2) | | `0` | |
| date_lent | DATE | NOT NULL | | |
| due_date | DATE | NULL | | |
| status | TEXT | NOT NULL | `'active'` | enum `active`/`paid` (CHECK); **only written by `recalcStatusCache()`** |
| notes | TEXT | NULL | | |
| direction | TEXT | NOT NULL | `'lent'` | enum `lent`/`borrowed` (CHECK, added via inline migration) |
| created_at / updated_at | TIMESTAMPTZ | NOT NULL | NOW() | |
| Indexes: `user_id`, `status` |

### 5. `recurring_transactions`
| Column | Type (PG) | Null | Default | Notes |
|---|---|---|---|---|
| id | SERIAL PK | | | |
| user_id | INT → users | NOT NULL | | FK **CASCADE** |
| type | TEXT | NOT NULL | | CHECK `income`/`expense` |
| amount | NUMERIC(12,2) | NOT NULL | | |
| description | TEXT | NOT NULL | | |
| category_id | INT → categories | NOT NULL | | FK **RESTRICT** |
| frequency | TEXT | NOT NULL | | CHECK `daily/weekly/monthly/yearly` |
| interval | INT | NOT NULL | `1` | |
| day_of_week | INT | | | CHECK 0–6 |
| day_of_month | INT | | | CHECK 1–31 |
| month_of_year | INT | | | CHECK 1–12 |
| start_date | DATE | NOT NULL | | |
| end_date | DATE | NULL | | |
| next_run | DATE | NOT NULL | | scheduler driver |
| last_generated_at | TIMESTAMPTZ | NULL | | |
| active | **BOOLEAN** | NOT NULL | TRUE | **SQLite mirror is INTEGER 0/1** (see §G.4) |
| created_at / updated_at | TIMESTAMPTZ | NOT NULL | NOW() | |
| Indexes: `user_id`, `next_run`, `active` |

### 6. `lending_payments`
| Column | Type (PG) | Null | Default | Notes |
|---|---|---|---|---|
| id | SERIAL PK | | | |
| lending_id | INT → lendings | NOT NULL | | FK **CASCADE** |
| user_id | INT → users | NOT NULL | | FK **CASCADE** |
| amount | NUMERIC(12,2) | NOT NULL | | |
| payment_date | DATE | NOT NULL | | |
| notes | TEXT | NULL | | |
| transaction_id | INT → transactions | NULL | | FK **SET NULL** (links to generated ledger entry) |
| payment_type | TEXT | NOT NULL | `'payment'` | CHECK `payment`/`write_off` |
| reference | TEXT | NULL | | |
| created_at / updated_at | TIMESTAMPTZ | NOT NULL | NOW() | |
| Indexes: `lending_id`, `user_id`, `payment_date DESC` |

### Derived-state invariants (business logic, not schema)
- `cash_paid + written_off = resolved_total`; `remaining = amount − resolved_total`; `status = remaining > 0 ? 'active' : 'paid'`.
- `lendings.status` is a **cache** — single writer is `recalcStatusCache()` (in `lendingPayments.ts`).
- `recurring_transactions.next_run` recalculated **only** when scheduling fields change (`recurringService.ts`).

---

## D. Database Usage Map

**32 files import `$lib/database` — 100% server-side. Zero client-side (`.svelte`) DB access.**

### Core layer (`src/lib/database/`)
| File | Role |
|---|---|
| `index.ts` | `usePostgres` flag, `getPgPool()` (Neon `Pool`), `getSQLiteDb()`, `closeDb()`, lazy `initDb()` |
| `query.ts` | `translatePgToSQLite()`, `queryOne`, `queryMany`, `execute`, `withTransaction` |
| `init.ts` | Schema DDL (both dialects) + seed + inline idempotent migrations + boot-time table check |
| `migrations/001_add_type_to_categories.ts` | SQLite-only legacy migration |

### Service modules (`src/lib/server/`, 6 files)
| File | Operations | Tables |
|---|---|---|
| `lendingPayments.ts` | `getLendingsWithPayments`, `recordPayment` (tx: insert payment + linked tx + status), `updatePayment`, `deletePayment`, `recalcStatusCache`, `getLendingTotals`, `hasPayments`, `deleteLinkedTransactions` | lendings, lending_payments, transactions, categories |
| `recurringService.ts` | `createRecurringTransaction`, `updateRecurringTransaction` (+ category ownership check) | recurring_transactions, categories |
| `recurringScheduler.ts` | `processRecurringTransactions`, `runRecurringNow`, `toggleRecurringStatus`, `duplicateRecurringTransaction` (**only `INSERT…RETURNING id` site**) | recurring_transactions, transactions |
| `networth.ts` | `computeNetWorth`: cash position, active lent/borrowed, monthly cash flow (`TO_CHAR`), projection | transactions, lendings |
| `recordLendingTransaction.ts` | create/repayment → ledger transaction + category fallback lookup | transactions, categories |
| `lendingImport.ts` | `importLendingsForUser`: CSV/Excel lendings + historical payment backfill | lendings, lending_payments |

### Page server files (13)
`transactions/+page.server.ts` (pagination, `COUNT(*)::int`, `ILIKE` search, running-balance `allForBalance`, CRUD actions, import), `transactions/new`, `transactions/[id]/edit`, `categories`, `lending`, `borrowed`, `recurring`, `recurring/new`, `recurring/[id]`, `dashboard`, `reports`, `net-worth`, `login`.

### API route files (13)
`/api/transactions` (+`/[id]`, `/export`), `/api/categories` (+`/[id]`), `/api/lendings` (+`/[id]`, `/[id]/payments`), `/api/recurring` (+`/[id]`), `/api/search` (`ILIKE` across 3 tables), `/api/reports/monthly`, `/api/reports/by-category`, `/api/reports/export`.

### Table usage weight (grep counts in `src/`)
`categories` 84 · `transactions` 65 · `lendings` 48 · `lending_payments` 31 · `recurring_transactions` 21 · `users` 11.

### Dialect-feature footprint (grep counts)
`ILIKE` 7 files · `::casts` 14 files · `TO_CHAR` 9 · `EXTRACT` 4 · `NOW()` 12 · `CURRENT_DATE` 3 · `RETURNING` 1 · `strftime` 3 (all in `query.ts` translator) · `SERIAL`/`AUTOINCREMENT` 1 each (`init.ts`) · `jsonb`, `INTERVAL`, `date_trunc` 0.

---

## E. Environment Variables

> Names and consumption sites only — no values, no connection strings.

| Variable | Read in | Purpose |
|---|---|---|
| `POSTGRES_URL` | `src/lib/database/index.ts:6,28` (Neon `Pool.connectionString`); **presence flips `usePostgres`** | Neon/Postgres connection string |
| `JWT_SECRET` | `src/lib/auth.ts`; guard in `src/hooks.server.ts` (throws if `POSTGRES_URL` set but secret missing) | JWT signing/verification |
| `VERCEL` | `src/lib/database/index.ts:36` (fail-fast) | Vercel runtime flag |
| `SEED_DEMO` | `scripts/seed-demo.ts` | Demo-seed toggle (Playwright webserver) |
| `DATABASE_URL` | **not used yet** | *target* canonical name for the connection string |
| `.env.example` | — | documents `POSTGRES_URL=` and `JWT_SECRET=` only |

**Migration note:** Neon connection strings are standard `postgres://…` URLs — the driver already accepts them. Moving to `DATABASE_URL` is a **rename/alias**, not a format change. The app's default-user seed data (2 users) is only inserted when the `users` table is empty, so pointing Neon at a fresh DB seeds it automatically.

---

## F. ORM Recommendation

### Context that should drive the choice
- The codebase already writes **Postgres-dialect raw SQL** behind a thin, consistent layer (`queryOne/queryMany/execute/withTransaction`, typed generics).
- The app targets **Neon serverless** (edge-compatible driver already installed).
- SvelteKit + TypeScript throughout; types already defined in `src/lib/types.ts` (mirrors tables 1:1).
- The query layer is only ~200 lines and is *not* the complexity driver — the business logic (lending settlement, recurring scheduler) is.

### Comparison — Drizzle vs Prisma

| Dimension | **Drizzle ORM** | Prisma |
|---|---|---|
| Neon fit | **First-class** — `drizzle-orm/neon-http` + `@neondatabase/serverless` documented path | Works, but requires **driver adapters** (preview-tier); heavier client |
| Serverless cold start | ~tiny, tree-shakeable, edge-ready | Larger client; historically a cold-start concern on serverless |
| Schema definition | **TypeScript code** (`.ts`), same language as the app | `schema.prisma` DSL (separate file/language) |
| Migrations | `drizzle-kit generate/push/migrate` — plain SQL files, reviewable | `prisma migrate` — own engine + shadow DB; heavier but polished |
| Incremental adoption | **Fits the existing raw-SQL layer perfectly** — you can migrate one module at a time; raw SQL still passes through | All-or-nothing for a given data model |
| Type safety | Generated DB types; close to the SQL you write | Excellent, but abstracts joins/queries more (harder to port existing hand-written SQL) |
| Fits this codebase's SQL | Native — hand-written PG SQL maps 1:1 to `sql` template queries | Raw queries via `$queryRaw` are a step down from the current layer |

### Recommendation: **Drizzle ORM**
- Matches the existing pattern: Postgres-dialect SQL stays SQL, schema lives in TypeScript next to `src/lib/types.ts`, and Neon is a documented first-class target.
- **Lowest-risk path:** `drizzle-kit` can introspect the existing Neon schema (`drizzle-kit pull`) to generate the initial schema file without hand-authoring it — critical for a non-destructive migration.
- Migrations produce plain SQL files that review like the current `init.ts` DDL — consistent with how the team already works.
- Enables the "adopt incrementally" strategy: start with one module (e.g. `recurringService.ts`), keep `query.ts` for the rest, then converge.

### Alternatives (legitimate, in order)
1. **Kysely** — typed query builder, even lighter, no migrations tool. Good middle ground if Drizzle feels heavy.
2. **Stay zero-ORM** — keep `query.ts` + add a real SQL migration runner. The query layer is small and already typed; an ORM is optional here. This is the cheapest option but doesn't buy the query-building/type-safety ergonomics the team asked about.

---

## G. Neon Compatibility Issues (from actual code)

Neon is PostgreSQL 15/16 — the app's SQL is written in Postgres dialect, so **every dialect feature in the codebase runs natively on Neon**. The concrete risks below are about the *machinery around* the SQL, not the SQL itself.

### G.1 — The dual-dialect bridge is the real liability (MEDIUM)
`translatePgToSQLite()` (in `query.ts`) exists **only** for the SQLite dev path — it never runs on Neon. The risk is not Neon compatibility; it's **dev/prod drift**: a developer can write SQL that passes on SQLite (lenient) and fails on Postgres (strict), or vice-versa. The translator already handles the known deltas (`ILIKE`, `::casts`, `TO_CHAR`, `EXTRACT`, `NOW()`, `CURRENT_DATE`, `$N`→`?`). Post-migration, deleting this bridge removes the second truth entirely.

### G.2 — Type coercion differences (LOW)
- `COUNT(*)` returns **bigint** on PG → code already casts `COUNT(*)::int` (e.g. `transactions/+page.server.ts:54`, `api/transactions/+server.ts:46`). On SQLite the translator strips the cast. Works on both — keep the `::int` pattern.
- NUMERIC aggregates (`SUM`) return **strings** on PG; the code already defensively `parseFloat(String(row.x ?? '0'))` everywhere (e.g. `lendingPayments.ts:88`). Safe — but the pattern must survive any ORM refactor.

### G.3 — `RETURNING` (LOW)
Only one site: `recurringScheduler.ts:174-196` (`INSERT … RETURNING id`). Native on Neon. It also passes through untouched on SQLite because `better-sqlite3` v13 supports `RETURNING`. No change needed.

### G.4 — Boolean ↔ integer duality on `recurring_transactions.active` (LOW, but watch it)
- PG column is **BOOLEAN**; SQLite mirror is **INTEGER (0/1)**.
- Writes use `active ? 1 : 0` (`recurringScheduler.ts`, `recurringService.ts`) — PG coerces `0/1` → bool on write, SQLite stores the int. Reads: PG returns a real JS `boolean`; SQLite returns `0`/`1`.
- `src/lib/types.ts` declares `active: boolean`. On SQLite today `1/0` flows into `boolean`-typed fields and works because the UI uses truthiness. On Neon it becomes a true boolean. No bug today, but the seam is exactly where an ORM's stricter typing could surface it — good, not bad.

### G.5 — `TIMESTAMPTZ` returns JS `Date`, not string (MEDIUM)
- `created_at`/`updated_at`/`last_generated_at` are `TIMESTAMPTZ` on PG. The Neon/`pg` driver **parses these into JS `Date` objects** on read; SQLite returns `'YYYY-MM-DD HH:MM:SS'` strings.
- `DATE` columns (`transactions.date`, etc.) return strings on both — **no issue there**.
- Current code only uses `created_at` for `ORDER BY`/display and `new Date(...)` formatting, so it tolerates both. But any future code that treats `created_at` as a string (or the inverse, `.toISOString()` on a SQLite string) would diverge. Document the rule: *created_at/updated_at are Dates on Neon.* The JSON API serializes `Date` → ISO string automatically, which is fine.

### G.6 — `withTransaction` holds a dedicated connection (LOW→MEDIUM)
`query.ts:136-212` runs `BEGIN`/`COMMIT` on a **single dedicated pool client** for the whole transaction. On Neon serverless this is supported (and is why Neon recommends a pooled connection string, which handles the two-transaction-modes). Fine at this app's scale, but if the pool uses a session-pooled vs transaction-pooled string matters for concurrency. With a single-user-per-request workload this is LOW risk.

### G.7 — Module-level pool singleton in serverless (LOW)
`index.ts:27` keeps one `pgPool` at module scope. This is the documented Neon/Vercel pattern (reuse across warm instances), but warm instances can outlive a deploy, so schema created at init on instance A must exist before instance B serves. It already does — `initDb()` is idempotent and runs before first query on each instance. Keep the singleton; don't recreate pools per request.

### G.8 — Inline migrations re-run every boot (MEDIUM — the biggest technical debt)
`init.ts` runs `CREATE TABLE IF NOT EXISTS` + **data-mutating idempotent migrations on every cold start**: the `direction` column check, category seeding/backfills, synthetic payment backfill, and the **full `UPDATE lendings SET status = …` recalculation** for *all* records. On SQLite that's trivial. On a real Neon dataset, running those UPDATEs on every serverless boot is wasteful and grows with data volume. The migration framework (Phase 2+) must extract these into **one-time** migration files and let `init.ts` only do `CREATE IF NOT EXISTS` (or be removed entirely).

### G.9 — Env var naming: `POSTGRES_URL` → `DATABASE_URL` (LOW)
The Neon string is already a valid connection URL; `DATABASE_URL` is the ecosystem convention (and what ORM tooling expects by default). This is a **rename + one alias line** in `index.ts:6` (`process.env['DATABASE_URL'] ?? process.env['POSTGRES_URL']`), plus the guard in `hooks.server.ts` and `.env.example`. No connection string ever touches source control.

### G.10 — ILIKE / LIKE case semantics (LOW, informational)
Search uses `ILIKE` on PG (case-insensitive) which the translator maps to `LIKE` on SQLite (ASCII-case-insensitive by default) — behavior is aligned today. Post-migration, ILIKE stays case-insensitive; any future plain `LIKE` would be case-*sensitive* on PG — a latent trap for SQLite-trained habits. Note for onboarding docs, not a defect.

### G.11 — Seed / demo tooling is SQLite-adjacent (LOW)
`data/budget.db`, `scripts/seed-demo.ts/.mjs`, and the `better-sqlite3` import must be removed once SQLite is retired. `SEED_DEMO` seeding should target Neon via `DATABASE_URL`. The Vercel fail-fast (`index.ts:36`) becomes dead code.

---

## H. Proposed Migration Phases

**Phase 1 = this audit. Phases 2+ are gated on approval.** Every step is **non-destructive** (SQLite remains the active local DB until the final cut-over; Neon is additive, never a replacement before switchover).

1. **Env-var alias.** Add `DATABASE_URL` as the canonical name in `index.ts` (`DATABASE_URL ?? POSTGRES_URL` fallback for compatibility), update the guard in `hooks.server.ts` and `.env.example`. No behavior change.
2. **Provision Neon + smoke test.** Create the Neon project/branch, set `DATABASE_URL` in local `.env` and Vercel. Boot the app in a local Postgres-mode run to confirm the existing Postgres dialect works against Neon (it should — the code path already exists and is dormant only because `POSTGRES_URL` is unset locally).
3. **Add a real migration framework** (Drizzle `drizzle-kit` recommended, per §F). Configure it against `DATABASE_URL`. Create an empty baseline. Keep `init.ts` untouched.
4. **Snapshot existing schema.** Use `drizzle-kit pull` against a fresh Neon branch to generate the schema-as-code from the *existing* `init.ts` DDL — no hand-authoring, guaranteed match.
5. **Extract inline migrations.** Port the idempotent backfill/seed logic from `init.ts` (§G.8) into numbered one-time migration files. Make `init.ts` migrations no-ops on Neon (or gate them to SQLite only) so boot-time data mutations stop.
6. **Pilot the ORM on one module.** Convert `recurringService.ts` to Drizzle queries (smallest, best-isolated surface) with raw `query.ts` still serving the rest. Verify behavior with the existing unit tests. This is the "does the ORM earn its place" checkpoint.
7. **Data migration (optional, if keeping local data).** Export `data/budget.db` → SQL/CSV and import into Neon via a script or `drizzle-kit`/`psql`. Non-destructive: local DB untouched.
8. **Flip the switch.** Set `DATABASE_URL` in Vercel, remove `POSTGRES_URL`. App runs 100% on Neon; SQLite path becomes dead but is not yet deleted (rollback insurance).
9. **Retire the SQLite layer.** Remove `translatePgToSQLite()`, `query.ts` SQLite branches, `init.ts` SQLite schema, `better-sqlite3`, `data/`, the Vercel fail-fast, and the `.mjs` seed shim. Update `scripts/seed-demo.ts` to seed Neon.
10. **Converge all modules on the ORM.** Convert the remaining 31 files (§D) from `query.ts` to Drizzle; delete `query.ts`/`init.ts` if fully subsumed. Keep the typed generic function signatures so call sites change minimally.
11. **Auth.js migration (separate initiative).** Swap JWT/`session` cookie for Auth.js (Neon `@auth/sveltekit` adapter stores sessions/users in a new table via Drizzle). Wire `hooks.server.ts` + `src/lib/auth.ts`; keep bcrypt hash import for existing users. **Not part of the DB cut-over; can proceed in parallel or after.**

---

## I. Files Expected to Change

### Required (Phase 2+)
| File | Change |
|---|---|
| `src/lib/database/index.ts` | `DATABASE_URL` alias, retire SQLite/`usePostgres`, pool config |
| `src/lib/database/query.ts` | Delete (subsumed by ORM) or strip SQLite branch |
| `src/lib/database/init.ts` | Extract migrations; then delete/trim |
| `src/hooks.server.ts` | Env guard → `DATABASE_URL` |
| `src/lib/auth.ts` | Phase 11 (Auth.js); secret key source unchanged |
| `package.json` | `+ drizzle-orm`, `drizzle-kit`; `− better-sqlite3` |
| `.env.example` | `DATABASE_URL=` replaces `POSTGRES_URL=` |
| `scripts/seed-demo.ts`, `.mjs` | Seed Neon via `DATABASE_URL` |
| `src/routes/*/*.server.ts` + `src/routes/api/**/+server.ts` (26 files) | Query layer swap (step 10) |
| `src/lib/server/*.ts` (6 files) | ORM conversion |
| `src/lib/types.ts` | Align to ORM-generated types (esp. `active` boolean) |
| `src/lib/database/migrations/` | **New** — numbered SQL migrations |

### Likely
| File | Change |
|---|---|
| `drizzle.config.ts` | **New** — Drizzle config |
| `src/app.d.ts` | `App.Locals` unchanged, but PageData may drift as types change |
| `plans/` | Phase 2 plan doc |
| `.env` (local, untracked) | Add `DATABASE_URL` |
| Vercel project settings | Env var swap (external) |

### Optional
- `src/lib/utils/*` — unchanged; they're DB-agnostic.
- `vite.config.ts` — only if the PWA `NetworkFirst` API caching needs re-review for Neon round-trips (informational; likely no change).
- `src/lib/auth.ts` → Auth.js adapter files (Phase 11).

### Do NOT touch
- **All UI components** (`src/lib/components/*`, 72 files) — zero DB imports, zero client-side DB access; the ORM is invisible to them.
- `src/styles/*`, `src/lib/stores/*`, `src/lib/utils/*` (format, chart, csv, pdf, importValidation, etc.) — DB-agnostic.
- `src/routes/transactions/*` Svelte components and the filter redesign work on the current branch.

---

## J. Risk Assessment

| # | Risk | Level | Justification & mitigation |
|---|---|---|---|
| 1 | **SQL dialect incompatibility** | **LOW** | The app already writes Postgres dialect and already targets Neon. The translator only affects SQLite. Verified features (ILIKE, `::`, TO_CHAR, EXTRACT, NOW, CURRENT_DATE, RETURNING) are all native PG. |
| 2 | **Data loss / destructive change** | **LOW** | Non-destructive plan: Neon is additive; SQLite stays the source of truth until step 8; rollback = point `POSTGRES_URL`/`DATABASE_URL` back. No schema drops until step 9. |
| 3 | **Boot-time inline migrations on a growing dataset** | **MEDIUM** | `init.ts` re-runs full-table `UPDATE lendings SET status` on every cold start (§G.8). Extracted to one-time migrations in step 5. |
| 4 | **`TIMESTAMPTZ` → JS `Date` semantics** | **MEDIUM** | Neon returns `Date` for timestamp columns, strings for `DATE` columns (§G.5). Existing code tolerates both; ORM migration must not introduce string expectations. |
| 5 | **Serverless connection/transaction handling** | **MEDIUM** | `withTransaction` holds a dedicated client (§G.6) + module-level pool (§G.7). Correct at this scale; requires pooled connection string and keeping the singleton pattern. |
| 6 | **Boolean/INTEGER `active` seam** | **LOW** | PG coerces `0/1`→bool; reads differ between dialects (§G.4). No current bug; ORM typing surfaces it early. |
| 7 | **ORM adoption friction** | **MEDIUM** | Converting 32 files is mechanical but touches every server path. Mitigated by step 6 pilot + keeping generic signatures. If the pilot shows no payoff, the zero-ORM path (§F alternatives) is cheaper. |
| 8 | **Auth.js session swap** | **MEDIUM** | New sessions table + cookie changes affect every request via `hooks.server.ts`. Scoped to Phase 11, separate from DB cut-over. |
| 9 | **Dev/prod drift (SQLite vs Neon)** | **MEDIUM→LOW** | Exists today; eliminated by step 8/9. Main reason the migration is worth doing. |

**Overall posture: LOW→MEDIUM.** The highest-value risk (dual-dialect drift, #9) is exactly what the migration removes; the residual risks (#3–#5) are well-understood serverless/Postgres patterns with documented mitigations.

---

## K. STOP

AUDIT COMPLETE. Per instructions:
- ✅ **No application code, schema, routes, auth, or UI modified.**
- ✅ **No packages installed** (`drizzle`, `prisma`, etc. remain uninstalled).
- ✅ **No migrations created, no database changes, no connection string hardcoded or committed.**
- ✅ **No secrets printed** — only variable names and consumption sites.

**Awaiting approval before Phase 2.** On approval, Phase 2 begins at **H.1** (env-var alias) and proceeds one step at a time; every step is non-destructive and reversible.

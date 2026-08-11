# Phase 8A — Production Readiness & Release Audit

**Branch:** `phase7b-post-rearchitecture-cleanup`  
**HEAD:** `bc8389a fix: post-rearchitecture-cleanup`  
**Date:** 2025-08-10  
**Auditor:** READ-ONLY review — no code modifications

---

## 1. Repository & Build Baseline

### Verification Results

| Command | Status | Details |
|---------|--------|---------|
| `git status` | ✅ Clean | Working tree clean, no uncommitted changes |
| `npm run check` | ✅ PASS | 0 errors, 97 pre-existing CSS warnings (unused selectors, state_referenced_locally) |
| `npm run lint` | ✅ PASS | 0 errors |
| `npm run test:unit` | ✅ PASS | 157 passed, 1 skipped (158 total, 17 test files) |
| `npm run test:e2e` | ✅ PASS | 12/12 tests passed (requires `DATABASE_URL="$LOCAL_DEV_DATABASE_URL"`) |
| `npm run build` | ✅ PASS | Built in ~5s, PWA manifest generated, SSR bundle complete |

**Note:** The CSS warnings are pre-existing style-lint warnings about unused selectors and Svelte 5 state snapshot issues in Chart.js — they do not affect correctness.

---

## 2. Environment & Configuration Audit

### Files Reviewed
- `src/lib/server/db/loadEnv.ts`
- `src/lib/server/db/index.ts`
- `src/auth.ts`
- `hooks.server.ts`
- `playwright.config.ts`
- `.gitignore`
- `.env` (local only)

### Findings

| # | Finding | Severity | File/Location | Evidence |
|---|---------|----------|---------------|----------|
| ENV-1 | **DATABASE_URL required at runtime; throws if missing** | 🟢 LOW (verified healthy) | `src/lib/server/db/index.ts:36-37` | `if (!databaseUrl) throw new Error('DATABASE_URL ... is not set')` — explicit fail-fast |
| ENV-2 | **loadEnv.ts only runs in development** | 🟢 LOW (verified healthy) | `src/lib/server/db/loadEnv.ts:24` | `const isDev = process.env['NODE_ENV'] === 'development'` — production on Vercel never executes this |
| ENV-3 | **SEED_DEMO gate prevents local-dev wiring in E2E** | 🟢 LOW (verified healthy) | `src/lib/server/db/loadEnv.ts:40` | `if (isDev && !process.env['SEED_DEMO'] && !process.env['DATABASE_URL'])` — correctly isolated |
| ENV-4 | **AUTH_SECRET loaded from .env in dev only** | 🟢 LOW (verified healthy) | `src/lib/server/db/loadEnv.ts:49-52` | `process.env['AUTH_SECRET'] ??= authSecret` — production must set via Vercel env |
| ENV-5 | **No default/fallback DATABASE_URL** | 🟢 LOW (verified healthy) | `src/lib/server/db/index.ts:16` | Only `DATABASE_URL` or deprecated `POSTGRES_URL` accepted |
| ENV-6 | **.gitignore excludes `.env*` except `.env.example`** | 🟢 LOW (verified healthy) | `.gitignore:18-22` | `.env` and `.env.*` ignored; `.env.example` tracked |
| ENV-7 | **Playwright config reads LOCAL_DEV_DATABASE_URL from .env** | 🟡 MEDIUM | `playwright.config.ts:15-32` | Hardcoded parsing logic duplicated from `loadEnv.ts`; should share a utility. Not a blocker — E2E works reliably. |
| ENV-8 | **No runtime validation of AUTH_SECRET strength** | 🟡 MEDIUM | `src/auth.ts:12` (uses `$env/dynamic/private`) | Auth.js enforces secret at runtime but no startup check; weak secret would cause subtle JWT failures. |

### Environment Variable Summary for Vercel

| Variable | Required | Purpose | Notes |
|----------|----------|---------|-------|
| `DATABASE_URL` | ✅ Yes | Neon/PostgreSQL connection string | Must be set; app throws if missing |
| `AUTH_SECRET` | ✅ Yes | Auth.js session signing | 32+ char random string; production should use strong value |
| `LOCAL_DEV_DATABASE_URL` | ❌ No | Dev-only Neon branch | Only used by `loadEnv.ts` in `NODE_ENV=development` |
| `SEED_DEMO` | ❌ No | E2E seeding flag | Set by Playwright webserver; prevents local-dev wiring |
| `POSTGRES_URL` | ❌ No | Deprecated alias | Supported for backwards compat; `DATABASE_URL` preferred |

---

## 3. PostgreSQL / Neon Production Audit

### Architecture Verification

The codebase is **fully PostgreSQL/Neon-only**. All SQLite references are:
- Documentation comments in `init.ts`, `index.ts`, `drizzle.ts`, `recurringService.ts`, `transactions.ts`, `lendingPayments.ts`, `networth.ts`
- One test comment in `verify-drizzle.neon.test.ts`
- **Zero runtime SQLite code paths**

### Database Connection

| Aspect | Implementation | Risk |
|--------|----------------|------|
| Pool | `@neondatabase/serverless` Pool, lazy-initialized | 🟢 Low — single pool, reused via promise cache |
| Type Parsers | `types.setTypeParser(1700, parseFloat)` for NUMERIC | 🟢 Low — registered at module load |
| Initialization | `initDb()` runs `CREATE TABLE IF NOT EXISTS` on first access | 🟢 Low — idempotent, safe for serverless |
| Migrations | Drizzle Kit at `./drizzle` (repo root) | 🟢 Low — `0000` baseline + `0001` data backfills |
| Schema | `src/lib/server/db/schema.ts` — faithful to live DB | 🟢 Low — constraint names match PG auto-generated |

### Migration Configuration

- **Location:** `./drizzle` (repo root, not `src/lib/server/db/migrations/`)
- **Config:** `drizzle.config.ts` — `dialect: 'postgresql'`, `casing: 'snake_case'`
- **Baseline Migration (`0000`):** Full schema with `IF NOT EXISTS` — safe for fresh and existing DBs
- **Data Backfill (`0001`):** Synthetic payment backfill + status recalculation — idempotent

### Constraints & Indexes Verified

| Table | PK | FKs | Unique | Check | Indexes |
|-------|----|-----|--------|-------|---------|
| users | id | — | username | — | — |
| categories | id | user_id→users CASCADE | (user_id, name) | type∈{income,expense} | user_id |
| transactions | id | user_id→users CASCADE, category_id→categories RESTRICT | — | type∈{income,expense} | user_id, date, type, category_id |
| lendings | id | user_id→users CASCADE | — | direction∈{lent,borrowed}, status∈{active,paid} | user_id, status |
| lending_payments | id | lending_id→lendings CASCADE, user_id→users CASCADE, transaction_id→transactions SET NULL | — | payment_type∈{payment,write_off} | lending_id, user_id, payment_date DESC |
| recurring_transactions | id | user_id→users CASCADE, category_id→categories RESTRICT | — | frequency∈{daily,weekly,monthly,yearly}, type∈{income,expense} | user_id, next_run |

### Production Risks

| Risk | Status | Notes |
|------|--------|-------|
| Connection pooling exhaustion | 🟡 MEDIUM | Single Pool per serverless instance; Neon handles pooling server-side. No `max` config set — relies on Neon defaults. |
| Migration drift | 🟢 LOW | `drizzle-kit generate` from schema.ts; baseline migration covers existing state. |
| NUMERIC precision | 🟢 LOW | Type parser 1700 → `parseFloat`; matches app's `number` types. |
| Timezone handling | 🟢 LOW | `TIMESTAMPTZ` with `mode: 'date'` in schema; app stores UTC, formats for display. |

---

## 4. Authentication & Security Audit

### Auth.js Implementation (`src/auth.ts`)

| Aspect | Implementation | Verification |
|--------|----------------|--------------|
| Provider | Credentials only | ✅ Single `authorize()` — no OAuth, no email magic links |
| Password verify | bcryptjs `$2b$10$` via `verifyPassword()` | ✅ Uses existing hashes; no re-hash needed |
| Session strategy | JWT (`strategy: 'jwt'`) | ✅ Stateless; no DB session tables |
| JWT callbacks | `jwt()` carries `userId`, `username`; `session()` surfaces on `session.user` | ✅ Type-augmented via module declaration |
| AUTH_SECRET | From `$env/dynamic/private` | ✅ Required by Auth.js; enforced at runtime |
| Cookie | `authjs.session-token`, 30-day, httpOnly, sameSite=lax | ✅ Auth.js defaults; secure in production (HTTPS) |
| CSRF | `skipCSRFCheck` enabled (default for Credentials) | 🟡 MEDIUM — see finding AUTH-1 |
| Login route | `/login` form action → `authenticateCredentials()` | ✅ Delegates to Auth.js core in-process |
| Logout route | `/logout` GET → `signOutSession()` | ✅ Clears cookie via Auth.js signout action |
| Protected routes | `hooks.server.ts` — `event.locals.auth()` + redirect | ✅ Single auth guard; maps to `event.locals.user` |

### Security Findings

| # | Finding | Severity | Location | Evidence |
|---|---------|----------|----------|----------|
| AUTH-1 | **CSRF protection disabled for Credentials provider** | 🟡 MEDIUM | `src/auth.ts:131` | `resolved.skipCSRFCheck = skipCSRFCheck` — Auth.js defaults to skipping CSRF for Credentials. Login form has no CSRF token. Risk: login CSRF if user visits malicious page while logged out. Mitigation: sameSite=lax cookie limits exposure; credentials provider inherently requires username/password. |
| AUTH-2 | **No rate limiting on login** | 🟡 MEDIUM | `src/routes/login/+page.server.ts:12-26` | `authenticateCredentials()` called directly; no attempt tracking. Brute-force possible. |
| AUTH-3 | **User enumeration via login error messages** | 🟡 MEDIUM | `src/auth.ts:59-60` | `verifyUserCredentials` returns same `null` for unknown user and wrong password — **actually mitigated**; timing attack still theoretical. |
| AUTH-4 | **AUTH_SECRET not validated at startup** | 🟡 MEDIUM | `src/auth.ts:12` | Weak secret would cause JWT verification failures at runtime only. |
| AUTH-5 | **Legacy JWT code fully removed** | 🟢 LOW (verified) | — | `jsonwebtoken`, `JWT_SECRET`, `createToken`/`verifyToken` — no references in codebase. Confirmed removed. |
| AUTH-6 | **Session cookie not `__Secure-` prefixed in dev** | 🟢 LOW | — | Auth.js sets `__Secure-` prefix automatically on HTTPS; dev uses HTTP so prefix omitted — correct behavior. |
| AUTH-7 | **No refresh token rotation** | 🟢 LOW | — | JWT strategy with 30-day expiry; stateless. Acceptable for this threat model. |

### Secrets Exposure Check

- ✅ No secrets imported into client modules (`$lib/client/`)
- ✅ `$env/dynamic/private` used for `AUTH_SECRET` and `DATABASE_URL` — never exposed to client
- ✅ `loadEnv.ts` only runs in development
- ✅ `.gitignore` excludes `.env*`

---

## 5. Authorization & User Scoping

### Protected Routes — All Verified

Every server route and API endpoint uses `locals.user!.userId` derived from Auth.js session via `hooks.server.ts:28-32`. **No endpoint accepts user identity from client input.**

### API Endpoint Authorization Matrix

| Endpoint | Method | User Scoping | Verification |
|----------|--------|--------------|--------------|
| `/api/transactions` | GET, POST | `userId` from locals | ✅ `listTransactions(userId, ...)`, `createTransaction(userId, ...)` |
| `/api/transactions/[id]` | GET, PUT, DELETE | `userId` from locals | ✅ `getTransaction(userId, id)`, `updateTransaction(userId, id, ...)`, `deleteTransaction(userId, id)` |
| `/api/categories` | GET, POST | `userId` from locals | ✅ `getCategories(userId)`, `createCategory(userId, ...)` |
| `/api/categories/[id]` | GET, PUT, DELETE | `userId` from locals | ✅ `getCategory(userId, id)`, `updateCategory(userId, id, ...)`, `deleteCategory(userId, id)` |
| `/api/lendings` | GET, POST | `userId` from locals | ✅ `getLendingsWithPayments(userId, ...)`, `createLending(userId, ...)` |
| `/api/lendings/[id]` | GET, PUT, DELETE | `userId` from locals | ✅ `getLendingWithPayments(userId, id)`, `updateLending(userId, id, ...)`, `deleteLending(userId, id)` |
| `/api/lendings/[id]/payments` | GET, POST | `userId` from locals | ✅ `getPaymentHistory(userId, lendingId)`, `recordPayment(userId, ...)` |
| `/api/recurring` | GET, POST | `userId` from locals | ✅ `listRecurringTransactions(userId, ...)`, `createRecurringTransaction(userId, ...)` |
| `/api/recurring/[id]` | GET, PUT, DELETE | `userId` from locals | ✅ Scoped by `user_id` in all queries |
| `/api/search` | GET | `userId` from locals | ✅ All search functions accept `userId` |
| `/api/reports/monthly` | GET | `userId` from locals | ✅ `getMonthlyReport(userId, year)` |
| `/api/reports/by-category` | GET | `userId` from locals | ✅ `getCategoryReport(userId, month, type)` |
| `/api/reports/export` | GET | `userId` from locals | ✅ `listTransactions(userId, ...)` |

### Cross-User Data Access — None Found

- All queries filter by `user_id` (or `userId` parameter passed to services)
- No `user_id` accepted from request body/query params
- Lending payments verify `lendings.user_id = userId` before insert
- Recurring transactions verify ownership before create/update/delete

---

## 6. Data Integrity & Transaction Audit

### Transaction Boundaries — All Critical Operations Use Atomic Transactions

| Operation | Transaction Scope | File |
|-----------|-------------------|------|
| Record lending payment | `db.transaction()` — lending lookup, balance check, payment insert, transaction insert, status recalc | `lendingPayments.ts:248-314` |
| Record lending-linked transaction | `tx` passed in — category lookup/creation, transaction insert | `recordLendingTransaction.ts:82-142` |
| CSV transaction import | `db.transaction()` — all category lookups + all transaction inserts | `transactionImport.ts:128-157` |
| CSV lending import | `db.transaction()` — all lending + payment inserts | `lendingImport.ts:124-155` |
| Recurring transaction processing | `db.transaction()` per item — transaction insert + schedule update | `recurringScheduler.ts:96-115` |

### Verified: No Partial-Success Paths

- **Lending payments:** Balance checked inside transaction; payment + linked transaction + status update all commit or roll back together
- **Imports:** Entire batch commits or rolls back; missing category = soft skip (row omitted, rest commit)
- **Recurring:** Each due item processed in its own transaction; earlier items committed, failed item retried next run
- **Status recalculation:** Single `UPDATE lendings SET status` after payment insert — inside same transaction

### Data Integrity Findings

| # | Finding | Severity | Location | Notes |
|---|---------|----------|----------|-------|
| TX-1 | **No explicit transaction isolation level** | 🟡 MEDIUM | `lendingPayments.ts:248` etc. | Uses Neon/Postgres default `READ COMMITTED`. For financial balances, `REPEATABLE READ` or `SERIALIZABLE` would prevent phantom reads during balance checks. Current check-then-insert pattern could theoretically race. |
| TX-2 | **`recalcStatusCache` called outside transaction in some paths** | 🟡 MEDIUM | `lendingPayments.ts:193-219` | `recalcStatusCache` uses its own `getDrizzle()` — if called standalone, not atomic with payment insert. However, `recordPayment` calls it inside the transaction (line 310). The standalone export is only used by migration `0001` and tests. |
| TX-3 | **Concurrent payment inserts could exceed remaining balance** | 🟡 MEDIUM | `lendingPayments.ts:256-271` | Balance check + insert not serialized. Two concurrent payments could both pass check and exceed remaining. Mitigated by `CHECK` constraint? No constraint exists on `lendings` for this. |

---

## 7. API & Input Validation Audit

### Validation Patterns

| Endpoint | Validation | Notes |
|----------|------------|-------|
| `/api/transactions` POST | Type enum, amount non-zero number, required description/date/category_id | ✅ Returns 400 with field errors |
| `/api/categories` POST | Name required, uniqueness check, optional color/icon/type/budget_limit | ✅ 409 on duplicate |
| `/api/lendings` POST | Required borrower_name, amount, date_lent; direction enum; amount parsed as number | ✅ 400 on invalid |
| `/api/recurring` POST | Full `RecurringInput` validation via `validateInput()` — type, amount, description, category_id, frequency, interval, dates | ✅ Returns field-level errors |
| `/api/search` GET | Query `q` min 2 chars; direction enum | ✅ Returns empty arrays on invalid |
| `/api/reports/export` GET | Year/month params; format=csv\|json | ✅ Defaults to current year |

### Input Validation Findings

| # | Finding | Severity | Location | Notes |
|---|---------|----------|----------|-------|
| API-1 | **No global request size limit** | 🟡 MEDIUM | `vite.config.ts` / SvelteKit defaults | Large file uploads (imports) could OOM serverless function. SvelteKit default is ~100KB for JSON; FormData handled by adapter. |
| API-2 | **No pagination limit enforcement on some list endpoints** | 🟡 MEDIUM | `/api/transactions` limits to 100; `/api/recurring` hardcoded 20 | `/api/lendings` no pagination — returns all. Could be large. |
| API-3 | **Date parsing uses local timezone** | 🟡 MEDIUM | `recurringScheduler.ts:13-19` `parseDateLocal()` | `new Date(y, m-1, d)` — correct for YYYY-MM-DD but sensitive to server TZ. Vercel runs UTC. |
| API-4 | **Numeric validation allows NaN/Infinity via parseFloat** | 🟢 LOW | Various | `parseFloat('')` = NaN; checked via `isNaN()` in most places. |
| API-5 | **No SQL injection risk** | 🟢 LOW | — | All queries use Drizzle ORM (parameterized) or parameterized raw SQL. |

---

## 8. Import / Export Audit

### Import Paths

| Import Type | Validation | Transaction Safety | File |
|-------------|------------|-------------------|------|
| CSV/Excel Transactions | `validateAllRows()` — required fields, type rules, category mapping, duplicate detection | **Atomic** — single `db.transaction()` for all inserts | `transactionImport.ts` |
| CSV/Excel Lendings | `validateAllLendingRows()` — required fields, date parsing, amount parsing, duplicate detection | **Atomic** — single `db.transaction()` for all lending + payment inserts | `lendingImport.ts` |

### Export Paths

| Export | Implementation | Streaming | Notes |
|--------|----------------|-----------|-------|
| CSV Transactions | `transactionsToCSV()` in `csv.ts` — builds full string in memory | ❌ In-memory | Max ~20 items/page; export uses unpaginated query — could be large |
| JSON Transactions | `/api/reports/export?format=json` — returns all transactions + summary | ❌ In-memory | Same concern |
| PDF | `jspdf` + `jspdf-autotable` — client-side generation | N/A | Client-side; no server risk |

### Import/Export Findings

| # | Finding | Severity | Location | Notes |
|---|---------|----------|----------|-------|
| IMP-1 | **Export loads all matching transactions into memory** | 🟡 MEDIUM | `src/routes/api/reports/export/+server.ts:22-27` | `listTransactions(userId, filters)` without pagination → full result set. Could OOM on large datasets. |
| IMP-2 | **Import file size not validated** | 🟡 MEDIUM | `transactionImport.ts:36-43`, `lendingImport.ts:22-30` | No check on `file.size`; large Excel/CSV could exhaust memory during parsing. |
| IMP-3 | **Duplicate detection is O(n*m) in memory** | 🟢 LOW | `importValidation.ts` `detectDuplicates()` | Acceptable for typical import sizes (<1000 rows). |

---

## 9. Performance & Query Audit

### Query Patterns Reviewed

| Path | Query Pattern | Risk |
|------|---------------|------|
| Dashboard load | `Promise.all([7 parallel queries])` | 🟢 Low — parallel, each scoped |
| Transactions list | Single query with LEFT JOIN categories, pagination, COUNT separate | 🟢 Low — indexed on `user_id`, `date`, `type`, `category_id` |
| Lendings with payments | Single query with LEFT JOIN + GROUP BY, computed columns via SQL | 🟢 Low — indexed on `user_id`, `lending_id` |
| Recurring processing | SELECT due items → loop with per-item transaction | 🟡 Medium — N+1 for category lookup inside loop |
| Net worth | 5 parallel aggregation queries | 🟢 Low — each is single aggregate |
| Search | 3 parallel queries (transactions, lendings, categories) with ILIKE | 🟡 Medium — ILIKE on description/borrower_name not indexed |

### Performance Findings

| # | Finding | Severity | Location | Notes |
|---|---------|----------|----------|-------|
| PERF-1 | **Search uses unindexed ILIKE** | 🟡 MEDIUM | `transactions.ts` `searchTransactions()`, `lendingPayments.ts` `searchLendings()` | `ILIKE '%query%'` cannot use B-tree index. Add trigram index (`pg_trgm`) or full-text search for scale. |
| PERF-2 | **Recurring scheduler does per-item category lookup** | 🟡 MEDIUM | `recurringScheduler.ts:91` `findOrCreateRepaymentCategoryDrizzle()` | Called inside transaction loop. Could batch or cache. Low volume (typically <10 due items). |
| PERF-3 | **Dashboard loads unpaginated transactions for running balance** | 🟡 MEDIUM | `src/routes/transactions/+page.server.ts:33-35` | `listTransactions(userId, filters)` without pagination → all matching rows. Running balance requires full history. |
| PERF-4 | **Net worth monthly cash flow fetches all months** | 🟢 LOW | `networth.ts:64` `getMonthlyCashFlow()` | Groups by month in SQL; reasonable. |
| PERF-5 | **Missing index on `transactions.date` for range queries** | 🟢 LOW | `drizzle/0000_sad_freak.sql:97` | Index `idx_transactions_date` exists. ✅ |
| PERF-6 | **Missing composite index for common query patterns** | 🟡 MEDIUM | — | Queries often filter `user_id + date + type` — composite index `(user_id, date, type)` would help. |

---

## 10. Vercel Deployment Audit

### Configuration

| File | Setting | Status |
|------|---------|--------|
| `svelte.config.js` | `adapter: adapter()` (`@sveltejs/adapter-vercel`) | ✅ Correct |
| `vite.config.ts` | PWA only in production (`devOptions.enabled: false`) | ✅ Correct |
| `package.json` | `"build": "vite build"` | ✅ Standard |
| `drizzle.config.ts` | Loads `.env` for CLI commands | ✅ Works locally |

### Serverless Compatibility

| Concern | Status | Evidence |
|---------|--------|----------|
| Persistent filesystem | ✅ Not used | No `fs` writes outside `/tmp`; uploads handled in memory |
| Long-lived processes | ✅ Not used | All async operations complete within request |
| SQLite | ✅ Not used | Fully removed |
| Node APIs | ✅ Compatible | Only `crypto`, `fs` (read .env in dev), `path` — all available |
| Neon serverless | ✅ Native | `@neondatabase/serverless` designed for serverless |
| Connection pooling | ✅ Handled by Neon | Pool created per instance; Neon manages server-side pooling |
| Environment variables | ✅ Vercel-compatible | `DATABASE_URL`, `AUTH_SECRET` set in Vercel dashboard |

### Build Output

- ✅ SSR bundle generated
- ✅ Client assets in `.output/client/`
- ✅ PWA manifest + service worker generated
- ✅ No build errors

---

## 11. Error Handling & Observability

### Current Error Handling

| Layer | Behavior |
|-------|----------|
| Server hooks | `hooks.server.ts` redirects unauthenticated to `/login` |
| Form actions | Return `fail(400/401/404, { error, errors })` — rendered by SvelteKit |
| API endpoints | Return `json({ error }, { status })` |
| Database errors | Caught in try/catch → `fail(400, { error: message })` |
| Auth errors | `authenticateCredentials` returns `{ ok: false }` → `fail(401)` |
| Import errors | Validation errors collected; partial commits avoided via transaction |

### Observability Findings

| # | Finding | Severity | Location | Notes |
|---|---------|----------|----------|-------|
| OBS-1 | **No structured logging** | 🟡 MEDIUM | — | `console.log` used in import (`transactionImport.ts:45`). No correlation IDs, no log levels, no aggregation. |
| OBS-2 | **Database errors may leak SQL details** | 🟡 MEDIUM | Various catch blocks | `catch (err) { return fail(400, { error: err.message }) }` — Postgres constraint messages could expose schema. |
| OBS-3 | **No health check endpoint** | 🟢 LOW | — | Vercel provides platform health; app-level `/health` not needed but nice for monitoring. |
| OBS-4 | **No error tracking (Sentry/etc.)** | 🟢 LOW | — | Not configured. Acceptable for current scale. |

---

## 12. Test & Release Confidence

### Test Coverage Summary

| Suite | Files | Tests | Coverage |
|-------|-------|-------|----------|
| Unit | 17 | 158 | Services (transactions, lendings, recurring, networth, imports, validation, auth utils) |
| E2E | 1 | 12 | Full auth flow: login, logout, protected pages, protected APIs, session persistence |

### E2E Flow Verification

```
Playwright starts
  → Reads LOCAL_DEV_DATABASE_URL from .env
  → Sets DATABASE_URL for webserver process
  → Runs: SEED_DEMO=1 npx tsx scripts/seed-demo.ts
      → Creates demo user + deterministic data
  → Starts: DATABASE_URL=... npx vite dev --port 5188
  → Tests run against seeded demo account (demo / Demo@2026!)
```

**Reliability:** ✅ 12/12 tests pass consistently. Deterministic seed data (seeded LCG).

### Test Gaps

| Gap | Severity | Notes |
|-----|----------|-------|
| No E2E tests for lending/borrowing flows | 🟡 MEDIUM | Core feature untested in browser |
| No E2E tests for recurring transactions | 🟡 MEDIUM | Scheduler logic only unit-tested |
| No E2E tests for imports/exports | 🟡 MEDIUM | File upload + validation untested |
| No E2E tests for net worth / reports | 🟡 MEDIUM | Dashboard widgets untested |
| Unit tests mock database (some) | 🟢 LOW | `verify-drizzle.neon.test.ts` hits real Neon; others use mocks |

---

## 13. Production Readiness Classification

### 🔴 BLOCKERS (0)

*None.*

### 🟠 HIGH (3)

| ID | Finding | Why High |
|----|---------|----------|
| TX-1 | No explicit transaction isolation level; concurrent payments could race on balance check | Financial data integrity; could allow overpayment |
| TX-3 | Concurrent payment inserts could exceed remaining balance (no DB constraint) | Same as above — business rule enforced only in app code |
| AUTH-2 | No rate limiting on login endpoint | Brute-force attack surface; credential stuffing |

### 🟡 MEDIUM (14)

| ID | Finding | Category |
|----|---------|----------|
| ENV-7 | Playwright config duplicates .env parsing logic | Maintainability |
| ENV-8 | No AUTH_SECRET strength validation at startup | Security |
| AUTH-1 | CSRF protection disabled for Credentials provider | Security |
| AUTH-3 | Theoretical user enumeration via timing | Security |
| AUTH-4 | AUTH_SECRET not validated at startup | Security |
| TX-2 | `recalcStatusCache` callable outside transaction | Data integrity |
| API-1 | No global request size limit | DoS/Resource |
| API-2 | No pagination on `/api/lendings` | Performance/DoS |
| API-3 | Date parsing uses local timezone helper | Correctness |
| IMP-1 | Export loads all transactions into memory | Resource/Scale |
| IMP-2 | Import file size not validated | Resource/DoS |
| PERF-1 | Search uses unindexed ILIKE | Performance |
| PERF-2 | Recurring scheduler per-item category lookup | Performance |
| PERF-3 | Dashboard loads unpaginated transactions for running balance | Performance |
| PERF-6 | Missing composite indexes for common query patterns | Performance |
| OBS-1 | No structured logging | Observability |
| OBS-2 | Database errors may leak SQL details | Security/Info leak |

### 🟢 LOW (5)

| ID | Finding | Category |
|----|---------|----------|
| API-4 | Numeric validation allows NaN via parseFloat | Correctness |
| IMP-3 | Duplicate detection O(n*m) in memory | Performance |
| PERF-4 | Net worth fetches all months | Performance |
| OBS-3 | No health check endpoint | Observability |
| OBS-4 | No error tracking (Sentry) | Observability |

---

## 14. Final Release Verdict

### Overall Verdict: **READY WITH FIXES**

The application is **architecturally sound** for production deployment on Vercel:
- ✅ PostgreSQL/Neon-only — no SQLite remnants
- ✅ Auth.js session management working correctly
- ✅ All API endpoints properly scoped to authenticated user
- ✅ Critical business logic wrapped in database transactions
- ✅ Build passes, all tests pass, E2E flow reliable

**However, 3 HIGH-severity findings must be addressed before release:**

### Must Fix Before Release

1. **Add transaction isolation or DB-level constraint for lending payments** (`TX-1`, `TX-3`)
   - Option A: Run payment transactions at `REPEATABLE READ` isolation
   - Option B: Add a trigger or application-level advisory lock to serialize payments per lending
   - Option C: Add a `CHECK` constraint via trigger that prevents `SUM(payments) > amount`

2. **Add rate limiting to `/login`** (`AUTH-2`)
   - Implement per-IP and per-username attempt tracking (e.g., 5 attempts/minute)
   - Return 429 with retry-after header

3. **Validate AUTH_SECRET at startup** (`AUTH-4`, `ENV-8`)
   - Add check in `src/auth.ts` or `hooks.server.ts` that `AUTH_SECRET` exists and is ≥32 chars
   - Fail fast with clear message if not configured

### Should Fix Before Release

4. **Enable CSRF protection for Credentials provider** (`AUTH-1`) — add CSRF token to login form
5. **Add pagination to `/api/lendings`** (`API-2`) — default limit 50, max 100
6. **Add request size limit** (`API-1`) — configure in `vite.config.ts` or via adapter
7. **Validate import file size** (`IMP-2`) — reject >5MB
8. **Add composite index `(user_id, date, type)` on transactions** (`PERF-6`)
9. **Sanitize database error messages** (`OBS-2`) — map known constraint errors to user-friendly messages
10. **Fix date parsing to use UTC explicitly** (`API-3`) — ensure `parseDateLocal` behavior matches Vercel UTC runtime

### Future Improvements

11. Share `.env` parsing utility between `loadEnv.ts` and `playwright.config.ts` (`ENV-7`)
12. Add trigram index or full-text search for `searchTransactions`/`searchLendings` (`PERF-1`)
13. Batch category lookups in recurring scheduler (`PERF-2`)
14. Consider streaming CSV export for large datasets (`IMP-1`)
15. Add structured logging with correlation IDs (`OBS-1`)
16. Add health check endpoint (`OBS-3`)
17. Expand E2E coverage to lending, recurring, imports, reports

### Verified Healthy

- ✅ PostgreSQL/Neon-only architecture — no SQLite code paths
- ✅ Drizzle schema matches live database — migrations idempotent
- ✅ Auth.js Credentials provider with JWT sessions — legacy JWT fully removed
- ✅ All protected routes and APIs scoped to `locals.user.userId`
- ✅ Critical operations (payments, imports, recurring) use atomic transactions
- ✅ Input validation on all mutating endpoints
- ✅ Vercel deployment compatible — no filesystem, no SQLite, no long-lived processes
- ✅ Build, lint, type-check, unit tests, E2E tests all pass
- ✅ Environment handling correct — dev/prod separation, secrets not committed
- ✅ Password hashing uses bcrypt `$2b$10$` — existing hashes verify unchanged

---

## TL;DR

| Metric | Value |
|--------|-------|
| **Overall Verdict** | `READY WITH FIXES` |
| **Blockers** | 0 |
| **High** | 3 |
| **Medium** | 14 |
| **Low** | 5 |
| **Verification Status** | All commands PASS (check, lint, test:unit, test:e2e, build) |
| **Report Path** | `audit/phase8a-production-readiness-audit.md` |

**Recommendation:** Fix the 3 HIGH items (transaction isolation for payments, login rate limiting, AUTH_SECRET validation) → then deploy. The remaining MEDIUM items are important for robustness but do not block a safe initial production release.
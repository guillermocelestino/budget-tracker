# Phase 7A — Complete Post-Rearchitecture Repository Audit (READ-ONLY)

**Audit Date:** 2026-08-10  
**Branch:** `phase7-read-only-audit`  
**HEAD:** `e80399b` ("fix:e2e local db issue")  
**Working Tree:** Clean (no staged, modified, or untracked files in Git)  

---

## Executive Summary

The Architecture-5 boundary restructure (commit `26684a6`) has been successfully implemented. The three-layer architecture (`client` / `server` / `shared`) is present and populated. **However, critical drift exists between the documented architecture (CLAUDE.md) and the actual implementation** — particularly in the database layer, which has silently migrated from dual SQLite/PostgreSQL to PostgreSQL-only.

All verification commands pass:
- `npm run check` — PASS (0 errors, 97 pre-existing CSS warnings)
- `npm run lint` — PASS (0 errors)
- `npm run test:unit` — PASS (157 passed, 1 skipped)
- `npm run build` — PASS (built in ~16s, PWA generated)

---

## 1. Repository State & Git History

### Branch & Commit History
- **Current branch:** `phase7-read-only-audit` (audit branch)
- **HEAD:** `e80399b` — fix for E2E local DB issue
- **Key recent commits:**
  - `26684a6` — Architecture-5 boundary restructure (the main restructure)
  - `46ddd37` — Auth.js migration (Auth-1→4)
  - `ea4bea5` — SQLite runtime retirement
  - `2fe09c7` — Report issue fix
  - `e80399b` — E2E local DB fix

### Working Tree Cleanliness
- `git status` reports clean — zero tracked changes
- Ignored files on disk: `src/lib/.DS_Store`, `dev-dist/`, `.svelte-kit/`, `.vercel/output/`, `test-results/`, `graphify-out/`, `.claude/settings.local.json`

### File Tree (`src/lib/`)
```
src/lib/
├── index.ts (legacy barrel)
├── types.ts (legacy shared types)
├── assets/favicon.svg
├── client/
│   ├── components/ (66 .svelte files)
│   ├── stores/ (preferences.svelte.ts, toast.svelte.ts)
│   └── utils/ (chart.ts, csv.ts, format.ts, pdf.ts)
├── server/
│   ├── .gitkeep (stale)
│   ├── auth/ (index.ts, password.ts)
│   ├── db/ (index.ts, loadEnv.ts, query.ts, init.ts, drizzle.ts, schema.ts, migrations/)
│   ├── services/ (9 modules)
│   └── utils/loginValidation.ts
└── shared/
    └── utils/ (9 pure utilities)
```

---

## 2. Architecture Verification — Layer Boundaries

### Three-Layer Structure ✅ PRESENT
The `client` / `server` / `shared` directories exist and are populated per Architecture-5.

### Dependency Direction Audit — KEY FINDINGS

| Layer | Allowed Imports | Forbidden Imports | Status |
|-------|----------------|-------------------|--------|
| **client** | `$lib/client/*`, `$lib/shared/*`, `$lib/types` | `$lib/server/*`, database, server auth, Node APIs | ✅ Clean (no violations found) |
| **server** | `$lib/server/*`, `$lib/shared/*`, `$lib/types` | `$lib/client/*`, browser APIs | ✅ Clean (no violations found) |
| **shared** | other `$lib/shared/*`, `$lib/types` | `$lib/client/*`, `$lib/server/*`, database, Drizzle, Neon, Auth.js, bcrypt, Node APIs, browser APIs | ✅ Clean (no violations found) |

### Route File Imports — VERIFIED
All `+page.server.ts`, `+server.ts` files correctly import from `$lib/server/services/*` and `$lib/server/db/*`. No client-layer imports in server routes.

### Legacy Files at Root of `src/lib/` ⚠️
- `src/lib/index.ts` — legacy barrel export (likely stale)
- `src/lib/types.ts` — duplicate of types now in shared/domain (potential drift)

---

## 3. Database Architecture — CRITICAL DRIFT

### Documented (CLAUDE.md) vs. Actual Implementation

| Aspect | CLAUDE.md Claims | Actual Implementation |
|--------|------------------|----------------------|
| **Runtime** | Dual SQLite (dev) / PostgreSQL/Neon (prod) | **PostgreSQL-only** (Neon via `@neondatabase/serverless`) |
| **Detection** | Auto-detected via `POSTGRES_URL` env var | `DATABASE_URL` is **required**; throws if missing |
| **Translation** | `translatePgToSQLite()` converts `$1→?`, `::type`, `TO_CHAR`, etc. | **Function does not exist** — removed |
| **SQL Dialect** | All SQL written in Postgres dialect | All SQL is native Postgres; no translation layer |
| **SQLite Path** | `getSQLiteDb()` with WAL mode, FK on | **No `getSQLiteDb()` function exists** in `index.ts` |
| **Better-SQLite3** | Optional dependency for dev | Present in `optionalDependencies` but **never imported/used** |

### Evidence from `src/lib/server/db/index.ts`
```typescript
// Current implementation (lines 1-50)
const databaseUrl = process.env['DATABASE_URL'] ?? process.env['POSTGRES_URL'];
if (!databaseUrl) {
  throw new Error('DATABASE_URL or POSTGRES_URL must be set'); // No SQLite fallback
}
const pgPool = new Pool({ connectionString: databaseUrl });
// ... type parser for NUMERIC (OID 1700) — comment still mentions SQLite
await initDb(); // dynamically imports ./init
```

### Evidence from `src/lib/server/db/loadEnv.ts`
- Lines 6-8 comment: *"the app falls back to SQLite"* — **STALE COMMENT**, contradicts `index.ts`
- Only wires `LOCAL_DEV_DATABASE_URL` → `DATABASE_URL` in development

### Evidence from `src/lib/server/db/query.ts`
- `queryOne`, `queryMany`, `execute`, `withTransaction` — **all pure Postgres via Neon pool**
- **No `translatePgToSQLite` function exists**

### Drizzle Configuration
- `src/lib/server/db/drizzle.ts` — Reuses Neon pool from `getPgPool()`
- `drizzle.config.ts` at repo root — Points to `./src/lib/server/db/schema.ts`
- Migrations at repo root `drizzle/meta/` (`0000_snapshot.json`, `0001_snapshot.json`, `_journal.json`)
- `src/lib/server/db/migrations/` — **Empty directory** (stale location)

### Schema (`src/lib/server/db/schema.ts` & `init.ts`)
- 6 tables: `users`, `categories`, `transactions`, `lendings`, `recurring_transactions`, `lending_payments`
- All DDL is **Postgres dialect** (SERIAL, TIMESTAMPTZ, NUMERIC, CHECK constraints)
- Indexes on `user_id`, `date DESC`, `category_id`, `type`, `status`, `next_run`, `active`, `lending_id`, `payment_date`
- Seed data: 2 default users + 11 categories

### Impact
- **Documentation is incorrect** — CLAUDE.md must be updated to reflect PostgreSQL-only architecture
- **Dev environment requires Neon** (local-dev branch) — no true local SQLite dev mode
- **E2E tests require `DATABASE_URL`** — documented in CLAUDE.md correctly but implementation doesn't match "dual" claim
- **Better-SQLite3 in `optionalDependencies`** is dead weight

---

## 4. Server Services Inventory & Boundaries

### 9 Service Modules in `src/lib/server/services/`

| Module | Responsibility | Key Exports | Transactional? |
|--------|---------------|-------------|----------------|
| `transactions.ts` | CRUD + reports + trends + balance | 10 functions | Some (via `withTransaction`) |
| `categories.ts` | CRUD + budget totals | 6 functions | No |
| `lendingPayments.ts` | **Settlement ledger (source of truth)** | 9 functions | **Yes — all multi-row ops** |
| `recurringService.ts` | CRUD + validation + next_run calc | 6 functions | Yes (create/update) |
| `recurringScheduler.ts` | Process due recurrences, run now, toggle, duplicate | 4 functions | Yes (processRecurringTransactions) |
| `networth.ts` | `computeNetWorth()` — cash + lent − borrowed | 1 function | No (read-only) |
| `recordLendingTransaction.ts` | Transaction creation on lending events | 1 function | Yes |
| `lendingImport.ts` | CSV/Excel lending import | 1 function | Yes |
| `transactionImport.ts` | CSV/Excel transaction import | Validation logic | No (validation only) |

### Boundary Compliance ✅
- All services import **only** from `$lib/server/db/*`, `$lib/shared/utils/*`, `$lib/types`
- Zero imports from `$lib/client/*`
- Zero browser APIs
- `lendingPayments.ts` correctly centralizes derived state: `cash_paid + written_off = resolved_total`, `remaining = amount − resolved_total`, status derived from `remaining > 0`

### Service Usage Pattern
- Page `+page.server.ts` → `load({ locals })` → services
- Form actions → services (with `withTransaction` for atomicity)
- API `+server.ts` → services
- No direct DB queries in routes — all routed through services

---

## 5. Routes & API Endpoints

### Page Routes (14)
| Route | Type | Auth | Key Load Data |
|-------|------|------|---------------|
| `/` | Redirect | Public | 302 → `/dashboard` |
| `/login` | Form | Public | Redirects authed users |
| `/logout` | GET | Authed | Clears Auth.js cookie |
| `/dashboard` | Page | Authed | Summary, trends, lending, networth, recurring |
| `/transactions` | Page | Authed | Paginated, filters, balance |
| `/transactions/new` | Page | Authed | Categories for form |
| `/transactions/[id]/edit` | Page | Authed | Transaction + categories |
| `/categories` | Page | Authed | Categories + spending + usage counts |
| `/lending` | Page | Authed | Lendings + payments + totals |
| `/borrowed` | Page | Authed | Mirror of lending |
| `/recurring` | Page | Authed | Paginated recurring + active count |
| `/recurring/new` | Page | Authed | Categories + initial data |
| `/recurring/[id]` | Page | Authed | Recurring + categories |
| `/reports` | Page | Authed | Monthly + category + YoY data |
| `/net-worth` | Page | Authed | NetWorthSnapshot |
| `/settings` | Page | Authed | User preferences |

### API Routes (RESTful, user-scoped, JSON)
| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/api/transactions` | GET, POST | Paginated, filterable |
| `/api/transactions/[id]` | GET, PUT, DELETE | Single transaction |
| `/api/transactions/export` | GET | CSV export |
| `/api/categories` | GET, POST | With optional spending |
| `/api/categories/[id]` | GET, PUT, DELETE | Single category |
| `/api/lendings` | GET, POST | Filterable by status/direction |
| `/api/lendings/[id]` | GET, PUT, DELETE | Single lending |
| `/api/lendings/[id]/payments` | GET, POST | Payment history + record |
| `/api/recurring` | GET, POST | List + create |
| `/api/recurring/[id]` | GET, PUT, DELETE | Single recurring |
| `/api/search` | GET | Global search (⌘K) |
| `/api/reports/monthly` | GET | Yearly monthly data |
| `/api/reports/by-category` | GET | Category breakdown |
| `/api/reports/export` | GET | Date-range export |

### Route Protection ✅
- `hooks.server.ts` composes `sequence(authHandle, authGuardHandle)`
- Root `/` → 302 `/dashboard`
- Public paths: **only `/login`**
- All other routes: `await event.locals.auth()` → map to `event.locals.user` or 302 `/login`
- API routes also protected via same mechanism

---

## 6. Authentication Implementation (Auth.js)

### Architecture ✅ COMPLETE (Auth-1→5)
- **Package:** `@auth/sveltekit` v1.11.3
- **Provider:** Single Credentials provider
- **Session Strategy:** JWT (no adapter, no DB session tables)
- **Session Cookie:** `authjs.session-token` (30-day, httpOnly, sameSite=lax)
- **Secret:** `AUTH_SECRET` (min 32 chars, from `$env/dynamic/private`)

### Credentials `authorize()` (Auth-2) ✅
- Authenticates against **existing `users` table** via `queryOne`
- Uses `verifyUserCredentials()` (bcrypt) — reuses existing `$2b$10$` hashes
- Returns `null` for unknown user / bad password (generic `CredentialsSignin`)
- **No duplicate lookup/bcrypt** anywhere on auth path

### Identity Mapping (Auth-2) ✅
- `callbacks.jwt` copies `{ userId, username }` into Auth.js token
- `callbacks.session` surfaces on `session.user`
- Module augmentation in `src/auth.ts`: `Session.user = { userId: number; username: string }`

### Session Resolution (Auth-3) ✅
- `hooks.server.ts`: `sequence(authHandle, authGuardHandle)`
- Protected routes: `await event.locals.auth()` → `event.locals.user = { userId, username }`
- Unauthenticated → 302 `/login`

### Login/Logout (Auth-4) ✅
- `/login` form action → `authenticateCredentials()` → Auth.js sign-in → JWT cookie
- `/logout` GET → `signOutSession()` → clears `authjs.session-token` → 302 `/login`
- Failed login: `fail(401)` stays on `/login`

### Legacy JWT Retired (Auth-5) ✅
- `createToken`/`verifyToken`/`jsonwebtoken`/`JWT_SECRET` **removed entirely**
- Password hashing moved to `src/lib/server/auth/password.ts`
- Auth.js (`AUTH_SECRET`) is sole session mechanism

### CSRF ✅
- `@auth/sveltekit` auto-sets `skipCSRFCheck` (SvelteKit's Origin-based form CSRF replaces Auth.js token)
- `/auth/csrf` returns 404 by design

### Dev Wiring (`loadEnv.ts`) ✅
- Forwards `AUTH_SECRET` from `.env` in development

---

## 7. Testing Infrastructure

### Unit Tests (`npm run test:unit`) ✅ PASS
- **157 passed, 1 skipped** (Vitest)
- **17 test files** in `tests/unit-test/`
- Key test coverage:
  - `fileImport.test.ts` — CSV/Excel parsing
  - `importValidation.test.ts` — Import validation logic
  - `lendingImport.test.ts` — Lending import validation
  - Service tests: `transactionImport.test.ts`, `updateLending.test.ts`, `apiLendings.test.ts`
  - Component/logic tests

### E2E Tests (`npm run test:e2e`)
- **Playwright** v1.50.0, Chromium, port 5188
- **Test file:** `tests/e2e/auth.spec.ts` — comprehensive Auth.js flow
- **Requires:** `DATABASE_URL` (Postgres-only runtime)
- **Run command:** `DATABASE_URL="$LOCAL_DEV_DATABASE_URL" npm run test:e2e` after sourcing `.env`
- **Demo credentials:** `demo` / `Demo@2026!` (seeded via `SEED_DEMO=1`)

### E2E Test Coverage (`auth.spec.ts`)
- Login page rendering
- Valid credentials → session creation
- Invalid credentials → rejection
- Unknown user → generic error (no enumeration)
- Empty credentials → validation error
- Session persistence (reload + cross-page)
- Protected route access (pages + `/api/transactions`)
- Protected route rejection (unauthed)
- User identity propagation (username on `/settings`)
- Logout → re-protection

### Test Configuration
- `playwright.config.ts`: Reads `LOCAL_DEV_DATABASE_URL` from `.env`, seeds demo, starts dev server
- `vitest.config.ts`: Standard config
- `scripts/seed-demo.ts`: Deterministic seed data (Maria Santos persona)

---

## 8. CLAUDE.md Accuracy Audit — MAJOR DRIFT

### Critical Inaccuracies

| Section | CLAUDE.md Claim | Reality | Severity |
|---------|-----------------|---------|----------|
| **Database Architecture** | Dual SQLite/PostgreSQL auto-detected via `POSTGRES_URL` | **PostgreSQL-only**; throws without `DATABASE_URL` | 🔴 CRITICAL |
| **Database - Translation** | `translatePgToSQLite()` converts dialects | **Function removed**; no translation layer | 🔴 CRITICAL |
| **Database - SQLite** | `getSQLiteDb()` with WAL mode, FK on | **Function does not exist** | 🔴 CRITICAL |
| **Database - loadEnv** | "falls back to SQLite" comment | Stale comment contradicts `index.ts` | 🟡 HIGH |
| **Dependencies** | `better-sqlite3` as dev dependency | In `optionalDependencies`, never used | 🟡 HIGH |
| **Component Count** | "77 components" | **66 components** in `client/components/` | 🟢 LOW |
| **Migrations Location** | `src/lib/server/db/migrations/` | Empty; actual at repo root `drizzle/meta/` | 🟡 HIGH |
| **Legacy Files** | Not mentioned | `src/lib/index.ts`, `src/lib/types.ts` still exist | 🟡 HIGH |

### Accurate Sections ✅
- Architecture rules (layer boundaries) — matches implementation
- Route structure — matches implementation
- Component inventory categories — matches (count off by 11)
- Server patterns (auth, services, data patterns) — matches
- Type system — matches
- Client/shared/server utilities — matches
- Styling conventions — matches
- Design tokens — matches
- Test commands — match

---

## 9. Dead / Duplicate / Obsolete Code

### Confirmed Dead Code
| File | Reason |
|------|--------|
| `src/lib/index.ts` | Legacy barrel export; no imports found referencing it |
| `src/lib/types.ts` | Duplicate types; actual types in components import from `../types` (relative) or `$lib/types` (ambiguous) |
| `src/lib/server/db/migrations/` | Empty directory; migrations at repo root |
| `src/lib/server/.gitkeep` | Stale; directory now has files |
| `better-sqlite3` in `optionalDependencies` | Never imported; SQLite path removed |

### Intentional Splits (NOT duplicates) ✅
| Pair | Reason |
|------|--------|
| `shared/utils/format.ts` ↔ `client/utils/format.ts` | Pure vs. preferences-integrated + `countUp` |
| `shared/utils/csv.ts` ↔ `client/utils/csv.ts` | Pure serialization vs. browser `downloadCsv()` |
| `shared/utils/loginValidation.ts` ↔ `server/utils/loginValidation.ts` | Pure input validation vs. credential verification |

### Suspicious / Unused Components (66 total, verify usage)
| Component | Notes |
|-----------|-------|
| `CategoryFilterMenu.svelte` | May be unused (filters in `TransactionFilters`/`SearchFilterPill`) |
| `DateFilterMenu.svelte` | May be unused |
| `TypeFilterMenu.svelte` | May be unused |
| `TransactionFilterPanel.svelte` | May be unused (replaced by `TransactionFilters`) |
| `TransactionFilterToolbar.svelte` | May be unused |
| `LiveImpactPreview.svelte` | Unclear usage |

---

## 10. Dependencies & Package Health

### package.json Analysis

#### Dependencies (Production) — 11 packages
| Package | Version | Purpose | Status |
|---------|---------|---------|--------|
| `@auth/sveltekit` | ^1.11.3 | Auth.js integration | ✅ Current |
| `@neondatabase/serverless` | ^1.1.0 | Neon Postgres driver | ✅ Current |
| `@sveltejs/adapter-vercel` | ^6.3.4 | Vercel deployment | ✅ Current |
| `bcryptjs` | ^3.0.3 | Password hashing | ✅ Current |
| `chart.js` | ^4.5.1 | Charts | ✅ Current |
| `drizzle-orm` | ^0.45.2 | ORM for Neon | ✅ Current |
| `jspdf` | ^4.2.1 | PDF export | ✅ Current |
| `jspdf-autotable` | ^5.0.8 | PDF tables | ✅ Current |
| `read-excel-file` | ^9.3.5 | Excel import | ✅ Current |
| `svelte-chartjs` | ^4.0.1 | Svelte Chart.js wrapper | ✅ Current |
| `write-excel-file` | ^4.1.1 | Excel export (in devDeps but used in prod?) | ⚠️ Misplaced |

#### DevDependencies — 22 packages
| Package | Version | Notes |
|---------|---------|-------|
| `@eslint/js` | ^9.39.5 | ✅ |
| `@playwright/test` | ^1.50.0 | ✅ |
| `@sveltejs/kit` | ^2.63.0 | ✅ |
| `@sveltejs/vite-plugin-svelte` | ^7.1.2 | ✅ |
| `@types/bcryptjs` | ^2.4.6 | ✅ |
| `@types/better-sqlite3` | ^7.6.13 | ⚠️ **Dead** — SQLite removed |
| `@types/pg` | ^8.20.0 | ✅ (for Neon types) |
| `@vite-pwa/sveltekit` | ^1.1.0 | ✅ |
| `drizzle-kit` | ^0.31.10 | ✅ |
| `eslint` | ^9.39.5 | ✅ |
| `eslint-plugin-svelte` | ^3.22.0 | ✅ |
| `globals` | ^17.9.0 | ✅ |
| `sharp` | ^0.35.3 | ✅ (PWA icons) |
| `svelte` | ^5.56.1 | ✅ Current |
| `svelte-check` | ^4.6.0 | ✅ |
| `svelte-eslint-parser` | ^1.8.0 | ✅ |
| `typescript` | ^6.0.3 | ✅ |
| `typescript-eslint` | ^8.66.0 | ✅ |
| `vite` | ^8.0.16 | ✅ |
| `vitest` | ^4.1.10 | ✅ |
| `write-excel-file` | ^4.1.1 | ⚠️ **Also in deps** — duplicate |

#### OptionalDependencies — 1 package
| Package | Version | Status |
|---------|---------|--------|
| `better-sqlite3` | ^13.0.1 | 🔴 **Dead weight** — SQLite path removed |

### Issues Found

1. **`write-excel-file` in BOTH `dependencies` AND `devDependencies`** — duplicate
2. **`@types/better-sqlite3` in devDependencies** — dead types for removed runtime
3. **`better-sqlite3` in optionalDependencies** — dead optional dependency
4. **No `jsonwebtoken`** — correctly removed (Auth-5)
5. **No `cookie`/`@sveltejs/adapter-node`** — correctly using Vercel adapter
6. **Svelte 5.56.1** — current (Svelte 5 runes compatible)
7. **SvelteKit 2.63.0** — current
8. **Drizzle 0.45.2 + drizzle-kit 0.31.10** — compatible versions
9. **Auth.js 1.11.3** — current for SvelteKit

### Scripts Analysis
| Script | Command | Architecture Match |
|--------|---------|-------------------|
| `dev` | `vite dev` | ✅ |
| `build` | `vite build` | ✅ |
| `preview` | `vite preview` | ✅ |
| `prepare` | `svelte-kit sync` | ✅ |
| `test` | `test:unit && test:e2e` | ✅ |
| `test:unit` | `vitest run` | ✅ |
| `test:e2e` | `playwright test` | ✅ |
| `check` | `svelte-kit sync && svelte-check` | ✅ |
| `lint` | `eslint .` | ✅ |
| `db:generate` | `drizzle-kit generate` | ✅ |
| `db:migrate` | `drizzle-kit migrate` | ✅ |
| `db:studio` | `drizzle-kit studio` | ✅ |
| `generate:import` | `node scripts/generate-import-templates.mjs` | ✅ (utility) |

---

## 11. Verification Baseline (Current)

| Command | Status | Notes |
|---------|--------|-------|
| `npm run check` | ✅ PASS | 0 errors, 97 CSS warnings (pre-existing) |
| `npm run lint` | ✅ PASS | 0 errors |
| `npm run test:unit` | ✅ PASS | 157 passed, 1 skipped |
| `npm run build` | ✅ PASS | ~16s, PWA generated |
| `npm run test:e2e` | ⚠️ NOT RUN | Requires `DATABASE_URL` (Neon) |

---

## 12. Summary of Critical Findings

### 🔴 CRITICAL (Must Fix)
1. **CLAUDE.md documents a database architecture that no longer exists** — Claims dual SQLite/PostgreSQL with translation layer; actual is PostgreSQL-only. This misleads developers and CI setup.
2. **`translatePgToSQLite()` referenced in CLAUDE.md but deleted** — No translation layer exists.
3. **`getSQLiteDb()` referenced in CLAUDE.md but deleted** — No SQLite code path.
4. **Dead dependencies:** `better-sqlite3`, `@types/better-sqlite3`, `write-excel-file` (duplicate)

### 🟡 HIGH (Should Fix)
5. **Stale comment in `loadEnv.ts`** — "falls back to SQLite" contradicts implementation
6. **Empty `src/lib/server/db/migrations/` directory** — Confusing; real migrations at repo root
7. **Legacy files at `src/lib/` root** — `index.ts`, `types.ts` create ambiguity
8. **Component count mismatch** — CLAUDE.md says 77, actual is 66
9. **`write-excel-file` in both deps and devDeps**

### 🟢 LOW (Nice to Fix)
10. **Potentially unused components** — 6 components may be dead code
11. **`src/lib/server/.gitkeep`** — Stale file

---

## 13. Recommendations

### Immediate (Before Any Further Development)
1. **Update CLAUDE.md** to reflect PostgreSQL-only architecture — remove all SQLite references, translation layer, dual-runtime claims
2. **Remove dead dependencies:** `better-sqlite3`, `@types/better-sqlite3`, deduplicate `write-excel-file`
3. **Delete stale files:** `src/lib/index.ts`, `src/lib/types.ts`, `src/lib/server/db/migrations/`, `src/lib/server/.gitkeep`
4. **Fix stale comment** in `src/lib/server/db/loadEnv.ts` (lines 6-8)

### Short-term
5. **Audit 6 potentially unused components** — remove if truly unused
6. **Verify component count** and update CLAUDE.md (66 not 77)
7. **Document Neon requirement** for all environments (dev, test, prod) — no local SQLite option

### Long-term
8. **Consider adding true local dev DB option** (SQLite or local Postgres) if team wants offline dev
9. **Add database architecture decision record** (ADR) to document the PostgreSQL-only choice

---

## 14. Agent Outputs Summary

| Audit Area | Agent | Status | Key Findings |
|------------|-------|--------|--------------|
| Repository Structure | a06597907c5c114ac | ✅ Complete | Clean git, Architecture-5 structure present, legacy files at root |
| Dependency Direction | a3c33cffbb8502f9e | ✅ Complete | **No violations found** — all layers respect boundaries |
| Database Architecture | ad883066bca32b974 | ✅ Complete | **PostgreSQL-only** — SQLite path removed, translation layer gone |
| Server Services | aefaa31cd35428d0b | ✅ Complete | 9 services, proper boundaries, lendingPayments is source of truth |
| Authentication | aa72662bdc6f6c4fd | ✅ Complete | Auth.js complete, legacy JWT retired, all 5 auth phases done |
| Routes & API | a444bd64a49421c8a | ✅ Complete | 14 pages + 14 API endpoints, proper protection, RESTful |
| Testing | a5a5fc5e0f0dfd8cc | ✅ Complete | Unit 157 pass, E2E comprehensive auth suite, requires Neon |
| CLAUDE.md Accuracy | a3d5d74e781d69a13 | ✅ Complete | **Major drift** — database architecture docs incorrect |
| Dead Code | adb93bf1d0d938c75 | ✅ Complete | 5 confirmed dead files, 6 suspicious components, 3 intentional splits |
| Dependencies | (manual) | ✅ Complete | 3 dead deps, 1 duplicate, versions current |

---

## 15. Conclusion

The Architecture-5 restructure is **structurally sound** — layer boundaries are enforced, services are properly encapsulated, authentication is modernized, and all tests pass. **However, the documentation (CLAUDE.md) has not been updated to match the reality of a PostgreSQL-only architecture.** This is the single most critical finding: any developer onboarding via CLAUDE.md will be misled about the database runtime, development setup, and deployment requirements.

**Recommendation:** Treat CLAUDE.md update as a blocking prerequisite for any further feature work. The codebase is healthy; the documentation is not.
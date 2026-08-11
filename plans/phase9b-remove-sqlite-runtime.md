# Phase9B — Remove SQLite From Runtime

**Goal:** PostgreSQL becomes the only runtime database. No SQLite code executes at
runtime. Local dev = `LOCAL_DEV_DATABASE_URL` → Neon; prod = `DATABASE_URL` → Neon.
Test infrastructure (in-memory `better-sqlite3`) is **NOT** migrated in this phase.

**Governing user decision (verbatim):** "Full removal + skip the SQLite suites. Do not
delete any test files or test implementations. Do not rewrite the SQLite tests. Only skip
the SQLite-specific describe/test blocks that cannot run after runtime SQLite removal.
Keep the test code and better-sqlite3 dependency intact for Phase9C. Keep all
Drizzle/PostgreSQL tests running normally. Do not skip the entire test suite. Do not make
any unrelated changes such as getMonthlySummary. If you encounter an unrelated behavioral
change, revert it and report it."

---

## CRITICAL CONSTRAINT (discovered during survey) — shapes the whole plan

`npm run check` (svelte-check) type-checks `tests/**/*.ts` AND `src/**/*.ts`
(`.svelte-kit/tsconfig.json` `include`). **`describe.skip` only stops vitest execution —
it does NOT stop type-checking.** Three "removal target" symbols are referenced at the
TYPE level by files I must not touch/rewrite:

| Symbol | Referenced by (cannot edit) | Removable? |
|---|---|---|
| `usePostgres` (index.ts) | `verify-drizzle.neon.test.ts:123` (§8 untouchable); `lendingPayments.test.ts:4` top-level import | **NO — keep export** |
| `translatePgToSQLite` (query.ts) | `query.test.ts:2` top-level import; 13 mock suites via `real.translatePgToSQLite` (cast to `typeof import('$lib/database/query')`) | **NO — keep export** |
| `getSQLiteDb`, `sqliteDb` (index.ts) | tests reference these ONLY inside `vi.doMock(...)` object literals — never as real imports | **YES — fully remove** |

**Resolution — SUPERSEDED. See "DECISION UPDATE" at the bottom of this file.**
The original resolution (keep `usePostgres`/`translatePgToSQLite` as vestigial exports) was
rejected by the user in favor of full force-removal + surgical test edits.

This is a deliberate, forced deviation from the literal wording of §1 ("remove
usePostgres") and §2 ("remove translatePgToSQLite"). Every other removal is done in full.

---

## Edits — runtime files (SQLite execution removed in full)

### 1. `src/lib/database/index.ts` (§1)
- Remove `import type { Database } from 'better-sqlite3'`, `import path`, `import fs`
  (path/fs are used ONLY by the SQLite dir/file creation).
- Remove `let sqliteDb`, the whole `getSQLiteDb()` function, and the SQLite branch of
  `closeDb()` (keep the pgPool close).
- **KEEP** `usePostgres` export (Phase9C test-infra dep — see critical constraint).
- KEEP: `databaseUrl`, `getPgPool()`, `initDb()`, `types.setTypeParser(1700, parseFloat)`.
- Net: `getPgPool` no longer needs to guard against SQLite; `initDb()` stays.

### 2. `src/lib/database/query.ts` (§2)
- Change `import { usePostgres, getPgPool, getSQLiteDb } from './index'`
  → `import { getPgPool } from './index'` (drop `usePostgres`, `getSQLiteDb`).
- In `queryOne`/`queryMany`/`execute`/`withTransaction`: delete the `else` SQLite branch;
  keep ONLY the PG body (unwrap `if (usePostgres) { ...pg... }` to just the pg body).
- Remove `mapParamsForSqlite` (internal, unused after branches go).
- **KEEP** `translatePgToSQLite` + its `TranslatedQuery` type EXPORTED and UNCHANGED
  (Phase9C test-infra dep — 14 suites + query.test.ts type-reference it). It simply
  becomes unused by runtime. Confirm no eslint no-unused error (it's exported → fine).
- Preserve return values, param order, error behavior, transaction semantics exactly.

### 3. Server services (§3) — collapse `if (usePostgres){A}else{B}` → `A` (Drizzle/PG), in:
`transactions.ts`, `categories.ts`, `lendingPayments.ts`, `networth.ts`,
`lendingImport.ts`, `recurringService.ts`, `recurringScheduler.ts`,
`recordLendingTransaction.ts`, `transactionImport.ts`.
- Remove the now-unused `import { usePostgres } from '$lib/database'` from each once its
  last reference is gone.
- Delete the raw-query `*InTx` variants + raw helpers ONLY IF they become unreferenced
  after the SQLite branches go (e.g. `createTransactionInTx`, `recordLendingTransactionInTx`,
  `deleteLinkedTransactionsInTx`, raw `findOrCreateRepaymentCategory`). VERIFY each with a
  usage grep before deleting; if still referenced anywhere (incl. re-exports), keep it.
- **DO NOT** touch business logic, SQL, filters, ordering, response shapes, tx boundaries,
  validation, auth, HTTP behavior. Specifically **do not alter `getMonthlySummary`** or any
  function beyond mechanically removing its SQLite else-branch.
- Keep the Drizzle `*InTxDrizzle` variants (used by scheduler/import).

### 4. `src/lib/database/init.ts` (§4)
- Change import to drop `getSQLiteDb` (keep `usePostgres`? — init only branches on it;
  after removing the SQLite else-branch the `if (usePostgres)` wrapper is unwrapped, so
  `usePostgres` import is dropped here too. index.ts still exports it for tests.)
- Remove `SQLITE_SCHEMA_SQL`, the SQLite else-branch of `initDb()` (schema exec + PRAGMA +
  backfills), and the SQLite else-branch of the boot self-check.
- KEEP `POSTGRES_SCHEMA_SQL`, `DEFAULT_USERS`, `DEFAULT_CATEGORIES`, PG seed + PG
  direction-column migration + repayment-category seed, and the `initDb()` contract.

### 5. `src/lib/auth.ts` (§6)
- Change the JWT-secret guard `process.env['POSTGRES_URL']` → `process.env['DATABASE_URL']`
  and the message text `POSTGRES_URL` → `DATABASE_URL`. No other auth change.

### 6. Delete SQLite-only files (§5)
- `git rm src/lib/database/migrations/001_add_type_to_categories.ts` (imports getSQLiteDb;
  PG path handles the direction/type migration inline in init.ts).
- `scripts/migrate-sqlite-to-neon.ts` — already staged `D` at session start; ensure removed.
- Verify neither is imported anywhere before deleting.

---

## Edits — test files (`.skip` ONLY, zero rewrites/deletions)

Skip ONLY the SQLite-execution describe blocks (they mock `usePostgres:false` and drive
better-sqlite3 through the now-deleted raw runtime path). Keep every Drizzle/PG block
running. `describe(` → `describe.skip(` at these exact top-level lines:

| File | SQLite block line(s) → skip | Keep running |
|---|---|---|
| `src/lib/server/recurringService.test.ts` | 88 | 365 (Drizzle) |
| `tests/unit-test/transactions.test.ts` | 40 | 617 (Drizzle) |
| `tests/unit-test/transactionImport.test.ts` | 37 | 292 |
| `tests/unit-test/deleteLending.test.ts` | 89 | 303 |
| `tests/unit-test/networth.test.ts` | 14 | 167 |
| `tests/unit-test/categories.test.ts` | 51 | 500 |
| `tests/unit-test/updateLending.test.ts` | 90 | 285 |
| `tests/unit-test/recordLendingTransaction.test.ts` | 37 | 264 |
| `tests/unit-test/lendingImport.test.ts` | 53 | 311 |
| `tests/unit-test/recurring.test.ts` | 47 | 325 |
| `tests/unit-test/createLending.test.ts` | 93 | 349 |
| `tests/unit-test/recurringScheduler.test.ts` | 75 | 459 |
| `tests/unit-test/lendingPayments.test.ts` | 50 AND 1000 | 645 (Drizzle) |
| `tests/unit-test/withTransaction.test.ts` | 31 (whole file is SQLite) | — |

**NOT skipped / NOT touched:**
- `src/lib/database/query.test.ts:11` — tests the PURE `translatePgToSQLite` fn, which
  stays exported & unchanged → **keeps passing, do not skip.**
- `verify-drizzle.neon.test.ts` (§8) — already `describe.skipIf(!canRun)`; untouched.
- `loginValidation.test.ts`, `apiLendings.test.ts` — no runtime-SQLite dependence; untouched.

Only the single `describe(`→`describe.skip(` token changes on each listed line. No hook,
body, assertion, import, or mock is edited. better-sqlite3 stays installed so the
collection-time `new Database(':memory:')` in each skipped block's describe-body still
constructs safely (mock setup lives in `beforeAll`, which skip bypasses).

---

## Explicitly NOT done (deferred to Phase9C, reported)
- `better-sqlite3` / `@types/better-sqlite3` NOT uninstalled (tests need them).
- `usePostgres` + `translatePgToSQLite` exports KEPT (type-referenced by untouchable tests).
- SQLite test suites NOT rewritten or deleted — only `.skip`ped.
- `optionalDependencies.better-sqlite3` in package.json left as-is.

## §9 E2E seed
No change needed — `playwright.config.ts` runs `SEED_DEMO=1 scripts/seed-demo.ts` against
Neon via `LOCAL_DEV_DATABASE_URL` (loadEnv skips wiring under SEED_DEMO). Already PG-only.

## Verification (§12) — run after edits, fix failures before reporting
1. `npm run check` — must pass (this is why exports are kept).
2. `npm run lint` — no unused-var errors (exports are exempt; dropped imports removed).
3. `npm run test:unit` — all non-skipped suites green; skipped = the 15 SQLite blocks.
4. `npm run build`.
5. Grep sweep: `better-sqlite3`, `getSQLiteDb`, `usePostgres`, `sqliteDb`,
   `translatePgToSQLite`, `PRAGMA`, `sqlite`/`SQLite`. Classify each survivor:
   **Runtime (should be zero)** / **Test-infra (Phase9C)** / **Historical-doc (leave)**.

## Final (§13–15)
`git status` + `git diff --stat` + `git diff` → confirm only Phase9B files changed.
Then the 15-item report. **NO commit. NO push. STOP after the report.**



---

## DECISION UPDATE (governs execution) — Force-remove exports + surgical test edits

User (verbatim): "Choose Force-remove, edit tests too. However, do not blindly delete
verify-drizzle.neon.test.ts. Keep its PostgreSQL/Neon verification coverage and only
remove obsolete references to usePostgres or SQLite-specific behavior. Delete only
genuinely SQLite-specific test suites/cases. Preserve all useful PostgreSQL, service,
business-logic, and API coverage. Do not change application behavior."

### Runtime removals — now COMPLETE (no vestigial exports):
- `index.ts` — remove `getSQLiteDb`, `sqliteDb`, `usePostgres` **export**, better-sqlite3/
  path/fs imports, SQLite side of closeDb. Keep pgPool, initDb, setTypeParser, databaseUrl.
- `query.ts` — remove `translatePgToSQLite` **export** + `TranslatedQuery` + `mapParamsForSqlite`
  + all SQLite branches + the `usePostgres`/`getSQLiteDb` import. PG-only bodies remain.
- All 9 services — collapse to Drizzle-only, drop `usePostgres` import, drop dead raw *InTx
  variants (verify unreferenced first).
- `init.ts` — remove SQLite schema/seed/PRAGMA/branches + usePostgres/getSQLiteDb imports.
- `auth.ts` — `POSTGRES_URL` → `DATABASE_URL`.
- `git rm` migrations/001 + scripts/migrate-sqlite-to-neon.ts.

### Test edits — SURGICAL (not blind skip, not blind delete):
- `verify-drizzle.neon.test.ts` — KEEP. Its beforeAll reads `indexM.usePostgres` (line 123)
  purely as a safety assertion that DATABASE_URL points at Neon. Replace that check with an
  equivalent that does NOT depend on the removed export (e.g. assert on
  `process.env.DATABASE_URL`/the resolved pool), preserving the guard's intent. All PG/Neon
  business-logic coverage stays. Nothing else changes.
- `query.test.ts` — the ENTIRE file tests only `translatePgToSQLite` (removed). This is a
  genuinely SQLite-specific suite → `git rm` the file (its subject no longer exists).
- The 13 dual-path service suites — DELETE the SQLite `describe(...)` block (the one mocking
  `usePostgres:false` + reimplementing queryOne via `real.translatePgToSQLite`), KEEP the
  Drizzle/PG `describe(...)` block intact. Remove now-obsolete top-level imports the deleted
  block used (e.g. `import Database from 'better-sqlite3'`, `real.translatePgToSQLite` refs)
  ONLY if unused by the surviving block.
- `lendingPayments.test.ts` — delete the two SQLite blocks (`:50` mock-based, `:1000` real
  in-memory), delete top-level `import { usePostgres }`/`import Database`, KEEP the Drizzle
  block (`:645`). Preserve all its PG coverage.
- `withTransaction.test.ts` — entire file drives SQLite production `withTransaction` via
  in-memory db → genuinely SQLite-specific → `git rm`.
- `loginValidation.test.ts`, `apiLendings.test.ts` — untouched (no SQLite dependence).

### Guiding rule for every test edit:
Delete a suite/case ONLY when its subject is the removed SQLite runtime. Never delete a
case that exercises PG/Drizzle, a service's business logic, validation, or an API contract.
When a file mixes both, excise the SQLite block and keep the rest compiling & green.
No application-behavior change anywhere.

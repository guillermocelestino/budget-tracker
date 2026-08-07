# Neon Migration — Phase 2 Implementation Report

**Date:** 2026-08-07
**Branch:** `fix-transactions-filters` (uncommitted Phase 2 changes sit on this branch)
**Predecessor:** `plans/neon-migration-audit.md` (Phase 1 audit)

## Summary

Phase 2 implemented the **database infrastructure migration first** — no ORM rewrite, no query-layer changes, no schema redesign, no Transactions-UI changes. The app still queries through the existing raw-SQL `queryOne` / `queryMany` / `execute` / `withTransaction` abstraction on both SQLite (dev) and Neon PostgreSQL (prod). Drizzle was introduced **only** as the schema/migration tool, and the query layer, SQLite layer, and `POSTGRES_URL` are all preserved.

---

## a) Files changed / created

### Modified (tracked)
| File | Change |
|---|---|
| `src/lib/database/index.ts` | `DATABASE_URL` is now the canonical connection-string env var, falling back to the deprecated `POSTGRES_URL` alias (`??`). `usePostgres` gates on the alias result. Vercel fail-fast message updated. |
| `src/hooks.server.ts` | Startup JWT guard now reads the same `DATABASE_URL ?? POSTGRES_URL` alias. |
| `.env.example` | `DATABASE_URL` documented as CANONICAL; `POSTGRES_URL` marked DEPRECATED alias; `JWT_SECRET` note ("REQUIRED when DATABASE_URL is set"). |
| `package.json` | Added `drizzle-orm` (runtime), `drizzle-kit` (dev), and scripts `db:generate` / `db:migrate` / `db:studio`. |
| `package-lock.json` | Lockfile update for the two new packages. |
| `src/lib/database/init.ts` | Added a boot-vs-migration doc header; in the **PG branch**, replaced the two one-time data backfills (synthetic-payment backfill + lendings status recalc) with a pointer to `drizzle/0001_*.sql`. PG branch now only verifies infrastructure (schema ensure, guarded seeds, `direction` column ensure). SQLite branch unchanged. |

### Created (untracked)
| File | Purpose |
|---|---|
| `drizzle.config.ts` | Drizzle-kit config (postgresql dialect, `snake_case`, `out: ./drizzle`, minimal env loader, no dotenv dep). |
| `src/lib/database/schema.ts` | Drizzle schema mirroring the EXISTING PG schema (6 tables, named constraints matching PG auto-generated names). **Not used at runtime.** |
| `drizzle/0000_sad_freak.sql` | Baseline migration (idempotent — see (d)). |
| `drizzle/0001_same_preak.sql` | One-time data backfills extracted from init.ts. |
| `drizzle/meta/_journal.json`, `0000_snapshot.json`, `0001_snapshot.json` | Drizzle journal + snapshots. |
| `scripts/verify-neon.ts` | Non-destructive Phase 2.2 verification script (rollback-based writes). |
| `plans/neon-migration-audit.md` | Phase 1 audit document (still present). |

**Untouched by design:** `src/lib/database/query.ts` and all 32 DB consumers, the SQLite layer, `better-sqlite3`, the Transactions UI, and Auth.

---

## b) New packages added

| Package | Type | Version |
|---|---|---|
| `drizzle-orm` | runtime dependency | `^0.45.2` |
| `drizzle-kit` | dev dependency | `^0.31.10` |

No other packages were added. `jsonwebtoken`, `bcryptjs`, `better-sqlite3`, `@neondatabase/serverless` are unchanged.

---

## c) Environment changes

- **New canonical var:** `DATABASE_URL` — the Neon/Postgres connection string.
- **Deprecated alias kept:** `POSTGRES_URL` — still honored (`DATABASE_URL ?? POSTGRES_URL`) so existing environments don't break mid-migration.
- **Vercel:** set `DATABASE_URL` in Project Settings → Environment Variables (replacing/alongside `POSTGRES_URL`). `JWT_SECRET` remains required whenever a DB connection string is set.
- **No connection string was printed, hardcoded, or committed.** `.env` does not exist in this environment; `.gitignore` already excludes `.env*` and `data/`.

---

## d) Migration files created

- **`drizzle/0000_sad_freak.sql` — baseline.** Idempotent, non-destructive representation of the existing PG schema:
  - Fresh DB → creates all 6 tables + 13 indexes + FKs + CHECKs + defaults exactly once.
  - Already-populated DB → every statement is `IF NOT EXISTS` / guarded, so applying is a **no-op**; no data touched. Constraint names match PG's auto-generated names so the Drizzle snapshot stays aligned with the live `init.ts`-created schema.
  - Legacy guard for `lendings.direction` (column + CHECK) for DBs created before the column existed.
- **`drizzle/0001_same_preak.sql` — one-time data backfills** extracted from boot-time init.ts: synthetic `lending_payments` for legacy `status='paid'` records (NOT EXISTS-guarded) + lendings status-cache recalc. Runs exactly once via `npm run db:migrate`.

---

## e) Database / schema changes

- **No live schema changes were applied** (no live Neon connection exists in this environment).
- `src/lib/database/schema.ts` faithfully models the existing schema (no redesign/rename; text+CHECK instead of PG enums; FKs `cascade`/`restrict`/`set null` matching init.ts).
- `init.ts` PG branch is now cheaper: boot = connect + verify infrastructure only; the two expensive data backfills moved to migration 0001.
- SQLite dev path behavior unchanged.

---

## f) Tests / checks run + results

| Check | Result |
|---|---|
| `npm run check` (svelte-check) | **PASS** — 0 errors, 97 warnings (all pre-existing CSS/a11y warnings, none from Phase 2). |
| `npm run lint` | **PASS** — fixed 1 unused-import error in my `scripts/verify-neon.ts`. |
| `npm run test:unit` (vitest) | **50 passed / 17 failed — ALL 17 failures are PRE-EXISTING** and unrelated to Phase 2: `src/lib/database/query.test.ts` asserts `translatePgToSQLite()` returns a plain `string`, but the implementation returns `{ sql, paramIndices }`. That file is untouched since the initial commit (`db72897`); `git diff` confirms I changed neither the file nor `query.ts`. The 17 failures are a stale test contract, not a regression from this work. |
| `npm run test:e2e` (Playwright) | **PASS** — 7/7 (login flow against the real app on the SQLite path; exercises the modified `index.ts`/`hooks.server.ts`/`init.ts`). |
| `npm run build` | **PASS** — `✓ built in 4.89s` (adapter-vercel + PWA generateSW). The `better-sqlite3` native-binding warning is the known dev-only SQLite note, pre-existing. |
| `npx drizzle-kit check` | **PASS** — migration journal/snapshot/SQL consistent offline ("Everything's fine"). |
| `npx tsx scripts/verify-neon.ts` | **SKIP (expected)** — no `DATABASE_URL`/`POSTGRES_URL` set; clean exit 0 with instructions. Live Neon checks not executed (see risks). |

---

## g) Compatibility issues discovered

1. **Pre-existing stale unit test** — `query.test.ts` expects `translatePgToSQLite` to return a string; it returns `{ sql, paramIndices }`. This masks real regressions (any of the 17 covered paths could silently break and the suite would still report the same failure). Should be reconciled before Phase 3.
2. **PG type surfacing is EXPECTED to differ from SQLite** (per audit): TIMESTAMPTZ→JS `Date`, NUMERIC→`string` (code already does `parseFloat(String(...))`), BOOLEAN→`boolean`, `COUNT(*)::int`→`number`. Live confirmation is still pending a real connection.
3. **`better-sqlite3` build warning** on Vercel — known, harmless (SQLite is dev-only).

---

## h) Remaining risks

1. **Live Neon verification not executed.** The connection/CRUD/FK/boolean/RETURNING checks in `scripts/verify-neon.ts` have not run against a real database. Residual risk that a check's SQL has a subtle PG-only issue (e.g. `INSERT … RETURNING id` via `queryOne`) that only surfaces with a live connection.
2. **Deploy ordering.** Production must run `npm run db:migrate` **before** the updated `init.ts` ships, or legacy `status='paid'` lendings won't get their synthetic payments until migrate runs. No auto-migrate on boot (by design); the Vercel deploy step must include the migrate command with `DATABASE_URL` set.
3. **No destructive ops performed** — the baseline is a no-op on populated DBs, so nothing has been verified as "applying cleanly to a populated Neon DB" end-to-end yet.
4. **Branch hygiene** — Phase 2 changes are uncommitted on the `fix-transactions-filters` branch (the Transactions UI work). Consider committing or moving the migration work to its own branch before Phase 3.

---

## i) Recommended next phase (Phase 3)

1. **Live verification:** set `DATABASE_URL` in a local env, run `npm run db:migrate` against Neon, then `npx tsx scripts/verify-neon.ts` and confirm all PASS/FAIL output. Report any real incompatibilities (do not assume — the script asserts actual Neon behavior).
2. **Fix the 17 stale unit tests** in `query.test.ts` (update assertions to the `{ sql, paramIndices }` contract) so the suite is green and catches real regressions.
3. **Deploy step:** add `npm run db:migrate` (gated on `DATABASE_URL`) to the Vercel build/release pipeline.
4. **Separate concern:** Drizzle query adoption (replacing `query.ts` consumers) is a **separate pilot** and explicitly out of scope for this migration — decide it on its own, after the live path is proven.
5. Eventually remove the `POSTGRES_URL` alias and retire the inline `init.ts` schema once migrations are the sole schema authority for Neon.

---

## STOP — per Phase 2.8, no further migration work performed after this report.

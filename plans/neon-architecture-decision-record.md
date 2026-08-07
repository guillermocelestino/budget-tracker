# ADR — Database Architecture Decision Record

**Date:** 2026-08-07
**Branch:** `fix-transactions-filters`
**Status:** **Accepted** (Phase 4D, documentation only — no code changed)
**Predecessors:** `plans/neon-migration-audit.md` (Phase 1 audit), `plans/neon-phase2-report.md` (Phase 2 report)

## Decision

**B — Keep the current hybrid architecture.**

1. **Neon PostgreSQL** is the production database.
2. **SQLite** remains the local development database for now.
3. **`query.ts`** remains the primary/general database abstraction while SQLite is supported.
4. **Drizzle** is available as a **selective Postgres/Neon capability** (schema/migrations + targeted query paths).
5. Drizzle adoption is **NOT mandatory**, and there is **no plan for broad ORM conversion** at this time.
6. **`src/lib/server/recurringService.ts`** is the completed proof-of-concept for selective Drizzle adoption.
7. Complex/transaction-heavy modules — specifically **`recurringScheduler.ts`** and **`lendingPayments.ts`** — must **NOT** be migrated without a separate technical review and explicit approval.
8. Do **not** remove `query.ts` while SQLite remains supported.
9. Do **not** remove SQLite based solely on the successful Neon migration.
10. Do **not** begin an Auth.js migration as part of this decision.

## Context

The app historically ran on a single SQLite backend (better-sqlite3, dev + previously prod). A Neon PostgreSQL migration was carried out in phases to support Vercel serverless production. The migration deliberately preserved the existing raw-SQL query layer and SQLite so that production Postgres and local development SQLite coexist behind one abstraction. The open question was whether/how far to adopt an ORM (Drizzle) now that Postgres is live.

## Evidence from Phase 2 — Database infrastructure migration

- Drizzle was introduced **only** as schema/migration tooling (drizzle-kit, `drizzle/` migrations); the runtime access path stayed on the raw query layer.
- `DATABASE_URL` became the canonical connection-string env var; the deprecated `POSTGRES_URL` alias is still honored (`??`).
- `query.ts` (the four-function abstraction: `queryOne` / `queryMany` / `execute` / `withTransaction`) was **preserved unchanged**, along with the SQLite layer and `translatePgToSQLite()`.
- Live Neon verification: **17/17 checks PASS** (rollback-based writes only).
- Baseline migration `0000` is a no-op on a populated DB; data backfills moved to migration `0001`.

## Evidence from Phase 4B — Drizzle query adoption pilot (recurringService.ts)

- Dual dispatch on the module-load const `usePostgres`: **Drizzle on the Neon/Postgres path, raw `queryOne`/`execute` on the SQLite path** (byte-identical to the previous raw behavior).
- Four operations migrated on the Postgres path: category-ownership select, insert, fetch, update. Public service signatures (`RecurringInput`, `RecurringResult`, `createRecurringTransaction`, `updateRecurringTransaction`) unchanged.
- The Drizzle path was **proven to actually execute** via temporary instrumentation against live Neon (create + update succeeded, rows persisted, then cleaned up; zero residual rows).
- Type-coercion realities surfaced and handled at the service boundary: Drizzle types `numeric` as `string` (`String(input.amount)`), `boolean` as `boolean`, `date(mode:'string')` as `YYYY-MM-DD` strings — which actually **fixes** a latent inconsistency where the raw Neon path returns plain `DATE` columns as JS `Date` objects.

## Evidence from Phase 4C — Recurring service test coverage

- 18 new unit tests (`src/lib/server/recurringService.test.ts`) cover **both** dispatch paths without a live Neon connection and without touching the on-disk dev DB: 11 on the SQLite/raw path (real in-memory better-sqlite3 + real `translatePgToSQLite`), 7 on the Drizzle path (recorded fake client).
- All 11 requested behaviors verified identical on both paths: create, update, category ownership, invalid-input handling, `scheduleChanged` behavior, `next_run` recalc on schedule change / preservation on schedule-unchanged change, `active` boolean, amount handling, missing-recurring → not-found, and user-ownership enforcement.
- **No implementation changes were needed** to make the service testable — the DB boundary was already mockable.
- Full verification suite green: `check` 0 errors, `lint` clean, unit **86/86**, e2e **7/7**, `build` ✓, Neon verification **17/17**, no residual test data in Neon.

## Why hybrid was selected

- **Preserved, proven abstraction.** `query.ts` + `translatePgToSQLite()` already serve 32 DB consumers on both backends and are e2e-covered; replacing them wholesale adds risk with no user-facing benefit.
- **The shared-logic risk of a split is now controlled by tests.** Phase 4C proves both dispatch paths behave identically for every business rule in `recurringService` — the primary objection to a hybrid split is mitigated by evidence.
- **Drizzle's value is real but narrow.** It gives typed queries, generated migrations, and a live-proven Postgres path — useful selectively, not universally.
- **Complex/transactional modules are not a good fit.** `recurringScheduler` and `lendingPayments` rely on multi-statement atomic transactions and conditional writes where the raw layer (and its `withTransaction`) is clearer and already correct.
- **Cost discipline.** No maintenance pressure, no team request, and no demonstrated failure in the raw layer justifies a broad rewrite right now.

## Alternatives considered

### A. Broad Drizzle adoption (rejected)
Rewriting all 32 DB consumers to Drizzle. Rejected because: no evidence of a defect in `query.ts`; high regression surface; dual-path maintenance for every service; and transaction-heavy modules would lose the clarity of the current `withTransaction` helpers.

### B. Current hybrid architecture (selected)
`query.ts` remains the primary abstraction while SQLite is supported; Drizzle is an opt-in Postgres capability; `recurringService` is the validated pilot; complex modules stay raw. Selected as above.

### C. Drop SQLite first, then reconsider ORM adoption (rejected)
Remove SQLite (dev only) and then revisit broad ORM adoption. Rejected because: SQLite is a fast, free, zero-infrastructure local backend; dropping it based only on a successful Neon migration is not justified (per decision point 9); and it would force every local developer onto a hosted database with no benefit.

## Consequences / tradeoffs

- **Two code paths per adopted service.** Each Drizzle-adopted service must keep a raw-SQL fallback while SQLite is supported — a real (but now test-covered) maintenance cost.
- **`usePostgres` is captured at module load.** The dispatch is fixed per process; changing the backend requires a restart/deploy, never a runtime switch.
- **Type coercion differs per path.** Services must normalize (e.g. `String(amount)`) because Drizzle types `numeric` as `string` while the raw path returns JS numbers/dates. Handled in `recurringService`; future adoptions must do the same.
- **Vitest mocking quirk.** Alias-path mocks intercept the specifier the code actually imports; `importOriginal`-style factories do not reliably intercept `./index`-style relative imports. Future service tests should follow the pattern established in the Phase 4C suite.
- **Benefit:** ORM migrations are now the schema authority for Neon; selective adoption is low-risk and reusable; the pilot's test harness de-risks any future adoption.

## Conditions that would justify revisiting this decision

- **SQLite is dropped** (e.g. the team mandates cloud-only local dev) — then the dual-path constraint disappears and a broader Drizzle adoption can be reconsidered on its merits.
- **`query.ts` maintenance becomes a demonstrated bottleneck** (e.g. repeated Postgres-dialect bugs, or an abstraction leak that tests stop catching).
- A **specific module is proposed for adoption** and a separate technical review approves it with the same rigor as the `recurringService` pilot (including live-proof + cleanup + tests).
- **Auth.js migration is separately approved and scoped** — that is an independent decision, not part of this record.

## Explicitly out-of-scope

- Broad/conversion of remaining services to Drizzle.
- Migrating `recurringScheduler.ts` or `lendingPayments.ts` (requires separate review + approval).
- Removing `query.ts`.
- Removing SQLite.
- Database schema changes or new migrations.
- Auth.js migration.
- Application behavior, UI, routes, auth, or environment configuration changes.

---
*This ADR is a record of an accepted architectural decision. It introduces no package changes, no database commands, no migrations, and no application code changes.*

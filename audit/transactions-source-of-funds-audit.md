# Transactions — Source of Funds Audit

**READ-ONLY audit.** Determines the safest way to add an optional **Source of Funds** field to the Transactions feature. No code, schema, migration, or behavior was changed to produce this report. Date: 2026-08-11. Branch: `feat/money-map`.

Source of Funds = metadata about *where the money came from* ("Mother's Money" paying a ₱5,000 Farm expense). It must NOT become income, must NOT change totals, and `NULL` must remain a fully valid state.

---

## 1. Executive Summary

**Recommendation: Option 1 — a single nullable `source_of_funds TEXT` column on the `transactions` table.**

- **Minimal and additive.** One nullable `TEXT` column, `DEFAULT NULL`, no backfill, no new table, no FK, no new service. It is pure metadata and, by construction, cannot affect any financial total in this app (Section 8 proves this from the aggregation model).
- **`NULL` stays first-class.** Existing rows stay `NULL`, new rows default to `NULL`, empty input is normalized to `NULL`, and system-generated transactions (recurring, lending) stay `NULL`. Nothing ever auto-assigns "My Money".
- **The data model already favors it.** The schema's precedent for optional free-text metadata is nullable `TEXT` columns (`lendings.notes`, `lendings.due_date`). A `funding_sources` table (Option 2) is over-normalization for a metadata-only feature and adds real migration/import/export/UI cost with no current consumer needing integrity.
- **It does not block a future table.** If a later feature genuinely needs per-source integrity or per-source metadata (rename-in-one-place, color/icon, "this source is a loan"), the free-text column is an upward-compatible seed: a `funding_sources` table can be added and backfilled from existing distinct strings (Section 5, 6).

**Double-counting: none.** Every financial aggregate in the app sums rows from `transactions` only. A Source of Funds value lives *on* the expense row; it never creates a second row, so it can never inflate income, cash balance, net worth, or report totals.

---

## 2. Current Transaction Architecture

The Transactions feature is a strict three-layer stack (per project `CLAUDE.md`):

| Layer | Files | Role |
|---|---|---|
| **Route (UI)** | `src/routes/transactions/+page.svelte`, `+page.server.ts`, `src/routes/transactions/new/+page.svelte`, `src/routes/transactions/[id]/edit/+page.svelte` + `+page.server.ts` | Page load, `?/create` `?/update` `?/delete` `?/import` form actions, list rendering |
| **Client** | `TransactionForm.svelte`, `TransactionList.svelte`, `TransactionSummary.svelte`, `TransactionFilterToolbar.svelte`, `TransactionFilterPanel.svelte`, `SearchFilterPill.svelte`, `ImportWizard.svelte`, `LiveImpactPreview.svelte` | Form, register list (grouped/flat), inline edit, filters, CSV import wizard |
| **Server** | `src/lib/server/services/transactions.ts`, `transactionImport.ts`, `src/lib/server/db/{init,schema}.ts` | Validation, CRUD, aggregation, category ownership checks, atomic import |
| **API (JSON)** | `src/routes/api/transactions/+server.ts`, `src/routes/api/transactions/[id]/+server.ts`, `src/routes/api/transactions/export/+server.ts` | REST CRUD + export |
| **Shared** | `src/lib/shared/utils/importValidation.ts` (CSV mapping/validation/dedup), `src/lib/shared/utils/csv.ts` (CSV serialization), `src/lib/shared/utils/fileImport.ts` (CSV/Excel parse) | Browser *and* server CSV pipeline |
| **Types** | `src/lib/types.ts` (`Transaction`, `TransactionFormData`, `Category`, …) | Shared public shapes |

Financial consumers of transactions elsewhere: dashboard (`getMonthlySummary`, `getRecentTransactions`, `computeNetWorth()`), reports (`getMonthlyReport`, `getCategoryReport`, `getMonthlyTrends`), money-map (`MoneyMap` consumes transaction-derived flows), `/api/search` (`searchTransactions`).

---

## 3. Current Data Model

`transactions` — Postgres DDL in `src/lib/server/db/init.ts`, mirrored 1:1 by Drizzle in `src/lib/server/db/schema.ts`:

```sql
CREATE TABLE IF NOT EXISTS transactions (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount      NUMERIC(12,2) NOT NULL,
  description TEXT NOT NULL,
  date        DATE NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  type        TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- indexes: idx_transactions_user_id, idx_transactions_date (date DESC),
--          idx_transactions_category, idx_transactions_type
```

Public shape — `src/lib/types.ts`:

```ts
interface Transaction {
  id: number; amount: number; description: string; date: string;
  category_id: number; type: 'income' | 'expense';
  created_at: string; updated_at: string;
  category_name?: string; category_color?: string;
}
interface TransactionFormData {
  type: 'income' | 'expense'; amount: number; description: string;
  date: string; category_id: number;
}
```

Server-side input contracts — `src/lib/server/services/transactions.ts`:

```ts
interface CreateTransactionInput { type; amount; description; date; category_id }          // all required
interface UpdateTransactionInput { type?; amount?; description?; date?; category_id? }      // all optional
interface TransactionFilters { type?; category_id?; date_from?; date_to?; search?; ids?; sort?; order? }
```

Key financial invariant: **`amount` is always stored positive; sign comes from `type`.** Every aggregate uses `SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END)` (income) and the equivalent for expense; `getCashBalance()` = Σincome − Σexpense; `computeNetWorth()`'s cash leg = all-time Σincome − Σexpense. Nothing else feeds the math.

---

## 4. Transaction Lifecycle

Full data flow (current, no Source of Funds):

### 4.1 Add (list-page slide-over)
`transactions/+page.svelte` SlideOver → `TransactionForm` (action `?/create`) → hidden inputs `category_id`, `amount`, `description` + visible `type`, `date` post as `FormData` → `+page.server.ts` `create` action reads `type/amount/description/date/category_id`, builds an `errors` object → `fail(400, { errors, values })` → `createTransaction(userId, { type, amount, description, date, category_id })` → service `validateTransactionInput(input, true)` + `verifyCategoryOwnership` → Drizzle `insert` → returns id → action `{ success: true }` → `use:enhance` calls `update()` to reload page data → new row appears.

### 4.2 Add (dedicated route)
`/transactions/new` → same `TransactionForm` with no `transaction` prop (add mode) → same `?/create` flow.

### 4.3 Edit — three independent paths
1. **Full edit route** `/transactions/[id]/edit` → `+page.server.ts` `default` action reads the same five fields → `updateTransaction(userId, id, {…})` → `redirect(303, '/transactions')`.
2. **Slide-over edit** on the list page (action `?/update`) → same `TransactionForm` with `transaction` prop → same five-field FormData → `updateTransaction`.
3. **Inline edit** in `TransactionList.svelte` → `PUT /api/transactions/[id]` with a **partial body**: either `{ id, amount }` or `{ id, category_id, type, description, date, amount }`. The `[id]` route validates *all five fields as required*, but only the supplied keys are passed to `updateTransaction`, and `updateTransaction` (lines 414–430) only writes keys that are `!== undefined` into `updateData`. **This is the pattern Source of Funds must reuse: partial updates must not clobber an existing value.**

### 4.4 REST API
- `POST /api/transactions` — JSON `{ type, amount, description, date, category_id }`, per-field 400s, calls `createTransaction`, returns `getTransaction(userId, newId)` (201).
- `PUT /api/transactions/[id]` — same required fields, calls `updateTransaction`, returns `getTransaction`.
- `DELETE /api/transactions/[id]` → 204.
- `GET /api/transactions` — filters via `listTransactions`.

### 4.5 CSV import
`ImportWizard` (client preview) and `?/import` action (server authoritative) share the pipeline: `parseImportFile` → `autoMap(headers, DEFAULT_IMPORT_FIELDS)` → `buildMappedRows` → `validateAllRows` → `detectDuplicates` (hash `userId|date|amount|description.toLowerCase()|category_name.toLowerCase()`) → one atomic `db.transaction`, per-row category lookup, `createTransactionInTxDrizzle`. Import fields are defined by `DEFAULT_IMPORT_FIELDS` (date, description, amount, type, category_name).

### 4.6 CSV/JSON export
`GET /api/transactions/export` → CSV via `transactionsToCSV` (header `Date,Type,Category,Description,Amount`; amount as `₱N` string) or JSON (`{ transactions, summary, generatedAt }`). CSV source rows pass `{ date, type, category_name?, description, amount }` — an explicit subset, so a new column only appears in the output when added deliberately.

### 4.7 System-generated transactions (no human input)
- `recurringScheduler.ts` — `createTransactionInTxDrizzle` / `createTransaction` on due/`runNow`, from `recurring_transactions` (type, amount, description, date, category_id).
- `recordLendingTransaction.ts` — direct `insert(transactions)` on lending create/repayment lifecycle events (type, amount, description, date, category_id).

Both construct inputs **without** a source; under Option 1 these rows naturally land on `NULL`.

### 4.8 Server-side row mapping
`mapTransactionRow(row: TransactionRowWithCategory)` and both read paths (`listTransactions`, `getTransaction`) **explicitly enumerate columns** (SELECT lists at `transactions.ts:183` and `:219`). Adding a column to the row contract is a deliberate, additive edit at exactly these three sites — the compiler will not silently include it anywhere else.

---

## 5. Source of Funds Modeling Options

### Option 1 — Nullable `TEXT` column on `transactions`

```sql
ALTER TABLE transactions ADD COLUMN source_of_funds TEXT;
-- nullable, no DEFAULT → existing and new rows are NULL
```

```ts
// Drizzle (pg-core)
source_of_funds: text('source_of_funds'),   // optional → nullable
```

### Option 2 — Nullable FK to a new `funding_sources` table

```sql
CREATE TABLE funding_sources (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  UNIQUE (user_id, name)
);
ALTER TABLE transactions ADD COLUMN source_of_funds_id INTEGER
  REFERENCES funding_sources(id) ON DELETE SET NULL;
```

### Option 3 — Other approaches

- **Denormalized into `description`** (e.g. prefix `from: Mother's Money`) — rejected: pollutes the primary field the user searches, sorts, duplicates on, and displays; breaks the `[REFUND]` convention; non-obvious to filter/report. No.
- **`JSONB` metadata column** — over-engineered for one scalar field; weaker than `TEXT` for `WHERE source_of_funds = $1` filtering and for export/import; adds parsing risk. Not recommended now.
- **Hybrid / no column** (Source of Funds only as a report-side category) — rejected: a report-side concept with no stored value cannot round-trip through edit/import/export.

### Comparison matrix

| Dimension | Option 1 (`TEXT` col) | Option 2 (FK table) | Option 3 (JSONB / description) |
|---|---|---|---|
| **Simplicity** | ★★★ one column, no new objects | ★★ new table + FK + source-CRUD service + UI picker | ★ description-prefix (bad) / ★★ JSONB parsing |
| **Normalization** | ★ (denormalized string) | ★★★ (single source of truth per user) | ★★ (JSONB semi-structured) |
| **Extensibility** | ★★ (per-source metadata impossible; rename = row update) | ★★★ (color/icon/type, rename-in-one-place) | ★★★ (arbitrary keys) |
| **Data integrity** | ★★ (typos → fragmentation; no existence check) | ★★★ (FK + per-user UNIQUE) | ★ (no schema) |
| **Reporting** | ★★★ (`GROUP BY source_of_funds` works immediately) | ★★ (join required) | ★ (JSON extraction) |
| **Filtering** | ★★★ (`WHERE source_of_funds = $1`, btree-indexable) | ★★ (join) | ★ (JSON ops) |
| **Historical data** | ★★★ (existing rows stay `NULL`, nothing to do) | ★★★ (same; `ON DELETE SET NULL`) | ★★★ |
| **Import/export** | ★★★ (plain CSV column, empty→NULL) | ★★ (name→id mapping on import, id→name on export) | ★ (JSON escaping in CSV) |
| **PostgreSQL/Drizzle compat** | ★★★ (native `text` in both DDL and Drizzle) | ★★★ (native) | ★★ (`jsonb` native but Drizzle typing is heavier) |
| **Migration complexity** | ★★★ (one `ADD COLUMN`, no data movement) | ★★ (two DDL statements + seed/backfill + cascades to handle) | ★★ |

---

## 6. Recommended Data Model

**Option 1.** Add `source_of_funds TEXT` (nullable, no `DEFAULT` — or `DEFAULT NULL` for explicitness) to the `transactions` table, in three coordinated places:

1. **Live DBs** — one additive Drizzle migration: `ALTER TABLE transactions ADD COLUMN source_of_funds TEXT;` (no data movement, no backfill; `NULL` for every existing row).
2. **Fresh installs** — add the column to the `CREATE TABLE IF NOT EXISTS transactions (...)` block in `src/lib/server/db/init.ts` (keeps `initDb()` and the migration equivalent for new databases).
3. **Drizzle schema** — `source_of_funds: text('source_of_funds')` in `src/lib/server/db/schema.ts` (`transactions` pgTable).

The column is optional at the **type level** everywhere it flows:

- `Transaction` gains `source_of_funds?: string | null` (additive — every existing consumer of `Transaction` keeps compiling, because optional properties are ignorable).
- `TransactionFormData`, `CreateTransactionInput` gain `source_of_funds?: string | null`.
- `UpdateTransactionInput` gains `source_of_funds?: string | null` and follows the existing "only write keys that are `!== undefined`" rule (see 4.3) so a partial update **never clobbers** the current value.

### Upward-compatible path to Option 2 (future)
Because Option 1 stores the *label*, a future `funding_sources` table can be introduced without a data-loss step:

1. `CREATE TABLE funding_sources … (UNIQUE (user_id, name))`.
2. Backfill: `INSERT INTO funding_sources (user_id, name) SELECT DISTINCT user_id, source_of_funds FROM transactions WHERE source_of_funds IS NOT NULL ON CONFLICT DO NOTHING;`
3. Add nullable `source_of_funds_id` FK (`ON DELETE SET NULL`).
4. Either keep `source_of_funds` as a denormalized display copy or drop it after a backfill of the FK.

This is `FUTURE` — see Section 15, Phase 3.

---

## 7. Nullable / NULL Strategy

**MUST HAVE**

1. `source_of_funds` is nullable; `NULL` is the valid "not specified" state. Both the DB column and every input type permit it.
2. **Never auto-assign.** No `My Money` default — not for existing rows, not for new rows, not for system-generated transactions. The only writer is the user explicitly typing a value.
3. **Existing rows stay `NULL`.** No backfill, no guessing, no migration-time assignment (Section 12).
4. **Empty string == `NULL`.** Form/API/import should trim the value and store `NULL` when empty, so "not specified" has exactly one representation. A `''` sentinel would break `WHERE source_of_funds IS NULL` and produce two "empty" states.
5. **Removal clears to `NULL`** (not `''`). Setting the field blank in edit/import deletes the previous value.
6. **Partial updates preserve the existing value.** Because `updateTransaction` only writes provided keys, omitting `source_of_funds` from a body (e.g. the inline-edit `PUT` which sends only `{ id, amount }`) must leave the stored value untouched. `MUST HAVE` — this is the highest-risk footgun (Section 14, R1).
7. **System-generated transactions** (`recurringScheduler.ts`, `recordLendingTransaction.ts`) continue to create rows with `source_of_funds` unset → `NULL`. `MUST HAVE` — they have no human-entered funding origin.

---

## 8. Financial Impact

**MUST HAVE: zero change to income, expenses, balances, cash flow, net worth, reports, dashboard, or categories.**

Proof from the aggregation model:

- All totals are computed by SQL over `transactions` rows only: monthly summaries (`getMonthlySummary`), report tables (`getMonthlyReport`, `getCategoryReport`), trends (`getMonthlyTrends`), category spending (`getCategorySpending`, `getCategoryUsage`), cash balance (`getCashBalance`), net-worth cash leg (`computeNetWorth`), dashboard widgets, and the money-map flows.
- The example is recorded as **one** row: `{ type: 'expense', amount: 5000, category_id: Farm, source_of_funds: 'Mother's Money' }`. Nothing creates a companion `Income: +₱5,000` row. The app has **no mechanism** that would do so today: there is no "funding account" entity, no transfer concept, and no code path that reads a transaction's metadata to synthesize another transaction.
- Because a new column on `transactions` is invisible to the existing aggregate queries, **double-counting is structurally impossible** unless someone later writes a *new* query that joins/aggregates on `source_of_funds` and adds its result to a total. The one rule that must never be implemented: *"source of funds auto-creates an income transaction."* That rule is the **only** realistic double-counting vector, and it is a design decision, not a side effect.

**SHOULD HAVE** (guard, not code): a comment in the transaction service and this audit's Section 14 record the invariant: *Source of Funds is metadata; it must never be summed or mirrored as income.*

**Related but out of scope:** the `[REFUND]` convention (description prefix) already exists and is independent — a refunded expense is a separate record; Source of Funds does not interact with it.

---

## 9. UI/UX Recommendation

### Add / Edit Transaction (`TransactionForm.svelte`)

**MUST HAVE** — an optional single-line text input:

- **Placement:** in the "Context card" region of the form (the card that already groups non-essential contextual inputs), directly below Description and Date, above the Refund toggle. Rationale: it is contextual metadata, not a primary field; it must not sit between the amount and category the user sees first. Keep the form's existing field order otherwise unchanged.
- **Label:** `Source of Funds`.
- **Placeholder:** `e.g. Mother's Money` (communicates the concept and the "where did the money come from" semantics).
- **Behavior:** empty input → `NULL` on submit (Section 7.4). No autocomplete/datalist initially — a free-text field is the minimal UI; a picker belongs to a future source table.
- **Edit:** pre-fill from `transaction.source_of_funds`; clearing the field removes the source. The edit forms (`?/update` action and `/transactions/[id]/edit`) read the field the same way they read the existing five.

**FUTURE** — if Option 2 arrives: replace the input with a combobox over the user's `funding_sources` (create-on-enter), rendered by the same chip-grid pattern `CategoryForm` uses.

### Transaction List (`TransactionList.svelte`)

**SHOULD HAVE** — secondary metadata, not a column:

- The register already has a packed grid: category circle, description + category pill, balance, amount, kebab (grouped view); plus date in flat view. Adding a dedicated column would crowd 480–640px layouts where `.cat-pill` is already hidden.
- Recommend a **small muted chip** (`from: Mother's Money`) shown inline after the category pill on desktop, and in the mobile card's info block. Reuse the muted `--color-text-muted` + 11px style of `.cat-pill`, with a distinct look (e.g. `↳` prefix or `from ` label) so it reads as provenance, not a second category.
- **Do not render anything when `NULL`** (no "Not specified" chip on every row — that is noise across a long register).

**FUTURE** — an optional `Source` column in the flat register view, toggled by the existing `ViewToggle`/column-management pattern.

### Transaction Details

**MUST HAVE** — show the source when set; degrade gracefully when not:

- Details/inline-edit panel (`TransactionList` edit-panel, or the full-edit route): a `Source of Funds: Mother's Money` meta row next to the existing date/type badge.
- When `NULL`: **either omit the row entirely** (recommended, least noise) **or** render `Source of Funds: Not specified` in muted text. Never render a fabricated value. Whichever is chosen, the "omit" branch is the safe default.

**SHOULD HAVE** — the same provenance chip appears in the kebab `RowActionsMenu` subtitle so it is visible without opening the row.

---

## 10. Filtering Recommendation

**MUST HAVE (initial): none.** Source of Funds ships as a capture + display + persistence feature. Filtering is an additive, optional surface; shipping it gated behind the data being collected avoids building a filter over a column that is `NULL` for most rows.

**SHOULD HAVE (next increment):**

- A `Source` segment in the existing filter instruments — `TransactionFilterToolbar.svelte` (desktop dock) and `TransactionFilterPanel.svelte` (mobile sheet), alongside Date/Category/Type. Reuse the shared `FilterFooter` and the `activeFilters` shape (`{ source?: string }`).
- Options list: `SELECT DISTINCT source_of_funds FROM transactions WHERE user_id = $1 AND source_of_funds IS NOT NULL ORDER BY 1` — stable, case-sensitive match on the stored string.
- Wire a `source` key into `TransactionFilters` and `buildTransactionWhere` (`drizzleWhere` + `sqlWhere`), plus `?source=` on `GET /api/transactions`. Btree index on `(user_id, source_of_funds)` only if the source filter gets real usage (optional).

**FUTURE:**

- Source-aware search in `/api/search` (`searchTransactions`) so ⌘K finds a transaction by its source.
- Per-source summary/reporting (`GROUP BY source_of_funds` totals) on the Reports page.
- If Option 2 lands, filtering joins `funding_sources` by FK instead of string equality, and the same UI shows the source list from the table.

---

## 11. Import / Export Impact

### Import (`DEFAULT_IMPORT_FIELDS` + `importTransactionsForUser`)

**SHOULD HAVE** — an optional, non-required import field:

- Add `source_of_funds` to `DEFAULT_IMPORT_FIELDS` with `required: false` and aliases (`source of funds`, `source`, `funded by`, `money from`), so `autoMap` picks it up when present and **ignores it when absent**.
- **Missing value → `NULL`** (backward-compatible: every existing CSV with the current 5 columns imports unchanged).
- **Empty value → `NULL`** (Section 7.4).
- **Invalid value:** none exist — it is free text; validate only that it is a string and trim it. Do not reject a row because of a weird source string.
- Extend `MappedTransaction` with `source_of_funds?: string`; thread it into `createTransactionInTxDrizzle` on the import write path.
- **Duplicate detection hash unchanged** (`userId|date|amount|description|category`). Two identical rows differing only by source are *not* duplicates — the hash is a behavior contract; changing it would alter existing import dedup behavior and is out of scope for this feature.

### Export (`transactionsToCSV`, JSON export)

**SHOULD HAVE** — a new trailing column, backward-compatible:

- CSV header becomes `Date,Type,Category,Description,Amount,Source of Funds` (append, don't reorder). Existing rows emit an empty string for `NULL` (csv-safe; the value itself is csvEscape'd — free text may contain commas).
- JSON export naturally includes `source_of_funds: string | null` once the `Transaction` type carries it (the export returns full transaction objects).
- **Round-trip:** export → import reproduces the value exactly (same free text, same `NULL`), satisfying the "existing CSV files / exported transactions / backward compatibility" cases in the spec.

### File formats / Excel
No `fileImport.ts` change needed — it already coerces all cells to strings, so a source column flows through unchanged.

---

## 12. Historical Data Strategy

**MUST HAVE: all existing transactions remain `source_of_funds = NULL`.**

- The migration adds the column with no `DEFAULT`, so every pre-existing row is `NULL` — no backfill statement, no data movement.
- **No guessing or auto-assignment.** There is no reliable signal in the data (description, category, amount) for a transaction's true funding origin, and fabricating one would corrupt the very property the feature is meant to record faithfully. The constraint in the spec ("Do not recommend guessing") is correct and the audit agrees with it.
- Users can optionally backfill provenance themselves later, one edit at a time, via the edit form. A bulk "assign source" future utility is out of scope.

---

## 13. Testing Impact

**MUST HAVE** — tests that prove the financial invariant (Section 8) and the NULL strategy (Section 7). **Do NOT write these yet** — this audit only identifies them.

Unit tests (Vitest, fake Drizzle client pattern in `tests/unit-test/transactions.test.ts` / `transactionImport.test.ts`):

1. **Create with no source** → stored `NULL`; returned transaction has `source_of_funds === null`.
2. **Create with a source** → stored and returned verbatim (trimmed).
3. **Create with empty/whitespace source** → normalized to `NULL`.
4. **Update source** → value replaced.
5. **Update omitting source (partial body, e.g. inline-edit PUT `{ id, amount }`)** → existing source preserved (guards R1, Section 14).
6. **Clear source (empty string on update)** → `NULL`.
7. **Import with source column** → value persisted; **import without the column** → `NULL`; **import with empty source** → `NULL`.
8. **Export** → header includes `Source of Funds`; `NULL` → empty cell; value with commas survives `csvEscape`.
9. **Financial calculations unchanged** — with the column present and set, `getMonthlySummary`, `getCashBalance`, `getMonthlyReport`, `getCategoryReport` return identical values to the same data with `NULL`. This is the double-counting regression guard.
10. **Filtering** (when implemented): `source` filter returns only matching; `IS NULL`/excluded semantics.

Existing tests require **no** changes for a nullable additive column: they assert behavioral outcomes and recorded insert values by key (`tests/unit-test/transactions.test.ts` captures `inserts` but asserts on the known fields), so adding an optional key is non-breaking — confirm by running `npm run test:unit` after the Phase-1 change.

**SHOULD HAVE** — an API-level test that `POST`/`PUT` accept and return `source_of_funds`.

---

## 14. Risks

**R1 — Partial-update clobber (highest).** The inline-edit `PUT /api/transactions/[id]` sends a partial body. If a future implementation treats the route's "required fields" validation as "always write all fields," updating an amount would silently wipe `source_of_funds`. **Mitigation (MUST):** keep `UpdateTransactionInput.source_of_funds` optional and follow the existing `updateData` pattern (`transactions.ts:414–430`) — only write the key when the body supplies it.

**R2 — Double-counting via a future design.** If someone later models Source of Funds as a funding *account* and auto-creates an offsetting income/transfer row, totals inflate. **Mitigation (MUST):** this audit's Section 8 invariant is recorded; no new aggregate may read `source_of_funds` into a total.

**R3 — Free-text fragmentation.** "Mother's Money" vs "Mothers Money" become two sources, fragmenting future filters/reports. **Mitigation (SHOULD):** trim + preserve the user's casing (don't lowercase — it's a proper noun); optionally normalize whitespace. Full normalization belongs to the Option-2 table migration.

**R4 — Migration vs fresh-install drift.** `init.ts` uses `CREATE TABLE IF NOT EXISTS`, so a live DB only gains the column via the migration, while a fresh DB gains it via `init.ts`. Both must be updated in the same commit or they diverge. **Mitigation (MUST):** update `init.ts` DDL, `schema.ts`, and the migration together (Phase 1).

**R5 — Export/import symmetry.** Adding a CSV column is fine for this app's auto-mapping importer, but an external tool importing old files is unaffected (new column only on new exports). No risk to existing exports.

**R6 — `''` vs `NULL` double-state.** If any layer stores `''` instead of `NULL`, `IS NULL` filters and "not specified" rendering break. **Mitigation (MUST):** normalize empty → `NULL` at the service boundary (single place: `validateTransactionInput` / the create/update mappers).

**R7 — Type-surface ripple.** `Transaction` flows into `App.PageData` unions, dashboard, reports, money-map. Adding an **optional** field is non-breaking by TS design; forcing it required would break ~10 consumers. **Mitigation (MUST):** keep `source_of_funds?: string | null` optional in the public type; only the internal row contract (`TransactionRowWithCategory`) and SELECT/map sites change shape.

---

## 15. Recommended Implementation Plan

### Phase 1 — MUST HAVE (the feature, minimally)
1. **Migration** — `ALTER TABLE transactions ADD COLUMN source_of_funds TEXT;` via `drizzle-kit generate` (or hand-written Drizzle migration), with the `_journal`/snapshot updated.
2. **Schema + DDL** — add `source_of_funds: text('source_of_funds')` to `schema.ts`; add the column to the `init.ts` DDL block.
3. **Types** — `source_of_funds?: string | null` on `Transaction` (types.ts), `TransactionFormData`, `CreateTransactionInput`, `UpdateTransactionInput`.
4. **Service** — add to `TransactionRowWithCategory` + the `listTransactions`/`getTransaction` SELECT lists + `mapTransactionRow`; pass through in `createTransaction`, `createTransactionInTxDrizzle`, `updateTransaction` (write-only-when-provided); normalize `''`→`NULL` in validation. `validateTransactionInput` gains an optional-source branch (trim; no error ever for it).
5. **Form** — optional `Source of Funds` text input + hidden input in `TransactionForm.svelte`; read in the `?/create`, `?/update` actions (`+page.server.ts`) and the `/transactions/[id]/edit` default action.
6. **API** — optional `source_of_funds` in `POST /api/transactions` and `PUT /api/transactions/[id]` (still optional in PUT — R1).
7. **Returned transaction → UI** — the list/details render the provenance chip (Section 9), driven by the mapped field.
8. **Tests** — the Section 13 MUST-HAVE set (financial-invariant + NULL-strategy guards). Run `npm run check`, `npm run lint`, `npm run test:unit`.

### Phase 2 — SHOULD HAVE (immediately after, small increments)
9. **Export** — append `Source of Funds` column in `transactionsToCSV`; confirm JSON export carries the field.
10. **Import** — optional `source_of_funds` field in `DEFAULT_IMPORT_FIELDS` + `MappedTransaction` + import write path (empty → `NULL`); dedup hash unchanged.
11. **Details polish** — "Not specified"/omit handling in the edit-panel and kebab subtitle.

### Phase 3 — FUTURE (gated on real usage)
12. **Filtering** — `source` segment in `TransactionFilterToolbar`/`TransactionFilterPanel`, `source` in `TransactionFilters`/`buildTransactionWhere`, `?source=` on `GET /api/transactions`, optional `(user_id, source_of_funds)` index.
13. **Search** — source-aware `searchTransactions` / ⌘K.
14. **Reporting** — per-source summary on Reports.
15. **Option-2 upgrade** — `funding_sources` table + FK + combobox picker, seeded from existing distinct strings (Section 6 path).

---

## 16. Files That Would Need Modification

| File | Change | Phase |
|---|---|---|
| `src/lib/server/db/schema.ts` | `source_of_funds: text('source_of_funds')` on the `transactions` pgTable | 1 — MUST |
| `src/lib/server/db/init.ts` | column in the `CREATE TABLE IF NOT EXISTS transactions` DDL | 1 — MUST |
| `drizzle/` (new migration + `meta/`) | `ALTER TABLE transactions ADD COLUMN source_of_funds TEXT;` | 1 — MUST |
| `src/lib/types.ts` | `source_of_funds?: string \| null` on `Transaction`, `TransactionFormData` | 1 — MUST |
| `src/lib/server/services/transactions.ts` | `CreateTransactionInput`/`UpdateTransactionInput`; `TransactionRowWithCategory`; SELECT lists; `mapTransactionRow`; create/tx-create/update writes; `validateTransactionInput` (`''`→`NULL`); (future) `TransactionFilters.source` + `buildTransactionWhere` | 1 — MUST (+3 — FUTURE filter) |
| `src/lib/client/components/TransactionForm.svelte` | optional Source of Funds input + hidden input | 1 — MUST |
| `src/routes/transactions/+page.server.ts` | `?/create` `?/update` actions read the new FormData field | 1 — MUST |
| `src/routes/transactions/[id]/edit/+page.server.ts` | `default` action reads the field | 1 — MUST |
| `src/routes/api/transactions/+server.ts` | optional field in POST body + passthrough | 1 — MUST |
| `src/routes/api/transactions/[id]/+server.ts` | optional field in PUT body (never required — R1) | 1 — MUST |
| `src/lib/client/components/TransactionList.svelte` | provenance chip (list/details/kebab subtitle); inline-edit PUT left untouched (partial update) | 1–2 — MUST/SHOULD |
| `src/lib/shared/utils/csv.ts` | append `Source of Funds` header + cell | 2 — SHOULD |
| `src/lib/shared/utils/importValidation.ts` | optional `source_of_funds` in `DEFAULT_IMPORT_FIELDS`, `MappedTransaction`, `buildMappedRows` | 2 — SHOULD |
| `src/lib/server/services/transactionImport.ts` | thread source into `createTransactionInTxDrizzle` on import | 2 — SHOULD |
| `src/routes/api/transactions/export/+server.ts` | confirm JSON includes the field | 2 — SHOULD |
| `src/lib/client/components/TransactionFilterToolbar.svelte` / `TransactionFilterPanel.svelte` | (future) Source segment | 3 — FUTURE |
| `src/lib/server/services/transactions.ts` (search) + `/api/search/+server.ts` | (future) source-aware search | 3 — FUTURE |
| `tests/unit-test/` | Section 13 test set | 1–2 — MUST/SHOULD |

**Not modified (deliberately):** `recurringScheduler.ts`, `recordLendingTransaction.ts` — system-generated transactions stay `NULL` (no human origin). `LiveImpactPreview.svelte`, `ImportWizard.svelte`, `ImportMapping.svelte`, `TransactionSummary.svelte`, `getMonthlySummary`/`getMonthlyReport`/`getCashBalance`/`computeNetWorth` — none read transaction metadata, so none change. `fileImport.ts` — already string-coerces all cells.

---

### Confirmation of scope

- **Nothing was modified** to produce this report (the only artifact is this file).
- No database, migration, schema, code, or UI change was made; no filtering/reporting implemented.
- The recommendation preserves `NULL` as a fully valid state, never auto-assigns `My Money`, and keeps existing transactions `NULL` unless the user explicitly assigns a source.

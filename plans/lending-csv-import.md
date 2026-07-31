# Extend CSV import to the lending / borrowed pages

## Context

`/transactions` has a proven, verified 3-stage client-side import (drop → map → preview → store) with one shared validation module used by client and server. Lending and borrowed get the same capability, reusing that infrastructure via **schema-driven generalization** of the three import components — no forked copies. Direction (`lent` vs `borrowed`) comes from which page the import is opened on; borrower names are free text (no people table), so unknown people are **auto-created** on confirm — the one intentional divergence from transactions.

Recon established (two explore agents): one `lendings` table with `direction` CHECK ('lent'|'borrowed'); `borrower_name TEXT NOT NULL` free text; `amount`, `interest_rate` (default 0), `date_lent` NOT NULL, `due_date` nullable, `status` ('active'|'paid'), `notes` nullable; two routes `/lending` + `/borrowed` each with active/paid tabs; lending loads already return `activeLendings` + `paidLendings` (so existing people + dedup context are derivable client-side, no load change); generic primitives (`parseCSV`, `parseDateFlexible`, `parseAmountFlexible`, `normCategoryName`, SlideOver, toast store) are domain-agnostic; the transactions-coupled pieces are `MappedTransaction`'s 5 fields, `buildMappedRows`, `validateMappedRow`/`validateAllRows`, ImportMapping's hardcoded field options, ImportPreview's 6 hardcoded columns + type chip + `/categories` banner, the dedup key, and inline confetti. Lending/borrowed headers use a local `.btn-add` (violet/coral — off-system); we add a `Button variant="ghost"` "Import CSV" beside it, matching the transactions header convention.

## Phase 2 — settled decisions (implement as given)

1. **Direction** = page context: `/lending` import → `direction='lent'`, `/borrowed` → `'borrowed'`. The mapping stage offers NO direction target.
2. **Person resolution**: resolve names case/trim-insensitively against the user's existing people (= distinct `borrower_name`s in their lendings) via a generalized `normName` (same trim+lowercase semantics as `normCategoryName`). Unknown people are listed in a banner and **auto-created on confirm** (the row stores the free-text name — no separate people table). Unknown person is NOT a row error.
3. **Amount must be > 0** for lending rows (direction from page, not sign — unlike transactions where negatives are legal).
4. **Due date**: optional mapping target; if mapped/present it must parse to a real date. No constraint vs date_lent.
5. **Dedup key**: `(user_id, person_name, date_lent, amount, direction)`. Re-import skips duplicates.
6. **Reuse**: generalize the three import components with a field-definition config (defaults preserve the transactions behavior byte-for-byte); no parallel components.

## Phase 3 — the plan

### A. Shared primitives (additive only; `src/lib/utils/importValidation.ts`)
- Add canonical `export function normName(s: string): string` (trim+lowercase); make `normCategoryName` delegate to it (behavior unchanged).
- Add `export type ImportRow = Record<string, unknown>` — components type rows as this; `MappedTransaction` and the new `MappedLendingRow` are both assignable.
- No other changes to `importValidation.ts` → the transactions validator is untouched.

### B. Sibling validator `src/lib/utils/lendingImport.ts` (shared client+server, like `importValidation.ts`)
Reuses `parseCSV`, `parseDateFlexible`, `parseAmountFlexible`, `normName` from `importValidation.ts` (no server-only deps).
- `MappedLendingRow { person_name, amount, interest_rate, date_lent, due_date, notes }`.
- `buildMappedLendingRows(rawRows, headers, mapping, config)` — date_lent/due_date via `parseDateFlexible` (unparseable kept raw → row error), amount via `parseAmountFlexible` (reject ≤ 0), interest_rate via a small `parseRate` (strip `%`/space, default 0), names/notes trimmed.
- `validateMappedLendingRow(row, existingPeople: string[], config): ValidationResult` — person_name required; amount required and **> 0**; date_lent required + parses; due_date optional + parses if present; interest_rate numeric. Unknown person is NOT an error (auto-create).
- `validateAllLendingRows(rows, existingPeople, config)` → `{ validRows, invalidRows, newPeople: string[] }` (distinct unknown names).
- `generateLendingHash(userId, row, direction)` + `detectLendingDuplicates(userId, rows, existingLendings, direction)` — hash `(user_id | normName(person) | date_lent | amount | direction)`, same skip pattern as transactions.

**Justification (sibling vs extending):** lending's row model and validation differ structurally — free-text person with auto-create (not a category allow-list), `amount > 0`, direction from page context, no income/expense type, different fields. A sibling module reusing the primitives keeps the verified transactions validator and its 12 specs untouched (zero regression risk to the baseline) while sharing all the parsing/normalization/dedup-hash machinery. The two validators stay in one place each, and client/server import the same module (preview and store verdicts can't diverge).

### C. Generalized components (additive props; transactions passes nothing → identical)
New shared types (exported from `importValidation.ts`):
```ts
export interface ImportFieldDef { key: string; label: string; required?: boolean }
export interface ImportPreviewColumn { header: string; key: string; kind: 'status'|'date'|'amount'|'text'|'type'; align?: 'left'|'right' }
export interface ImportValidationResult<T = ImportRow> {
  validRows: T[];
  invalidRows: { row: T; errors: string[]; warnings: string[] }[];
  unknownCategories: string[];
  newNames?: string[];      // lending: people to auto-create (teal banner)
}
```
- **ImportMapping**: add `fields?: ImportFieldDef[]` (default = current 5 transaction fields: date/description/amount/type/category_name, required date+amount) and `showTypeRule?: boolean` (default true). `fieldOptions` + `requiredFields` are derived from `fields`; the type-rule picker renders only when `showTypeRule`. Transactions passes no new props.
- **ImportPreview**: add `columns?: ImportPreviewColumn[]` (default = current 6: Status/Date/Description/Category/Type/Amount), `confirmLabel?: string` (default `"Import {n} Transactions"`), `unknownTitle?`/`unknownHint?`/`unknownHref?: string|null` (default current `/categories` copy), `newNamesTitle?`/`newNamesHint?` (default hidden). Rows typed as `ImportRow[]`; cells render by `kind` (amount → `formatCurrency`, type → existing income/expense chip); error-row `colspan` = `columns.length`; optional teal `newNames` banner (lending) distinct from the coral unknown banner.
- **ImportDropZone**: add `sampleHref?: string`, `sampleFilename?: string` (defaults current `/sample-transactions.csv`).
- **New `src/lib/components/ConfettiBurst.svelte`**: pure extraction of the transactions inline confetti (props `active: boolean`); both pages use it. Verified identical via render.

Every default reproduces today's markup/CSS exactly → **the transactions import is behaviorally identical (regression baseline)**.

### D. Lending + borrowed pages
- **Header** (both pages): wrap the existing `.btn-add` + a new `Button variant="ghost"` "Import CSV" in `div.header-actions` (mirrors transactions). Clicking sets `importSlideOpen = true`.
- **+page.svelte** (both): SlideOver wizard mirroring transactions — `importStep` state (`upload|mapping|preview|done`), `handleFileUpload` (parseCSV + autoMap), mapping via ImportMapping with the lending `fields` + `showTypeRule={false}`, `goToPreview` = `buildMappedLendingRows` + `validateAllLendingRows(built, existingPeople, config)` where `existingPeople` is derived from `data.activeLendings + data.paidLendings`; preview form `action="?/import" use:enhance` with hidden `rows`/`config` + ImportPreview with lending `columns`, `confirmLabel="Import {n} Lendings"`, unknown banner "will be created" (href null), `newNames` teal banner; done step with `ConfettiBurst` + success toast (confetti only when `imported > 0`).
- **+page.server.ts** (both): add `import` action → calls a shared server helper `importLendingsForUser(userId, rows, config, direction)` in new `src/lib/server/lendingImport.ts`: `userId` from `locals.user!.userId` ONLY (never payload), defensive config parse, load `existingPeople` + existing lendings for this user, re-run the SAME `validateMappedLendingRow` (server cannot be lied to), `detectLendingDuplicates`, then parameterized inserts via `query.ts`:
  `INSERT INTO lendings (user_id, borrower_name, amount, interest_rate, date_lent, due_date, notes, direction) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`.
  Returns `{ imported, total, skippedDuplicates, skippedInvalid, newPeople }`. `/lending` passes `'lent'`, `/borrowed` passes `'borrowed'`.

### E. Sample + docs
- `docs/lending-sample.csv` + `static/lending-sample.csv` — header `Person,Amount,Interest Rate,Date Lent,Due Date,Notes`; 8 rows exercising valid / bad date / zero amount / negative amount / unknown person / missing person / bad due date / duplicate pair. DropZone sample props point here.

### F. Specs — `src/lib/utils/lendingImport.spec.ts`
- `normName` cases (trim, case, empty).
- `buildMappedLendingRows` + `validateAllLendingRows`: valid / bad date_lent / zero amount / negative amount / unknown person (VALID + collected in `newPeople`) / missing person / bad due date → expected tally.
- `detectLendingDuplicates`: a duplicate pair (same person/date/amount/direction) → both detected; a same-amount different-person or different-direction pair → not.
- Regression (existing `importValidation.spec.ts` unchanged): transactions sample still **8 valid · 2 invalid**, `unknownCategories = ["Nonexistent Category"]`.

## Files to change vs create

| File | Action | Guarantee |
|---|---|---|
| `src/lib/utils/importValidation.ts` | add `normName`, `ImportRow`, `ImportFieldDef`, `ImportPreviewColumn`, `ImportValidationResult` | additive; transactions untouched |
| `src/lib/utils/lendingImport.ts` | **create** | shared client+server lending validator |
| `src/lib/components/ImportMapping.svelte` | add `fields`/`showTypeRule` | default = current behavior |
| `src/lib/components/ImportPreview.svelte` | add `columns`/`confirmLabel`/banner props | default = current behavior |
| `src/lib/components/ImportDropZone.svelte` | add `sampleHref`/`sampleFilename` | default = current behavior |
| `src/lib/components/ConfettiBurst.svelte` | **create** | pure extraction |
| `src/routes/lending/+page.svelte` | header button + wizard | new |
| `src/routes/lending/+page.server.ts` | add `import` action (direction `'lent'`) | existing actions untouched |
| `src/routes/borrowed/+page.svelte` | header button + wizard | new |
| `src/routes/borrowed/+page.server.ts` | add `import` action (direction `'borrowed'`) | existing actions untouched |
| `src/lib/server/lendingImport.ts` | **create** | shared insert helper (query.ts) |
| `docs/lending-sample.csv` + `static/lending-sample.csv` | **create** | sample template |
| `src/lib/utils/lendingImport.spec.ts` | **create** | specs |

Transactions regression guarantees: `importValidation.ts` only gains additive exports; the three components only gain defaulted props (transactions passes none); transactions page/server untouched.

## Verification

1. **Logic trace (no browser):** run `lendingImport.ts` (bundled) against a synthetic ≥10-row sample → print tally (valid / bad date / zero / negative / unknown person / duplicate pair). Must match expectations; `newPeople` = only the unknown-person name.
2. **Server round-trip (real session):** POST valid rows to `/lending?/import` and `/borrowed?/import`; SELECT back — `borrower_name` stored, unknown person created (row inserted under the user), amount > 0, dates correct, `direction` correct; re-POST skips the duplicate pair. Clean up test rows after (demo/lending restored).
3. **Preview parity:** client `validateAllLendingRows` verdict == server `validateMappedLendingRow` verdict row-for-row on the same sample.
4. **Regression:** transactions sample still prints **8 valid · 2 invalid**, `unknownCategories = ["Nonexistent Category"]` only; `importValidation.spec.ts` 12/12 pass.
5. `npm run check` and `npm run build` clean — report the pre-existing baseline 18 errors separately, don't fix them.
6. **Grep guards on touched files:** `{/*` → 0; `export let|on:click` → 0; hardcoded palette hexes (`#FFF8E7`, `#1A3A37`, `#8b5cf6`-style violet gradient, cream) → 0 in touched files.
7. 🚫 No git writes; leave everything unstaged; end with a change manifest.

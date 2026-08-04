# Reusable Excel + CSV Import for Transactions / Lending / Borrowed

## Context

Three divergent import implementations exist today: an inline CSV wizard in `transactions/+page.svelte` and a CSV-only `LendingImport.svelte` shared by `/lending` and `/borrowed`. All parse **CSV only**. Goal: one reusable wizard used by all three pages that accepts **`.csv` + `.xlsx`**, auto-maps columns, previews with per-row validation, imports valid rows, and refreshes the page. CSV/PDF export is untouched.

## Unified normalized pipeline (core invariant)

**File format is a parsing concern only. Everything after parsing is shared and format-agnostic.**

```
                        ┌─────────────── parseImportFile(file) ───────────────┐
  .xlsx ──► read-excel-file ──► coerce cells to strings ─┐                    │
  .csv  ──► parseCSV (existing util) ─────────────────────┴──► { headers: string[], rows: string[][] }
                                                              │
        (single structure, identical shape for both formats)  │
                                                              ▼
   autoMap(headers, fieldDefs) ──► buildMappedRows(...) ──► validateAllRows(...) ──► detectDuplicates(...) ──► INSERT
        (shared, reused unchanged — NO format branching anywhere downstream)
```

`parseImportFile(file)` (new, `src/lib/utils/fileImport.ts`) is the **only** place that looks at file type. It returns the exact same `{ headers: string[]; rows: string[][] }` shape `parseCSV` already produces, so `autoMap`, `buildMappedRows`, `validateAllRows`, `detectDuplicates` (transactions) and `buildMappedLendingRows`, `validateLendingAllRows`, `detectLendingDuplicates` (lending) — plus the server `?/import` actions — operate on one normalized structure with **zero branching**. The identical pipeline runs client-side for the preview and server-side for the authoritative import (same utility functions, same shapes).

## Guiding principles (from review feedback)

- **Practical, not a framework.** No generic config type-system, no factory files, no `src/lib/import/` directory. One wizard component + one small file-dispatch util. Everything else is reuse.
- **Reuse the existing import utilities as-is.** `parseCSV`, `autoMap`, `buildMappedRows`, `validateAllRows`, `detectDuplicates` (in `src/lib/utils/importValidation.ts`) and `buildMappedLendingRows`, `validateLendingAllRows`, `detectLendingDuplicates`, `importLendingsForUser` (in `src/lib/utils/lendingImport.ts` / `src/lib/server/lendingImport.ts`) — unchanged except lending gains `status`/`recovered_amount`.
- **Full server-side validation.** The server now receives the **file itself**, re-parses it, and re-runs the same build+validate utilities against the DB. Client preview is UX only; the server verdict is authoritative.
- **No huge hidden form inputs.** Send the `File` (multipart) + a tiny `config` JSON — not `JSON.stringify(validRows)` (which grows to MBs at 1k rows).
- **Preserve the import/export architecture.** Same per-route `?/import` actions, same `use:enhance` pattern, same DB helpers. Only the payload changes.

## Decisions

- **Auto-map only** (`upload → preview → done`). No manual mapping step. Headers→fields via `autoMap` aliases. If a required field can't be auto-mapped, show an inline error pointing to the template and stay on upload. Keep a compact inline **Options** row (date format + type rule for transactions) so non-`YYYY-MM-DD`/non-sign files still parse.
- **Centered modal.** Add `size="wide"` to `ModalDialog` (~720px, scrollable body). `default` size byte-identical for all existing usages.
- **Lending/Borrowed `Status` + `Amount Recovered/Repaid`:** schema stores only `status ('active'|'paid')`. `normalizeStatus()` maps `{repaid,recovered,settled,paid,closed,done}`→`'paid'`, `{active,open,pending,outstanding}`→`'active'` (default `'active'`). Validate recovered/paid `0 ≤ x ≤ amount`; `recovered >= amount` → force `status='paid'`; else honor Status/default. `direction` set by the route, never the payload.
- **Single "Import" item** in the overflow menu (tag `CSV / Excel`). Export CSV/PDF intact.
- **xlsx reader: `read-excel-file`** (runtime dep, browser + Node — same code runs client preview and server validation). Read-only, zero runtime deps, no known CVEs. **Avoid SheetJS `xlsx`** (npm 0.18.5 frozen with unpatched CVE-2023-30533).
- **Templates:** pre-generated static `.xlsx` committed to `static/templates/`, produced by a dev-only `scripts/generate-import-templates.mjs` using **`write-excel-file`** (devDependency only). Header + one sample row + date examples. CSV samples (`static/*.csv`) stay untouched and serve as the CSV sample.

## New files (3 — two ship, one dev-only)

| Path | Responsibility |
|---|---|
| `src/lib/utils/fileImport.ts` | `parseImportFile(file) → Promise<{headers, rows}>` — dispatches `.xlsx` (via `read-excel-file` with `getValues: true`, coerces cells → strings: Date→`YYYY-MM-DD`, number→String, bool→'true'/'false', null→'') or `.csv` (reuses `parseCSV`). Same util runs in the browser (preview) and on the server (validation). |
| `src/lib/components/ImportWizard.svelte` | The single wizard, generalized from `LendingImport.svelte` (~60%). Centered `ModalDialog size="wide"`; steps `upload → preview → done`; auto-map; posts the stored `File` + small `config` via `use:enhance` (append `file` to `formData` in the submit callback — no file input needed in the DOM). |
| `scripts/generate-import-templates.mjs` | Dev-only. Writes `static/templates/{transactions,lending,borrowed}.xlsx` (header + sample row). Add `npm run generate:import`. |

No new type files, no adapter layer, no batch-insert helper (keep the existing per-row insert loop — fine at 1k rows; note as a follow-up).

## Modified files

| Path | Change |
|---|---|
| `package.json` | Add `read-excel-file` (dependencies), `write-excel-file` (devDependencies), `generate:import` script. |
| `src/lib/components/ModalDialog.svelte` | Add `size?: 'default'\|'wide'`. Wide: `max-width:720px; max-height:calc(100dvh-32px)` + scrollable `.modal-body`. Focus-trap/ESC unchanged; `default` unchanged. |
| `src/lib/components/ImportDropZone.svelte` | Accept `.csv,.xlsx` (extend drop gate at line 30, input `accept` at line 77, copy). Add `templateHref`/`templateFilename` props → "Download Excel template" link beside the existing CSV sample. |
| `src/lib/components/ImportPreview.svelte` | Add `limit?: number` (default 15) → "…and M more rows". Add a `badge` column `kind` (pill colored by value) for the lending Status column. Existing `DEFAULT_COLUMNS` untouched. |
| `src/lib/components/OverflowMenu.svelte` | Collapse "Import CSV" + inert "Import Excel (Soon)" into one **"Import"** item tagged `CSV / Excel`, wired to `onImportCsv` (keep prop name). Export CSV/PDF untouched. |
| `src/lib/utils/lendingImport.ts` | Extend `MappedLendingRow` with `status` + `recovered_amount`; add those field defs (aliases cover "amount recovered"/"amount repaid" for both directions); `normalizeStatus` + recovery derivation in `buildMappedLendingRows`; status + recovered-range errors in `validateMappedLendingRow`/`validateLendingAllRows`. Dedup key unchanged. |
| `src/lib/server/lendingImport.ts` | `importLendingsForUser(userId, file, config, direction)` — now takes the `File`, calls `parseImportFile` + `autoMap` + `buildMappedLendingRows` + `validateLendingAllRows` (reuse), then dedup + insert with `status`. |
| `src/routes/lending/+page.server.ts`, `src/routes/borrowed/+page.server.ts` | `?/import` reads `file` + `config` from `formData()`, delegates to `importLendingsForUser(userId, file, config, 'lent'\|'borrowed')`. |
| `src/routes/transactions/+page.server.ts` | `?/import` reads `file` + `config`; `parseImportFile` → `autoMap` → `buildMappedRows` → `validateAllRows` (reuse existing `userCategories` fetch + `detectDuplicates`); insert valid rows; return `{ success, imported, total, skippedDuplicates, skippedInvalid, details? }`. |
| `src/routes/transactions/+page.svelte` | Delete inline import state/handlers (lines ~187-289) and the `<SlideOver>` import markup (lines ~671-782). Mount `<ImportWizard>`; wire both `OverflowMenu` instances + EmptyState secondary action. |
| `src/routes/lending/+page.svelte`, `src/routes/borrowed/+page.svelte` | Replace `<LendingImport>` with `<ImportWizard>` (lending field defs/build/validate + `direction`). Keep the two `OverflowMenu` instances. |

## Validation flow (shared, run client + server)

1. `parseImportFile(file)` → `{headers, rows}` (xlsx or csv).
2. `headers.length < 2` → error (needs header + ≥1 data row).
3. `autoMap(headers, fieldDefs)`; **required guard** — every `required` field must be mapped, else inline error "Could not auto-map required column(s): <labels>. Download the template.", stay on upload.
4. `buildRows` → `validateRows(rows, deps)`; transactions requires categories loaded (existing guard). → `step='preview'`.

**Import:** form posts `file` (appended to `formData` in the enhance submit callback) + `config` JSON to `?/import`. Server **re-parses the file and re-validates from scratch** (authoritative), dedups against existing DB rows, inserts valid rows, returns counts + per-row `details`. `handleEnhance`: `await update()` (preserves URL filters/search/pagination), toast successes, `step='done'` (Confetti + "Imported X of Y · skipped N dupes · skipped M invalid" + expandable details + `newPeople` note), else inline error.

## State management

Wizard-owned `$state` (`ImportWizard.svelte`): `step`, `file`, `fileName`, `headers`, `rawRows`, `mapping`, `options`, `mappedRows`, `validation`, `result`, `error`, `isParsing`, `isSubmitting`. Reset on open/"Import Another File". Route-owned: one `importWizardOpen: $state(false)` + domain props (`fields`, `columns`, `buildRows`, `validateRows`, labels, links, `direction`) + `deps` from `$page.data` (transactions `categories`, lending `existingPeople`). Wizard stays in `{#if open}` so closing unmounts/resets.

## Edges & risks

- **`.xlsx` date cells** arrive as `Date`; `toISOString().slice(0,10)` is fine for date columns.
- **1k rows:** preview capped at `limit` (15); the *file* upload is compact; server validates once. Per-row insert loop retained (adequate at this scale) — batching is a noted follow-up, not part of this change.
- **Optional recovered cell unparseable** → treated as absent (never fails a row over a stray optional char); `≥ amount → paid` applies when parseable.
- **Unused after swap:** `ImportMapping.svelte` and `LendingImport.svelte` become dead — leave in place (harmless) unless a cleanup pass is wanted.
- **Don't modify** `static/sample-transactions.csv` / `docs/sample-transactions.csv` (consumed by existing specs/export tests).
- **A11y:** dropzone stays `role="button"` + `tabindex=0`; file picker via labeled trigger; ModalDialog focus-trap/auto-focus/ESC preserved; wide modal scrolls internally.

## Verification

1. `npm run check` (svelte-check) clean.
2. `npm run test:unit` — new `src/lib/utils/fileImport.spec.ts` (csv + xlsx → `{headers,rows}`; round-trip a generated `static/templates/*.xlsx` through parse→autoMap→build→validate, all rows valid); extend `src/lib/utils/lendingImport.spec.ts` (`normalizeStatus`, `recovered ≥ amount → 'paid'`, recovered-range errors); `importValidation.spec.ts` untouched.
3. `npm run dev` manual e2e on all three pages: overflow → Import → drop the CSV/XLSX template → verify 720px scrollable modal, missing-required error, `Import {n} valid` posts the file, done screen with details, page refresh preserves filters/search/pagination, ~1,200-row file imports. Confirm a tampered xlsx row surfaces server-side errors.
4. Confirm CSV/PDF export still works on all three pages.
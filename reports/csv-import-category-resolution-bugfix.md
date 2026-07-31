# CSV import — "Unknown category" resolution fix

**Date:** 2026-07-31 · **Status:** done, unstaged (nothing committed)

## 1. Quoted resolution chain + diagnosis

**Page load** (`src/routes/transactions/+page.server.ts`): returns `categories` from `SELECT * FROM categories WHERE user_id = $1` → `data.categories` is `Category[]` (has `.name`, `.type`, `.id`). Root `+layout.server.ts` returns only `user` (no shadowing). No client-side `+page.ts`; no signup route (only 3 seeded users, all with categories).

**Prop passed (page → validation):** `goToPreview` ([+page.svelte:186](src/routes/transactions/+page.svelte#L186)) calls `validateAllRows(built, data.categories ?? [], importConfig)`. The preview components do **not** re-validate — they render the pre-computed `validation` prop. So the resolution happens in `importValidation.ts`, not a component-prop mismatch.

**Allow-list build + comparison (before):** `validateMappedRow` did `userCategories.find(c => c.name.toLowerCase().trim() === row.category_name.toLowerCase().trim())` — reads `c.name`, normalizes both sides. **Correct** when given real categories.

**Server resolution:** `SELECT id, name, type FROM categories WHERE user_id = $1` (correct user-scope) → same `validateMappedRow`; the name→id step used `LOWER(name) = LOWER($2)` (no TRIM).

**Printed allow-list vs DB list:** I bundled `importValidation.ts` (now dependency-free) and ran the exact client flow (`parseCSV → autoMap → buildMappedRows → validateAllRows`) against demo's real DB categories → **8 valid · 2 invalid**, `unknownCategories = ["Nonexistent Category"]`. Case-insensitive "FOOD & DINING" resolves. So **the comparison logic does NOT reject valid names** when categories are present.

**Which culprit was live — THE TRUE ROOT CAUSE:** when the `import` action was added to `src/routes/transactions/+page.server.ts`, the page's **server `load` function was accidentally dropped** (the file was rewritten to `export const actions = {...}` only). With no `load`, `$page.data` has no `transactions`, `total`, `page`, `totalPages`, **or `categories`** — so `data.categories ?? []` was `[]` → the allow-list was empty → every name read "Unknown category" (the original bug). A faithful repro with the real allow-list resolves 9/10 names, which is why the resolution logic itself looked correct. Once the guard was added, the empty-categories case returned early — but the error was only rendered in the upload/preview steps, so in the mapping step it looked like "nothing happens."

**Fix of the root cause:** restored the `load` function (from HEAD) to `+page.server.ts`, so the page again delivers `categories` (and all list data) to `$page.data`. Also surfaced `importError` in the mapping step so a guard failure is always visible (never a silent no-op).

## 2. The fix (per link + shared normalizer)

- **`normCategoryName(s) = (s ?? '').trim().toLowerCase()`** added to `importValidation.ts` — ONE normalizer shared by client and server so preview and store verdicts can never diverge.
- **Client:** `validateMappedRow` now checks membership against a normalized-name `Set` (built once per batch in `validateAllRows`) reading `c.name`, then finds the object for the type check. `goToPreview` now guards empties: if `data.categories` is empty, it sets a clear `importError` ("No categories loaded — add categories in /categories before importing, or reload the page.") and does not advance to preview with a bogus all-unknown verdict.
- **Server:** name→id SQL strengthened to `LOWER(TRIM(name)) = LOWER(TRIM($2))` (trim on both sides) and the lookup value normalized via the shared `normCategoryName`. `userId` stays `locals.user!.userId`; `category_id` resolved server-side under that user; payload carries names+values only (security line unchanged).
- **Type-mismatch vs unknown:** type check runs only after a name resolves, and its message is distinct (`Category "X" is <type> but transaction type is <row.type>`) — a type mismatch never surfaces as "Unknown category." Confirmed intact.
- **No over-correction:** "Nonexistent Category" remains unknown; no categories were added; `amount > 0` not enforced.

## 3. Per-name MATCH/NO-MATCH table (updated code, demo categories)

```
MATCH    Salary                                    → Salary (income)
MATCH    Food & Dining                             → Food & Dining (expense)
MATCH    Freelance                                 → Freelance (income)
MATCH    Transportation                            → Transportation (expense)
MATCH    Shopping                                  → Shopping (expense)
MATCH    FOOD & DINING                             → Food & Dining (expense)   [case-insensitive]
MATCH    Food & Dining                             → Food & Dining (expense)
NO-MATCH Nonexistent Category                      → (none)                    [negative control]
MATCH    Entertainment                             → Entertainment (expense)
MATCH    Bills & Utilities                         → Bills & Utilities (expense)
```
**9 MATCH · 1 NO-MATCH.** `validateAllRows` on the sample → `validRows=8`, `invalidRows=2`, `unknownCategories=["Nonexistent Category"]`.

## 4. SELECT round-trip evidence (server, real demo session)

Logged in as `demo` (user id 3), POSTed the 8 valid sample rows to `?/import` → stored **8 rows** with correct `category_id` (resolved by name under demo), correct type, `YYYY-MM-DD`, correct amounts (incl. `FOOD & DINING` → Food & Dining):

```
2026-07-01 income  50000  → Salary            | Salary deposit
2026-07-02 expense  2500.5 → Food & Dining    | Groceries at SM Supermarket
2026-07-03 income  15000  → Freelance         | Freelance payment
2026-07-04 expense  1200  → Transportation    | Gas station refill
2026-07-05 expense 8999.99→ Shopping          | Online shopping - electronics
2026-07-06 expense   500  → Food & Dining     | FOOD & DINING refund (case insensitive test)
2026-07-08 expense   549  → Entertainment     | Netflix subscription
2026-07-09 expense  3500  → Bills & Utilities | Electric bill (Meralco)
```

- **Re-POST same 8 rows** → `{ imported: 0, total: 8, skippedDuplicates: 8, skippedInvalid: 0 }` — no doubling.
- **Unknown row POSTed directly** → `400` `Row 1: Unknown category: "Nonexistent Category" (not in your categories)` — the negative control stays unknown.
- **Cleanup:** 8 test rows deleted; demo restored to its 239-transaction baseline.

## 5. Post-fix preview tally (honest)

The sample's **row 7 is a deliberate bad-date row** (`2026-07-32`) — invalid for its **date**, not its category. So the correct preview tally is **8 valid · 2 invalid**: row 7 coral "Invalid date", row 8 coral "Unknown category: Nonexistent Category"; the other 8 rows teal with checks. `unknownCategories` banner lists **only `["Nonexistent Category"]`** — the real seeded categories do **not** appear. Confirm CTA enabled (valid ≥ 1). (The user's "9 valid · 1 invalid" counted category resolution — 9/10 names resolve — but row 7 is not otherwise clean.)

## Follow-up: "Import N Transactions" (btn-confirm) did nothing

**Root cause:** the preview's confirm button in `ImportPreview.svelte` was `type="button"` calling `onConfirm` (which only set `importSubmitting = true`). It lives inside `<form method="POST" action="?/import" use:enhance={handleImportEnhance}>`, so a `type="button"` never submitted the form — `use:enhance` never fired and the action never ran. (My earlier curl round-trips POSTed to `?/import` directly, bypassing the button, so this slipped past verification.)

**Fix:** `btn-confirm` → `type="submit"` in `ImportPreview.svelte`. Clicking now submits the form; `use:enhance` runs the import action and drives the done state + toast + confetti. `disabled={validCount === 0}` still blocks submission when there are no valid rows; `onclick={onConfirm}` still sets the loading flag (no double POST).

**Verified:** exact form payload POST to `?/import` → `{imported:8, total:8, skippedDuplicates:0, skippedInvalid:0}`, 8 rows stored, cleaned up (demo → 239). `npm run check` 0 errors in touched files; greps clean.

## 6. Git + change manifest

🚫 **Nothing committed; working tree dirty; unstaged.**

| File | Change |
|---|---|
| `src/lib/utils/importValidation.ts` | + `normCategoryName`; Set-based allow-list (built once per batch); type-check-after-resolve kept distinct |
| `src/routes/transactions/+page.svelte` | `goToPreview` empty-categories guard (clear error instead of all-unknown) |
| `src/routes/transactions/+page.server.ts` | **restored the dropped `load` function** (page data incl. `categories` flows again) + shared normalizer + `LOWER(TRIM(name)) = LOWER(TRIM($2))` in name→id resolution |
| `src/routes/transactions/+page.svelte` | `importError` also rendered in the mapping step (guard failures are never silent) |
| `src/lib/utils/importValidation.spec.ts` | + `normCategoryName` cases + 9/1 category-resolution cases (12 tests total, all pass) |

## 7. Raw grep output (touched files)

```
rg -n -F '{/*' +page.svelte -g '*.svelte'                       → (0 matches)
rg -n 'export let|on:click' +page.svelte -g '*.svelte'          → (0 matches)
rg -n -i '#FFF8E7|#1A3A37|cream' <touched files>                 → (0 matches)
```

`npm run check` → **0 errors in touched files** (baseline 18 pre-existing elsewhere, untouched). `npm run build` → **✔ done**. `vitest` → **12/12 pass**.

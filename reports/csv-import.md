# CSV Import on /transactions — delivery report

**Date:** 2026-07-31 · **Status:** done, unstaged (nothing committed)

## 1. Git rule + change manifest

🚫 **Nothing committed; working tree dirty; 7 files changed + 4 new, all unstaged.** No `git add/commit/push/stash` was run.

| File | Change |
|---|---|
| `src/lib/utils/importValidation.ts` | **NEW** — shared client+server validation/parse/dedup helpers (single source of truth) |
| `src/lib/utils/importValidation.spec.ts` | **NEW** — 8 vitest tests proving the pipeline against the sample CSV |
| `docs/sample-transactions.csv` | **NEW** — documented sample template (the contract, one click away) |
| `static/sample-transactions.csv` | **NEW** — served copy for the "Download sample CSV" link |
| `src/lib/components/ImportDropZone.svelte` | Reused + upgraded: `.txt` accept, download-sample link, Flip7 teal-bg glow, tactile states |
| `src/lib/components/ImportMapping.svelte` | Reused + upgraded: `config`+`onConfigChange` shape, date-format picker, type-rule picker (sign / column / debit-credit) |
| `src/lib/components/ImportPreview.svelte` | Reused + upgraded: per-row VALID/ERROR status, teal/coral bars, reason list, unknown-categories banner, valid/invalid chips, disabled-until-valid CTA |
| `src/routes/transactions/+page.svelte` | Import CSV button in header, 4-stage wizard in the SlideOver (drop→map→preview→done), confetti success moment |
| `src/routes/transactions/+page.server.ts` | Added `?/import` action — re-validates, resolves category by name, dedups, parameterized inserts |
| `src/routes/transactions/import/+page.server.ts` | **Deleted** — superseded duplicate importer |
| `src/routes/transactions/import/+page.svelte` | **Deleted** — superseded duplicate importer |

## 2. Step-0 audit (schema quotes + reused pieces)

- `TransactionType = 'income' | 'expense'`; `Transaction { id, amount, description, date, category_id, type, created_at, updated_at, category_name?, category_color? }`.
- Categories: `UNIQUE (user_id, name)`, columns `user_id, name, color, icon, type, budget_limit, created_at`.
- Transactions: `amount NUMERIC/REAL NOT NULL`, `date DATE/TEXT NOT NULL`, `category_id FK → categories ON DELETE RESTRICT`, `type CHECK (type IN ('income','expense'))`.

**Existing import pieces:** `ImportDropZone`, `ImportMapping`, `ImportPreview`, plus a full-page wizard at `/transactions/import`. It was broken for this task: rejected `amount <= 0` (dropping refunds), used `Math.abs(row.amount)` (destroying sign), auto-created categories, no dedup, no sample template, no shared validation. The three components + the parameterized insert pattern were **reused in place** — no fork. The standalone page was removed so there is exactly **one** importer (SlideOver on `/transactions`).

## 3. Column contract + sample template

| Field | Status | Accepted input | Stored as |
|---|---|---|---|
| **date** | REQUIRED (or mappable) | `YYYY-MM-DD`, `DD/MM/YYYY`, `MM/DD/YYYY`, `DD-MM-YYYY`, `YYYY/MM/DD`, `DD.MM.YYYY`, `M/D/YYYY`, `YYYYMMDD`, month-name (`Jul 15, 2026`); mapping step has an explicit format picker | normalized `YYYY-MM-DD`; unparseable = row error |
| **amount** | REQUIRED | strips `₱ $ € £ ¥`, `,`, whitespace; accepts leading `-` **and** parenthetical negatives `(1,234.56)` | positive number (2-dp); sign feeds the type rule; **negatives accepted — refunds are legal** |
| **type** | OPTIONAL if derivable | `income`/`expense`, or derived (default: negative→expense, positive→income); alternatives: Type column (`income/credit/+/deposit`→income) or Debit/Credit columns | must match the resolved category's type |
| **description** | OPTIONAL (recommended) | free text, trimmed | capped 500 chars |
| **category** | OPTIONAL (recommended) | a name resolved **case/trim-insensitively to the user's own categories** | `category_id` via `LOWER(name)=LOWER($2)` under `user_id`; unknown → row error, names collected and shown once |
| **anything else** | IGNORED | — | tolerance is the point |

**Sample template** — `docs/sample-transactions.csv` (served at `static/sample-transactions.csv`, downloadable from the drop step):

```
Date,Description,Amount,Type,Category Name
2026-07-01,Salary deposit,50000.00,income,Salary
2026-07-02,Groceries at SM Supermarket,-2500.50,expense,Food & Dining
2026-07-03,Freelance payment,"₱15,000.00",income,Freelance
2026-07-04,Gas station refill,"(1,200.00)",expense,Transportation
2026-07-05,Online shopping - electronics,-8999.99,expense,Shopping
2026-07-06,FOOD & DINING refund (case insensitive test),-500.00,expense,Food & Dining
2026-07-32,Invalid date test,100.00,expense,Food & Dining
2026-07-07,Unknown category test,250.00,expense,Nonexistent Category
2026-07-08,Netflix subscription,-549.00,expense,Entertainment
2026-07-09,Electric bill (Meralco),"(3,500.00)",expense,Bills & Utilities
```

Rows exercise: normal income, normal expense, currency symbol + comma (quoted — standard CSV), parenthetical-negative refund, case-insensitive category, a bad date, and an unknown category, plus two ordinary rows.

## 4. Shared validation helper + dedup strategy

`src/lib/utils/importValidation.ts` is the **single source of truth** — `parseCSV`, `autoMap`, `parseDateFlexible`, `parseAmountFlexible`, `deriveType`, `normalizeAmountForStorage`, `buildMappedRows`, `validateMappedRow`, `validateAllRows`, `generateTransactionHash`, `detectDuplicates`. Client preview and server action call the **same** validation, so the preview never lies about what stores.

**Dedup:** no DB transaction wrapper exists in `query.ts`, so **best-effort row-by-row with per-row reporting** (one bad row can't nuke the batch). Duplicates are detected by a deterministic hash of `(user_id, date, amount, lower(description), lower(category_name))` against the user's existing transactions, **skipped by default**, counted as `skippedDuplicate`. Re-importing the same file does not double the ledger.

## 5. Security confirmation

`userId` comes **only** from `event.locals.user!.userId`. `category_id` is **never read from the payload** — it comes from `SELECT id FROM categories WHERE user_id = $1 AND LOWER(name) = LOWER($2)`. The INSERT uses `[userId, row.amount, row.description.trim(), row.date, cat.id, row.type]`. Grep for any `row.user_id` / `row.category_id` / `data.get('user_id'|'category_id')` across both server files → **zero**. A crafted CSV row cannot smuggle a `user_id` or `category_id`.

## 6. Step-5 round-trip evidence (real server + DB, no browser)

- **8 valid sample rows stored** with correct category by name, type, `YYYY-MM-DD` date, right amount:
  `50000 income Salary · 2500.5 expense Food & Dining · 15000 income Freelance (₱15,000.00→15000) · 1200 expense Transportation ((1,200.00)→1200) · 8999.99 expense Shopping · 500 expense Food & Dining (case-insensitive "FOOD & DINING"→"Food & Dining") · 549 expense Entertainment · 3500 expense Bills & Utilities ((3,500.00)→3500)`
- **Bad rows did NOT store.** Direct POST of the bad-date + unknown-category rows → `400`: `Row 1: Invalid date: "2026-07-32"` and `Row 2: Unknown category: "Nonexistent Category" (not in your categories)`.
- **Re-import skipped all 8 duplicates** (no doubling): same file re-POSTed → `{ imported: 0, total: 8, skippedDuplicates: 8, skippedInvalid: 0 }`, user count unchanged.
- **Unknown-category row** rejected by the server and surfaced in `unknownCategories` client-side.
- **Imported rows appear on `/transactions`**: `GET /api/transactions` (the page load query) returned the imported rows with the pre-existing 5.
- **Security line confirmed by code inspection** (§5).
- Client pipeline independently proven by **8/8 vitest tests** against the actual sample CSV.
- All test rows were **deleted afterward** — the demo account is back to its 5 original transactions.

## 7. Per-stage results

drop → parse → map → preview → store → list → success moment, all confirmed: drop zone + client-side `FileReader` parse (quoted commas/CRLF covered by tests); auto-map detected all 5 sample columns; page HTML renders the **Import CSV** button + SlideOver; `validateAllRows` produced 8 valid / 2 invalid with per-row reasons; server stored 8 with correct categories; list reflects them; **confetti + gold/teal toast fire only when `imported > 0`** (wired to the real result).

## 8. Raw grep output (touched files)

```
rg -n -F '{/*' <4 touched .svelte>      → (0 matches)
rg -n 'export let|on:click' <4 touched .svelte>   → (0 matches)
rg -n -i '#FFF8E7|#1A3A37|cream' <touched files>  → (0 matches)
```

`npm run check` → **0 errors in every touched file**; the 18 remaining errors are all in files never modified (pre-existing baseline: `pdf.ts`, `CashFlowChart`, `MonthlyChart`, `Sparkline`, `init.ts`, `query.ts`, `+layout.svelte`, `api/categories`, `vite.config.ts`). `npm run build` → **✔ done**.

Nothing committed; working tree dirty; 7 files changed + 4 new, all unstaged.

---
name: foamy-honking-platypus
description: Add Borrowed module (liabilities) as a semantic mirror of Lending (assets)
metadata:
  type: project
---

## Context
The user wants a **Borrowed** module that tracks money the user **owes** (payables) using the existing `lendings` table with a new `direction` column. The module must:
- Keep a single `lendings` table, adding a `direction` enum (`'lent' | 'borrowed'`).
- Reuse the existing `LendingForm` component, adding a `direction` prop and UI toggle.
- Provide a new `/borrowed` route that mirrors `/lending` but with liability‑oriented UI (coral accents, expense‑on‑repayment). 
- Ensure all existing consumers of `lendings` explicitly filter by `direction='lent'` so net‑worth calculations stay correct.
- Follow the Flip7 design language, hand‑written CSS, Svelte‑5 runes, and the existing cross‑DB query layer.

## Implementation Plan
### Step 0 – Schema migration (portable, idempotent)
1. **Update `src/lib/database/init.ts`** – modify the `CREATE TABLE IF NOT EXISTS lendings` statement (both Postgres and SQLite branches) to include:
   ```sql
   direction TEXT NOT NULL DEFAULT 'lent'
   ```
   *For Postgres* add a CHECK constraint `CHECK (direction IN ('lent','borrowed'))` (SQLite will ignore the CHECK).
2. **Add migration file** `src/lib/database/migrations/001_add_direction_to_lendings.ts` with raw SQL executed via the generic `execute` helper:
   ```ts
   export async function up() {
     await execute("ALTER TABLE lendings ADD COLUMN direction TEXT NOT NULL DEFAULT 'lent'");
     await execute("UPDATE lendings SET direction = 'lent' WHERE direction IS NULL");
   }
   ```
   The same file works for both Postgres and SQLite because it uses the abstracted `execute` which translates `$` placeholders.
3. **Update `src/lib/types.ts`** – extend the `Lending` interface:
   ```ts
   export interface Lending {
     id: number;
     user_id: number;
     borrower_name: string;
     amount: number;
     interest_rate: number;
     date_lent: string;
     due_date: string | null;
     status: 'active' | 'paid';
     notes: string | null;
     created_at: string;
     updated_at: string;
     direction: 'lent' | 'borrowed';
   }
   ```
4. **Default inserts** – all existing INSERT statements (in API and form actions) stay unchanged; they will receive the default `'lent'`. Where we need a borrowed entry, we will pass `direction: 'borrowed'`.

### Step 1 – Reconcile every existing consumer of `lendings`
| Consumer | Current behavior | Required change (direction awareness) |
|---|---|---|
| `src/routes/api/lendings/+server.ts` (GET) | Returns all rows for a user | Add optional `direction` query param; if provided filter `WHERE direction = $X`. Default: no filter (backwards compatible). |
| `src/routes/api/search/+server.ts` (lendings search) | `WHERE user_id = $1 AND borrower_name ILIKE $2` | Add `AND direction = $3` (param optional). |
| `src/routes/lending/+page.server.ts` | Loads active & paid lendings without direction filter | Pass `direction='lent'` in both queries. |
| `src/lib/components/LendingBalanceHeader.svelte` | Hard‑coded “Lent …” hero | Export `export let direction: 'lent'|'borrowed' = 'lent'`; choose label text and left‑border color (`var(--color-teal)` vs `var(--color-coral)`). |
| `src/lib/components/LendingSummaryCards.svelte` | Same as above | Same prop, swap colors and copy. |
| `src/lib/components/ActiveIouList.svelte` | Renders list assuming lender | Export `direction` prop; use it to pick accent colors (`teal` for lent, `coral` for borrowed) and verb text. |
| `src/lib/components/HeroBalanceWidget.svelte` (lendings hero) | Sums all lendings for net‑worth | Accept `direction` prop and sum only rows with that direction. |
| Dashboard & reports (`src/routes/dashboard/+page.server.ts`, `src/routes/reports/+page.server.ts`) | Aggregate lendings without filter | Add `WHERE direction = 'lent'` to all SUM/COUNT queries. |
| CSV export routes (`src/routes/api/...`) | Export all lendings | Filter by `direction='lent'`. |

### Step 2 – Extend `LendingForm.svelte`
1. Add `export let direction: 'lent'|'borrowed' = 'lent'`.
2. Insert a **direction toggle** UI at the top:
   ```svelte
   <div class="direction-toggle">
     <button class:active={direction==='lent'} on:click={() => direction='lent'}>Lent</button>
     <button class:active={direction==='borrowed'} on:click={() => direction='borrowed'}>Borrowed</button>
   </div>
   ```
   - Style with the design tokens (teal for lent, coral for borrowed).
3. Update all label text to reflect the current direction, e.g. `Lent to` vs `Borrowed from`, `Date lent` vs `Date borrowed`.
4. Add hidden input `<input type="hidden" name="direction" value={direction}>` so the API receives the direction.
5. Adjust the *record repayment as transaction* checkbox:
   - When `direction='lent'` → record **income** (unchanged).
   - When `direction='borrowed'` → record **expense**. Change the checkbox label accordingly (`Record repayment as expense`).
6. Ensure the form still validates required fields.

### Step 3 – Build `/borrowed` route (UI + server)
1. **Server file** `src/routes/borrowed/+page.server.ts` – copy `src/routes/lending/+page.server.ts` but replace queries with `direction='borrowed'` and rename exported data fields as appropriate.
2. **Page component** `src/routes/borrowed/+page.svelte` – reuse existing UI:
   - Import `LendingBalanceHeader` and pass `direction='borrowed'`.
   - Import `LendingSummaryCards` with `direction='borrowed'`.
   - Render `ActiveIouList` with `direction='borrowed'`.
   - Use the same slide‑over `LendingForm` with `direction='borrowed'` when creating/editing.
   - Update copy strings to liability phrasing (e.g., “Total Borrowed”, “Repaid”, “Still Owing”).
   - Apply coral left‑border accent on cards (use CSS variables `--color-coral`).
3. No new API endpoints – the UI will call existing `/api/lendings` endpoints, passing `direction` in the request body.

### Step 4 – Visual & interaction polish (Flip7 design language)
- **Hero (liability)**: create a coral‑tinted hero component (reuse `HeroBalanceWidget` with `direction='borrowed'`). Header text: **“STILL OWING”** in large tabular‑nums, sub‑tiles: **Total Borrowed** (teal bar), **Repaid** (sky bar), **Still Owing** (coral bar). Add insight line: “Paying this off raises your net worth by <amount>”.
- **ActiveIouList**: when `direction='borrowed'` use coral accent bar, keep overdue styling (already coral). Ensure action button “Mark Paid” records an expense.
- **EmptyState**: reuse `EmptyState.svelte` with copy “No debts — that’s the best position to be in 🏆” and CTA “Log a borrowing”.
- **Nav**: add entry in `src/lib/components/Sidebar.svelte`:
  ```svelte
  { href: '/borrowed', label: 'Borrowed', icon: '📥' }
  ```
  Active state uses coral left border (`class:active={...}`).
- **BottomNav**: keep 4 slots; the borrowed page is reachable via the off‑canvas drawer and optionally via a link in the Lending page’s summary.
- **Animations**: reuse existing bounce, hover lifts, and add a subtle coral pulse for overdue rows (already present).

### Step 5 – Verification & testing
1. **Run migrations** – start the dev server; ensure the `direction` column appears and existing rows have `'lent'`.
2. **Type‑check** – `npm run check` – ensure no TS errors from the new `direction` field.
3. **Manual UI tests**:
   - Visit `/lending` – data unchanged, totals unchanged.
   - Visit `/borrowed` – empty state appears, add a borrowing, verify coral styling, totals update, repayment records an expense transaction.
   - Verify that the dashboard and reports still show the same numbers as before (they only sum `direction='lent'`).
4. **Search API** – query `/api/search?q=John&direction=borrowed` and ensure results are filtered correctly.
5. **Run test suite** – `npm run test` (add any new tests as needed).
6. **Markup comment lint** – `grep -R '{/*' -n src/**/*.svelte` → should return `0`.

## Files changed (grouped by step)
- **Step 0**: `src/lib/database/init.ts`, `src/lib/database/migrations/001_add_direction_to_lendings.ts`, `src/lib/types.ts`.
- **Step 1**: `src/routes/api/lendings/+server.ts`, `src/routes/api/search/+server.ts`, `src/routes/lending/+page.server.ts`, `src/routes/dashboard/+page.server.ts`, `src/routes/reports/+page.server.ts` (and any other report files that aggregate lendings).
- **Step 2**: `src/lib/components/LendingForm.svelte`.
- **Step 3**: `src/routes/borrowed/+page.server.ts`, `src/routes/borrowed/+page.svelte`.
- **Step 4**: `src/lib/components/LendingBalanceHeader.svelte`, `src/lib/components/LendingSummaryCards.svelte`, `src/lib/components/ActiveIouList.svelte`, `src/lib/components/HeroBalanceWidget.svelte` (add `direction` prop & color swaps), `src/lib/components/Sidebar.svelte` (new nav entry).
- **Step 5**: No new files, just verification steps.

---

**One‑line note**: `/borrowed` mirrors `/lending` but treats the rows as liabilities (coral UI), and repayment is recorded as an **expense** instead of income.

---

*When you’re ready, I will apply the changes.*
# Standardize Lending & Borrowed actions with Transactions

Consistency refinement — reuse the shared `OverflowMenu` and add a working CSV export
to `/lending` and `/borrowed`. No redesign, no routing changes.

---

## 1. Discovery — current state (verified)

### Import button on Lending & Borrowed (identical on both pages)
`src/routes/lending/+page.svelte` and `src/routes/borrowed/+page.svelte`, in the
`PageHeader` `action` snippet:

```svelte
<div class="header-actions">
  <span class="desktop-only">
    <Button variant="primary" onclick={openAdd}>+ New Lending / New Borrowing</Button>
    <Button variant="ghost" onclick={() => (importSlideOpen = true)} ...>Import</Button>
  </span>
  <span class="mobile-only">
    <MoreMenu items={[{ label: 'Import CSV', icon: 'import', onClick: () => (importSlideOpen = true) }]} />
  </span>
</div>
```
- Desktop: standalone ghost **Import** button next to the primary Add button.
- Mobile: `MoreMenu` (a *different*, older overflow component) with a single Import item.
- Import wizard = `LendingImport` slide-over, opened by `importSlideOpen = true`. **Unchanged.**

### Transactions pattern (the target)
`src/routes/transactions/+page.svelte` uses the shared `OverflowMenu`:
- Desktop: `.header-actions` = `<OverflowMenu/>` then primary Add button → `[ ⋯ ] [ + Add ]`.
- Mobile: `<OverflowMenu/>` lives in the toolbar; Add is a full-width row.
- Props wired: `onImportCsv`, `onExportCsv`, `onExportPdf`.
- Adds `:global(.page-header){ position:relative; z-index:30 }` so the dropdown paints
  above following content (escapes the header's backdrop-filter stacking context).

### Can `OverflowMenu` be reused directly? — YES
`src/lib/components/OverflowMenu.svelte` is already the shared component and is fully
generic via props (`onImportCsv`, `onExportCsv`, `onExportPdf`). It owns all the required
behavior: click-outside, Escape, focus restoration (`buttonEl?.focus()` in `close()`),
`role="menu"`/`menuitem`, `aria-expanded`/`aria-haspopup`, the `overflowIn` animation,
and reduced-motion handling. Import CSV and Export CSV items already exist inside it.
No new overflow component is needed. `MoreMenu` is retired from these two pages.

**One minimal, non-breaking change to the shared component:** wrap the *Export PDF* item
in `{#if onExportPdf}`. Lending/Borrowed have no PDF export path, so without a guard the
item would render as a dead button (calls `onExportPdf?.()` → no-op). Transactions passes
`onExportPdf`, so its menu is unchanged. Import-Excel / Import-Bank / Export-Excel "Soon"
items stay as-is, so all three pages show the same menu structure.

### CSV export reuse
- `transactionsToCSV()` in `src/lib/utils/format.ts` holds the CSV serialization + the
  escaping rules (commas / quotes / newlines). Its `escape` helper is currently private.
- The transactions **route** exports via a server endpoint (`/api/transactions/export`)
  because its filters are URL/server-driven.
- **Lending/Borrowed filtering is client-side** (`showLendings`, derived from the
  active/paid/all `ViewToggle` tab; there is no search or server filter). So the correct
  equivalent of "export the currently visible records" is a **client-side Blob download of
  `showLendings`** — no backend endpoint needed (satisfies "no backend changes unless
  export requires them"). "Sorting" is already baked into `showLendings` order.

To reuse logic and not duplicate it:
- Extract the escaping into an exported `csvEscape()` in `format.ts`; have
  `transactionsToCSV()` use it (behavior identical).
- Add `lendingsToCSV(lendings, direction)` in `format.ts` using the same `csvEscape()` and
  the same `₱{amount.toFixed(2)}` amount convention.

---

## 2. Changes

### A. `src/lib/components/OverflowMenu.svelte`
- Wrap the existing **Export PDF** `<button>` in `{#if onExportPdf}` … `{/if}`.
  (Only change. Transactions unaffected.)

### B. `src/lib/utils/format.ts`
- Export a `csvEscape(val)` helper (extracted verbatim from `transactionsToCSV`).
- Refactor `transactionsToCSV` to call `csvEscape` (no behavior change).
- Add:
  ```ts
  export function lendingsToCSV(
    lendings: Array<{ borrower_name: string; amount: number; interest_rate: number;
      date_lent: string; due_date: string | null; status: string; notes: string | null }>,
    direction: 'lent' | 'borrowed' = 'lent'
  ): string
  ```
  Header: `${direction === 'borrowed' ? 'Lender' : 'Borrower'},Amount,Interest Rate (%),Date,Due Date,Status,Notes`
  Rows use `csvEscape` for every field; amount as `₱{amount.toFixed(2)}`.

### C. `src/routes/lending/+page.svelte`
- Imports: drop `MoreMenu`; add `OverflowMenu`; add `lendingsToCSV` from `$lib/utils/format`.
- Add handler:
  ```ts
  function handleExportCsv() {
    const csv = lendingsToCSV(showLendings, 'lent');
    const filename = `lending-${new Date().toISOString().split('T')[0]}.csv`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }
  ```
- Replace the `action` snippet body with the Transactions hierarchy — overflow first,
  then primary Add (`[ ⋯ ] [ + New Lending ]`):
  ```svelte
  <div class="header-actions">
    <span class="desktop-only">
      <OverflowMenu onImportCsv={() => (importSlideOpen = true)} onExportCsv={handleExportCsv} />
      <Button variant="primary" onclick={openAdd}>+ New Lending</Button>
    </span>
    <span class="mobile-only">
      <OverflowMenu onImportCsv={() => (importSlideOpen = true)} onExportCsv={handleExportCsv} />
    </span>
  </div>
  ```
- Add the dropdown stacking fix in `<style>`:
  `:global(.page-header){ position: relative; z-index: 30; }`

### D. `src/routes/borrowed/+page.svelte`
- Same as C, with: `lendingsToCSV(showLendings, 'borrowed')`,
  filename `borrowed-${date}.csv`, and Add label `+ New Borrowing`.

Import wizard (`LendingImport`), server files, routing, and all other page structure:
**untouched**.

---

## 3. Resulting hierarchy (all three registry pages)
- **Primary:** Add Record (label differs per page).
- **Secondary:** shared `OverflowMenu` (⋯).
- **Overflow contents:** Import CSV + Export CSV (+ shared "Soon" items; PDF only where wired).
- Only per-page differences: Add-button label and the exported dataset. ✔

## 4. Verification checklist
- Import CSV still opens the `LendingImport` wizard on both pages (desktop + mobile).
- Export CSV downloads `lending-YYYY-MM-DD.csv` / `borrowed-YYYY-MM-DD.csv` containing
  exactly the visible `showLendings` rows for the active tab.
- Desktop shows `[ ⋯ ] [ + Add ]`; mobile shows `⋯` in the header — matching Transactions.
- Click-outside, Escape, and focus-return all work (inherited from `OverflowMenu`).
- `npm run check` / build passes (no unused `MoreMenu` import).

# Plan: Lending Toolbar — Unify with Transactions Search|Filter Pattern

> **Type:** UI architecture & consistency refactor. **No logic changes** (search, status filtering, grid/list, business rules all preserved).
> **Goal:** Lending reuses the Transactions Search+Filter pill (merged search input + Filter button), status filtering moves into a filter panel (popover on desktop / bottom sheet on mobile), Grid/Table stays far right.
> **Constraint:** Reuse components, don't duplicate UI. Desktop AND mobile must match the Transactions interaction.

## Design: extract the merged pill as a shared component

The Transactions toolbar currently implements the `[ 🔍 … | Filter ]` pill **inline** in `transactions/+page.svelte`. To make Lending "another instance of the Transactions toolbar" without duplicating UI, we extract that pill (markup + interaction + CSS) into a reusable component and use it on **both** pages.

```
Transactions (reference)                      Lending (target)
[ 🔍 … | Filter ]        [ Grouped|Flat ]     [ 🔍 … | Filter ]   [ Grid | Table ]
  └─ toolbar-left ─┘      └─ right ─┘           └─ ListToolbar.filters ─┘ └ views ─┘
```

## Components

### 1. NEW `src/lib/components/SearchFilterPill.svelte` — the reusable pill
Owns the whole Search+Filter interaction so both pages stop hand-rolling it:

- **Search input** — `value` (`$bindable`), `placeholder`, `ariaLabel`. Debounce stays **page-owned** (Transactions already debounces; Lending gains a 250ms debounce — same as LendingSearch today).
- **Filter trigger** — funnel icon + "Filter" label + active-count badge, separated from the input by the existing hairline divider.
- **`open` (`$bindable`)** — the Filter button toggles it.
- **`isMobile`** — internal `matchMedia('(max-width: 768px)')` (same as Transactions).
- **Desktop popover** — `.filters-popover` containing `{@render panel('popover')}`; focus-first on open, closes on outside-click / Escape, focus returns to the Filter button (the exact Transactions `$effect`).
- **Mobile bottom sheet** — renders the generalized `<FiltersSheet>` containing `{@render panel('sheet')}`.
- **`panel` snippet** with params `(mode, close)` so pages pass their filter content once.
- CSS moved verbatim from the Transactions page: `.search-filter-pill` (was `.toolbar-search`), divider, `.search-filter-btn`, badge, `.filters-popover`, focus ring, active state.

### 2. MODIFY `src/lib/components/FiltersSheet.svelte` — generalize to children
- Replace the hardcoded `<TransactionFilters …/>` in `.filters-body` with `{@render children()}`.
- Drop the `categories` / `activeFilters` / `onFilterChange` props (moved to page/pill). Make `open` `$bindable`.
- Shell (backdrop, handle, header, close, scroll-lock, Escape) unchanged.

### 3. NEW `src/lib/components/LendingFilters.svelte` — the Lending filter panel
The single future-proof home for Lending filters (mirrors `TransactionFilters` sheet look, tokens from Flip7):

- **Status section**: `All / Active / Paid` radio-style options (with counts), active-dot indicator — reuse the same `.popover-option` / `.popover-section` / `.popover-dot` visual language.
- **Footer** (both containers): `Reset Filters` (→ status `active`, the current default) / `Apply Filters` (→ close), matching TransactionFilters' `sheet-footer`.
- Extendable: future filters (Interest Rate, Due Date, Overdue Only, Has Notes, Sort By) are additional sections — the toolbar never grows.

### 4. MODIFY `src/routes/lending/+page.svelte` — use the pill + panel
- `filters` snippet: replace `<LendingSearch>` + status `<ViewToggle>` with `<SearchFilterPill bind:value={searchInput} bind:open={filtersOpen} activeFilterCount={…}>` + `panel` snippet → `<LendingFilters status={activeTab} onStatusChange={s => activeTab = s} …>`.
- `views` snippet: Grid/Table `<ViewToggle>` unchanged (far right).
- Add `filtersOpen` state. Add a 250ms debounce `searchInput → searchTerm` and point `showLendings` at `searchTerm` (behavior identical to LendingSearch's current debounce).
- Badge rule: `activeFilterCount = activeTab !== 'active' ? 1 : 0` (Active is the default view; only a change from default lights the badge).
- Delete the now-unused `LendingSearch.svelte` import.

### 5. MODIFY `src/routes/borrowed/+page.svelte` — same refactor
Borrowed is a mirror of Lending (same ListToolbar, same status toggle, labels "Repaid"/"Borrowing…"). Applying the same change keeps the two pages consistent, per the existing "borrowed matches lending" convention. *(Flagging this — happy to skip if you want Lending-only.)*

### 6. MODIFY `src/routes/transactions/+page.svelte` — adopt the shared pill
Replace the inline pill markup + popover `$effect` + `isMobile`/`popoverEl`/`filterBtnEl` state + bottom `<FiltersSheet>` with `<SearchFilterPill bind:value={searchInput} bind:open={filtersOpen} {activeFilterCount} …>` whose `panel` snippet renders `<TransactionFilters mode="sheet" …/>`. All Transactions state/logic (URL sync, debounce, `dateRangeFromFilter`, filters) untouched. **This is the true-DRY move** — it makes Lending literally a second instance of the same component and removes the duplicated CSS.

## Explicitly NOT changed
- Search behavior (borrower/lender/notes), debounce timing, status filtering, Grid/List logic, summary hero, mobile nav, header (Export ⋯ + New Lending stays put).
- `ListToolbar` left/right split + the desktop hairline divider from the previous polish.

## Sizing / responsiveness
- Pill root is width-neutral (`flex: 1 1 auto; max-width: 100%`); each host sizes it:
  - Lending/Borrowed: `.toolbar-filters :global(.search-filter-pill) { max-width: clamp(360px, 30vw, 420px) }` (keeps the earlier desktop cap); full-width on ≤767px (replaces the old `.lending-search` mobile rule).
  - Transactions: constrained by its existing grid column (~one summary-card width), unchanged.
- Pill-internal mobile rules (icon-only Filter button ≤768px) live in the pill.

## Verification
- [ ] `npm run check` + `npm run build` clean.
- [ ] Transactions: toolbar renders/looks byte-identical to today; popover, sheet, badge, focus behavior unchanged; filter/search behavior identical.
- [ ] Lending desktop: unified pill; Filter → popover with Status All/Active/Paid (+ counts); badge on status change from default; Grid/Table far right with divider; search debounce identical.
- [ ] Lending mobile: pill full-width, Filter opens the bottom sheet with the Status panel.
- [ ] No new buttons, Export not moved, no logic changes.

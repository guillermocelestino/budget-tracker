# Transactions Page Redesign — Implementation Plan (v2)

> **Status:** Ready to implement.
> **Note:** Replaces the earlier design-proposal version of this file, whose features (filter pills + popovers, interactive cards, empty states) have already shipped.

## Context

The Transactions page is the app's busiest surface but reads as a generic CRUD table rather than a premium fintech experience. This redesign restructures layout and hierarchy while preserving the Flip7 design language (teal/coral/gold palette, rounded cards, soft shadows, Nunito Sans + Fredoka) to match Monarch/Copilot/YNAB/Stripe/Linear quality.

**Locked decisions (from user feedback):**
1. **"+ Add Transaction" stays a direct primary button** — single action → `/transactions/new`. No dropdown; no friction on the primary workflow.
2. **All secondary actions move into one ⋯ overflow menu** — Import CSV / Import Excel *(coming soon)* / Import Bank Statement *(coming soon)* / divider / Export CSV / Export Excel *(coming soon)* / Export PDF. Header/toolbar carry only **+ Add Transaction** and **⋯**.
3. **Server-side search** in the toolbar, debounced (~300ms), matching description + category name. Backend changes are purely additive.
4. **Richer rows** using *existing data only* — category icon, description, category pill, per-row date, amount, income/expense color. Merchant / payment account / tags are **not** in the data model → flagged as future work (no schema changes).
5. **KPI cards ~84–88px** tall (denser than the 96px proposal), equal widths, compact trends.
6. **Premium empty state** — icon, title, description, primary Add Transaction, secondary Import CSV.
7. **Subtle motion** — ~200ms ease-out for menus, sheets, filter/state changes, hover, list interactions.
8. **Responsive preserved** — desktop 3 cards + full table; tablet 2+1 cards; mobile single column + bottom-sheet filters + card rows + overflow row actions.
9. **Preserve architecture** — additive changes only; no rewrites of working routes/server logic/components.

## Target layout (desktop)

```
Transactions
August 2026 • 13 Transactions
──────────────────────────────────────────────────────────────
🔍 Search Transactions...   [Date ▾][Category ▾][Type ▾]     [Grouped|Flat] [+ Add] [⋯]
──────────────────────────────────────────────────────────────
Income │ Expenses │ Net Balance          (3 equal KPI cards)
──────────────────────────────────────────────────────────────
Transaction list + pagination
```

The `PageHeader` carries only the title + subline (no action buttons); every control lives in the toolbar row.

## Step 1 — Header: title + subline only

**Modified: `src/routes/transactions/+page.svelte`**
- Remove the `header-actions` buttons (desktop Add/Import and mobile `MoreMenu`) from the `PageHeader` `action` snippet.
- Subline = month label + total filtered count: replace `contextSubline` to use `totalCount = data.total` (filtered COUNT across pages, already returned by the loader) and a month label derived from the active date filter — long month + year via `Intl.DateTimeFormat` (reuse `dateRangeFromFilter`; `"From …"` when the filter spans multiple months; current month when `this-month`/unset). Use `getCurrentMonth()` from `$lib/utils/format`.
- Feed `ExportDropdown`'s count → but ExportDropdown is being removed (Step 2); the count surfaces in the subline instead.

## Step 2 — Toolbar: search + filters + actions

**New: `src/lib/components/OverflowMenu.svelte`** — the ⋯ menu (Import + Export).
- Trigger: icon-only ⋯ button, 44×44px ghost pill, `aria-haspopup="menu"`/`aria-expanded`. Reuse the deferred `setTimeout(...,0)` click-outside + Escape pattern from `MoreMenu.svelte`/`ExportDropdown.svelte`.
- Items (`role="menuitem"`, `min-height: 48px`, hover = `--color-teal-bg`): **Import CSV** → opens the existing SlideOver wizard; **Import Excel** / **Import Bank Statement** → `showInfo('… is coming soon')`; divider; **Export CSV** → existing `window.location.href` CSV flow; **Export Excel** → `showInfo('Export Excel is coming soon')`; **Export PDF** → existing PDF flow (`fetch json` + `generateTransactionPdf`).
- Left as a thin wrapper so `MoreMenu.svelte` (still used by Lending/Borrowed) and `ExportDropdown.svelte` stay untouched.

**New search field** (in `+page.svelte` toolbar):
- `let searchInput = $state($page.url.searchParams.get('search') ?? '')` bound to an `<input type="search" placeholder="Search transactions…">` with a search icon.
- Debounce: `$effect` with a 300ms `setTimeout` writing `searchInput → filters.search` only after idle; `filters.search` flows through the existing URL-sync `$effect` → `goto('/transactions?search=…')` → server load. Clear timeout on change/recleanup.
- On mobile the field is full-width and sits above the Filters/⋯ row.

**Modified backend (additive `search` param, three files):**
- `src/routes/transactions/+page.server.ts` — read `search`; append to the dynamic WHERE: `AND (t.description ILIKE $n OR c.name ILIKE $n)` with param `%term%` (category join already present). Add to the COUNT query too.
- `src/routes/api/transactions/+server.ts` — same, in the GET filter build.
- `src/routes/api/transactions/export/+server.ts` — same, so CSV respects the active search.
- `ILIKE → LIKE` conversion is already handled by `translatePgToSQLite()` in `src/lib/database/query.ts`.

**Modified: `src/routes/transactions/+page.svelte` toolbar:**
- Left group: search field + `TransactionFilters` (existing chips/popovers, unchanged behavior).
- Right group: `ViewToggle` (Grouped|Flat) + `<Button variant="primary" href="/transactions/new">+ Add Transaction</Button>` + `<OverflowMenu onImportCsv onExportCsv onExportPdf onComingSoon />`.
- `.txn-toolbar` uses `flex-wrap: wrap`; on tablet (769–1024px) the controls wrap naturally (search+filters may wrap to a second row) — per requirement 9.
- Remove `MoreMenu` and `ExportDropdown` usage from this page (component files untouched).

## Step 3 — Mobile layout

**Modified: `src/routes/transactions/+page.svelte`** (`@media (max-width: 768px)`):
1. Header: title + subline; below it a **full-width** `<Button variant="primary" href="/transactions/new">+ Add Transaction</Button>`.
2. Full-width search field.
3. Control row: **[Filters ▾]** (ghost button, funnel icon, coral count badge `{activeFilterCount}` = number of active filter chips) · **[Grouped|Flat]** · **[⋯]** (same `OverflowMenu`).
4. **Filters ▾** opens `FiltersSheet` (below).
5. Summary cards stack `1fr`. Transaction list renders card rows (existing ≤480px styles) + row ⋮ overflow menu (Step 5). Swipe-to-delete remains.

**New: `src/lib/components/FiltersSheet.svelte`** — dedicated bottom sheet (not `SlideOver`, which is a right drawer at 641–768px): fixed backdrop + bottom panel (`max-height: 78vh`, rounded top, gold drag handle), body scroll lock (copy `SlideOver`'s `$effect`), Escape/backdrop close, focus first focusable (`tick()` pattern from `ModalDialog`), `z-index: calc(var(--z-modal)+1)`.

**Modified: `src/lib/components/TransactionFilters.svelte`** — add `mode: 'popover' | 'sheet' = 'popover'` and `onApply?: () => void`:
- Desktop popover path stays byte-identical (guard the click-outside `$effect` with `if (mode !== 'popover') return`).
- Sheet mode: vertical accordion — "Date"/"Category"/"Type" section buttons toggling the existing `activePopover`, reusing existing panels + `dateLabel/categoryLabel/typeLabel` deriveds. Footer: **Reset Filters** (`clearFilters()`, `Button` ghost) + **Apply Filters** (`onApply?.()`, `Button` primary), 48px, 2-col grid, dashed top border.
- All mutations stay funneled through `handleFilterChange` → the existing URL `$effect`. "Apply" only closes the sheet.

## Step 4 — Summary KPI cards (~84–88px)

**Modified: `src/lib/components/TransactionSummary.svelte`**
- Target `min-height: 84–88px` (was 96px in v1, 120px today) while keeping readable `font-size` (value ~20px, label xs uppercase). Reduce card `padding` to `var(--space-sm) var(--space-md)`; icon 36px; trend chip compact (`{icon}{abs}%`, `padding: 1px 8px`, `font-size: 10px`, `margin-top: 2px`).
- `.summary-cards { grid-template-columns: repeat(3, 1fr); gap: var(--space-md); margin-bottom: var(--space-2xl); }`; tablet `@media (min-width:769px) and (max-width:1024px) { repeat(2, 1fr); .card.hero-card { grid-column: 1 / -1; } }`; ≤768px `1fr`.
- State transitions 200ms ease-out (Step 7).
- Preserve `flip7-card`, accent bars, active (gold)/dimmed states, `aria-pressed`, click-to-filter.

**Modified: `src/routes/transactions/+page.svelte`** — pass all filtered rows, **reversed** (`allForBalance` is ASC; the trend heuristic needs newest-first):
```svelte
<TransactionSummary transactions={[...(data.allForBalance ?? [])].reverse()} {activeType} onCardClick={handleCardClick} />
```

## Step 5 — Transaction rows + overflow actions

**Modified: `src/lib/components/TransactionList.svelte`** (additive props only; dashboard also uses this component, so defaults must not change):
- New prop `onDuplicate?: (id: number) => void`.
- New optional `emptyState` snippet prop — when provided, render it instead of the internal empty state (powers Step 6).
- **Sticky flat-view column header**: `.flat-header` row (Description / Date / Balance / Amount / ✓) as first child of `.flat-register`, `position: sticky; top: 0; z-index: 2`, hidden ≤640px.
- **Per-row date** (flat view): add a muted `formatDateShort` date column so rows carry date independent of group headers.
- Comfortable rows: `min-height` 52→56px, `padding: var(--space-sm) var(--space-lg)`; selected/editing state gains `box-shadow: inset 0 0 0 2px var(--color-teal)`.
- **Duplicate** in desktop `.hover-actions` (third icon button; `e.stopPropagation()`).
- **Mobile row ⋮ menu**: `.row-menu-btn` (44px) shown ≤640px; `menuTxn` `$state`; `stopPropagation` so it doesn't toggle inline edit. Swipe-to-delete and tap-to-open inline edit remain.

**New: `src/lib/components/RowActionsMenu.svelte`** — compact bottom sheet (same chrome as `FiltersSheet`): header = description + signed amount (income teal / expense coral, mono), then **Edit** / **Duplicate** / **Delete** (coral), each 48px, `role="menu"`.

**Modified: `src/routes/transactions/+page.svelte`** — `handleDuplicate(id)`: find source in `allForBalance`/`transactions`, `POST /api/transactions` with `{type, amount, description, date, category_id}`, `showSuccess('Transaction duplicated')`, `goto` current URL (`keepFocus, noScroll`) to re-run load without reload; `showError` on failure. Pass `onDuplicate={handleDuplicate}` and the `emptyState` snippet to `TransactionList`.

## Step 6 — Premium empty state

**Modified: `src/lib/components/EmptyState.svelte`** — add additive prop `onSecondaryAction?: () => void` (renders a `Button` ghost when set; existing `secondaryHref` path unchanged).

**In `+page.svelte`**, pass an `emptyState` snippet to `TransactionList` when `data.total === 0`:
- **No transactions at all** (no filters active): 💰 icon, **"No transactions yet"**, "Start by adding your first transaction or importing a CSV.", primary **Add Transaction** (`href="/transactions/new"`), secondary **Import CSV** (`onSecondaryAction` → opens the wizard).
- **No results** (filters/search active): 🔍 icon, **"No results"**, "No transactions match your search or filters.", single **Clear All Filters** action.

## Step 7 — Motion spec (~200ms ease-out)

Adopt a consistent motion vocabulary (use `var(--ease)` = `cubic-bezier(0.22,0.61,0.36,1)`, ~200ms) across new/changed surfaces; existing global `prefers-reduced-motion` handling stays:

| Interaction | Timing | Behavior |
|---|---|---|
| Dropdown / overflow menus (`OverflowMenu`, filter popovers) | 200ms ease-out | scale 0.96→1 + fade, origin at trigger |
| Bottom sheets (`FiltersSheet`, `RowActionsMenu`) | 220ms ease-out | translateY(24px)→0 + fade |
| Filter changes (URL-driven list refresh) | 180ms ease-out | list opacity/translate fade (only when data changes) |
| Summary card active/dimmed + hover | 200ms ease-out | color/scale/border transitions |
| Row hover + selected/editing state | 180ms ease-out | background + inset ring |
| Empty state appearance | 220ms ease-out | fade-in-up |
- Reuse existing keyframes where available (`popIn`, `dropIn`, `slideUp`-style) and `--transition-fast/normal`; no new animation library.

## Step 8 — Consolidation + 8-point spacing

- Replace the page's local `.btn-primary/.btn-secondary/.btn-next/.btn-back/.btn-danger` styles with shared `Button.svelte` (delete modal, import wizard next/back, done screen); add `.modal-actions :global(.btn) { flex: 1 }`; delete unused local button blocks.
- 8-point section rhythm (no global token changes): `:global(.page-header) { margin-bottom: var(--space-2xl) }` (Header→toolbar), `.txn-toolbar { margin-bottom: var(--space-2xl) }` (toolbar→cards), summary margin (Step 4), `.pagination { margin-top: var(--space-xl) }`.

## Risks

1. **URL filter `$effect` stays the single writer** — search debounce writes `filters.search`; Reset flows through `clearFilters`→`onFilterChange`; Apply only closes the sheet. Keep the anti-loop guard (only `goto` when serialized query differs).
2. **Click-outside menus** (`OverflowMenu`, `RowActionsMenu`) must defer listener attach with `setTimeout(...,0)` or the opening click self-closes.
3. **Trend inversion** — reverse `allForBalance` before `TransactionSummary`.
4. **Search param in three files** (loader, API GET, export) — must stay in sync; add to both COUNT and SELECT WHERE.
5. **`TransactionList` is shared with Dashboard** — all new props/snippets must default to existing behavior.
6. **Sticky flat header** under the mobile sticky `PageHeader` (z-2 vs z-10) — expected/consistent with date headers.
7. **Preserve** the pre-existing quirk: clicking Net Balance sets `type=net` (server ignores it) — don't "fix" it here.
8. **`ExportDropdown`/`MoreMenu` become unused on this page** — leave the component files untouched (MoreMenu used by Lending/Borrowed).

## Implementation order

Header + subline → toolbar (search + filters + Add + OverflowMenu) → backend `search` param → mobile (FiltersSheet + filters sheet mode) → TransactionSummary density + allForBalance → TransactionList (flat header, date, editing state, duplicate, ⋮ menu) + RowActionsMenu → EmptyState + premium empty → consolidation + spacing → verify.

## Verification (`npm run dev`)

1. **Desktop**: header = title + "August 2026 · N transactions" only. Toolbar: search field, Date/Category/Type chips, Grouped|Flat, gold **+ Add Transaction** → `/transactions/new`, ⋯ menu (Import CSV→wizard, Import Excel/Bank→coming-soon toast, Export CSV/PDF work, Export Excel→coming-soon toast). Search with debounce (type fast, ~300ms later the URL gains `search=` and list filters by description *and* category name); CSV export respects the search. Summary cards 3 equal, ~84–88px, totals match the full filtered set (test: filter to one category). Flat view sticky header + per-row dates; hover reveals Edit/Duplicate/Delete; duplicate inserts + toast, no reload. Empty states: no-data (Add + Import CSV) vs no-results (Clear Filters).
2. **Tablet 769–1024**: summary 2+1; toolbar controls wrap to a second row; search still works.
3. **Mobile <768**: full-width Add button; full-width search; [Filters ▾][Grouped|Flat][⋯] row; Filters opens bottom sheet (accordions + Reset/Apply); stacked cards; card rows with ⋮ (Edit/Duplicate/Delete) + swipe-to-delete; 44px+ targets; Escape/backdrop close sheets/menus.
4. **A11y**: Tab order, focus trap/restore, teal `:focus-visible`, correct `aria-*` (`aria-expanded`/`aria-haspopup`/`aria-pressed`, search role), reduced-motion clean.
5. **Regression**: filter→URL sync (back button), delete modal, CSV wizard end-to-end, pagination, dark mode, Dashboard's `TransactionList` unaffected.

## Files touched

| File | Action |
|------|--------|
| `src/routes/transactions/+page.svelte` | Major — header, toolbar (search/add/overflow), filters sheet, summary wiring, duplicate, empty state, spacing, button consolidation |
| `src/routes/transactions/+page.server.ts` | Additive — `search` param in WHERE (COUNT + SELECT) |
| `src/routes/api/transactions/+server.ts` | Additive — `search` param in GET filters |
| `src/routes/api/transactions/export/+server.ts` | Additive — `search` param |
| `src/lib/components/OverflowMenu.svelte` | **New** — ⋯ Import/Export menu |
| `src/lib/components/FiltersSheet.svelte` | **New** — mobile filter bottom sheet |
| `src/lib/components/RowActionsMenu.svelte` | **New** — mobile row Edit/Duplicate/Delete |
| `src/lib/components/TransactionFilters.svelte` | Add `mode="sheet"` + `onApply` |
| `src/lib/components/TransactionSummary.svelte` | Density (~84–88px), tablet 2+1, motion |
| `src/lib/components/TransactionList.svelte` | Sticky flat header, per-row date, rows, editing state, duplicate, ⋮ menu, `emptyState` snippet |
| `src/lib/components/EmptyState.svelte` | Additive `onSecondaryAction` |

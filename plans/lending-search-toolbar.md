# Plan: Lending Page — Dedicated Search Toolbar

## Context
The Lending page (`/lending`) needs a Search feature. The current `.toolbar` (lines 138–160 of
`src/routes/lending/+page.svelte`) is a bare `flex` div holding two `ViewToggle`s:
All/Active/Paid on the left, Grid/Table density on the right. There is no room for a search field
that *grows* without pushing the toggles around, and no scalable shell for the filters that will
follow (date, interest, sort, export, bulk).

## Design decision (UX)
Introduce a **dedicated `ListToolbar` band** between the summary hero and the list. Search is
**anchored left** (the most-used affordance gets the flexible, growing slot). The existing status
`ViewToggle` moves into the toolbar's left (filter) zone; the Grid/Table density `ViewToggle` moves
into the right (view) zone. The summary hero (`LendingBalanceHeader`) is **invariant** — it never
reflects search results, only total ledger truth.

Placement rejected:
- Beside page title → disconnects search from the list it controls; can't host sibling filters.
- Inside summary hero → hero is global truth; search narrows the view (corrupts headline number).
- Below table → filters are read before scanning; fights pagination.
- Inside `<thead>` → breaks in card view; can't host future filters without bloating header.
- Above the View Toggle → wastes a row; implies search outweighs status filter when they're peers.
- Beside the Grid/List toggle → puts search next to the lowest-stakes control, muddying
  filter-left / view-right partition.

## Two-zone architecture (future-proof, no redesign)
```
ListToolbar
├── slot "filters"  (flex: 1 1 auto, min-width: 0, wraps)  ← grows rightward
│    ├── Search                (anchor — never moves)
│    ├── Status segmented      (today's All/Active/Paid)
│    ├── [Filters] pill popover (date, interest)   ← future
│    └── [Sort] menu                               ← future
└── slot "views"   (flex: 0 0 auto, fixed)               ← stable cluster
     ├── Grid/Table density (today)
     ├── [Export]                                   ← future
     └── bulk action bar (overlay when rows selected) ← future
```
Partition and anchor are fixed → every future feature is an **additive** slot drop, not a layout
change. Search never moves. Bulk mode is an overlay strip, never a replacement of the toolbar.

## Responsive contract
- Desktop (≥1024): single row, search grows (`flex: 1`), controls fixed right.
- Small laptop (768–1023): search shrinks (`min-width: 0`), toggles keep natural width.
- Tablet (≤767): `filters` slot children stack — search full-width on its own row, then status row,
  density right-aligned.
- Mobile (≤480): single column, ≥44px touch targets, density icon-only, status counts trimmed.
- One breakpoint family; new filter pills inherit the same wrap — no per-feature media queries.

## Files (3)

### 1. NEW `src/lib/components/ListToolbar.svelte` (~70 lines)
Pure layout shell — no opinion about what controls it holds.
- Two named slots: `{#snippet filters()}` (left) and `{#snippet views()}` (right).
- Props: `sticky?: boolean`, `padded?: boolean`.
- Chrome: `background: var(--color-surface)`, `border: 1px solid var(--color-border)`,
  `border-radius: var(--radius-lg)`, `box-shadow: var(--shadow-sm)`; gap `var(--space-sm)`.
- `.toolbar-filters { flex: 1 1 auto; min-width: 0; display: flex; gap; flex-wrap: wrap; }`
- `.toolbar-views   { flex: 0 0 auto; display: flex; gap; }`
- `@media (max-width: 767px)`: `filters` children stack vertically (search 100% width first).

### 2. NEW `src/lib/components/LendingSearch.svelte` (~40 lines)
- Search `input` with leading 🔍 icon, placeholder, debounced output.
- Props: `value: string; placeholder?: string; onSearch: (v: string) => void`.
- Debounce via the `$effect` + `setTimeout` idiom already proven on `/transactions`
  ([transactions/+page.svelte:66-77](src/routes/transactions/+page.svelte#L66-L77)).
- Esc clears; `aria-label="Search lendings"`; `min-height: 44px`.
- Styled with project CSS custom properties (`--color-border`, `--radius-md`, focus ring
  `--color-primary` + `0 0 0 3px var(--color-primary-light)`) — matches CLAUDE.md form rules.

### 3. EDIT `src/routes/lending/+page.svelte` (small, surgical)
- Import `ListToolbar`, `LendingSearch`.
- Add state: `let searchInput = $state('');`
- Replace the bare `<div class="toolbar">…</div>` (lines 138–160) with:
  ```svelte
  <ListToolbar>
    {#snippet filters()}
      <LendingSearch
        value={searchInput}
        onSearch={(v) => (searchInput = v)}
        placeholder="Search borrower, lender, notes…"
      />
      <ViewToggle options={statusOptions} value={activeTab}
        onSelect={(v) => (activeTab = v as 'all'|'active'|'paid')}
        ariaLabel="Lending status filter" />
    {/snippet}
    {#snippet views()}
      <ViewToggle options={densityOptions} value={viewMode}
        onSelect={(v) => (viewMode = v as 'card'|'table')}
        iconOnly ariaLabel="Lending list view" />
    {/snippet}
  </ListToolbar>
  ```
- Client-side filter: derive `showLendings` from the tab-selected list, narrowed by `searchInput`
  against `borrower_name` + `notes` (`toLowerCase().includes`). Correct because lending lists are
  small and fully loaded in `load()` — no server round-trip or URL change needed for v1.
- Remove the now-unused `.toolbar` CSS rules (lines 268–275) — chrome moves into `ListToolbar`.

## Out of scope (future zones — slot-ready, not added now)
Date/interest filter pills, sort menu, export button, bulk action overlay. The `ListToolbar`
two-zone contract is built so each is a one-line slot drop later.

## Verification
1. Existing two `ViewToggle`s render identically — no layout regression.
2. Typing in search filters `showLendings` live across both card and table views.
3. "No matching lendings" empty state surfaces in `ActiveIouList`.
4. **Hero numbers stay invariant under search** (key correctness check — hero is not filtered).
5. Responsive at 1024 / 768 / 480 matches the wireframes; 44px touch targets preserved.
6. Dark mode: search input + toolbar chrome use `var(--color-surface)` / `--color-border` only.

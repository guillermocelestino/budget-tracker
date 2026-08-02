# Plan: Transactions Page — Unified Search + Filter Toolbar (UX Refinement)

## Context

The Transactions page toolbar ([transactions/+page.svelte:437-484](src/routes/transactions/+page.svelte#L437-L484)) currently shows a search field plus **three inline filter pills** (Date / Category / Type) on desktop, and a separate mobile-only "Filters" button that opens a bottom sheet. This is visually crowded, does not scale as new filters are added (amount, tags, account, etc.), and splits filtering across two different entry points.

This change is a **UX refinement only** — it consolidates every filter behind a single **Filter** button (popover on desktop, existing bottom sheet on mobile) while leaving all filtering *behavior* identical. The **Grouped/Flat** toggle stays separate because it is a view mode, not a filter.

**Locked decisions** (confirmed with user):
- Category stays **single-select** (zero behavior change).
- Date presets **expand** to add **Today** and **This Year** (purely additive; existing presets unchanged).
- Type = Income/Expense only — **Transfer is not supported** by the schema, so it is not added.
- No new Popover/Dropdown/Menu/Sheet component: none exists today, and CLAUDE.md prefers inline over extraction. All filter logic is reused from the existing `TransactionFilters` component.

## Current toolbar analysis

```
Desktop:
[ 🔍 Search............ ] [ Date ▾ ] [ Category ▾ ] [ Type ▾ ]      [ Grouped | Flat ]
  └────────── .toolbar-left ──────────┘                            └── .toolbar-right ──┘

Mobile (≤768px):
[ 🔍 Search..................... ]          ← full width
[ Filters ☰ ]  [ Grouped | Flat ]  [ ⋯ ]   ← toolbar-right row
```

Problems: 3 competing dropdown pills crowd the desktop toolbar; each new filter adds another pill; mobile/desktop filtering use different entry points; the filter count badge lives only on the mobile button.

## Why Search + Filter is superior

1. **One primary control, one secondary control.** Search is the high-frequency action and stays the flexible, always-visible anchor. A single **Filter** button with an active-count badge is one glanceable affordance instead of N.
2. **Scales without redesign.** New filters (amount, account, tags, notes, recurring, payment method, created by) become new rows *inside* the filter panel — the toolbar layout is frozen. Reusing `TransactionFilters mode="sheet"` means a future filter is one added pill there; it appears in both popover and sheet for free.
3. **Presentation vs. filtering separation.** Grouped/Flat stays right-aligned and outside the filter control, so its semantics (view mode) stay visually distinct from filtering.
4. **Reuses existing logic.** `TransactionFilters` already owns Date/Category/Type/custom-range/reset. No duplication, no drift.
5. **Accessible by construction.** One dialog entry point means one `aria-expanded`/`aria-controls` pair, one Escape path, one focus-restore target — easier to keep correct than three independent popovers.

## ASCII wireframe

```
Desktop / Tablet (>768px):
[ 🔍 Search transactions..................... ] [ ⚙ Filter ☰ ]      [ Grouped | Flat ]
└──────────────── .toolbar-left ─────────────────┘                └── .toolbar-right ──┘
        search grows first · filter fixed width

Mobile (≤768px):
[ 🔍 Search transactions............... ]     ← search full width
[ ⚙ Filter ☰ ]                              ← filter full width
[ Grouped | Flat ]   [ ⋯ ]                  ← view + overflow row
```

Filter click → **popover** (desktop) or **existing bottom sheet** (mobile):

```
┌──────────────────────────┐
│ ▾ Date                   │ ← accordion section
│ ▾ Category               │
│ ▾ Type                   │
│──────────────────────────│
│ [ Reset Filters ] [ Apply ]  ← sticky footer
└──────────────────────────┘
```
Expanding a section reveals its options inline (reuses `TransactionFilters mode="sheet"`).

## Filter panel organization

- **Date** — Any Date (clears date) · Today · This Week · This Month · This Year · Last 3 Months · Custom Range (existing from/to inputs + Apply).
- **Category** — single-select list of the user's categories (with emoji), "All Categories" first. Scrollable.
- **Type** — Income / Expense (+ "All Types").
- **Footer** — Reset Filters (ghost) / Apply Filters (primary). Apply closes the panel; filters are otherwise applied live via the existing `onFilterChange → URL → server load` pipeline.
- **Future filters** = one more accordion pill added to `TransactionFilters`. No toolbar change ever required.

## Flip7 conformance

- All colors from tokens: `--color-surface`/`--color-cream`, `--color-hairline`, `--color-teal`/`--color-teal-bg`, `--color-text-muted`, `--color-coral` (badge).
- Radii: `--radius-pill` (search + button), `--radius-lg` (popover), `--radius-xl` (mobile sheet, already in `FiltersSheet`).
- Shadows: `--shadow-card` (popover), `--glow-card` (active button / badge) — no custom shadows.
- Typography: `--font-body`, `--font-size-sm/xs`, `--font-mono` (badge count).
- Motion: `--transition-fast`, existing `fade-in-up` utility / `popoverIn` keyframe pattern.
- Touch: every control `min-height: 44px` (`--touch-target-min`).

## Implementation

### 1. `src/routes/transactions/+page.svelte` — toolbar restructure

**Script:**
- Add `import { browser } from '$app/environment';`.
- Add `isMobile` state (`$state(browser && matchMedia('(max-width: 768px)').matches)`) + a `$effect` that registers a `matchMedia` change listener (same pattern already used in `MonthlyTrendChart`).
- Add refs: `let popoverEl = $state<HTMLDivElement|null>(null);` and `let filterBtnEl = $state<HTMLButtonElement|null>(null);`.
- Add a `$effect` gated on `filtersOpen && !isMobile` that: focuses the first focusable in `popoverEl` (rAF), closes on **click-outside**, closes + returns focus to `filterBtnEl` on **Escape**. Cleanup removes listeners.
- Extend `dateRangeFromFilter` with `case 'today'` (from = to = today) and `case 'this-year'` (from = `YYYY-01-01`, to = `YYYY-12-31`). No server change — the load handler already consumes `date_from`/`date_to` ([+page.server.ts:16-17](src/routes/transactions/+page.server.ts#L16-L17)).

**Markup (replaces the `desktop-only toolbar-filters` span and the `mobile-only` filters button):**
```svelte
<div class="toolbar-left">
  <div class="toolbar-search"> … existing search input (aria-label already present) … </div>
  <div class="toolbar-filter">
    <button class="filters-btn" class:active={activeFilterCount > 0}
            onclick={() => (filtersOpen = !filtersOpen)}
            aria-haspopup="dialog" aria-expanded={filtersOpen} aria-controls="filters-panel"
            type="button" bind:this={filterBtnEl}>
      …funnel svg… Filter {#if activeFilterCount > 0}<span class="filters-badge">{activeFilterCount}</span>{/if}
    </button>
    {#if filtersOpen && !isMobile}
      <div class="filters-popover" id="filters-panel" role="dialog" aria-label="Filters"
           bind:this={popoverEl}>
        <TransactionFilters mode="sheet" categories={data.categories ?? []}
          activeFilters={{ date: filters.date, category: filters.category, type: filters.type }}
          onFilterChange={handleFilterChange}
          onApply={() => { filtersOpen = false; filterBtnEl?.focus(); }} />
      </div>
    {/if}
  </div>
</div>
<div class="toolbar-right">
  <ViewToggle {showFlatView} onChange={(flat) => showFlatView = flat} />
  <span class="mobile-only toolbar-overflow"><OverflowMenu … /></span>
</div>
```
- Remove the old `<span class="desktop-only toolbar-filters">…<TransactionFilters …/></span>` block and the old `<span class="mobile-only">` filters-button wrapper.
- Update the `FiltersSheet` at the bottom: `open={filtersOpen && isMobile}` (keeps desktop from opening the sheet).

**CSS:**
- `.toolbar-search`: `flex: 1 1 280px; max-width: 520px;` so search **expands first** on desktop/tablet.
- `.toolbar-filter { position: relative; flex-shrink: 0; }`.
- `.filters-popover`: `position: absolute; top: calc(100% + 8px); left: 0; width: min(380px, calc(100vw - 32px)); max-height: 70vh; overflow-y: auto; background: var(--color-cream); border: 1px solid var(--color-hairline); border-radius: var(--radius-lg); box-shadow: var(--shadow-card); z-index: var(--z-modal, 1000); padding: var(--space-sm);` + `fade-in-up` animation. Override `:global(.sheet-footer)` background to `var(--color-cream)` so the sticky footer matches.
- `.filters-btn`: now universal (remove mobile-only gating). Add `.filters-btn.active` = teal border/bg/text + `--glow-card` (mirrors `TransactionFilters` pill active state).
- Mobile `@media (max-width: 768px)`: `.toolbar-left { width: 100%; flex-wrap: wrap; }`, `.toolbar-search { flex-basis: 100%; max-width: 100%; }`, `.filters-btn { width: 100%; justify-content: center; }`, `.toolbar-right { width: 100%; justify-content: space-between; }`. Remove the obsolete `.toolbar-right .mobile-only:first-child { flex: 1 }` rule and the `.toolbar-left :global(.filter-bar)` margin rule.

### 2. `src/lib/components/TransactionFilters.svelte` — date presets

In the date popover section (lines ~138-185): add **Any Date** (`setDateFilter('')`, active when `!activeFilters.date`) at the top, then **Today** (`setDateFilter('today')`), **This Week**, **This Month**, **This Year** (`setDateFilter('this-year')`), **Last 3 Months**, then the existing Custom Range block. Button markup mirrors the existing preset buttons (`.popover-option` + `.popover-dot`).

### 3. `src/lib/components/FiltersSheet.svelte` — aria-controls target

Add `id="filters-panel"` to the `.filters-sheet` dialog element (line ~51) so the unified button's `aria-controls` resolves on mobile too. Both panels never render simultaneously (popover: `!isMobile`, sheet: `isMobile`).

## Files touched

- `src/routes/transactions/+page.svelte` — toolbar markup, `isMobile` state, popover effect, `dateRangeFromFilter` cases, CSS.
- `src/lib/components/TransactionFilters.svelte` — add Any Date / Today / This Year presets.
- `src/lib/components/FiltersSheet.svelte` — add `id="filters-panel"`.

No changes to server load handlers, filter logic, `ViewToggle`, `handleFilterChange`, URL sync, or export/import flows.

## Verification

1. `npm run dev`, log in, open `/transactions`.
2. **Desktop:** search expands; Filter button sits beside it; Grouped/Flat right-aligned. Click Filter → popover opens with Date/Category/Type accordion; click-outside / Escape / Apply close it; focus returns to Filter button on close; badge shows active filter count.
3. **Behavior unchanged:** select each date preset (incl. Today/This Year), a category, a type, and a custom range — results, URL params, and summary match today's behavior. Confirm `date_from`/`date_to` in the URL for the new presets.
4. **Mobile (≤768px):** search full width → Filter full width → Grouped/Flat + overflow row. Filter opens the existing bottom sheet (backdrop, Escape, focus-first intact).
5. **A11y:** `aria-expanded`/`aria-controls` present; Escape closes; focus restores; 44px touch targets.
6. `npm run check` and `npm run build` clean.

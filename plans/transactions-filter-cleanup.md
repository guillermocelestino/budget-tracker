# Transactions Filter (Desktop) — Cleanup Plan

## Context

The current desktop filter UX on `/transactions` uses a **unified `SearchFilterPill`** that opens a **single large popover** containing `TransactionFilters` — a monolithic panel with Date, Category, and Type pills, each with their own nested popovers. This creates:
- "Panel-within-panel" (3 levels deep)
- Excessive vertical footprint
- Redundant "Apply Filters" + "Reset Filters" despite live apply
- Two clear actions ("Reset Filters" + "Clear All")
- Horizontal scrollbar issues from absolute-positioned popovers inside a constrained panel

The user wants **independent compact pills** (Date | Category | Type | Clear All) each owning its own dropdown, overlaying cleanly without scrolling the panel.

## Current Architecture

```
/transactions/+page.svelte
  └─ SearchFilterPill (bind:value=searchInput, bind:open=filtersOpen)
      └─ TransactionFilters (mode='popover')
          ├─ Date pill → popover with presets + custom range (Apply button)
          ├─ Category pill → popover with category list
          ├─ Type pill → popover with Income/Expense (has emoji, lowercase)
          ├─ Clear All pill (when active)
          └─ FilterFooter (Apply Filters / Reset Filters)
```

**Key files to modify:**
- `src/routes/transactions/+page.svelte` — replace toolbar composition
- `src/lib/components/TransactionFilters.svelte` — **DELETE** (replaced by individual menus)
- `src/lib/components/SearchFilterPill.svelte` — keep for mobile + other pages
- `src/lib/components/FilterFooter.svelte` — keep for other pages (recurring/lending/borrowed)

## New Component Architecture

```
/transactions/+page.svelte
  ├─ TransactionFilterToolbar (desktop) — ONE unified "filter dock"
  │     ├─ embedded search input (bind:value=searchInput)
  │     ├─ Date segment → DateFilterMenu
  │     ├─ Category segment → CategoryFilterMenu
  │     ├─ Type segment → TypeFilterMenu
  │     └─ Clear All (n) rose segment (when any filter active)
  ├─ SearchFilterPill (mobile) → FiltersSheet → TransactionFilterPanel (in-sheet accordion)
  │     └─ same shared menus (embedded variant)
  └─ ViewToggle
```

**New components to create (shared desktop/mobile):**
- `src/lib/components/DateFilterMenu.svelte` — date presets + custom range (Apply only for custom); `embedded` variant strips the card chrome for in-sheet use
- `src/lib/components/CategoryFilterMenu.svelte` — category list; `embedded` variant removes internal scroll (the sheet scrolls instead)
- `src/lib/components/TypeFilterMenu.svelte` — Income/Expense, **no emoji, title-case**; `embedded` variant
- `src/lib/components/TransactionFilterToolbar.svelte` — desktop unified dock (search + 3 segments + Clear All)
- `src/lib/components/TransactionFilterPanel.svelte` — mobile in-sheet accordion (Date/Category/Type sections + Clear All). **Renamed** from the earlier "chips" spec — the floating-popover-over-sheet pattern was the wrong mobile idiom; an in-flow accordion matches the borrowed/lending sheet (see §2)

## Detailed Spec

### 1. Desktop Toolbar Layout (>768px)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 🔍 Search transactions  │ Date ▼ │ Category ▼ │ Type ▼ │ Clear All (2)   Grouped | Table │
└──────────────────────────────────────────────────────────────────────────────┘
```

- `TransactionFilterToolbar` ("filter dock"): one 44px rounded instrument holding embedded search + Date/Category/Type segments separated by inset hairlines; active segments light up mint-teal; Clear All (n) rose segment appended when any filter active. `flex: 1 1 360px` so it wraps to its own row on tablet instead of squeezing. `overflow: hidden` clips segment tints to the pill — the fixed popovers escape it.
- `ViewToggle`: right-aligned (existing)

### 2. Mobile Layout (≤768px) — In-Sheet Accordion

**Revision:** the original "3 pills + fixed popovers" spec floated cards over the bottom sheet — the same panel-within-panel problem we killed on desktop, plus z-index/clamping fragility. Mobile instead uses the **borrowed/lending sheet idiom**: a calm, in-flow panel where the options sit flush in the sheet and the sheet simply grows.

`TransactionFilterPanel` renders three section rows (Date / Category / Type), single-open accordion. Tapping a row expands its shared menu **inline below it** (`embedded` variant — no card chrome, no internal category scroll, the sheet scrolls), pushing the rows beneath down. Nothing floats, nothing overlaps, no `position: fixed`, no viewport clamping, no scroll-sync listeners. Selecting an option applies immediately and collapses the section (matches desktop). Footer: single rose **"Clear All (n)"**.

```
┌─ Filters ──────────────────────────────── [✕] ┐
│  DATE                        This Month    ▾ │ ← section row (open)
│   ● Any Date    ● Today    ● This Week        │
│   ● This Month ✓  ● This Year                 │
│   ● Last 3 Months                             │
│   ─────────────────────────────────────       │
│   ● Custom Range   [From] [To] [Apply]        │
│  CATEGORY                     🍔 Food     ▾ │ ← closed row
│  TYPE                         Expense    ▾ │ ← closed row
│  [ Clear All (3) ]                          │ ← rose footer (active only)
└──────────────────────────────────────────────┘
```

- Section header row: 48px touch target, uppercase `--font-display` label, current value right-aligned (muted; teal when a filter is active), chevron rotates 180° on open. Hairline seams between rows; open row gets `--color-teal-bg` tint.
- Expanded body: the shared menu option rows (teal dot + mint tint + ✓ on active), 44px touch targets in embedded mode.
- The sheet body scrolls naturally when an open section exceeds `max-height: 78vh`.

### 3. Menu Positioning & Clamping (Critical)

Each menu is **absolutely positioned under its pill** with viewport clamping:

```js
function positionPopover(chipEl, menuEl) {
  const chipRect = chipEl.getBoundingClientRect();
  const menuRect = menuEl.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;

  let left = chipRect.left;
  let top = chipRect.bottom + 4;

  // Horizontal clamp
  const maxLeft = vw - menuRect.width - 8;
  if (left > maxLeft) left = Math.max(8, maxLeft);
  if (left < 8) left = 8;

  // Vertical clamp (flip up if needed)
  if (top + menuRect.height > vh - 8) {
    const flipped = chipRect.top - menuRect.height - 4;
    if (flipped >= 8) top = flipped;
    else top = Math.max(8, vh - menuRect.height - 8);
  }

  menuEl.style.left = `${left}px`;
  menuEl.style.top = `${top}px`;
}
```

- Menus rendered **inline in chip component** (not portaled), `position: fixed`, `z-index: 100`
- Panel (`.filter-chips`) has `overflow: visible` — never clips
- **No horizontal scrollbar ever** — menus sized to content, clamped

### 4. Panel Sizing

- **Desktop popovers** (`.filter-popover`): content-sized, `position: fixed`, viewport-clamped. Only **Category menu** scrolls internally (`max-height: 280px; overflow-y: auto; overflow-x: hidden`); Date/Type are fixed height (5–7 items), no scroll.
- **Mobile sheet** (`TransactionFilterPanel`): in-flow, no fixed positioning. The `FiltersSheet` body scrolls (`overflow-y: auto`); the `embedded` category list drops its internal scroll so the sheet is the single scroll container (no nested scroll on touch).

### 5. Interaction

| Action | Behavior |
|--------|----------|
| Click pill | Opens its menu, closes others (single `openMenu` state) |
| Preset select (Date/Category/Type) | Applies immediately, closes menu |
| Custom date range | Fill inputs → click **Apply** (only custom needs it) → closes |
| Outside click / Escape | Closes open menu |
| Clear All | Resets all filters, updates URL |

### 6. Copy Fixes

- **Type chip label**: `"Type: Income"` / `"Type: Expense"` (title-case, was `"Type: income"`)
- **Type menu options**: `"Income"` / `"Expense"` (no 💰/💸 emoji, was with emoji)
- **Clear All**: single action, rose (`--color-coral`), badge with count

### 7. Active State Styling (Keep)

- **Dock segments** (desktop): active/open segment = `--color-teal-bg` background + `--color-teal` text + 600 weight (segmented-control tint, no border — the inset hairlines separate segments). Focus ring is inset (`box-shadow: inset 0 0 0 2px var(--color-teal)`, since `--focus` is a full outward shadow list).
- **Standalone pills** (mobile sheet): active pill = `--color-teal-bg` background + `--color-teal` border + teal text + 600 weight; open pill = teal border (no bg)
- Chevron rotates 180° on open
- Selected menu rows: teal dot (::before) + mint-tint (`--color-teal-bg`) row background
- **Clear All**: rose (`--color-coral`) text + coral count badge; hover = `--color-coral-bg` tint

### 8. Tokens Only (No New CSS Custom Properties)

- Spacing: `--space-xs` (4), `--space-sm` (8), `--space-md` (12), `--space-lg` (16)
- Radii: `--radius-md` (8), `--radius-lg` (12), `--radius-pill` (999)
- Colors: `--color-surface`, `--color-cream`, `--color-hairline`, `--color-teal`, `--color-teal-bg`, `--color-coral`, `--color-text`, `--color-text-muted`, `--focus`
- Typography: `--font-body`, `--font-display`, `--font-mono`, `--font-size-xs/sm/base`
- Motion: `--transition-fast`, `--ease`, `prefers-reduced-motion`

## Implementation Steps

### Phase 1: Create Shared Menu Components

1. **`DateFilterMenu.svelte`**
   - Props: `activeFilter`, `customFrom` (bindable), `customTo` (bindable), `onSelect`, `onCustomApply`, `closePopover`
   - 6 presets (Today, This Week, This Month, This Year, Last 3 Months, Custom Range)
   - Custom range: two date inputs + Apply button (enabled when both filled)
   - Keyboard: Arrow keys, Enter on Apply, Escape closes
   - Focus management: first input on Custom open

2. **`CategoryFilterMenu.svelte`**
   - Props: `categories`, `activeFilter`, `onSelect`, `closePopover`
   - "All Categories" option + scrollable list
   - Each row: emoji icon + name + check mark when active
   - `max-height: 280px; overflow-y: auto; overflow-x: hidden`
   - Keyboard: Arrow keys, Escape

3. **`TypeFilterMenu.svelte`**
   - Props: `activeFilter`, `onSelect`, `closePopover`
   - 3 options: All Types / Income / Expense (plain text, title-case)
   - Keyboard: Arrow keys, Escape

### Phase 2: Create the Desktop Orchestrator (unified dock)

4. **`TransactionFilterToolbar.svelte`** (desktop unified dock)
   - Props: `value` (bindable, embedded search), `placeholder`, `ariaLabel`, `categories`, `activeFilters` (date, category, type, customFrom, customTo), `onFilterChange`, `onClearAll`
   - **Single state**: `openMenu: 'date'|'category'|'type'|null` (opening one closes others)
   - Markup: `.filter-dock` = search region + hairline dividers + 3 `.dock-chip` segments + conditional rose Clear All segment
   - Search region: `flex: 1; min-width: 90px` — the page's debounced URL sync binds `value` here
   - Each segment click toggles its shared menu, positions popover (fixed + viewport-clamped, mount `visibility:hidden` → measure → reveal)
   - Outside-click/Escape listener on document; window resize/scroll → re-position; focus returns to the segment on close
   - CSS: `.filter-dock` `height: 44px` (matches ViewToggle), `border-radius: var(--radius-pill)`, `overflow: hidden` (clips tints; fixed popovers escape it), `flex: 1 1 360px`

5. **`TransactionFilterPanel.svelte`** (mobile-sheet orchestrator)
   - Props: `categories`, `activeFilters`, `onFilterChange`, `onClearAll`
   - Single `openSection` state (one accordion section open at a time; opening another closes the previous)
   - Renders 3 section header rows; the open section's shared menu renders inline (`embedded`) below it; footer rose **Clear All (n)**
   - No refs / no `position: fixed` / no document listeners — the sheet scrolls; Escape + Tab trapping handled by `FiltersSheet`

### Phase 3: Update Transactions Page

6. **`src/routes/transactions/+page.svelte`**
   - Remove `filtersOpen` state (no longer needed for desktop)
   - Add `mobileFiltersOpen` for mobile FiltersSheet
   - Import new components; **delete `TransactionSearchPill.svelte`** (search is embedded in the dock)
   - Replace toolbar markup:
     ```svelte
     <div class="toolbar-desktop">
       <TransactionFilterToolbar bind:value={searchInput} categories={...} activeFilters={...}
         onFilterChange={handleFilterChange} onClearAll={clearAllFilters} ... />
     </div>
     <div class="toolbar-mobile">
       <SearchFilterPill bind:value={searchInput} bind:open={mobileFiltersOpen} ...>
         {#snippet panel(mode, close)}
           <TransactionFilterPanel categories={...} activeFilters={...}
             onFilterChange={handleFilterChange} onClearAll={clearAllFilters} />
         {/snippet}
       </SearchFilterPill>
     </div>
     ```
   - CSS: `.toolbar-desktop` (flex, wraps — the dock handles tablet), `.toolbar-mobile` (full-row), media queries to toggle; desktop and mobile are both rendered and toggled via CSS (hydration-safe, no SSR mismatch)

### Phase 4: Cleanup

7. **Delete `TransactionFilters.svelte`** — replaced by shared menus
8. **Verify** `SearchFilterPill` still works for mobile + other pages (lending, categories, recurring)
9. **Verify** `FilterFooter` still used by recurring/lending/borrowed

## Verification

Run `npm run check` → 0 errors, `npm run lint` → clean.

Human visual pass at 1440/1200/1024:
1. Desktop toolbar single row, search pill ≤30% width
2. Click Date → popover opens, select "This Month" → list filters immediately, URL updates, chip shows "Date: This Month" (mint-tint + teal border)
3. Click Category → popover opens, select category → immediate, chip shows "Category: 🍔 Food"
4. Click Type → popover opens, select "Expense" → immediate, chip shows "Type: Expense" (title-case, no emoji)
5. Custom date range → fill → Apply → filters
6. **Zero horizontal scrollbars** on any menu open
7. **Panel never scrolls** (no vertical scrollbar on `.filter-chips`)
8. Menus overlay cleanly, never clipped, never push layout
9. Escape/outside-click closes
10. Clear All (n) rose pill appears when active, clears everything
11. Single Clear All action (no "Apply Filters", no "Reset Filters")
12. Mobile (≤768px): SearchFilterPill → FiltersSheet → 3 compact pills → each opens shared menu dropdown, Clear All works

## Files

| File | Change |
|------|--------|
| `src/lib/components/DateFilterMenu.svelte` | **NEW** — shared date menu |
| `src/lib/components/CategoryFilterMenu.svelte` | **NEW** — shared category menu |
| `src/lib/components/TypeFilterMenu.svelte` | **NEW** — shared type menu (no emoji, title-case) |
| `src/lib/components/TransactionFilterToolbar.svelte` | **NEW** — desktop unified dock (search + 3 segments + Clear All) |
| `src/lib/components/TransactionFilterPanel.svelte` | **NEW** — mobile in-sheet accordion (Date/Category/Type + Clear All) |
| `src/routes/transactions/+page.svelte` | Desktop toolbar → dock; mobile panel → chips; media queries |
| `src/lib/components/TransactionFilters.svelte` | **DELETE** |
| `src/lib/components/TransactionSearchPill.svelte` | **DELETE** (search embedded in the dock) |
| `src/lib/components/MobileFilterDropdowns.svelte` | **DELETE** (superseded by `TransactionFilterPanel`; had emoji type copy + "Reset Filters") |
| `src/lib/components/SearchFilterPill.svelte` | No change (mobile + other pages) |
| `src/lib/components/FilterFooter.svelte` | No change (other pages) |
| `src/lib/components/FiltersSheet.svelte` | No change (mobile) |
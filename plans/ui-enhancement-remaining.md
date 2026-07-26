# Plan: Remaining UI Enhancement Items

## Context

From the original UI enhancement plan (`ui-enhancement-plan.md`), most items have already been applied in a previous session (shadows, borders, card states, sidebar accessibility, modal focus trap, transitions, etc.). This plan covers the 6 items that are still outstanding, ordered by priority and effort.

---

## Item 1: Collapsible Transaction Filter Bar

**File:** `src/routes/transactions/+page.svelte`

**Current:** 4 inputs (type select, category select, date from/to) + 2 buttons (Apply, Clear) in a `flex-wrap` row. Looks cluttered.

**Fix:** Wrap the filter inputs in a collapsible section with a toggle button.

**Approach:**
- Add a `showFilters` state variable (default `true` on desktop, or remembered from localStorage)
- Toggle button with active filter count badge (e.g., "Filters (2)")
- On desktop: filters visible inline (same as current layout)
- On mobile: filters hidden by default, toggled open in a stacked panel
- Animate the collapse/expand with CSS `max-height` transition or Svelte `slide` transition

**Changes to the template:**
```svelte
<script>
  let showFilters = $state(true);
  const activeFilterCount = $derived(
    [typeFilter, categoryFilter, dateFromFilter, dateToFilter].filter(Boolean).length
  );
</script>

<button class="filter-toggle" onclick={() => showFilters = !showFilters}>
  <span>🔍 Filters</span>
  {#if activeFilterCount > 0}
    <span class="filter-badge">{activeFilterCount}</span>
  {/if}
  <span class="toggle-arrow" class:open={showFilters}>{showFilters ? '▲' : '▼'}</span>
</button>

{#if showFilters}
  <div class="filter-panel" transition:slide={{ duration: 200 }}>
    <!-- existing filter inputs -->
  </div>
{/if}
```

---

## Item 2: Dashboard Summary Number Transitions

**File:** `src/lib/components/SummaryCards.svelte`

**Current:** Values jump instantly on page navigation/update.

**Fix:** Add a CSS transition on `.card-value` for a brief count-up feel, OR use a simple animation.

**Approach (CSS-only, simplest):**
```css
.card-value {
  transition: opacity 300ms ease, transform 300ms ease;
}
```
Or add a brief fade-in animation to the whole card section when mounted. The card section already has hover transitions from previous polish, so a subtle value transition is a natural next step.

**Alternative (JS count-up):**
Use a `tweened` store or custom `requestAnimationFrame` to animate from 0 to the target value over ~500ms. More visually impressive but heavier.

---

## Item 3: Sidebar Desktop Collapse

**Files:** `src/lib/components/Sidebar.svelte`, `src/styles/variables.css`

**Current:** Sidebar is always 240px wide on desktop with labels visible.

**Fix:** Add a collapse button that toggles between full-width (240px) and icon-only (60px) modes.

**Approach:**
- Add a `collapsed` state variable
- Persist preference to `localStorage`
- In collapsed mode:
  - Sidebar narrows to 60px
  - Only icons show (labels hidden with `display: none` or `visibility: hidden`)
  - Main content area adjusts margin-left
  - Hover shows a tooltip/popover with the label
- Transition the width change with CSS

**CSS changes:**
```css
.sidebar.collapsed {
  width: 60px;
}
.sidebar.collapsed .nav-label,
.sidebar.collapsed .sidebar-logo,
.sidebar.collapsed .sidebar-footer small {
  display: none;
}
```

Also update `--sidebar-width` or use a CSS variable for the collapsed state.

---

## Item 4: Unify Responsive Breakpoints

**Files:** Multiple across all components

**Current:** Uses 768px, 640px, and 480px breakpoints inconsistently.

| Page | Breakpoints Used |
|---|---|
| Layout | 768px |
| SummaryCards | 768px |
| TransactionList | 640px (hide description), 480px (table→cards) |
| TransactionForm | 480px |
| Reports | 768px (grid), 640px (controls/table) |
| Dashboard | 640px |

**Fix:** Standardize to 2 breakpoints:
- **768px** — sidebar collapses, grids go single-column, filters stack
- **480px** — table → card switch, form actions stack, toasts go full-width

Drop the 640px intermediate breakpoint and merge its behavior into 768px or 480px.

---

## Item 5: Widen Form Containers

**Files:** `src/routes/transactions/new/+page.svelte`, `src/routes/transactions/[id]/edit/+page.svelte`

**Current:** `.form-container` has `max-width: 600px` centered.

**Fix:** Widen to `max-width: 640px` and add a subtle left-aligned layout on desktop for a less floating feel.

---

## Item 6: Use `--radius-xl`

**File:** `src/routes/login/+page.svelte`

**Current:** Login card uses `border-radius: var(--radius-lg)` (12px).

**Fix:** Change to `border-radius: var(--radius-xl)` (16px) — it's defined in variables.css but never used.

---

## Priority & Effort

| # | Item | Effort | Impact |
|---|---|---|---|
| 1 | Collapsible filter bar | Medium | High — cleans up busiest page |
| 2 | Number transitions | Low | Low — subtle polish |
| 3 | Sidebar collapse | Medium+ | Medium — desktop UX |
| 4 | Unify breakpoints | Low-Med | Medium — consistency |
| 5 | Form widths | Low | Low — minor tweak |
| 6 | radius-xl | Trivial | Very Low — nitpick |

---

## Verification

1. **Build:** `npm run build` — no errors
2. **Visual:** Run locally and check:
   - Transactions page: filter bar collapses/expands, badge shows count
   - SummaryCards: values transition smoothly on navigate
   - Sidebar: collapses to icons on desktop toggle
   - Login card: slightly rounder corners
   - Forms: slightly wider container
3. **Mobile:** Check responsive behavior at 768px and 480px

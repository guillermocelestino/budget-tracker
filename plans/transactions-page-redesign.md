# Transactions Page Redesign — Senior UI/UX Proposal

> **Inspiration:** Monarch Money (interactive summary cards) × Ramp/Stripe (frictionless filter pills)
> **Status:** Design proposal — awaiting approval before implementation

---

## Task 1: Interactive Summary Cards

### Current Problem

Static numbers in simple bordered boxes. No interactivity, no context awareness. When filters are applied, the cards update but look identical — the user can't tell what's filtered.

### New Design — Premium Widget Cards

```
┌─────────────────────────────────────────────────────────────────┐
│  Transactions                                      + Add Txn  │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  [Date: This Month v]  [Category: All v]  [Type: All v]   │ │
│  │                                                 [Clear]   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │  💰 Income   │  │  💸 Expenses │  │  📊 Net            │   │
│  │              │  │              │  │                    │   │
│  │  ₱52,000     │  │  ₱38,000    │  │  ₱14,000           │   │
│  │  ━━📈━━      │  │  ━━📈━━     │  │  ━━━━━━━━━━        │   │
│  │  +8% vs last  │  │  -3% vs last│  │  ↑ Positive trend  │   │
│  │              │  │              │  │                    │   │
│  │  [clickable] │  │  [clickable] │  │  [clickable]       │   │
│  └──────────────┘  └──────────────┘  └────────────────────┘   │
│                                                                 │
│  ┌─ Filtered view (type=expense active) ───────────────────┐   │
│  │  💸  When filtered by Expenses, the Expense card        │   │
│  │     highlights (border glows, bg tint deepens) and      │   │
│  │     the other cards dim slightly to show context.       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─ Today ─────────────────────────────────────────────────┐   │
│  │  ₊  Groceries          🛒 Food & Drink    −₱2,450   ✎ 🗑  │   │
│  │  ₊  Salary             💼 Income           +₱50,000  ✎ 🗑  │   │
│  └────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

### Card Spec

| Element | Treatment |
|---------|-----------|
| **Background** | `var(--color-surface)` with a subtle gradient accent on the left edge |
| **Icon** | 40×40 circle with contextual color (`--color-income` / `--color-expense` / `--color-primary`) |
| **Value** | 24px bold (`--font-size-2xl`) with tabular-nums |
| **Sparkline** | Tiny inline trend (3 data points: prev → current → projected). Rendered as a 60×24 SVG path, no axes |
| **Sub-label** | 12px muted — shows % change vs previous period, or "vs last month" |
| **Click** | Tapping a card sets the `type` filter to that type (e.g., tapping "Expenses" sets filter to `expense`) |
| **Active state** | When card's type matches the active filter: `border-color` shifts to its semantic color, background gets a 5% tint, scale 1.02 |

### Interactive Behavior

```
Default state (no filters):
  [ 💰 Income: ₱52k ]  [ 💸 Expenses: ₱38k ]  [ 📊 Net: ₱14k ]

User clicks "Expenses" card:
  → typeFilter = 'expense'
  → Expenses card glows (red border + tint)
  → Income/Net cards dim to 70% opacity
  → Transaction list refreshes showing only expenses

User clicks "Income" card (while expenses is active):
  → typeFilter = 'income'
  → Income card glows green
  → Expenses/Net dim

User clicks active card again:
  → typeFilter = '' (clears)
  → All cards restore to full opacity
```

### Sparkline SVG (inline, 60×24)

```svg
<svg width="60" height="24" viewBox="0 0 60 24" fill="none">
  <path d="M0,20 L15,16 L30,12 L45,8 L60,4" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"/>
</svg>
```
Three points, no fill, just a thin colored line. Acts as a mini visual cue that there's history behind the number.

---

## Task 2: Modern Filtering UX — Filter Pills with Popovers

### Replace the Collapsible Panel

Current: bulky select/date inputs behind a "Filters" toggle button.

New: a **horizontal Filter Bar** with interactive pills that open floating popovers.

```
┌────────────────────────────────────────────────────────────┐
│  [Date: This Month ▼]  [Category: All ▼]  [Type: All ▼]   │
│  [Clear All]                              [+ Add Filter]   │
└────────────────────────────────────────────────────────────┘
```

### Pill States

| State | Visual |
|-------|--------|
| **Default (no filter)** | `padding: 8px 16px`, `border-radius: 999px`, `border: 1px solid var(--color-border)`, `background: transparent`, `color: var(--color-text-secondary)` |
| **Hover** | `background: var(--color-bg)`, `border-color: var(--color-primary)` |
| **Active (filter set)** | `background: var(--color-primary-light)`, `border-color: var(--color-primary)`, `color: var(--color-primary)`, `font-weight: 600` |
| **Open (popover visible)** | Same as active + `box-shadow: 0 2px 8px rgba(99, 102, 241, 0.2)` |

### Pill Content

```
[Date: This Month ▼]
       ↕ click opens
 ┌────────────────┐
 │  This Week     │
 │ ● This Month   │  ← active dot
 │  Last 3 Months │
 │  Custom Range  │
 │ ───────────── │
 │  From: [____]  │  ← appears when "Custom Range" selected
 │  To:   [____]  │
 └────────────────┘

[Category: All ▼]
       ↕ click opens
 ┌────────────────────┐
 │  All Categories    │
 │ ───────────────── │
 │  🛒 Groceries     │
 │  🏡 Housing       │
 │  💼 Salary        │
 │  🚗 Transport     │
 │  ...              │
 │ ───────────────── │
 │  Search...        │  ← search input at bottom
 └────────────────────┘
```

### Popover Spec

```css
.filter-popover {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 240px;
  max-height: 320px;
  overflow-y: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  z-index: var(--z-modal);
  padding: var(--space-xs);
  animation: popoverIn 150ms ease-out;
}

@keyframes popoverIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

[data-theme="dark"] .filter-popover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

/* Popover items */
.popover-option {
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  transition: background 100ms ease;
}

.popover-option:hover {
  background: rgba(99, 102, 241, 0.05);
}

.popover-option.active {
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-weight: 600;
}

/* Active dot indicator */
.popover-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-primary);
  opacity: 0;
}
.popover-option.active .popover-dot { opacity: 1; }
```

### Filter Bar Layout

```css
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  align-items: center;
  margin-bottom: var(--space-lg);
  position: relative;  /* for popover positioning */
}

.filter-pill {
  position: relative;  /* popover anchors to this */
  /* ... pill styles ... */
}

.filter-pill.active {
  background: var(--color-primary-light);
  border-color: var(--color-primary);
  color: var(--color-primary);
}
```

### "Clear All" Pill

Always visible. Shows the count of active filters:

```
[Clear All (3)]    ← only visible when filters are active
```

---

## Task 3: Transaction List Integration

### Filtered State — Smooth Transition

When filters change, the transaction list should **fade-transition** to show the new results:

```css
.txn-list {
  transition: opacity 200ms ease;
}

.txn-list.is-loading {
  opacity: 0.5;
  pointer-events: none;
}
```

A subtle **skeleton shimmer** (3-4 placeholder rows) shows during the ~200-300ms load time:

```css
.skeleton-row {
  height: 56px;
  background: linear-gradient(
    90deg,
    var(--color-bg) 25%,
    var(--color-surface) 50%,
    var(--color-bg) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: var(--radius-sm);
  margin-bottom: 2px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

### Empty State — Contextual

When filters result in zero transactions:

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│                     🔍 No results                          │
│                     ─────────────                          │
│                                                            │
│     No transactions match your current filters.            │
│                                                            │
│     Try adjusting the date range or clearing filters.      │
│                                                            │
│              [Clear All Filters]                           │
│                                                            │
│     ── vs the "no data" empty state ──                     │
│                                                            │
│                     📄 No transactions                     │
│                                                            │
│     Add your first transaction to start tracking           │
│                                                            │
│              [+ Add Transaction]                           │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

| State | Title | Message | Action |
|-------|-------|---------|--------|
| **No data (no filters)** | "No transactions yet" | "Add your first transaction" | `+ Add Transaction` |
| **No results (filters active)** | "No results" | "No transactions match your filters" | `Clear All Filters` |

### Filter Result Count

Above the transaction list, show a subtle result count:

```
Showing 8 of 142 transactions    [Export CSV]
```

Makes the filter feel transparent — the user knows the scale of what's being shown vs hidden.

---

## Layout Wireframe — Complete Page

```
┌─────────────────────────────────────────────────────────────────┐
│  Transactions                                      [+ Add Txn] │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  [Date: This Month ▼]  [Category: All ▼]  [Type: All ▼]   │ │
│  │                                         [Clear All (3)]    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │  💰 Income       │  │  💸 Expenses     │  │  📊 Net      │  │
│  │  ₱52,000      📈 │  │  ₱38,000      📈│  │  ₱14,000    │  │
│  │  +8% vs last mo  │  │  -3% vs last mo  │  │  Positive    │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
│                                                                 │
│  Showing 8 of 142 transactions                    [Export CSV]  │
│                                                                 │
│  ┌─ Today ──────────────────────────────────────────────────┐  │
│  │  ₊  Groceries          🛒 Food & Drink    −₱2,450   ✎ 🗑 │  │
│  │  ₊  Salary             💼 Income           +₱50,000  ✎ 🗑 │  │
│  │  ₊  Rent               🏡 Housing          −₱15,000  ✎ 🗑 │  │
│  ├─ Yesterday ───────────────────────────────────────────────┤  │
│  │  ₊  Gas Station        🚗 Transport         −₱1,800   ✎ 🗑 │  │
│  │  ₊  Freelance Payment  💼 Income           +₱8,000   ✎ 🗑 │  │
│  ├─ Jul 15 ──────────────────────────────────────────────────┤  │
│  │  ₊  Restaurant         🍽️ Dining            −₱950    ✎ 🗑 │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ← Prev  Page 1 of 8  Next →                                   │
└────────────────────────────────────────────────────────────────┘
```

---

## CSS Design Rules Summary

```css
/* ─── Interactive summary cards ─── */
.summary-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
}

.summary-card {
  display: flex;
  align-items: flex-start;
  gap: var(--space-md);
  padding: var(--space-lg);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  cursor: pointer;
  transition: all 200ms ease;
  position: relative;
  overflow: hidden;
}

/* Gradient accent on the left edge */
.summary-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  border-radius: 0 2px 2px 0;
}
.summary-card.income::before { background: var(--color-income); }
.summary-card.expense::before { background: var(--color-expense); }
.summary-card.net::before { background: var(--color-primary); }

.summary-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

/* Active filter state */
.summary-card.active {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
  transform: scale(1.02);
}

/* Dimmed state (other cards when one is active) */
.summary-card.dimmed {
  opacity: 0.5;
}

/* ─── Filter pills ─── */
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  align-items: center;
  margin-bottom: var(--space-lg);
}

.filter-pill {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: transparent;
  font-size: var(--font-size-sm);
  font-weight: 500;
  font-family: inherit;
  color: var(--color-text-secondary);
  cursor: pointer;
  min-height: 40px;
  transition: all 120ms ease;
  white-space: nowrap;
}

.filter-pill:hover {
  border-color: var(--color-primary);
  background: var(--color-bg);
}

.filter-pill.active {
  background: var(--color-primary-light);
  border-color: var(--color-primary);
  color: var(--color-primary);
  font-weight: 600;
}

/* ─── Filter popover ─── */
.filter-popover {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 240px;
  max-height: 320px;
  overflow-y: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  z-index: var(--z-modal);
  padding: 4px;
  animation: popoverIn 150ms ease-out;
}

/* ─── Result count ─── */
.result-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.result-count {
  font-weight: 500;
}

/* ─── Skeleton loading ─── */
.skeleton-row {
  height: 56px;
  background: linear-gradient(
    90deg,
    var(--color-bg) 25%,
    var(--color-surface) 50%,
    var(--color-bg) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: var(--radius-sm);
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ─── Contextual empty state ─── */
.empty-filter {
  text-align: center;
  padding: var(--space-2xl);
}
.empty-filter h3 {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 var(--space-xs);
}
.empty-filter p {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  margin: 0 0 var(--space-lg);
}

/* ─── Responsive ─── */
@media (max-width: 768px) {
  .summary-cards {
    grid-template-columns: 1fr;
  }

  .filter-bar {
    overflow-x: auto;
    flex-wrap: nowrap;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 4px;
  }

  .filter-pill {
    flex-shrink: 0;
  }
}
```

## Implementation Roadmap

### Phase 1: Interactive Summary Cards
- Replace the static `.summary-bar` with premium card widgets
- Each card has: gradient left accent, icon, value, sparkline, sub-label
- Click handler sets `typeFilter` and triggers `applyFilters()`
- Active/dimmed states based on current filter

### Phase 2: Filter Pills + Popovers
- Replace the `filter-panel` with a horizontal `.filter-bar`
- Each pill manages its own popover visibility via `$state`
- Popover options update the filter state and trigger `goto()` with params
- Animated in/out via `popoverIn` keyframe

### Phase 3: List Integration
- Add result count line above the list
- Use `$effect` to show a brief skeleton when filters change
- Contextual empty state (filter-specific vs no-data)
- The existing TransactionList component stays, just wrapped in the transition

### Files That Change

| File | Action |
|------|--------|
| `src/routes/transactions/+page.svelte` | Rewrite — summary cards, filter bar, integrated list |
| (New) `src/lib/components/FilterPopover.svelte` | Create — reusable popover with options list |
| `src/lib/components/TransactionList.svelte` | Minor — add `loading` prop for fade state |
| `src/routes/transactions/+page.server.ts` | Minor — ensure filter params work with new UX |

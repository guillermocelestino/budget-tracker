# Categories Page Redesign — Senior UI/UX Proposal

> **Inspiration:** YNAB (Budgeted vs Spent vs Available logic) × Copilot Money (clean card-based aesthetic)
> **Status:** Design proposal — awaiting approval before implementation

---

## Task 1: Information Architecture & Layout

### Current Problem

The page is a dense CRUD table/card with a form panel that pushes content around. Budget limits are buried behind a form action. There's no "at a glance" budget health.

### New Layout — Budget Dashboard Feel

```
┌──────────────────────────────────────────────────────┐
│  Categories                                  + Add   │  ← PageHeader (sticky top)
│                                                    │
│  ┌─ Monthly Summary ──────────────────────────────┐ │
│  │  💰 Budgeted: ₱45,000   │  💸 Spent: ₱38,200  │ │
│  │  📊 Remaining: ₱6,800   │  ⚠️ 3 over budget   │ │
│  └──────────────────────────────────────────────────┘ │
│                                                    │
│  ┌─ Income Categories ────────────────────────────┐ │
│  │  ┌──────────────────────────────────────────┐  │ │
│  │  │ 💼  Salary         ₱50,000 earned        │  │ │
│  │  │                                          │  │ │
│  │  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━           │  │ │
│  │  │ No budget set                             │  │ │
│  │  └──────────────────────────────────────────┘  │ │
│  │  ┌──────────────────────────────────────────┐  │ │
│  │  │ 🏠  Rental Income   ₱15,000 earned       │  │ │
│  │  └──────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────┘ │
│                                                    │
│  ┌─ Expense Categories ───────────────────────────┐ │
│  │  ┌──────────────────────────────────────────┐  │ │
│  │  │ 🏡  Housing                              │  │ │
│  │  │  ┌──────┬───────────┬──────────────┐    │  │ │
│  │  │  │Budget│  Spent    │  Available   │    │  │ │
│  │  │  │₱15,000│₱14,200  │  ₱800 ◀─     │    │  │ │
│  │  │  │       │          │  (under)     │    │  │ │
│  │  │  └──────┴───────────┴──────────────┘    │  │ │
│  │  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━           │  │ │
│  │  │  ████████████████████████████░░  94%      │  │ │
│  │  └──────────────────────────────────────────┘  │ │
│  │                                              │ │
│  │  ┌──────────────────────────────────────────┐  │ │
│  │  | 🛒  Groceries                           |  │ │
│  │  │  ┌──────┬───────────┬──────────────┐    │  │ │
│  │  │  │Budget│  Spent    │  Available   │    │  │ │
│  │  │  │₱8,000│ ₱9,200   │  -₱1,200 ⚠️  │    │  │ │
│  │  │  │       │          │  (over!)     │    │  │ │
│  │  │  └──────┴───────────┴──────────────┘    │  │ │
│  │  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━           │  │ │
│  │  │  ████████████████████████████████!  115%  │  │ │
│  │  └──────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### Key Layout Decisions

**1. Group by Type First, then Alphabetical**

Instead of the YNAB "Needs / Wants / Goals" model (which requires a new `group` column and a migration), group categories by their existing `type` field:

- **Income Categories** — collapsed by default, expandable. Shows total earned vs. "No budget set" since budgets only matter for expenses.
- **Expense Categories** — expanded by default. This is the main budget surface. Each card shows Budgeted ↔ Spent ↔ Available.

This uses existing data and requires no schema changes.

**2. Card-Based List (Not Grid)**

One card per category, stacked vertically. Each card is full-width with a horizontal layout. This gives more room for the Budgeted / Spent / Available columns and progress bar. Copilot Money uses this pattern — it scans like a list but each row has card affordances.

**3. Actions Live in a Floating Panel or Slide-Over**

The current "form panel pushes content around" problem is solved by:
- **Add Category** → Opens a **slide-over panel** from the right (480px, like a drawer). The main content stays in place with a subtle dim behind it.
- **Edit Budget** → **Inline** — tap the budget number directly in the card to edit (see Task 3).
- **Edit Category (name/icon/color)** → Same slide-over as Add, but pre-filled.

This means the main page never jumps or reflows.

**4. Monthly Summary Bar (Optional Enhancement)**

A compact summary strip above the categories showing:
- Total budgeted (sum of all budget_limits)
- Total spent
- Total remaining (available)
- Count of over-budget categories

This gives the YNAB "are we okay?" feeling without needing the full budget page.

---

## Task 2: Visualizing the CategoryUsageBar

### The Current Problem

The current `CategoryUsageBar.svelte` is functional but visually flat. The progress bar is a simple thin line, the "over budget" state just changes color, and there's no typographic hierarchy.

### New Visual Treatment

```
UNDER BUDGET (0–89%):
  ┌─────────────────────────────────────────────┐
  │  Budgeted: ₱15,000     Spent: ₱12,400       │  ← muted, 13px
  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━         │
  │  ██████████████████████████████░░░░░  83%    │  ← green-teal gradient fill
  │                                      ↑      │
  │  ₱2,600 available                       ✓   │  ← color-income (green), 15px bold
  └─────────────────────────────────────────────┘

WARNING (90–99%):
  ┌─────────────────────────────────────────────┐
  │  Budgeted: ₱8,000      Spent: ₱7,600        │
  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━         │
  │  ██████████████████████████████████░░  95%   │  ← amber gradient fill
  │                                      ↑      │
  │  ₱400 available ⚡                       ⚡  │  ← amber text, small icon
  └─────────────────────────────────────────────┘

OVER BUDGET (≥100%):
  ┌─────────────────────────────────────────────┐
  │  Budgeted: ₱8,000      Spent: ₱9,200        │
  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━         │
  │  ████████████████████████████████████! 115%  │  ← red gradient, pulse animation
  │                                      ↑      │
  │  -₱1,200 overspent ⚠️                   ⚠️  │  ← color-expense (red), bold
  └─────────────────────────────────────────────┘
```

### Progress Bar Spec

```css
/* Track */
--progress-height: 8px;           /* compact: 6px in the card */
--progress-radius: 999px;
--progress-track: var(--color-bg);

/* Under budget (0-89%) — cool green/teal */
--progress-ok-start: #10b981;
--progress-ok-end: #34d399;        /* subtle gradient */

/* Warning zone (90-99%) — amber */
--progress-warn-start: #f59e0b;
--progress-warn-end: #fbbf24;

/* Over budget (100%+) — red with pulse */
--progress-over-start: #ef4444;
--progress-over-end: #f87171;
--progress-over-glow: rgba(239, 68, 68, 0.3);  /* subtle red glow on pulse */

/* Over-budget pulse keyframe */
@keyframes budgetPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.85; box-shadow: 0 0 8px var(--progress-over-glow); }
}
/* Apply only when ≥100% — subtle, 2s cycle */
```

### Typography Hierarchy

```
┌─ Category Icon ──┬─ Category Name (14px, 600) ────────────────────┐
│                   │  Expense · 4 transactions this month (12px)    │
│                   │                                                │
│   48px circle     │  ┌──────┬───────────┬──────────────────────┐   │
│   with color      │  │Budget│  Spent    │   Available          │   │
│   background      │  │13px  │  13px     │   15px 700           │   │
│                   │  │muted │  muted    │   colored by state   │   │
│                   │  └──────┴───────────┴──────────────────────┘   │
│                   │                                                │
│                   │  ████████████████████████████░░░░  83% (12px) │
│                   │                                                │
│                   │  [Edit budget] [Edit category] [Delete]       │
│                   │  — only on hover/focus                        │
└───────────────────┴────────────────────────────────────────────────┘
```

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| Category name | 14px / 0.875rem | 600 (semibold) | `--color-text` |
| Category sub (type, count) | 12px / 0.75rem | 400 | `--color-text-secondary` |
| Budgeted label | 12px / 0.75rem | 500 | `--color-text-secondary` |
| Budgeted value | 13px / 0.8125rem | 600 | `--color-text` |
| Spent value | 13px / 0.8125rem | 600 | `--color-text` |
| **Available value** | **15px / 0.9375rem** | **700 (bold)** | **varies by state** |
| Status label ("available" / "overspent") | 12px / 0.75rem | 500 | varies |
| Percentage | 12px / 0.75rem | 700 | matches bar color |

The **Available value** is the hero number — largest, boldest, color-coded. This is the YNAB-inspired "what do I have left?" focal point.

---

## Task 3: Frictionless Editing

### Inline Budget Editing

Tapping the "Budgeted" value opens an inline edit directly in the card — no page navigation, no modal:

```
  ┌──────┬───────────┬──────────────────────┐
  │Budget│  Spent    │   Available          │
  │ ₱15,│  ₱14,200  │   ₱800               │
  │  ^ tap ^        │                      │
  │  │              │                      │
  │  ▼ becomes ▼    │                      │
  │                  │                      │
  │ ┌─────────┐     │                      │
  │ │ ₱ 15,500│     │  (live-updating)     │
  │ └─────────┘     │                      │
  │ [Save] [Cancel] │                      │
  └──────────────────┴──────────────────────┘
```

### Implementation

1. User taps the Budgeted value → it morphs into a small inline input (the number itself becomes editable, preserving the ₱ prefix and formatting)
2. A "Set Budget" action is available for categories with no budget (shows a subtle "+ Set Budget" link)
3. On blur or Enter key: auto-saves via a lightweight `fetch` POST to `?/update` with just the `id` and `budget_limit` fields (optimistic update)
4. On Escape: cancels and reverts
5. The card animates the progress bar and available value on budget change — no full page reload

This avoids the heavy form panel for the most common action (tweaking a budget limit). For full category editing (name, icon, color), the slide-over panel is still used.

### Slide-Over Panel for Full Editing

```
┌──────────────────────┬──────────────────────────────┐
│                      │  ✕                          │
│   Main content       │  ┌─ Edit Category ────────┐ │
│   (dimmed, 0.3)      │  │  💸 Type: Expense      │ │
│                      │  │                        │ │
│                      │  │  Name:                 │ │
│                      │  │  [Housing            ] │ │
│                      │  │                        │ │
│                      │  │  Icon: 🏡              │ │
│                      │  │                        │ │
│                      │  │  Color: ○ ○ ○ ● ○ ○   │ │
│                      │  │                        │ │
│                      │  │  Budget Limit:          │ │
│                      │  │  [₱ 15,000           ] │ │
│                      │  │                        │ │
│                      │  │  [Save] [Cancel]       │ │
│                      │  └────────────────────────┘ │
│                      │                              │
└──────────────────────┴──────────────────────────────┘
  ← stays put →            ← slides in from right →
                            480px wide
                            box-shadow: -4px 0 24px rgba(0,0,0,0.1)
                            animation: slideInRight 250ms ease-out
```

### Why Slide-Over Instead of a Modal?

- The main page stays visible (context preservation)
- No content jumping — the card list doesn't reflow
- Feels more premium (Copilot Money / Linear pattern)
- Easy to dismiss (click outside, ESC, or ✕)
- Works on mobile as a bottom sheet

---

## Component Architecture

The implementation touches these files:

| File | Action |
|------|--------|
| `src/routes/categories/+page.svelte` | Rewrite — new layout with grouped cards, monthly summary, inline budget editing |
| `src/lib/components/CategoryList.svelte` | **Replace** — becomes the card-list renderer with the new visual design |
| `src/lib/components/CategoryUsageBar.svelte` | **Rewrite** — new progress bar with pulse animation, typographic hierarchy |
| `src/lib/components/CategoryForm.svelte` | **Refactor** — make it work in the slide-over panel (no layout shift) |
| `src/routes/categories/+page.server.ts` | Minor — possibly add dedicated budget-only update action |

All inline SVG icons stay (project convention). No new dependencies.

---

## Implementation Roadmap

### Phase 1: CategoryCard + UsageBar (core visual)
- Rewrite `CategoryUsageBar.svelte` with the pulse animation, three-state coloring, and typographic hierarchy
- Create a new `CategoryCard.svelte` (or inline in CategoryList) with the horizontal Budget/Spent/Available layout
- Group by type (income/expense), sort alphabetically within groups

### Phase 2: Inline Budget Editing
- Add click-to-edit on the Budgeted value
- Inline input morphing with ₱ prefix and comma formatting
- Auto-save on Enter/blur via fetch POST
- Optimistic update of the progress bar and available value

### Phase 3: Slide-Over Panel
- Convert the current form panel to a right-side slide-over
- Keep the existing CategoryForm component, just wrap it in a slide-over container
- Add backdrop dim and close-on-outside-click

### Phase 4: Polish
- Monthly summary bar
- Hover states on cards (subtle elevation, action buttons appear)
- Responsive: bottom sheet instead of slide-over on mobile
- "No budget" categories shown with a subtle "+ Set Budget" CTA

---

## Wireframe Detail — Final Card Component

```
┌────────────────────────────────────────────────────────────────┐
│  ┌────┐                                                        │
│  │ 🏡 │  Housing                              Expense · 5 txns │  ← header row
│  └────┘                                                        │
│                                                                │
│  ┌──────────┬──────────────┬──────────────────────────────┐    │
│  │          │              │                              │    │
│  │ Budget   │   Spent      │   Available                  │    │
│  │ ₱15,000 │   ₱14,200    │   ₱800 ◀─ hero number       │    │  ← budget row
│  │          │              │                              │    │
│  └──────────┴──────────────┴──────────────────────────────┘    │
│                                                                │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━            │
│  ████████████████████████████████████████████░░░░░░░  83%     │  ← progress bar
│                                                       ↑       │
│  ₱800 remaining ✓                        Edit budget          │  ← footer row
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### CSS Design Rules

```css
/* ─── Category Card ─── */
.category-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-md) var(--space-lg);
  transition: box-shadow 200ms ease, transform 200ms ease;
}
.category-card:hover {
  box-shadow: var(--shadow-md);
  border-color: rgba(99, 102, 241, 0.15);
}

/* ─── Card header (icon + name + meta) ─── */
.card-header {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
}
.cat-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  flex-shrink: 0;
}
.cat-name { font-size: 14px; font-weight: 600; }
.cat-meta { font-size: 12px; color: var(--color-text-secondary); }

/* ─── Three-column budget row ─── */
.budget-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1.5fr;
  gap: var(--space-md);
  margin-bottom: var(--space-sm);
}
.budget-col {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.budget-col-label {
  font-size: 12px; font-weight: 500;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.budget-col-value {
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.budget-col-hero {
  font-size: 15px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.budget-col-hero.positive { color: var(--color-income); }
.budget-col-hero.negative { color: var(--color-expense); }

/* ─── Progress bar ─── */
.budget-track {
  height: 6px;
  background: var(--color-bg);
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: var(--space-xs);
}
.budget-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 500ms cubic-bezier(0.4, 0, 0.2, 1);
}
.budget-fill.ok { background: linear-gradient(90deg, #10b981, #34d399); }
.budget-fill.warn { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
.budget-fill.over { 
  background: linear-gradient(90deg, #ef4444, #f87171);
  animation: budgetPulse 2s ease-in-out infinite;
}
@keyframes budgetPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.75; }
}

/* ─── Footer row ─── */
.budget-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}
.budget-status {
  font-weight: 600;
}
.budget-status.positive { color: var(--color-income); }
.budget-status.negative { color: var(--color-expense); }
.budget-actions {
  display: flex;
  gap: var(--space-xs);
  opacity: 0;
  transition: opacity 150ms ease;
}
.category-card:hover .budget-actions { opacity: 1; }

/* ─── Slide-over panel ─── */
.slide-over {
  position: fixed;
  top: 0;
  right: 0;
  width: 480px;
  max-width: 100vw;
  height: 100vh;
  height: 100dvh;
  background: var(--color-surface);
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.1);
  z-index: var(--z-modal);
  transform: translateX(100%);
  transition: transform 250ms cubic-bezier(0.22, 1, 0.36, 1);
  overflow-y: auto;
  padding: var(--space-xl);
}
.slide-over.open { transform: translateX(0); }

/* ─── Inline budget edit ─── */
.budget-edit-input {
  width: 120px;
  padding: 4px 8px;
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  background: var(--color-surface);
  color: var(--color-text);
  outline: none;
}
.budget-edit-input:focus {
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

/* ─── Mobile: bottom sheet instead of slide-over ─── */
@media (max-width: 640px) {
  .slide-over {
    width: 100vw;
    transform: translateY(100%);
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  }
  .slide-over.open { transform: translateY(0); }
}
```

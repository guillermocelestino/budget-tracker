# Transactions Page — Refinement Pass

> **Scope:** Refinement only. No redesign, no architecture changes, no new dependencies.
> Preserve Flip7 language (teal/coral/gold, Nunito Sans + Fredoka, pills, soft cards),
> responsive behavior, routing, server logic, and data flow.

## Guiding constraints
- Inline SVG icons only (no icon library added) — consistent with existing convention.
- No new components unless unavoidable (CLAUDE.md prefers inline improvements). All 12
  changes fit inside existing files.
- Only CSS custom properties from `variables.css`; no hardcoded colors.
- Keep all existing props/behavior on shared components (`TransactionList`, `PageHeader`
  are also used by Dashboard).

## Files touched
| File | Change |
|------|--------|
| `src/routes/transactions/+page.svelte` | Toolbar zone grouping, search width + padding, remove list caption, action spacing |
| `src/lib/components/TransactionSummary.svelte` | ~10% more compact KPI cards |
| `src/lib/components/TransactionList.svelte` | Day-header hierarchy, category icons, amount/balance hierarchy |
| `src/lib/components/PageHeader.svelte` | Title→subtitle spacing (small, shared-safe) |

---

## 1. Group toolbar controls by purpose (req #1, #7)
In `+page.svelte` `.txn-toolbar`, restructure the desktop toolbar into three visual zones
using **spacing and whitespace** (no divider lines):
- **Filtering** — search field + `TransactionFilters` (Date/Category/Type)
- **View** — `ViewToggle` (Grouped/Flat)
- **Actions** — `+ Add Transaction` + `OverflowMenu (⋯)`

Implementation: keep the existing flex row; use `gap: var(--space-lg)` between Filtering↔View
and `gap: var(--space-md)` between View↔Actions to establish visual grouping through
whitespace alone (Stripe/Linear/Notion/Monarch style). Increase the Add↔⋯ gap from
`--space-sm` to `--space-md` (req #7). Mobile/tablet wrapping behavior unchanged.

## 2. Adjust Search field width (req #2)
`.toolbar-search` `max-width: 320px → 270px` (balanced ~260–280px range). Mobile stays
`max-width: 100%`. Placeholder "Search transactions..." feels more balanced without dominating
the toolbar.

## 3. Remove redundant transaction count (req #3)
Delete the `.list-header` / `.list-caption` block ("showing X…") and its CSS. Count already
lives in the page subtitle via `contextSubline` (`August 2026 · N transactions`) — no logic
change needed; `showingCount`/`totalCount` for the caption become unused and are removed.

## 4. Improve day group headers (req #4)
In `TransactionList.svelte` `dateHeader` snippet, compact to single-line layout:
- Left: `date-label` (weekday, month day) + `·` + `date-count` ("4 Transactions", muted,
  smaller) — inline, de-emphasized count. Example: "Thursday, July 30 · 4 Transactions"
- Right: `day-subtotal` promoted to the primary/dominant element — larger (`--font-size-base`,
  weight 800), teal/coral by sign. Full word "Transactions" instead of "items".

## 5. Category icons replace letter avatars (req #5)
Replace `categoryInitial()` letter in `.cat-circle` with a meaningful inline Lucide-style
SVG per category. Add a `categoryIconKey(name)` mapping fn + a `catIcon(key)` snippet
(inline `{#if}` chain) in `TransactionList.svelte`. Keyword match on `category_name`
(case-insensitive) → keys: salary, freelance, income, food, transport, shopping,
entertainment, bills, health, education, investment, default (wallet). Circle keeps the
category color tint background; icon uses category color as stroke. No data-model change.

## 6. Amount vs balance hierarchy (req #6)
In `TransactionList.svelte`: amount stays primary (unchanged weight/size). Lower balance
emphasis — `.balance-value` opacity/muted tone, drop the "bal" mini-label to a lighter
treatment so the running balance clearly reads as supporting info.

## 7. Spacing around actions (req #7)
Covered in #1 — Add↔⋯ gap widened.

## 8. Compact KPI cards (req #8)
`TransactionSummary.svelte`: target `min-height: 84–88px` (currently 88px, evaluate if further
reduction makes sense while preserving readability); card `padding` may reduce slightly if
needed; icon `36 → 32px`; **keep value/label sizes for readability**. Goal: improve
information density without sacrificing legibility. Tablet 2+1 and mobile 1-col layouts
preserved.

## 9. Refine Search input (req #9)
`.toolbar-search` increase left inset: gap between icon and input from `--space-sm → 10px`
and bump left padding so the placeholder feels balanced.

## 10. Page title hierarchy (req #10)
`PageHeader.svelte` `.page-title-group` `gap: 2px → 6px` — strengthens title↔subtitle
separation. Small, safe, improves every page consistently.

## 11. Search behavior specification (req #6)
**Server-side search** with **300ms debounce** (already implemented in existing code):
- `searchInput` state bound to `<input type="search">`
- `$effect` with 300ms `setTimeout` writes to `filters.search` only after idle
- `filters.search` flows through existing URL-sync `$effect` → `goto('/transactions?search=…')`
  → server `+page.server.ts` load function
- Backend: `ILIKE %term%` match against `t.description` and `c.name` (category join already
  present) — applies to both COUNT and SELECT queries
- CSV export respects active search via `/api/transactions/export`

## 12. Overflow menu contents specification (req #5)
`OverflowMenu.svelte` (already implemented) structure:
```
Import
  • Import CSV (working, opens SlideOver wizard)
  • Import Excel (Soon tag, coming-soon toast)
  • Import Bank Statement (Soon tag, coming-soon toast)
─────
Export
  • Export CSV (working, window.location.href)
  • Export Excel (Soon tag, coming-soon toast)
  • Export PDF (working, fetch JSON + generateTransactionPdf)
```
Menu remains organized as actions scale — all secondary import/export flows stay in ⋯, keeping
the header clean with only **+ Add Transaction** as the primary action.

## 13. Empty states refinement (req #7)
`EmptyState.svelte` already supports both scenarios; wire them in `+page.svelte`:

**No transactions at all** (no filters active, `data.total === 0`, no search):
- Icon: `💰`
- Title: **"No transactions yet"**
- Description: "Start by adding your first transaction or importing a CSV."
- Primary action: **Add Transaction** (`href="/transactions/new"`)
- Secondary action: **Import CSV** (`onSecondaryAction` → opens import wizard)

**No results** (filters or search active, `transactions.length === 0`):
- Icon: `🔍`
- Title: **"No results"**
- Description: "No transactions match your search or filters."
- Primary action: **Clear All Filters** (calls `clearAllFilters()`)
- No secondary action

Pass `emptyState` snippet to `TransactionList` when appropriate; component already supports it.

## 14 & 15. Preserve responsive + architecture
No changes to breakpoints, interaction model, routing, server, or data flow. Mobile full-width
Add, filters sheet, card rows, overflow all untouched.

## Verification (`npm run dev`)
- Desktop: three visual toolbar zones; narrower search with balanced icon padding; no
  "showing X" caption; day headers show big subtotal + muted count; category icons per row;
  balance clearly secondary to amount; roomier Add↔⋯; shorter KPI cards.
- Tablet: toolbar wraps cleanly (dividers collapse); 2+1 cards.
- Mobile: unchanged — full-width Add, filters sheet, card rows, ⋮ menu.
- Dark mode + reduced-motion clean; Dashboard's shared `TransactionList`/`PageHeader`
  unaffected.

# Dashboard Redesign — Engineering-First Implementation Plan

## Core Principles

| Principle | Application |
|-----------|-------------|
| **No new components** | Extend existing ones; preserve public APIs |
| **Reuse over replace** | Leverage `flip7-card`, `Sparkline`, `PageBackground`, design tokens |
| **Single source of truth** | One card pattern (`.flip7-card`), one spacing system (8pt), one animation library |
| **Maintainability first** | Minimal diff, clear separation of concerns, no parallel implementations |
| **Scalability** | Changes should compose — future features add to, not rewrite, the pattern |

---

## Visual Hierarchy (Target State)

```
TIER 1 — HERO (single focal point)
┌─────────────────────────────────────────────────────────────────────────────┐
│ Net Balance (large animated) + Savings Rate + 3 Key Deltas (Income/Exp/Net) │
│ ─────────────────────────────────────────────────────────────────────────── │
│ Lending Footer: Lent ₱X · Recovered ₱Y · Owe ₱Z (compact, semantic colors)  │
└─────────────────────────────────────────────────────────────────────────────┘
        ↓ space-xl (24px)
TIER 2 — INSIGHTS (equal height, side by side, actionable intelligence)
┌──────────────────────────────────┬─────────────────────────────────────────┐
│ Available to Spend               │ Forecast / Month Projection             │
│ Large value + progress meter     │ Projected balance + trend + confidence  │
│ (fluid meter below label)        │ (integrated chip, not cramped)          │
└──────────────────────────────────┴─────────────────────────────────────────┘
        ↓ space-xl (24px)
TIER 3 — ANALYTICS (Cash Flow full-width, Category tall)
┌─────────────────────────────────────────────────────────────────────────────┐
│ Cash Flow Chart (full width, integrated legend, aspect-ratio 16:9)          │
└─────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────┐
│ Category Breakdown (tall card: donut top, ranked list below, scrollable)    │
└─────────────────────────────────────────────────────────────────────────────┘
        ↓ space-lg (16px)
TIER 4 — RECENT ACTIVITY (compact, 5 rows max, above analytics on mobile)
┌─────────────────────────────────────────────────────────────────────────────┐
│ Recent Activity (dense, scannable, "View All" → /transactions)              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## File-by-File Changes

### 1. `src/routes/dashboard/+page.svelte` — **Page Restructure Only**

**Changes:**
- Reorder sections: Hero → Insights → Activity → Charts (Activity moves above Charts on mobile)
- Update CSS grid: Insights = 2-col equal-height; Charts = Cash Flow full-width + Category tall
- Remove forced `min-height: 360px`; use aspect-ratio on chart containers
- Enforce 8pt rhythm: `space-xl` between sections, `space-md` between cards
- Add `aspect-ratio` utility for chart cards

**No new imports.** Same components, new composition.

---

### 2. `src/lib/components/DashboardHero.svelte` — **Refactor In Place**

**API preserved:** Same props (`balance`, `totalIncome`, `totalExpenses`, `savingsRate`, `lendingSummary`, `incomeChange`, `expenseChange`, `incomeTrend`, `incomeLabels`, `expenseTrend`, `expenseLabels`)

**Template changes:**
- Remove `hero-mini-kpis` (Income/Expense sparklines) — redundant with KpiRail
- Remove `hero-lending-inline` 4-item row → replace with single compact footer
- New layout: 2-column grid (primary | secondary metrics)
  - Primary: Net Balance (large) + Savings Rate
  - Secondary: 3 delta chips (Income Δ, Expense Δ, Net Δ) — semantic colors
- Footer: `Lent ₱X • Recovered ₱Y • Owe ₱Z` — single line, `•` dividers, semantic colors

**CSS changes:**
- `hero-main-row`: `grid-template-columns: 1fr auto` (fluid secondary)
- `hero-value`: `clamp(40px, 7vw, 72px)` (unchanged)
- Delta chips: `inline-flex`, `gap: space-sm`, `padding: space-xs space-sm`, `radius-pill`, semantic bg/text
- Footer: `border-top: hairline`, `padding-top: space-xs`, `font-size: space-sm`, `flex-wrap`, `gap: space-sm`
- Remove `mini-kpi` styles entirely
- Responsive: ≤768px stacks to single column; ≤480px tighter padding

---

### 3. `src/lib/components/KpiRail.svelte` — **Hierarchy Refactor**

**API preserved:** Same props

**Template changes:**
- Split into 2 primary + 2 compact cards via derived `cardTier` property
- Primary (Income, Expense): `xl` value + sparkline + trend badge
- Compact (Lent Out, Owe): `lg` value + subtitle (`Recovered ₱X` / `Repaid ₱Y`), no sparkline
- Mobile scroll rail: primary cards snap first (`scroll-snap-align: start`)

**CSS changes:**
- `.kpi-card.primary`: `padding: space-md space-lg`, `gap: space-xs`, sparkline visible
- `.kpi-card.compact`: `padding: space-sm space-md`, `min-width: 140px`, no sparkline
- Shared: `flip7-card` base, semantic accent bar, hover lift
- Grid: `repeat(4, minmax(180px, 1fr))` desktop; `repeat(2, 1fr)` tablet; scroll rail mobile

---

### 4. `src/lib/components/SafeToSpendWidget.svelte` — **Insight Card Pattern**

**API preserved:** Same props

**Template changes:**
- Meter moves **below label** (not beside) — fluid width, scales with card
- Value + label left; meter full-width below
- CTA button: `[View Budget]` → `/budgets` (if exists) or `/transactions`

**CSS changes:**
- `.stsw-card`: `flex-direction: column`, `align-items: stretch`, `gap: space-sm`
- `.stsw-left`: `justify-content: space-between` (label | value)
- `.stsw-meter`: `width: 100%`, `align-items: stretch`
- `.stsw-track`: `width: 100%`
- Hover: lift + glow (shared `.flip7-card` behavior)
- Dark mode: inherited via `flip7-card` tokens

---

### 5. `src/lib/components/ForecastBanner.svelte` — **Insight Card Pattern**

**API preserved:** Same props

**Template changes:**
- Large projected value (display font) + trend indicator + confidence chip
- Layout: icon | projected value + trend | chip (right-aligned)
- Chip: `surplus`/`deficit`/`on track` — semantic colors, `radius-pill`

**CSS changes:**
- `.forecast-card`: `flex-direction: column` on desktop too (taller card)
- `.forecast-projected`: `font-size: 2xl`, `font-weight: 800`, semantic color
- `.forecast-trend`: inline flex, icon + label, semantic color
- `.forecast-chip`: `align-self: flex-end`, `margin-top: auto`
- Equal height with SafeToSpend via `align-items: stretch` on parent grid

---

### 6. `src/lib/components/CashFlowChart.svelte` — **Full-Width + Integrated Legend**

**API preserved:** Same props

**Template changes:**
- Legend moves **into chart header** (inline with title)
- Legend items: color dot + label + avg value (mono, tabular-nums)
- Chart container: `aspect-ratio: 16 / 9` (no fixed height)
- Tooltip + legend sync: hover point → highlight legend item (CSS `:has()` or JS)

**CSS changes:**
- `.cf-outer`: `aspect-ratio: 16 / 9`, `width: 100%`
- `.cf-legend`: `display: flex`, `gap: space-md`, `flex-wrap: wrap`, `justify-content: center`
- `.cf-chart-wrap`: `width: 100%`, `height: 100%`
- Remove forced `height: 360px` / `min-height` overrides
- Mobile: `aspect-ratio: 4 / 3`

---

### 7. `src/lib/components/CategoryBreakdownWidget.svelte` — **Tall Card Layout**

**API preserved:** Same props

**Template changes:**
- Desktop (≥769px): 2-row layout (donut top, list below)
- Donut: larger (`max-width: 280px`), centered
- List: full-width, scrollable (`max-height: 320px`), tiered rank styling
- Rank 1/2/3: gold/silver/coral left bars + bold amounts

**CSS changes:**
- `.cb-grid`: `grid-template-rows: auto 1fr` (donut | list), `gap: space-md`
- `.donut-section`: `display: flex`, `justify-content: center`, `min-height: 220px`
- `.category-list`: `overflow-y: auto`, `max-height: 320px`, `padding-right: space-xs`
- `.category-row.rank-gold/silver/coral`: left border + bg tint + bold amount
- Mobile: single column, donut smaller (`180px`), list compressed

---

### 8. `src/lib/components/RecentActivityWidget.svelte` — **Compact Mode**

**API preserved:** Same props

**Template changes:**
- Max 5 rows (configurable via prop if needed)
- Denser row padding: `space-sm` → `space-xs`
- Remove `min-height: 68px`; let content dictate height
- "View All" button: always visible, right-aligned in header

**CSS changes:**
- `.ra-row`: `padding: space-xs space-md`, `gap: space-sm`, no min-height
- `.ra-avatar`: `32px` (was 40px)
- `.ra-empty-cta`: full-width on mobile
- Hover: subtle bg tint (no lift — too dense for list)

---

## Shared CSS Patterns (No New Abstractions)

### 1. Card Base (`.flip7-card` — already exists)
```css
.flip7-card {
  background: var(--color-surface);
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-card);
  transition: transform 200ms var(--bounce), box-shadow 200ms var(--ease);
}
@media (pointer: fine) {
  .flip7-card:hover { transform: translateY(-2px); box-shadow: var(--glow-card); }
}
```

### 2. Semantic Accent Bar (`.accent-*` — already exists)
```css
.accent-teal  .kpi-accent { background: var(--color-teal); }
.accent-coral .kpi-accent { background: var(--color-coral); }
.accent-gold  .kpi-accent { background: var(--color-gold); }
.accent-sky   .kpi-accent { background: var(--color-sky); }
```

### 3. Insight Card Layout (applied to SafeToSpend + Forecast via CSS)
```css
.insight-card {
  display: flex;
  flex-direction: column;
  height: 100%;                    /* equal height in grid */
  padding: var(--space-lg);
  gap: var(--space-sm);
}
.insight-card .card-header { display: flex; align-items: baseline; gap: var(--space-sm); }
.insight-card .card-value  { font-size: var(--font-size-2xl); font-weight: 800; }
.insight-card .card-meter  { width: 100%; margin-top: auto; }
```

### 3. Aspect Ratio Utility (for charts)
```css
.aspect-16-9 { aspect-ratio: 16 / 9; }
.aspect-4-3  { aspect-ratio: 4 / 3; }
.aspect-3-4  { aspect-ratio: 3 / 4; }
```

### 4. Stagger Animation (page-level, no new keys)
```css
.dashboard-section:nth-child(1) { animation: fadeSlideUp 400ms var(--ease) 0ms both; }
.dashboard-section:nth-child(2) { animation: fadeSlideUp 400ms var(--ease) 80ms both; }
.dashboard-section:nth-child(3) { animation: fadeSlideUp 400ms var(--ease) 160ms both; }
.dashboard-section:nth-child(4) { animation: fadeSlideUp 400ms var(--ease) 240ms both; }
@keyframes fadeSlideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
```

---

## Responsive Breakpoints (Consolidated)

| Breakpoint | Hero | Insights | Activity | Charts | KPI Rail |
|------------|------|----------|----------|--------|----------|
| ≥1025px | 2-col grid | 2-col equal | 5 rows | CF full, Cat tall | 4-col |
| 769–1024px | Stacked | Stacked | 5 rows | Stacked | 2-col |
| 481–768px | Stacked, tight | Stacked | 4 rows | Stacked | Scroll rail |
| ≤480px | Minimal | Full-width | 3 rows + View All | Stacked | Scroll rail |

**Mobile order:** Hero → Insights → **Activity** → Charts → KPI Rail (Activity above Charts)

---

## Dark Mode & Accessibility

- **Zero new tokens** — all colors via existing semantic tokens
- **Focus states**: `outline: 2px solid var(--color-teal); outline-offset: 2px`
- **Reduced motion**: `@media (prefers-reduced-motion: reduce)` disables all transitions/animations
- **Contrast**: Semantic colors meet WCAG AA on both surfaces
- **ARIA**: `role="region" aria-label="Cash Flow Trend"` on charts; `aria-live="polite"` on animated values

---

## Implementation Order (Minimal Risk)

| Step | Files | Risk |
|------|-------|------|
| 1 | `+page.svelte` (structure + CSS) | Low — layout only |
| 2 | `DashboardHero.svelte` (remove mini-KPIs, add deltas/footer) | Low — template swap |
| 3 | `KpiRail.svelte` (primary/compact split) | Low — derived prop change |
| 4 | `SafeToSpendWidget.svelte` (meter below label) | Low — flex-direction change |
| 5 | `ForecastBanner.svelte` (projected value + chip) | Low — template restructure |
| 6 | `CashFlowChart.svelte` (aspect-ratio + legend) | Medium — canvas sizing |
| 7 | `CategoryBreakdownWidget.svelte` (tall layout) | Medium — grid template |
| 8 | `RecentActivityWidget.svelte` (compact rows) | Low — padding/height |
| 9 | Stagger animations + polish | Low — CSS only |

---

## Success Criteria

- [ ] One dominant hero (Net Balance) — no competing cards above the fold
- [ ] Two insight cards equal height, actionable (Available + Forecast)
- [ ] Cash Flow full-width, integrated legend, aspect-ratio maintained
- [ ] Category tall card (donut + scrollable list)
- [ ] Activity compact, 5 rows max, above Charts on mobile
- [ ] KPI Rail: 2 primary + 2 compact, no redundancy with hero
- [ ] 8pt spacing rhythm throughout (`space-xl` sections, `space-md` cards)
- [ ] Single card pattern (`.flip7-card`), single accent system (`.accent-*`)
- [ ] Dark mode works without custom overrides
- [ ] Build passes, no new components, all APIs preserved
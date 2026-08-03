# Dashboard Page Redesign — Flip7 Design System

## Executive Summary

Redesign the `/dashboard` route to create a cohesive, premium financial command center that follows the Flip7 Design System. The current page is a vertical stack of disparate widgets with inconsistent visual language. The redesign unifies them into a structured hierarchy: **Hero → KPI Rail → Insights → Activity**, with consistent card grammar, spacing rhythm, and dark-mode parity.

---

## Current State Analysis

### Widgets on Dashboard (in order)
| Widget | Current Visual Language | Issues |
|--------|------------------------|--------|
| `HeroBalanceWidget` | **The Vault** — white surface, texture, sheen, pool, glow, watermark. Distinct, premium, over-designed for a list page. | Over-engineered hero; competes with other widgets; doesn't share grammar with other cards. |
| `MobileSummaryRail` | Horizontal scroll rail of KPI cards (teal/coral/gold/sky left bars). | Only visible ≤640px. Desktop has no equivalent. |
| `NetWorthHero` (compact) | White card, teal hairline border, tipping bar, rank legends. | Good Flip7 citizen but feels disconnected from hero. |
| `SafeToSpendWidget` | Cream background, left ribbon (teal→gold), progress meter. | **Only cream widget** on page. Ribbon ≠ left bar grammar. |
| `ForecastBanner` | White card, sky/coral left border, chip. | Good Flip7 card but isolated. |
| `CashFlowChart` | Custom legend, cream tooltip, Chart.js. | Chart container lacks card wrapper. |
| `CategoryBreakdownWidget` | Grid: donut + podium list. Gold/silver/coral rank bars. | Strong Flip7 podium but heavy; donut + list = 2-column grid. |
| `RecentActivityWidget` | White card, teal dashed dividers, coral left bar for expenses. | Best Flip7 citizen — consistent, clean, interactive. |

### System Violations
1. **Three different "hero" patterns**: Vault, SafeToSpend (cream+ribbon), NetWorth (card+tipping)
2. **Inconsistent accent grammar**: Top ribbons (Vault, SafeToSpend), left bars (Rail, Forecast, Activity), tipping bar (NetWorth)
3. **Cream background only on SafeToSpend** — breaks surface consistency
4. **No desktop KPI rail** — mobile rail exists but desktop has no summary row
5. **Spacing rhythm broken**: `margin-bottom: var(--space-lg)` everywhere, no 8-pt vertical scale
6. **Chart containers**: CashFlow uses bare `div`, Category uses grid — no shared card wrapper

---

## Design Principles (Flip7)

| Principle | Application |
|-----------|-------------|
| **Surface = White** | All widgets on `var(--color-surface)` (`#FFFFFF` light / `#161A18` dark) |
| **Accent = Left Bar** | 4–5px left border = semantic color (teal=income, coral=expense, gold=net/lending, sky=borrowed) |
| **Card = `.flip7-card`** | Shared base: surface, hairline border, `radius-xl`, shadow, hover lift, dark `::before` glow |
| **Typography Hierarchy** | `display` font for values, `mono` for numbers, `body` for labels |
| **8-pt Vertical Rhythm** | Section gaps: `space-lg` (16px), card gaps: `space-md` (12px), inner padding: `space-md` |
| **Dark Mode = Inherited** | Zero custom dark tokens — use `.flip7-card` + semantic tokens |

---

## Redesign Architecture

### New Section Structure (Top → Bottom)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. HERO SECTION (single card, full-width)                   │
│    ┌─────────────────────────────────────────────────────┐  │
│    │  Net Balance (large)  |  Income / Expenses (mini)   │  │
│    │  [Animated]           |  Sparklines + deltas        │  │
│    │  Top ribbon: teal→gold (brand, not semantic)        │  │
│    └─────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│ 2. KPI RAIL (desktop: 4-card grid; mobile: scroll rail)    │
│    ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│    │ Income   │ │ Expenses │ │ Lent Out │ │ Owe      │     │
│    │ teal bar │ │ coral bar│ │ gold bar │ │ sky bar  │     │
│    │ + spark  │ │ + spark  │ │ + badge  │ │ + badge  │     │
│    └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
├─────────────────────────────────────────────────────────────┤
│ 3. INSIGHTS ROW (2 cards side-by-side on desktop)          │
│    ┌──────────────────────┐ ┌──────────────────────────┐   │
│    │ Safe to Spend        │ │ Forecast                 │   │
│    │ (gold bar)           │ │ (sky/coral bar)          │   │
│    │ Progress meter       │ │ Projected balance        │   │
│    └──────────────────────┘ └──────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│ 4. CHARTS ROW (2 cards)                                     │
│    ┌──────────────────────┐ ┌──────────────────────────┐   │
│    │ Cash Flow Chart      │ │ Category Breakdown       │   │
│    │ (teal/coral lines)   │ │ (donut + podium)         │   │
│    │ In card wrapper      │ │ In card wrapper          │   │
│    └──────────────────────┘ └──────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│ 5. RECENT ACTIVITY (full-width card)                        │
│    ┌─────────────────────────────────────────────────────┐  │
│    │ Recent Activity                                    │  │
│    │ [Feed rows with coral left bar for expenses]       │  │
│    └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Component-Level Changes

### 1. Hero Section — **New Composite Component**
**File:** `src/lib/components/DashboardHero.svelte` (new)

Replaces `HeroBalanceWidget` + `MobileSummaryRail` (desktop gap).

**Structure:**
```svelte
<div class="dash-hero flip7-card accent-gold">  <!-- gold = net worth -->
  <div class="hero-ribbon"></div>              <!-- teal→gold brand ribbon -->
  
  <div class="hero-main">
    <div class="hero-primary">
      <span class="hero-label">Net Balance</span>
      <span class="hero-value animated">+₱127,500</span>
      <span class="hero-savings">Savings rate: 23%</span>
    </div>
    <div class="hero-mini-kpis">
      <MiniKPI label="Income" value="+₱45,000" trend="+12%" tone="teal" sparkline={...} />
      <MiniKPI label="Expenses" value="−₱22,500" trend="−8%" tone="coral" sparkline={...} />
    </div>
  </div>
  
  <div class="hero-lending-inline">
    <span>Lent: ₱15,000 • Recovered: ₱8,000</span>
    <span>Borrowed: ₱5,000 • Repaid: ₱3,000</span>
  </div>
</div>
```

**Key decisions:**
- Single card replaces Vault + adds mini KPIs (income/expense with sparklines)
- Gold left bar (net worth semantic) + brand ribbon
- Lending inline (no separate card) — compact, scannable
- Mobile: stacks to primary → mini KPIs → lending line

---

### 2. KPI Rail — **Promote MobileSummaryRail to Desktop**
**File:** `src/lib/components/MobileSummaryRail.svelte` → **Rename to** `KpiRail.svelte`

**Changes:**
- Display on **all viewports** (not just ≤640px)
- Desktop: 4-column grid (`grid-template-columns: repeat(4, 1fr)`)
- Tablet (769–1024px): 2-column grid
- Mobile (≤768px): horizontal scroll rail (existing behavior)
- Each card: `.flip7-card` base + semantic left bar + optional sparkline

---

### 3. Insights Row — SafeToSpend + Forecast as Cards
**Files:** `SafeToSpendWidget.svelte`, `ForecastBanner.svelte`

**Unified card wrapper:**
```svelte
<div class="insight-card flip7-card accent-gold">  <!-- SafeToSpend -->
<div class="insight-card flip7-card accent-sky">   <!-- Forecast (positive) -->
<div class="insight-card flip7-card accent-coral"> <!-- Forecast (negative) -->
```

**SafeToSpend changes:**
- Remove cream background → `var(--color-surface)`
- Remove left ribbon → gold left bar (semantic: "available to spend")
- Keep progress meter, refine typography
- Desktop: full-width card in insights row

**Forecast changes:**
- Keep left border (sky/coral) → becomes left bar via `.flip7-card`
- Remove sky/coral border-left override; use accent modifier
- Keep chip, refine spacing

---

### 4. Charts Row — Card Wrappers for Both
**Files:** `CashFlowChart.svelte`, `CategoryBreakdownWidget.svelte`

**Shared `.chart-card` wrapper:**
```css
.chart-card {
  @extend .flip7-card;          /* surface, border, radius, shadow, hover */
  padding: var(--space-lg);
  min-height: 360px;            /* desktop */
}
```

**CashFlowChart:**
- Wrap in `.chart-card`
- Legend moves inside card header
- Remove forced mobile height overrides — let card size naturally

**CategoryBreakdownWidget:**
- Wrap in `.chart-card`
- Grid (donut | list) inside card
- Mobile: stack donut over list inside card

---

### 5. NetWorthHero (Compact) — **Remove from Dashboard**
The new Hero Section includes net balance + mini KPIs. The compact NetWorth teaser is redundant. Keep only on `/net-worth` route.

---

### 6. RecentActivityWidget — **Minor Polish**
Already the best Flip7 citizen. Keep as-is, ensure it uses `.flip7-card` base class for dark mode parity.

---

## Spacing System (8-pt Scale)

| Level | Token | Value | Usage |
|-------|-------|-------|-------|
| Page section gap | `--space-xl` | 24px | Between Hero / KPI Rail / Insights / Charts / Activity |
| Card gap (grid) | `--space-md` | 12px | Between cards in KPI Rail, Insights, Charts |
| Card inner padding | `--space-lg` | 16px | Default card padding |
| Card inner padding (compact) | `--space-md` | 12px | Mobile / dense cards |
| Inner element gap | `--space-sm` | 8px | Label → value, value → trend |
| Micro gap | `--space-xs` | 4px | Divider → content |

---

## Responsive Breakpoints

| Viewport | Hero | KPI Rail | Insights | Charts | Activity |
|----------|------|----------|----------|--------|----------|
| ≥1025px | 2-col (primary \| mini) | 4-col grid | 2-col grid | 2-col grid | Full |
| 769–1024px | Stacked | 2-col grid | 2-col grid | 2-col grid | Full |
| 481–768px | Stacked | Scroll rail | Stacked | Stacked | Full |
| ≤480px | Stacked (tighter) | Scroll rail | Stacked | Stacked | Full |

---

## Dark Mode Strategy

**Zero new tokens.** All cards use `.flip7-card` which provides:
- Light: `var(--color-surface)` + hairline border + teal shadow
- Dark: `#161A18` + hairline white border + `::before` glowing left edge (teal)
- Accent modifiers (`.accent-teal`, `.accent-coral`, `.accent-gold`, `.accent-sky`) work in both themes via `::before` color

**Chart colors:** Already use `isDark` detection → `var(--color-teal)` / `var(--color-coral)` etc. (semantic tokens)

---

## File Changes Summary

| File | Action |
|------|--------|
| `src/routes/dashboard/+page.svelte` | **Rewrite** — new section structure, import new components |
| `src/lib/components/DashboardHero.svelte` | **Create** — new composite hero |
| `src/lib/components/KpiRail.svelte` | **Create** — renamed from MobileSummaryRail, desktop-enabled |
| `src/lib/components/SafeToSpendWidget.svelte` | **Refactor** — surface, left bar, remove ribbon/cream |
| `src/lib/components/ForecastBanner.svelte` | **Refactor** — `.flip7-card` base, accent modifier |
| `src/lib/components/CashFlowChart.svelte` | **Refactor** — wrap in `.chart-card` |
| `src/lib/components/CategoryBreakdownWidget.svelte` | **Refactor** — wrap in `.chart-card` |
| `src/lib/components/RecentActivityWidget.svelte` | **Polish** — ensure `.flip7-card` base |
| `src/lib/components/NetWorthHero.svelte` | **No change** — remove from dashboard only |

---

## Implementation Order

1. **Create `DashboardHero.svelte`** — new hero with mini KPIs + lending inline
2. **Create `KpiRail.svelte`** — from MobileSummaryRail, desktop grid + mobile rail
3. **Refactor `SafeToSpendWidget`** — white surface, gold left bar, no ribbon
4. **Refactor `ForecastBanner`** — `.flip7-card` + accent-sky/coral
5. **Wrap `CashFlowChart`** in `.chart-card` (page-level wrapper or component)
6. **Wrap `CategoryBreakdownWidget`** in `.chart-card`
7. **Update `+page.svelte`** — new imports, section structure, spacing tokens
8. **Verify dark mode** — all cards inherit `.flip7-card` dark styles
9. **Test responsive** — all breakpoints, reduced motion

---

## Success Criteria

- [ ] Single visual language: all widgets = `.flip7-card` + semantic left bar
- [ ] No cream backgrounds, no top ribbons (except hero brand ribbon)
- [ ] Desktop KPI rail visible (4 cards: Income, Expenses, Lent, Owe)
- [ ] 8-pt vertical rhythm maintained throughout
- [ ] Dark mode works without custom overrides
- [ ] Reduced motion respected everywhere
- [ ] Hero remains premium anchor (large animated value, brand ribbon)
- [ ] Mobile experience: stacked, scrollable rail, compact cards
- [ ] No forced `!important` mobile overrides
- [ ] Page loads without layout shift (skeleton states where needed)
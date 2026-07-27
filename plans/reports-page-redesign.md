# Reports Page Redesign — Senior UI/UX Proposal

> **Inspiration:** Copilot Money (narrative, insight-driven) × Ramp (ultra-clean data presentation)
> **Status:** Design proposal — awaiting approval before implementation

---

## Task 1: The Insights Header

### Current Problem

The page starts with SummaryCards (4 data-dense cards) and dumps into charts immediately — no framing, no narrative.

### New Approach — Insight Cards

Before any chart, show 2-3 natural-language insights that answer "what should I notice?"

```
┌──────────────────────────────────────────────────────────────┐
│  Reports                                                    │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────┐ │
│  │ 📈 Spending is   │  │ 💰 You saved     │  │ 📊 Net     │ │
│  │    up 12% this   │  │    ₱3,200 more   │  │    worth   │ │
│  │    month         │  │    than last      │  │    grew    │ │
│  │                  │  │    month          │  │    8%      │ │
│  │  vs last month   │  │  🟢 ₱18,400 →    │  │ ━━━━      │ │
│  │  🔴 ₱45k → 51k  │  │      ₱21,600     │  │  📈 📈     │ │
│  └──────────────────┘  └──────────────────┘  └────────────┘ │
│                                                              │
│  ┌ 1W ─ 1M ─ 3M ─ YTD ─ 1Y ─ All ──────────────────────┐  │
│  │                                                    │  │  │
│  │        ![Monthly chart — no gridlines]              │  │  │
│  │                                                    │  │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Insight Card Spec

| Element | Treatment |
|---------|-----------|
| **Trend arrow** | Small colored arrow (🟢 up / 🔴 down) — fast visual scan |
| **Headline** | Bold 16px `"Spending is up 12%"` |
| **Context** | Muted 13px `"vs last month · ₱45k → ₱51k"` |
| **Card bg** | `var(--color-surface)`, border, 12px radius |
| **Width** | Flex: 3 cards, `min-width: 200px`, wrap on mobile |

### Insight Generation Logic (pseudo)

```ts
const insights = $derived(() => {
  const curr = currentMonthData;
  const prev = previousMonthData;
  const ins: Insight[] = [];

  // Spending change
  if (curr.expense !== prev.expense) {
    const pct = ((curr.expense - prev.expense) / prev.expense * 100).toFixed(0);
    ins.push({
      direction: curr.expense > prev.expense ? 'up' : 'down',
      headline: `Spending is ${curr.expense > prev.expense ? 'up' : 'down'} ${Math.abs(pct)}%`,
      context: `vs last month · ${formatCurrency(prev.expense)} → ${formatCurrency(curr.expense)}`,
    });
  }

  // Savings change
  const currSavings = curr.income - curr.expense;
  const prevSavings = prev.income - prev.expense;
  if (currSavings !== prevSavings) {
    // ...
  }

  // Top spending category
  const top = topExpenseCategory();
  ins.push({
    headline: `Most spent on ${top.name}`,
    context: `${formatCurrency(top.total)} · ${top.pct}% of expenses`,
  });

  return ins.slice(0, 3);
});
```

---

## Task 2: Timeframe & Tab Navigation

### Segmented Pill Control — Timeframe

Replace the year/month dropdowns with a clean segmented pill:

```
┌────────────────────────────────────────────────────────┐
│  Reports                                                │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  1W  │  1M  │  3M  │  YTD  │  1Y  │  All  │  🗓  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  📈 Cash Flow  │  💰 Income  │  💸 Expenses  │  │  │
│  │                     ┌ ─ ─ ─ ─ ┐                  │  │
│  │                     │  Chart   │                  │  │
│  │                     └ ─ ─ ─ ─ ┘                  │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### Timeframe Pill Spec

```css
.timeframe-pill {
  background: var(--color-bg);
  padding: 4px;
  border-radius: 999px;
  display: inline-flex;
  gap: 2px;
  border: 1px solid var(--color-border);
}

.timeframe-btn {
  padding: 8px 18px;
  border-radius: 999px;
  border: none;
  background: transparent;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  color: var(--color-text-secondary);
  cursor: pointer;
  min-height: 36px;
  transition: all 120ms ease;
}

.timeframe-btn.active {
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}
```

A **calendar icon button** (🗓) at the end opens a small date-range picker for custom periods.

On selection: `goto('/reports?period=1M&year=2026')` — smooth URL update, no page reload.

### Section Tabs (Cash Flow / Income / Expenses)

Instead of a tab bar that hides/shows content with a flash, use a **pill group** that **switches the main view area** with a cross-fade:

```css
.view-fade-enter {
  animation: fadeSlideIn 300ms ease-out;
}
@keyframes fadeSlideIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

Each view (Cash Flow, Income, Expenses) is a self-contained section that swaps out. Lending gets its own page or is a sub-tab under Expenses.

The active tab is persisted in the URL: `/reports?tab=income&period=1M`

---

## Task 3: Chart Aesthetics & Data Tables

### Premium Chart Rules (Copilot Money × Ramp)

```css
/* ─── No gridlines — only a subtle baseline ─── */
chart.options.scales.x.grid.display = false;
chart.options.scales.y.grid.display = false;
chart.options.scales.y.ticks.display = true; // only Y labels, no lines

/* ─── Gradient fill under the line ─── */
const gradient = ctx.createLinearGradient(0, 0, 0, height);
gradient.addColorStop(0, 'rgba(99, 102, 241, 0.15)');
gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
// Use as backgroundColor on line datasets

/* ─── Custom tooltip — dark, rounded, no caret ─── */
chart.options.plugins.tooltip = {
  backgroundColor: 'rgba(0,0,0,0.85)',
  titleColor: '#fff',
  bodyColor: 'rgba(255,255,255,0.8)',
  padding: 12,
  cornerRadius: 8,
  displayColors: false,
  boxPadding: 6,
};

/* ─── Bar chart — flat, rounded top only ─── */
chart.options.elements.bar.borderRadius = 4;
chart.options.elements.bar.borderSkipped = 'bottom'; // round only top corners

/* ─── No legend (use the supporting table instead) ─── */
chart.options.plugins.legend.display = false;
```

### Visual Spec — Monthly Trend (Cash Flow View)

```
  ┌─ Premium Chart ──────────────────────────────────────────┐
  │                                                           │
  │  Income    ━━━━━━━━  ₱52,000   ▲ +8% vs last month      │
  │  Expense   ━━━━━━━━  ₱38,000   ▲ +12% vs last month     │
  │  Net       ━━━━━━━━  ₱14,000   ◀ +3% vs last month      │
  │                                                           │
  │   ₱60k ┤                                                 │
  │         │      ╭──╮          ╭──╮                        │
  │   ₱40k ┤      │  │  ╭──╮   │  │  ╭──╮    ╭──╮         │
  │         │  ╭──╮│  │  │  │   │  │  │  │    │  │         │
  │   ₱20k ┤  │  ││  │  │  │   │  │  │  │╭──╮│  │         │
  │         │  │  ││  │  │  │   │  │  │  ││  ││  │         │
  │      0 ┼──╵──╵╵──╵──╵──╵───╵──╵──╵──╵╵──╵╵──╵──       │
  │         Jan  Feb Mar Apr May Jun Jul Aug Sep            │
  │                                                           │
  │  Legend:  🟦 Income  🟥 Expense  ─ Net line              │
  │                                                           │
  └───────────────────────────────────────────────────────────┘
```

### Supporting Data Table — Ultra-Clean

Below the chart, a data table with Ramp-inspired clarity:

```
  ┌─ Monthly Breakdown ─────────────────────────────────────┐
  │                                                          │
  │  Month         Income         Expense        Net         │
  │ ─────────────────────────────────────────────────────     │
  │  Jan 2026   ₱48,000       ₱35,000       ₱13,000   🟢   │
  │  Feb 2026   ₱45,200       ₱38,200       ₱7,000    🟡   │
  │  Mar 2026   ₱52,000       ₱32,000       ₱20,000   🟢   │
  │  Apr 2026   ₱49,800       ₱41,000       ₱8,800    🟡   │
  │  May 2026   ₱51,000       ₱38,000       ₱13,000   🟢   │
  │  Jun 2026   ₱52,000       ₱42,000       ₱10,000   🟢   │
  │  ...                                                      │
  │ ─────────────────────────────────────────────────────     │
  │  Total       ₱298,000      ₱226,200      ₱71,800        │
  │                                                          │
  └──────────────────────────────────────────────────────────┘
```

### Data Table CSS Rules

```css
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.data-table th {
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.data-table th.num {
  text-align: right;
}

.data-table td {
  padding: 10px 16px;
  border-bottom: 1px solid var(--color-border);
  transition: background 120ms ease;
}

/* Subtle hover — just a tint, no border flash */
.data-table tr:hover td {
  background: rgba(99, 102, 241, 0.03);
}

/* Row emphasis: first column uses medium weight */
.data-table td:first-child {
  font-weight: 500;
  color: var(--color-text);
}

/* Numeric columns right-aligned */
.data-table td.num {
  text-align: right;
  font-weight: 600;
}

/* Net column color-coded */
.data-table td.positive { color: var(--color-income); }
.data-table td.negative { color: var(--color-expense); }

/* Subtle divider before the total row */
.data-table tr.total td {
  border-top: 2px solid var(--color-border);
  font-weight: 700;
  background: transparent;
}
```

### Category Breakdown Table (Income / Expenses tabs)

Same clean table + a small donut/pie chart beside it:

```
┌─────────────────────┬──────────────────────────────────┐
│  Donut chart        │  Category       Amount      %   │
│                     │ ─────────────────────────────── │
│    ╭───╮           │  Salary     ₱40,000   76.9%    │
│   ╱     ╲          │  Freelance  ₱8,000    15.4%    │
│  │  🟦🟩  │         │  Rental     ₱4,000    7.7%     │
│   ╲     ╱          │                                 │
│    ╰───╯           │  Total      ₱52,000   100%      │
│                     │                                 │
└─────────────────────┴──────────────────────────────────┘
```

Left: donut chart (no legend — the table IS the legend), 160px diameter.
Right: breakdown table with color dots, amounts, and percentages.

---

## Layout Wireframe — Complete Page

```
┌────────────────────────────────────────────────────────────┐
│  Reports                                                    │
│                                                             │
│  ┌─Insight─┐  ┌─Insight─┐  ┌─Insight─┐                    │
│  │📈 +12%  │  │💰 +₱3.2k│  │🏆 Groc..│                    │
│  └─────────┘  └─────────┘  └─────────┘                    │
│                                                             │
│  ○ 1W ● 1M ○ 3M ○ YTD ○ 1Y ○ All    [Export CSV]          │
│                                                             │
│  ┌─ Pill Tabs ──────────────────────────────────────────┐  │
│  │  📈 Cash Flow  │  💰 Income  │  💸 Expenses          │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─ Main View Area ──────────────────────────────────────┐  │
│  │                                                       │  │
│  │  Income ₱52k   Expense ₱38k   Net ₱14k (summary)     │  │
│  │                                                       │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  [Premium chart — no gridlines, gradient fills] │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │                                                       │  │
│  │  ┌─ Monthly Breakdown ─────────────────────────────┐  │  │
│  │  │  Month      Income     Expense    Net     Trend │  │  │
│  │  │  Jan      ₱48,000    ₱35,000   ₱13,000   🟢   │  │  │
│  │  │  Feb      ₱45,200    ₱38,200   ₱7,000    🟡   │  │  │
│  │  │  ...                                           │  │  │
│  │  │  Total    ₱298,000   ₱226,200  ₱71,800        │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

// Income Tab variation
┌────────────────────────────────────────────────────────────┐
│  💰 Income                                                  │
│  ┌─────────────────────┬────────────────────────────────┐  │
│  │  Donut chart        │  Category       Amount     %   │  │
│  │    ╭───╮           │ ────────────────────────────── │  │
│  │   ╱     ╲          │  ● Salary    ₱40,000   76.9%  │  │
│  │  │  🟦🟩  │         │  ● Freelance ₱8,000    15.4%  │  │
│  │   ╲     ╱          │  ● Rental    ₱4,000    7.7%   │  │
│  │    ╰───╯           │                                 │  │
│  └─────────────────────┴────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘

// Expenses Tab variation — same structure as Income

---

## Implementation Roadmap

### Phase 1: Timeframe Pill + Insights
- Replace year/month selects with the segmented pill control (1W/1M/3M/YTD/1Y/All)
- Add custom date range via calendar button
- Update server `load` to accept `period` param
- Add insight generation logic (client-side $derived)
- Render insight cards above chart

### Phase 2: Chart Cleanup
- Update MonthlyChart: remove gridlines, add gradient fills, custom tooltip
- New: summary line above chart (Income / Expense / Net with trends)
- Update CategoryChart: add rounded bar caps, remove legend (table IS legend)

### Phase 3: Supporting Tables
- Replace the existing breakdown tables with the new Ramp-inspired design
- Add hover states, column alignment, net column color-coding, total row

### Phase 4: View Switching
- Implement Cash Flow / Income / Expenses as view-switching tabs
- Cross-fade animation between views
- Tab state persisted in URL: `/reports?tab=income&period=1M`

### Files That Change

| File | Action |
|------|--------|
| `src/routes/reports/+page.svelte` | Rewrite — insights header, pill controls, view switching |
| `src/routes/reports/+page.server.ts` | Update — accept period param, compute trends server-side |
| `src/lib/components/MonthlyChart.svelte` | Update — premium aesthetics, no gridlines, custom tooltip |
| `src/lib/components/CategoryChart.svelte` | Update — clean donut, no legend |
| `src/lib/components/YearOverYearCard.svelte` | Keep or absorb into insights |

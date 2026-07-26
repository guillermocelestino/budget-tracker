# Plan: Reports Page Quick Enhancements

Four targeted enhancements for the reports page. Estimated total: **~3-4 hours**.

---

## 1. Savings Rate Percentage

**Files:** `src/routes/reports/+page.svelte`, `src/lib/components/SummaryCards.svelte`

**Change:** Add savings rate to `SummaryCards`.

**Logic:** `(income - expenses) / income * 100` — display as percentage.

**SummaryCards.svelte change:**
```svelte
// Add prop
let savingsRate = $state(0);

// In card-content (4th card or inline with balance)
<span class="card-label">Savings Rate</span>
<span class="card-value" class:negative={savingsRate < 0}>{savingsRate.toFixed(1)}%</span>
```

**reports/+page.svelte change:** Pass `savingsRate={...}` prop calculated from income/expense.

**Effort:** 30 min.

---

## 2. Data Refresh Button

**File:** `src/routes/reports/+page.svelte`

**Change:** Add a refresh button in the report controls area that re-triggers the page load via `goto` with the same params.

**Logic:** Click handler calls `goto(`/reports?year=${selectedYear}&month=${selectedMonth}`, { replaceState: true, invalidateAll: true })`.

**UI:** Small icon button with rotation animation on click.

**Effort:** 30 min.

---

## 3. Top Spending Categories

**File:** `src/routes/reports/+page.svelte`

**Change:** Add a "Top Categories" section below the main charts showing the top 3 expense categories.

**Logic:**
```svelte
const topExpenses = $derived(
    (data.expenseData ?? [])
        .filter(c => c.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 3)
);
```

**Display:** Simple ranked list with category name, amount, and a mini progress bar relative to the top category.

**Effort:** 1 hour.

---

## 4. Dark Mode for Charts

**Files:** `src/lib/components/CategoryChart.svelte`, `src/lib/components/MonthlyChart.svelte`

**Change:** Add `isDark` prop to toggle chart colors.

**CategoryChart.svelte change:**
```svelte
let {
    labels = [],
    data = [],
    colors = [],
    isDark = false,  // NEW
}: { labels: string[]; data: number[]; colors: string[]; isDark?: boolean; }

// Detect system preference or accept prop
const chartOptions = $derived({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            position: 'right',
            labels: { color: isDark ? '#e5e7eb' : '#374151' },  // text colors
        },
        tooltip: {
            callbacks: { ... }
        },
    },
    // Dynamically adjust background based on isDark
});

const chartData = $derived({
    labels,
    datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: isDark ? '#1f2937' : '#ffffff',  // adapt border
    }],
});
```

**MonthlyChart.svelte:** Similar changes — detect `prefers-color-scheme: dark` via `window.matchMedia` or accept `isDark` prop, update bar colors and text colors for legend/labels.

**Effort:** 1-2 hours.

---

## Verification
1. Run `npm run dev` → navigate to `/reports`
2. Confirm savings rate percentage shows correctly (positive = green, negative = red)
3. Click refresh button → data reloads with spinning animation
4. Scroll to bottom → "Top Spending Categories" shows top 3 with amounts
5. Toggle dark mode in OS/system → charts should adapt colors automatically
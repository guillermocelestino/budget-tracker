# Plan: Trend Lines & Forecasting for Reports

## Approach: Option A — Simple Linear Regression (No Library)

Pure math approach. No dependencies to install. Computes trend lines and next-month forecast from existing monthly data.

## Implementation Steps

### 1. MonthlyChart.svelte — Accept trend/forecast props

Add optional props:
```typescript
trendIncome?: number[];    // trend values matching labels length
trendExpense?: number[];
forecastIncome?: number;   // next month forecast value
forecastExpense?: number;
```

Add line datasets to the chart for trend lines:
```typescript
datasets: [
  // existing bar datasets...
  {
    label: 'Income Trend',
    data: trendIncome,
    type: 'line',
    borderColor: '#10b981',
    borderDash: [5, 5],
    pointRadius: 0,
    fill: false,
    tension: 0.3,
  },
  // same for expense trend...
]
```

### 2. Reports page — Compute regression client-side

In `reports/+page.svelte`, add a utility function:
```typescript
function linearRegression(data: number[]) {
  const n = data.length;
  if (n < 2) return { slope: 0, intercept: 0, values: data, next: 0 };
  const x = data.map((_, i) => i);
  const xMean = (n - 1) / 2;
  const yMean = data.reduce((a, b) => a + b, 0) / n;
  const num = data.reduce((sum, y, i) => sum + (i - xMean) * (y - yMean), 0);
  const den = data.reduce((sum, _, i) => sum + (i - xMean) ** 2, 0);
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;
  const values = data.map((_, i) => slope * i + intercept);
  const next = slope * n + intercept;
  return { slope, intercept, values, next: Math.max(0, next) };
}
```

Derive trend data:
```typescript
const incomeTrend = $derived(linearRegression(monthlyIncome));
const expenseTrend = $derived(linearRegression(monthlyExpense));
```

### 3. Forecast card component

Create a small forecast summary showing next month projections:
- "📈 Projected next month: ₱X income, ₱Y expenses"
- Trend direction arrows (↑ growing, ↓ declining)

### 4. Data source: Multi-year query

The current `monthlyData` query only returns data for the selected year. For meaningful trends, modify the query to return ALL historical months for the user (remove the year filter):

```sql
WHERE user_id = $1
GROUP BY month
ORDER BY month ASC
```

This gives more data points for a more accurate regression.

### 5. Toggle to show/hide trend lines

Add a button or checkbox to toggle trend lines on/off.

## Files to Modify

| File | Change |
|------|--------|
| `src/routes/reports/+page.server.ts` | Remove year filter from monthlyData query |
| `src/routes/reports/+page.svelte` | Add regression function, derive trend data, add toggle |
| `src/lib/components/MonthlyChart.svelte` | Accept trend props, add line datasets |

## Verification

1. Navigate to Reports → Monthly chart shows trend lines
2. Dashed line follows income/expense direction
3. Forecast card shows next month projection
4. Toggle hides/shows trend lines
5. Performance is smooth with animation

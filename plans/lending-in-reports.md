# Plan: Add Lending Summary + Graph to Reports Page

## Context
The reports page should display lending summary cards and a lending recovery graph, similar to the dashboard. The existing `LendingSummaryCards` component can be reused.

## Files to Modify

### 1. `src/routes/reports/+page.server.ts`
Add lending data to the load function (similar to dashboard).

**Add query after existing queries:**
```typescript
const lendingSummary = await queryOne<{ totalLent: string; totalRecovered: string }>(
    `SELECT
        COALESCE(SUM(amount), 0) as "totalLent",
        COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as "totalRecovered"
     FROM lendings
     WHERE user_id = $1`,
    [userId]
);
```

**Add to return:**
```typescript
lendingSummary: {
    totalLent: parseFloat(lendingSummary?.totalLent ?? '0'),
    totalRecovered: parseFloat(lendingSummary?.totalRecovered ?? '0'),
    outstanding: parseFloat(lendingSummary?.totalLent ?? '0') - parseFloat(lendingSummary?.totalRecovered ?? '0'),
},
```

### 2. `src/routes/reports/+page.svelte`
- Import `LendingSummaryCards`
- Add cards after `SummaryCards`
- Add a lending recovery rate visualization

---

## Suggested Lending Graph for Reports

### Recommendation: Lending Recovery Rate + Outstanding vs Recovered Comparison

Since the reports page already has:
- Monthly bar chart (income vs expense over time)
- Income by Category doughnut
- Expense by Category doughnut

**Best fit for lending: A horizontal bar chart comparing Lent vs Recovered vs Outstanding**

```svelte
<div class="lending-chart-section">
    <div class="section-header">
        <h2>Lending Overview</h2>
    </div>
    <div class="lending-bar-chart">
        <!-- Recovery Rate Bar -->
        <div class="recovery-rate">
            <div class="rate-label">
                <span>Recovery Rate</span>
                <span class="rate-value">{recoveryRate}%</span>
            </div>
            <div class="rate-bar-bg">
                <div class="rate-bar-fill" style="width: {recoveryRate}%"></div>
            </div>
        </div>
        <!-- Comparison Bars -->
        <div class="compare-bars">
            <div class="bar-item">
                <span class="bar-label">Total Lent</span>
                <div class="bar-track">
                    <div class="bar-fill primary" style="width: 100%"></div>
                </div>
                <span class="bar-value">{formatCurrency(totalLent)}</span>
            </div>
            <div class="bar-item">
                <span class="bar-label">Recovered</span>
                <div class="bar-track">
                    <div class="bar-fill income" style="width: {totalLent > 0 ? (totalRecovered/totalLent)*100 : 0}%"></div>
                </div>
                <span class="bar-value">{formatCurrency(totalRecovered)}</span>
            </div>
            <div class="bar-item">
                <span class="bar-label">Outstanding</span>
                <div class="bar-track">
                    <div class="bar-fill expense" style="width: {totalLent > 0 ? (outstanding/totalLent)*100 : 0}%"></div>
                </div>
                <span class="bar-value">{formatCurrency(outstanding)}</span>
            </div>
        </div>
    </div>
</div>
```

### Why This Chart Works for Reports:
- **Horizontal bar comparison** — clear visual of Lent vs Recovered vs Outstanding
- **Recovery rate** — shows percentage of money recovered (useful metric)
- **Complements existing reports** — doesn't conflict with Income/Expense doughnuts
- **Simple to implement** — no new chart library needed, pure CSS bars

### Alternative (if more detailed):
A **Grouped Bar Chart** comparing monthly lending activity (if we add date tracking for lending records).

---

## Implementation Summary

| Item | Where |
|---|---|
| Lending data query | `reports/+page.server.ts` |
| LendingSummaryCards | `reports/+page.svelte` (after SummaryCards) |
| Lending bar chart | `reports/+page.svelte` (new section) |

## Verification
1. Go to Reports page
2. See LendingSummaryCards after the income/expense summary
3. See lending bar chart section with recovery rate and comparison bars
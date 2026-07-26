# Plan: Fix Category Breakdown Table to Show All Transactions

## Context

The "Category Breakdown" table on the reports page only shows **expense** transactions (filtered by `t.type = 'expense'` in the query). Income categories like Salary and Other Income always show ₱0.00, even when they have income transactions.

The fix: separate the data sources for the chart (expense-only) and the breakdown table (all transaction types).

## Approach

### 1. Update the server query — add income_total alongside expense

**File:** `src/routes/reports/+page.server.ts`

Change the `categoryData` query to return both income and expense totals per category:
```typescript
const categoryData = await queryMany<CategoryReportItem>(
    `SELECT c.id as category_id, c.name as category_name, c.color as category_color,
            COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as expense,
            COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as income
     FROM categories c
     LEFT JOIN transactions t ON t.category_id = c.id AND TO_CHAR(t.date, 'YYYY-MM') = $1
     WHERE c.user_id = $2
     GROUP BY c.id, c.name, c.color
     ORDER BY (income + expense) DESC`,
    [month, userId]
);
```

### 2. Update the type — rename `total` to `expense` and add `income`

**File:** `src/lib/types.ts`

```typescript
export interface CategoryReportItem {
    category_id: number;
    category_name: string;
    category_color: string;
    expense: number;
    income: number;
}
```

### 3. Update the page template — separate chart data from table data

**File:** `src/routes/reports/+page.svelte`

Update derived values for the chart (expense only) and table (combined):

```typescript
// Chart: expense only
const catLabels = $derived(
    (data.categoryData ?? []).map(c => c.category_name)
);
const catValues = $derived(
    (data.categoryData ?? []).map(c => c.expense)
);
const catColors = $derived(
    (data.categoryData ?? []).map(c => c.category_color)
);

// Table: combined income + expense
const breakdownTotal = $derived(
    (data.categoryData ?? []).reduce((sum, c) => sum + c.expense + c.income, 0)
);
```

Update the table's amount column and percentage to use `c.expense + c.income` and `breakdownTotal`.

### 4. Remove empty state check for "No expenses this month"

Change the empty state text to "No transactions this month" since the table now shows both income and expense.

### 5. Rename chart section title

The chart still shows expense-only data, which is correct for the existing "Expense by Category" title. No title change needed.

## Result

| Category | Before | After |
|---|---|---|
| Salary | ₱0.00 / 0.0% | ₱200,000.00 / 66.7% |
| Other Income | ₱0.00 / 0.0% | ₱100,000.00 / 33.3% |
| Food & Dining | ₱320.00 / 100.0% | ₱320.00 / 0.1% |
| Other Expense | ₱0.00 / 0.0% | ₱0.00 / 0.0% (changed to show combined) |

The chart stays expense-only. The table shows combined income + expense.

## Files Changed

- `src/lib/types.ts` — update `CategoryReportItem` interface
- `src/routes/reports/+page.server.ts` — update query
- `src/routes/reports/+page.svelte` — update derived values and table rendering

## Verification

1. Start dev server
2. Navigate to Reports → Category Breakdown table shows income categories with their earned amounts
3. The "Expense by Category" chart still shows only expense data
4. Percentages in the breakdown table total 100% across all categories
5. `npm run build` and `npm test` pass

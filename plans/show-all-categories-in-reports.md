# Plan: Show Zero-Amount Categories in Income/Expense Reports

## Context
Currently, the Reports page ("Income by Category" and "Expense by Category" sections) only shows categories that have actual transaction amounts. Categories with $0 for the selected month are filtered out client-side (lines 46-51 in `+page.svelte`), even though the server correctly returns them with `COALESCE(SUM(t.amount), 0) as total`.

The user wants to see ALL categories in each report:
- "Income by Category" should show ALL Income-type categories (including $0)
- "Expense by Category" should show ALL Expense-type categories (including $0)

## File to Modify
`src/routes/reports/+page.svelte`

## Changes Required

### 1. Remove the $0 filter (lines 45-51)
**Current code:**
```svelte
// Filter out categories with $0
const incomeDataFiltered = $derived(
    (data.incomeData ?? []).filter(c => c.total > 0)
);
const expenseDataFiltered = $derived(
    (data.expenseData ?? []).filter(c => c.total > 0)
);
```

**Change to:** Remove these filtered variables entirely.

### 2. Update derived chart data to use full data (lines 53-73)
**Current code references:** `incomeDataFiltered`, `expenseDataFiltered`

**Change to:** Use `data.incomeData` and `data.expenseData` directly in the `$derived` blocks instead.

### 3. Update template references (lines 188, 203, 241, 256)
- Line 188: `{#each incomeDataFiltered as cat}` → `{#each data.incomeData as cat}`
- Line 203: `{#if incomeDataFiltered.length === 0}` → `{#if (data.incomeData?.length ?? 0) === 0}`
- Line 241: `{#each expenseDataFiltered as cat}` → `{#each data.expenseData as cat}`
- Line 256: `{#if expenseDataFiltered.length === 0}` → `{#if (data.expenseData?.length ?? 0) === 0}`

The percentage calculations (lines 196-199, 249-252) already handle $0 correctly with `total > 0 ? ((cat.total / total) * 100).toFixed(1) : '0.0'`.

## Verification
1. Run `npm run dev` and navigate to `/reports`
2. Select a month where some categories have no transactions
3. Verify that:
   - "Income by Category" shows ALL income categories (including $0)
   - "Expense by Category" shows ALL expense categories (including $0)
   - Categories with $0 show "$0.00" and "0.0%" in the breakdown table
   - The doughnut charts include all categories in the legend
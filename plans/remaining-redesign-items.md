# Remaining Redesign Items Implementation Plan

## Fix: Export button alignment
Move the export button from the PageHeader action slot to a row alongside the filter-toggle button.

**Files:**
- `src/routes/transactions/+page.svelte`

**Changes:**
1. Remove the `.export-group` div from the PageHeader `{#snippet action()}`
2. Add a toolbar row below the header containing the filter-toggle on the left and the export button on the right
3. Keep the filter-toggle and export button side by side with `justify-content: space-between`

---

## Dashboard: Re-add MonthlyTrendChart + CategoryDonutChart
Recreate these chart components and add them to the dashboard. Both were deleted but the plan calls for them.

**Files:**
- `src/lib/components/MonthlyTrendChart.svelte` (recreate)
- `src/lib/components/CategoryDonutChart.svelte` (recreate)
- `src/routes/dashboard/+page.svelte` (add the sections)
- `src/routes/dashboard/+page.server.ts` (add data if needed)

**MonthlyTrendChart** — Line/area chart showing income vs expenses over time. Uses Chart.js Line chart. Props: `labels`, `incomeData`, `expenseData`. Add to dashboard below the sparkline trends section.

**CategoryDonutChart** — Donut chart for expense distribution by category. Props: `labels`, `data`. Add to dashboard next to MonthlyTrendChart in a 2-column grid.

---

## Transactions: Add filtered summary bar
Add a summary bar above the TransactionList showing filtered totals (total income, total expenses, balance) based on current page data.

**Files:**
- `src/routes/transactions/+page.svelte`

**Changes:**
1. Add a `.summary-bar` section between the filter panel and the TransactionList
2. Compute `filteredIncome`, `filteredExpenses`, `filteredBalance` from `data.transactions`
3. Show inline — no new component extraction needed (previous lesson learned)

---

## Lending: Extract LoanList + LoanForm
These are the most reusable since the lending page duplicates card/table rendering inline. Extract carefully to match existing patterns.

**Files:**
- `src/lib/components/LoanList.svelte` (new)
- `src/lib/components/LoanForm.svelte` (new)
- `src/routes/lending/+page.svelte` (update to use components)

**LoanList.svelte** — Props: `lendings`, `viewMode`, `onEdit`, `onDelete`, `onMarkPaid`. Handles card view, table view, and empty states. Uses existing format utilities.

**LoanForm.svelte** — Props: `editingId`, `initialData`, `onCancel`, `onSuccess`. Contains the add/edit form with amount formatting.

---

## Reports: Add ReportFilters, ReportTabs, ExportButton
Add tabbed navigation, filter controls, and CSV export to the reports page.

**Files:**
- `src/routes/reports/+page.svelte` (modify)
- `src/routes/api/reports/export/+server.ts` (new API endpoint)

**ReportTabs** — Inline tab navigation (Overview, Income, Expenses, Lending) that shows/hides sections. Same pattern as the lending page tabs — no new component file.

**ReportFilters** — Already exists as the year/month selects. Keep inline, no extraction needed.

**ExportButton** — Add a link to a new `/api/reports/export` endpoint that generates CSV from the current month's data. Place beside the year/month selects.

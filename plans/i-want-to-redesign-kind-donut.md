# Redesign Plan for Budget Tracker App

## Overview
Redesign the five core pages (Dashboard, Transactions, Categories, Lending, Reports) while maintaining existing layout and styling conventions. Focus on improving data visualization, component reuse, and user experience.

## Design Principles
- **Visual Consistency**: Reuse existing color palette, spacing, typography from `src/styles/variables.css`
- **Accessibility**: Ensure sufficient contrast, keyboard navigation, ARIA labels
- **Data-First Layout**: Prioritize charts and summary cards at the top
- **Modular Components**: Keep visual pieces as reusable Svelte components in `src/lib/components`
- **State Management**: Continue using existing Svelte stores and database queries

## Page-by-Page Redesign

### Dashboard (`/`)
- **Sections**: Summary cards, recent transactions, monthly spending trend, category breakdown
- **Components**: 
  - Enhanced `SummaryCards.svelte` (income, expenses, balance, savings rate)
  - Existing `TransactionList.svelte` (recent transactions)
  - New `MonthlyTrendChart.svelte` (line/area chart for income vs expenses)
  - New `CategoryDonutChart.svelte` (donut chart for expense distribution)
- **Visualization**: Use consistent line chart for trends, donut for category breakdown

### Transactions (`/transactions`)
- **Sections**: Filters (date, type, category), search, transaction list, filtered summary
- **Components**:
  - Existing `TransactionForm.svelte` (edit modal)
  - New `TransactionFilters.svelte` (date picker, dropdowns, search)
  - Enhanced `TransactionList.svelte` (row actions, inline edit)
  - `SummaryCards.svelte` (filtered totals)
- **Visualization**: Optional sparkline for daily spend trend in filtered results header

### Categories (`/categories`)
- **Sections**: Category list with icons/budget limits, add/edit dialog, budget usage visualization
- **Components**:
  - Existing `CategoryForm.svelte` (reuse)
  - New `CategoryList.svelte` (icon, name, budget, spent, progress bar)
  - New `CategoryUsageBar.svelte` (horizontal budget usage bar)
- **Visualization**: Stat tile/meter pattern for progress bars (green→yellow→red)

### Lending (`/lending`)
- **Sections**: Lent/borrowed overview, active loans list, add/settle loan form
- **Components**:
  - Adjusted `LendingSummaryCards.svelte` (Total Lent, Recovered, Outstanding)
  - New `LoanList.svelte` (status chips: pending, paid, overdue)
  - New `LoanForm.svelte` (borrow/lend, amount, due date, contact)
- **Visualization**: Optional bar chart for total lent vs borrowed over time

### Reports (`/reports`)
- **Sections**: Date selector, report tabs (monthly trend, category breakdown, income vs expenses, net worth)
- **Components**:
  - Existing chart components: `MonthlyChart.svelte`, `CategoryChart.svelte`, `YearOverYearCard.svelte`
  - New `ReportFilters.svelte` (date range, type)
  - New `ReportTabs.svelte` (tabbed interface)
  - New `ExportButton.svelte` (CSV/PDF)
- **Visualization**: Consistent chart styling (tooltips, legends, responsive behavior)

## Implementation Steps
1. **Confirm Styling System**: Verify use of plain CSS/Tailwind/etc.
2. **Create Shared Theme File**: Export color variables, spacing, radius, typography
3. **Develop Atomic Components**: Buttons, inputs, chips, progress bars, chart wrappers
4. **Build Pages in Isolation**: Connect to existing stores via `$:` or `load` functions
5. **Integrate into Routes**: Update `src/routes/<page>/+page.svelte`
6. **Add Unit/Storybook Tests**: For new visual components
7. **Visual QA**: Check light/dark mode, responsiveness, keyboard navigation
8. **Final Review**: Use Simplify skill to reduce duplication, then run `npm run dev`

## Open Questions for User (Answered)
1. **Styling system**: Plain CSS (from variables.css)
2. **State management**: Continue with existing stores/database
3. **Chart library**: Chart.js
4. **Feature scope**: Purely visual/UI redesign
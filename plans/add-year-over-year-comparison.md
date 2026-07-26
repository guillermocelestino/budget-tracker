# Plan: Year-over-Year (YoY) Comparison Feature for Reports Page

## Context

The current Reports page shows monthly income/expense data and category breakdowns for a selected month, but lacks **historical comparison context**. Users often want to know: "Am I doing better or worse than last year?" Without YoY comparison, they must manually remember or calculate previous year's figures.

**Why this matters:**
- Financial growth is best measured year-over-year
- Seasonal businesses/expenses vary by month (e.g., holiday spending)
- Comparing July 2026 to July 2025 provides meaningful context

## Recommended Approach

### 1. New API Endpoint: `/api/reports/year-over-year`

Create a new API endpoint that returns:
- Previous year's data for the same selected month
- Year-to-date (YTD) totals for both current and previous year
- Percentage change calculations on the server side

**Response shape:**
```typescript
{
  selectedMonth: { income: number, expenses: number, balance: number },
  previousYearMonth: { income: number, expenses: number, balance: number },
  currentYTD: { income: number, expenses: number },
  previousYTD: { income: number, expenses: number },
  changes: {
    monthIncomeChange: number,      // percentage
    monthExpenseChange: number,     // percentage
    ytdIncomeChange: number,       // percentage
    ytdExpenseChange: number        // percentage
  }
}
```

### 2. New Svelte Component: `YearOverYearCard.svelte`

Create a new summary card component showing:
- Side-by-side comparison (This Month vs Last Year)
- Arrow indicators (↑ green for income increase, ↓ red for expense decrease)
- Percentage change badges
- YTD comparison section

**Design approach:**
- Two-column layout: "This Month" | "Same Month Last Year"
- Highlighted percentage badges showing change
- Color-coded indicators (green = good, red = needs attention)
- Based on existing `SummaryCards.svelte` styling

### 3. Update `/reports/+page.server.ts`

Add the new API call and pass data to the page:
```typescript
export const load = async ({ locals, url }) => {
  const user = locals.user;
  const year = parseInt(url.searchParams.get('year') || new Date().getFullYear());
  const month = url.searchParams.get('month');

  // Existing queries...

  // NEW: Fetch YoY data
  const yoyResponse = await fetch(`${EVENT_URL}/api/reports/year-over-year?month=${month}`);
  const yoyData = await yoyResponse.json();

  return {
    // existing data...
    yoyData
  };
};
```

### 4. Update `/reports/+page.svelte`

Add the new YearOverYearCard component:
- Position it below or above the existing SummaryCards
- Include toggle to show/hide YoY section (for users who find it cluttered)

## Critical Files to Modify

| File | Change |
|------|--------|
| `src/routes/api/reports/year-over-year/+server.ts` | New API endpoint |
| `src/lib/components/YearOverYearCard.svelte` | New component |
| `src/routes/reports/+page.server.ts` | Add YoY data fetching |
| `src/routes/reports/+page.svelte` | Include new component |

## Reusable Components to Leverage

- `src/lib/components/SummaryCards.svelte` - Use similar card styling
- `src/lib/components/ModalDialog.svelte` - If help/info modal needed
- Currency formatting utility (check `src/lib/utils/` for existing)

## Implementation Steps

1. Create `src/routes/api/reports/year-over-year/+server.ts` with SQL query
2. Create `src/lib/components/YearOverYearCard.svelte` component
3. Update `src/routes/reports/+page.server.ts` to fetch and return YoY data
4. Update `src/routes/reports/+page.svelte` to render the new component
5. Add CSS styles (use existing `variables.css` for colors/spacing)

## Verification

1. Start dev server: `npm run dev`
2. Navigate to `/reports?month=2026-07&year=2026`
3. Verify the YoY card shows:
   - July 2026 vs July 2025 data
   - Correct percentage calculations
   - YTD comparison (Jan-Jul 2026 vs Jan-Jul 2025)
4. Test edge cases:
   - First year (no previous year data) - should show "N/A" gracefully
   - Month with no transactions in both years
   - Negative changes should show correctly (e.g., -15%)
5. Verify charts still render correctly with new component
6. Run any existing tests

## Optional Enhancements (Future)

- Sparkline showing YoY trend
- Export comparison report as CSV
- "Insight" text: "Your expenses are 12% higher than last July"
- Interactive: click to drill into the previous year's transactions
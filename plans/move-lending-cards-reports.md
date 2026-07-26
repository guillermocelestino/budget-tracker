# Plan: Move LendingSummaryCards Below SummaryCards and Remove Refresh Button

## Context
The lending summary cards currently appear after `YearOverYearCard`. Move them to be directly below the main `SummaryCards` (income/expense/balance). Also remove the refresh button.

## Steps

### 1. Move `LendingSummaryCards` from after `YearOverYearCard` to after `SummaryCards`
- Remove from line ~129 (after `YearOverYearCard`)
- Add after `SummaryCards` (line ~124) — directly below the main summary grid

### 2. Remove refresh button and `report-actions` div
- Remove lines ~136-145 (the `<div class="report-actions">` and the refresh button inside)

## Files
- `src/routes/reports/+page.svelte`

## Verification
1. Run `npm run dev`
2. Reports page shows: SummaryCards → LendingSummaryCards → YearOverYearCard → rest of page
3. No refresh button visible
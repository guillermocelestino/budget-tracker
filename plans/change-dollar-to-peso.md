# Plan: Change US Dollar SVG Icons to PH Peso Icons

## Context
The app currently displays US Dollar icons/symbols in various places. Since this is a Filipino budget tracker, these should be changed to Philippine Peso icons to match the `formatCurrency` function which already uses `₱` (PHP symbol).

## Findings

**Currency formatting is already PHP:**
`formatCurrency()` in `src/lib/utils/format.ts` already uses `₱` symbol:
```typescript
return amount < 0 ? `-₱${formatted}` : `₱${formatted}`;
```

However, there are dollar sign (`$`) SVG icons used as section icons in the UI:

### Dashboard (`src/routes/dashboard/+page.svelte`)
- The `SummaryCards` component shows Income/Expense/Balance, but the underlying data uses PHP via `formatCurrency()`. No dollar SVG icons in this page itself.

### Reports (`src/routes/reports/+page.svelte`)
- **Line 246-250**: Income section icon uses a dollar-sign SVG path:
```svelte
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="12" x2="12" y1="2" y2="22"/>
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
</svg>
```
This is the standard dollar sign icon (a line with two horizontal bars).

### Transactions (`src/routes/transactions/+page.svelte`)
- **Line 64-66**: Filter toggle icon uses a similar pattern (line + horizontal bars).

## Files to Modify

### 1. `src/routes/reports/+page.svelte`
Change the income section dollar icon to a peso-style icon.

**Current (line 246-250):**
```svelte
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="12" x2="12" y1="2" y2="22"/>
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
</svg>
```

**Change to:** A Philippine Peso symbol SVG — use `₱` text rendered as SVG, or a custom peso glyph:
```svelte
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="12" x2="12" y1="2" y2="22"/>
    <path d="M6 12h8a2 2 0 0 0 0-4H8v2h2m0 4h6v2H6v-2"/>
    <path d="M6 12h.01"/>
    <path d="M18 12h.01"/>
</svg>
```
Or simply use a text-based peso symbol inline SVG:
```svelte
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <text x="6" y="17" font-size="14" font-weight="bold" fill="currentColor" stroke="none">₱</text>
</svg>
```

### 2. `src/routes/transactions/+page.svelte`
Change the filter toggle icon at line 64-66 to use a peso-style icon or generic currency icon.

## Verification
1. Run `npm run dev`
2. Navigate to Reports page → "Income by Category" section icon should now show ₱ instead of $
3. Navigate to Transactions page → filter icon should show correctly
4. Confirm all currency displays use ₱ (already correct via `formatCurrency`)
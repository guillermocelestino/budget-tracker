# Plan: Fix Amount Column Vertical Alignment in Dashboard Table

## Context
The "Amount" column header in the dashboard transaction table is not vertically aligned with its data values. The `th` uses browser default `vertical-align: baseline` while `td` uses `vertical-align: middle`, causing the header to sit higher than the centered data cells.

## File to Modify
`src/lib/components/TransactionList.svelte`

## Change
Add `vertical-align: middle;` to the `th` CSS rule (line ~197).

**Current (line 197-205):**
```css
th {
    text-align: left;
    padding: var(--space-md) var(--space-md);
    color: var(--color-text-secondary);
    font-weight: 600;
    border-bottom: 2px solid var(--color-border);
    background: var(--color-bg);
    white-space: nowrap;
}
```

**Change to:**
```css
th {
    text-align: left;
    padding: var(--space-md) var(--space-md);
    color: var(--color-text-secondary);
    font-weight: 600;
    border-bottom: 2px solid var(--color-border);
    background: var(--color-bg);
    white-space: nowrap;
    vertical-align: middle;
}
```

## Verification
1. Run `npm run dev`
2. Go to dashboard
3. Check that the "Amount" column header is vertically centered with the data values
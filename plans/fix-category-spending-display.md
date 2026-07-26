# Plan: Show Spending on All Category Cards

## Context

The categories page hides the entire budget section (spent amount, percentage, progress bar) when a category has no `budget_limit` set. Since default income categories like "Salary", "Freelance", and "Other Income" have `budget_limit: null`, their cards show no spending information at all — just the icon, name, and "No budget set".

## Fix

In `CategoryList.svelte`, move the spending amount display outside the `{#if cat.budget_limit}` block so it always shows. Only the budget progress bar and percentage should remain conditional.

### Change

**File:** `src/lib/components/CategoryList.svelte`

**Current structure:**
```svelte
{#if cat.budget_limit}
    <div class="budget-section">
        <div class="budget-bar">...</div>
        <div class="budget-text">
            <span class="spent">
                <span class="spent-amount">{formatCurrency(spending[cat.id] || 0)}</span>
                <span class="spent-label">spent</span>
            </span>
            <span class="budget-pct">{Math.round(budgetProgress(cat))}%</span>
        </div>
    </div>
{/if}
```

**New structure:**
```svelte
<div class="budget-section">
    <div class="budget-text">
        <span class="spent">
            <span class="spent-amount">{formatCurrency(spending[cat.id] || 0)}</span>
            <span class="spent-label">spent this month</span>
        </span>
    </div>
    {#if cat.budget_limit}
        <div class="budget-bar">
            <div class="budget-fill" class:ok={budgetStatus(cat) === 'ok'} class:warning={budgetStatus(cat) === 'warning'} class:exceeded={budgetStatus(cat) === 'exceeded'} style="width: {budgetProgress(cat)}%"></div>
        </div>
        <div class="budget-text">
            <span></span>
            <span class="budget-pct" class:warning={budgetStatus(cat) === 'warning'} class:exceeded={budgetStatus(cat) === 'exceeded'}>
                {Math.round(budgetProgress(cat))}%
            </span>
        </div>
    {/if}
</div>
```

Also update the `budget-section` CSS to not require `border-top` when there's no spending data — or keep it consistent with a divider.

### Result

- **Categories with budget limits** (e.g., Food & Dining): show spent amount + progress bar + percentage (same as before)
- **Categories without budget limits** (e.g., Salary): show spent amount with "spent this month" label (new behavior)

## Verification

1. Start dev server
2. Navigate to Categories page
3. Income categories (Salary, Freelance, etc.) should show their spending amount, e.g. "₱0 spent this month"
4. Expense categories with budget limits should still show the progress bar and percentage
5. No layout shifts or broken styling
6. `npm run build` and `npm test` pass

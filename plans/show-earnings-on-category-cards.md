# Plan: Show Earnings on Income Category Cards

## Context

The categories page currently only tracks **expense** totals per category. Income categories like "Salary" and "Other Income" show "₱0 spent this month" even when the user has income transactions for them.

The goal is to show **how much was earned** for income categories, while keeping the existing "spent" + budget bar display for expense categories.

Since the `categories` table has no `type` field, we determine the display by looking at the actual transaction data.

## Files to Change

### 1. `src/routes/categories/+page.server.ts` — Fetch both income + expense

**Current query:** Only fetches expense totals.

**New query:** Fetch income and expense per category in one query.

```typescript
const spending = await queryMany<{ category_id: number; income: number; expense: number }>(
    `SELECT category_id,
            COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
            COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
     FROM transactions
     WHERE TO_CHAR(date, 'YYYY-MM') = TO_CHAR(CURRENT_DATE, 'YYYY-MM') AND user_id = $1
     GROUP BY category_id`,
    [userId]
);
```

Change the returned data to include both:
```typescript
const incomeMap: Record<number, number> = {};
const expenseMap: Record<number, number> = {};
for (const s of spending) {
    incomeMap[s.category_id] = parseFloat(s.income);
    expenseMap[s.category_id] = parseFloat(s.expense);
}
return { categories, spending: expenseMap, income: incomeMap };
```

### 2. `src/lib/types.ts` — Update PageData type

Add `income` to the `App.PageData` interface in `src/app.d.ts` (if needed) or just add to the return type.

Actually, `App.PageData` already allows arbitrary fields via the interface, so we just need to add the type. Let me check...

The `categories/+page.server.ts` returns `{ categories, spending, income }`. We need the `income` field to be typed in the svelte page.

### 3. `src/routes/categories/+page.svelte` — Pass income data

Pass the new `income` data alongside `spending`:

```svelte
<CategoryList
    categories={data.categories ?? []}
    spending={data.spending ?? {}}
    income={data.income ?? {}}
    ...
/>
```

### 4. `src/lib/components/CategoryList.svelte` — Display earnings

Add a new `income` prop and update the display logic:

**New prop:**
```typescript
income = {} as Record<number, number>,
```

**Updated template:**
```svelte
<div class="budget-section">
    <div class="budget-text">
        <span class="spent">
            <span class="spent-amount">{formatCurrency(spending[cat.id] || 0)}</span>
            <span class="spent-label">spent</span>
        </span>
        <span class="earned">
            <span class="earned-amount">{formatCurrency(income[cat.id] || 0)}</span>
            <span class="earned-label">earned</span>
        </span>
    </div>
    {#if cat.budget_limit}
        ...budget bar and percentage...
    {/if}
</div>
```

The spent amount and earned amount show side by side on the card. The budget bar only shows when a limit is set (expense categories).

### 5. `src/app.d.ts` — Add income to PageData

Add `income?: Record<number, number>;` to the `App.PageData` interface.

## Result

| Category Type | Display |
|---|---|
| Salary (has income, no budget) | "₱50,000 earned" |
| Food & Dining (has expense, has budget) | "₱320 spent" + budget bar with percentage |
| Entertainment (no transactions, has budget) | "₱0 spent" + budget bar at 0% |
| Other Income (no transactions, no budget) | "₱0 earned" |

## Verification

1. Start dev server
2. Log in and add an income transaction for "Salary" (e.g., ₱50,000)
3. Navigate to Categories → Salary card shows "₱50,000 earned"
4. Add an expense transaction for "Food & Dining" → its card shows "₱X spent" + budget bar with %
5. `npm run build` and `npm test` pass

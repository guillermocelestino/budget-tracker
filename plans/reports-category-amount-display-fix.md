# Reports Category Amount Display Fix Plan

## Context

When viewing the **Income by Category** or **Expense by Category** sections:
1. Some categories show **$0.00** amounts
2. This happens because the query includes ALL categories but only sums transactions of the matching type
3. Income categories with no income transactions show $0
4. Expense categories with no expense transactions show $0

**Current behavior in template (line 179-198, 232-251):**
```svelte
{#each data.expenseData ?? [] as cat (cat.category_id)}
  <tr>
    <td>...</td>
    <td class="amount expense">{formatCurrency(cat.total)}</td>  <!-- Shows $0.00 for categories with no expense txns -->
  </tr>
{/each}
```

It iterates through ALL categories, even those with $0.

---

## Fix Required

### Option 1: Filter Categories with $0 (Recommended)

Filter out categories that have $0 total from display.

**In `+page.svelte`:**

Add derived values that filter out zero amounts:

```typescript
// Filter expense data to only show categories with actual expense amounts
const expenseDataFiltered = $derived(
  (data.expenseData ?? []).filter(c => c.total > 0)
);

// Filter income data to only show categories with actual income amounts
const incomeDataFiltered = $derived(
  (data.incomeData ?? []).filter(c => c.total > 0)
);
```

Update the templates:

```svelte
<!-- For Expense table -->
{#each expenseDataFiltered as cat (cat.category_id)}
  ...
{/each}
{#if expenseDataFiltered.length === 0}
  <tr><td colspan="3" class="empty">No expenses this month</td></tr>
{/if}
```

And update the percentage calculation to use the filtered data:

```typescript
// For percentages in the filtered view
const expenseTotal = $derived(expenseDataFiltered.reduce((sum, c) => sum + c.total, 0));
const incomeTotal = $derived(incomeDataFiltered.reduce((sum, c) => sum + c.total, 0));
```

### Option 2: Filter at SQL Level

Add `HAVING SUM(t.amount) > 0` to the SQL queries in `+page.server.ts`:

```sql
-- Expense Data
SELECT c.id as category_id, c.name as category_name, c.color as category_color,
       COALESCE(SUM(t.amount), 0) as total
FROM categories c
LEFT JOIN transactions t ON t.category_id = c.id AND TO_CHAR(t.date, 'YYYY-MM') = $1 AND t.type = 'expense'
WHERE c.user_id = $2 AND c.type = 'expense'
GROUP BY c.id, c.name, c.color
HAVING COALESCE(SUM(t.amount), 0) > 0
ORDER BY total DESC
```

**Trade-off:** Option 1 gives better UX (shows empty state message), Option 2 is more efficient at DB level.

---

## Recommended: Option 1 (Frontend Filter)

This approach:
- Keeps the data flexible (can show $0 categories if needed elsewhere)
- Shows clear empty state messages
- Better for user experience

---

## Files to Modify

| File | Change |
|------|--------|
| `src/routes/reports/+page.svelte` | Add `expenseDataFiltered` and `incomeDataFiltered` derived values, update template loops, update percentage calculations |

---

## Additional Fix Needed

The SQL queries should also filter by `c.type` (category type), not just transaction type:

```sql
WHERE c.user_id = $2 AND c.type = 'expense'  -- for expenseData
WHERE c.user_id = $2 AND c.type = 'income'  -- for incomeData
```

This is covered in the separate plan `reports-category-type-filter-fix.md`.

---

## Verification

1. **Expense by Category:**
   - Categories with $0 expenses should NOT appear
   - Only categories with actual expense amounts should show
   - Empty state shows if no expense categories have amounts

2. **Income by Category:**
   - Same behavior for income

3. **Percentages:**
   - Should calculate correctly from only the displayed categories

4. **Empty states:**
   - Should appear when appropriate
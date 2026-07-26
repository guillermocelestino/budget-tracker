# Reports Category Type Filtering Fix Plan

## Context

The Reports page already separates `expenseData` and `incomeData`, but the **SQL queries don't filter categories by type**. This means:

1. **Expense by Category** section shows ALL categories (including income-type) with $0 for income categories
2. **Income by Category** section shows ALL categories (including expense-type) with $0 for expense categories

**Current problematic query (expenseData):**
```sql
SELECT c.id as category_id, c.name as category_name, c.color as category_color,
       COALESCE(SUM(t.amount), 0) as total
FROM categories c
LEFT JOIN transactions t ON t.category_id = c.id AND TO_CHAR(t.date, 'YYYY-MM') = $1 AND t.type = 'expense'
WHERE c.user_id = $2
GROUP BY c.id, c.name, c.color
```

The query filters transactions by `t.type = 'expense'` but **does NOT filter categories by type** (`c.type`). So income-type categories appear with $0.

---

## Fix Required

### 1. Expense Data Query

**Before:**
```sql
WHERE c.user_id = $2
```

**After:**
```sql
WHERE c.user_id = $2 AND c.type = 'expense'
```

### 2. Income Data Query

**Before:**
```sql
WHERE c.user_id = $2
```

**After:**
```sql
WHERE c.user_id = $2 AND c.type = 'income'
```

---

## Full Fixed Queries

### Expense Data:
```sql
SELECT c.id as category_id, c.name as category_name, c.color as category_color,
       COALESCE(SUM(t.amount), 0) as total
FROM categories c
LEFT JOIN transactions t ON t.category_id = c.id AND TO_CHAR(t.date, 'YYYY-MM') = $1 AND t.type = 'expense'
WHERE c.user_id = $2 AND c.type = 'expense'
GROUP BY c.id, c.name, c.color
ORDER BY total DESC
```

### Income Data:
```sql
SELECT c.id as category_id, c.name as category_name, c.color as category_color,
       COALESCE(SUM(t.amount), 0) as total
FROM categories c
LEFT JOIN transactions t ON t.category_id = c.id AND TO_CHAR(t.date, 'YYYY-MM') = $1 AND t.type = 'income'
WHERE c.user_id = $2 AND c.type = 'income'
GROUP BY c.id, c.name, c.color
ORDER BY total DESC
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/routes/reports/+page.server.ts` | Add `AND c.type = 'expense'` to expenseData query, `AND c.type = 'income'` to incomeData query |

---

## Verification

1. **Income by Category section:**
   - Should only show categories with `type = 'income'`
   - No expense-type categories should appear

2. **Expense by Category section:**
   - Should only show categories with `type = 'expense'`
   - No income-type categories should appear

3. **Empty state:**
   - If no categories of that type exist, show empty state message

4. **Amounts:**
   - Categories should show actual sums, not $0 (unless no transactions of that type)
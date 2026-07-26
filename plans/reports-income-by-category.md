# Reports Income by Category Enhancement Plan

## Context

Currently, the Reports page shows:
1. **Monthly Overview** - Shows both income and expenses by month (already working)
2. **Expense by Category** - Shows only expense categories for the selected month

The user wants to:
1. Replace "Expense by Category" with **Income by Category**
2. Add a new **Expense by Category** section for expenses
3. This gives a complete picture of where income comes from and where expenses go

---

## Changes

### 1. Reports Page Server (`src/routes/reports/+page.server.ts`)

Currently, `categoryData` only fetches expenses:
```sql
AND t.type = 'expense'
```

**Change:** Add separate queries for expense categories and income categories:

```typescript
// Expense categories (existing, renamed)
const expenseData = await queryMany<CategoryReportItem>(
  `SELECT c.id as category_id, c.name as category_name, c.color as category_color,
    COALESCE(SUM(t.amount), 0) as total
   FROM categories c
   LEFT JOIN transactions t ON t.category_id = c.id AND TO_CHAR(t.date, 'YYYY-MM') = $1 AND t.type = 'expense'
   WHERE c.user_id = $2
   GROUP BY c.id, c.name, c.color
   ORDER BY total DESC`,
  [month, userId]
);

// Income categories (NEW)
const incomeData = await queryMany<CategoryReportItem>(
  `SELECT c.id as category_id, c.name as category_name, c.color as category_color,
    COALESCE(SUM(t.amount), 0) as total
   FROM categories c
   LEFT JOIN transactions t ON t.category_id = c.id AND TO_CHAR(t.date, 'YYYY-MM') = $1 AND t.type = 'income'
   WHERE c.user_id = $2
   GROUP BY c.id, c.name, c.color
   ORDER BY total DESC`,
  [month, userId]
);
```

Return both:
```typescript
return {
  monthlyData,
  expenseData,  // renamed from categoryData
  incomeData,   // NEW
  // ... rest
};
```

### 2. Reports Page Svelte (`src/routes/reports/+page.svelte`)

**Current Structure:**
```
- Monthly Overview (chart)
- [controls for month]
- Expense by Category (chart) + Category Breakdown (table)
```

**New Structure:**
```
- Monthly Overview (chart)
- [controls for year]
- [controls for month]
- Income by Category (chart) + Category Breakdown (table)
- Expense by Category (chart) + Category Breakdown (table)
```

**Changes:**

1. Extract `incomeData` and derive chart values:
```typescript
const incomeLabels = $derived(
  (data.incomeData ?? []).map(c => c.category_name)
);
const incomeValues = $derived(
  (data.incomeData ?? []).map(c => c.total)
);
const incomeColors = $derived(
  (data.incomeData ?? []).map(c => c.category_color)
);
```

2. Update the grid layout for two sections side-by-side:
```svelte
<div class="category-report-grid">
  <!-- Income Section (left) -->
  <div class="report-section">
    <div class="section-header">
      <div class="section-title-group">
        <div class="section-icon income">
          <svg ...><!-- income icon --></svg>
        </div>
        <h2 class="section-title">Income by Category</h2>
      </div>
    </div>
    <CategoryChart
      labels={incomeLabels}
      data={incomeValues}
      colors={incomeColors}
    />
    <!-- Income breakdown table -->
  </div>

  <!-- Expense Section (right) -->
  <div class="report-section">
    <div class="section-header">
      <div class="section-title-group">
        <div class="section-icon expense">
          <svg ...><!-- expense icon --></svg>
        </div>
        <h2 class="section-title">Expense by Category</h2>
      </div>
    </div>
    <CategoryChart
      labels={catLabels}
      data={catValues}
      colors={catColors}
    />
    <!-- Expense breakdown table -->
  </div>
</div>
```

### 3. Update CSS if needed

The existing `category-report-grid` already handles 2-column layout. May need to adjust for better mobile stacking.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/routes/reports/+page.server.ts` | Add `incomeData` query, rename `categoryData` to `expenseData` |
| `src/routes/reports/+page.svelte` | Add second CategoryChart and table for income categories |

---

## Verification

1. **Monthly Overview** - Should still show income vs expense bar chart
2. **Income by Category** - Shows donut/pie chart with income categories and breakdown table
3. **Expense by Category** - Shows donut/pie chart with expense categories and breakdown table
4. **Filtering** - When changing month, both charts should update
5. **Empty state** - If no income or expense in a month, show appropriate empty message
6. **Mobile** - Charts and tables stack vertically on smaller screens
# Plan: Fix "Sibuyas kitas" Not Showing in Income by Category

## Context
The "Sibuyas kitas" category is not showing its amount in the Income by Category report. Investigation reveals:

1. **Immediate cause**: The transaction for Sibuyas kitas is dated **March 27, 2026**, but the Reports page defaults to the current month (**July 2026**). Switching to March 2026 shows the correct amount (400,000).

2. **Underlying code defects** (need fixing to prevent future issues):
   - `init.ts` schema missing `type` column on categories table
   - SQLite seed INSERT has 6 values but only 5 placeholders
   - API categories endpoint doesn't include `type` in INSERT

## Files to Fix

### 1. `src/lib/database/init.ts`

**DEFECT A - Add `type` column to categories table schema:**

Both Postgres (around line 12-21) and SQLite (around line 50-59) schemas need:
```sql
type TEXT NOT NULL DEFAULT 'expense'
```

**DEFECT B - Fix SQLite seed INSERT parameter mismatch (around lines 149-154):**

Current:
```typescript
const insertCat = db.prepare(
    'INSERT INTO categories (user_id, name, color, icon, budget_limit) VALUES (?, ?, ?, ?, ?)'
);
insertCat.run(user.id, cat.name, cat.color, cat.icon, cat.type, cat.budget_limit); // 6 values, 5 columns!
```

Fix: Add `type` to the INSERT column list:
```typescript
const insertCat = db.prepare(
    'INSERT INTO categories (user_id, name, color, icon, type, budget_limit) VALUES (?, ?, ?, ?, ?, ?)'
);
insertCat.run(user.id, cat.name, cat.color, cat.icon, cat.type, cat.budget_limit);
```

Also fix the Postgres seed (around lines 121-126) to include `type`.

### 2. `src/routes/api/categories/+server.ts`

**DEFECT C - Add `type` to the INSERT (around lines 44-46):**

Current INSERT doesn't include `type`, so categories created via API get `type='expense'` by default.

Should add `type` parameter to the INSERT:
```typescript
await execute(
    'INSERT INTO categories (user_id, name, color, icon, type, budget_limit) VALUES ($1, $2, $3, $4, $5, $6)',
    [userId, name.trim(), color || '#6366f1', icon || '📁', categoryType, budget_limit]
);
```

**Note:** This requires adding `categoryType` as a parameter from the request body.

## Immediate Workaround for User
To see Sibuyas kitas amount:
1. Go to Reports page
2. Use the month dropdown (below the divider) to select **March 2026**
3. The amount 400,000 should appear

## Verification
1. After fixes, create a new income category and verify it appears in the correct report
2. Check that SQLite initialization no longer crashes on fresh database
3. Verify the PostgreSQL schema includes the `type` column
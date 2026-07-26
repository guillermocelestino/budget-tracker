# Plan: Fix Income by Category Showing $0 for Categories

## Context
The "Income by Category" and "Expense by Category" reports are showing $0 or missing categories like "Sibuyas kitas". The root cause is that the `categories` table schema in `init.ts` **lacks a `type` column**, even though:

1. The `Category` TypeScript interface defines `type: 'income' | 'expense'`
2. The reports query filters by `c.type = 'income'` and `c.type = 'expense'`
3. The seed data defines `type` for each category but never inserts it

This creates a mismatch where the database schema and application code don't align.

## Files to Modify

### 1. `src/lib/database/init.ts`
The primary fix location. Three issues need to be resolved:

**A. Add `type` column to categories table schema (both Postgres and SQLite)**

Postgres schema change (around line 12-21):
```sql
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#6366f1',
    icon TEXT NOT NULL DEFAULT '📁',
    budget_limit NUMERIC(12,2),
    type TEXT NOT NULL DEFAULT 'expense',  -- ADD THIS
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, name)
);
```

SQLite schema change (around line 50-59) - same addition.

**B. Fix Postgres seed INSERT (around line 121-126)**

Current:
```javascript
await client.query(
    'INSERT INTO categories (user_id, name, color, icon, budget_limit) VALUES ($1, $2, $3, $4, $5)',
    [user.id, cat.name, cat.color, cat.icon, cat.budget_limit]
);
```

Should be:
```javascript
await client.query(
    'INSERT INTO categories (user_id, name, color, icon, type, budget_limit) VALUES ($1, $2, $3, $4, $5, $6)',
    [user.id, cat.name, cat.color, cat.icon, cat.type, cat.budget_limit]
);
```

**C. Fix SQLite seed INSERT parameter mismatch (around line 149-154)**

Current: 5 columns but `cat.type` and `cat.budget_limit` are both passed (6 values).

Should be: Match the columns in the INSERT statement.

## Verification
1. After the schema changes, the existing database may need a migration to add the `type` column
2. Check if "Sibuyas kitas" now shows correct income amounts in the reports
3. Verify all seeded categories (Salary, Freelance, etc.) appear in their respective reports (Income or Expense)
4. Verify percentage calculations work correctly
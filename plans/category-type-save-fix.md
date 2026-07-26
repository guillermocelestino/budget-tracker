# Category Type Save/Update Fix Plan

## Context

The CategoryForm has a `categoryType` state, but when saving/updating categories, **the type value is not being sent to the server or saved to the database**.

Looking at `src/routes/categories/+page.server.ts`:

**Create action (line 52-55):**
```typescript
await execute(
  'INSERT INTO categories (user_id, name, color, icon, budget_limit) VALUES ($1, $2, $3, $4, $5)',
  [userId, name, color, icon, budget_limit]
);
```
- Missing `type` in INSERT

**Update action (line 83-86):**
```typescript
await execute(
  'UPDATE categories SET name = $1, color = $2, icon = $3, budget_limit = $4 WHERE user_id = $5 AND id = $6',
  [name, color, icon, budget_limit, userId, id]
);
```
- Missing `type` in UPDATE

Additionally, the form sends `category_type` but it's never extracted from `FormData`.

---

## Changes Required

### 1. Server Actions (`src/routes/categories/+page.server.ts`)

**Create action - extract and save type:**
```typescript
const type = (data.get('category_type') as string) || 'expense';

// Validate
if (!['income', 'expense'].includes(type)) {
  return fail(400, { error: 'Invalid category type' });
}

// Insert with type
await execute(
  'INSERT INTO categories (user_id, name, color, icon, type, budget_limit) VALUES ($1, $2, $3, $4, $5, $6)',
  [userId, name, color, icon, type, budget_limit]
);
```

**Update action - extract and save type:**
```typescript
const type = (data.get('category_type') as string) || 'expense';

// Validate
if (!['income', 'expense'].includes(type)) {
  return fail(400, { error: 'Invalid category type' });
}

// Update with type
await execute(
  'UPDATE categories SET name = $1, color = $2, icon = $3, type = $4, budget_limit = $5 WHERE user_id = $6 AND id = $7',
  [name, color, icon, type, budget_limit, userId, id]
);
```

### 2. Database Schema Check

Verify that `type` column exists in the `categories` table:
```sql
ALTER TABLE categories ADD COLUMN type TEXT NOT NULL DEFAULT 'expense';
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/routes/categories/+page.server.ts` | Extract `category_type` from FormData and save in create/update |

---

## Verification

1. **Create Category:**
   - Select "Income" type, fill form, submit
   - Category should be saved with `type = 'income'`
   - Check database: `SELECT * FROM categories WHERE name = 'YourCategory'` → should have `type = 'income'`

2. **Update Category:**
   - Edit existing category
   - Change type from Expense to Income
   - Save
   - Check database: type should be updated

3. **Category List:**
   - Categories should show with correct type indicators (if implemented)
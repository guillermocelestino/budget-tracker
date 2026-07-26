# Category Type Feature Plan

## Context

Currently, categories in the budget tracker do not have a type (income or expense). When users create transactions, all categories are shown in the dropdown regardless of whether the transaction is income or expense. This creates a poor user experience where users might incorrectly categorize an income transaction under an expense category (e.g., "Coffee" category for a salary deposit).

**Goal:** Add category type support so that:
1. Categories are explicitly marked as income or expense
2. Transaction form filters the category dropdown based on selected transaction type
3. Reports can properly separate income vs expense categories

---

## Design

### 1. Database Schema

Add `type` column to `categories` table:
```sql
ALTER TABLE categories ADD COLUMN type TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('income', 'expense'));
```

### 2. TypeScript Types

Update `Category` interface in `src/lib/types.ts`:
```typescript
export interface Category {
  id: number;
  name: string;
  color: string;
  icon: string;
  type: 'income' | 'expense';  // NEW
  budget_limit: number | null;
  created_at: string;
}

export interface CategoryFormData {
  name: string;
  color: string;
  icon: string;
  type: 'income' | 'expense';  // NEW
  budget_limit: number | null;
}
```

### 3. API Changes

#### `src/routes/api/categories/+server.ts`
- Include `type` in CREATE response

#### `src/routes/api/categories/[id]/+server.ts`
- Include `type` in GET/PUT responses

### 4. CategoryForm Component (`src/lib/components/CategoryForm.svelte`)

Add type selector to the form:
```svelte
<fieldset class="form-group">
  <legend class="form-label">Type</legend>
  <div class="type-toggle">
    <label class="type-option" class:active={type === 'expense'}>
      <input type="radio" name="type" value="expense" bind:group={type} />
      💸 Expense
    </label>
    <label class="type-option" class:active={type === 'income'}>
      <input type="radio" name="type" value="income" bind:group={type} />
      💰 Income
    </label>
  </div>
</fieldset>
```

State: `let categoryType = $state<'income' | 'expense'>('expense');`

### 5. TransactionForm Component (`src/lib/components/TransactionForm.svelte`)

Filter categories based on selected transaction type:
```svelte
const filteredCategories = $derived(
  categories.filter(cat => cat.type === type)
);

// Reset category when type changes
$effect(() => {
  if (category_id && !filteredCategories.find(c => c.id === category_id)) {
    category_id = '';
  }
});
```

Update the select dropdown:
```svelte
<select id="category_id" name="category_id" required bind:value={category_id}>
  <option value="">Select a category</option>
  {#each filteredCategories as cat (cat.id)}
    <option value={cat.id}>{cat.icon} {cat.name}</option>
  {/each}
</select>
```

### 6. Server Pages

#### `src/routes/categories/+page.server.ts`
- Include `type` when loading categories

#### `src/routes/transactions/new/+page.server.ts`
- Include `type` when loading categories

#### `src/routes/transactions/[id]/edit/+page.server.ts`
- Include `type` when loading categories

### 7. CategoryList Component (`src/lib/components/CategoryList.svelte`)

Group categories by type for display, or add type indicator badges.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/types.ts` | Add `type` to Category and CategoryFormData interfaces |
| `src/lib/components/CategoryForm.svelte` | Add type selector radio buttons |
| `src/lib/components/TransactionForm.svelte` | Filter categories by type with $derived |
| `src/lib/components/CategoryList.svelte` | Add type indicator badge |
| `src/routes/api/categories/+server.ts` | Include type in response |
| `src/routes/api/categories/[id]/+server.ts` | Include type in response |
| `src/routes/categories/+page.server.ts` | Return type with categories |
| `src/routes/transactions/new/+page.server.ts` | Return type with categories |
| `src/routes/transactions/[id]/edit/+page.server.ts` | Return type with categories |
| Database migration | Add `type` column to categories table |

---

## Database Migration

```sql
-- Add type column with default
ALTER TABLE categories ADD COLUMN type TEXT NOT NULL DEFAULT 'expense';

-- Add constraint to ensure valid values
ALTER TABLE categories ADD CONSTRAINT categories_type_check CHECK (type IN ('income', 'expense'));

-- Optionally update existing categories to have a type based on their name patterns
-- For example: 'Salary' -> 'income', 'Food' -> 'expense'
-- Or simply default all to 'expense' (safer approach)
```

---

## Verification

1. **Create Category:**
   - Go to Categories page
   - Click "Add Category"
   - Select "Income" or "Expense" type
   - Fill in other fields and submit
   - Category should appear with type indicator

2. **Transaction - Expense:**
   - Go to Transactions > New
   - Select "Expense" type
   - Category dropdown should only show expense categories

3. **Transaction - Income:**
   - Go to Transactions > New
   - Select "Income" type
   - Category dropdown should only show income categories

4. **Category List:**
   - Categories should show badges indicating income vs expense type

5. **Edit Category:**
   - Edit an existing category
   - Type selector should be pre-selected with current type
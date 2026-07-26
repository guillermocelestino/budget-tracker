# Transaction Category Filtering Plan

## Context

Currently, when creating or editing a transaction, **all categories** are shown in the dropdown regardless of whether the transaction type is "Income" or "Expense". This means users might incorrectly categorize an income transaction under an expense category (e.g., selecting a "Coffee" category when recording salary).

The `Category` interface already has the `type` field (`type: 'income' | 'expense'`), but the `TransactionForm` doesn't use it to filter the dropdown.

---

## Implementation

### TransactionForm.svelte (`src/lib/components/TransactionForm.svelte`)

**Change 1:** Add a `$derived` to filter categories based on selected type

```typescript
// Filter categories by type - only show categories matching the selected transaction type
const filteredCategories = $derived(
  categories.filter(cat => cat.type === type)
);
```

**Change 2:** Reset `category_id` when type changes

When the user switches between Income and Expense, the selected category should be cleared because the old category may not be valid for the new type.

```typescript
// Reset category when type changes (to avoid selecting wrong-type category)
$effect(() => {
  const currentType = type;
  // Check if current category_id is still valid for the type
  if (category_id && !filteredCategories.find(c => c.id === category_id)) {
    category_id = '';
  }
});
```

**Change 3:** Update the dropdown template

```svelte
<select id="category_id" name="category_id" required bind:value={category_id} class:input-error={errors.category_id}>
  <option value="">Select a category</option>
  {#each filteredCategories as cat (cat.id)}
    <option value={cat.id}>{cat.icon} {cat.name}</option>
  {/each}
</select>
```

Note: Only `filteredCategories` is used instead of `categories`.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/components/TransactionForm.svelte` | Add `$derived` for filtering and `$effect` to reset category |

---

## Behavior

### User Flow

1. **Create Transaction - Expense selected (default):**
   - Category dropdown shows only expense categories
   - User selects a category

2. **User switches to Income:**
   - Category dropdown instantly updates to show only income categories
   - `category_id` is reset to empty (prevents wrong category type)

3. **Edit Transaction:**
   - If transaction is expense, only expense categories shown
   - Category dropdown pre-selects the correct category
   - If user changes type, dropdown updates and selection clears

### Edge Cases

- **Empty filtered list:** If no categories exist for a type, show "No [type] categories. Create one first!" message
- **Category mismatch:** If editing and the saved category doesn't match the type, the `$effect` will clear it

---

## Verification

1. **Expense Transaction:**
   - Select "Expense" type
   - Dropdown should only show expense categories
   - Select a category and submit

2. **Income Transaction:**
   - Select "Income" type
   - Dropdown should only show income categories
   - Select a category and submit

3. **Type Switching:**
   - Select Expense type, then select a category
   - Switch to Income type
   - Category selection should clear, dropdown should show income categories

4. **Edit Transaction:**
   - Edit an expense transaction
   - Expense categories should be shown and correct one selected
   - Change type to Income
   - Category should clear and income categories should show
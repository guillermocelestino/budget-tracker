# Category Type Selector Fix Plan

## Context

The `CategoryForm.svelte` component has the `categoryType` state declared (line 21):
```typescript
let categoryType = $state<'income' | 'expense'>('expense');
```

However, **the type selector UI is completely missing from the form template**. The state exists but nothing renders it in the HTML, so users cannot select the category type when creating or editing a category.

Additionally, when editing an existing category, the `categoryType` is not populated from the category data in the `$effect`.

---

## Fix Required

### 1. CategoryForm.svelte (`src/lib/components/CategoryForm.svelte`)

**Issue 1:** Missing type selector UI in the template

Add the type selector after the name field (or in a logical position):

```svelte
<form method="POST" {action} use:enhance={handleEnhance}>
  {#if category}
    <input type="hidden" name="id" value={category.id} />
  {/if}

  <!-- NEW: Type selector -->
  <fieldset class="form-group">
    <legend class="form-label">Type</legend>
    <div class="type-toggle">
      <label class="type-option" class:active={categoryType === 'expense'}>
        <input type="radio" name="category_type" value="expense" bind:group={categoryType} />
        <span class="type-icon">💸</span>
        Expense
      </label>
      <label class="type-option" class:active={categoryType === 'income'}>
        <input type="radio" name="category_type" value="income" bind:group={categoryType} />
        <span class="type-icon">💰</span>
        Income
      </label>
    </div>
  </fieldset>

  <div class="form-group">
    <label class="form-label" for="cat-name">Name</label>
    <input id="cat-name" name="name" type="text" required bind:value={name} placeholder="Category name" />
  </div>

  <!-- rest of form... -->
```

**Issue 2:** `categoryType` not populated when editing

Update the `$effect` to also set `categoryType`:

```typescript
$effect(() => {
  if (category) {
    name = category.name;
    color = category.color;
    icon = category.icon;
    categoryType = category.type || 'expense';  // ADD THIS LINE
    rawBudgetLimit = category.budget_limit != null ? String(category.budget_limit) : '';
  }
});
```

### 2. Add CSS for Type Toggle

Add styles similar to TransactionForm's type toggle:

```css
.type-toggle {
  display: flex;
  gap: var(--space-sm);
}

.type-option {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--font-size-base);
  font-weight: 500;
  transition: all var(--transition-fast);
  min-height: 48px;
}

.type-option input {
  display: none;
}

.type-option.active {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.type-icon {
  font-size: 1.2rem;
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/components/CategoryForm.svelte` | Add type selector UI and fix $effect |

---

## Verification

1. **Create Category:**
   - Go to Categories page
   - Click "Add Category"
   - Type selector should appear with "Expense" and "Income" options
   - Default selection should be "Expense"
   - Select a type and fill in other fields
   - Submit - category should be created with selected type

2. **Edit Category:**
   - Click edit on an existing category
   - Type selector should appear
   - Current type should be pre-selected
   - Changing type and saving should update the category type
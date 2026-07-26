# Plan: Add Card/Table View Toggle to Categories Page

## Context
The Categories page currently shows only a grid of cards. Add a toggle button to switch between Card view and Table view — mirroring the same implementation done in the Lending page. This gives users a more compact way to view many categories.

## Files to Modify
- `src/routes/categories/+page.svelte`

## Pattern to Reuse
The lending page already has this feature implemented. Use the same pattern:
- `viewMode` state (`'card' | 'table'`)
- View toggle buttons (grid/table icons)
- `{#if viewMode === 'card'}` / `{:else}` block wrapping content
- CSS for `.view-toggle`, `.toggle-btn`, `.data-table`, etc.

## Changes

### 1. Add state (after existing state declarations)
```svelte
let viewMode = $state<'card' | 'table'>('card');
```

### 2. Add view toggle buttons (after the "Add Category" button / before category list header)
```svelte
<div class="view-toggle-row">
    <div class="view-toggle">
        <button class="toggle-btn" class:active={viewMode === 'card'} onclick={() => viewMode = 'card'} title="Card View">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
        </button>
        <button class="toggle-btn" class:active={viewMode === 'table'} onclick={() => viewMode = 'table'} title="Table View">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <line x1="3" y1="9" x2="21" y2="9"/>
                <line x1="3" y1="15" x2="21" y2="15"/>
                <line x1="9" y1="3" x2="9" y2="21"/>
                <line x1="15" y1="3" x2="15" y2="21"/>
            </svg>
        </button>
    </div>
</div>
```

### 3. Wrap existing CategoryList or category grid in `{#if viewMode === 'card'}` / `{:else}` block
- **Card view**: Keep existing grid/list layout
- **Table view**: Add a clean `<table class="cat-table">` showing categories with columns: Name, Type, Budget Limit, Icon, Color, Actions (edit/delete)

### 4. Table view columns
| Column | Notes |
|---|---|
| Category | Icon + Name |
| Type | Income / Expense badge |
| Budget | Budget limit or "No limit" |
| Color | Color dot |
| Actions | Edit / Delete buttons |

### 5. CSS to add (reuse lending page styles)
```css
.view-toggle-row {
    display: flex;
    justify-content: flex-end;
    margin-bottom: var(--space-md);
}

.view-toggle {
    display: flex;
    gap: 2px;
    background: var(--color-bg);
    padding: 4px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
}

.toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 12px;
    border: none;
    background: transparent;
    border-radius: var(--radius-sm);
    cursor: pointer;
    color: var(--color-text-secondary);
    transition: all var(--transition-fast);
    min-height: 36px;
}

.toggle-btn.active {
    background: var(--color-primary);
    color: white;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.toggle-btn:hover:not(.active) {
    background: var(--color-surface);
    color: var(--color-text);
}

/* Table Styles */
.cat-table-section {
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(20px);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    padding: var(--space-lg);
    animation: fadeSlideIn 0.4s ease-out;
}

.cat-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--font-size-sm);
}

.cat-table th {
    text-align: left;
    padding: var(--space-sm) var(--space-md);
    color: var(--color-text-secondary);
    font-weight: 600;
    border-bottom: 2px solid var(--color-border);
}

.cat-table td {
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid var(--color-border);
    vertical-align: middle;
}

.cat-table tr:hover {
    background: var(--color-bg);
}

@keyframes fadeSlideIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}
```

## Verification
1. Go to `/categories`
2. Toggle between card and table view
3. Both views display all categories correctly
4. Edit/Delete actions work in table view
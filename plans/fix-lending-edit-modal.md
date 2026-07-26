# Plan: Fix Lending Card Edit Button

## Context

The lending page has an "Edit" button on each card that calls `startEdit(lending)` but this function was never defined. Clicking it silently fails — no modal, no form, nothing happens.

The "Mark as Paid" flow works correctly because `markPaidId` state is properly wired to the modal.

## Fix

### 1. Add `editingLending` state (alongside `markPaidId`, `deleteId`)

```typescript
let editingLending = $state<Lending | null>(null);
```

### 2. Add `startEdit` function

```typescript
function startEdit(lending: Lending) {
    editingLending = lending;
    showForm = true;
}
```

This reuses the existing `showForm` and the lending form panel. When `editingLending` is set, the form populates with existing values for editing.

### 3. Update the form panel to support edit mode

The current form panel only creates new lendings. Add hidden ID field and pre-populate fields:

```svelte
<form method="POST" action={editingLending ? '?/update' : '?/create'} use:enhance={...}>
    {#if editingLending}
        <input type="hidden" name="id" value={editingLending.id} />
        <input type="hidden" name="status" value={editingLending.status} />
    {/if}
    <div class="form-group">
        <label for="borrower_name">Borrower Name</label>
        <input id="borrower_name" name="borrower_name" type="text" required
            value={editingLending?.borrower_name ?? ''}
            placeholder="Who borrowed the money?" />
    </div>
    ...
```

### 4. Reset `editingLending` when form closes

```typescript
function closeForm() {
    showForm = false;
    editingLending = null;
}
```

### 5. Server already has `update` action

The lending server (`+page.server.ts`) already has an `update` action implemented (lines 68-95). It handles borrower_name, amount, interest_rate, date_lent, due_date, status, and notes. So no server changes needed.

## File to Modify

- `src/routes/lending/+page.svelte`

## Verification

1. Click Edit on a lending card → form panel appears with pre-filled values
2. Change a field and save → lending updates
3. "Mark as Paid" and Delete buttons continue to work
4. New Lending button works without pre-filled values

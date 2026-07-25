# Toast Notification System for Budget Tracker

## Context

The app has no success feedback when users add/edit transactions or create categories — pages just re-render silently. A lightweight toast notification system provides immediate, non-intrusive confirmation.

## Architecture

- **Module-level Svelte 5 runes** (`$state` in a `.svelte.ts` file) for reactive toast state that survives client-side navigation
- **Fixed-position ToastContainer** rendered in root layout (top-right) — no conflict with existing bottom-right PWA toast
- **`use:enhance` callbacks** on existing forms — intercept form action results and call `showSuccess()`/`showError()`

## Toast UI

- **Position**: Top-right, `z-index: 9999` (avoids PWA toast at bottom-right)
- **Variants**: Success (green/`--color-income`), Error (red/`--color-expense`), Info (indigo/`--color-primary`)
- **Auto-dismiss**: 4 seconds with animated progress bar countdown
- **Animation**: Slide in from right, newest on top, stackable
- **Icons**: ✅ success, ❌ error, ℹ️ info
- **Accessible**: `role="alert"` on each toast
- **Mobile**: Full-width at top on screens < 480px

## Files to Create (2)

### 1. `src/lib/stores/toast.svelte.ts`
Module-level reactive store with `$state` array. Exports: `showSuccess(msg)`, `showError(msg)`, `showInfo(msg)`, `dismissToast(id)`. Auto-removes toasts after 4s via `setTimeout`.

### 2. `src/lib/components/ToastContainer.svelte`
Imports `toasts` array, renders stacked toasts with slide-in animation, progress bar, close button. Uses existing CSS vars (`--color-income`, `--color-expense`, `--color-primary`, `--space-lg`, `--radius-md`, `--shadow-md`).

## Files to Modify (5)

### 3. `src/routes/+layout.svelte`
Add `<ToastContainer />` import and render (outside `app-shell`, after `<PwaUpdate />`).

### 4. `src/lib/components/TransactionForm.svelte`
Add `use:enhance={handleEnhance}` callback. On `result.type === 'redirect'`: `showSuccess('Transaction added/updated successfully')`. The toast survives navigation because module state persists.

### 5. `src/lib/components/CategoryForm.svelte`
Add `onSuccess` prop + `use:enhance` callback. On success: show toast + call `onSuccess?.()` (closes form panel). On failure: show error toast.

### 6. `src/routes/transactions/+page.svelte`
Add `use:enhance` callback to delete form inside ModalDialog. On success: close modal + show success toast. On failure: show error toast.

### 7. `src/routes/+page.svelte` (dashboard)
Same delete-form callback pattern as transactions page.

### 8. `src/routes/categories/+page.svelte`
- Pass `onSuccess={closeForm}` to `<CategoryForm>`
- Add `use:enhance` callback to delete form (same pattern as transactions)

## Notifications Provided

| Action | Toast Message | Type |
|--------|--------------|------|
| Add transaction | "Transaction added successfully" | ✅ success |
| Edit transaction | "Transaction updated successfully" | ✅ success |
| Create category | "Category created successfully" | ✅ success |
| Update category | "Category updated successfully" | ✅ success |
| Delete transaction | "Transaction deleted successfully" | ✅ success |
| Delete category | "Category deleted successfully" | ✅ success |
| Any validation error | Server error message | ❌ error |

## Edge Cases Handled

- Rapid double-submit → stacking handles multiple toasts
- Navigation while toast visible → state persists, toast "follows"
- JS disabled → forms fall back to normal submit, no toasts (progressive enhancement)
- Module-level state → setTimeout callbacks always work (not component-scoped)
- Conflict with PWA toast → different positions (top-right vs bottom-right)

## Verification

1. `npm run dev` → start the app
2. Add a transaction → toast "Transaction added successfully" at top-right, auto-dismisses
3. Edit a transaction → toast "Transaction updated successfully"
4. Create a category → form panel closes + toast "Category created successfully"
5. Delete a transaction → modal closes + toast "Transaction deleted successfully"
6. Delete a category → toast "Category deleted successfully"
7. Submit invalid form → red error toast appears
8. Mobile view → toast spans full width at top

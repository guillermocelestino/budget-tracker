# Toast Notification Fixes

## Context

After implementing the toast notification system, three issues were identified during testing:

1. **Toast doesn't center on desktop** — appears floating somewhere in the layout instead of fixed-position
2. **Toast not mobile responsive** — breakpoint CSS is unreachable
3. **Form input values persist after submit** — transaction form values remain after successful submission instead of navigating away

---

## Root Cause Analysis

### Issue 1 & 2: ToastContainer missing wrapper element

**Root cause**: The ToastContainer template renders bare `<div class="toast">` elements without a wrapping `<div class="toast-container">`. The CSS targets `:global(.toast-container)` for all positioning (`position: fixed`, `top`, `right`, `z-index`) and the mobile breakpoint. Since no element with that class exists, the CSS never applies.

Each `.toast` has `position: relative`, so they render as inline content in the layout flow (pushed by the sidebar), not as fixed-position overlays.

**File**: `src/lib/components/ToastContainer.svelte`

**Fix**: Add a `<div class="toast-container">` wrapper around the `{#each}` block. Move the `position: fixed` + positioning CSS from the `:global(.toast-container)` rule to the actual local class. Remove the `:global()` wrapper since the class will exist in the template.

### Issue 3: TransactionForm missing `update()` call

**Root cause**: TransactionForm's `handleEnhance` callback only checks for `result.type === 'redirect'` and calls `showSuccess()`, but never calls `await update()`. With a custom `use:enhance` callback, SvelteKit suppresses ALL default behavior — the developer must call `update()` to apply the result. Without it, the redirect navigation never happens, so the page stays on the form with values intact.

The CategoryForm already has `await update()` and works correctly.

**File**: `src/lib/components/TransactionForm.svelte`

**Fix**: Add `await update()` after the redirect check.

---

## Changes

### 1. `src/lib/components/ToastContainer.svelte`

**Template change**: Add wrapping `<div class="toast-container">`:

```svelte
<div class="toast-container">
  {#each [...toastState.items].reverse() as toast (toast.id)}
    <div class="toast toast-{toast.type}" role="alert">...</div>
  {/each}
</div>
```

**CSS changes** — Move `position: fixed` and positioning from `:global(.toast-container)` to the now-local `.toast-container`:

```css
.toast-container {
  position: fixed;
  top: var(--space-lg);
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  pointer-events: none;
}

/* Remove or replace the :global(.toast-container) block */
```

**Centering**: Use `left: 50%; transform: translateX(-50%)` instead of `right: var(--space-lg)` to center the toast horizontally. This looks better on desktop with the sidebar.

**Mobile breakpoint** (`max-width: 480px`): Remove the `:global()` wrapper, set `left: var(--space-md); right: var(--space-md); transform: none; width: auto;` so toasts span the full width with margin.

Entry animation changes from `slideInRight` to `slideInDown` (since toasts now enter from top-center):

```css
@keyframes slideInDown {
  from {
    transform: translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
```

### 2. `src/lib/components/TransactionForm.svelte`

Add `update` parameter and call `await update()`:

```ts
function handleEnhance() {
  return async ({ result, update }: { result: { type: string }; update: () => Promise<void> }) => {
    if (result.type === 'redirect') {
      showSuccess(transaction ? 'Transaction updated successfully' : 'Transaction added successfully');
    }
    await update();
  };
}
```

This ensures SvelteKit follows the redirect after the toast is queued. The toast survives the navigation because module-level `$state` persists across client-side navigation (the layout stays mounted).

---

## Verification

1. Run `npm run dev`
2. **Toast centering**: Submit a form → verify toast appears centered at top of viewport, not off to the right
3. **Toast stacking**: Submit multiple forms → verify toasts stack vertically centered
4. **Mobile responsive**: Resize to <480px → verify toast spans full width with margins, positioned at top
5. **Transaction add**: Fill form on `/transactions/new`, submit → verify redirect to `/transactions` + toast
6. **Transaction edit**: Edit on `/transactions/1/edit`, submit → verify redirect + toast
7. **Form values cleared**: After navigation to `/transactions`, navigate back to add form → verify empty form
8. **Category create**: Add a category → verify form panel closes + toast
9. **Build**: Run `npm run build` for compilation check

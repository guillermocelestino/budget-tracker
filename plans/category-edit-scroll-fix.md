# Auto-Scroll to Form on Edit Plan

## Context

When a user clicks the **Edit** button on a category card:
1. The edit form appears at the top of the page
2. On desktop with long category lists, the form may be off-screen
3. User must manually scroll up to see the form

**Goal:** Automatically scroll to the form when edit is triggered.

---

## Approaches

### Approach 1: Simple Scroll to Top (Recommended for Desktop)

```typescript
function openEdit(cat: Category) {
  editingCategory = cat;
  formError = '';
  showForm = true;
  // Scroll to top of page
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
```

**Pros:** Simple, works well on desktop
**Cons:** On mobile, might feel abrupt since forms often appear in better positions

---

### Approach 2: Scroll to Form Element

Use a `bind:this={formPanel}` and scroll to that specific element:

```typescript
let formPanel: HTMLElement;

function openEdit(cat: Category) {
  editingCategory = cat;
  formError = '';
  showForm = true;
  // Scroll to form panel specifically
  setTimeout(() => {
    formPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100); // Small delay for DOM to render
}
```

**Pros:** Scrolls exactly to the form, not just top of page
**Cons:** Slightly more complex, needs `bind:this`

---

### Approach 3: Platform-Aware Scroll

Only auto-scroll on desktop, let mobile handle it naturally:

```typescript
function openEdit(cat: Category) {
  editingCategory = cat;
  formError = '';
  showForm = true;

  // Only auto-scroll on desktop (not mobile)
  if (window.innerWidth >= 768) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
```

**Pros:**
- Desktop users get the form brought into view
- Mobile users don't get interrupted mid-scroll
- Mobile forms often appear in better positions (bottom sheet, full-screen modal style)

**Cons:** Slightly more complex

---

## Recommendation

**Approach 3 (Platform-Aware)** is recommended:

| Platform | Behavior |
|----------|----------|
| Desktop (≥768px) | Auto-scroll to top with smooth animation |
| Mobile (<768px) | No forced scroll - let user scroll naturally |

The reason: On mobile, the UI typically adapts differently (form may overlay or appear in a more accessible position), so forced scrolling can feel intrusive.

---

## Implementation

### File to Modify
- `src/routes/categories/+page.svelte`

### Change in `openEdit` function:

```typescript
function openEdit(cat: Category) {
  editingCategory = cat;
  formError = '';
  showForm = true;

  // Auto-scroll on desktop only
  if (typeof window !== 'undefined' && window.innerWidth >= 768) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
```

### Optional: Also scroll for "Add Category"

```typescript
function openAdd() {
  editingCategory = null;
  formError = '';
  showForm = true;

  if (typeof window !== 'undefined' && window.innerWidth >= 768) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/routes/categories/+page.svelte` | Add scroll behavior in `openEdit()` and optionally `openAdd()` |

---

## Verification

1. **Desktop - Edit Category:**
   - Scroll down the category list
   - Click edit on a card near the bottom
   - Page should smoothly scroll to show the form at top

2. **Desktop - Add Category:**
   - Same test with "Add Category" button
   - Should scroll to form

3. **Mobile:**
   - Same tests
   - Should NOT auto-scroll (natural scroll position maintained)
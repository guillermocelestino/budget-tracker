# UI Enhancement Plan — Budget Tracker

## Context

The app has a functional but basic UI. The CSS custom properties provide a solid foundation but components repeat styles inconsistently, the visual hierarchy can be flatter than desired, and there are several polish opportunities to make the app feel more professional and modern for everyday budget tracking.

This plan focuses on **incremental, high-impact changes** — refining what exists rather than a full redesign. Each section is ordered roughly by effort (low → medium).

---

## 1. Design System Hardening

### 1.1 Standardize button styles (shared component)

**Problem:** Button styles (`.btn-primary-sm`, `.btn-danger`, `.btn-cancel`, `.btn-filter`, `.btn-clear`, `.btn-primary-link`) are redefined in every page with slightly different values.

**Fix:** Create a shared `Button` component or consolidate button classes into a global stylesheet.

**Files:**
- `src/lib/components/` (new `Button.svelte` or shared CSS)
- `src/routes/+page.svelte`
- `src/routes/transactions/+page.svelte`
- `src/routes/categories/+page.svelte`
- `src/routes/login/+page.svelte`

**Pattern:**
```svelte
<Button variant="primary" size="sm" href="/transactions/new">+ Add Transaction</Button>
<Button variant="danger" on:click={handleDelete}>Delete</Button>
<Button variant="ghost" on:click={handleCancel}>Cancel</Button>
```

### 1.2 Fix PwaUpdate hardcoded values

**Problem:** PwaUpdate uses raw CSS values (`0.5rem`, `0.75rem`) instead of `var(--space-sm)`, `var(--space-md)`.

**Fix:** Replace hardcoded values with CSS custom properties.

**File:** `src/lib/components/PwaUpdate.svelte`

### 1.3 Add `--radius-xl` usage

**Problem:** `--radius-xl: 16px` is defined in variables.css but never used anywhere. Consider using it for the login card or sidebar for a more premium feel.

### 1.4 Fix invalid CSS in SummaryCards

**Problem:** Line 102 uses `composes: card-value` (CSS Modules syntax) in a `.svelte` file — it's invalid and does nothing.

**Fix:** Remove the invalid rule.

**File:** `src/lib/components/SummaryCards.svelte`

---

## 2. Visual Polish (Medium Effort)

### 2.1 Elevate shadows

**Problem:** `--shadow-sm: 0 1px 2px rgba(0,0,0,0.05)` is barely perceptible. Cards, the sidebar, and form panels don't feel elevated.

**Fix:** Increase shadow depth:
```css
--shadow-sm: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
--shadow-md: 0 4px 12px rgba(0,0,0,0.08);
--shadow-lg: 0 12px 24px rgba(0,0,0,0.12);
```
Then add subtle hover-elevation on clickable cards (category cards, summary cards).

**Files:** `src/styles/variables.css`, `src/lib/components/CategoryList.svelte`, `src/lib/components/SummaryCards.svelte`

### 2.2 Softer border colors

**Problem:** `--color-border: #e0e0e0` is quite visible and makes the UI feel busy. Softer borders reduce visual noise.

**Option A:** Change to `#e5e7eb` (Tailwind gray-200, slightly warmer).
**Option B:** Change to `#e8e8e8` with reduced-opacity in card borders.

**File:** `src/styles/variables.css`

### 2.3 Improve empty states

**Problem:** Empty states are just centered italic text — uninspiring for a first-time user.

**Fix:** Add illustration-like emoji art + clearer messaging + CTA for each empty state:
- **Dashboard (no transactions):** Show a larger illustration area with "Start tracking your finances" heading
- **Transactions (no results):** "No transactions match your filters" with clear filters button
- **Categories (no categories):** "Create your first spending category"

**Files:** `src/routes/+page.svelte`, `src/routes/transactions/+page.svelte`, `src/routes/categories/+page.svelte`, `src/lib/components/TransactionList.svelte`, `src/lib/components/CategoryList.svelte`

### 2.4 Add subtle card hover states

**Problem:** Category cards and summary cards have no hover interaction.

**Fix:** Add `transition: transform 150ms, box-shadow 150ms` + hover `transform: translateY(-2px)` + elevated shadow to clickable/actionable cards.

**Files:** `src/lib/components/CategoryList.svelte`, `src/lib/components/SummaryCards.svelte`

### 2.5 Fix transaction card border colors on mobile

**Problem:** Mobile transaction cards always show `border-left: 4px solid var(--color-primary)` regardless of type. The CSS classes `.txn-card.income` / `.txn-card.expense` are defined but never applied.

**Fix:** Apply the correct class based on `transaction.type` so income cards get green border and expense cards get red border.

**File:** `src/lib/components/TransactionList.svelte`

### 2.6 Smooth dashboard number transitions

**Problem:** Summary card values jump on update (no animation).

**Fix:** Add a CSS transition or a simple count-up animation on mount for the numeric values in `SummaryCards`.

**File:** `src/lib/components/SummaryCards.svelte`

---

## 3. Layout & Responsive Improvements (Medium Effort)

### 3.1 Add sidebar collapse/expand toggle on desktop

**Problem:** The sidebar is always 240px wide on desktop, taking up valuable horizontal space.

**Fix:** Add a collapse toggle that shrinks the sidebar to icon-only (e.g., 60px) with tooltip labels. Remember preference in `localStorage`.

Alternatively: Keep it simple and just make the sidebar slightly narrower (`--sidebar-width: 220px`).

**Files:** `src/lib/components/Sidebar.svelte`, `src/styles/variables.css`

### 3.2 Improve transaction filter bar

**Problem:** The filter bar has 4 inputs + 2 buttons in a flex-wrap row that looks messy.

**Fix:** Use a collapsible filter panel with a "Filters" toggle button. Show active filter count as a badge on the toggle. On desktop, show inline; on mobile, stack vertically in a dropdown panel.

**File:** `src/routes/transactions/+page.svelte`

### 3.3 Unify responsive breakpoints

**Problem:** Different pages use different breakpoints (768px for sidebar, 640px for content, 480px for tables, 480px/640px for forms).

**Fix:** Standardize to two breakpoints:
- `768px` (tablet/mobile): sidebar collapses, grids go single-column
- `480px` (phone): table → card switch, form actions stack

**Files:** Multiple — audit across all components.

### 3.4 Add max-width constraint on form pages

**Problem:** Form container is `max-width: 600px` with centered margin which works well — but on wide screens the form feels narrow compared to the main content area.

**Fix:** Widen to `max-width: 640px` and add a subtle left-aligned layout on desktop (not centered) for a less floating feel.

**Files:** `src/routes/transactions/new/+page.svelte`, `src/routes/transactions/[id]/edit/+page.svelte`

---

## 4. Accessibility Improvements (Low-Medium Effort)

### 4.1 Add focus trap to modal

**Problem:** Keyboard focus can escape the modal dialog, allowing users to tab behind the overlay.

**Fix:** Implement a focus trap using `svelte:window` `keydown` events that cycles focus within modal elements.

**File:** `src/lib/components/ModalDialog.svelte`

### 4.2 Add `aria-expanded` to hamburger

**Problem:** The mobile hamburger button doesn't communicate its state to screen readers.

**Fix:** Bind `aria-expanded` to `sidebarOpen` state on the toggle button.

**File:** `src/lib/components/Sidebar.svelte`

### 4.3 Close sidebar on Escape key

**Problem:** On mobile, only clicking the overlay or a nav link closes the sidebar. Escape key doesn't work.

**Fix:** Add `svelte:window onkeydown={(e) => e.key === 'Escape' && closeSidebar()}`.

**File:** `src/lib/components/Sidebar.svelte`

### 4.4 Add aria-labels to icon-only buttons

**Problem:** Action buttons (edit, delete, close) rely only on visual icons.

**Fix:** Ensure all icon-only buttons have descriptive `aria-label`.

**Files:** `src/lib/components/TransactionList.svelte`, `src/lib/components/CategoryList.svelte`, `src/lib/components/ModalDialog.svelte`

### 4.5 Make sortable headers keyboard-accessible

**Problem:** Sortable table headers (Date, Amount) are `<th>` elements with `on:click` but no keyboard activation.

**Fix:** Either add `<button>` wrappers or add `tabindex="0"` + `on:keydown` handler for Enter/Space.

**File:** `src/lib/components/TransactionList.svelte`

---

## 5. Animation & Micro-interactions (Low Effort)

### 5.1 Add page transition

**Problem:** Page changes are instant with no visual feedback.

**Fix:** Add a subtle fade transition on the main content area using SvelteKit's `{#key}` block and CSS transitions or Svelte's `transition:fade`.

**Files:** `src/routes/+layout.svelte`

### 5.2 Add loading states

**Problem:** No loading skeletons or spinners. If a page load is slow, the user sees nothing.

**Fix:** Add a simple CSS-only loader (pulsing skeleton) for the dashboard summary cards and transaction list that shows while the server load function responds. Use the SvelteKit `navigating` store.

**Files:** `src/routes/+page.svelte`, `src/lib/components/SummaryCards.svelte` (or parent page)

### 5.3 Add toast entrance sound (optional)

**Problem:** No audio feedback for success/error toasts.

**Fix:** This is optional/low-priority. Could use the Web Audio API for subtle chimes.

### 5.4 Smooth progress bar animation

**Problem:** Budget progress bars in category cards animate on width change (250ms), but the fill color changes instantly when crossing thresholds.

**Fix:** Add `transition: width 300ms ease, background-color 300ms ease` to `budget-fill`.

**File:** `src/lib/components/CategoryList.svelte`

---

## 6. Visual Enhancement Details (Low Effort)

### 6.1 Add subtle backdrop blur to sidebar overlay

**Problem:** The mobile overlay is a solid `rgba(0,0,0,0.3)`.

**Fix:** Add `backdrop-filter: blur(4px)` for a modern frosted-glass effect (supported in all modern browsers).

**File:** `src/lib/components/Sidebar.svelte`

### 6.2 Improve login page background

**Problem:** The login page has a solid `var(--color-bg)` background.

**Fix:** Add a subtle gradient or pattern (e.g., a radial gradient glow in the primary color at center, or a subtle geometric pattern).

**File:** `src/routes/login/+page.svelte`

### 6.3 Add category icon to transaction category select

**Problem:** The transaction list shows category pills with proper colors. But the transaction form shows "📁 Name" in the select, which works but could be visually richer.

**Fix:** Already exists (icon + name in options). Sufficient as-is.

### 6.4 Pagination styling

**Problem:** Pagination buttons have basic styling with `opacity: 0.5` for disabled state.

**Fix:** Make the current page visually distinct (solid primary background). Add hover states.

**File:** `src/routes/transactions/+page.svelte`

---

## 7. Potential "Nice-to-Have" Additions

- **Dark mode** — CSS variables are set up for it; just need a toggle + a matching `[data-theme="dark"]` palette. Medium effort.
- **Drag-to-reorder categories** — Low priority but would make the category management feel more interactive.
- **Inline editing on transaction amount** — Double-click to edit inline in the table. Medium effort.
- **Mini sparkline chart on summary cards** — Show 6-month trend as a small sparkline. Low priority.
- **Dashboard greeting** — "Good morning, [username]" based on time of day. Very low effort, adds personality.

---

## Suggested Priority Order

| Priority | Items | Effort |
|---|---|---|
| **P0 — Quick wins** | 1.1 (standardize buttons), 1.2 (PwaUpdate vars), 1.4 (fix composes), 2.5 (card borders), 3.3 (unify breakpoints), 4.2 (aria-expanded), 4.3 (Escape closes), 5.4 (budget bar), 6.1 (backdrop blur) | Low |
| **P1 — Visual polish** | 2.1 (shadows), 2.2 (border color), 2.3 (empty states), 2.4 (card hovers), 6.2 (login bg), 6.4 (pagination) | Low-Med |
| **P2 — UX improvements** | 3.2 (filter bar collapse), 5.1 (page transition), 5.2 (loading states), 3.4 (form width) | Medium |
| **P3 — Accessibility** | 4.1 (focus trap), 4.4 (aria-labels), 4.5 (keyboard sort) | Low-Med |
| **P4 — Stretch** | 3.1 (sidebar collapse), 7 (dark mode, sparklines, inline edit) | Medium+ |

---

## Files Likely to Be Touched (ordered by number of changes)

| File | Changes |
|---|---|
| `src/styles/variables.css` | Shadow depths, border color, potentially sidebar width |
| `src/lib/components/Sidebar.svelte` | Aria-expanded, Escape close, backdrop blur, collapse toggle |
| `src/lib/components/TransactionList.svelte` | Mobile card borders, keyboard sort headers, aria-labels |
| `src/lib/components/CategoryList.svelte` | Hover states, budget bar transition |
| `src/lib/components/SummaryCards.svelte` | Fix composes rule, hover state, loading skeleton |
| `src/lib/components/ModalDialog.svelte` | Focus trap, aria-labels |
| `src/lib/components/PwaUpdate.svelte` | Use CSS variables |
| `src/routes/+layout.svelte` | Page transition |
| `src/routes/+page.svelte` | Empty state, loading state |
| `src/routes/transactions/+page.svelte` | Filter bar collapse, empty state, pagination styling |
| `src/routes/categories/+page.svelte` | Empty state |
| `src/routes/login/+page.svelte` | Background gradient |
| `src/routes/transactions/new/+page.svelte` | Form width |
| `src/routes/transactions/[id]/edit/+page.svelte` | Form width |
| New: `src/lib/components/Button.svelte` | Shared button component |

---

## Verification

After each phase of changes, verify:

1. **Build:** `npm run build` — no errors
2. **Tests:** `npm test` — all 17 tests pass
3. **Visual:** Run the app locally and check:
   - Login page renders correctly
   - Dashboard, Transactions, Categories, Reports all look cohesive
   - Responsive at 768px and 480px breakpoints (Chrome DevTools device toolbar)
   - Form inputs have consistent focus states
   - Empty states are helpful, not jarring
   - Toasts and modals animate smoothly
   - Sidebar opens/closes correctly on mobile
4. **Accessibility (basic):**
   - Tab through a modal → focus stays trapped
   - Tab through the transaction table → sortable headers are reachable
   - Screen reader reads hamburger state as "expanded" / "collapsed"

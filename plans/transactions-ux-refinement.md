# Plan: Transactions Page — UX Refinement (Inspired by Lending/Borrowing)

## Objective
Refine the **Transactions** add/edit experience by adopting the interaction principles, information hierarchy, and visual confidence established by the **Lending/Borrowing** module, tailored to single-event financial entries.

---

## Flip7 Form Design Pattern

All Flip7 form surfaces follow this universal interaction flow:

> **Classification → Context → Value → Metadata → Impact → Commit**

This reusable pattern governs **Transactions, Lending, Recurring, Categories**, and future financial modules.

---

## Component Responsibilities & Architectural Boundaries

- **`+page.svelte`**:
  - Owns page data loading (`data`)
  - Owns derived monthly statistics (`spendingMap`, `categoryTxnCounts`)
  - Owns active selected transaction (`editingTransaction`) and drawer open state
- **`SlideOver.svelte`**:
  - Controls drawer visibility (`open`)
  - Controls drawer overlay lifecycle
  - Does NOT own form logic or form data
- **`TransactionForm.svelte`**:
  - Owns local form inputs (`type`, `category_id`, `rawAmount`, `description`, `date`, `isRefund`)
  - Emits submission and cancellation events (`use:enhance`, `onCancel`)
  - Renders Context Card and `<LiveImpactPreview>`
- **`ContextCard`**:
  - Pure presentation
  - Receives props only; performs zero data fetching
- **`<LiveImpactPreview.svelte>`**:
  - Pure presentation
  - Receives derived calculation values only (`currentTotal`, `projectedTotal`, `type`, `isRefund`, `categoryName`)

---

## Non-Goals (Scope Boundary)
This refinement does NOT:
- Change transaction calculations or formulas
- Change validation rules
- Change server actions, API handlers, or database queries
- Change routes or navigation paths (`/transactions`, `/transactions/new`, `/transactions/[id]/edit`)
- Change the database schema
- Introduce budget modules or forecasting logic
- Introduce recurring transaction logic

---

## Key Principles & Architectural Guarantees

1. **Presentation-Agnostic Component Architecture**:
   `TransactionForm.svelte` remains strictly presentation-agnostic (decoupled from `SlideOver`). The form functions identically whether rendered inside `SlideOver.svelte`, standalone fallback pages (`/transactions/new`, `/transactions/[id]/edit`), future modal dialogs, or unit tests (matching `RecurringForm.svelte`).

2. **Single Source of Truth**:
   The parent page owns all data loading, transformations, and aggregations. `TransactionForm.svelte` receives all context data (categories, spending totals, transaction counts) strictly via props and only renders the supplied data. It **never** fetches its own data or executes API calls.

3. **Selective Memoization via Svelte 5 `$derived`**:
   Derived statistics and previews must be memoized using Svelte 5 `$derived`. Changing unrelated metadata fields (Description, Date, Notes) must **not** trigger recalculation of monthly statistics or live previews. Recomputations occur **only** when dependent values change (`type`, `category_id`, `rawAmount`, `isRefund`).

4. **Reusable `LiveImpactPreview` Component**:
   Extract a standalone `<LiveImpactPreview.svelte>` component under `src/lib/components/`. It accepts explicit props (`currentTotal`, `projectedTotal`, `type`, `isRefund`, `categoryName`), performs zero data fetching, and simply renders derived values.

5. **Derived UI Only (Svelte 5 Runes Guardrail)**:
   Context Card and Live Impact Preview values must always derive directly from current form state (`$state`) and parent-provided props using `$derived`. **Never** mirror or sync these values into separate writable state or `$effect` hooks.

6. **Immediate Rendering from Parent State**:
   Since all context statistics are pre-loaded by the parent page, the Context Card renders immediately from parent props without artificial loading spinners or skeleton delays.

7. **Monthly Context Definition**:
   All "this month" statistics follow the currently selected month in the Transactions page (if a month filter exists). Otherwise, they default to the user's current calendar month. The form never computes these values itself; it displays the values supplied by the parent.

8. **Informational Live Preview**:
   The Live Impact Preview is display-only and informational. It does not affect validation, calculations, or saved values.

9. **Impact-Centric, Not Budget-Centric**:
   All context and preview cards focus on transaction statistics and totals rather than assuming budget modules or limits exist.

---

## 1. Component Architecture & Reusable Component Definition

### [NEW] `src/lib/components/LiveImpactPreview.svelte`
- **Props**:
  - `currentTotal: number`
  - `projectedTotal: number`
  - `type: 'expense' | 'income'`
  - `isRefund?: boolean`
  - `categoryName?: string`
- **Behavior**:
  - Render-only component; performs no data fetching.
  - Hidden when amount is 0 or empty (`projectedTotal === currentTotal`).
  - Animates in when `projectedTotal !== currentTotal`, displaying stacked format:
    ```
    Monthly Total
    ₱8,450
    ↓ After saving
    ₱8,950
    ```

---

## 2. SlideOver Behavior & Navigation Fallbacks

### Drawer Closing & State Rules:
- **Add Transaction**: Opening always initializes a fresh form state.
- **Edit Transaction**: Opening always populates the selected transaction.
- **Closing Drawer**: Unsaved changes are intentionally discarded when the drawer closes via Cancel button, Close (X) icon, ESC key, or backdrop click. No confirmation dialog is shown in v1.

### Presentation Integration:
- In `src/routes/transactions/+page.svelte`, host `<TransactionForm>` inside `<SlideOver>` driven by state `isFormOpen` and `editingTransaction`.
- Retain `/transactions/new` and `/transactions/[id]/edit` pages as presentation wrappers around `<TransactionForm>` for direct URL access without SlideOver-specific couplings.

---

## 3. Information Hierarchy & Progressive Disclosure

The form hierarchy follows the **Flip7 Form Design Pattern**:

```
1. Header
2. Type Toggle (Expense / Income)
3. Category Selector (Classification)
4. Context Card (Appears/populates immediately upon selecting Category)
5. Amount Section (Value - With existing -/+ ₱500 step controls)
6. Description Input (Metadata)
7. Date Picker (Metadata - With "Today" quick button)
8. Refund Toggle (Metadata - With plain-language helper text)
9. Live Impact Preview (Impact - <LiveImpactPreview> animates in when Amount > 0)
10. Footer (Commit - Standardized 2-column equal primary/cancel grid)
```

---

## 4. Context Card (Triggers & Edit Hierarchy)

Positioned immediately below Category selection:

- **Update Triggers**:
  The Context Card updates immediately whenever the selected Type, Category, or editing transaction changes (including switching between Edit Target A and Edit Target B without remounting).
- **Add Mode — No Category Selected**:
  Hidden or displays subtle prompt: `Select a category to view monthly activity.`
- **Add Mode — Category Selected (Expense)**:
  `Food & Dining` • `24 transactions this month` • `Spent this month: ₱8,450`
- **Add Mode — Category Selected (Income)**:
  `Salary` • `Income this month: ₱35,000`
- **Edit Mode (Clear Information Hierarchy)**:
  ```
  Editing Transaction

  Food & Dining

  Original transaction
  ₱250 Expense • Created Aug 2, 2026

  This month
  24 transactions • ₱8,450 spent
  ```
- **In-Place Transition Rule**:
  Once mounted, the Context Card remains mounted when switching between categories or editing targets; only its values transition in place without unmounting/re-mounting flickering.

---

## 5. Visual Refinements, Animations & Polish

- **Category Chips**: Refine with stronger selected state, clearer active border, and richer background tint.
- **Refund Toggle**: Placed below Date input with clear helper copy: *"Record this transaction as a refund or reimbursement."*
- **Footer**: Follow existing Flip7 primary button styling and secondary ghost styling in an equal 2-column grid (`1fr 1fr`).
- **Animations**: Animate preview card appearance (slide/fade in when amount > 0 entered), value updates, and chip selection. Respect `prefers-reduced-motion`. Do not animate layout shifts.

---

## 6. UX Guardrails

- Context cards are informational only and must never block data entry.
- Live Impact Preview supplements validation; it never replaces validation messages.
- The user must be able to complete the form without reading the Context Card or Live Preview.
- Context Card and Live Preview should enhance confidence, not introduce additional required decisions.
- Prefer updating existing UI in place over mounting and unmounting components whenever possible.

---

## 7. Verification Plan

### Automated Verification
- `npm run lint` — Confirm 0 ESLint errors.
- `npm run check` — Confirm 0 TypeScript / Svelte compilation errors (`svelte-check`).

### Manual & Regression Verification
- **Architecture Boundaries**: Confirm `TransactionForm`, `ContextCard`, `LiveImpactPreview`, `SlideOver`, and `+page.svelte` strictly adhere to assigned responsibilities.
- **Selective Memoization**: Verify typing into Description, Date, or Notes does **not** trigger recalculation of monthly statistics or previews.
- **Component Decoupling**: Verify `<LiveImpactPreview.svelte>` functions purely from props without API calls.
- **Progressive Disclosure & In-Place Transitions**: Verify Context Card populates immediately upon selecting Category and transitions smoothly in-place when switching Type, Category, or Edit Target.
- **Edit Context Hierarchy**: Verify original entry details and current monthly activity are cleanly separated in Edit Mode.
- **Conditional Stacked Preview**: Verify Live Preview is hidden when amount is 0/empty, and animates in with stacked numbers derived from parent stats when amount > 0 is entered.
- **Immediate Rendering from Parent State**: Confirm no fake skeleton delays when opening the drawer.
- **Svelte 5 Runes Compliance**: Confirm zero `$effect` sync loops or duplicated writable states for derived UI.
- **Unsaved Discard Test**: Open and close SlideOver drawer via Cancel, X, ESC, and backdrop to ensure state resets cleanly.
- **Fallback Route Verification**: Verify `/transactions/new` and `/transactions/[id]/edit` render the identical `TransactionForm`.
- **Mobile Stacking**: Verify 100% full-width stacked buttons and controls on mobile viewports (<640px).

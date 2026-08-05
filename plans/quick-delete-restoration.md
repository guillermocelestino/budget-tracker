# Quick-Delete Restoration — Transactions, Lending, Borrowed

Restores Delete to the hover cluster as the LAST action with danger treatment,
sharing the existing confirmation flow. **Not** Recurring.

Editable files (strict): `TransactionList.svelte`, `ActiveIouList.svelte`,
`RowHoverActions.svelte`. RecurringList untouched.

## Approved amendments (same diff)

1. **ActiveIouList width math** — verify (no cell widening needed, but stated):
   - Register `.row-actions` is an absolute overlay anchored
     `right: calc(48px + 116px + var(--space-sm))` = **172px** = the amount
     column's left edge → the cluster (widest ≈ 257px with pay pill +
     edit + dup + delete) extends LEFT from that anchor and can never cover
     amount or kebab at any width; `overflow: hidden` on `.iou-row` never
     clips it (left edge stays inside the row down to 641px). No fixed
     actions cell exists → nothing < 197px to widen.
   - Card `.iou-actions` is in-flow inside `.iou-right` (flex column), below
     the amount → structurally cannot cover the amount; no fixed cell.
2. **`.quick-divider` uses `margin-inline: 4px`** (symmetric 8/8 zone: flex gap
   4px + 4px margin each side), not margin-left only.
3. **Delete is appended conditionally** (`...(onDelete ? [{ delete }] : [])`)
   in TransactionList and both ActiveIouList variants — no dead buttons when
   the page supplies no delete handler (and no divider, since no danger action).
4. **Verification = `npm run lint` AND `npm run check`.**

---

## 1. RowHoverActions — divider before first danger action

The `tone: 'danger'` support **already exists** in the shared component
(`tone-danger` → `--rose-soft` tile + `--rose` glyph on the button's own
hover/focus; `--muted` glyph at rest, 44px footprint, `--focus` ring, tooltip
from `label`). Two additions:

- **Script:** `const firstDangerIndex = $derived(actions.findIndex(a => a.tone === 'danger'))`.
- **Template:** inside the `{#each actions as a, i (a.id)}`, render
  `<span class="quick-divider" aria-hidden="true"></span>` immediately before
  the item where `a.tone === 'danger' && firstDangerIndex === i && i > 0`
  (guard: never a leading divider).
- **CSS:**
  ```css
  .quick-divider {
    width: 1px; height: 16px; flex-shrink: 0;
    background: var(--line); margin-inline: 4px;  /* symmetric 8/8 zone */
  }
  ```
  Flex gap 4px + margin-inline 4px each side = 8px before and 8px after the
  divider → delete reads as a separate zone, not a fourth sibling.

No second hover implementation; reveal/opacity/reduced-motion untouched.

## 2. TransactionList — [edit, duplicate, delete]

- Add `trashIcon()` snippet (standard stroke trash, 18px, matches the delete
  modal icon).
- Append to the cluster actions (both grouped + flat share the `bankRow`
  snippet):
  `{ id: 'delete', label: 'Delete', icon: trashIcon, tone: 'danger', onClick: () => onDelete?.(txn.id) }`
- Kebab (RowActionsMenu) already has delete → unchanged. Inline edit panel
  Delete unchanged.
- **Flat register ≥1200px reserved column:** 148px → **204px** in both the
  normal and `.selecting` grids (header + rows). Math: 3 in-flow buttons
  (132px) + 3 flex gaps (12px) + symmetric divider (1 + 4 + 4 = 9px) = **153px**
  cluster; + 4px col gap + 44px kebab = **201px** required, and `.flat-register`
  has `overflow: hidden` — a 148px track would clip Delete. 204px keeps 3px
  slack.
  Amount/BAL columns keep their widths; only the trailing track grows.
  Grouped ≥1200px reserved column stays 232px (fits 197px).

## 3. ActiveIouList — [pay, edit, duplicate, delete]

- Add `trashIcon()` snippet.
- **Card view** actions reorder + append:
  `[{ pay pill }, { edit }, { duplicate }, { delete }]` — pay keeps its labeled
  pill, now first. Paid ious still render the `Recovered` glow (no actions).
- **Register view** actions append:
  `[{ pay pill? }, { edit }, { duplicate }, { delete }]` — pay pill stays
  conditional on `status !== 'paid'`.
- Delete action: `{ id: 'delete', label: 'Delete', icon: trashIcon, tone: 'danger', onClick: () => onDelete?.(iou.id) }`.
- Kebab already carries delete (RowActionsMenu `onDelete`) → unchanged.
- Both Lending AND Borrowed render this component (verified: lending +page
  line 309, borrowed +page line 320) → one edit covers both.

## 4. Safety flow — already confirmed, no new toast

Verified: the kebab delete is **not** instant on any of the three pages —
every path opens a confirmation modal:
- Transactions: `onDelete → deleteTarget` → "This action cannot be undone" modal.
- Lending: `onDelete → deleteId` → "Delete Lending" modal.
- Borrowed: `onDelete → deleteId` → "Delete Borrowing" modal.

Quick-delete calls the same `onDelete?.(id)` → same modal → same form action.
The safety net is preserved; no 6s undo toast is added (per the spec's
conditional).

## 5. Kept behaviors
Delete stays in ⋯ (touch) · hover-gated clusters stay hidden on touch
(ActiveIouList's mobile register bar keeps its existing force-visible pattern) ·
row-tint-first reveal · 140ms fade · reduced-motion instant · no hover layout
shift (absolute/reserved column) · cluster never covers BAL/amount/kebab.

## Anti-patterns
Delete always last · no instant silent delete from any path · danger styling
only on `tone: 'danger'` · Recurring untouched · no second hover implementation ·
no edits outside the three allowed files.

## Verification
`npm run lint`. Visual QA: transactions grouped + flat at <1200px overlay and
≥1200px reserved column (Delete visible, not clipped); lending + borrowed card
and register views; pay pill intact; divider only before Delete; Recurring
cluster unchanged; light + dark.

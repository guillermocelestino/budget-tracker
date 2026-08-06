# Record Payment Modal — UI Polish Pass (revised)

Single-file change to `src/lib/components/RecordPaymentModal.svelte`. Presentation/interaction only —
**visual polish only. Existing functionality must remain unchanged.** No business logic, validation,
server actions, types, or shared components touched.

> Approved plan lives at `~/.claude/plans/things-i-d-improve-1-reflective-key.md`; this file mirrors it.

## Constraints discovered (drives the approach)

1. **Header title & close button live in `ModalDialog.svelte`** (shared infra, off-limits).
   - Subtitle goes at the top of the modal body as a muted `<p>`, right under the header.
   - Close button stays aligned automatically (we don't touch `ModalDialog`).
   - During submit the close button can't be *visually* disabled from here, so we **functionally** guard it:
     pass `onclose={submitting ? undefined : onclose}` — blocks close, ESC, and backdrop during submit.
2. **`.btn-teal` is shared** (`PaymentHistoryPanel`, `EditPaymentModal`) → no global `:global(.btn-teal)` override.
   - Overrides are scoped via a `.footer-actions` wrapper: `.footer-actions :global(.btn-teal) { … }` (descendant selector stays inside this modal).
3. **No character counter exists today** → add a minimal one (`{notes.length} / 500`) under the textarea; styled small + low-opacity per §9.
4. **`--color-rose` is not a defined token** → use the defined `--rose` / `--rose-soft` for borrowed styling.
5. **Footer pinned / body scrolls** without touching `ModalDialog`: flex-based, viewport-aware (see below), not a magic number.

## New DOM order

```
ModalDialog
  ├─ .modal-shell (flex column, viewport-aware max-height)
  │    ├─ subtitle (muted)                                  §1
  │    ├─ Context card (avatar · name · Lent • date · Loan #id)   §2
  │    │    ⚠ replaces the existing centered payment-icon block ENTIRELY — do NOT render both
  │    ├─ Summary card (Original/Collected/Written Off/Remaining)  §3
  │    └─ <form> (flex: 1; min-height: 0; flex column)
  │         ├─ .modal-scroll (the only scrollable region)
  │         │    ├─ Payment/Write-off toggle               §4  (aria-pressed, focus ring, richer active)
  │         │    ├─ Amount input                           §5  (+ contextual helper text)
  │         │    ├─ Settlement pill (conditional)          §8  (transition:fade)
  │         │    ├─ LIVE Preview card                      §6/7 (updates as the amount changes)
  │         │    ├─ Date                                   §9
  │         │    ├─ Notes (+ char counter)                 §9
  │         │    └─ Create Transaction card                §10 (transition:fade on write-off switch)
  │         └─ .modal-footer                               §11 (pinned, one row)
  │              ├─ Cancel (LEFT)
  │              └─ Primary (RIGHT)
```

## Key decisions

- **Context card replaces the icon**: Remove the existing `.modal-icon-wrap` (centered wallet icon) entirely.
  Render the borrower context card in its place. **Never both.** Card = initials avatar (teal ring for lent,
  rose for borrowed — matches existing `.summary-value.teal/.rose`), bold borrower name, `Lent • {formatDate(date_lent)}`
  (or `Borrowed`), and a `Loan #{id}` pill.
- **Live preview**: The preview card is explicitly a **live preview — it updates as the user types the amount**,
  which is why it sits directly below the Amount field (Amount → Preview → Date → Notes → Create Transaction).
  - Title `After this payment`; `Remaining` value at `--font-size-xl` (largest value on the card); 9px rounded
    progress bar (`transition: width 300ms`); caption stacked on two lines (`₱9,000.00 of ₱12,000.00` / `75% paid`).
  - Reserved `min-height` on `.preview-body` so the card never shifts between empty and full states.
  - When `inputAmount === 0` → muted `No changes yet`, visually neutral.
- **Helper text** (§5): initial → `Available to record: ₱…` · partial → `You'll still have ₱… remaining.`
  · complete → `This payment will complete this lending.` (write-off variant) · invalid (over remaining) →
  `Cannot exceed remaining balance.` (rose tint). Display-only — validation untouched.
- **Preview numeric animation** (§13): **this component has no WAAPI today** → do **not** invent a JS animation.
  Use a simple CSS opacity transition: a tiny `$effect` swaps inline `opacity` (`0.4 → 1`) on `.preview-value`
  which has `transition: opacity 200ms`. Progress width via CSS transition; settlement pill + create-tx via Svelte `transition:fade`.
  All respect `prefers-reduced-motion`.
- **Scroll region** (§11, viewport-aware — no hardcoded `400px`):
  - `.modal-shell`: `display: flex; flex-direction: column; max-height: calc(100dvh - 110px)` where **110px is only
    the stable `ModalDialog` chrome** (header ≈48 + body padding 32 + backdrop padding 24) — not content-dependent.
  - Inside: fixed-above content `flex-shrink: 0`; the form is `flex: 1; min-height: 0; display: flex; flex-direction: column`;
    `.modal-scroll` is `flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden`;
    `.modal-footer` is `flex-shrink: 0`.
  - Result: footer always fully visible on screens as small as **600px tall**; only the field region scrolls;
    no horizontal scrolling.
- **Dynamic button label** (§12): amount suffix span always in DOM (`visibility` toggled) → width reserved from
  the start, **primary button never moves**. `Record Payment` / `Record Write-off` → `• ₱amount`. During submit →
  spinner + `Recording...`, both buttons + close disabled (`submitting` state in the `use:enhance` callback,
  `cancel()` guards double-submit).
- **Footer ordering** (§11): **Cancel on the left, Primary on the right** — explicit, not swapped.
- **Primary/secondary** (§11/12): scoped overrides — primary `background: var(--color-teal)` (richer),
  hover `var(--color-teal-dark)`, shadow **not strengthened on hover**; secondary `color/border: var(--color-teal-dark)`
  for a touch more contrast.
- **Accessibility** (§14): `aria-pressed` on toggle buttons, `aria-live="polite"` + `role="status"` on the live
  preview region. Enter submits / ESC closes / focus order all preserved via the existing form + `ModalDialog`.

## Design tokens used

`--color-teal/teal-dark/teal-bg`, `--rose`/`--rose-soft`, `--color-bg/surface`, `--color-border/hairline`,
`--color-text/--color-text-muted`, `--font-*`, `--radius-*`, `--shadow-sm`, `--focus`, `--transition-*`, `--ease`.
No new tokens, no new dependencies.

## Definition of Done (acceptance checklist)

- ✓ Header remains visible
- ✓ Footer remains pinned
- ✓ Only body scrolls
- ✓ No horizontal scrolling
- ✓ Primary button never moves
- ✓ No CLS/layout shift while typing
- ✓ Works for Payment and Write-off
- ✓ Works on 600px-height viewport
- ✓ `npm run build` passes

Visual polish only. Existing functionality must remain unchanged.

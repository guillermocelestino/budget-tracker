# Dashboard Hero — Mobile Polish Pass (CSS-only)

Goal: elevate the mobile hero toward Apple Wallet / Copilot / Monarch caliber
while preserving Flip7 tokens, the template, logic, animations, and all desktop
(≥769px) styling. Every rule below lives inside `@media (max-width: 768px)`
and/or `@media (max-width: 480px)`.

File: `src/lib/components/DashboardHero.svelte` — style block only.

---

## 1. Net Balance hierarchy

- Merge balance sizing into ONE continuous clamp on ≤768:
  `clamp(30px, 9.5vw, 48px)` → 30px@320 · 34px@360 · 37px@390 · 41px@430.
  Remove the old ≤480 `clamp(1.5rem, 6vw, 2rem)` (24–26px) so there is no
  size discontinuity at the 480/481 boundary. Verified to fit 8-digit amounts
  (e.g. ₱99,999,999.99 ≈ 280px) inside the 294px content width at 320px.
- Savings row → quiet: ≤768 `font-size: var(--font-size-xs)`,
  `font-weight: var(--font-weight-medium)`, `opacity: 0.85`;
  ≤480 adds `margin-top: var(--space-xs)` so it breathes below the balance.

## 2. KPI chips → compact financial status badges (≤768)

- `border-radius: var(--radius-pill)` → `var(--radius-md)` (less button-like).
- `border-color: transparent` (both `.delta-chip` and `.delta-chip.good/.bad`)
  → pure subtle semantic tint, no outline.
- Compact padding `var(--space-xs) var(--space-md)` (≤480: `var(--space-xs) var(--space-sm)`).
- Hierarchy flip: `.delta-label` → `0.75em`, `--font-weight-medium`, `opacity: 0.6`
  (secondary); `.delta-value` → `var(--font-size-sm)`, `--font-weight-extrabold`
  (primary). Drop the old 10px/9px hardcoded chip font sizes.
- Deltas row gap: `--space-sm` at ≤768, `--space-xs` at ≤480.

## 3. Spacing rhythm (8pt)

- `.hero-main-row` gap (balance→chips): `var(--space-lg)` (16px) at ≤768.
- `.hero-content` gap (chips→footer divider): `var(--space-lg)` (16px) at ≤768.
- `.hero-lending-footer` `padding-top` (divider→metrics): `--space-xs` (4px) at
  ≤480 — this is the "reduce gap between divider and metrics" call (current
  is 8px; the flow's "12px" reads as the card's bottom padding instead).
- `.dash-hero` padding bottom: `var(--space-sm)` → `var(--space-md)` at both
  breakpoints so the footer isn't cramped at the card edge.

## 4. Lending footer cohesion (≤480)

- Keep the 3-column grid (`repeat(3, minmax(0, 1fr))`, equal widths).
- `column-gap: var(--space-sm)`; add subtle `border-left: 1px solid
  var(--color-hairline)` on `.hli-item:not(:first-child)` as vertical
  separators. Items stay centered in their own cells → perfect alignment.
- `.hli-label` → `0.75em`, `--font-weight-medium`, `opacity: 0.6` (lighter,
  smaller); `.hli-value` stays `--font-size-xs`, `nowrap`, `tabular-nums`,
  weight 700 + semantic `.tone-*` colors (increased emphasis via contrast).
- `.hli-divider` remains `display: none` (dots gone).

## Verification

- `npm run check` (svelte-check) — no new errors in this file.
- Widths recomputed for 320/360/390/430: balance, chips, and lending values
  all fit without wrapping or clipping (body-font tabular digits ≈ 0.55em:
  an 8-digit amount ≈ 74px at 12px, well under the ~93px columns at 320px).
- Desktop (≥769px), dark mode, and animations untouched.

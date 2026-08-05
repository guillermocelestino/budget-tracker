# Grouped-View Hover Fix — Transactions page (Correction 2)

## Scope
- `src/lib/components/TransactionList.svelte` only (grouped-view markup + host-slot CSS).
- `RowHoverActions` shared component is untouched. Flat register, Recurring, Lending, Borrowed untouched.
- All changes stay inside TransactionList (token is component-local; `variables.css` untouched).

## The bug
In the grouped view the hover cluster is a void overlay anchored by
`right: calc(44px + 90px + 2 * var(--space-sm))`. That brittle calc lands on top
of the BAL cell (edit glyph over the running-balance value, duplicate glyph over
the "BAL" label). Money must stay readable during hover — Correction 1's rule,
now made *structural* in the grouped view.

## 1. Grouped row becomes a grid (641–1199px)
```
grid-template-columns: 28px minmax(0,1fr) auto auto auto
/* circle | main | BAL | amount | kebab */
```
- `.txn-info` (main cell) → `position: relative`.
- The cluster's host `.hover-slot` stays `position: absolute` but gets
  `grid-column: 2 / 3; grid-row: 1 / 2`. Per CSS Grid, an absolutely-positioned
  grid child with definite placement gets that grid AREA as its containing
  block → the cluster is confined to the main column, `right: 8px` short of the
  BAL column. Overlap becomes structurally impossible at every width.
- Selection mode prepends a 28px checkbox track via a new `class:selecting`
  on the `.grouped-list` container (mirrors the flat register).

## 2. ≥1200px — reserved-actions column, one rule both views
```
grid-template-columns: 28px minmax(0,1fr) auto auto 232px
/* circle | main | BAL | amount | reserved-actions */
```
- `.row-actions-col` becomes the flex cell in the last track; hover cluster +
  kebab sit in-flow together (same mechanism as the flat register's existing
  ≥1200px rule). Cluster backdrop is removed there — it has its own space.
- **Interpretation note:** the spec's literal `minmax(0,1fr) 232px auto auto auto`
  is treated as the reserved column LAST (flat-identical). "Identical to the flat
  register / one rule both views" is the controlling instruction; the trailing
  `auto` in the literal listing has no content column. Width 232px kept per spec
  (flat uses 148px; flagged for QA — may be visually gappy).

## 3. <1200px backdrop — `--row-hover-bg` token
- Local token on `.grouped-list`: light `#f0f8f5`, dark `#192b29` (solid
  equivalent of `rgba(43,168,162,0.12)` over `--color-surface` `#161A18`).
- Grouped row hover → `background: var(--row-hover-bg)` (so the band blends
  into the row instead of colliding with title/pill text).
- Cluster backdrop on `:global(.hover-actions)`:
  `linear-gradient(to right, transparent, var(--row-hover-bg) 20px)`, radius
  `--radius-lg`, padded so both glyphs sit fully inside the solid zone. It rides
  the cluster's own opacity reveal — no second hover implementation.

## 4. Kept behaviors
Row tint first, then the 140ms cluster fade; edge-aware tooltips (component
untouched); focus-within reveal; touch devices = kebab only; reduced-motion =
instant. Cluster keeps exactly [edit, duplicate]; delete stays in the kebab.

## Anti-patterns
No glyph over BAL/amount/kebab at any width/theme · no transparent icons over
readable text · no layout shift on hover (absolute / reserved column, opacity-only
reveal) · no second hover implementation · nothing outside the transactions page.

## Verification
`npm run lint` + `npm run check` clean. Visual QA: 641px / ~900px / ≥1200px,
light + dark, selection mode on.

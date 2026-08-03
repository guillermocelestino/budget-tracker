# Dashboard Hero Lending Footer — Mobile Refinement

## Problem

`src/lib/components/DashboardHero.svelte` renders a compact lending footer
(`Lent ₱X • Recovered ₱Y • Owe ₱Z`) at the bottom of the hero, per the design
intent in `dashboard-redesign-refined.md` (single line, `•` dividers, semantic
colors).

At `max-width: 480px` (all phone viewports) the footer switches to
`flex-direction: column; align-items: stretch`, which breaks it:

1. The three `•` divider spans still render — each becomes its own full-width
   flex row with a lone dot, creating stray orphan "•" rows between the
   label/value rows.
2. The column stack is tall (3 rows + 2 stray dots) for a *secondary* footer,
   pushing the hero taller than needed and competing with the delta chips
   directly above it.

## Goal

Keep the footer visually subordinate to the hero. Make the ≤480px treatment
intentional and clean.

## Approach — 3-column mini metric grid at ≤480px

Replace the broken column stack with a compact `3-column grid`, one column per
metric (Lent / Recovered / Owe), each rendered as **small uppercase label over
semantic value** — mirroring the hero's value-first, label-chips language
(the delta chips above already use this stack pattern).

All values use existing Flip7 typography/spacing tokens — no hardcoded pixels
in the new rules:

- `.hero-lending-footer` → `display: grid; grid-template-columns: repeat(3, minmax(0, 1fr))`, `gap: var(--space-xs)`, `padding-top: var(--space-sm)`
- `.hli-item` → `flex-direction: column; align-items: center; gap: var(--space-xs); text-align: center` (consistent vertical alignment across columns)
- `.hli-divider` → `display: none` (dots have no place in the grid)
- `.hli-label` → `--font-size-xs`, `--font-weight-semibold`, `text-transform: uppercase`, `--letter-spacing-wide`; inherits muted color
- `.hli-value` → `white-space: nowrap` + `font-variant-numeric: tabular-nums` (single-line amounts, never wrap); `--font-size-xs` (smallest token) instead of allowing currency to wrap
- `.hero-lending-footer` keeps `border-top` hairline separator
- Semantic tone colors (`--color-gold-dark` / `--color-teal` / `--color-coral`) preserved via `.tone-*` on `.hli-item` — no chip backgrounds, so the footer reads as lightweight supporting metadata, not a second KPI section

Visual hierarchy preserved: **Net Balance → Delta Chips → Lending Footer**.

**≥481px unchanged** — single centered line with `•` dividers (already correct
and per design).

## File touched

- `src/lib/components/DashboardHero.svelte` — CSS only (template unchanged)

## Verification

- `npm run dev` → view `/dashboard` at 390px and 320px widths: footer is one
  clean 3-column row, no stray dots, no overflow.
- Dark mode: no new tokens used; tones are existing semantic colors.
- `prefers-reduced-motion`: no transitions added — nothing to suppress.

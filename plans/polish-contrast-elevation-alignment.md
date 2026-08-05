# Polish Pass — Contrast, Elevation, Alignment & Visual Noise

Scope: subtle visual polish only. **No layout, interaction, or component
architecture changes.** All changes are CSS values or style relocations that
preserve the exact current look.

---

## 1. DateHeaderBand mint contrast (subtle)

`--mint-tint` is shared (CountChip, SummaryCard icons) so it must NOT change.
Add a dedicated band token in `variables.css` next to each theme's `--mint-tint`:

- light: `--mint-band: #d0e5de;` — ≈4% darker than `#d9efe7` (217/239/231 → 208/229/222)
- dark:  `--mint-band: rgba(79, 157, 136, 0.20);` — alpha 0.16 → 0.20 (alpha-based path)

`DateHeaderBand.svelte`: `.date-header { background: var(--mint-tint) }` → `var(--mint-band)`.
Typography, spacing, borders, sticky untouched. CountChip / SummaryCard colors untouched.

## 2. Page background dots — halve texture opacity

`PageBackground.svelte` `.bg-dots { opacity: 0.04 }` → `opacity: 0.02` (≈50% reduction,
preferred option). Grain, glows, dark stack untouched.

## 3. Gold Add button elevation → Material 2–3

Rest-state shadow is `var(--glow-gold)` = `0 4px 20px rgba(255,210,63,0.45)`. Override
locally (do NOT change `--glow-gold` — it's used by hero pill + accent-gold):

- `Button.svelte` `.btn-primary { box-shadow: 0 2px 10px rgba(255, 210, 63, 0.32) }`
  (offset 4→2, blur 20→10, alpha 0.45→0.32). Hover (`0 6px 28px …0.55`) and focus untouched.
- `SpeedDial.svelte` gold trigger rest + active shadow (`box-shadow: var(--glow-gold)`)
  → same reduced value, so the mobile Add FAB matches. Hover untouched.
- Gold color, size, prominence, hover/focus behavior unchanged.

## 4. CountChip — tighten horizontal padding

`CountChip.svelte` `.count-chip { padding: 3px 12px }` → `padding: 3px 10px` (2px each side).
Height (line-height + vertical padding), typography, radius, colors unchanged.

## 5. SummaryCard — single alignment system

**Root cause of misalignment:** the hero Net Balance card's value is 22px vs 20px;
`line-height: 1.15` gives it a 25.3px line box vs 23px, pushing its value baseline and
trend chip ~2px lower than its siblings.

**a) Lock value line boxes in `SummaryCard.svelte`:**
- `.card-value { line-height: 1.15 }` → `line-height: 23px` (fixed px line box)
- `.hero-value { line-height: 23px }` (explicit)
- Result: every card's label → value → trend rows occupy identical vertical tracks;
  22/20px fonts still differ in size, baselines stay within 0.6px (sub-pixel), trends
  sit perfectly level. Icons (28px) already share the same top → same vertical center.

**b) Centralize the mobile card internals** currently living as page overrides in
`transactions/+page.svelte` (≤768px: `.card-icon` 24px, `.card-value` 18px,
`.hero-value` 20px, `.card-trend` 9px/`0 6px`/`margin-top: 1px`, `.card` padding
`sm md`). Move them into `SummaryCard.svelte` under `@media (max-width: 768px)`.

**c) Delete the page-specific overrides:**
- `transactions/+page.svelte` lines ~947–974: remove the whole
  `:global(main.main-content .summary-cards …)` block (and its specificity hack).
- `TransactionSummary.svelte` mobile rail `.card` rule: drop the redundant
  `padding` + `align-items: center` (SummaryCard owns these now); keep the rail's
  flex/snap/width/`min-height: auto` layout. Move the wrapper-level mobile
  `.summary-cards { margin-bottom: var(--space-md) }` (currently a page override)
  into `TransactionSummary`'s mobile media query so wrapper spacing lives with the wrapper.
- Lending/Borrowed pages have no card overrides — untouched.

Net effect: identical visuals, but every card-internal rule now lives in
`SummaryCard` (used by Transactions + Lending/Borrowed), and no page fights the alignment.

---

## Anti-patterns
No layout/interaction/architecture changes · no global token changes that ripple
(CountChip, SummaryCard icons, accent-gold, hero pill untouched) · no visual delta
on mobile from the style relocations · hero stays a hero (bigger value), just level.

## Verification
`npm run lint` clean. `svelte-check` pre-existing 13 errors untouched (none in these
files). Visual QA: transactions page desktop 3-across (labels/values/trends level incl.
hero) + mobile rail; lending/borrowed cards; light + dark; hover on Add button/FAB.

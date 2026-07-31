# Dark-mode ambient background (Flip7)

## Context

Make DARK mode match the "Insights / Analytics" references — a deep green-teal near-black base with ambient teal/gold/(coral) washes, charcoal cards with a glowing left-edge accent + ghosted watermark, and alive micro-interactions. LIGHT mode must stay byte-identical. Everything inside Flip7 tokens.

## Phase 1 — recon findings

- **Dark mechanism:** `data-theme` on `<html>`, set by `src/lib/stores/preferences.svelte.ts` (localStorage, defaults `system` → `prefers-color-scheme`). Dark-only CSS = `[data-theme="dark"]` selectors.
- **Root layout:** `src/routes/+layout.svelte` — `body { background: var(--color-bg) }`; `.app-shell::before` has a faint teal+gold radial ambient (applies in both themes; leave untouched for light-parity). `<meta name="theme-color" content="#0A0E16" media="(dark)">` (line 52).
- **PageBackground.svelte already implements a dark stack:** vignette + teal ambient drift (`bg-ambient-dark`, top-center) + starfield, with light layers hidden in dark and reduced-motion handled (`:167-173`). So the base background is ~60% done.
- **Cards are hand-rolled per component** (no shared class). Consensus recipe: `var(--color-surface)` + `1px solid var(--color-border)` + `var(--radius-xl)` (16px) + `var(--shadow-card)`, hover `translateY(-2px)` + `var(--glow-card)`.
- **Left-edge accent = established idiom:** absolute 4–5px accent bar with `var(--glow-*)` (TransactionSummary `:218-241`, LendingSummaryCards `:96-110`, MobileSummaryRail `:213-225`, SafeToSpendWidget `:77-85`) and `border-left` variants (SummaryCards `:141`). Maps directly onto the reference.
- **Type:** `--font-display` = Fredoka exists; value figures already huge/bold (`vault-value`, `.hero-value`); labels already uppercase letter-spaced muted; trend chips/arrows exist. **No new typeface needed** (finding: display face exists).
- **Count-up** already exists (`format.ts countUp`) and runs in 6 components. Alive layer is mostly present.
- **BottomNav active** = teal-bg pill + scaled icon + glowing gold dot (not yet a "glowing" teal pill itself).
- **Tokens today (dark):** `--color-bg:#0A0E16`, `--color-surface:#12161F`, `--color-surface-inset:#0E121A`, `--color-hairline:rgba(255,255,255,0.08)`, `--color-teal:#3CC4BD`, `--color-gold:#FFD23F`, `--color-coral:#FF8A6A`, `--color-border:rgba(234,247,245,0.15)`, `--shadow-card`, `--glow-card/gold/coral`. Max named radius `--radius-xl` 16px (no 24px token). No ghosted-icon watermark precedent (vault's layered divs at z-index 1/3 is the technique).

## Phase 2 — approach

### A. Theme tokens (`src/styles/variables.css`)
**`:root` addition** (both themes, no light usage yet): `--radius-2xl: 24px`.

**Dark block value updates** (light untouched):
- `--color-bg: #0B110F` (green-teal near-black, per ref ~#0b110f)
- `--color-surface: #161A18` (charcoal, per ref)
- `--color-surface-inset: #101512`
- Add `--color-bg-deep: #080D0C` (base gradient bottom)

**Dark block additions** (ambient + card, all derived from teal/gold/coral at low alpha):
- `--ambient-teal: rgba(60,196,189,0.10)`
- `--ambient-gold: rgba(255,210,63,0.08)`
- `--ambient-coral: rgba(255,138,106,0.05)`
- `--watermark-opacity: 0.06`

### B. Background (`PageBackground.svelte`)
All dark-only (`[data-theme="dark"]`), light layers untouched:
- Base: `[data-theme="dark"] .page-background { background: linear-gradient(180deg, var(--color-bg) 0%, var(--color-bg-deep) 100%); }` — subtle vertical depth, not flat.
- Add two ambient blooms alongside the existing teal drift:
  - teal bloom — reposition existing `.bg-ambient-dark` to low-left (per ref "mint/teal bloom low and to one side"), using `var(--ambient-teal)`.
  - `bg-ambient-gold-dark` — top-right, `var(--ambient-gold)`, slow drift.
  - `bg-ambient-coral-dark` — subtle bottom-right "breath", `var(--ambient-coral)`, optional gentle pulse.
- Keep vignette + starfield + grain; gate new animations under the existing reduced-motion block.
- Update `+layout.svelte` dark `<meta name="theme-color">` `#0A0E16` → `#0B110F` to match the new base.

### C. Reusable card primitive (`variables.css` utility classes, used by migrated cards)
`.flip7-card` — **light = the current consensus card look (byte-identical), dark = signature**:
```css
.flip7-card { position:relative; background:var(--color-surface); border:1px solid var(--color-border); border-radius:var(--radius-xl); box-shadow:var(--shadow-card); overflow:hidden; transition: transform 180ms var(--bounce), box-shadow 250ms var(--ease), border-color 200ms var(--ease); }
.flip7-card:hover { transform: translateY(-2px); box-shadow: var(--glow-card); }
[data-theme="dark"] .flip7-card { border-radius: var(--radius-2xl); border-color: var(--color-hairline); }
[data-theme="dark"] .flip7-card::before { content:''; position:absolute; left:0; top:0; bottom:0; width:4px; background:var(--color-teal); box-shadow:var(--glow-card); border-radius:0 2px 2px 0; }
[data-theme="dark"] .flip7-card.accent-gold::before { background:var(--color-gold); box-shadow:var(--glow-gold); }
[data-theme="dark"] .flip7-card.accent-coral::before { background:var(--color-coral); box-shadow:var(--glow-coral); }
[data-theme="dark"] .flip7-card:hover { box-shadow: var(--glow-card), 0 8px 32px rgba(60,196,189,0.22); }
```
`.flip7-watermark` — low-opacity absolute right-side container for a large ghosted icon (content at z-index 1):
```css
.flip7-watermark { position:absolute; right: var(--space-lg); top:50%; transform:translateY(-50%); opacity: var(--watermark-opacity, 0.06); pointer-events:none; z-index:0; }
```
Reduced-motion: disable `.flip7-card` transform/hover shadow (global variables.css reduce block already zeroes transitions/animations; add explicit transform none for the class if needed).

### D. Migrated cards this pass (light look preserved; dark gains signature)
- `SummaryCards.svelte` — `.card` → `flip7-card` + `accent-teal/coral/gold` modifiers + `.flip7-watermark` (banknote SVG) on the hero card; reconcile its existing `border-left` so it stays light-identical but doesn't double the dark accent (keep light `border-left` only via a non-dark path or drop in dark).
- `LendingSummaryCards.svelte` — same treatment (its accent div already exists — keep light, add `.flip7-card` shell).
- `TransactionSummary.svelte` — `.card` → `flip7-card` (+ its existing accent bar reconciled).
- `HeroBalanceWidget.svelte` — add a `.flip7-watermark` ghosted banknote behind the value; keep the vault's teal identity; intensify hover glow.
- **Later pass:** charts, lists, widgets (they auto-inherit the new charcoal `--color-surface`; full card shell later).

### E. Alive layer (nice-to-have)
- `BottomNav.svelte` — active item becomes a *glowing* teal pill: add `box-shadow: var(--glow-card)` to `.bn-item.active` (dark and light-safe; light pill unchanged in shape).
- Cards lift + glow intensify (via `.flip7-card`); gold pill halo already exists; count-up already exists.
- All new motion gated by the existing global `prefers-reduced-motion` block.

## Pre-condition resolutions (folded into the plan before any code)

**Light left-accent per migrated card (stated):**
- `SummaryCards.svelte` — YES, shows a colored light left accent today (`border-left: 5px solid var(--color-teal)` + `.accent-teal/coral/sky` + `.hero { border-left-color: var(--color-gold) }`, `:141,:153-163,:234`).
- `LendingSummaryCards.svelte` — YES, 4px accent **div** with glow (`.card-accent`, `:96-110`).
- `TransactionSummary.svelte` — YES, 4px accent **div** with glow (`.card-accent` income/expense/net, `:218-241`).
- `HeroBalanceWidget.svelte` — NO light left accent (the vault has no border-left/accent bar).

**Resolution for the light accent:** `.flip7-card`'s light base does **not** own shadow or hover (cards differ), only `position:relative; background:var(--color-surface); border:1px solid var(--color-border); border-radius:var(--radius-xl); overflow:hidden;` — the exact values every migrated card already sets, so applying it perturbs nothing. Each migrated card **keeps its own light left-accent rule verbatim** (pixel-identical). The accent-* modifiers carry a light `border-left` rule AND the dark `::before`, so the utility itself offers a matching light accent for future cards; for the three stat cards the modifier is applied for its dark behavior while each card's own light accent remains and is **suppressed in dark** (`[data-theme="dark"]` `border-left-width:0` / accent-div `display:none`) so there is exactly one accent per theme. Hero has no light accent → no light accent rule; it receives only the dark `::before` (gold, "value/money").

**Overflow:** all four cards already use `overflow:hidden` (SummaryCards `:142`, TransactionSummary `:194`, HeroBalanceWidget `.hero-vault :198`, LendingSummaryCards card) and do not rely on visible child overflow in light. Keep `overflow:hidden` in both themes; the watermark clips inside the card (desired).

**`.app-shell::before` ambient:** dark-hide it — add `[data-theme="dark"] .app-shell::before { opacity: 0; }` in `+layout.svelte`. PageBackground now owns the dark blooms, so dark won't be double-lit; light is untouched.

## Implementation order (gate after each)

1. **Theme tokens** (`variables.css`: `--radius-2xl`, dark `--color-bg/surface/inset/deep`, `--ambient-teal/gold/coral`, `--watermark-opacity`). **GATE:** dark + light screenshot — light identical.
2. **PageBackground** dark base gradient + gold/coral blooms + `.app-shell::before` dark-hide. **GATE:** dark ambient = subtle depth, not stacked/over-saturated; light identical; re-eye starfield tint on the new green base.
3. **`.flip7-card` / `.flip7-watermark` utilities** (with light accent rules per the pre-conditions). **GATE:** a blank `.flip7-card` in light == a current hand-rolled card in light, pixel-for-pixel (surface + border + radius-xl; no shadow in the utility).
4. **Migrate the four cards.** **GATE:** per-card LIGHT diff on all four — zero change; dark shows accent + watermark.
5. **BottomNav active-pill glow** + remaining motion; reduced-motion fallback uses `transform:none`.

## Files to change vs create

| File | Action | Light guarantee |
|---|---|---|
| `src/styles/variables.css` | add `--radius-2xl`; shift dark bg/surface/inset; add dark ambient + watermark tokens; add `.flip7-card`/`.flip7-watermark` utilities | dark-only value changes + new tokens unused in light; `.flip7-card` light base = current look |
| `src/lib/components/PageBackground.svelte` | dark base gradient + gold/coral ambient blooms | `[data-theme="dark"]`-only additions |
| `src/routes/+layout.svelte` | dark theme-color meta `#0A0E16`→`#0B110F` | meta tag only (dark media query) |
| `src/lib/components/SummaryCards.svelte` | `.flip7-card` + accent modifiers + watermark | light CSS unchanged |
| `src/lib/components/LendingSummaryCards.svelte` | `.flip7-card` + watermark | light CSS unchanged |
| `src/lib/components/TransactionSummary.svelte` | `.flip7-card` + accent reconcile | light CSS unchanged |
| `src/lib/components/HeroBalanceWidget.svelte` | watermark + hover glow | light CSS unchanged |
| `src/lib/components/BottomNav.svelte` | active pill glow | additive; light shape unchanged |
| `plans/dark-mode-ambient-background.md` | **create** | — |

## Verification

1. **Dark visual check (every page):** base has green-teal depth (not flat black), teal+gold+(coral) washes subtle and behind content, cards show glowing left-edge accent, stat/hero cards carry the ghosted watermark, no aurora blob, no glass cards, no hard edges. Compare to the two references.
2. **Light screenshot diff:** zero change (all edits dark-gated or dark-token-only).
3. **prefers-reduced-motion:** glows/transforms disabled, layout intact.
4. **Grep guards (touched files):** hardcoded palette hexes outside the theme file → 0; `indigo|violet|#8b5cf6|aurora|backdrop-blur` on cards → 0; `{/*` → 0; `export let|on:click` → 0.
5. `npm run check` + `npm run build` clean (report pre-existing 18 baseline errors separately; don't fix them).
6. 🚫 No git writes; leave everything unstaged; report a change manifest.

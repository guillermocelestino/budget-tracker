# Button Pair Fix — /transactions header

**Date:** 2026-07-31 · **Status:** done, unstaged (nothing committed)

## What was wrong

The `/transactions` header had **three unrelated button voices**:
- **"+ Add Transaction"** was a gold→**violet** gradient pill (`linear-gradient(135deg, var(--color-primary) 0%, #8b5cf6 100%)`) — violet/indigo gradients are banned, and it didn't use the Button component at all.
- **"Import CSV"** had **no CSS rule** — a bare grey wireframe box, non-pill corners (leftover from the CSV-import work, where the markup was added but the `.btn-import` style was never written).
- **"Export"** was already a clean teal-outline pill.

The system's Button component already had the two target voices (`primary` = gold gloss, `ghost` = teal outline) but **no page used `<Button>`** (blast radius = 0 callers).

## 1. Quoted BEFORE state

**`Button.svelte` variants (as they were):**
- `.btn-primary`: `background: linear-gradient(135deg, var(--color-gold) 0%, var(--color-gold-dark) 100%); color: var(--color-ink); box-shadow: var(--glow-gold); font-weight: var(--font-weight-bold);` + static `::before` top gloss.
- `.btn-ghost`: `background: transparent; color: var(--color-teal); border: 1px solid var(--color-teal);` + `:hover { background: var(--color-teal-bg) }`.
- `.btn-danger` coral gradient; `.btn-link` gold text + underline. Base `.btn`: `border-radius: var(--radius-pill); padding: 12px var(--space-lg); min-height: 44px; overflow: hidden;`.

**Header markup (before):**
```html
<a href="/transactions/new" class="btn-add">+ Add Transaction</a>
<button class="btn-import" onclick="..."> <svg …/> Import CSV</button>
```
- `.btn-add` CSS = `linear-gradient(135deg, var(--color-primary) 0%, #8b5cf6 100%)` → gold→VIOLET, radius `--radius-md`.
- `.btn-import` → **no CSS rule**.

**Export** (`.ex-btn` in `ExportDropdown.svelte`): `transparent; border: 1px solid var(--color-teal); border-radius: var(--radius-pill); color: var(--color-teal); min-height: 44px;` + hover `teal-bg + var(--glow-card)`.

**Blast radius of `<Button>` usage:** zero pages used it. The banned `gold→#8b5cf6` gradient also appears in 4 more spots (follow-up, not rewritten): `lending/+page.svelte:200,330,360` and `categories/+page.svelte:209`.

## 2. Primary = gold gloss (both themes)

`.btn-primary` now:
- `linear-gradient(135deg, var(--color-gold) 0%, var(--color-gold-dark) 100%)`
- fixed `color: #14302E` (dark ink on gold — legible both themes, matches hero-pill on-gold fg)
- `font-family: var(--font-display); font-weight: 800`
- `--glow-gold` shadow; static `::before` gloss + `::after` **sheen sweep** (`left -60% → 120%` on hover, `400ms var(--ease)`)
- `:active scale(0.95) --bounce`; base `.btn:focus-visible { box-shadow: var(--focus) }`

**Decision:** primary was already gold-gloss in the component; the header just wasn't using it. Applied to the transactions header; the 4 off-system violet gradients in lending/categories are a **reported follow-up**, not silently rewritten (per Step-1 guidance).

## 3. Secondary = teal-outline pill (one voice, two callers)

`.btn-ghost` now:
- `transparent bg; 1px solid var(--color-teal); color: var(--color-teal); font-weight: 600` (matches `.ex-btn`)
- **no glow at rest**; hover → `teal-bg + border var(--color-teal-dark) + var(--glow-card) + translateY(-1px)` + **icon nudges down 1px**
- `:active scale(0.95)`

Callers:
- **Import CSV** → `<Button variant="ghost">` (teal-outline pill, on-system).
- **Export** → unchanged `.ex-btn`, token-identical to `.btn-ghost`. Not ripped out of its component (needs `bind:this`/chevron/dot/open-state — a working dropdown, non-destructive guard).

## 4. Pair layout + no-overflow

- `.header-actions { display:flex; align-items:center; gap: var(--space-sm); flex-wrap: wrap; min-width: 0 }` wrapping the two `<Button>`s (both `btn-md` → same 44px height, same pill radius, same `12px 16px` padding rhythm).
- Leading elements (`+` and download SVG) in a fixed 18×18 `.btn-lead` box → identical vertical alignment.
- Overflow guard: `PageHeader.svelte` `.page-header` + `.page-actions` gained `flex-wrap: wrap` + `min-width: 0`. Two `btn-md` pills ≈ 298px; at 320px the header wraps actions to their own row (298px fits), `.header-actions` wraps to a column if not. (CSS-level guard; no browser measurement available.)

## 5. Git

🚫 Nothing committed; working tree dirty; 3 files changed for this task (plus prior CSV-import work), all unstaged.

## 6. Per-button observed

- **Add Transaction** → renders `<a class="btn btn-primary btn-md">`, gold gloss pill, fixed dark ink, sheen sweep + lift on hover, press scale, focus ring.
- **Import CSV** → renders `<button class="btn btn-ghost btn-md">`, teal-outline pill, glow-on-hover + icon pull, opens the SlideOver.
- **Export** → unchanged `.ex-btn` teal-outline pill, one visual voice with Import.
- **Violet gradient**: `grep 8b5cf6` on the rendered transactions page = **0**.
- **Both themes**: gold + `#14302E` reads on light and dark starfield; teal border/text uses `--color-teal` (bright teal in dark).

## 7. Raw grep output (touched files)

```
rg -n -F '{/*' Button.svelte +page.svelte ExportDropdown.svelte        → (0 matches)
rg -n 'export let|on:click' <same files>                                → (0 matches)
rg -n -i '#FFF8E7|#1A3A37|cream' <same files>
    ExportDropdown.svelte:208  /* ─── Dropdown Panel: cream popover ─── */
    ExportDropdown.svelte:216  background: var(--color-cream);
    → warm hexes 0; the two "cream" hits are the TOKEN var(--color-cream)
      (= var(--color-surface-inset), cool — not warm white)
rg -n -i 'linear-gradient\([^)]*(#8|#7|#6|violet|purple|indigo|fuchsia|magenta)' Button.svelte +page.svelte
    → (0 matches — violet gradient GONE)
```

`npm run check` → 0 errors in touched files (baseline 18 pre-existing, untouched). `npm run build` → ✔ done.

## Follow-up

Migrate the 4 off-system gold→violet primaries to the gold-gloss `.btn-primary` treatment:
- `src/routes/lending/+page.svelte` lines 200, 330, 360
- `src/routes/categories/+page.svelte` line 209

Each is `linear-gradient(135deg, var(--color-primary) 0%, #8b5cf6 100%)`.

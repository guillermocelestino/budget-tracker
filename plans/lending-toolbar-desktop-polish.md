# Plan: Lending Toolbar — Desktop Polish (Flip7)

> **Type:** Desktop-only layout & hierarchy refinement. **No logic changes.**
> **Scope:** Search width, grouping, height alignment, and a designed partition between filtering and presentation.
> **Constraint:** Reuse existing components/tokens. Do not touch mobile (≤767px) or tablet (768–900px) layouts.

## Current state (as built)

```
[ 🔍 Search (320px) ] [ All | Active | Paid ]                 [ Grid | Table ]
  └────────────── .toolbar-filters (flex:1) ──────────┘     └ .toolbar-views ─┘
```

| Element | Height | Surface |
|---|---|---|
| `.lending-search` | 44px | surface pill |
| `.view-toggle` (status) | 40px | inset segmented track |
| `.view-toggle` (view) | 40px | inset segmented track |

### Problems
1. **Heights don't align** — search is 44px, both toggles 40px → they sit on different baselines, reads uncomposed.
2. **Search reads as the lone "box"** — widest control, only surface-filled pill on the row.
3. **No partition** — bare `space-between` whitespace between status and the view toggle; the two identical-looking segmented controls (status vs. view) are easy to confuse.
4. **Whitespace feels accidental**, not designed.

## Changes

### File 1 — `src/lib/components/LendingSearch.svelte` (search width)
- Replace the fixed `max-width: 320px` with a viewport-scaled, capped constraint:
  `max-width: clamp(360px, 30vw, 420px);` (per user: 360–420px desktop anchor)
- Keep `flex: 1 1 auto` (this is what lets the mobile `width:100%; max-width:none` override keep working — do **not** switch to `flex: 0 1 …` or mobile breaks).
- Result: search grows with the viewport up to 420px but never dominates the row; shrinks gracefully on tight desktop widths via `flex-shrink`.

### File 2 — `src/lib/components/ListToolbar.svelte` (shared by lending + borrowed → keeps both consistent, per the existing "borrowed matches lending" intent)

**a) Desktop vertical alignment — all controls share a 44px baseline:**
```css
@media (min-width: 901px) {
  .list-toolbar :global(.view-toggle) { min-height: 44px; }
}
```
Scoped to ≥901px (the non-wrapping desktop row) so tablet/mobile are untouched. The sliding thumb (`top:3px; bottom:3px`) automatically fills the taller track.

**b) Designed partition between filtering and presentation — hairline divider inside the views cluster:**
```svelte
{#if views}
  <div class="toolbar-views">
    {#if filters}<span class="toolbar-divider" aria-hidden="true"></span>{/if}
    {@render views()}
  </div>
{/if}
```
```css
.toolbar-divider {
  flex: 0 0 1px;
  height: 24px;
  background: var(--color-hairline);
  opacity: 0.8;
}
@media (max-width: 900px) {
  .toolbar-divider { display: none; }
}
```
Renders only when both zones exist; hidden below desktop. Turns the bare whitespace into an explicit "left = filtering · right = presentation" partition, so Grid/Table reads as its own cluster, not a third floating control.

**c) Spacing / hierarchy (kept intentional, not changed arbitrarily):**
- `.toolbar-filters` gap stays `var(--space-sm)` → search↔status read as one tight filtering group.
- `.list-toolbar` stays `space-between` + `var(--space-lg)` → view toggle pinned far right; the divider now owns the partition.

### File 3 — `src/routes/lending/+page.svelte` & `borrowed/+page.svelte`
- **No changes.** The snippet structure (search + status in `filters`, view in `views`) is already the target architecture; future controls are additive snippet drops into `filters`/`views`.

## What this does NOT touch
- Search debounce / filtering / view-toggle logic — unchanged.
- `/transactions` — uses its own inline `.txn-toolbar` and `ViewToggle` outside `ListToolbar` → byte-identical.
- Tablet (≤900px) and mobile (≤767px) layouts — the height override and divider are gated to ≥901px.

## Verification
- [ ] Desktop ≥901px: search 360–420px; status adjacent (8px); hairline divider; Grid/Table far right; all three controls share a 44px center line.
- [ ] Toolbar left/right edges align with the lending list below (both full-width children — already aligned).
- [ ] Add a hypothetical 4th filter pill to the `filters` snippet → layout just grows leftward, no redesign.
- [ ] Tablet/mobile render exactly as before.
- [ ] `npm run check` and `npm run build` clean.

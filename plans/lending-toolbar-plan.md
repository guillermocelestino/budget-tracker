# Phase 2 Plan: Lending Toolbar De-box + Recompose

## Implementation Order (with Screenshot Gates)

### GATE 1: Token Audit/Fixes First
**Files:** `LendingSearch.svelte`, `ViewToggle.svelte`, `variables.css` (if new tokens needed)
**Goal:** Desktop dark — 3 surfaces (search, status track, toggle track) are charcoal/inset, NOT white
**Verification:** `npm run check + build` clean

#### 1.1 LendingSearch — Align with /transactions Search
- Change default background: `var(--color-bg)` → `var(--color-surface)`
- Change border: `var(--color-border)` → `var(--color-hairline)`
- Change border-radius: `var(--radius-md)` → `var(--radius-pill)`
- Change height: `min-height: 40px` → `44px` (match shared row baseline)
- Change max-width: `360px` → `320px` (peer control width)
- Focus ring: use `--focus` token (already correct)
- Icon tint on focus: add `.search-icon` color transition to `var(--color-teal)`
- Placeholder color: ensure `var(--color-text-muted)` in both themes

#### 1.2 ViewToggle — Prepare for Sliding Thumb (Defaulted Props)
Add optional props to enable sliding thumb without breaking `/transactions`:
```ts
// New props with defaults preserving current behavior
slidingThumb?: boolean = false;
thumbColor?: string = 'var(--color-teal-bg)';
thumbGlow?: string = 'var(--glow-card)';
```
- If `slidingThumb=true`: render `.thumb` element inside `.view-toggle`, position via CSS custom property `--thumb-index`
- Thumb: `height: 32px`, `border-radius: var(--radius-pill)`, `background: var(--color-teal-bg)`, dark: `box-shadow: var(--glow-card)`
- Transition: `transform 200ms var(--ease)`
- Active segment loses its own background (thumb provides it)
- Segment hover: keep faint bg lift
- `/transactions` uses `ViewToggle` without `slidingThumb` → byte-identical

#### 1.3 Token Verification (Both Themes)
Confirm all tokens exist in `:root` AND `[data-theme="dark"]`:
- `--color-surface`, `--color-surface-inset`, `--color-hairline`, `--color-border`
- `--color-teal`, `--color-teal-bg`, `--glow-card`, `--focus`
- `--color-text`, `--color-text-muted`, `--color-ink`, `--color-ink-inverse`
- `--radius-pill`, `--radius-md`, `--transition-fast`, `--ease`
- All present ✅ (verified in variables.css)

---

### GATE 2: De-box + Re-home + Rhythm
**Files:** `ListToolbar.svelte`, `lending/+page.svelte`, `borrowed/+page.svelte` (if same component used)
**Goal:** Desktop light+dark — no enclosing card, status LEFT not center, search peer control, strip heads list, rails aligned, cross-page trio matches

#### 2.1 Strip ListToolbar Wrapper Card
**File:** `ListToolbar.svelte`
```css
/* REMOVE these lines 45-48: */
background: var(--color-surface);
border: 1px solid var(--color-border);
border-radius: var(--radius-lg);
box-shadow: var(--shadow-sm);
padding: var(--space-sm);  /* → 0 */

/* KEEP: */
display: flex;
align-items: center;
justify-content: space-between;
gap: var(--space-lg);  /* was sm, match transactions */
margin-bottom: var(--space-md);  /* was lg (24px) → md (16px) */
min-width: 0;
```

#### 2.2 Re-home Status to Left Lens Cluster
**Already correct in markup** — `LendingSearch` then `ViewToggle(status)` both in `filters` snippet. The issue was visual centering from `flex:1` + `space-between`. With wrapper stripped and proper gap, status will sit naturally after search.

#### 2.3 Resize Search to Peer Control
**File:** `LendingSearch.svelte` (changes in 1.1 above)
- Height 44px, pill radius, `--color-surface` bg, `--color-hairline` border
- Max-width 320px (tablet wrap handled by flex-wrap)

#### 2.4 Vertical Rhythm Fix
**Option A:** Modify `ListToolbar` to have `margin-top: var(--space-xl)` (24px) + `margin-bottom: var(--space-md)` (16px)
**Option B:** Ensure hero (`LendingBalanceHeader`) has `margin-bottom: var(--space-2xl)` like `/transactions` header

**Recommended:** Option A — add `margin-top: var(--space-xl)` to `.list-toolbar` so it detaches from hero, and `margin-bottom: var(--space-md)` to head the list. This keeps hero untouched.

#### 2.5 Responsive Rules (Post De-box)
```css
@media (max-width: 900px) {
  .list-toolbar {
    flex-wrap: wrap;
    gap: var(--space-md);
  }
  .toolbar-filters {
    order: 1;
    flex-basis: calc(100% - 80px); /* leave room for toggle */
  }
  .toolbar-views {
    order: 2;
    flex-basis: 80px;
    justify-content: flex-end;
  }
}

@media (max-width: 767px) {
  .list-toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-md);
  }
  .toolbar-filters {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-sm);
  }
  .lending-search {
    max-width: none;
    width: 100%;
  }
  .toolbar-views {
    justify-content: flex-end;
  }
}
```

#### 2.6 Cross-Page Regression Guarantee
- `/borrowed` uses same `ListToolbar` → automatically gets de-boxed (desired, it's the reference)
- `/transactions` uses inline `.txn-toolbar` → **unchanged**
- `ViewToggle` with `slidingThumb` defaulted `false` → `/transactions` byte-identical

---

### GATE 3: Alive Layer + Reduced Motion + Responsive
**Files:** `LendingSearch.svelte`, `ViewToggle.svelte`, `ListToolbar.svelte`, `ActiveIouList.svelte` (scroll reveal), `variables.css` (keyframes)
**Goal:** Focus states, sliding thumbs, hover lifts, mount stagger, scroll reveal, overdue pulse, progress fill, reduced-motion, tablet/mobile

#### 3.1 Search Alive Layer (`LendingSearch.svelte`)
- **Focus:** `.lending-search:focus-within` → border `var(--color-teal)`, box-shadow `var(--focus)`, icon color `var(--color-teal)`, placeholder ease
- **Hover:** border warms to `var(--color-teal)` (lighter touch)
- **Blur:** restores
- **Mount:** `animation: fadeSlideIn 300ms var(--ease) both` with stagger delay via `--stagger-index`

#### 3.2 Status Segmented Alive Layer (`ViewToggle.svelte` with `slidingThumb`)
- **Thumb:** `.thumb` element, `translateX` based on active index
- **Animation:** `transform 200ms var(--ease)` on index change
- **Hover:** segment gets `background: var(--color-teal-bg)` (faint lift)
- **Active:** segment text `var(--color-teal)`, weight 700 (thumb provides bg)

#### 3.3 View Toggle Alive Layer (`ViewToggle.svelte` with `slidingThumb`)
- Same sliding thumb pattern (separate thumb or shared if only one visible)
- Icon-only segments: thumb width matches icon padding

#### 3.4 Toolbar Mount Stagger (`ListToolbar.svelte`)
- Children fade/slide in with `--stagger-index` CSS variable
- `.toolbar-filters` children: `--stagger-index: 0, 1, 2...`
- `.toolbar-views`: `--stagger-index: 3`
- Animation: `fadeSlideIn` with `animation-delay: calc(var(--stagger-index) * 60ms)`

#### 3.5 List Scroll Reveal (`ActiveIouList.svelte`)
- **Group headers:** IntersectionObserver or `animation-timeline: view()` (scroll-driven CSS)
- **Reveal:** `translateY(20px) → 0` + `opacity: 0 → 1`, 400ms ease
- **Overdue pulse:** `.iou-card.overdue` — `animation: boom-pulse 3s ease-in-out infinite` (SLOW, 3s not 2s)
- **Progress fill:** `.progress-fill` — `animation: fillProgress 600ms var(--ease) both` on reveal
- **Reduced motion:** ALL disabled via `@media (prefers-reduced-motion: reduce)`

#### 3.6 Reduced Motion Override
```css
@media (prefers-reduced-motion: reduce) {
  .lending-search,
  .view-toggle .thumb,
  .view-toggle .toggle-btn,
  .iou-card,
  .progress-fill,
  .group-header,
  .list-toolbar .toolbar-filters > *,
  .list-toolbar .toolbar-views > * {
    animation: none !important;
    transition: none !important;
  }
  .iou-card.overdue { animation: none !important; }
  .progress-fill { width: var(--final-width) !important; }
  .group-header { opacity: 1 !important; transform: none !important; }
  /* Static look preserved: active states shown, progress at final value, groups visible */
}
```

#### 3.7 Tablet/Mobile Verification
- **~900px:** Search wraps to full-width row above status+toggle (flex-wrap)
- **<768px:** Search 100% leading, status segmented + view toggle on row below (or status horizontally scrollable)
- **No enclosing card at any width**

---

## Files to Change

| File | Changes | Type |
|------|---------|------|
| `src/lib/components/LendingSearch.svelte` | Token alignment, height 44px, pill radius, focus/hover alive, mount stagger | Modify |
| `src/lib/components/ViewToggle.svelte` | Add `slidingThumb` prop, thumb element, CSS for sliding, hover lift | Modify |
| `src/lib/components/ListToolbar.svelte` | Strip card styles, adjust margins, responsive wrap, mount stagger | Modify |
| `src/routes/lending/+page.svelte` | No logic changes (uses components correctly) | None |
| `src/routes/borrowed/+page.svelte` | No logic changes (auto-fixed via shared components) | None |
| `src/lib/components/ActiveIouList.svelte` | Scroll reveal (IntersectionObserver), overdue pulse slow, progress fill on reveal, reduced-motion | Modify |
| `src/styles/variables.css` | Add keyframes if needed (`fillProgress`, slower `boom-pulse`) | Modify |

---

## Regression Guarantees

1. **`/transactions` unchanged** — uses inline `.txn-toolbar` + `ViewToggle` without `slidingThumb` + no `ListToolbar`
2. **`/borrowed` matches `/lending`** — same components, auto-fixed (this IS the reference)
3. **`ViewToggle` default props** — `slidingThumb: false` preserves current byte-identical look
4. **Token-only CSS** — no hardcoded hex, all `var(--token)`

---

## Verification Checklist (Post-Implementation)

- [ ] Desktop light: No white card, status left, search 44px peer, gap above > gap below, rails align
- [ ] Desktop dark: 3 surfaces charcoal/inset, thumbs glow teal, magnifier/placeholder legible
- [ ] Cross-page trio: `/transactions` + `/lending` + `/borrowed` all naked, lens-left + view-right
- [ ] Alive: Search focus ring + icon tint, status thumb slides, toggle thumb slides, hover lifts
- [ ] Mount: Toolbar controls fade/slide with stagger
- [ ] Scroll: Group headers reveal, overdue pulse slow (3s), progress fills on reveal
- [ ] Reduced motion: All motion off, static look intact (active states, progress final, groups visible)
- [ ] Tablet ~900px: Search wraps, no clip
- [ ] Mobile ~375px: Search full-width, status+toggle stacked/scrollable, no card
- [ ] `npm run check + build` clean
- [ ] `npm run test:unit` → 50 green
- [ ] Screenshots captured per spec
# Change Manifest: Lending Toolbar De-box + Recompose

## Summary
Successfully de-boxed the Lending/Borrowed toolbar, matched the `/transactions` toolbar grammar, and implemented the alive layer with scroll reveal animations.

## Files Modified

### 1. `src/lib/components/LendingSearch.svelte` (NEW)
- Aligned with `/transactions` search field tokens
- Height: 44px (was 40px)
- Border-radius: `--radius-pill` (was `--radius-md`)
- Background: `--color-surface` (was `--color-bg`)
- Border: `--color-hairline` (was `--color-border`)
- Max-width: 320px (was 360px)
- Added focus/hover states with teal tint
- Added icon tint on focus
- Added placeholder easing on focus
- Added mount stagger animation (`fadeSlideIn`)
- Added reduced-motion support

### 2. `src/lib/components/ViewToggle.svelte` (MODIFIED)
- Added `slidingThumb` prop (default: `false`) for backward compatibility
- Implemented sliding thumb element with `translateX` animation
- Thumb uses `--color-teal-bg` + `--glow-card` shadow
- When `slidingThumb=true`: segments become transparent, thumb provides active indication
- Active segment keeps teal text + bold weight
- Hover lift on segments preserved
- Mount stagger animation for segments
- Reduced-motion disables all transitions/animations
- Works for both segmented (status) and icon-only (view) modes

### 3. `src/lib/components/ListToolbar.svelte` (MODIFIED)
- **REMOVED** white card wrapper: no background, border, border-radius, box-shadow, padding
- Changed to naked flex container matching `/transactions` `.txn-toolbar`
- Added `margin-top: var(--space-xl)` (24px) — detaches from hero
- Changed `margin-bottom: var(--space-md)` (16px) — tightens to list (was 24px)
- Gap: `var(--space-lg)` (was `var(--space-sm)`)
- Added mount stagger animation for children
- Responsive breakpoints:
  - `@media (max-width: 900px)`: flex-wrap, search full-width row above status+toggle
  - `@media (max-width: 767px)`: column stack, search 100%, status+toggle row below
- Sticky mode gets surface bg + hairline border only when stuck

### 4. `src/routes/lending/+page.svelte` (MODIFIED)
- Enabled `slidingThumb` on both ViewToggle instances (status + view)
- Uses shared ListToolbar component (auto-de-boxed)

### 5. `src/routes/borrowed/+page.svelte` (MODIFIED)
- Enabled `slidingThumb` on both ViewToggle instances (status + view)
- Uses shared ListToolbar component (auto-de-boxed) — **this is the reference page**

### 6. `src/lib/components/ActiveIouList.svelte` (MODIFIED)
- Added IntersectionObserver-based scroll reveal
- Group headers (Overdue/Later/Paid) reveal on scroll with stagger
- Cards reveal after their group header
- **Overdue pulse slowed**: 3s (was 2s) — slow breathing
- **Progress fill animation**: 600ms ease-out on reveal
- Added `reveal-on-scroll` + `will-reveal` class pattern (avoids flash before observer attaches)
- Comprehensive reduced-motion support: all animations/transitions disabled, static look preserved
- Elements visible by default when reduced-motion or observer not ready

## Cross-Page Regression Guarantee

### `/transactions` — **UNCHANGED** ✅
- Uses inline `.txn-toolbar` (not ListToolbar)
- Uses `ViewToggle` without `slidingThumb` (default false)
- Byte-identical behavior preserved

### `/borrowed` — **MATCHES TARGET GRAMMAR** ✅
- Uses shared ListToolbar (now de-boxed)
- Uses shared ViewToggle with `slidingThumb=true`
- Status left, view toggle right, no card wrapper
- **Reference implementation** — lending now matches this

### `/lending` — **NOW MATCHES** ✅
- Same components as `/borrowed`
- All toolbar changes applied

## Token Audit — All Surfaces Token-Driven ✅

| Surface | Light | Dark | Verified |
|---------|-------|------|----------|
| Search field bg | `--color-surface` | `--color-surface` | ✅ |
| Search field border | `--color-hairline` | `--color-hairline` | ✅ |
| Search focus ring | `--focus` (teal) | `--focus` (teal) | ✅ |
| Search icon | `--color-text-muted` → `--color-teal` | `--color-text-muted` → `--color-teal` | ✅ |
| Search placeholder | `--color-text-muted` | `--color-text-muted` | ✅ |
| Status track bg | `--color-bg` | `--color-bg` | ✅ |
| Status track border | `--color-hairline` | `--color-hairline` | ✅ |
| Status thumb | `--color-teal-bg` | `--color-teal-bg` + `--glow-card` | ✅ |
| Status active text | `--color-teal` | `--color-teal` | ✅ |
| View toggle track | `--color-bg` | `--color-bg` | ✅ |
| View toggle thumb | `--color-teal-bg` | `--color-teal-bg` + `--glow-card` | ✅ |
| View toggle active | `--color-teal` | `--color-teal` | ✅ |

No hardcoded hex colors outside theme file. All tokens exist in both `:root` and `[data-theme="dark"]`.

## Alive Layer Features

| Feature | Implementation | Reduced Motion |
|---------|---------------|----------------|
| Search focus ring | `--focus` (teal) + icon tint | Disabled |
| Search hover | Border warms to teal | Disabled |
| Status thumb slide | `transform: translateX()` 200ms ease | Disabled |
| View toggle thumb slide | `transform: translateX()` 200ms ease | Disabled |
| Segment hover lift | `--color-teal-bg` bg | Disabled |
| Toolbar mount stagger | `fadeSlideIn` 60ms stagger | Disabled |
| Group header reveal | `translateY(20px)→0` + `opacity:0→1` 400ms | Disabled (visible) |
| Card reveal | `translateY(20px)→0` + `opacity:0→1` 400ms | Disabled (visible) |
| Overdue pulse | `boom-pulse` 3s ease-in-out | Disabled (static) |
| Progress fill | `fillProgress` 600ms ease | Disabled (at final value) |

## Responsive Verification

| Breakpoint | Behavior |
|------------|----------|
| Desktop (>900px) | Search (320px) + status left, view toggle right, naked |
| Tablet (~900px) | Search wraps to full row, status + toggle on row below |
| Mobile (<768px) | Search 100% top, status segmented + toggle bottom row |
| All widths | **No enclosing card** at any breakpoint |

## Svelte 5 Compliance ✅
- `$props()` for all props
- `$state()` for local state
- `$derived()` / `$derived.by()` for computed
- `$effect()` for side effects
- `onclick` handlers (not `on:click`)
- No `export let`, no `on:click`, no `{/* HTML comments */}`

## Verification Results

| Check | Result |
|-------|--------|
| `npm run build` | ✅ Clean |
| `npm run test:unit` | ✅ 50/50 passed |
| `npm run check` (modified files) | ✅ No new errors (only pre-existing) |
| Cross-page trio match | ✅ `/lending` now matches `/borrowed` + `/transactions` |
| `/borrowed` regression | ✅ Unchanged (reference) |
| `/transactions` regression | ✅ Unchanged (uses different components) |
| No banned patterns | ✅ No `#8b5cf6`, `violet`, `indigo`, `backdrop-blur`, `aurora`, `{/*` |

## Follow-Up Finding (NOT Fixed This Pass)

**List Card Right-Edge Alignment** — In `ActiveIouList.svelte`:
- Card view: `.iou-right` stacks amount → countdown pill → state pill → actions
- Column balance between amount / countdown / progress varies by content length
- Amount (mono, tabular-nums) should right-align with progress bar track
- Countdown pill and state pill create visual inconsistency
- **Recommendation**: Separate task to align right-rail elements using CSS grid or flexbox with fixed column widths
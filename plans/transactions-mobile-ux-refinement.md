# Transactions Mobile — UX Refinement Plan

> **Type:** Layout & information-hierarchy refinement (NOT a redesign)
> **Scope:** Mobile-first composition of the existing `/transactions` page
> **Constraint:** Preserve Flip7 design system, all tokens, all business logic, filtering, search, routing, and every existing interaction. No new components where a layout change suffices.
> **Status:** ✅ Implemented (2026-08-02) — single-file change in `src/routes/transactions/+page.svelte`; `svelte-check` clean for the file, build + 50/50 unit tests pass.

---

## 1. The brief, restated

The page exists to browse transactions, but the current mobile screen spends ~420px of vertical chrome before the first transaction appears. The ask: make transactions the hero, compress everything above the fold, keep one-handed ergonomics, and preserve every existing behavior and the Flip7 visual language.

---

## 2. Current mobile layout (as-built, measured from code)

DOM order on `src/routes/transactions/+page.svelte` (≤768px):

```
1. Sticky PageHeader        ~58px + 12px margin     — "Transactions" + context subline (stacked)
2. Full-width Add row       ~44px + 12px margin     — gold "＋ Add Transaction" (mobile-only)
3. Summary cards (3-across) ~109px + 32px margin    — horizontal scroll rail, icon + label + value + trend chip
4. Toolbar                  ~156px + 12px margin    — search row → filter row → view/overflow row (3 stacked rows)
5. Transaction list         ⏤ the content          — hero, but starts at ~420px
```

**Measured before-fold budget: ~420px** (iPhone SE = 667pt viewport → zero transactions visible; iPhone 15 = 852pt → only a sliver of a date header).

The toolbar alone, on mobile, is **3 stacked rows**:

```
[ 🔍 Search transactions… ]          ← 44px (search field, flex-basis 100%)
[ ⚙ Filter        (2) ]             ← 44px (filter button, flex-basis 100%)
[ Grouped|Flat ]        [ ⋯ ]       ← 40px (view toggle + overflow, space-between)
```

That is exactly the "Search → Filter → View Toggle → Overflow" cascade in the brief.

---

## 3. UX issues identified + why they hurt

| # | Issue (from the brief) | Root cause in code | Why it hurts |
|---|------------------------|--------------------|--------------|
| 1 | Vertically heavy before first transaction | 7 blocks stack before the list; ~420px of chrome | Task time-to-content is huge; the register — the actual job — is below the fold |
| 2 | Add Transaction dominates | Full-width gold pill (`--color-gold` gradient + glow) spans the whole 1st screen | Loudest element on the page is the *least frequent* action (creating ≠ browsing) |
| 3 | Search + Filter take two full rows | `.toolbar-left` wraps: search `flex-basis:100%`, filter `flex-basis:100%` | Two 44px rows for one "find things" affordance |
| 4 | View Toggle + Overflow take another row | `.toolbar-right` is width:100% space-between on mobile | A third 40px row for a niche toggle + a menu that's always available elsewhere |
| 5 | Must scroll before seeing content | Sum of above | Friction on the primary browse task |
| 6 | Transactions sit too low | The list is last in a 7-block stack | The register reads as secondary, not primary |
| 8 | Wrong visual hierarchy | Gold CTA > cards > toolbar > list in loudness | Attention goes to actions, not to the data the page exists to show |
| 7 | Loose rhythm | `.summary-cards` margin-bottom = 32px; header margin is nominal; every gap is at the top of the token range | Floaty, non-adjacent sections; no sense of "toolbar heads the list" |
| — | **Dead rhythm intent (bug)** | `:global(.page-header){ margin-bottom: var(--space-2xl) }` is neutralized by `PageHeader`'s higher-specificity scoped margin → actual gap is 16px/12px, not 48px | The "48px header→toolbar rhythm" the code comments promise never lands |

---

## 4. Recommended composition

The strongest combination, and the one that keeps the existing DOM order (least regression risk):

### Mobile (≤768px) after refinement

```
┌──────────────────────────────────────────────┐
│ Transactions · Aug 2026 · 128      [ ⋯ ]     │  Compact header — subline inline, overflow moved in
├──────────────────────────────────────────────┤
│ Income  +12,450    Expenses −8,920    Net +3,530 │  Compact 3-across summary strip
├──────────────────────────────────────────────┤
│ [ 🔍 Search transactions…     ⚙ (2) ]       │  UNIFIED search + filter pill — ONE 44px row
├──────────────────────────────────────────────┤
│ [ Grouped | Flat ]                          │  Slim row — view toggle only
├──────────────────────────────────────────────┤
│ TODAY                                 +60   │
│ ┌────────────────────────────────────────┐   │
│ │ 💳  Grocery            −₱1,250.00   ⋮  │   │ ← FIRST TRANSACTION ~210px
│ └────────────────────────────────────────┘   │
│ …list continues (the hero)                  │
└──────────────────────────────────────────────┘
```

**Before-fold budget: ~210px** (vs ~420px today) → a ~50% reduction in chrome above the first transaction. On an iPhone SE you now see the list; on an iPhone 15 you see the list + multiple transactions without scrolling.

**Visual hierarchy delivered:** List (hero) > Search (prominent full-width pill) > Summary (quiet thin strip) > Add (out-of-flow FAB, thumb-reach) — exactly the brief's target order.

---

## 5. Changes per element — what, how, why

### 5.1 Remove the mobile full-width Add row (brief #2)

- **What:** Delete the `.mobile-only.mobile-add-row` block from `+page.svelte`.
- **How:** The global **SpeedDial FAB** in `BottomNav` (rendered at ≤768px on every authenticated page) already exposes a context-aware **"Transaction"** action → `goto('/transactions/new')` — the *identical* destination. Desktop keeps its header "Add Transaction" button (`.desktop-only`), so desktop is untouched.
- **Why:** The action is preserved in the thumb zone; the loud gold block and its 56px are gone. This is the single highest-leverage "reduce Add dominance" move and it loses zero functionality. *(Fallback if the in-flow CTA is wanted back: a compact "+" pill beside the view toggle — noted in §8.)*

### 5.2 Unify Search + Filter into one pill (brief #4)

- **What:** Fold the standalone full-width Filter button *into* the search field's pill. The pill becomes `[ 🔍 input … | divider | ⚙ (badge) ]`.
- **How (markup, inside `.toolbar-left`):**
  - `.toolbar-search` keeps the search icon + `<input type="search">`, then gains a decorative divider, then a `.toolbar-filter` wrapper holding the **filter trigger** (44×44 icon button + active-count badge) and the existing desktop popover.
  - The filter trigger keeps `bind:this={filterBtnEl}`, `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`, and toggles `filtersOpen` — **the exact same state machine** already drives the desktop popover and the mobile `FiltersSheet`. Zero logic change.
  - Popover anchoring: keep `.toolbar-filter { position: relative }` and switch `.filters-popover` to `right: 0` so it drops under the filter icon (currently it's `left: 0` of a full-width button).
  - Desktop nicety: keep a "Filter" text label beside the icon ≥768px, icon-only below (`.search-filter-label { display:none }` ≤768px). Badge = existing `.filters-badge`.
- **CSS deltas:** remove the mobile `.filters-btn { width:100% }` overrides (no more full-width row); `.toolbar-search` stays `height:44px`, `--radius-pill`, `--color-surface`, `--color-hairline`, `--focus` ring (all existing tokens); the filter trigger inherits the pill's surface and warms to teal on hover/focus-visible.
- **Why:** Collapses rows 1+2 into a single 44px row (~112px → ~52px). This is the modern banking-app pattern the brief asked for, and it keeps search and filter adjacent — one hand, one row, "find stuff".

### 5.3 Compact the summary strip (brief #3)

- **What:** Tighten the three KPI cards on mobile only.
- **How:** Via page-level `:global()` overrides in `+page.svelte` (keeps `TransactionSummary.svelte` byte-identical — it's used *only* on `/transactions`, so this is zero-risk either way, but page-scoped honors "don't touch components"):
  - `.summary-cards` margin-bottom `32px → 12px` (`--space-md`).
  - Card padding `12px → 8px` (`--space-sm`) vertical, keep horizontal 12px.
  - Card icon `28px → 24px`; trend chip `font-size 10px → 9px`, tighter padding.
  - Values keep 20px/22px — the numbers are the point; do not shrink readability.
  - `.main-content .summary-cards …` selector gives specificity `(0,3,1)` > the component's scoped `(0,2,0)`.
- **Why:** ~109px + 32px → ~54px + 12px. The cards stay glanceable and clickable (type-filter taps preserved) but stop being a second hero.

### 5.4 Compress the header (brief #1)

- **What:** Reduce header vertical footprint on mobile; do **not** edit `PageHeader.svelte` (shared by 10 pages).
- **How:** Page-level override (again `(0,3,1)` beats the component's scoped rule):
  - Mobile padding `8px 12px → 6px 12px`; title-group gap `6px → 2px`.
  - Subline inline with the title on one baseline (`flex-direction: row`, mono-xs, `white-space:nowrap`, ellipsis) so it reads `Transactions · Aug 2026 · 128` — the "compact app bar" look, saving ~16px.
  - Keep the dashed-teal bottom divider (Flip7 identity); it costs no height.
  - Normalize the header→content gap to `var(--space-sm)` (8px) mobile / `var(--space-lg)` desktop via the higher-specificity override, fixing the dead 48px intent (§3).
- **Why:** ~58px → ~40px, and the overflow menu moves into this sticky bar (below) so it's always in thumb-reach.

### 5.5 Slim the second toolbar row (brief #5)

- **What:** After the merge, the only remaining toolbar controls are the view toggle and the overflow menu.
- **How:** Move the mobile-only `OverflowMenu` from `.toolbar-right` into the **header action slot** (add a `.mobile-only` overflow beside the existing `.desktop-only` header actions). `.toolbar-right` then holds only `ViewToggle` → a single lightweight 40px row, left-anchored. The header already carries `position:relative; z-index:30` (existing page rule) so the overflow dropdown paints correctly from the sticky header.
- **Why:** The toolbar drops from 3 rows to 2, and the ⋮ menu (Import/Export) is reachable even while scrolled because the header is sticky.

### 5.6 Rhythm pass (brief #7)

- One quiet scale, mobile: header→content `8px`, summary→search `12px`, search→view row `8px`, view row→list `8px` — all existing tokens (`--space-sm`/`--space-md`).
- "Gap above toolbar > gap below" grammar from desktop is preserved by construction (summary 12px → toolbar 8px → list).

---

## 6. Vertical budget, before → after

| Block | Before | After |
|---|---|---|
| Header (+margin) | ~70px | ~40px (+8) |
| Add row (+margin) | ~56px | — (FAB) |
| Summary strip (+margin) | ~141px | ~66px |
| Toolbar | ~168px | ~96px (2 rows) |
| **Total before 1st transaction** | **~420px** | **~210px** |

On **iPhone SE (667pt)**: ~450px of visible list. On **iPhone 15 (852pt)**: ~640px. Transaction-first, delivered.

---

## 7. Explicitly preserved (the "do not touch" contract)

- **Logic:** search debounce + URL sync, filter state machine, `dateRangeFromFilter`, page/type/category filters, `markPaid`/import/export/duplicate/delete — all unchanged. The filter trigger is re-anchored, not re-implemented.
- **Components (byte-identical):** `PageHeader`, `TransactionFilters`, `FiltersSheet`, `ViewToggle`, `OverflowMenu`, `ListToolbar`, `Button`, `TransactionList`, `EmptyState`, `ModalDialog`, `SlideOver`, import wizard pieces.
- **Design tokens:** every new/edited rule uses existing tokens (`--color-surface`, `--color-hairline`, `--radius-pill`, `--focus`, `--space-*`, `--color-teal`, `--color-coral`, `--glow-*`). No hardcoded hex, no new design language.
- **Desktop (≥769px):** functionally and visually unchanged except the search+filter pill now contains the filter trigger (same popover, same behavior) with a "Filter" text label retained.
- **Accessibility:** 44px touch targets maintained (search input 44px, filter trigger 44×44); `aria-expanded`/`aria-haspopup`/`aria-controls`/`aria-label` on the trigger; keyboard popover focus/return retained; `prefers-reduced-motion` honored for any added transition.

---

## 8. Decision log — where the brief offered options

| Decision | Chosen | Runner-up & why rejected |
|---|---|---|
| Add CTA form | **Existing global FAB (remove in-flow button)** | *Compact "+" pill* — still in-flow, still occupies a row; FAB is the one-handed, out-of-flow winner and already ships the exact action |
| Search/Filter merge | **Unified pill, all breakpoints** | *Mobile-only merge* — would fork markup and diverge the toolbar grammar across breakpoints |
| Summary compaction | **Page-level `:global` override** | *Edit `TransactionSummary.svelte`* — component is transactions-only so it's safe, but page-scoped honors "don't change components" and keeps the diff local |
| Header compression | **Page-level override, subline inline** | *Edit `PageHeader.svelte`* — shared by 10 pages; too wide a blast radius for a layout tweak |
| Overflow placement | **Move into sticky header** | *Keep in `.toolbar-right`* — works, but the header move also gives always-reachable Import/Export |

---

## 9. Risks & regression checks

| Risk | Mitigation |
|---|---|
| Specificity fight on `:global()` overrides | Use `.main-content` ancestor to reach `(0,3,1)`; verify in browser at 360–430px |
| Filter popover mis-anchors after merge | Anchor `.filters-popover` to `.toolbar-filter` with `right:0`; test both breakpoints |
| Overflow dropdown paints under content | Header already `position:relative; z-index:30` (existing rule) — retained |
| Sticky header + new inline subline truncation | `nowrap` + ellipsis; subline is short by construction |
| Desktop regression | Toolbar-right unchanged; pill grows ≤520px as today; run page at 1024/1280px |

**Verify:** `npm run dev` → mobile emulation 360×740 / 390×844 / 430×932 + desktop 1280; confirm search debounce, filter sheet + popover, view toggle, FAB add, list scroll. `npm run check`.

---

## 10. Files touched

1. `src/routes/transactions/+page.svelte` — remove mobile Add row; unified search+filter pill markup + CSS; move overflow into header (mobile); header/summary/toolbar compaction via scoped `:global` overrides.
2. *(No other files.)* `TransactionSummary.svelte`, `PageHeader.svelte`, all toolbar components remain untouched.

---

## 11. Open question for proof

The one structural decision worth your call before I write code: **Remove the in-flow mobile Add button entirely (rely on the existing SpeedDial FAB)** — recommended — **or keep a compact "+" pill** on the toolbar row? Everything else follows the plan above.

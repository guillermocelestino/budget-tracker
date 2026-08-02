# Phase 1 Recon: Lending Toolbar De-box + Recompose

## 1. Current Lending Toolbar Markup & Structure

**File:** `src/routes/lending/+page.svelte` (lines 156-186)

```svelte
<ListToolbar>
  {#snippet filters()}
    <LendingSearch
      value={searchInput}
      onSearch={(v) => (searchInput = v)}
      placeholder="Search borrower, lender, notes…"
    />
    <ViewToggle
      options={[
        { value: 'all', label: 'All', count: activeLendings.length + paidLendings.length },
        { value: 'active', label: 'Active', count: activeLendings.length },
        { value: 'paid', label: 'Paid', count: paidLendings.length },
      ]}
      value={activeTab}
      onSelect={(v) => (activeTab = v as 'all' | 'active' | 'paid')}
      ariaLabel="Lending status filter"
    />
  {/snippet}
  {#snippet views()}
    <ViewToggle
      options={[
        { value: 'card', icon: 'grid', ariaLabel: 'Card view' },
        { value: 'table', icon: 'table', ariaLabel: 'Table view' },
      ]}
      value={viewMode}
      onSelect={(v) => (viewMode = v as 'card' | 'table')}
      iconOnly
      ariaLabel="Lending list view"
    />
  {/snippet}
</ListToolbar>
```

### The White Card Wrapper (THE PROBLEM)

**File:** `src/lib/components/ListToolbar.svelte` (lines 39-51)

```css
.list-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  padding: var(--space-sm);
  background: var(--color-surface);      /* WHITE CARD BG */
  border: 1px solid var(--color-border); /* BORDER */
  border-radius: var(--radius-lg);       /* ROUNDED */
  box-shadow: var(--shadow-sm);          /* DROP SHADOW */
  margin-bottom: var(--space-lg);        /* 24px gap below */
  min-width: 0;
}
```

**Why status lands center:** `.list-toolbar` uses `justify-content: space-between` with two children:
- `.toolbar-filters` (flex: 1 1 auto, left zone) — contains search + status
- `.toolbar-views` (flex: 0 0 auto, right zone) — contains view toggle

Since `.toolbar-filters` has `flex: 1`, it expands to fill available space. The search (`LendingSearch`) has `flex: 1 1 auto` with `max-width: 360px`, and the status `ViewToggle` sits after it. With `justify-content: space-between` on the parent, the left zone pushes right, centering the status control in the available space.

### Control Order (Current)
```
[LendingSearch (flex:1, max 360px)] [ViewToggle(status: All|Active|Paid)]  [ViewToggle(iconOnly: grid|table)]
   LEFT ZONE (flex:1)                                                    RIGHT ZONE
```

---

## 2. Cross-Page Reference Implementations

### /borrowed (`src/routes/borrowed/+page.svelte:169-199`)
**Uses IDENTICAL structure** — same `ListToolbar` + `LendingSearch` + `ViewToggle` pattern. Currently ALSO has the white card wrapper. The task says "/borrowed already renders this grammar... DO NOT change /borrowed; it is the reference" — this appears to mean the *target* grammar, not the current state. Both lending and borrowed need fixing.

### /transactions (`src/routes/transactions/+page.svelte:437-484`)
**INLINE toolbar (naked, no wrapper component):**

```svelte
<div class="txn-toolbar">
  <div class="toolbar-left">
    <div class="toolbar-search">...</div>
    <span class="desktop-only toolbar-filters">
      <TransactionFilters ... />
    </span>
  </div>
  <div class="toolbar-right">
    ...
    <ViewToggle {showFlatView} onChange={...} />
    ...
  </div>
</div>
```

**CSS (lines 737-743):**
```css
.txn-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-lg);
  margin-bottom: var(--space-md);  /* 16px - TIGHT to list */
}
```

**Key differences from ListToolbar:**
- NO background, NO border, NO border-radius, NO box-shadow, NO padding
- Just a flex container with `justify-content: space-between`
- Search field (`.toolbar-search`): `height: 44px`, `background: var(--color-surface)`, `border: 1px solid var(--color-hairline)`, `border-radius: var(--radius-pill)`
- Header above has `margin-bottom: var(--space-2xl)` (48px) — LARGE gap
- Toolbar below has `margin-bottom: var(--space-md)` (16px) — TIGHT gap

**Target Grammar (from /transactions):**
- LEFT cluster: [Search] [Filter pills] — search leads, filters append right
- RIGHT cluster: [ViewToggle] — icon-only
- NO enclosing card
- Controls share ~44px baseline height
- Empty middle is correct (rail-anchored)
- Gap above > Gap below (toolbar "heads" the list)

---

## 3. Token Audit: Three Toolbar Surfaces

### A. LendingSearch (Search Field) — `src/lib/components/LendingSearch.svelte`

| Property | Light Token | Dark Token | Hardcoded? |
|----------|-------------|------------|------------|
| Background | `var(--color-bg)` (#EFF8F7) | `var(--color-bg)` (#0B110F) | ✅ Token |
| Border | `var(--color-border)` | `var(--color-border)` | ✅ Token |
| Focus Border | `var(--color-primary)` (gold) | `var(--color-primary)` (gold) | ✅ Token |
| Focus Shadow | `0 0 0 3px var(--color-primary-light)` | `0 0 0 3px var(--color-primary-light)` | ✅ Token |
| Focus BG | `var(--color-surface)` | `var(--color-surface)` | ✅ Token |
| Icon Color | `var(--color-text-secondary)` | `var(--color-text-secondary)` | ✅ Token |
| Placeholder | `var(--color-text-secondary)` | `var(--color-text-secondary)` | ✅ Token |
| Text Color | `var(--color-text)` | `var(--color-text)` | ✅ Token |
| Min-height | 40px | 40px | ✅ CSS value |
| Max-width | 360px | 360px | ✅ CSS value |

**Verdict:** All token-driven. But uses `--color-bg` (page background) not `--color-surface` (card surface) for default state. Should match `/transactions` search which uses `--color-surface`.

### B. ViewToggle — Status Segmented (All | Active | Paid) — `src/lib/components/ViewToggle.svelte`

| Property | Light Token | Dark Token | Hardcoded? |
|----------|-------------|------------|------------|
| Container BG | `var(--color-bg)` | `var(--color-bg)` | ✅ Token |
| Container Border | `var(--color-hairline)` | `var(--color-hairline)` | ✅ Token |
| Container Radius | `var(--radius-pill)` | `var(--radius-pill)` | ✅ Token |
| Segment Default BG | transparent | transparent | ✅ CSS |
| Segment Hover BG | `var(--color-surface)` | `var(--color-surface)` | ✅ Token |
| Segment Active BG | `var(--color-teal-bg)` | `var(--color-teal-bg)` | ✅ Token |
| Segment Active Text | `var(--color-teal)` | `var(--color-teal)` | ✅ Token |
| Segment Active Shadow (dark) | — | `var(--glow-card)` | ✅ Token |
| Count Text | opacity 0.8, font-mono | opacity 0.8, font-mono | ✅ CSS |
| Min-height | 40px | 40px | ✅ CSS value |

**Verdict:** All token-driven. No sliding thumb — active is static background on button.

### C. ViewToggle — Icon-Only (Grid | Table) — Same component

Same tokens as above.

### D. ListToolbar Wrapper (THE WHITE CARD) — `src/lib/components/ListToolbar.svelte`

| Property | Light Token | Dark Token | Hardcoded? |
|----------|-------------|------------|------------|
| Background | `var(--color-surface)` (#FFFFFF) | `var(--color-surface)` (#161A18) | ✅ Token |
| Border | `var(--color-border)` | `var(--color-border)` | ✅ Token |
| Border Radius | `var(--radius-lg)` | `var(--radius-lg)` | ✅ Token |
| Box Shadow | `var(--shadow-sm)` | `var(--shadow-sm)` | ✅ Token |
| Padding | `var(--space-sm)` (8px) | `var(--space-sm)` | ✅ Token |

**Verdict:** All token-driven. This IS the card to remove.

---

## 4. ViewToggle Sliding Thumb Capability

**Current State:** NO sliding thumb animation exists.

The segmented control renders each option as a separate `<button class="toggle-btn">` with:
- Default: transparent background
- Hover: `var(--color-surface)` background
- Active: `var(--color-teal-bg)` background + `var(--color-teal)` text (+ glow in dark)

The active state is a per-button style change, not a sliding indicator. The "sliding thumb" for the alive layer will be a **new visual layer** — an absolutely positioned element that animates `translateX` to sit behind the active segment.

**Implementation approach:** Add a `.thumb` element inside `.view-toggle` that:
- Has same height as buttons (~32px), pill radius
- Background: `var(--color-teal-bg)` (light) / `var(--color-teal-bg)` + `box-shadow: var(--glow-card)` (dark)
- Positioned via `transform: translateX(...)` based on active index
- Transition: `transform 200ms var(--ease)`

Must default to current static behavior when not enhanced (for /transactions regression safety).

---

## 5. Vertical Rhythm Source

### Current Lending/Borrowed (via ListToolbar):
- **Above toolbar:** Determined by `LendingBalanceHeader` / `LendingSummaryCards` bottom margins + `ListToolbar` top (no explicit margin-top on `.list-toolbar`)
- **Below toolbar:** `.list-toolbar { margin-bottom: var(--space-lg); }` = 24px

### Target /transactions:
- **Header → Toolbar:** `:global(.page-header) { margin-bottom: var(--space-2xl); }` = 48px
- **Toolbar → List:** `.txn-toolbar { margin-bottom: var(--space-md); }` = 16px

### Required Changes:
1. **Increase gap above toolbar** — add `margin-top: var(--space-xl)` (24px) or similar to toolbar, or ensure hero has `margin-bottom: var(--space-2xl)` like transactions
2. **Decrease gap below toolbar** — change `margin-bottom: var(--space-lg)` (24px) → `var(--space-md)` (16px) to match transactions

The hero (`LendingBalanceHeader`) and summary cards (`LendingSummaryCards`) are separate components — their bottom margins control the gap above toolbar.

---

## 6. Untouched Sources Confirmation

| Element | Component | Status |
|---------|-----------|--------|
| Header (title + subline + ⋯ + New Lending) | `PageHeader` + inline snippets | **UNTOUCHED** |
| Hero (totals gradient bar + count-up) | `LendingBalanceHeader` | **UNTOUCHED** |
| Summary cards (3-col lent/recovered/outstanding) | `LendingSummaryCards` | **UNTOUCHED** |
| List cards internal layout | `ActiveIouList` | **UNTOUCHED** (finding only) |
| Dashed group rules (Overdue coral / Later teal) | `ActiveIouList` `.group-header` | **KEPT** |

---

## 7. Finding-Only: List Card Right-Edge Alignment

**File:** `src/lib/components/ActiveIouList.svelte`

**Card View (`.iou-right`):**
- `min-width: 90px`, `flex-direction: column`, `align-items: flex-end`
- Stacks: amount → countdown pill → state pill → hover actions
- Amount: `font-size: var(--font-size-base)`, `font-weight: 700`, mono
- Countdown pill: 10px, pill radius, colored
- State pill: 9px, uppercase, shown on hover only

**Table View:**
- Progress wrap: `min-width: 80px`, `justify-content: flex-end`
- Progress track: 50px width
- Progress label: 30px width, right-aligned

**Issue:** Column balance between amount / countdown / progress bar — the right edge alignment varies by content length. The amount (mono, tabular-nums) should right-align with progress bar track, but countdown pill and state pill create visual inconsistency. This is a **separate follow-up finding**, not fixed this pass.

---

## 8. Responsive Behavior Reference

### /transactions (target):
- **Desktop:** Search (max 270px) + filters left, ViewToggle right
- **Tablet (~900px):** Search full-width row above, filters + ViewToggle on row below
- **Mobile (<768px):** `.txn-toolbar` becomes `flex-direction: column`, search 100% width, ViewToggle right-aligned on second row

### ListToolbar current (lines 79-88):
```css
@media (max-width: 767px) {
  .list-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .list-toolbar :global(.toolbar-views) {
    justify-content: flex-end;
  }
}
```

Stacks vertically but keeps the card wrapper. After de-boxing, need similar but with naked controls.

---

## Summary of Required Changes

1. **Remove ListToolbar wrapper card** — strip bg/border/radius/shadow/padding from `.list-toolbar`
2. **Re-home status to left** — already in left zone, but ensure search leads, status follows (current order is correct)
3. **Resize search to peer control** — match `/transactions` height (44px), surface (`--color-surface`), border (`--color-hairline`), radius (`--radius-pill`)
4. **Vertical rhythm** — increase gap above (match header's 48px), decrease gap below (16px)
5. **Token fixes** — ensure search uses `--color-surface` not `--color-bg`; ViewToggle uses consistent tokens
6. **Alive layer** — sliding thumb on both ViewToggles, search focus ring + icon tint, mount stagger, list scroll-reveal + overdue pulse + progress fill
7. **Reduced motion** — disable all animations/transitions
8. **Responsive** — tablet wrap, mobile stack, no card at any breakpoint
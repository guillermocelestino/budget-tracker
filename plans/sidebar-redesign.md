# Sidebar Redesign — Senior UI/UX Proposal

> **Inspiration:** Linear (premium SaaS velocity + soft active states) × Monarch Money (logical financial grouping)
> **Status:** Design proposal — awaiting approval before implementation

---

## Task 1: Information Architecture — Two-Zone Layout

The current flat list merges navigation and utility. The redesign groups by **frequency of use** and **conceptual role**:

```
┌────────────────────────────────┐
│  ┌──┐  Budget Tracker          │  ← Brand header
│  │  │  Smart Finance           │
│  └──┘                          │
│  ┌──┐  (user avatar + name)    │  ← User profile
│  └──┘                          │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │  ← Subtle divider
│                                │
│  ┌──┐  Dashboard       ★      │  ← Primary Zone
│  ┌──┐  Transactions            │     (core workflows —
│  ┌──┐  Lending                 │      visited daily/weekly)
│  ┌──┐  Reports                 │
│                                │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │  ← Soft divider
│                                │
│  ┌──┐  Categories              │  ← Secondary Zone
│  ┌──┐  Settings                │     (config & reference)
│                                │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │  ← Footer divider
│  ┌──┐  🌙 Dark Mode           │
│  ┌──┐  🚪 Logout              │
│         v0.1.0                 │
└────────────────────────────────┘
```

### Zone Rationale

| Zone | Items | Why here |
|------|-------|----------|
| **Primary** | Dashboard, Transactions, Lending, Reports | Daily/weekly financial workflows. Ordered by frequency: Dashboard is the landing hub, Transactions is the most frequent data-entry surface, Lending is a focused module, Reports is periodic deep-dive. |
| **Secondary** | Categories, Settings | Configuration and reference. Categories feeds Transactions/Lending but is set-and-forget; Settings is rare. Monarch Money groups these at the bottom for a reason — they're infrastructure, not workflow. |
| **Footer** | Dark Mode toggle, Logout, Version | Utility actions. Always accessible, never in the way. |

### Key Changes from Current Implementation

1. **Categories moves from position 4→5** (Primary → Secondary zone)
2. **Settings** is a new item (placeholder for future auth/profile settings)
3. **Reports stays in Primary** — it's an analytical workflow, not config
4. **Collapse/expand** moves into the brand header area (more discoverable, follows Linear's pattern)

---

## Task 2: Visual Design & States

### Dimensions

| State | Width | Behavior |
|-------|-------|----------|
| **Expanded** | **256px** | Comfortable for 14px labels with 40px icons. 256px (not 260) aligns to an 8px grid. |
| **Collapsed** | **72px** | Icon-only. Icons 22×22 centered in 44×44 hit targets. |
| **Mobile drawer** | **300px** | Wider than desktop because finger targets need more spacing. |
| **Transition** | `cubic-bezier(0.22, 1, 0.36, 1)` — 300ms | A "custom ease-out" curve (Linear-style): fast start, graceful settle. Smoother than the current `0.4, 0, 0.2, 1`. |

### Active State — Soft Pill (no left border)

**Current problem:** The left-border indicator (`nav-indicator`) creates visual noise. It fights the user's eye instead of settling it, and in collapsed mode it looks misaligned.

**New approach — Soft Pill:**

```
  Expanded                          Collapsed
┌──────────────────────────┐      ┌────────┐
│                          │      │        │
│  ┌────────────────────┐  │      │  ┌──┐  │
│  │ ■ Dashboard        │  │      │  │■ │  │  ← pill fills entire
│  └────────────────────┘  │      │  └──┘  │     collapsed area
│                          │      │        │
│  Transactions            │      │  ┌──┐  │
│                          │      │  │  │  │  ← no pill = inactive
│  Lending                 │      │  └──┘  │
│                          │      │        │
│  Reports                 │      │  ┌──┐  │
│                          │      │  │  │  │
│                          │      │  └──┘  │
└──────────────────────────┘      └────────┘
```

### Visual Spec — Nav Items

```
┌─────────────────────────────────────┐
│  Padding: 10px 12px                 │  ← 8px gap between items
│  Min-height: 48px (WCAG 2.5.5)      │
│  Gap (icon→label): 12px             │
│                                     │
│  ┌──────────────┐                   │
│  │              │                   │
│  │  22px icon   │  Dashboard        │  ← font-size: 14px (0.875rem)
│  │              │                   │     font-weight: 500 (normal)
│  └──────────────┘                   │
│                                     │
│  ─ ─ ─ STATE ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│                                     │
│  Default:                           │
│    bg: transparent                  │
│    icon: var(--color-text-secondary)│
│    label: var(--color-text)         │
│                                     │
│  Hover (tactile, not distracting):  │
│    bg: oklch(0 0 0 / 4%)           │  ← 4% black in light
│         oklch(1 0 0 / 6%)          │  ← 6% white in dark
│    icon: → slight scale 1.05        │
│    label: no change                 │
│                                     │
│  Active (bold, confident):          │
│    bg: oklch(var(--p) 0.12 / 12%)  │  ← tinted pill
│         (var(--color-primary-light))│
│    icon: var(--color-primary)       │
│    label: var(--color-primary)      │
│    font-weight: 600                 │
│                                     │
│  Active + Hover:                    │
│    bg: same as active (don't        │
│        double up on hover)          │
│    cursor: default                  │
└─────────────────────────────────────┘
```

### Key Design Decisions

**No left-border. Ever.** The pill *is* the indicator. In collapsed mode the pill fills the entire 72px width. The user knows where they are because the item looks pressed-in, not tagged.

**OKLCH for hover opacity** — using the OKLCH color space (or if cross-browser compat is a concern, fallback to `rgba(0,0,0,0.04)` / `rgba(255,255,255,0.06)`) creates a hover that works regardless of the theme. No need to define separate `--hover-bg` for each mode.

**Linear-style icon treatment:** Icons are 22×22 (slightly smaller than current 20×20 — feels more refined). The active state fills the icon with the primary color. Hover scales the icon 1.05× — a < 50ms micro-interaction that feels tactile.

**Monarch-style label hierarchy:** Primary zone items bold-weight on active; secondary zone items slightly smaller (13px vs 14px) to create a visual hierarchy between zones.

### Transitions

```css
/* Collapse/Expand — the sidebar width itself */
--transition-sidebar: width 300ms cubic-bezier(0.22, 1, 0.36, 1);

/* Pill states — hover, active */
--transition-pill: all 150ms cubic-bezier(0.4, 0, 0.2, 1);

/* Label fade — when collapsing, text fades out before icon slides */
--transition-label: opacity 100ms ease 50ms, width 200ms ease;
```

**Label fade-out sequencing (collapsing):**
1. Labels fade to `opacity: 0` (100ms)
2. Nav items re-center icons (200ms)
3. Sidebar width shrinks (300ms)

**Label fade-in sequencing (expanding):**
1. Sidebar width grows (300ms)
2. Nav items shift left to make room (200ms, happens during width growth)
3. Labels fade to `opacity: 1` (150ms, delayed 150ms)

This sequencing prevents label text from "jumping" or appearing mid-shrink, which is the #1 visual jank in the current implementation.

### Icon Updates

Replace the current generic SVG icons with slightly more refined variants:

| Item | Current | New direction |
|------|---------|---------------|
| Dashboard | 4-rect grid | 4-square grid with one filled (like Linear's "active grid") |
| Transactions | Credit card | Arrow-down/arrow-up arrows + card (conveys flow, not just plastic) |
| Lending | Hand with coin | Two-arrow exchange (conveys reciprocity) |
| Reports | Bar chart up | Line chart with trend dot (more analytical feel) |
| Categories | Tag | Grid/dots (Monarch-style category icon) |
| Settings | (new) | Gear — classic, recognizable |

---

## Task 3: Mobile Responsiveness

### Strategy: Off-canvas Drawer (Current) + Optional Bottom Nav

**Primary approach (keep current):** Off-canvas drawer from the left, triggered by hamburger.
**Enhancement:** Add a **bottom navigation bar** on ≤480px for the 4 primary items, so the drawer is needed less often.

```
  Mobile — Hamburger visible (≤768px)     Mobile — Drawer open
┌──────────────────────────┐           ┌──────┬───────────────┐
│ ☰                  $1.2k │           │ ←    │               │
├──────────────────────────┤           │ ─ ─ ─│               │
│                          │           │ ┌──┐ │               │
│  ┌────────────────────┐  │           │ │  │ │               │
│  │ Dashboard          │  │           │ └──┘ │               │
│  │ $245.00 spent      │  │   tap ☰   │      │   (main       │
│  │                    │  │  ──────▶  │ ┌──┐ │    content     │
│  │  [chart]           │  │           │ │  │ │    slides      │
│  │                    │  │           │ └──┘ │    right,      │
│  │ Recent Transactions│  │           │      │    blurred     │
│  │ ...                │  │           │ ─ ─ ─│    overlay     │
│  │                    │  │           │ ┌──┐ │    behind)     │
│  └────────────────────┘  │           │ │  │ │               │
│                          │           │ └──┘ │               │
├──────────────────────────┤           │ ┌──┐ │               │
│  📊  💳  🤝  📈   ←bottom nav     │ └──┘ │               │
│  Dash  Tx  Lend  Rpts   │  ≤480px   │ ─ ─ ─│               │
└──────────────────────────┘           │ ┌──┐ │               │
                                       │ │  │ │               │
   Bottom Nav (≤480px only):           │ └──┘ │               │
   - 4 primary items only              │ ┌──┐ │               │
   - Active pill matches desktop       │ │  │ │               │
   - 48pt min-height                   │ └──┘ │               │
   - iOS-style safe-area padding       └──────┴───────────────┘
```

### Mobile Behavior Rules

| Breakpoint | Behavior |
|------------|----------|
| **>768px** | Desktop sidebar, collapsible via toggle in header. |
| **≤768px** | Sidebar hidden off-screen. Hamburger button fixed top-left. Tapping hamburger slides sidebar in (280px-300px, no collapse mode — always expanded). Overlay backdrop with `backdrop-filter: blur(4px)` behind drawer. |
| **≤480px** | Same as ≤768px, PLUS a bottom nav bar appears for the 4 primary items. Bottom nav is **always visible** even when drawer is open. This means the user can navigate without opening the drawer. |

### Why the Bottom Nav Enhancement?

Financial apps have a high "quick-check" ratio — users open the app, glance at balance, close it. Making them tap a hamburger → find the link → tap again is friction. The bottom nav puts the 4 primary destinations one thumb-tap away. The drawer still exists for secondary items (Categories, Settings, Logout).

### Mobile Transition Spec

```
Drawer slide-in:
  transform: translateX(-100%) → translateX(0)
  duration: 250ms
  easing: cubic-bezier(0.22, 1, 0.36, 1)

Backdrop fade-in:
  opacity: 0 → 1
  duration: 200ms
  easing: ease
  delay: 50ms (starts after drawer begins moving)

Drawer slide-out (on backdrop tap or ESC):
  transform: translateX(0) → translateX(-100%)
  duration: 200ms
  easing: cubic-bezier(0.4, 0, 1, 1)  ← ease-in for exit

Backdrop fade-out:
  opacity: 1 → 0
  duration: 150ms
  easing: ease
```

The exit animation is faster than the entry — this is intentional. Users closing a drawer want it gone instantly; opening can feel a touch more deliberate.

---

## CSS Design Rules Summary

```css
/* ─── Dimensions ─── */
:root {
  --sidebar-width-expanded: 256px;
  --sidebar-width-collapsed: 72px;
  --sidebar-width-mobile: 300px;
  --sidebar-icon-size: 22px;
  --sidebar-hit-target: 44px;
}

/* ─── Transitions ─── */
:root {
  --transition-sidebar: width 300ms cubic-bezier(0.22, 1, 0.36, 1);
  --transition-pill: all 120ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-drawer: transform 250ms cubic-bezier(0.22, 1, 0.36, 1);
}

/* ─── Nav Item Pill ─── */
.nav-item {
  padding: 10px 12px;
  min-height: 48px;
  border-radius: 10px;    /* 10px — wider than --radius-md(8px) for pill feel */
  font-size: 14px;
  font-weight: 500;
  background: transparent;
  transition: var(--transition-pill);
}
.nav-item:hover {
  background: rgba(0, 0, 0, 0.04);      /* light */
  /* background: rgba(255, 255, 255, 0.06); */  /* dark */
}
.nav-item.active,
.nav-item[aria-current="page"] {
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-weight: 600;
}
/* Active in dark mode — use a slightly more saturated tint */
[data-theme="dark"] .nav-item.active {
  background: rgba(99, 102, 241, 0.15);
}

/* ─── Collapsed ─── */
.sidebar.collapsed .nav-item {
  justify-content: center;
  padding: 10px 0;
  width: 48px;
  margin: 0 auto;
  border-radius: 12px;    /* slightly rounder in collapsed mode */
}
.sidebar.collapsed .nav-item.active {
  background: var(--color-primary-light);
  width: 48px;
}

/* ─── Mobile Bottom Nav ─── */
@media (max-width: 480px) {
  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 64px;                         /* + safe-area */
    padding-bottom: env(safe-area-inset-bottom, 0);
    background: var(--color-surface);
    border-top: 1px solid var(--color-border);
    display: flex;
    justify-content: space-around;
    align-items: center;
    z-index: 85;
  }
  .bottom-nav a {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    font-size: 11px;
    font-weight: 500;
    color: var(--color-text-secondary);
    text-decoration: none;
    padding: 4px 12px;
    border-radius: 8px;
    transition: var(--transition-pill);
    min-height: 48px;
    min-width: 56px;
  }
  .bottom-nav a.active {
    color: var(--color-primary);
    background: var(--color-primary-light);
  }
  .bottom-nav a svg {
    width: 22px;
    height: 22px;
  }
}
```

## Implementation Roadmap

When approved, the implementation touches one file: `src/lib/components/Sidebar.svelte`. No new components needed. The changes are:

1. **Information Architecture:** Restructure `navItems` into two arrays (`primaryNav`, `secondaryNav`), render with a `<hr>` separator between them. Add a Settings item (link to `/settings` — can be a placeholder route for now).
2. **Active State:** Remove `nav-indicator` div and all associated CSS. Add the pill background on active. Adjust border-radius on nav-items from `--radius-md` (8px) to 10px.
3. **Collapsed improvements:** Add the sequencing delay for label fade. Tighter collapsed hit targets.
4. **Mobile bottom nav:** New `<nav class="bottom-nav">` at the bottom of the file, visible only at ≤480px, containing the 4 primary items. Keep the drawer for secondary items.
5. **Transition refinements:** Swap the sidebar width transition to the new cubic-bezier curve.

# Net Worth — Final Report

---

## (1) Part-1 Audit Table

| Search | File:Line | Result |
|--------|-----------|--------|
| `netWorth` / `net_worth` / `computeNetWorth` | `rg -rn` across `src/` | **Nothing exists on disk** |
| `NetWorthHero` | `rg -rn` across `src/` | **Nothing exists on disk** |
| `/net-worth` route directory | `ls src/routes/net-worth` | **Does not exist** |
| "net worth" in dashboard | `rg -rni` in `src/routes/dashboard/` | **Nothing exists** |
| Palette check: `--color-cream` | `src/styles/variables.css:9,138` | **Still defined** (#FFF8E7 light, #1A3A37 dark) — FLAGGED but NOT used |
| Schema: `lendings.direction` | `src/lib/database/init.ts:46,102` | **Present** ✅ |

**Outcome: (a) Nothing exists** — build from scratch.

---

## (2) Route/Nav Recommendation + Named-App Traits

**Recommendation:** One new route `/net-worth` + compact teaser widget on `/dashboard`.

| App | Trait | Implementation |
|-----|-------|---------------|
| **Monarch** | Net worth as a first-class tab → own route | `/net-worth` route |
| **Empower/Personal Capital** | Composition-over-time stacked area | Chart.js `Line` with fill + cash band + labeled end-segments |
| **Copilot** | Calm narrative delta | Insight line: "Your net worth is ₱X — up ₱Y this month, mostly from ..." |
| **Rocket Money** | Liabilities that show up | Borrowed leg as coral liability on tipping bar + in chart |
| **Mint** | By-type breakdown podium | Donut with cutout + gold/silver/coral ranked bar list |
| **YNAB** | Exact-cash integrity + honesty caption | "Loans & debts aren't tracked over time yet — the band is your cash journey" |

**Nav placement:** `/net-worth` added as Synthesis entry in primary nav (after Dashboard/Transactions, before Lending/Borrowed). ⚖️-growth icon. NOT in bottom-nav (4-slot sacred). The compact teaser on dashboard covers mobile.

**Why not a half-existing route:** The audit confirmed zero code on disk — full build from scratch.

---

## (3) `getCashPosition()` Seam + Running-Balance Relationship

**Seam:** `src/lib/server/networth.ts` — `getCashPosition(userId)` queries `Σ income - Σ expense ALL-TIME` directly from the `transactions` table. Comment documents:

> "swap to real account balances when an accounts table exists — change only this function."

**Relationship to running balance:** The final running-balance value in the transactions register (after processing ALL transactions in ascending date→id order) should identically equal `getCashPosition()` — they share the same data (`transactions.amount` × sign). The comment documents this so the two screens can never drift.

---

## (4) Files Changed

| File | Change | Part |
|------|--------|------|
| `src/lib/types.ts` | Added `NetWorthLeg`, `CashTrendPoint`, `LegDelta`, `NetWorthSnapshot` types | 3 |
| `src/app.d.ts` | Import `NetWorthSnapshot`; add `netWorth?: NetWorthSnapshot` to PageData | 3,5 |
| `src/lib/server/networth.ts` | **NEW** — `computeNetWorth(userId)`: cash position, lent, borrowed, cash trend, deltas, projection, narrative mover | 3 |
| `src/lib/components/NetWorthHero.svelte` | **NEW** — runs-friendly component with `variant='compact'|'full'`: figure, tipping bar, narrative, podium (donut + ranked list), count-up | 4 |
| `src/routes/net-worth/+page.server.ts` | **NEW** — calls `computeNetWorth(userId)` | 5 |
| `src/routes/net-worth/+page.svelte` | **NEW** — full page: hero, stacked-area chart with timeframe pills, honesty caption, narrative delta, projection chip, drill-down buttons, empty state | 5 |
| `src/routes/dashboard/+page.server.ts` | Calls `computeNetWorth`, adds `netWorth` to return | 5 |
| `src/routes/dashboard/+page.svelte` | Imports `NetWorthHero`, adds compact teaser (after HeroBalanceWidget) | 5 |
| `src/lib/components/Sidebar.svelte` | Adds `/net-worth` to `primaryNav` with growth-arrow SVG icon | 5 |
| `NET_WORTH_REPORT.md` | This report | Report |

---

## (5) New Files Map

```
src/lib/server/networth.ts          ← COMPUTATION helper (all queries scoped)
src/lib/components/NetWorthHero.svelte  ← COMPONENT (two variants)
src/routes/net-worth/+page.server.ts ← SERVER LOAD (calls computeNetWorth)
src/routes/net-worth/+page.svelte    ← PAGE (hero + chart + podium + insights)
```

---

## (6) Recursive Grep Results

```
CHECK: {/* */} in .svelte markup
✅ Zero occurrences (rg -n '\{/\*' src -g '*.svelte')

CHECK: export let / on:click in new/modified files
✅ Zero occurrences (all Svelte 5 runes)

CHECK: cream hex leaks ( #FFF8E7 / #1A3A37 )
✅ Zero cream leaks in net-worth files

CHECK: --cream token usage in new files
✅ No --cream token used in net worth components

CHECK: build (npm run check + vite build)
✅ Passes (only pre-existing errors in CashFlowChart, MonthlyChart, etc.)
```

---

## (7) Per-Screen Observed Acceptance (as demo)

### /dashboard (compact teaser)
- ✅ **Non-zero net rendered** — countUp animates from 0 to ₱406,948 (cash: ₱400,948 + lent: ₱23,000 − borrowed: ₱17,000)
- ✅ **Tipping bar visible** — teal (cash) + gold (lent) right, coral (borrowed) left
- ✅ **Delta chip** — shows biggest mover change vs last month
- ✅ **Whole card links to /net-worth** — `href="/net-worth"` on the wrapping `<a>`
- ✅ **Existing balance hero untouched** — NetWorthHero added after HeroBalanceWidget, not replacing anything
- ✅ **Sidebar** — `/net-worth` in primaryNav with growth-arrow icon

### /net-worth
- ✅ **Hero figure** — equals teaser figure (same `computeNetWorth` snapshot)
- ✅ **Tipping bar** — large, segmented by leg (teal cash right, gold lent right, coral borrowed left)
- ✅ **Composition journey** — stacked-area chart with cash band, timeframe pills (3M/6M/1Y/ALL)
- ✅ **Honesty caption** — under chart: "Loans & debts aren't tracked over time yet..."
- ✅ **Podium** — donut with cutout + ranked bar list (🥇🥈🥉)
- ✅ **Narrative delta** — insight line naming biggest mover
- ✅ **Projection chip** — sky-tinted estimate box
- ✅ **Drill-down buttons** — cash→/transactions, lent→/lending, borrowed→/borrowed
- ✅ **Empty state** — only shows when net === 0 and no legs

### Arithmetic (hand-checked via SQLite)
```
Cash position:     ₱400,948  (income ₱638,500 − expenses ₱237,552)
Active lent:       ₱23,000   (direction='lent', status='active')
Active borrowed:   ₱17,000   (direction='borrowed', status='active')
──────────────────────────────────────────
Net worth:         ₱406,948  (= cash + lent − borrowed) ✅
```

### Dark mode
- ✅ No sludge, no warm tint
- ✅ Surface uses `--color-surface` (#12302E), not cream
- ✅ Tipping bar + stacked area read clean
- ✅ All glows use colored glow tokens

---

## Palette Note

`--color-cream` (#FFF8E7 / #1A3A37) still exists in `variables.css` (legacy token used by other components). This screen **never references it** — all cards use `--color-surface`, backgrounds use `--color-bg`, and section dividers use `--color-hairline`. No cream was reintroduced.

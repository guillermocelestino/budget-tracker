# Unification Pass — One Standard for Every List Page

## Context

The app's list pages evolved separately: the Recurring module shipped a newer "calm mint soft-UI" design (solid mint header bands, mono direction-colored money, tooltipped hover clusters, no dashes, a calm category-hue remap), while Transactions, Lending, and Borrowed still carry the older "arcade" language — dashed hairlines everywhere, black display-font money on the summary cards, a gold accent on Net Balance, a gold-addicted active state, page-local category colors, and a duplicate filter footer.

This pass unifies all list pages onto ONE standard, using Recurring as the reference for chrome+money, Transactions as the reference for trend pills / primary action / category map, and extracting shared components so any future list page inherits the standard. **Confirmed scope: list pages only** (Transactions, Recurring, Lending, Borrowed + the components they render). Dashboard / Reports / Net Worth / Settings / Import wizard are left as-is. **Confirmed: full gold retirement** — gold survives only at the mobile FAB, the desktop Add button, and (nonexistent) scrubber thumb; a new amber token replaces semantic "due soon / warn" gold.

Acceptance = `npm run lint` + `npm run check` clean, and the auditable matrix filled from ACTUAL visual QA.

## Design tokens (add)

`src/styles/variables.css` — add to BOTH `:root` and `[data-theme="dark"]`:
- Light: `--color-amber: #c07a1e; --color-amber-bg: rgba(192,122,30,0.14); --color-amber-dark: #a06010;`
- Dark: `--color-amber: #e9a94f; --color-amber-bg: rgba(233,169,79,0.16); --color-amber-dark: #f2b96a;`

Do NOT repoint `--color-warning` (still = gold; offline banner in `+layout.svelte` depends on it) and keep `--color-primary: var(--color-gold)` (Button primary = the allowed desktop Add). The mint family (`--mint-tint`, `--teal`, `--teal-deep`, `--rose`, `--rose-soft`, `--muted`, `--line`) already exists with dark variants — reuse as-is. `--focus` and `--glow-card` confirmed present in both themes (light 75/81, dark 254/260) — no new tokens needed for focus rings (amendment 6). **PR follow-up:** repoint `--color-warning` to amber after auditing its consumers (then gold is purely accent) (amendment 7).

## New files

**`src/lib/utils/categoryColors.ts`** — single global category→hue map (rule 5), moved from RecurringList's local copy (lines 70–132). Theme-aware (correction 2):
- `CATEGORY_HUES`: `Food & Dining: '#c0564f'` (rose) · `Entertainment: '#8f7ab8'` (calm violet) · `Shopping: '#b0864d'` (amber) · `Transportation: '#c07a3e'` (orange) · `Bills & Utilities: '#468499'` (ocean teal) · `Salary / Cash / Income: '#3f8f79'` (teal) · plus Freelance/Other Income/Healthcare/Education/Other Expense calm cuts.
- `getCategoryHue(name, dbColor)`: exact map → keyword regex (`salary|cash|income`→teal, `food|dining|grocer`→rose, `entertain|movie|game`→violet, `shop|retail|cloth`→amber, `transport|travel|fuel|gas|taxi`→orange, `bill|utilit|rent|mortgage|electric|water|internet|phone`→ocean) → `dbColor` if not `isForbiddenHue` (blue→violet, hue 205–305, neutralized) → fallback `'#4f9d88'`.
- `getCategoryTint(name, hue, isDark)`: `CATEGORY_TINTS['Bills & Utilities'] = '#e0eef2'` solid override applies in LIGHT only; dark uses `withAlpha(hue, 0.22)` for Bills & Utilities as well. Otherwise `withAlpha(hue, 0.12)` light / `withAlpha(hue, 0.22)` dark.
- `getCategoryText(name, hue, isDark)`: fg for pill/chip text + glyph — `hue` in light, lightened cut **~35% toward white** in dark so every category passes AA on dark surfaces. `lightenHex(hex, 0.35)` exported.
- Move `hexToRgb`/`withAlpha`/`isForbiddenHue` here. Callers pass `isDark` from a runes-based `useIsDark()` helper (MutationObserver on `<html data-theme>`), a small shared store — no page CSS.

**Theme source — reuse the EXISTING `src/lib/stores/preferences.svelte.ts`** (amendment 4): add `export const isDark = $state(false)` there, synced client-side via a `MutationObserver` on `<html data-theme>` (the attribute `applyTheme` sets); `false` default server-side = SSR-safe. No parallel store. Components read the reactive `isDark` and pass it to `getCategoryTint`/`getCategoryText`.

**`src/lib/components/CountChip.svelte`** — `{ count, suffix }` props → `<span class="count-chip">{count} {suffix}</span>`; mint-bg mono teal-deep pill (lifted from recurring page lines 602–614).

**`src/lib/components/DateHeaderBand.svelte`** — `{ label, count, subtotal, sticky = true }` props. Solid mint band `background: var(--mint-tint)`, no bottom border (or solid `--line`), mono `--muted` count, mono tabular-nums subtotal via `formatSignedCurrency` colored `var(--teal)`/`var(--rose)`. When `sticky`: `position: sticky; top: 0; z-index: 4` — explicit z-index above rows (correction 5); verify no seam bleed while scrolling in both themes.

**`src/lib/components/SummaryCard.svelte`** — `{ label, value, tone: 'in'|'out'|'auto', hero = false, icon (snippet), active = false, dimmed = false, onclick, ariaPressed, trend?: { text, sentiment: 'positive'|'negative' }, className }` props.
- Root **must** be `.card`, children `.card-accent`/`.card-icon`/`.card-content`/`.card-label`/`.card-value`/`.hero-value`/`.card-trend` so the transactions page's `:global(main.main-content .summary-cards .card …)` mobile overrides keep working.
- Value: `font-family: var(--font-mono); font-variant-numeric: tabular-nums` (rule 2 applies inside the shared component too) + `formatSignedCurrency(value)` colored `--teal` (tone in / positive) or `--rose` (tone out / negative); `tone='auto'` = sign-driven (Net Balance). Hero → 22px/800.
- Accent bar + icon tinted teal/rose. Trend chip: `.positive` → teal on mint-tint, `.negative` → rose on rose-soft (sentiment-correct per rule 3).
- `.active` → `border-color: var(--teal); box-shadow: var(--glow-card); transform: scale(1.02)` (gold retired). Renders `<button aria-pressed>` when `onclick`, else `<div>`; when a button, `:focus-visible { outline: none; box-shadow: var(--focus) }` (shared ring token, correction 4).

**`src/lib/components/RowHoverActions.svelte`** — configurable quick-action cluster + tooltips, behavior lifted verbatim from RecurringList (lines 134–205: 250ms pointer intent, instant on focus-visible, Escape/scroll/blur hide, edge-aware tooltip flip, `@media (hover:hover) and (pointer:fine)` gating with 70ms delay).
- `{ actions: RowAction[] }` where `RowAction = { id, label, text?, icon?, onClick, tone?: 'danger', hideBelow?: 'lg'|'md' }`. `text` renders a labeled pill (e.g. "Mark Paid"), else an icon button. 44px footprint. Each quick button uses `:focus-visible { box-shadow: var(--focus) }` (correction 4).
- Host adds `data-hover-row` to each row; host owns the layout slot via its own scoped CSS (see correction 1 for transactions placement).

## Phase A — Foundation

- `src/styles/variables.css` — amber tokens (above).
- `src/lib/utils/format.ts` — add `formatSignedCurrency(amount)` → `(amount >= 0 ? '+' : '−') + formatCurrency(Math.abs(amount))` (consolidates the ad-hoc `+`/`−` prefixes).
- `src/lib/components/Button.svelte` — add `variant?: 'teal'` (`.btn-teal`: solid `var(--teal)` bg, surface text, `0 4px 16px rgba(79,157,136,0.18)` glow, hover `--teal-deep`; mirrors FilterFooter's Apply) and an optional `el = $bindable(null)` bound on both `<a>` and `<button>` (recurring Add needs `bind:this`). Keep `.btn-primary` gold untouched.
- `src/lib/components/EmptyState.svelte` — line 75 `border: 1px dashed var(--color-hairline)` → `solid`; `.empty-action` gold gradient → solid `var(--teal)`. Rule (correction 6): empty-state CTA stays teal while a gold header Add coexists on screen (true on all four list pages); it only becomes gold (`variant="primary"`) when it is the sole create affordance. (Reports — out of scope — uses EmptyState; its CTA becomes teal too; acceptable, note in PR.)
- Plus the new files above (categoryColors.ts, theme store, CountChip, DateHeaderBand, SummaryCard, RowHoverActions).

## Phase B — Money (rule 2) + category map (rule 5)

**`src/lib/components/TransactionList.svelte`**
- Amount tokens `.amount-income/.amount-expense` (1016–17) → `var(--teal)`/`var(--rose)`; `runningBalanceColor` (275–77) and `group.subtotalColor` (180) → same.
- Running balance value (422–24) → `formatSignedCurrency`; `.day-subtotal` (339–42) → `formatSignedCurrency(group.subtotal)`.
- Category colors: replace raw `txn.category_color || '#2BA8A2'` in `.cat-stripe`/`.cat-circle`/`.cat-pill` (390, 391, 405) with theme-aware `getCategoryHue` + `getCategoryTint(name, hue, isDark)` + `getCategoryText(name, hue, isDark)` (bars/chips/pills use the lightened dark cut).

**`src/lib/components/TransactionSummary.svelte`** — replace the 3 inline cards with 3 `<SummaryCard>` inside the existing `.summary-cards` grid (keep grid + tablet/mobile CSS here). Income `tone='in'`, Expenses `tone='out'`, Net `tone='auto' hero`. Pass trends as `{ text, sentiment }` from the existing `trendColor(…, inverse)` (expenses already inverted → sentiment-correct). Delete the now-dead `.net-accent` gold (241–44), `.card.active` gold (349–84), and `.card-value` sans/ink (309–22) CSS.

**`src/lib/components/ActiveIouList.svelte`** — money direction-colored: `.iou-amount` (308) and `.amount-num` (1189) get sign + `var(--teal)` (borrowed/inflow, `+`) / `var(--rose)` (lent/outflow, `−`). Keep `.paid-amount` line-through muted. State colors: `due-this-week` gold → `var(--color-amber)` (+ amber-bg/amber-dark), overdue `--color-coral` → `var(--rose)`, on-track `--color-teal` → `var(--teal)` (map at 170–218).

**`src/lib/components/LendingSummaryCards.svelte`** — replace 3 cards with `<SummaryCard>` in the existing grid. Tone by direction: Total lent=`out`/borrowed=`in`; Recovered/Repaid = opposite; Outstanding/Still Owing = `out`. Delete gold-gradient accents (113–26), gold icon tints (146–63), `.card-value` sans/ink (184–89).

**`src/lib/components/LendingBalanceHeader.svelte`** — `.hero-value` (158) → `font-family: var(--font-mono)` (keep tabular-nums); debtor color → `var(--rose)` (168); `.hbl-value.owed/.owe` → `var(--teal)`/`var(--rose)` (214–15); `.hero-ribbon` teal→gold gradient (110–17) → solid `var(--color-teal)`.

## Phase C — Chrome, dashes, control order, title chips (rule 1)

**`src/routes/transactions/+page.svelte`**
- PageHeader (473): add `borderless`; add `{#snippet badge()}<CountChip count={totalCount}/>{/snippet}`; keep `.context-subline` subtitle, color → `var(--muted)`.
- Swap header action order (477–89): `<Button variant="primary" href="/transactions/new">` FIRST, `<OverflowMenu/>` LAST.
- Filter panel (521–33): `panel(_mode, close)` → `panel(mode, close)`, pass `{mode}` to TransactionFilters (stop hardcoding `"sheet"`).
- Selection-bar seam (860): dashed → `1px solid var(--color-hairline)`.
- Pager tick (1078–88): `background: var(--color-gold)` → `var(--teal-deep)`.
- `.flat-header` background (680): `--color-surface-inset` → `var(--mint-tint)` (solid mint band).

**`src/routes/lending/+page.svelte`** + **`src/routes/borrowed/+page.svelte`**
- PageHeader: add `borderless`; add `badge` snippet `<CountChip count={activeLendings.length} suffix="active"/>`; subtitle color → `var(--muted)`.
- Swap header action order (lending 205–13, borrowed 206–14): Button first, OverflowMenu last. (Correction 3: both already use `Button variant="primary"` = gold — confirm only, no restyle needed.)
- Mark-paid modal: replace hand-rolled `.btn-primary` (lending 348, borrowed 360) with `<Button variant="teal" type="submit">Confirm</Button>` + `<Button variant="ghost">Cancel</Button>`; delete local `.btn/.btn-primary/.btn-secondary/.btn-danger` CSS (lending 496–534, borrowed 508–47). Lending radio checked token (472–78) → `var(--color-teal)` (matches borrowed).
- `.register-header` in ActiveIouList (952–69): background → `var(--mint-tint)` (solid mint band).

**`src/lib/components/PageHeader.svelte`** — leave default as-is; list pages use `borderless` (respects list-only scope). Optional low-risk follow-up (flag in PR): change the 3px dashed teal bottom to `1px solid var(--color-hairline)` for all pages.

**`src/lib/components/TransactionFilters.svelte`** — remove local `.sheet-footer` (298–303) + Button import; render shared `<FilterFooter canApply={hasActiveFilters} canClear={hasActiveFilters} onApply={() => onApply?.()} onClear={clearFilters} {mode}/>`; delete `.sheet-footer` CSS (621–31).

**`src/lib/components/TransactionList.svelte`** — dashes → solid + DateHeaderBand:
- `dateHeader` snippet (332–44) → `<DateHeaderBand label count subtotal>`; drop `.date-header`/`.date-label`/`.date-dot`/`.date-count`/`.day-subtotal` CSS (632–72) and `subtotalColor` from groups (180).
- `.txn-row` bottom (797), `.shimmer-row` (919), `.edit-panel` (1099), mobile seams (1334, 1346, 1375, 1398) → `1px solid var(--color-hairline)`.

**`src/lib/components/ActiveIouList.svelte`** — `.group-header` (565): `3px dashed` → `1px solid var(--line)` + mint band (`background: var(--mint-tint)`, label `--teal-deep`); `.iou-row` (997) + mobile seams (1349, 1418, 1480, 1528) → solid.

## Phase D — Gold retirement + primary action (rule 4)

**`src/routes/recurring/+page.svelte`** — Add button (407–16) → `<Button variant="primary" bind:el={addBtnEl} onclick={openAdd}>`; DELETE the local mint `.header-actions .btn.btn-primary` override (617–45) so gold+gloss shows. Parity (correction 3): Transactions/Lending/Borrowed header Add already gold via `variant="primary"` — only Recurring converts this pass. Count chip (402–04) → `<CountChip count={activeCount} suffix="active"/>`; delete local `.count-chip` CSS (602–14). Empty-state CTA `.rr-empty-btn` (690–711) mint → solid `var(--teal)` (gold header Add coexists).

**`src/lib/components/RowActionsMenu.svelte`** — `.row-handle` gold (151) → `var(--color-teal)`.
**`src/lib/components/FiltersSheet.svelte`** — `.filters-handle` gold (122) → `var(--color-teal)`.
**`src/lib/components/OverflowMenu.svelte`** — `.overflow-tag` gold (246–47) → `var(--color-text-muted)`/`var(--color-surface-inset)`.
**`src/lib/components/RecurringList.svelte`** — `.empty-action` (802–23) mint → solid `var(--teal)`.

## Phase E — Shared hover cluster + filter unification (rule 6)

**`src/lib/components/TransactionList.svelte`**
- Replace `.hover-actions` block (436–63) with `<RowHoverActions actions={[edit, duplicate]}/>` in a host `.hover-slot`; delete the Delete quick button (Delete moves to the ⋯ kebab).
- **Overlay placement (correction 1):** the absolute overlay must NEVER cover the BAL or amount cells. Anchor `.hover-slot` right-aligned in the empty middle region, ending BEFORE `.balance-col`. At `≥1200px` prefer a RESERVED actions grid column (like Recurring) appended to the flat-register grid (723–31 + selection variant 735–44) holding the actions + kebab; between `760–1200px` use the void-overlay in the middle region only. Money stays readable during hover at every width.
- Make `.row-menu-btn` kebab visible on ALL widths (remove `display:none` default at 1064 and the ≤640px reveal at 1302); add `data-hover-row` to `.txn-row`. **One kebab (amendment 5):** `<1200px` → kebab in a dedicated 44px grid column with `.fh-kebab` header spacer; `>=1200px` → kebab moves INSIDE the reserved actions column alongside the hover actions. Never both at once.

**`src/lib/components/RecurringList.svelte`**
- Delete local `CATEGORY_HUES`/`getCategoryHue`/etc. (70–132) → import from `$lib/utils/categoryColors` (theme-aware).
- Delete local tooltip machinery (134–205) and inline `.hover-actions` (261–98) → `<RowHoverActions actions={[run, edit, duplicate, pause-or-resume]}/>` with `hideBelow` preserving the 1099px/899px responsive drops. Add `data-hover-row`.

**`src/lib/components/ActiveIouList.svelte`**
- Card `.iou-actions` (324–45) → `<RowHoverActions actions={[edit, duplicate, pay]}/>`; pay = labeled `text` pill.
- Register `.row-actions` (446–62) → `<RowHoverActions actions={[pay, edit, duplicate]}/>`; add per-row kebab + `.rh-kebab` spacer, extend register grid (952–99) to a 6th 48px column. Delete quick-action Delete everywhere (⋯ kebab retains it). Make `.iou-overflow` visible on desktop (913–32). Add `data-hover-row`.

## Decisions / deviations (call out in PR)

1. **Transactions quick actions = Edit + Duplicate** (2, not 4). Spec says "four non-destructive quick actions" (that's Recurring's run/edit/duplicate/pause-or-resume set, preserved). Transactions only has two non-destructive actions; adding filler would be worse. Delete moves to the kebab. (Accepted.)
2. **ActiveIouList money = direction-colored** (lent −rose, borrowed +teal) instead of state-colored, per rule 2. State still reads via accent bar, ring, progress, countdown pill, state chip (now teal/rose/amber). (Accepted.)
3. **PageHeader**: list pages use `borderless`; default dash stays for out-of-scope pages (scope-respecting). Optional global swap to solid hairline flagged as a follow-up. (Accepted.)
4. **Out-of-scope spillover to eyeball**: EmptyState (reports CTA → teal), FiltersSheet/OverflowMenu/RowActionsMenu handles (list components, gold → teal/muted).

## Verification

1. `npm run lint` + `npm run check` (svelte-check) — zero new errors.
2. Grep audits (in-scope files must be clean): `grep -rn "dashed"` on TransactionList/TransactionSummary/ActiveIouList/RecurringList/LendingSummaryCards/LendingBalanceHeader/TransactionFilters/EmptyState + the four `+page.svelte` files; `grep -rn "color-gold\|color-primary\|color-warning"` on the same → only Button.svelte + SpeedDial.svelte remain gold; `grep -rn "category_color || '#2BA8A2'"` gone.
3. **Auditable matrix — FILLED FROM ACTUAL VISUAL QA** after implementation (light + dark, desktop + ≤640px). This is the acceptance template; the ✓/n/a cells below are the expected outcomes to confirm/refute in QA, not pre-baked results:

| Row | Dashes removed | Money mono+colored | Shared Filter | Shared hover | Add-then-⋯ order | Category map |
|---|---|---|---|---|---|---|
| Transactions | ? | ? | ? | ? | ? | ? |
| Recurring | ? | ? | ? | ? | ? | ? |
| Lending | ? | ? | ? | ? | ? | ? |
| Borrowed | ? | ? | ? | ? | ? | ? |

4. Manual spot-checks: gold Add pill + gold FAB still gold, no gold elsewhere on the four pages; Net Balance accent teal/rose; amber "Due Soon" pills; trend chips sentiment-correct (expense decrease = teal); pager tick teal; DateHeaderBand solid mint with mono subtotal + no seam bleed while scrolling in both themes (correction 5); desktop kebab visible without shifting money columns; recurring Salary pill teal-tinted; focus rings on RowHoverActions buttons + SummaryCard buttons use `var(--focus)` (correction 4); transactions hover overlay never covers BAL/amount at any width (correction 1); category pills/bars/chips pass AA in dark theme (amendment 8).

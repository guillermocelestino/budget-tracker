# Fix Transactions page pagination

> **STATUS: Implemented** — Fix A, B, C applied; see "Implementation" at the bottom.

## How pagination works today

- **Server** (`src/routes/transactions/+page.server.ts`, `load`): reads `page`
  from the URL, `limit = 20`, `offset = (page-1)*20`; runs `COUNT(*)` plus a
  `LIMIT/OFFSET` query with the active filters; returns `{ transactions,
  allForBalance, total, page, totalPages, categories }`. Server side is correct.
- **Client** (`src/routes/transactions/+page.svelte`):
  - `goToPage(p)` copies the current URL params, sets `page=p`, and
    `goto('/transactions?...')`.
  - Pagination UI renders when `data.totalPages > 1`: Prev / Next buttons +
    "Page X of Y".
  - Filters live in a `filters` `$state`; a sync `$effect` writes them to the
    URL (and strips `page`), so changing a filter resets to page 1.

## Gaps found

### Gap A — pagination never advances (critical)
`+page.svelte:84-112` — the filter-sync `$effect` builds `newQs` from
`filters` **only** (never includes `page`), then compares it to
`currentQs = $page.url.search` — the **full** query string, which **does**
include `page`. So any time the URL contains `page` (i.e., right after
`goToPage`), the strings differ and the effect calls
`goto('/transactions…')` **without** `page` → resets to page 1.

Effect: clicking Prev/Next navigates then instantly bounces back to page 1, so
users can never get past page 1. This is the "pagination not working" symptom.

### Gap B — category filter is dropped on reload / deep-link
`+page.svelte:43` initializes `filters.category` from the `category` URL param,
but the URL actually stores **`category_id`** (written at line 92; never read
back). On a reload or back-navigation to `?category_id=5&page=2`,
`filters.category` is empty → the sync effect (Gap A) strips both the filter
and the page. A category-filtered deep link doesn't survive a refresh.

### Gap C — malformed / out-of-range `page` (minor hardening)
`+page.server.ts:16` `page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'))`
returns `NaN` for `?page=` or `?page=abc`, producing `OFFSET NaN` (can error in
Postgres); and `?page=99` beyond `totalPages` renders an empty list with
"Page 99 of 2".

## Proposed fixes

### Fix A — make the sync effect ignore `page` when comparing
Compare `newQs` against the current query **with `page` stripped**, so
page-only navigations (`goToPage`) no longer trigger a re-navigate, while
genuine filter changes still navigate (and reset to page 1, as intended).

```js
const newQs = params.toString();
const currentFilterQs = (() => {
  const p = new URLSearchParams($page.url.searchParams);
  p.delete('page');
  return p.toString();
})();
if (newQs !== currentFilterQs) {
  goto(`/transactions${newQs ? '?' + newQs : ''}`, { keepFocus: true, noScroll: true });
}
```

### Fix B — hydrate the category filter from a `category_id` deep-link
Once `data.categories` is available, if the URL has a `category_id` and
`filters.category` is unset, map it back to the category name so the filter
(and the page, once Fix A lands) survives a reload/back-nav.

```js
$effect(() => {
  const urlCatId = $page.url.searchParams.get('category_id');
  if (!urlCatId || filters.category) return;
  const cat = (data.categories ?? []).find((c) => String(c.id) === urlCatId);
  if (cat) filters.category = cat.name;
});
```

### Fix C — guard the server `page` value
Coerce non-numeric page to `1`, and clamp `page` to `totalPages` after the
count so an out-of-range page shows the last valid page instead of an empty
list:

```js
const rawPage = parseInt(url.searchParams.get('page') ?? '1', 10);
let page = Number.isFinite(rawPage) ? Math.max(1, rawPage) : 1;
// …after countRow…
const totalPages = Math.ceil((countRow?.total ?? 0) / limit);
page = Math.min(page, totalPages || 1);
const offset = (page - 1) * limit;
```

## Scope / decisions
- Fix A is **required** (core pagination bug).
- Fix B is **recommended** (fixes filter persistence that also breaks
  pagination on reload).
- Fix C is **optional hardening** — include only if desired.

## Verification
1. `npm run check` — no new errors.
2. Manual: with >20 transactions, click Next → page 2 shows (no bounce);
   Prev/Next disabled at bounds; "Page X of Y" accurate.
3. Apply a category filter, reload the URL → filter + page survive.
4. `?page=abc` and `?page=99` render safely.

## Implementation

**Fix A** — `+page.svelte` filter-sync `$effect`: compares `newQs` (filters
only) against the current query **with `page` stripped** (`currentFilterQs`),
so `goToPage` navigations are no longer overwritten; genuine filter changes
still drop `page` → reset to page 1.

**Fix B** — new hydration `$effect` (declared **before** the filter-sync
effect) restores `filters.category` from a `category_id` deep-link once
`data.categories` is available. `lastHydratedCatId` guards against
re-hydrating a category the user just cleared.

**Fix C** — `+page.server.ts` load: `rawPage` parsed with `parseInt(..., 10)`,
`page` defaults to 1 when non-numeric, and after the count is known it is
clamped to `min(page, max(totalPages, 1))` before computing `offset`.

**Export check** — `/api/transactions/export` defaults to `exportType='all'`
(no LIMIT) so both CSV (page URL, no exportType → 'all') and PDF
(`exportType=all` set explicitly) export **all** filtered records, not just the
visible page. No change needed.

**Sorting** — the Transactions page has no user-facing sort control (server
ORDER BY is fixed `date DESC, id DESC`), so there is no sort order to reset.

## Follow-up: viewport jump on pager click

**Symptom** — clicking a `pager-btn` sometimes scrolls the page up a small
amount instead of keeping the viewport still; intermittent.

**Root cause** — the original scroll-restore `$effect` measured the pager's
rect *after* the new page rendered (single `requestAnimationFrame`, computing
`absTop - top`) and raced with the browser re-clamping scroll while the new
page's content height renders (most notably the shorter last page) and with
SvelteKit re-asserting its own `scroll_state()` after re-render. When the two
pages' rendered heights differ the measurement is already shifted and the
computed target overshoots → jump; when heights match it is exact → "sometimes".
The global `scroll-behavior: smooth` (`+layout.svelte:153`) turned any residual
mismatch into a visible animated glide.

**Fix** — `goToPage` now captures the exact `window.scrollY` *before*
navigating, `await`s `goto(...)` (so the restore runs after SvelteKit's own
scroll handling, and an aborted navigation is a no-op), then re-applies that
position inside a double-`requestAnimationFrame` with `behavior: 'auto'`. No
DOM measurement, no race; rAF runs before paint so the clamped intermediate
position is never shown. The `pagerEl`/`pendingPagerTop` state and the
restore `$effect` were removed.

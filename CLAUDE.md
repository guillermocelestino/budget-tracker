# Budget Tracker — CLAUDE.md

## Architecture
- **Framework:** SvelteKit with Svelte 5 runes (`$state`, `$derived`, `$props`, `$effect`)
- **Database:** Dual SQLite (dev) / PostgreSQL (production via Neon serverless) — auto-detected via `POSTGRES_URL` env var
- **Auth:** JWT-based (`jsonwebtoken` + `bcryptjs`), session cookie named `session`, 7-day expiry, httpOnly, sameSite=lax
- **CSS:** Hand-written with custom properties (`src/styles/variables.css`), no framework
- **Charts:** Chart.js via `svelte-chartjs`, registered globally in `src/lib/utils/chart.ts`
- **Deployment:** Vercel adapter (`@sveltejs/adapter-vercel`)
- **PWA:** `@vite-pwa/sveltekit` with auto-update, NetworkFirst caching for API and page routes (disabled in dev)

## Route Structure
### Page Routes
- `/` — Redirects to `/dashboard` (server-side 302 in hooks + client-side SPA redirect)
- `/login` — Auth page, POST action validates credentials, sets `session` cookie, redirects to `/dashboard`
- `/logout` — GET handler, deletes `session` cookie, redirects to `/login`
- `/dashboard` — SummaryCards, LendingSummaryCards, Sparkline trends, MonthlyTrendChart, CategoryDonutChart, recent TransactionList, delete modal
- `/transactions` — Paginated list (20/page), collapsible filters (type, category, date range), summary bar computed client-side, delete modal
- `/transactions/new` — Add transaction form (TransactionForm component, 640px centered card)
- `/transactions/[id]/edit` — Edit transaction (same TransactionForm, pre-filled)
- `/categories` — Category list (card/table toggle), CategoryForm (inline panel), CategoryUsageBar, create/update/delete actions with FK constraint handling (409 on delete conflict)
- `/lending` — Lending tracker, SummaryCards (3-column: lent/recovered/outstanding), card/table toggle, active/paid tabs, create/update/markPaid/delete actions. `markPaid` can optionally record an income transaction under "Lending Recovery"
- `/settings` — Placeholder page for user preferences
- `/reports` — Charts with tabs (Overview/Income/Expenses/Lending), year/month selectors, MonthlyChart with linear regression, CategoryChart donut with breakdown tables, YearOverYearCard, lending recovery overview

### API Routes (RESTful, user-scoped, JSON)
- `/api/transactions` — GET (paginated, filterable), POST
- `/api/transactions/[id]` — GET, PUT, DELETE
- `/api/transactions/export` — GET (CSV)
- `/api/categories` — GET (with optional spending), POST
- `/api/categories/[id]` — GET, PUT, DELETE
- `/api/lendings` — GET (filterable by status), POST
- `/api/lendings/[id]` — GET, PUT, DELETE
- `/api/reports/monthly` — GET (?year=)
- `/api/reports/by-category` — GET (?year=&month=)
- `/api/reports/export` — GET (?start=&end=)

### Root Layout (+layout.svelte)
- Renders `Sidebar` on all authenticated pages (hidden on `/login` and `/`)
- Imports `variables.css` globally (no separate app.css)
- App shell: flex layout, sidebar (256px/72px collapsed), main area with max-width 1200px
- Mobile (<768px): off-canvas drawer with hamburger toggle, backdrop blur overlay
- Mobile (≤480px): bottom navigation bar with 4 primary items, pushes main content up
- Includes `ToastContainer` and `PwaUpdate` globally

## Component Inventory (21 components, flat directory)
### UI Shell
- `Sidebar.svelte` — Two-zone navigation: Primary (Dashboard, Transactions, Lending, Reports) and Secondary (Categories, Settings). Soft-pill active state (10px radius, no left border), sequenced collapse/expand with label fade. Responsive: off-canvas drawer ≤768px, bottom nav ≤480px. Collapse (256↔72px), dark mode toggle, logout, theme persisted to localStorage.
- `PageHeader.svelte` — Heading + optional subtitle snippet, sticky top
- `PageBackground.svelte` — Decorative gradient background
- `Button.svelte` — Reusable button (variants: primary, danger, ghost, link; sizes: sm, md)

### Data Display
- `SummaryCards.svelte` — Props: totalIncome, totalExpenses, balance, savingsRate (4 cards, income/expense/balance/savings, animated countUp)
- `LendingSummaryCards.svelte` — Props: totalLent, totalRecovered, outstanding (3 cards)
- `TransactionList.svelte` — Props: transactions, onDelete, showActions (table or card layout at ≤480px)
- `TransactionForm.svelte` — Props: categories, transaction?, action?, errors? (type toggle, ₱ amount with comma formatting, description textarea with char count, date input with Today button, filtered category select)
- `CategoryList.svelte` — Props: categories, spending, income, onEdit, onDelete (card/table views)
- `CategoryForm.svelte` — Props: mode, category?, errors?, onsubmit (name, icon, color, type, budget_limit toggle)
- `CategoryUsageBar.svelte` — Props: spent, budget, compact (progress bar)

### Charts
- `Sparkline.svelte` — Props: labels, data (compact line chart via Chart.js, no axes)
- `MonthlyTrendChart.svelte` — Props: labels, incomeData, expenseData (bar + line chart, dark-mode-aware grid colors via matchMedia)
- `MonthlyChart.svelte` — Props: labels, incomeData, expenseData (used by reports, includes linear regression trendline)
- `CategoryDonutChart.svelte` — Props: labels, data, colors (doughnut chart)
- `CategoryChart.svelte` — Props: labels, data, colors (used by reports, larger donut)
- `YearOverYearCard.svelte` — Month-over-month and YTD comparison metrics

### UI Utilities
- `ModalDialog.svelte` — Props: open, title, onclose, children (snippet). Backdrop + centered box, ESC to close
- `ToastContainer.svelte` — Reads from `$lib/stores/toast.svelte.ts`, slideInDown/slideInUp animations
- `PwaUpdate.svelte` — Service worker update detection with reload toast

## Database (`src/lib/database/`)
- **`index.ts`** — Lazy-init gate. Detects `POSTGRES_URL` → `usePostgres` boolean. Exposes `getPgPool()` and `getSQLiteDb()`, both auto-run `initDb()` once. SQLite DB at `data/budget.db` (WAL mode, foreign keys on).
- **`query.ts`** — Three cross-DB functions: `queryOne<T>()`, `queryMany<T>()`, `execute()`. All SQL written in **Postgres dialect**; `translatePgToSQLite()` auto-converts `$1→?`, `::type` removal, `TO_CHAR→strftime`, `EXTRACT→strftime`, `NOW→datetime`, `CURRENT_DATE→date`.
- **`init.ts`** — Schema: 4 tables (users, categories, transactions, lendings) with equivalent Postgres/SQLite DDL. Indexes on user_id, date DESC, category_id, type, status. Seed data: 2 default users + 11 categories.
- **`migrations/001_add_type_to_categories.ts`** — Adds type column to categories, checks PRAGMA before running.

## Server Patterns
### Auth (hooks.server.ts)
- Root `/` → 302 to `/dashboard`
- Public paths: only `/login`
- All other routes: read `session` cookie → `verifyToken()` → set `event.locals.user = { userId, username }` or redirect `/login`

### Auth (`src/lib/auth.ts`)
- JWT secret: `process.env.JWT_SECRET` or dev fallback `'budget-tracker-dev-secret-change-in-production'` (throws if Postgres active and secret missing)
- `createToken(userId, username)` → 7-day JWT
- `verifyToken(token)` → `{ userId, username }` or null
- `hashPassword(pw)` / `verifyPassword(pw, hash)` via bcryptjs

### Server Data Patterns
- Page server files use `load({ locals })` — authenticate via `locals.user!.userId`
- Form actions return `{ success: true }` or `fail(status, { error })` with named actions (`?/create`, `?/update`, `?/delete`, `?/markPaid`)
- Database queries: `queryOne<T>(sql, params)`, `queryMany<T>(sql, params)`, `execute(sql, params)` — all imported from `$lib/database/query`
- All transactions queries include `LEFT JOIN categories c ON t.category_id = c.id` for category data
- Form actions pattern: `use:enhance` with callback that calls `await update()` to reload page data after mutation, then shows toast

### State Management
- Only one store: `src/lib/stores/toast.svelte.ts` — Svelte 5 runes-based (`$state`)
- Exports: `showSuccess()`, `showError()`, `showInfo()`, `dismissToast()`, `toastState`
- Auto-dismiss after 4 seconds (configurable)

## Type System (src/lib/types.ts)
- `Transaction`, `TransactionFormData`, `Category`, `CategoryFormData`, `MonthlyReportItem`, `CategoryReportItem`, `DashboardSummary`, `PaginatedResult<T>`, `User`, `Lending`
- `App.PageData` (app.d.ts): Union of all page data shapes across all routes

## Design Tokens (src/styles/variables.css)
### Colors
- Context colors: `--color-bg` (#f8f9fa), `--color-surface` (#fff), `--color-border` (#e5e7eb), `--color-text` (#1a1a2e), `--color-text-secondary` (#6b7280)
- Brand: `--color-primary` (#6366f1), `--color-primary-hover` (#4f46e5), `--color-primary-light` (#eef2ff)
- Semantic: `--color-income` (#10b981), `--color-income-light` (#d1fae5), `--color-expense` (#ef4444), `--color-expense-light` (#fee2e2), `--color-warning` (#f59e0b), `--color-warning-light` (#fef3c7), `--color-danger` (#ef4444), `--color-danger-hover` (#dc2626)

### Spacing: `--space-xs`(4px), `--space-sm`(8px), `--space-md`(16px), `--space-lg`(24px), `--space-xl`(32px), `--space-2xl`(48px)

### Radii: `--radius-sm`(6px), `--radius-md`(8px), `--radius-lg`(12px), `--radius-xl`(16px), `--radius-full`(9999px)

### Shadows: `--shadow-sm`, `--shadow-md`, `--shadow-lg` — all with ~2-3× higher alpha in dark mode

### Typography: `--font-family` (system stack), `--font-mono`, `--font-weight-{normal,medium,semibold,bold}`, `--font-size-{xs,sm,base,lg,xl,2xl,3xl}`

### Layout: `--sidebar-width` (260px/72px collapsed), `--z-{sidebar:90,modal:1000,toast:9999}`, `--transition-{fast(150ms),normal(250ms),slow(400ms)}`

### Dark Mode
- Selector: `[data-theme="dark"]` — set on `<html>` by Sidebar's `toggleTheme()` on mount (reads localStorage)
- Color `-light` tokens switch from solid hex to `rgba(*, 0.15)` in dark mode
- Login page ignores dark mode (hardcoded light)
- Chart.js uses `matchMedia('(prefers-color-scheme: dark)')` independently in MonthlyTrendChart

### Accessibility
- `prefers-reduced-motion: reduce` → all transitions zeroed out (only the custom-property ones; keyframe revealed are not suppressed)
- All interactive elements: min-height ≥44px (WCAG 2.5.5)

## Format Utilities (src/lib/utils/format.ts)
- `formatCurrency(amount)` — ₱ formatted (en-PH locale)
- `formatDate(dateStr)` — "Jul 15, 2026"
- `formatDateShort(dateStr)` — "Jul 15"
- `parseDate(dateStr)` → Date object
- `formatDateInput(date?)` — "2026-07-15" (YYYY-MM-DD)
- `getCurrentMonth()` — "2026-07"
- `getMonthLabel(monthStr)` — "Jul 2026"
- `validateAmount(value)` → `{ valid, error?, value? }`
- `formatWithCommas(value)` — "1,250.00"
- `handleAmountInput(e)` — Strips non-numeric, formats with commas, returns raw
- `handleAmountFocus(e, rawAmount)` — Shows raw value for editing
- `handleAmountBlur(e, rawAmount)` — Reformats with commas, handles decimals
- `formatEditAmount(value)` — Format stored value for edit display
- `countUp(target, duration, onFrame)` — Animated number count (cubic ease-out)
- `transactionsToCSV(transactions)` — CSV with proper escaping (commas, quotes, newlines)

## Chart Utilities (src/lib/utils/chart.ts)
- Registers all Chart.js components globally (`Chart.register(...registerables)`)

## Pattern Rules
- Use **Svelte 5 runes** (`$state`, `$derived`, `$props`, `$effect`, `$effect.pre`) — NOT Svelte 4 `export let` or `$:`
- Use **SvelteKit form actions** with `use:enhance` for data mutations (with enhance-fiscal callback pattern returning `async ({ result, update })`)
- All CSS uses **CSS custom properties** from `variables.css` — no hardcoded colors
- **No Tailwind/Bootstrap** — hand-written CSS only in scoped `<style>` blocks
- Use **`as App.PageData`** type assertion for `$page.data` (current pattern from `app.d.ts`)
- Hardcoded `rgba(255,255,255)` and `backdrop-filter` break dark mode — use `var(--color-surface)` instead
- Prefer **inline improvements** over extracting new components (previous extraction attempts were rejected)
- **Plan first, code second:** Write strategy in `plans/<short-description>.md` and present for proof before coding

## To Run
```bash
npm run dev
```

## Styling Conventions
- Cards: `background: var(--color-surface)`, `border: 1px solid var(--color-border)`, `border-radius: var(--radius-lg)` or `--radius-xl`, `box-shadow: var(--shadow-sm)`, hover → `transform: translateY(-2px)` + `box-shadow: var(--shadow-lg)`
- Forms: inputs have `padding: var(--space-sm) var(--space-md)`, `border: 1px solid var(--color-border)`, `border-radius: var(--radius-sm)`, focus: `border-color: var(--color-primary)` + `box-shadow: 0 0 0 3px var(--color-primary-light)`, error: `border-color: var(--color-expense)`
- Buttons: min-height 44px, font-weight 600, transition: `all var(--transition-fast)`, border-radius: `var(--radius-md)`
- Responsive breakpoints: 1024px (charts 2-col), 768px (sidebar hidden, mobile layout), 640px (table hides description column), 480px (table→cards, form actions stack)
- SVG icons: inline in templates, not icon library or sprite file
- Global reset in layout: `:global(*) { margin: 0; revert: 0; box-sizing: border-box; }`
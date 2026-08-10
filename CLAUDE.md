# Budget Tracker — CLAUDE.md

## Architecture
- **Framework:** SvelteKit with Svelte 5 runes (`$state`, `$derived`, `$props`, `$effect`) — no Svelte 4 `export let` / `$:` anywhere
- **Database:** PostgreSQL/Neon only (via `@neondatabase/serverless`). All SQL written in native Postgres dialect. `DATABASE_URL` (or `POSTGRES_URL`) is required at runtime — throws if missing. Local development wires `LOCAL_DEV_DATABASE_URL` → `DATABASE_URL` via `src/lib/server/db/loadEnv.ts` (no SQLite fallback). E2E tests require `DATABASE_URL` pointing to a Neon branch.
- **Auth:** Auth.js (`@auth/sveltekit`) Credentials provider with JWT session strategy — authenticates against the existing `users` table + existing bcrypt `$2b$10$` hashes. Session cookie `authjs.session-token` (30-day, httpOnly, sameSite=lax). Login/logout via the SvelteKit `/login` form action and `/logout` route, both delegating to the single Credentials `authorize()` in `src/auth.ts`; protected routes resolve the session via `event.locals.auth()` in hooks. Legacy JWT auth (`jsonwebtoken`/`JWT_SECRET`/`session` cookie, `createToken`/`verifyToken`) is removed (Auth-5); password hashing moved to `src/lib/server/auth/password.ts`
- **CSS:** Hand-written with custom properties (`src/styles/variables.css`) — "Flip7" teal/gold/coral design system, no framework
- **Charts:** Chart.js via `svelte-chartjs`, registered globally in `src/lib/client/utils/chart.ts`
- **Export/Import:** CSV (`src/lib/shared/utils/csv.ts` + `src/lib/client/utils/csv.ts`), PDF (`jspdf` + `jspdf-autotable` in `src/lib/client/utils/pdf.ts`), Excel (`write-excel-file` export, `read-excel-file` import via `src/lib/shared/utils/fileImport.ts`)
- **Deployment:** Vercel adapter (`@sveltejs/adapter-vercel`)
- **PWA:** `@vite-pwa/sveltekit` with auto-update, NetworkFirst caching for API and page routes (disabled in dev). `PwaUpdate.svelte` handles update detection
- **Testing:** Vitest (`npm run test:unit`) + Playwright (`npm run test:e2e`, port 5188, `SEED_DEMO=1` seeds the demo account `demo`/`Demo@2026!`)
- **E2E auth suite:** `tests/e2e/auth.spec.ts` covers the Auth.js flow end-to-end — login page, valid/invalid/unknown/empty credentials, session creation + persistence (reload + cross-page), protected-route access/rejection (pages + `/api/transactions`), user identity propagation (username on `/settings`), and logout re-protection. Requires a `DATABASE_URL` (Postgres-only runtime) — run with the local-dev branch value exported, e.g. `DATABASE_URL="$LOCAL_DEV_DATABASE_URL" npm run test:e2e` after sourcing `.env`

## Architecture Rules (Architecture-5)

The codebase uses a strict three-layer library architecture under `src/lib/`:

```
src/lib/
├── client/
│   ├── components/
│   ├── stores/
│   └── utils/
├── server/
│   ├── db/
│   ├── services/
│   ├── auth/
│   └── utils/
├── shared/
│   └── utils/
```

### Dependency Direction (Enforced)

| Layer | May Depend On | Must NOT Import |
|-------|---------------|-----------------|
| **client** | `$lib/client/*`, `$lib/shared/*`, `$lib/types` | `$lib/server/*`, database modules, server auth, Node-only APIs |
| **server** | `$lib/server/*`, `$lib/shared/*`, `$lib/types` | `$lib/client/*`, browser APIs (`window`, `document`, `localStorage`, `sessionStorage`, `Blob`, browser `URL`), browser-only stores/utilities |
| **shared** | other `$lib/shared/*`, `$lib/types` | `$lib/client/*`, `$lib/server/*`, database modules, Drizzle, Neon, Auth.js server modules, bcrypt, Node-only APIs, browser-only APIs |

### Layer Responsibilities

**Client (`src/lib/client/`)**
- Browser/UI-only code: components, stores, browser utilities
- Components under `src/lib/client/components/` (77 components)
- Stores under `src/lib/client/stores/` (toast, preferences)
- Client utils under `src/lib/client/utils/` (format extensions, CSV download, PDF generation, Chart.js registration)

**Server (`src/lib/server/`)**
- Server-only code: database, services, auth helpers, server utilities
- Database layer: `src/lib/server/db/` (index, init, loadEnv, query, schema, drizzle)
- Services: `src/lib/server/services/` (categories, lendingImport, lendingPayments, networth, recordLendingTransaction, recurringScheduler, recurringService, transactionImport, transactions)
- Auth helpers: `src/lib/server/auth/` (index, password)
- Server utils: `src/lib/server/utils/` (loginValidation)

**Shared (`src/lib/shared/utils/`)**
- Pure/universal utilities that run on both client and server
- No browser or Node dependencies
- Current files: `categoryColors.ts`, `csv.ts`, `fileImport.ts`, `format.ts`, `importValidation.ts`, `lendingImport.ts`, `loginValidation.ts`, `recurring.ts`

### Intentional Utility Splits

**Format**
- `src/lib/shared/utils/format.ts` — pure formatting/date/amount functions
- `src/lib/client/utils/format.ts` — extends shared with preferences integration and `countUp` animation

**CSV**
- `src/lib/shared/utils/csv.ts` — pure CSV serialization (`csvEscape`, `transactionsToCSV`, `lendingsToCSV`)
- `src/lib/client/utils/csv.ts` — re-exports shared + adds browser `downloadCsv()`

**Login Validation**
- `src/lib/shared/utils/loginValidation.ts` — pure input validation (`validateLoginInput`)
- `src/lib/server/utils/loginValidation.ts` — credential verification using server auth (`verifyUserCredentials`)

These are **intentional architectural splits**, not duplicates.

## Route Structure

### Page Routes
- `/` — Server 302 → `/dashboard` in `hooks.server.ts` (client-side `+page.svelte` also redirects for SPA nav)
- `/login` — `+page.server.ts` load() redirects authed users away; `default` action validates via `validateLoginInput()` (fail 400) then authenticates through `authenticateCredentials()` (Auth.js, `src/auth.ts` — fail 401 on bad creds, sets the Auth.js session cookie), redirects to `/dashboard`
- `/logout` — GET handler, calls `signOutSession()` (Auth.js, `src/auth.ts`) to clear the Auth.js session cookie, redirects to `/login`
- `/dashboard` — Runs `processRecurringTransactions()` on load. `DashboardHero`, `SummaryCards`, `KpiRail`/`MobileSummaryRail`, 6-month `Sparkline` trends + `MonthlyTrendChart`, `CategoryDonutChart`/`CategoryBreakdownWidget`, `CashFlowChart`, `SafeToSpendWidget`, `RecentActivityWidget`, `ActiveIouList`, net-worth teaser (`NetWorthHero`), `ForecastBanner`, next-3 `upcomingRecurring`, delete modal. Loads monthly summary, lending + borrowed summaries, budget totals, YoY change %, `computeNetWorth()`
- `/transactions` — Paginated bank-register list (20/page), `TransactionFilters` + `SearchFilterPill`, `TransactionSummary`, running balance (computed from `allForBalance` across pages), `ViewToggle`, bulk delete action, CSV import via `ImportWizard` (`?/import`), export via `ExportDropdown`/`MoreMenu`. Recurring schedules can be created from an existing transaction
- `/transactions/new` — Add transaction form (`TransactionForm` component, centered card)
- `/transactions/[id]/edit` — Edit transaction (same `TransactionForm`, pre-filled)
- `/categories` — Category list (`ViewToggle` card/table), `CategoryForm` inline panel, `CategoryUsageBar`, spending/income for `selectedMonth` (`?month=YYYY-MM`), usage-aware delete (`txnCounts`, `recurringCounts`, `lastUsed`), actions: `budgetUpdate`, `create`, `update`, `delete` (FK conflict → 409)
- `/lending` — Lending tracker (`direction='lent'`), `LendingSummaryCards` + `LendingBalanceHeader`, active/paid tabs, `LendingFilters`, `LendingForm`, `PaymentHistoryPanel`, `RecordPaymentModal`/`EditPaymentModal`/`DeletePaymentConfirmModal`, CSV import. Actions: `create`, `update`, `recordPayment`, `updatePayment`, `deletePayment`, `delete`, `import`. Editing locks amount/direction/date once payments exist
- `/borrowed` — Mirror of `/lending` for `direction='borrowed'` (Debt Repayment ledger)
- `/recurring` — Paginated list (20/page) of `recurring_transactions`, filterable by type/frequency/status/category/search, `RecurringList` grid, `RecurringForm`, `activeCount`
- `/recurring/new` — Create recurring schedule (`RecurringForm`, pre-fills from a source transaction via `RecurringFormInitial`)
- `/recurring/[id]` — Edit recurring schedule (same form)
- `/reports` — Charts with tabs (Overview/Income/Expenses/Lending), year/month selectors (`MonthPicker`), `MonthlyChart` with linear regression trendline, `CategoryChart` donut + `ReportsDataTable` breakdowns, `ReportsHeader` insight cards, `YearOverYearCard` (MoM + YTD comparisons)
- `/net-worth` — `NetWorthHero`: `computeNetWorth()` = cash + lent − borrowed, cumulative cash-trend band, naive projection
- `/settings` — `SettingsSection` (Profile/Preferences/Data) + `SettingsForm` (theme, currency, date format) persisted to localStorage via the preferences store

### API Routes (RESTful, user-scoped, JSON)
- `/api/transactions` — GET (paginated, filterable), POST
- `/api/transactions/[id]` — GET, PUT, DELETE
- `/api/transactions/export` — GET (CSV)
- `/api/categories` — GET (with optional spending), POST
- `/api/categories/[id]` — GET, PUT, DELETE
- `/api/lendings` — GET (filterable by status/direction), POST
- `/api/lendings/[id]` — GET, PUT, DELETE
- `/api/lendings/[id]/payments` — GET (payment history), POST (record payment)
- `/api/recurring` — GET (list), POST
- `/api/recurring/[id]` — GET, PUT, DELETE
- `/api/search` — GET (`?q=&direction=`) — searches transactions (description/amount), lendings (borrower_name), categories (name); powers the global ⌘K `SearchModal`
- `/api/reports/monthly` — GET (`?year=`)
- `/api/reports/by-category` — GET (`?year=&month=`)
- `/api/reports/export` — GET (`?start=&end=`)

### Root Layout (`+layout.svelte`)
- `+layout.server.ts` exposes `user` from `locals` to all pages
- Renders `Sidebar` (two-zone nav + collapse + search + theme toggle + logout) on all authenticated pages (hidden on `/login` and `/`)
- Mobile (`≤480px`): `BottomNav` bottom navigation with a `SpeedDial` "Create" FAB trigger
- Global: `ToastContainer`, `PwaUpdate`, `OnboardingWalkthrough`, `SearchModal` (⌘K/⌃K shortcut), offline banner, favicon
- Imports `variables.css` globally (no separate app.css)

## Component Inventory (66 components, flat `src/lib/client/components/` directory)

### UI Shell & Navigation (12)
- `Sidebar.svelte` — Two-zone desktop sidebar (brand, primary/secondary nav, theme toggle, collapse, search, logout) with mobile off-canvas drawer; collapse 256↔72px
- `BottomNav.svelte` — Mobile bottom navigation bar (≤480px) with primary route links + "Create" speed-dial trigger, highlights active route
- `SpeedDial.svelte` — Mobile floating "Create" action dial with context-aware options (transaction/borrowed/lent/category)
- `PageHeader.svelte` — Sticky page header with title, optional subtitle/action/badge snippets, dashed teal bottom rule
- `PageBackground.svelte` — Fixed decorative background (teal wash, drifting glows, dotted game-board, film grain; dark: vignette + starfield). Pure CSS, no script
- `Button.svelte` — Reusable button (variants: primary, danger, ghost, link; sizes: sm, md), optional inline SVG icon
- `ModalDialog.svelte` — Reusable centered modal with backdrop, title, ESC-to-close, children snippet
- `SlideOver.svelte` — Right slide-over panel (bottom sheet on mobile) with drag-to-close, backdrop, ESC, children snippet
- `SearchModal.svelte` — Global ⌘K search modal, debounced fetch to `/api/search`, grouped results, keyboard nav
- `OnboardingWalkthrough.svelte` — 3-step welcome tour (Track Your Money / Set Budgets / Win at Finance), dismissal persisted via the preferences store
- `ToastContainer.svelte` — Fixed top toast stack from the toast store (success/error/info accents, auto-dismiss progress bar)
- `PwaUpdate.svelte` — Service worker update detection + reload toast

### Menus & Row Actions (5)
- `MoreMenu.svelte` — "More" pill button → dropdown (Import CSV / Export CSV / Export PDF)
- `OverflowMenu.svelte` — Three-dot overflow menu (select/import/export), click-outside + Escape close
- `RowActionsMenu.svelte` — Content-neutral per-record actions menu: desktop edge-aware popover vs mobile bottom sheet
- `RowHoverActions.svelte` — Shared row hover/focus quick-action cluster of 44px icon buttons with tooltips + edge clamping
- `ExportDropdown.svelte` — Dropdown menu for CSV/PDF export with format options

### Summaries & KPIs (14)
- `SummaryCards.svelte` — Dashboard summary grid of 4 animated cards (Income / Expenses / Balance hero / Savings donut) via countUp; mobile snap rail
- `SummaryCard.svelte` — Shared KPI tile: label, direction-colored signed value, icon, accent bar, optional trend chip
- `TransactionSummary.svelte` — Row of 3 SummaryCards (Income / Expenses / Net Balance) with trend % from the filtered list, clickable to filter
- `MobileSummaryRail.svelte` — Horizontally scrollable snap rail of summary KPI cards for mobile
- `KpiRail.svelte` — Horizontal rail of KPI metric tiles (income, expenses, savings)
- `DashboardHero.svelte` — Dashboard hero header with greeting, date, and balance overview
- `HeroBalanceWidget.svelte` — Prominent balance figure with trend indicator
- `NetWorthHero.svelte` — Animated net-worth figure with countUp, asset/liability "tipping bar", mover delta, optional composition podium
- `LendingSummaryCards.svelte` — Summary cards for lending: total lent, total recovered, outstanding
- `LendingBalanceHeader.svelte` — Header band for lending/borrowed page showing outstanding balance summary
- `SafeToSpendWidget.svelte` — "Available to Spend" card (income − budgeted − spent) with ok/warn/over usage meter
- `DateHeaderBand.svelte` — Date group header band in the transaction register (Today/Yesterday/long date, item count, day subtotal)
- `ActiveIouList.svelte` — List of outstanding IOU/lending records for the dashboard widget
- `YearOverYearCard.svelte` — Year-over-year comparison (current vs same-month-last-year income/expense/balance, YTD), no-data degradation

### Dashboard & Reports Widgets (6)
- `CategoryBreakdownWidget.svelte` — Dashboard widget breaking down spending by category with amounts, %, mini progress bars
- `RecentActivityWidget.svelte` — Dashboard "Recent Activity" feed with avatar circles, sign chips, relative dates
- `ForecastBanner.svelte` — Banner showing spending forecast / upcoming recurring obligations against budget
- `CountChip.svelte` — Small animated numeric count badge/chip with count-up transition
- `ReportsHeader.svelte` — Segmented timeframe pill and insight cards (spending up/down, saved more/less, top expense)
- `ReportsDataTable.svelte` — Monthly income/expense table with derived totals row, net trend arrows, over-budget highlight

### Charts (6)
- `Sparkline.svelte` — Compact Chart.js line sparkline, direction-colored, hidden axes, "No data" when empty
- `MonthlyTrendChart.svelte` — Line chart with gradient fills + custom tooltip, dark-mode-aware grid colors (dashboard)
- `MonthlyChart.svelte` — Bar/line chart of monthly income/expense with linear regression trendline (reports)
- `CategoryDonutChart.svelte` — Chart.js doughnut of category expense breakdown (dashboard)
- `CategoryChart.svelte` — Larger donut of category spending with legend/breakdown table (reports)
- `CashFlowChart.svelte` — Chart.js area/bar chart of cash flow over time

### Forms (11)
- `TransactionForm.svelte` — Create/edit transaction: type toggle, refund toggle, ₱ amount with ±500 steppers, description char count, date with Today button, category chip grid; `use:enhance`
- `CategoryForm.svelte` — Create/update category: type toggle, name, emoji icon grid, color swatch palette, live preview, optional ₱ budget limit with comma formatting
- `LendingForm.svelte` — Create/edit lending record (borrower, amount, lent/borrowed type, interest, dates, notes)
- `RecurringForm.svelte` — Create/update recurring schedule: type toggle, amount steppers, description, category chip grid, frequency/interval/day-of-week/date fields, next-5-runs preview, Active checkbox, dirty tracking
- `SettingsForm.svelte` — Settings rows for theme (light/dark/system), currency, date format — persisted via preferences store
- `SettingsSection.svelte` — Minimal settings grouping wrapper (uppercase heading + snippet body)
- `ImportDropZone.svelte` — Drag-and-drop file upload zone for CSV import
- `ImportMapping.svelte` — Import-wizard step mapping CSV columns to transaction fields
- `ImportPreview.svelte` — Preview table of parsed CSV rows before confirming import
- `ImportWizard.svelte` — Multi-step modal wizard orchestrating CSV import (upload → map → preview → import)
- `LendingImport.svelte` — CSV import specific to lending records (upload + mapping)

### Lists (4)
- `TransactionList.svelte` — Bank-register list: grouped-by-date or flat grid, running balance, day subtotals, category color circles, swipe-to-delete, inline edit panel, hover actions + kebab menu, selection mode, shimmer loading, empty state
- `CategoryList.svelte` — Category list with card/table views: icon, name, type, spending-vs-budget usage bar, edit/delete
- `RecurringList.svelte` — Grid table of recurring schedules: category stripe, status badges, frequency pills, quick actions, shimmer loading, mobile card layout
- `PaymentHistoryPanel.svelte` — Payment history for a lending/borrowed record: summary, progress bar, record-payment button, chronological rows with edit/delete

### Filters & Toolbar (8)
- `TransactionFilters.svelte` — Bubbly pill filters (date presets + custom range, category, type), popovers, clear-all, shared FilterFooter
- `LendingFilters.svelte` — Filter controls (status active/paid, search) for the lending/borrowed list
- `FiltersSheet.svelte` — Mobile bottom-sheet wrapper hosting filter controls
- `SearchFilterPill.svelte` — Unified rounded pill merging search + Filter trigger with active-filter count badge; desktop popover vs mobile sheet
- `FilterFooter.svelte` — Shared Apply/Reset footer bar inside filter popovers/sheets
- `ListToolbar.svelte` — Toolbar for list pages: search, filter pill, view toggle, export actions
- `ViewToggle.svelte` — Segmented radiogroup toggle between view modes (card/table), optional sliding thumb, counts
- `MonthPicker.svelte` — Prev/next arrows + select of the last 12 months for report month picking

### Feedback & Payment Modals (6)
- `CategoryUsageBar.svelte` — Budget usage progress bar (teal "ok" / amber "warn" / coral "over", boom-pulse on over)
- `EmptyState.svelte` — Reusable empty state with icon, title, subtitle, optional action CTA
- `ConfettiBurst.svelte` — Confetti particle burst on celebration moments (e.g. mark-paid success)
- `RecordPaymentModal.svelte` — Record a payment or write-off with live remaining preview + optional transaction creation
- `EditPaymentModal.svelte` — Edit an existing payment (amount, date, notes)
- `DeletePaymentConfirmModal.svelte` — Confirmation modal for deleting a payment record

## Database (`src/lib/server/db/`)
- **`index.ts`** — Lazy-init gate. Reads `DATABASE_URL` (or `POSTGRES_URL`) from env. Throws if missing — **no SQLite fallback**. Creates Neon pool via `@neondatabase/serverless`. Registers `pg.types.setTypeParser(1700, parseFloat)` so Postgres `NUMERIC` columns return JS numbers. Exposes `getPgPool()` and runs `initDb()` once.
- **`loadEnv.ts`** — Dev-only, imported first by `index.ts`. SvelteKit dev doesn't load `.env` into `process.env`, so in development it wires `LOCAL_DEV_DATABASE_URL` → `process.env.DATABASE_URL` → `npm run dev` uses the local-dev Neon branch. Inert in production, when `SEED_DEMO=1`, and when `DATABASE_URL` is already exported in the shell.
- **`query.ts`** — Four cross-DB functions: `queryOne<T>()`, `queryMany<T>()`, `execute()`, `withTransaction()`. All SQL written in **native Postgres dialect** — no translation layer.
- **`init.ts`** — Schema: **6 tables** with Postgres DDL + indexes:
  - `users` (id, username, password_hash, created_at)
  - `categories` (id, user_id, name, color, icon, `type` income/expense, `budget_limit`, UNIQUE(user_id, name))
  - `transactions` (id, user_id, amount, description, date, category_id FK RESTRICT, type, created_at, updated_at)
  - `lendings` (id, user_id, borrower_name, amount, interest_rate, date_lent, due_date, `direction` lent/borrowed, status active/paid, notes, created_at, updated_at)
  - `recurring_transactions` (id, user_id, type, amount, description, category_id FK RESTRICT, frequency daily/weekly/monthly/yearly, interval, day_of_week, day_of_month, month_of_year, start_date, end_date, `next_run`, `last_generated_at`, active)
  - `lending_payments` (id, lending_id FK CASCADE, user_id, amount, payment_date, notes, `transaction_id` FK SET NULL, `payment_type` payment/write_off, reference, created_at, updated_at)
  - Indexes on user_id, date DESC, category_id, type, status, next_run, active, lending_id, payment_date
  - Seed data: 2 default users + 11 categories
- **`drizzle.ts`** — Drizzle client for Neon/Postgres. Reuses the existing lazy-initialized Neon pool from `getPgPool()`. Cached as a promise for serverless reuse.
- **`schema.ts`** — Drizzle schema definitions mirroring the 6 tables
- **Migrations** — At repo root `drizzle/meta/` (`0000_snapshot.json`, `0001_snapshot.json`, `_journal.json`)

## Server Patterns

### Auth (`src/hooks.server.ts`)
- Composes `sequence(authHandle, authGuardHandle)` — `authHandle` from `src/auth.ts` (exposes lazy `event.locals.auth()`); `authGuardHandle` enforces route protection
- Root `/` → 302 `/dashboard`
- Public paths: only `/login`
- All other routes: `await event.locals.auth()` → map `session.user` → `event.locals.user = { userId, username }` or 302 `/login`

### Auth.js (`src/auth.ts`) — COMPLETE (Auth-1→4)
- `@auth/sveltekit`; `src/auth.ts` exports `SvelteKitAuth(authConfig)` → `{ handle, signIn, signOut }` plus in-process helpers `authenticateCredentials(event, username, password)` and `signOutSession(event)`. The `handle` runs first in hooks (`sequence`) and exposes lazy `event.locals.auth()`.
- **Single Credentials `authorize()` (Auth-2):** authenticates against the EXISTING `users` table via `queryOne` (same query as the former login action) + `verifyUserCredentials()` (bcrypt) — reuses existing `$2b$10$` hashes, no re-hash. Returns `null` for unknown user / bad password (generic `CredentialsSignin`, no enumeration). No duplicate lookup/bcrypt anywhere on the auth path.
- **Identity mapping:** `callbacks.jwt` copies `{ userId, username }` from the provider-returned user into the Auth.js token; `callbacks.session` surfaces them on `session.user`. `src/auth.ts` contains a `declare module '@auth/core/types'` augmentation widening `Session.user` to `{ userId: number; username: string }`. Session strategy locked to **JWT** — no adapter, no DB session/account/verificationToken tables, `users` table untouched.
- **Session resolution (Auth-3):** `hooks.server.ts` composes `sequence(authHandle, authGuardHandle)`. Protected routes resolve auth via `await event.locals.auth()` and map `session.user` → `event.locals.user = { userId, username }`. Unauthenticated → 302 `/login`. Root `/` → 302 `/dashboard`; public paths: only `/login`.
- **Login/logout (Auth-4):** the SvelteKit `/login` form action and `/logout` GET route call `authenticateCredentials`/`signOutSession`, which invoke the SAME Auth.js core (`Auth(request, { ...config, raw })` against `/auth/callback/credentials` and `/auth/signout`) and apply the resulting cookies. Flow: `/login` UI → form action → Auth.js Credentials sign-in → Auth.js JWT session cookie → hooks `event.locals.auth()` → `event.locals.user` → `/dashboard`. Failed login returns fail(401) and stays on `/login`; logout clears `authjs.session-token` → `/login`.
- **Legacy JWT retired (Auth-5):** `createToken`/`verifyToken`/`jsonwebtoken`/`JWT_SECRET` and the hooks startup guard are removed entirely — Auth.js (`AUTH_SECRET`) is the sole session mechanism. Password hashing moved to `src/lib/server/auth/password.ts`.
- CSRF: `@auth/sveltekit` auto-sets `skipCSRFCheck` (SvelteKit's Origin-based form CSRF replaces Auth.js's token), so `/auth/csrf` returns **404** by design and Auth.js form POSTs need a matching `Origin` header.
- Env: `AUTH_SECRET` (min 32 chars; read automatically by Auth.js from `$env/dynamic/private`). Dev wiring in `loadEnv.ts` forwards it from `.env`; `.env.example` has a placeholder; set it in Vercel project settings.

### Server Data Modules (`src/lib/server/services/`)
- `transactions.ts` — `listTransactions`, `getTransaction`, `createTransaction`, `updateTransaction`, `deleteTransaction`, `getMonthlySummary`, `getRecentTransactions`, `getCategoryReport`, `getMonthlyTrends`, `getAllForBalance`, `getTotalBudgeted`
- `categories.ts` — `listCategories`, `createCategory`, `updateCategory`, `deleteCategory`, `getCategory`, `getTotalBudgeted`
- `lendingPayments.ts` — Settlement ledger (source of truth for loan/debt resolution): `getLendingsWithPayments`, `getLendingWithPayments`, `recordPayment` (transactional, validates remaining), `updatePayment`, `deletePayment`, `getPaymentHistory`, `hasPayments`, `recalcStatusCache`, `getLendingTotals`, `deleteLinkedTransactions`. Canonical derived state: `cash_paid + written_off = resolved_total`, `remaining = amount − resolved_total`, status = `remaining > 0 ? 'active' : 'paid'`. Only `recalcStatusCache()` writes `lendings.status`
- `recurringService.ts` — `createRecurringTransaction`, `updateRecurringTransaction` (+ validation, category ownership). `next_run` recalculated ONLY when scheduling fields change
- `recurringScheduler.ts` — `processRecurringTransactions` (runs on dashboard load, creates due transactions, rolls `next_run`, auto-deactivates past `end_date`), `runRecurringNow`, `toggleRecurringStatus`, `duplicateRecurringTransaction`
- `networth.ts` — `computeNetWorth()`: cash (all-time Σ income − expense) + active lent − active borrowed; cumulative cash-trend band; naive 3-month-slope projection
- `recordLendingTransaction.ts` — Records a transaction on lending create/repayment events; category lookup fallback chain ("Loan Repayment" → legacy "Lending Recovery" / "Debt Repayment")
- `lendingImport.ts` — `importLendingsForUser(userId, file, configJson, direction)` for CSV/Excel lending imports
- `transactionImport.ts` — Transaction CSV/Excel import logic for server-side validation

### Server Data Patterns
- Page server files use `load({ locals })` — authenticate via `locals.user!.userId`
- Form actions return `{ success: true }` or `fail(status, { error })` with named actions (`?/create`, `?/update`, `?/delete`, `?/recordPayment`, `?/updatePayment`, `?/deletePayment`, `?/budgetUpdate`, `?/import`)
- Database queries: `queryOne<T>(sql, params)`, `queryMany<T>(sql, params)`, `execute(sql, params)`, `withTransaction(async (tx) => ...)` — all imported from `$lib/server/db/query`
- Complex multi-row mutations (payments, recurring) go through `src/lib/server/services/*` modules; use `withTransaction` for atomicity (e.g. recordPayment inserts payment + linked transaction + status in one tx)
- All transaction/recurring queries `LEFT JOIN categories` for category name/color
- Form actions pattern: `use:enhance` with callback that calls `await update()` to reload page data after mutation, then shows toast
- Recurring processing is triggered lazily on `/dashboard` load (no cron); process is idempotent per `next_run`

## State Management
- Two stores (`src/lib/client/stores/`), both Svelte 5 runes-based:
  - `toast.svelte.ts` — Exports `showSuccess()`, `showError()`, `showInfo()`, `dismissToast()`, `toastState`. Auto-dismiss after 4 seconds
  - `preferences.svelte.ts` — `prefs` state (`{ theme: 'light'|'dark'|'system', currency, dateFormat, onboardingDismissed }`) + `updatePrefs()`, `isOnboardingDismissed()`, `dismissOnboarding()`. localStorage-backed, owns the `data-theme` attribute via `applyTheme()`, `themeState.isDark` kept current by a MutationObserver

## Type System (`src/lib/types.ts`)
- `TransactionType`, `Transaction`, `TransactionFormData`, `Category`, `CategoryFormData`, `MonthlyReportItem`, `CategoryReportItem`, `DashboardSummary`, `PaginatedResult<T>`, `User`, `Lending`, `PaymentType` ('payment' | 'write_off'), `LendingPayment`, `LendingWithPayments` (derived cash_paid/written_off/remaining/derived_status), `RecurringFrequency` ('daily'|'weekly'|'monthly'|'yearly'), `RecurringTransaction`, `RecurringTransactionFormData`, `RecurringFormInitial`, `NetWorthLeg`, `CashTrendPoint`, `LegDelta`, `NetWorthSnapshot`
- `App.PageData` (`src/app.d.ts`): Union of all page data shapes across all routes (`summary`, `recentTransactions`, `transactions`, `allForBalance`, `recurring`, `upcomingRecurring`, `activeLendings`/`paidLendings`/`totals`, `spending`/`income`, `txnCounts`/`recurringCounts`/`lastUsed`, `netWorth`, `yoyData`, `monthlyData`, `categoryLabels`/`categoryData`/`categoryColors`, `trendLabels`/`trendIncome`/`trendExpenses`, etc.)

## Client Utilities (`src/lib/client/utils/`)
- **`format.ts`** — Extends shared format with preferences integration: `formatCurrency`, `formatSignedCurrency`, `formatPlainAmount`, `formatDate`, `formatDateShort`, `getCurrentMonth`, `getToday`, `validateAmount`, `formatWithCommas`, `handleAmountInput`, `handleAmountFocus`, `handleAmountBlur`, `formatEditAmount`, `countUp`
- **`csv.ts`** — Re-exports shared CSV + `downloadCsv()` for browser download
- **`pdf.ts`** — `generateTransactionPdf`, `generateReportPdf`, `generateLendingPdf`, `generateBorrowedPdf` (jspdf + autotable)
- **`chart.ts`** — Registers all Chart.js components globally (`Chart.register(...registerables)`)

## Shared Utilities (`src/lib/shared/utils/`)
- **`format.ts`** — `formatCurrency`, `formatSignedCurrency`, `formatPlainAmount`, `formatDate`, `formatDateShort`, `parseDate`, `formatDateInput` (YYYY-MM-DD), `getCurrentMonth`, `getToday`, `getMonthLabel`, `validateAmount`, `formatWithCommas`, `dateToString`, `parseDate`
- **`csv.ts`** — `csvEscape`, `transactionsToCSV`, `lendingsToCSV` (pure serialization)
- **`fileImport.ts`** — `parseImportFile(file)` → `{ headers, rows }` (CSV + Excel via read-excel-file/universal)
- **`importValidation.ts`** — `normName`, `normCategoryName`, `parseDateFlexible`, `parseAmountFlexible`, `deriveType` (sign/column/debit_credit), `validateMappedRow`, `validateAllRows`, `buildMappedRows`, `generateTransactionHash`, `detectDuplicates`, `parseCSV`, `DEFAULT_IMPORT_FIELDS`, `autoMap`, types: `ImportFieldDef`, `ImportPreviewColumn`, `ImportValidationResult`, `MappedTransaction`
- **`lendingImport.ts`** — `LENDING_IMPORT_FIELDS`, `parseRate`, `normalizeStatus`, `buildMappedLendingRows`, `validateMappedLendingRow`, `validateAllLendingRows`, `generateLendingHash`, `detectLendingDuplicates`, types: `MappedLendingRow`
- **`loginValidation.ts`** — `validateLoginInput` (pure input validation)
- **`recurring.ts`** — `calculateNextRun`, `generatePreview` (next 5 dates), `RecurringFrequency` type
- **`categoryColors.ts`** — `CATEGORY_HUES`, `lightenHex`, `getCategoryHue`, `getCategoryTint`, `getCategoryText`

## Server Utilities
- **`src/lib/server/auth/password.ts`** — `hashPassword`, `verifyPassword` (bcryptjs)
- **`src/lib/server/auth/index.ts`** — Exports password helpers
- **`src/lib/server/utils/loginValidation.ts`** — `verifyUserCredentials` (credential verification using server auth)

## Pattern Rules
- Use **Svelte 5 runes** (`$state`, `$derived`, `$props`, `$effect`, `$effect.pre`) — NOT Svelte 4 `export let` or `$:`
- Use **SvelteKit form actions** with `use:enhance` (enhance-fiscal callback pattern returning `async ({ result, update })`) for data mutations
- Complex business logic lives in **`src/lib/server/services/*` modules** (shared by API handlers and form actions), using `withTransaction` for atomic multi-row writes
- All CSS uses **CSS custom properties** from `variables.css` — no hardcoded colors
- **No Tailwind/Bootstrap** — hand-written CSS only in scoped `<style>` blocks
- Use **`as App.PageData`** type assertion for `$page.data` (current pattern from `app.d.ts`)
- Hardcoded `rgba(255,255,255)` and `backdrop-filter` break dark mode — use `var(--color-surface)` instead
- Prefer **inline improvements** over extracting new components (previous extraction attempts were rejected)
- **Plan first, code second:** Write strategy in `plans/<short-description>.md` and present for proof before coding

## To Run
```bash
npm run dev        # dev server
npm run check      # svelte-check + typecheck
npm run lint       # eslint
npm run test:unit  # vitest
npm run test:e2e   # playwright (requires DATABASE_URL)
```

## Styling Conventions
- Cards: `background: var(--color-surface)`, `border: 1px solid var(--color-border)`, `border-radius: var(--radius-xl)`, `box-shadow: var(--shadow-sm)`; dark mode: `flip7-card` pattern (24px radius, glowing left accent); hover → `transform: translateY(-2px)` + `box-shadow` intensifies
- Forms: inputs `padding: var(--space-sm) var(--space-md)`, `border: 1px solid var(--color-border)`, `border-radius: var(--radius-sm)`; focus: `border-color: var(--color-teal)` + `box-shadow: 0 0 0 4px var(--focus)`; error: `border-color: var(--color-expense)`
- Buttons: min-height 44px, font-weight 600, `transition: all var(--transition-fast)`, `border-radius: var(--radius-md)`
- Status semantics: teal = ok/income-positive, gold = primary/warning, coral = danger/expense-negative, amber = warning
- Responsive breakpoints: 1024px (charts 2-col), 768px (sidebar hidden, mobile layout), 640px (table hides description column), 480px (table→cards, bottom nav, SpeedDial)
- SVG icons: inline in templates, not icon library or sprite file
- Global reset in layout: `:global(*) { margin: 0; revert: 0; box-sizing: border-box; }`

## Design Tokens (`src/styles/variables.css`)
### "Flip7" Palette (Light "Arcade Day" / Dark "Night Arcade")
- Brand: `--color-teal` (#2BA8A2, light #3CC4BD / dark #1E8C86), `--color-gold` (#FFD23F), `--color-coral` (#EF6C4A), `--color-amber`, `--color-sky`
- **`--color-primary` = gold** (`--color-gold`); `--color-primary-light` = teal-bg
- Semantic: `--color-income` = positive (#27AE60), `--color-expense` = negative (#E74C3C), `--color-warning` = gold, `--color-danger` = coral
- Surfaces: `--color-bg` (#EFF8F7 / #0B110F), `--color-surface` (#FFF / #161A18), `--color-surface-inset`, `--color-cream`, `--color-ink` (#14302E), `--color-text-muted`, `--color-border` / `--color-hairline`
- Hero-scoped tokens (`--hero-*`): white instrument in light, glowing teal gradient panel in dark
- Signature glows: `--glow-card`, `--glow-gold`, `--glow-coral`, `--glow-sky`, `--glow-soft`, `--focus`

### Spacing: `--space-xs`(4px), `--space-sm`(8px), `--space-md`(12px), `--space-lg`(16px), `--space-xl`(24px), `--space-2xl`(32px), `--space-3xl`(48px), `--space-4xl`(64px)

### Radii (bubbly): `--radius-sm`(4px), `--radius-md`(8px), `--radius-lg`(12px), `--radius-xl`(16px), `--radius-2xl`(24px), `--radius-pill`(999px), `--radius-full`(9999px)

### Shadows: `--shadow-sm` (glow-soft), `--shadow-md` (glow-card), `--shadow-lg`; dark mode intensifies glow alphas

### Typography: `--font-display` ('Fredoka', 'Nunito'), `--font-body` ('Nunito Sans'), `--font-mono` ('JetBrains Mono'); weights 400–800; `--font-size-{xs..4xl}`; letter-spacing + line-height tokens

### Layout: `--sidebar-width` (256px / collapsed 72px), `--z-{sidebar:90, modal:1000, toast:9999}`, safe-area tokens, `--touch-target-min` (44px)

### Motion: `--transition-{fast 150ms, normal 250ms, slow 400ms}` cubic-bezier, `--ease`, `--bounce`; keyframes (`fade-in-up`, `scale-in`, `bounce-in`, `glow-pulse`, `boom-pulse`, `crown-bounce`, `shimmer`, `skeleton-pulse`, `confetti-fall`); view-transition cross-fade

### Dark Mode
- Selector: `[data-theme="dark"]` — set on `<html>` by `preferences.svelte.ts` `applyTheme()` (system mode follows `prefers-color-scheme`). Light `-light`/`-bg` tokens become low-alpha rgba in dark
- Dark surfaces are deep green-teal near-black; `flip7-card` gets 24px radius + glowing left-edge accent (teal/gold/coral/sky)
- Utility classes: `.skeleton`, `.fade-in-up`, `.scale-in`, `.flip7-card` (+ `.accent-{teal,gold,coral,sky}`), `.flip7-watermark`

### Accessibility
- `prefers-reduced-motion: reduce` → all transitions/animations zeroed out (including `.flip7-card` hover lift)
- All interactive elements: min-height ≥44px (`--touch-target-min`, WCAG 2.5.5)

## Tests
- **Unit:** `tests/unit-test/` — 17 test files including moved utilities:
  - `fileImport.test.ts`, `importValidation.test.ts`, `lendingImport.test.ts` (moved from `src/lib/shared/utils/` in Architecture-5)
  - Other service/component tests
- **E2E:** `tests/e2e/` — Playwright tests (requires `DATABASE_URL` for Postgres)

## Verification Status (latest run)
```bash
npm run check      # PASS (0 errors, 97 pre-existing CSS warnings)
npm run lint       # PASS (0 errors)
npm run test:unit  # PASS (157 passed, 1 skipped)
npm run build      # PASS (built in ~5s, PWA generated)
npm run test:e2e   # Requires DATABASE_URL — not run in this audit
```

---

*This document reflects the Architecture-5 repository structure with PostgreSQL-only database runtime. Legacy paths (`src/lib/database/`, `src/lib/components/`, `src/lib/stores/`, `src/lib/utils/`) have been removed/migrated.*
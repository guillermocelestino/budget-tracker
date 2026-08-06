# Budget Tracker — CLAUDE.md

## Architecture
- **Framework:** SvelteKit with Svelte 5 runes (`$state`, `$derived`, `$props`, `$effect`) — no Svelte 4 `export let` / `$:` anywhere
- **Database:** Dual SQLite (dev) / PostgreSQL (production via Neon serverless) — auto-detected via `POSTGRES_URL` env var. All SQL written in Postgres dialect; `translatePgToSQLite()` converts for SQLite
- **Auth:** JWT-based (`jsonwebtoken` + `bcryptjs`), session cookie named `session`, 7-day expiry, httpOnly, sameSite=lax, `secure` in production. Login validated via `src/lib/utils/loginValidation.ts`
- **CSS:** Hand-written with custom properties (`src/styles/variables.css`) — "Flip7" teal/gold/coral design system, no framework
- **Charts:** Chart.js via `svelte-chartjs`, registered globally in `src/lib/utils/chart.ts`
- **Export/Import:** CSV (`src/lib/utils/csv.ts`), PDF (`jspdf` + `jspdf-autotable` in `src/lib/utils/pdf.ts`), Excel (`write-excel-file` export, `read-excel-file` import)
- **Deployment:** Vercel adapter (`@sveltejs/adapter-vercel`)
- **PWA:** `@vite-pwa/sveltekit` with auto-update, NetworkFirst caching for API and page routes (disabled in dev). `PwaUpdate.svelte` handles update detection
- **Testing:** Vitest (`npm run test:unit`) + Playwright (`npm run test:e2e`)

## Route Structure
### Page Routes
- `/` — Server 302 → `/dashboard` in `hooks.server.ts` (client-side `+page.svelte` also redirects for SPA nav)
- `/login` — `+page.server.ts` redirects authed users away; `default` action validates via `validateLoginInput()`/`verifyUserCredentials()`, sets `session` cookie, redirects to `/dashboard`
- `/logout` — GET handler, deletes `session` cookie, redirects to `/login`
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

### Root Layout (+layout.svelte)
- `+layout.server.ts` exposes `user` from `locals` to all pages
- Renders `Sidebar` (two-zone nav + collapse + search + theme toggle + logout) on all authenticated pages (hidden on `/login` and `/`)
- Mobile (`≤480px`): `BottomNav` bottom navigation with a `SpeedDial` "Create" FAB trigger
- Global: `ToastContainer`, `PwaUpdate`, `OnboardingWalkthrough`, `SearchModal` (⌘K/⌃K shortcut), offline banner, favicon
- Imports `variables.css` globally (no separate app.css)

## Component Inventory (72 components, flat `src/lib/components/` directory)
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

## Database (`src/lib/database/`)
- **`index.ts`** — Lazy-init gate. Detects `POSTGRES_URL` → `usePostgres` boolean. Exposes `getPgPool()` and `getSQLiteDb()`, both auto-run `initDb()` once. SQLite DB at `data/budget.db` (WAL mode, foreign keys on)
- **`query.ts`** — Four cross-DB functions: `queryOne<T>()`, `queryMany<T>()`, `execute()`, `withTransaction()`. All SQL written in **Postgres dialect**; `translatePgToSQLite()` auto-converts `$1→?`, `::type` removal, `TO_CHAR→strftime`, `EXTRACT→strftime`, `NOW→datetime`, `CURRENT_DATE→date`
- **`init.ts`** — Schema: **6 tables** with equivalent Postgres/SQLite DDL + indexes:
  - `users` (id, username, password_hash, created_at)
  - `categories` (id, user_id, name, color, icon, `type` income/expense, `budget_limit`, UNIQUE(user_id, name))
  - `transactions` (id, user_id, amount, description, date, category_id FK RESTRICT, type, created_at, updated_at)
  - `lendings` (id, user_id, borrower_name, amount, interest_rate, date_lent, due_date, `direction` lent/borrowed, status active/paid, notes, created_at, updated_at)
  - `recurring_transactions` (id, user_id, type, amount, description, category_id FK RESTRICT, frequency daily/weekly/monthly/yearly, interval, day_of_week, day_of_month, month_of_year, start_date, end_date, `next_run`, `last_generated_at`, active)
  - `lending_payments` (id, lending_id FK CASCADE, user_id, amount, payment_date, notes, `transaction_id` FK SET NULL, `payment_type` payment/write_off, reference, created_at, updated_at)
  - Indexes on user_id, date DESC, category_id, type, status, next_run, active, lending_id, payment_date
  - Seed data: 2 default users + 11 categories
- **`migrations/001_add_type_to_categories.ts`** — Adds type column to categories, checks PRAGMA before running

## Server Patterns
### Auth (`src/hooks.server.ts`)
- Root `/` → 302 `/dashboard`
- Public paths: only `/login`
- All other routes: read `session` cookie → `verifyToken()` → set `event.locals.user = { userId, username }` or 302 `/login`
- Startup guard: throws if `POSTGRES_URL` set but `JWT_SECRET` missing

### Auth (`src/lib/auth.ts`)
- JWT secret: `process.env.JWT_SECRET` or dev fallback `'budget-tracker-dev-secret-change-in-production'` (throws if Postgres active and secret missing)
- `createToken(userId, username)` → 7-day JWT
- `verifyToken(token)` → `{ userId, username }` or null
- `hashPassword(pw)` / `verifyPassword(pw, hash)` via bcryptjs
- Login logic split out to `src/lib/utils/loginValidation.ts` (`validateLoginInput`, `verifyUserCredentials`)

### Server Data Modules (`src/lib/server/`)
- `lendingPayments.ts` — Settlement ledger (source of truth for loan/debt resolution): `getLendingsWithPayments`, `getLendingWithPayments`, `recordPayment` (transactional, validates remaining), `updatePayment`, `deletePayment`, `getPaymentHistory`, `hasPayments`, `recalcStatusCache`, `getLendingTotals`, `deleteLinkedTransactions`. Canonical derived state: `cash_paid + written_off = resolved_total`, `remaining = amount − resolved_total`, status = `remaining > 0 ? 'active' : 'paid'`. Only `recalcStatusCache()` writes `lendings.status`
- `recurringService.ts` — `createRecurringTransaction`, `updateRecurringTransaction` (+ validation, category ownership). `next_run` recalculated ONLY when scheduling fields change
- `recurringScheduler.ts` — `processRecurringTransactions` (runs on dashboard load, creates due transactions, rolls `next_run`, auto-deactivates past `end_date`), `runRecurringNow`, `toggleRecurringStatus`, `duplicateRecurringTransaction`
- `networth.ts` — `computeNetWorth()`: cash (all-time Σ income − expense) + active lent − active borrowed; cumulative cash-trend band; naive 3-month-slope projection
- `recordLendingTransaction.ts` — Records a transaction on lending create/repayment events; category lookup fallback chain ("Loan Repayment" → legacy "Lending Recovery" / "Debt Repayment")
- `lendingImport.ts` — `importLendingsForUser(userId, file, configJson, direction)` for CSV/Excel lending imports

### Server Data Patterns
- Page server files use `load({ locals })` — authenticate via `locals.user!.userId`
- Form actions return `{ success: true }` or `fail(status, { error })` with named actions (`?/create`, `?/update`, `?/delete`, `?/recordPayment`, `?/updatePayment`, `?/deletePayment`, `?/budgetUpdate`, `?/import`)
- Database queries: `queryOne<T>(sql, params)`, `queryMany<T>(sql, params)`, `execute(sql, params)`, `withTransaction(async (tx) => ...)` — all imported from `$lib/database/query`
- Complex multi-row mutations (payments, recurring) go through `src/lib/server/*` modules; use `withTransaction` for atomicity (e.g. recordPayment inserts payment + linked transaction + status in one tx)
- All transaction/recurring queries `LEFT JOIN categories` for category name/color
- Form actions pattern: `use:enhance` with callback that calls `await update()` to reload page data after mutation, then shows toast
- Recurring processing is triggered lazily on `/dashboard` load (no cron); process is idempotent per `next_run`

### State Management
- Two stores (`src/lib/stores/`), both Svelte 5 runes-based:
  - `toast.svelte.ts` — Exports `showSuccess()`, `showError()`, `showInfo()`, `dismissToast()`, `toastState`. Auto-dismiss after 4 seconds
  - `preferences.svelte.ts` — `prefs` state (`{ theme: 'light'|'dark'|'system', currency, dateFormat, onboardingDismissed }`) + `updatePrefs()`, `isOnboardingDismissed()`, `dismissOnboarding()`. localStorage-backed, owns the `data-theme` attribute via `applyTheme()`, `themeState.isDark` kept current by a MutationObserver

## Type System (`src/lib/types.ts`)
- `TransactionType`, `Transaction`, `TransactionFormData`, `Category`, `CategoryFormData`, `MonthlyReportItem`, `CategoryReportItem`, `DashboardSummary`, `PaginatedResult<T>`, `User`, `Lending`, `PaymentType` ('payment' | 'write_off'), `LendingPayment`, `LendingWithPayments` (derived cash_paid/written_off/remaining/derived_status), `RecurringFrequency` ('daily'|'weekly'|'monthly'|'yearly'), `RecurringTransaction`, `RecurringTransactionFormData`, `RecurringFormInitial`, `NetWorthLeg`, `CashTrendPoint`, `LegDelta`, `NetWorthSnapshot`
- `App.PageData` (`src/app.d.ts`): Union of all page data shapes across all routes (`summary`, `recentTransactions`, `transactions`, `allForBalance`, `recurring`, `upcomingRecurring`, `activeLendings`/`paidLendings`/`totals`, `spending`/`income`, `txnCounts`/`recurringCounts`/`lastUsed`, `netWorth`, `yoyData`, `monthlyData`, `categoryLabels`/`categoryData`/`categoryColors`, `trendLabels`/`trendIncome`/`trendExpenses`, etc.)

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

## Format Utilities (`src/lib/utils/`)
- **`format.ts`** — `formatCurrency` (₱ en-PH), `formatSignedCurrency`, `formatPlainAmount`, `formatDate` ("Jul 15, 2026"), `formatDateShort`, `parseDate`, `formatDateInput` (YYYY-MM-DD), `getCurrentMonth`, `getToday`, `getMonthLabel`, `validateAmount`, `formatWithCommas`, `handleAmountInput`, `handleAmountFocus`, `handleAmountBlur`, `formatEditAmount`, `countUp`
- **`csv.ts`** — `csvEscape`, `transactionsToCSV`, `lendingsToCSV`, `downloadCsv`
- **`pdf.ts`** — `generateTransactionPdf`, `generateReportPdf`, `generateLendingPdf`, `generateBorrowedPdf` (jspdf + autotable)
- **`fileImport.ts`** — `parseImportFile(file)` → `{ headers, rows }` (CSV + Excel via read-excel-file)
- **`importValidation.ts`** — `normName`, `normCategoryName`, `parseDateFlexible`, `parseAmountFlexible`, `deriveType` (sign/column/debit_credit), `validateMappedRow`, `validateAllRows`, `buildMappedRows`, `generateTransactionHash`, `detectDuplicates`, `parseCSV`, `DEFAULT_IMPORT_FIELDS`, `autoMap`
- **`lendingImport.ts`** — `LENDING_IMPORT_FIELDS`, `parseRate`, `normalizeStatus`, `buildMappedLendingRows`, `validateMappedLendingRow`, `validateAllLendingRows`, `generateLendingHash`, `detectLendingDuplicates`
- **`recurring.ts`** — `calculateNextRun(currentRun, frequency, interval, dayOfWeek, dayOfMonth, monthOfYear, startDate)`, `generatePreview` (next 5 dates)
- **`categoryColors.ts`** — `CATEGORY_HUES`, `lightenHex`, `getCategoryHue`, `getCategoryTint`, `getCategoryText`
- **`loginValidation.ts`** — `validateLoginInput`, `verifyUserCredentials`

## Chart Utilities (`src/lib/utils/chart.ts`)
- Registers all Chart.js components globally (`Chart.register(...registerables)`)

## Pattern Rules
- Use **Svelte 5 runes** (`$state`, `$derived`, `$props`, `$effect`, `$effect.pre`) — NOT Svelte 4 `export let` or `$:`
- Use **SvelteKit form actions** with `use:enhance` (enhance-fiscal callback pattern returning `async ({ result, update })`) for data mutations
- Complex business logic lives in **`src/lib/server/*` modules** (shared by API handlers and form actions), using `withTransaction` for atomic multi-row writes
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
npm run test:e2e   # playwright
```

## Styling Conventions
- Cards: `background: var(--color-surface)`, `border: 1px solid var(--color-border)`, `border-radius: var(--radius-xl)`, `box-shadow: var(--shadow-sm)`; dark mode: `flip7-card` pattern (24px radius, glowing left accent); hover → `transform: translateY(-2px)` + `box-shadow` intensifies
- Forms: inputs `padding: var(--space-sm) var(--space-md)`, `border: 1px solid var(--color-border)`, `border-radius: var(--radius-sm)`; focus: `border-color: var(--color-teal)` + `box-shadow: 0 0 0 4px var(--focus)`; error: `border-color: var(--color-expense)`
- Buttons: min-height 44px, font-weight 600, `transition: all var(--transition-fast)`, `border-radius: var(--radius-md)`
- Status semantics: teal = ok/income-positive, gold = primary/warning, coral = danger/expense-negative, amber = warning
- Responsive breakpoints: 1024px (charts 2-col), 768px (sidebar hidden, mobile layout), 640px (table hides description column), 480px (table→cards, bottom nav, SpeedDial)
- SVG icons: inline in templates, not icon library or sprite file
- Global reset in layout: `:global(*) { margin: 0; revert: 0; box-sizing: border-box; }`

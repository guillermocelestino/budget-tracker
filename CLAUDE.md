# Budget Tracker — CLAUDE.md

## Architecture
- **Framework:** SvelteKit with Svelte 5 runes (`$state`, `$derived`, `$props`, `$effect`)
- **Database:** Dual SQLite (dev) / PostgreSQL (production via Neon) — auto-detected
- **Auth:** JWT-based (`jsonwebtoken` + `bcryptjs`), session cookie, 7-day expiry
- **CSS:** Hand-written with custom properties (`variables.css`), no framework
- **Charts:** Chart.js via `svelte-chartjs`

## Route Structure
- `/login` — Auth page, POST action validates credentials
- `/dashboard` — SummaryCards, LendingSummaryCards, Sparkline trends, MonthlyTrendChart, CategoryDonutChart, TransactionList
- `/transactions` — Paginated list, collapsible filters, TransactionList, CSV export
- `/transactions/new` — Add transaction form (TransactionForm component)
- `/transactions/[id]/edit` — Edit transaction
- `/categories` — Category list (card/table views), CategoryForm, CategoryUsageBar
- `/lending` — Lending tracker, summary cards, card/table views, active/paid tabs
- `/reports` — Charts, YearOverYearCard, tabs (Overview/Income/Expenses/Lending), CSV export
- `/api/transactions/export` — CSV download endpoint
- `/api/reports/export` — CSV download endpoint

## Key Components
- `SummaryCards.svelte` — Props: totalIncome, totalExpenses, balance, savingsRate
- `TransactionList.svelte` — Props: transactions, onDelete, showActions
- `TransactionForm.svelte` — Props: categories, transaction?, action?, errors
- `CategoryList.svelte` — Props: categories, spending, income, onEdit, onDelete
- `CategoryUsageBar.svelte` — Props: spent, budget, compact
- `Sparkline.svelte` — Props: labels, data (compact line chart)
- `MonthlyTrendChart.svelte` — Props: labels, incomeData, expenseData
- `CategoryDonutChart.svelte` — Props: labels, data
- `ModalDialog.svelte` — Props: open, title, onclose, children (snippet)

## Design Tokens (variables.css)
- `--color-primary: #6366f1` (indigo)
- `--color-income: #10b981` (green)
- `--color-expense: #ef4444` (red)
- `--color-warning: #f59e0b` (amber)
- Spacing: `--space-xs` (4px) through `--space-2xl` (48px)
- Radii: `--radius-sm` (6px) through `--radius-xl` (16px), `--radius-full` (9999px)
- Dark mode: `[data-theme="dark"]` selector
- Shadows: `--shadow-sm`, `--shadow-md`, `--shadow-lg`

## Format Utilities (src/lib/utils/format.ts)
- `formatCurrency(amount)` — ₱ formatted
- `formatDate(dateStr)` — "Jul 15, 2026"
- `formatDateInput(date?)` — "2026-07-15"
- `formatWithCommas(value)` — "1,250.00"
- `handleAmountInput(e)` — Strips non-numeric, returns raw
- `handleAmountFocus(e, rawAmount)` — Shows raw value for editing
- `handleAmountBlur(e, rawAmount)` — Reformats with commas
- `formatEditAmount(value)` — Format stored value for edit
- `transactionsToCSV(transactions)` — Converts to CSV format
- `countUp(target, duration, onFrame)` — Animated number count

## Role
- You are a **Svelte/SvelteKit expert agent** with deep knowledge of Svelte 5 runes, SvelteKit routing, form actions, and SSR patterns. You are also a **seasoned UI/UX designer** specializing in financial applications — prioritize visual polish, accessibility, responsive design, and cohesive design systems.

## Workflow Rule
- **Plan first, code second:** Before implementing any change, write a plan in `plans/<short-description>.md` and present it for approval. Only proceed to implementation once the plan is approved.

## Pattern Rules
- Use **Svelte 5 runes** (`$state`, `$derived`, `$props`, `$effect`) — NOT Svelte 4 `export let` or `$:` 
- Use **SvelteKit form actions** with `use:enhance` for data mutations
- All CSS uses **CSS custom properties** from variables.css — no hardcoded colors
- **No Tailwind/Bootstrap** — hand-written CSS only
- Use **`as App.PageData`** type assertion for `$page.data` (current pattern)
- Hardcoded `rgba(255,255,255)` backgrounds and `backdrop-filter` break dark mode — use `var(--color-surface)` instead
- Prefer **inline improvements** over extracting new components (previous extraction attempts were rejected)

## Server Data Patterns
- Page server files use `load({ locals })` — authenticate via `locals.user!.userId`
- Form actions return `{ success: true }` or `fail(status, { error })`
- Database queries: `queryOne<T>(sql, params)`, `queryMany<T>(sql, params)`, `execute(sql, params)`
- All transactions queries include `LEFT JOIN categories c ON t.category_id = c.id` for category data

## To Run
```bash
npm run dev
```

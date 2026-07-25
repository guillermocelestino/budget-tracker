# Architecture

## Framework

The app is built on [**SvelteKit 5**](https://kit.svelte.dev/) in **runes mode** (`$state`, `$derived`, `$effect`, `$props`). It uses SvelteKit's full-stack pattern:

- **Page routes** render HTML on the server
- **Form actions** handle mutations with progressive enhancement
- **API routes** provide a parallel REST interface

---

## Project Structure

```
src/
├── app.d.ts              Global type declarations
├── app.html              HTML shell
├── hooks.server.ts       Server init (DB setup on startup)
├── styles/
│   └── variables.css     CSS custom properties (colors, spacing, etc.)
│
├── lib/
│   ├── types.ts          TypeScript interfaces
│   ├── index.ts          Library barrel export (empty)
│   ├── database/
│   │   ├── index.ts      Database connection singleton (better-sqlite3)
│   │   └── init.ts       Schema creation + default category seeding
│   ├── utils/
│   │   ├── format.ts     Currency/date formatting utilities
│   │   └── chart.ts      Chart.js global registration
│   └── components/
│       ├── Sidebar.svelte         Navigation sidebar
│       ├── PageHeader.svelte      Reusable page title bar
│       ├── SummaryCards.svelte    Income/Expenses/Balance cards
│       ├── TransactionForm.svelte Add/edit transaction form
│       ├── TransactionList.svelte Transaction table/cards
│       ├── CategoryForm.svelte    Add/edit category form
│       ├── CategoryList.svelte    Category card grid
│       ├── MonthlyChart.svelte    Chart.js bar chart
│       ├── CategoryChart.svelte   Chart.js doughnut chart
│       └── ModalDialog.svelte     Reusable confirmation modal
│
└── routes/
    ├── +layout.svelte            App shell (sidebar + content)
    ├── +page.server.ts           Dashboard load
    ├── +page.svelte              Dashboard page
    ├── transactions/
    │   ├── +page.server.ts       Transaction list load + delete action
    │   ├── +page.svelte          Transaction list page
    │   ├── new/
    │   │   ├── +page.server.ts   Create transaction action
    │   │   └── +page.svelte      New transaction form page
    │   └── [id]/
    │       └── edit/
    │           ├── +page.server.ts   Edit transaction action
    │           └── +page.svelte      Edit transaction form page
    ├── categories/
    │   ├── +page.server.ts       Category list load + CRUD actions
    │   └── +page.svelte          Category management page
    ├── reports/
    │   ├── +page.server.ts       Report data load
    │   └── +page.svelte          Reports page with charts
    └── api/
        ├── transactions/
        │   ├── +server.ts        GET list / POST create
        │   └── [id]/
        │       └── +server.ts    GET / PUT / DELETE single transaction
        ├── categories/
        │   ├── +server.ts        GET list / POST create
        │   └── [id]/
        │       └── +server.ts    GET / PUT / DELETE single category
        └── reports/
            ├── monthly/
            │   └── +server.ts    GET monthly report for a year
            └── by-category/
                └── +server.ts    GET category breakdown for a month
```

---

## Data Flow Patterns

### Loading Data (Server-Side Rendering)

Each page has a `+page.server.ts` file with a `load()` function:

```
1. Request comes in for a route
2. SvelteKit calls the `load` function on the server
3. `load` calls getDb() → executes SQLite queries
4. Returns plain data object
5. SvelteKit renders the `+page.svelte` component with that data
6. HTML is sent to the browser
```

Example ([dashboard load](../src/routes/+page.server.ts)):
```typescript
export function load() {
    const db = getDb();
    const summary = db.prepare(/* SQL */).get(firstDay, lastDay);
    const recentTransactions = db.prepare(/* SQL */).all();
    return {
        summary: { totalIncome, totalExpenses, balance },
        recentTransactions,
    };
}
```

### Mutating Data (Form Actions)

All creates, updates, and deletes use SvelteKit form actions:

```
1. User submits a form (POST)
2. SvelteKit calls the form action function on the server
3. Action validates input → executes SQLite mutation
4. Returns { success: true } or fail() with errors
5. SvelteKit re-renders the page with updated data
```

Forms use `use:enhance` for progressive enhancement — they work without JavaScript, but get a smoother UX when JS is available.

### API Routes (REST)

The API routes at `src/routes/api/*` provide the same functionality as form actions but return JSON. They are **not consumed by the frontend** but exist for:

- External integrations
- Testing
- Future mobile or third-party clients

---

## Database Layer

### Connection Management

[`src/lib/database/index.ts`](../src/lib/database/index.ts) manages a singleton `better-sqlite3` connection:

- **Lazy initialization** — the database isn't opened until the first query
- **WAL mode** `(PRAGMA journal_mode = WAL)` — better concurrent read performance
- **Foreign keys enforced** `(PRAGMA foreign_keys = ON)`
- Database file stored at `data/budget.db` (created automatically)

### Initialization

[`src/lib/database/init.ts`](../src/lib/database/init.ts) is called from [`hooks.server.ts`](../src/hooks.server.ts) on server startup:

1. Creates tables (`categories`, `transactions`) if they don't exist
2. Creates indexes on `date`, `category_id`, `type`
3. Seeds 11 default categories if the table is empty (in a transaction)

---

## Component Tree

```
+layout.svelte
├── Sidebar.svelte
│   ├── Logo + version
│   └── Nav items (Dashboard, Transactions, Categories, Reports)
│
└── Page Content (routes/*)
    │
    ├── Dashboard (/)
    │   ├── PageHeader
    │   ├── SummaryCards (income, expenses, balance)
    │   ├── TransactionList (recent 5)
    │   └── ModalDialog (delete confirm)
    │
    ├── Transactions (/transactions)
    │   ├── PageHeader
    │   ├── Filter bar (type, category, date range)
    │   ├── TransactionList
    │   ├── Pagination
    │   └── ModalDialog (delete confirm)
    │
    ├── New Transaction (/transactions/new)
    │   ├── PageHeader
    │   └── TransactionForm
    │
    ├── Edit Transaction (/transactions/[id]/edit)
    │   ├── PageHeader
    │   └── TransactionForm (pre-filled)
    │
    ├── Categories (/categories)
    │   ├── PageHeader
    │   ├── CategoryForm (inline, add/edit)
    │   ├── CategoryList (grid of cards with budget bars)
    │   └── ModalDialog (delete confirm)
    │
    └── Reports (/reports)
        ├── PageHeader
        ├── Year selector
        ├── MonthlyChart (bar chart)
        ├── Month selector
        ├── CategoryChart (doughnut chart)
        └── Category breakdown table
```

---

## Component Responsibilities

| Component            | Inputs (Props)                    | Responsibility                         |
|----------------------|-----------------------------------|----------------------------------------|
| `Sidebar`            | — (reads `$page.url`)             | Navigation, mobile toggle              |
| `PageHeader`         | `title`, `action` snippet         | Page title + action button slot        |
| `SummaryCards`       | `totalIncome`, `totalExpenses`, `balance` | Financial summary cards       |
| `TransactionForm`    | `categories`, `transaction?`, `action`, `errors` | Data entry with formatting  |
| `TransactionList`    | `transactions`, `onDelete`, `showActions` | Table/cards with sorting       |
| `CategoryForm`       | `category?`, `onCancel`, `action` | Category data entry with color picker  |
| `CategoryList`       | `categories`, `spending`, `onEdit`, `onDelete` | Card grid with budget bars |
| `MonthlyChart`       | `labels`, `incomeData`, `expenseData` | Monthly bar chart              |
| `CategoryChart`      | `labels`, `data`, `colors`        | Expense doughnut chart                 |
| `ModalDialog`        | `open`, `title`, `onclose`        | Overlay modal with animation           |

---

## Styling

All styles use **CSS custom properties** defined in [`src/styles/variables.css`](../src/styles/variables.css):

| Category     | Example Variables                                  |
|--------------|----------------------------------------------------|
| Colors       | `--color-primary`, `--color-income`, `--color-expense`, `--color-bg`, `--color-surface` |
| Typography   | `--font-family`, `--font-size-sm`, `--font-size-base`, `--font-size-lg`, `--font-size-xl` |
| Spacing      | `--space-xs` through `--space-2xl`                 |
| Borders      | `--radius-sm`, `--radius-md`, `--radius-lg`        |
| Shadows      | `--shadow-sm`                                      |

No CSS framework is used — styles are authored per-component with Svelte's scoped `<style>` blocks.

---

## Dependencies (npm)

| Package                | Purpose                                  |
|------------------------|------------------------------------------|
| `@sveltejs/kit`        | Framework core                           |
| `@sveltejs/adapter-auto` | Auto-detect deployment adapter         |
| `svelte`               | Svelte 5 with runes                      |
| `better-sqlite3`       | SQLite3 database driver                  |
| `chart.js`             | Charting library                         |
| `svelte-chartjs`       | Svelte bindings for Chart.js             |
| `vite`                 | Build tool                               |
| `typescript`           | Type checking                            |

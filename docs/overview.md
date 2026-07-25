# Budget Tracker — Overview

## What It Does

Budget Tracker is a **personal finance web application** that helps you track your income and expenses, organize them into categories with budget limits, and visualize your spending patterns over time.

### Core Concepts

- **Transactions** — The fundamental unit of data. Each transaction has a type (`income` or `expense`), an amount, a description, a date, and a category.
- **Categories** — Tags that organize transactions (e.g., Food & Dining, Transportation, Salary). Categories can have a monthly **budget limit** to help you cap spending in that area.
- **Reports** — Aggregated views of your data: monthly income vs. expense charts and category spending breakdowns.

---

## Tech Stack

| Layer       | Technology                                      |
|-------------|-------------------------------------------------|
| Framework   | [SvelteKit 5](https://kit.svelte.dev/) (runes mode) |
| Database    | SQLite via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) |
| Charts      | [Chart.js](https://www.chartjs.org/) via [svelte-chartjs](https://github.com/SauravKanchan/svelte-chartjs) |
| Styling     | Custom CSS variables |
| Language    | TypeScript |
| Currency    | PHP (Philippine Peso) |

It is a **single-user, local-first** application — no authentication, no cloud sync. The database file lives at `data/budget.db` and is gitignored.

---

## How Data Flows

The app uses SvelteKit's full-stack capabilities with **server-side rendering**:

```
Browser request
     │
     ▼
SvelteKit server
     │
     ├── hooks.server.ts  →  Initializes SQLite database on first start
     │
     ├── +page.server.ts  →  load() queries SQLite, returns data
     │         │
     │         ▼
     │   +page.svelte     →  Renders UI components with server data
     │
     └── Form action      →  POST request mutates SQLite
                │
                ▼
          Redirect or re-render page
```

- **All data fetching** happens in server-side `load` functions — no client-side API calls.
- **All mutations** (create, update, delete) use [SvelteKit form actions](https://kit.svelte.dev/docs/form-actions) with progressive enhancement (`use:enhance`).
- REST API endpoints exist at `/api/*` but are not consumed by the frontend — they're available for external tools or future clients.

---

## Pages at a Glance

| Route              | Page              | What You Can Do                              |
|--------------------|-------------------|----------------------------------------------|
| `/`                | Dashboard         | See monthly summary + 5 recent transactions  |
| `/transactions`    | Transactions      | List, filter, sort, add, edit, delete        |
| `/transactions/new`| New Transaction   | Create a transaction                         |
| `/transactions/[id]/edit` | Edit Transaction | Modify a transaction                 |
| `/categories`      | Categories        | Manage categories and budget limits          |
| `/reports`         | Reports           | View monthly charts + category breakdown     |

---

## Currency

All amounts are displayed in **Philippine Pesos (PHP)** using the format `₱1,234.56`.

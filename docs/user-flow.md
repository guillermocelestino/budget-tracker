# User Flow — Navigation & Journeys

## App Shell

Every page is wrapped in a shared layout ([`+layout.svelte`](../src/routes/+layout.svelte)) consisting of:

- A **sidebar** on the left with navigation links
- A **main content area** on the right

On mobile (< 768px), the sidebar hides behind a hamburger menu overlay.

## Navigation

The sidebar contains 4 navigation items:

| Icon | Label        | Route            |
|------|--------------|------------------|
| 📊   | Dashboard    | `/`              |
| 💳   | Transactions | `/transactions`  |
| 🏷️   | Categories   | `/categories`    |
| 📈   | Reports      | `/reports`       |

The active page is highlighted in the sidebar based on the current URL path.

---

## User Journeys

### 1. Dashboard (Home)

**Route:** `/`

The first thing you see. It shows your financial snapshot for the **current month**:

```
┌──────────────────────────────────────────┐
│  💰 Income      💸 Expenses    🏦 Balance│
│  ₱15,000        ₱4,200        ₱10,800   │
└──────────────────────────────────────────┘

Recent Transactions ───────────────────────
│ Date     │ Description   │ Category │ Amount     │
│──────────┼───────────────┼──────────┼────────────┤
│ Jul 25   │ Groceries     │ Food 🍽️  │ -₱1,200   │
│ Jul 24   │ Salary        │ Salary💰│ +₱15,000  │
│ ...      │               │          │            │
└──────────┴───────────────┴──────────┴────────────┘
```

- **Summary cards** show total income, total expenses, and balance for the current month.
- **Recent transactions** lists the 5 most recent entries.
- Click **View all** to go to the full transactions list.
- Click **Edit** (✏️) or **Delete** (🗑️) on any transaction.
- If there are no transactions yet, a call-to-action prompts you to add your first one.

---

### 2. Viewing & Managing Transactions

**Route:** `/transactions`

This is the main transaction ledger — a filterable, sortable, paginated list.

#### Filtering
Use the filter bar to narrow down results:
- **Type**: All / Income / Expense
- **Category**: Select any category
- **Date From / Date To**: Date range picker
- Click **Apply** to filter, **Clear** to reset

#### Sorting
Click the **Date** or **Amount** column headers to toggle ascending/descending sort.

#### Pagination
When there are more than 20 transactions, pagination controls appear at the bottom.

#### Actions
- Click the **+ Add Transaction** button to create a new transaction.
- Click **✏️** on any row to edit it.
- Click **🗑️** to delete — a confirmation modal appears.

---

### 3. Adding a Transaction

**Route:** `/transactions/new`

A form with the following fields:

1. **Type** — Toggle between Expense (💸) and Income (💰)
2. **Amount** — Numeric input with ₱ prefix and comma formatting
3. **Description** — Short text (max 255 characters)
4. **Date** — Date picker (defaults to today)
5. **Category** — Dropdown of all categories

On submit:
- Server validates all fields
- If valid: transaction is saved, redirect to `/transactions`
- If invalid: errors appear inline next to each field

---

### 4. Editing a Transaction

**Route:** `/transactions/[id]/edit`

The same form as adding, pre-populated with the existing transaction's data. Submit updates the record and redirects to `/transactions`.

---

### 5. Managing Categories

**Route:** `/categories`

Categories are displayed as cards in a responsive grid:

```
┌──────────────────────┐   ┌──────────────────────┐
│ 🍽️ Food & Dining    │   │ 🚗 Transportation    │
│ ₱500 budget         │   │ ₱200 budget          │
│ ████████░░ 80%      │   │ ████░░░░░░ 40%       │
│ [Edit] [Delete]     │   │ [Edit] [Delete]      │
└──────────────────────┘   └──────────────────────┘
```

#### Adding a Category
1. Click **+ Add Category**
2. An inline form appears above the list
3. Enter: **Name**, **Color** (picker or preset swatches), **Icon** (emoji), **Budget Limit** (optional)
4. Submit — the category appears in the grid

#### Editing a Category
Click **✏️** on any card — the form panel opens pre-filled.

#### Deleting a Category
Click **🗑️** — a confirmation modal appears. Categories that have transactions **cannot be deleted** (the database enforces this).

#### Budget Progress
Cards with a budget limit show a progress bar:
- **Green** (< 75% spent)
- **Amber** (75–99% spent)
- **Red** (≥ 100% spent, exceeded)

---

### 6. Viewing Reports

**Route:** `/reports`

Two sections:

#### Monthly Overview
A grouped bar chart showing income (green) vs. expenses (red) for each month of the selected year. Use the year selector dropdown to change years.

#### Expense by Category
Below the monthly chart, a month selector lets you pick a specific month. The report shows:
- **Doughnut chart** — expense distribution by category, with a legend
- **Category Breakdown table** — each category with amount and percentage of total

Hover over chart segments for tooltips with formatted amounts and percentages.

---

## Confirmation Flow

All destructive actions (deleting transactions or categories) go through a **modal dialog**:

1. Click delete icon → modal appears with confirmation message
2. Click **Delete** to confirm → form submits → page refreshes
3. Click **Cancel** or the backdrop → modal closes, nothing happens

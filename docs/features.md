# Features

## 1. Dashboard Summary

The dashboard shows a snapshot of the **current month's finances** with three summary cards:

- **Income** (💰) — total income for the month, displayed on a card with a green left border
- **Expenses** (💸) — total expenses for the month, displayed on a card with a red left border
- **Balance** (🏦) — income minus expenses. Turns red when negative (overspend)

Below the summary, the 5 most recent transactions are shown with edit/delete actions.

---

## 2. Transaction Management

### CRUD Operations

| Operation | How |
|-----------|-----|
| **Create** | Form at `/transactions/new` with type toggle (income/expense), amount, description, date, and category |
| **Read**   | Paginated list at `/transactions` with server-side filtering |
| **Update** | Edit form at `/transactions/[id]/edit`, pre-populated with existing data |
| **Delete** | Confirmation modal, then server-side deletion |

### Filtering

Transactions can be filtered by:

| Filter       | Type       | Details                        |
|--------------|------------|--------------------------------|
| Type         | Dropdown   | All / Income / Expense         |
| Category     | Dropdown   | Any category, populated live   |
| Date From    | Date input | Start of date range            |
| Date To      | Date input | End of date range              |

Filters are applied as URL query parameters (`?type=expense&category_id=3`), making them shareable and bookmarkable.

### Sorting

Click the **Date** or **Amount** column headers in the table to sort. Click again to toggle between ascending and descending.

### Pagination

20 transactions per page with Previous/Next controls at the bottom.

### Responsive Display

- **Desktop** (> 480px): Full HTML table with all columns
- **Mobile** (< 480px): Card-based layout (table hidden)
- On extra-small screens (< 640px): Description column hidden from table view

### Amount Formatting

The amount input formats numbers with commas as you type (e.g., `1,234.56`) and uses a `₱` prefix. The display color-codes amounts: green for income (+), red for expenses (-).

---

## 3. Category Management

### CRUD Operations

| Operation | How |
|-----------|-----|
| **Create** | Inline form panel with name, color, icon, and optional budget limit |
| **Read**   | Responsive grid of category cards |
| **Update** | Click edit → inline form opens pre-filled |
| **Delete** | Confirmation modal. Blocked if category has transactions (409 error) |

### Color Picker

Each category has a customizable color:
- **Native color input** — full spectrum picker
- **10 preset swatches** — one-click selection (red, orange, amber, green, teal, blue, indigo, violet, pink, gray)

### Icon

Each category uses an emoji icon (e.g., 🍽️, 🚗, 🎬). The icon is displayed prominently in the category card and in transaction rows.

### Budget Limits

Categories can have a **monthly budget limit** (in PHP). When set, the category card shows:

- A **progress bar** with color-coded status:
  - 🟢 **Green** (< 75% spent)
  - 🟡 **Amber** (75–99% spent)
  - 🔴 **Red** (≥ 100% spent, exceeded)
- **Amount spent** text (e.g., "₱400 spent")
- **Percentage** text (e.g., "80%")

---

## 4. Reports & Visualizations

### Monthly Overview (Bar Chart)

A grouped bar chart showing income (green) and expenses (red) for each month of the selected year. Built with Chart.js via `svelte-chartjs`.

- Hover for tooltips with formatted PHP amounts
- Y-axis labels use PHP currency format
- Year selector dropdown (2024–2028)

### Expense by Category (Doughnut Chart)

A doughnut chart showing how expenses are distributed across categories for a selected month.

- Each segment is colored to match its category color
- Legend on the right side
- Tooltips show: category name, amount, and percentage of total

### Category Breakdown Table

A table adjacent to the doughnut chart showing:

| Category (with color dot) | Amount     | %     |
|---------------------------|------------|-------|
| 🍽️ Food & Dining         | ₱1,200    | 40.0% |
| 🚗 Transportation         | ₱800      | 26.7% |
| ...                       | ...        | ...   |

---

## 5. Mobile Responsiveness

The app is designed to work across screen sizes:

| Breakpoint | Behavior |
|------------|----------|
| > 768px    | Full sidebar visible, 3-column summary grid, full transaction table |
| 480–768px  | Sidebar collapses to hamburger overlay, summary grid stacks to 1 column |
| < 480px    | Transaction table replaced with card layout |

All interactive elements have **minimum touch targets** of 44×44px for mobile usability.

---

## 6. Confirmation Dialogs

A reusable [`ModalDialog`](../src/lib/components/ModalDialog.svelte) component handles all delete confirmations:

- **Backdrop click** or **Escape key** dismisses the modal
- **Animated entrance** (scale 0.95 → 1.0 with opacity fade)
- Uses SvelteKit's `use:enhance` for progressive form enhancement

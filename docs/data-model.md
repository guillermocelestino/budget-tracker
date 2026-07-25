# Data Model

## Database

The app uses a local **SQLite** database stored at `data/budget.db`. It's initialized automatically on first run via `hooks.server.ts` and never needs manual setup.

---

## Tables

### `categories`

Stores transaction categories with optional monthly budget limits.

| Column        | Type    | Constraints                          | Notes                            |
|---------------|---------|--------------------------------------|----------------------------------|
| `id`          | INTEGER | `PRIMARY KEY AUTOINCREMENT`          | Auto-generated ID                |
| `name`        | TEXT    | `NOT NULL UNIQUE`                    | e.g., "Food & Dining"            |
| `color`       | TEXT    | `NOT NULL DEFAULT '#6366f1'`         | Hex color for UI display         |
| `icon`        | TEXT    | `NOT NULL DEFAULT '📁'`              | Emoji icon                       |
| `budget_limit`| REAL    | nullable                             | Monthly spending cap in PHP      |
| `created_at`  | TEXT    | `NOT NULL DEFAULT datetime('now')`   | ISO-8601 timestamp               |

**Default categories** seeded on first run:

| Income Categories | Expense Categories         | Budget Limit |
|-------------------|----------------------------|--------------|
| 💰 Salary         | 🍽️ Food & Dining          | ₱500         |
| 💻 Freelance      | 🚗 Transportation          | ₱200         |
| 💵 Other Income   | 🛍️ Shopping               | ₱300         |
|                   | 🎬 Entertainment           | ₱150         |
|                   | 📄 Bills & Utilities       | ₱400         |
|                   | 🏥 Healthcare              | ₱200         |
|                   | 📚 Education               | ₱100         |
|                   | 📦 Other Expense           | None         |

### `transactions`

Records individual income and expense entries.

| Column        | Type    | Constraints                                      | Notes                          |
|---------------|---------|--------------------------------------------------|--------------------------------|
| `id`          | INTEGER | `PRIMARY KEY AUTOINCREMENT`                      | Auto-generated ID              |
| `amount`      | REAL    | `NOT NULL CHECK(amount > 0)`                     | Must be positive                |
| `description` | TEXT    | `NOT NULL`                                       | Max 255 characters             |
| `date`        | TEXT    | `NOT NULL`                                       | Format: `YYYY-MM-DD`           |
| `category_id` | INTEGER | `NOT NULL REFERENCES categories(id) ON DELETE RESTRICT` | FK to categories    |
| `type`        | TEXT    | `NOT NULL CHECK(type IN ('income', 'expense'))`  | Income or expense               |
| `created_at`  | TEXT    | `NOT NULL DEFAULT datetime('now')`               | ISO-8601 timestamp             |
| `updated_at`  | TEXT    | `NOT NULL DEFAULT datetime('now')`               | ISO-8601 timestamp             |

**Indexes:**

| Index                          | Column(s)       | Purpose                          |
|--------------------------------|-----------------|----------------------------------|
| `idx_transactions_date`        | `date DESC`     | Speed up date-ordered queries    |
| `idx_transactions_category`    | `category_id`   | Speed up category lookups        |
| `idx_transactions_type`        | `type`          | Speed up income/expense filters  |

---

## Relationships

```
categories  1 ──── *  transactions
  (id)                     (category_id)
```

- A **category** can have many **transactions**.
- A **transaction** belongs to exactly one **category**.
- Deleting a category is **restricted** (`ON DELETE RESTRICT`) — a category with existing transactions cannot be deleted. The server returns HTTP 409 if attempted.

---

## TypeScript Types

Defined in [`src/lib/types.ts`](../src/lib/types.ts):

```typescript
type TransactionType = 'income' | 'expense';

interface Transaction {
    id: number;
    amount: number;
    description: string;
    date: string;            // YYYY-MM-DD
    category_id: number;
    type: TransactionType;
    created_at: string;
    updated_at: string;
    category_name?: string;  // Joined from categories table
    category_color?: string; // Joined from categories table
}

interface TransactionFormData {
    type: TransactionType;
    amount: number;
    description: string;
    date: string;
    category_id: number;
}

interface Category {
    id: number;
    name: string;
    color: string;          // Hex, e.g. "#ef4444"
    icon: string;           // Emoji, e.g. "🍽️"
    budget_limit: number | null;
    created_at: string;
}

interface CategoryFormData {
    name: string;
    color: string;
    icon: string;
    budget_limit: number | null;
}
```

### Report Types

```typescript
interface MonthlyReportItem {
    month: string;      // YYYY-MM
    income: number;
    expense: number;
}

interface CategoryReportItem {
    category_id: number;
    category_name: string;
    category_color: string;
    total: number;
}

interface DashboardSummary {
    totalIncome: number;
    totalExpenses: number;
    balance: number;
}

interface PaginatedResult<T> {
    items: T[];
    total: number;
    page: number;
    totalPages: number;
}
```

---

## Key Queries

### Dashboard Summary (current month)
```sql
SELECT
    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as totalIncome,
    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as totalExpenses
FROM transactions
WHERE date >= ? AND date <= ?
```

### Category Budget Tracking
```sql
SELECT category_id, SUM(amount) as total
FROM transactions
WHERE type = 'expense' AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
GROUP BY category_id
```

### Monthly Report
```sql
SELECT strftime('%Y-%m', date) as month,
    SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
    SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
FROM transactions
WHERE strftime('%Y', date) = ?
GROUP BY month
ORDER BY month ASC
```

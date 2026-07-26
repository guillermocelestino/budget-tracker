# Plan: Lending Module - Track Money Lent Out

## Context
The user wants to track money lent to others (receivables). The module should:
- Record new loans (borrower name, amount, date, interest rate, status)
- View all outstanding loans
- Update loan status to "paid"
- When marked paid, optionally create an income transaction for the repayment

## Database Schema

### New Table: `lendings`

**File:** `src/lib/database/init.ts`

```sql
CREATE TABLE IF NOT EXISTS lendings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    borrower_name TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    interest_rate NUMERIC(5,2) DEFAULT 0,
    date Lent DATE NOT NULL,
    due_date DATE,
    status TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'paid'
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

SQLite version: same structure, `TEXT` for `DATE`, `INTEGER` for `BOOLEAN` flags.

## API Endpoints (New Files)

### 1. `src/routes/api/lendings/+server.ts`
- **GET** — fetch all lendings for user (`?status=active|paid`)
- **POST** — create new lending record

### 2. `src/routes/api/lendings/[id]/+server.ts`
- **GET** — fetch single lending
- **PUT** — update lending (including mark as paid)
- **DELETE** — delete lending

## Page Routes

### 1. `src/routes/lending/+page.svelte` (with `+page.server.ts`)
- List view showing all lendings (active and paid tabs)
- Summary cards: Total Lent, Total Recovered, Outstanding
- "New Lending" button → slide-in form panel
- Each lending row: borrower, amount, date, status badge
- "Mark as Paid" action on each row
- When marked paid → modal asking "Record as income?" → creates income transaction

### 2. `src/routes/lending/[id]/edit/+page.svelte`
- Edit form for lending details
- Mark as paid / mark as active toggle

## Components to Create/Modify

### New: `src/lib/components/LendingList.svelte`
- Renders the list of lendings with status badges
- "Mark as Paid" button per row
- Sort/filter by status

### New: `src/lib/components/LendingForm.svelte`
- Form: borrower name, amount, interest rate, date, due date, notes
- Validation similar to TransactionForm/CategoryForm

### Modify: `src/lib/components/Sidebar.svelte`
- Add "Lending" nav item with icon

### Modify: `src/lib/components/SummaryCards.svelte`
- Add lending summary (optional — or create separate LendingSummaryCards)

## Page Server Load (`src/routes/lending/+page.server.ts`)

```typescript
export const load = async ({ locals }) => {
    const userId = locals.user!.userId;

    const activeLendings = await queryMany(
        'SELECT * FROM lendings WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC',
        [userId, 'active']
    );

    const paidLendings = await queryMany(
        'SELECT * FROM lendings WHERE user_id = $1 AND status = $2 ORDER BY updated_at DESC',
        [userId, 'paid']
    );

    const totals = {
        totalLent: await getTotalLent(userId),
        totalRecovered: await getTotalRecovered(userId),
        outstanding: await getOutstanding(userId)
    };

    return { activeLendings, paidLendings, totals };
};
```

## Mark as Paid Flow

1. User clicks "Mark as Paid" on a lending row
2. Modal: "Record this repayment as income?" with Yes/Skip options
3. If Yes → POST to `/api/transactions` to create income transaction (category: "Lending Recovery" or similar), then update lending status to 'paid'
4. If Skip → just update lending status to 'paid'
5. Refresh the list

## Files to Create/Modify

**New files:**
- `src/routes/lending/+page.svelte`
- `src/routes/lending/+page.server.ts`
- `src/routes/lending/[id]/edit/+page.svelte`
- `src/routes/lending/[id]/edit/+page.server.ts`
- `src/routes/api/lendings/+server.ts`
- `src/routes/api/lendings/[id]/+server.ts`
- `src/lib/components/LendingList.svelte`
- `src/lib/components/LendingForm.svelte`

**Modify:**
- `src/lib/database/init.ts` — add lendings table
- `src/lib/components/Sidebar.svelte` — add Lending nav item
- `src/routes/+layout.server.ts` — add lending totals to sidebar badge (optional)
- `src/lib/types.ts` — add `Lending` type

## Effort
~4-5 hours total. Core structure (API + list page) is ~2hrs. Edit page and mark-as-paid flow is ~1hr. Sidebar integration and polish is ~1hr.
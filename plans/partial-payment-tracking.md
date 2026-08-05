# Implementation Plan: Replace "Mark as Paid" with Partial Payment Tracking

## Goal

Replace the binary "Mark as Paid" workflow with a full partial payment tracking system for both Lending and Borrowed. Users can record any payment amount, and the remaining balance is always derived from payment history.

---

## 0. Architecture Statement

> The `lending_payments` table is the authoritative settlement ledger and source of truth for all loan and debt resolution.
>
> **Every change to a loan balance must be represented by a row in `lending_payments`.** Future features should add new `payment_type` values rather than introducing new balance columns whenever practical.
>
> Future features (interest accrual, penalties, payment reversals, installments, payment methods, attachments, and reminders) should build on this ledger rather than introducing additional balance fields.

---

## 1. Database Schema Changes

### New Table: `lending_payments`

```sql
-- PostgreSQL
CREATE TABLE IF NOT EXISTS lending_payments (
    id SERIAL PRIMARY KEY,
    lending_id INTEGER NOT NULL REFERENCES lendings(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    payment_date DATE NOT NULL,
    notes TEXT,
    transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
    payment_type TEXT NOT NULL DEFAULT 'payment' CHECK (payment_type IN ('payment', 'write_off')),
    reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lending_payments_lending_id ON lending_payments(lending_id);
CREATE INDEX IF NOT EXISTS idx_lending_payments_user_id ON lending_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_lending_payments_payment_date ON lending_payments(payment_date DESC);
```

SQLite equivalent mirrors this with `INTEGER PRIMARY KEY AUTOINCREMENT`, `REAL` for amount, `TEXT` for dates, and `datetime('now')` defaults.

**`reference` column** — nullable, optional. Reserved for v2 features (GCash, BPI, Cash, Check #1023, Receipt, Invoice). Costs nothing now, very useful later. Not exposed in the v1 UI.

Add `lending_payments` to the `requiredTables` boot-time self-check in `initDb()`.

### Design Decisions

| Decision | Rationale |
|---|---|
| **`user_id` on `lending_payments`** | Denormalized for efficient user-scoped queries without JOINs. |
| **`transaction_id` nullable with `ON DELETE SET NULL`** | A payment can exist without a transaction (write_off, or user opted out). If the transaction is deleted independently, the payment survives but loses its link. |
| **`payment_type` CHECK constraint** | Enforces only `'payment'` or `'write_off'` at the DB level. |
| **No `amount_paid` column on `lendings`** | Per spec: remaining is always derived. Adding a cached column risks desynchronization. The `status` column remains as the only cache. |
| **`ON DELETE CASCADE` for `lending_id`** | Deleting a lending record cascades to its payments. This matches the existing delete action behavior. |

### Schema Registration Location

Add the `lending_payments` table to **both** `POSTGRES_SCHEMA_SQL` and `SQLITE_SCHEMA_SQL` constants in `src/lib/database/init.ts`, following the existing pattern.

---

## 2. Canonical Derived State Formula

This is the single source of truth for all calculations, everywhere:

```
cash_paid       = SUM(payment.amount WHERE payment_type = 'payment')
written_off     = SUM(payment.amount WHERE payment_type = 'write_off')
resolved_total  = cash_paid + written_off
remaining       = original_amount - resolved_total
status          = remaining > 0 ? 'active' : 'paid'
```

**Write-offs reduce remaining.** This is now consistent across the entire plan.

### SQL computation (single query per batch):

```sql
SELECT l.*,
  COALESCE(SUM(CASE WHEN p.payment_type = 'payment'  THEN p.amount ELSE 0 END), 0) as cash_paid,
  COALESCE(SUM(CASE WHEN p.payment_type = 'write_off' THEN p.amount ELSE 0 END), 0) as written_off
FROM lendings l
LEFT JOIN lending_payments p ON p.lending_id = l.id
WHERE l.user_id = $1 AND l.direction = $2
GROUP BY l.id
```

Then in TypeScript:
```typescript
const resolved_total = cash_paid + written_off;
const remaining = lending.amount - resolved_total;
const derived_status = remaining <= 0 ? 'paid' : 'active';
```

### Types

```typescript
export interface LendingPayment {
    id: number;
    lending_id: number;
    user_id: number;
    amount: number;
    payment_date: string;
    notes: string | null;
    transaction_id: number | null;
    payment_type: 'payment' | 'write_off';
    reference: string | null;  // reserved for v2
    created_at: string;
    updated_at: string;
}

export interface LendingWithPayments extends Lending {
    cash_paid: number;
    written_off: number;
    resolved_total: number;
    remaining: number;
    derived_status: 'active' | 'paid';
}
```

**Note**: `LendingWithPayments` extends `Lending` rather than replacing it. Components that only need `Lending` (like the form) still work. Components that need payment data use the extended type. The `status` field on `Lending` remains (it's the cache), and `derived_status` is the computed value. In practice, they should always match, but `derived_status` is the authoritative one.

---

## 3. Migration Strategy

### Step 1: Create `lending_payments` table (idempotent via `CREATE TABLE IF NOT EXISTS`)

### Step 2: Backfill synthetic payments for legacy `status='paid'` records

```sql
INSERT INTO lending_payments (lending_id, user_id, amount, payment_date, notes, payment_type)
SELECT l.id, l.user_id, l.amount, COALESCE(l.due_date, l.date_lent), 'Migrated', 'payment'
FROM lendings l
WHERE l.status = 'paid'
  AND NOT EXISTS (SELECT 1 FROM lending_payments p WHERE p.lending_id = l.id);
```

**Trade-off**: We use `COALESCE(due_date, date_lent)` as the spec requires. If both are null (impossible — `date_lent` is `NOT NULL`), we'd fall back to `date_lent`. This is safe.

### Step 3: Active records — no action

Records with `status='active'` and no payment history simply have `remaining = original_amount`. No synthetic payments needed.

### Step 4: Seed canonical repayment categories — NEVER rename existing

**Do not modify user data.** Instead, use a fallback lookup chain at runtime.

**Current code in `recordLendingTransaction.ts`:**
- `event='create' + direction='lent'` → expense, category "Lending Recovery"
- `event='create' + direction='borrowed'` → income, category "Debt Repayment"
- `event='repayment' + direction='lent'` → income, category "Lending Recovery"
- `event='repayment' + direction='borrowed'` → expense, category "Debt Repayment"

**Corrected canonical names per spec:**
- Lending repayment → Income, category **"Loan Repayment"**
- Borrowed repayment → Expense, category **"Debt Repayment"**

**Migration approach (never rename, only create):**

```sql
-- For each user, ensure "Loan Repayment" (income) exists
INSERT INTO categories (user_id, name, color, icon, type)
SELECT u.id, 'Loan Repayment', '#8b5cf6', '💳', 'income'
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM categories c
    WHERE c.user_id = u.id
      AND c.name IN ('Loan Repayment', 'Lending Recovery')
);

-- For each user, ensure "Debt Repayment" (expense) exists
INSERT INTO categories (user_id, name, color, icon, type)
SELECT u.id, 'Debt Repayment', '#ef4444', '💸', 'expense'
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM categories c WHERE c.user_id = u.id AND c.name = 'Debt Repayment'
);
```

**Runtime lookup in `recordLendingTransaction.ts`** uses the same fallback chain:
1. Look for `"Loan Repayment"` → use if found
2. Else look for `"Lending Recovery"` (legacy) → use if found
3. Else create `"Loan Repayment"`

This way, users who renamed or customized their category are never touched. The code just finds the right category by name.

### Step 5: Recalculate `status` cache for all records

```sql
UPDATE lendings SET status = 'paid'
WHERE COALESCE(
    (SELECT SUM(amount) FROM lending_payments p
     WHERE p.lending_id = lendings.id
       AND p.payment_type IN ('payment', 'write_off')
    ), 0
) >= lendings.amount;

UPDATE lendings SET status = 'active'
WHERE COALESCE(
    (SELECT SUM(amount) FROM lending_payments p
     WHERE p.lending_id = lendings.id
       AND p.payment_type IN ('payment', 'write_off')
    ), 0
) < lendings.amount;
```

---

## 4. Status Cache — The One Rule

> **Users never edit status. Imports never edit status. Forms never edit status. Only `recalcStatusCache()` writes status.**

This single rule prevents accidental regressions. Enforced by:
- `LendingForm.svelte` — no status field in the form
- `update` action — no status in the UPDATE SQL
- Import wizard — no status in the INSERT (derived from payment history)
- `api/lendings/+server.ts` POST — no status in the body
- `recalcStatusCache()` — the only function that writes to `lendings.status`

---

## 5. Server Action Changes

### 5.1 New Shared Helper: `src/lib/server/lendingPayments.ts`

**Functions:**

```typescript
// Compute derived state for many lendings (single query with LEFT JOIN + GROUP BY)
async function getLendingsWithPayments(userId: number, direction: 'lent' | 'borrowed'): Promise<LendingWithPayments[]>

// Recalculate and cache status on the lendings row
async function recalcStatusCache(userId: number, lendingId: number): Promise<'active' | 'paid'>

// Record a new payment
async function recordPayment(userId: number, params: {
    lendingId: number;
    amount: number;
    paymentDate: string;
    notes: string | null;
    paymentType: 'payment' | 'write_off';
    createTransaction: boolean;
}): Promise<{ paymentId: number; transactionId: number | null }>

// Update an existing payment (syncs linked transaction amount + date ONLY)
async function updatePayment(userId: number, paymentId: number, params: {
    amount: number;
    paymentDate: string;
    notes: string | null;
}): Promise<void>

// Delete a payment (deletes linked transaction)
async function deletePayment(userId: number, paymentId: number): Promise<void>

// Get payment history — ordered by payment_date DESC, created_at DESC, id DESC
async function getPaymentHistory(userId: number, lendingId: number): Promise<LendingPayment[]>
```

### 5.2 Concurrency — Requirement, Not Mechanism

> Record payment, create transaction (if requested), update `transaction_id`, and recalculate status must execute inside a single database transaction.

This leaves implementation freedom. The implementation can use:
- `BEGIN ... COMMIT`
- A transaction helper
- A CTE
- `SELECT FOR UPDATE` (PostgreSQL)
- SQLite write transaction

The architecture defines the requirement, not the mechanism.

**Implementation note**: The current `query.ts` layer doesn't expose transaction support. We'll add a `withTransaction` helper that works in both modes:
- **PostgreSQL**: Acquires a client, `BEGIN`, executes callbacks, `COMMIT` (or `ROLLBACK` on error)
- **SQLite**: Uses `db.transaction()` (synchronous, atomic)

### 5.3 Changes to `+page.server.ts` (lending & borrowed)

#### `load` function

Replace current queries with calls to `getLendingsWithPayments()`. Summary cards use aggregate queries, not UI iteration:

```sql
SELECT
  COALESCE(SUM(l.amount), 0) as total_lent,
  COALESCE(SUM(CASE WHEN p.payment_type = 'payment' THEN p.amount ELSE 0 END), 0) as cash_collected,
  COALESCE(SUM(CASE WHEN p.payment_type = 'write_off' THEN p.amount ELSE 0 END), 0) as written_off
FROM lendings l
LEFT JOIN lending_payments p ON p.lending_id = l.id
WHERE l.user_id = $1 AND l.direction = $2
```

#### `markPaid` action → **Replace with `recordPayment`**

Validation rules:
- Amount > 0
- Amount ≤ remaining (where remaining = original - cash_paid - written_off)
- **Payment date >= date_lent**
- **Payment date <= today**
- `payment_type` must be `'payment'` or `'write_off'`
- If `payment_type = 'write_off'`, `createTransaction` is forced to `false`
- Remaining check is atomic (inside transaction)

#### `update` action — Principal immutability with `date_lent` locked

When payments exist, lock these foundational fields:
- `amount` (principal)
- `direction` (lent/borrowed)
- `date_lent` (loan date — locked to prevent impossible histories)
- `currency` (future-proofing)

Still editable: `borrower_name`, `interest_rate`, `due_date`, `notes`

```typescript
if (hasPayments) {
    // Lock amount, direction, date_lent — only update metadata
    await execute(
        `UPDATE lendings SET borrower_name = $1, interest_rate = $2, due_date = $3, notes = $4, updated_at = NOW()
         WHERE user_id = $5 AND id = $6`,
        [borrower_name, interest_rate, due_date || null, notes, userId, id]
    );
} else {
    // No payments — amount, direction, date_lent are editable
    await execute(
        `UPDATE lendings SET borrower_name = $1, amount = $2, interest_rate = $3, date_lent = $4, due_date = $5, notes = $6, updated_at = NOW()
         WHERE user_id = $7 AND id = $8`,
        [borrower_name, parseFloat(amountStr), interest_rate, date_lent, due_date || null, notes, userId, id]
    );
}
```

#### New actions: `updatePayment`, `deletePayment`

`updatePayment`:
- Amount > 0
- New amount ≤ remaining (excluding this payment's current contribution)
- Payment date >= date_lent
- Payment date <= today
- Syncs linked transaction: updates `amount` and `date` ONLY. **Leaves `category` and `description` (memo) untouched.** If the user manually changed the transaction's category or memo, those changes are preserved.
- Recalculates status cache — may reopen the loan

`deletePayment`:
- Confirmation dialog explicitly states: "This will delete the payment and its linked transaction."
- Deletes linked transaction first, then the payment
- Recalculates status cache — may reopen the loan

#### `delete` action (lending)

Explicitly delete all linked transactions first, then `ON DELETE CASCADE` removes payments:

```typescript
const payments = await queryMany<{ transaction_id: number | null }>(
    'SELECT transaction_id FROM lending_payments WHERE lending_id = $1 AND transaction_id IS NOT NULL',
    [id]
);
for (const p of payments) {
    if (p.transaction_id) {
        await execute('DELETE FROM transactions WHERE user_id = $1 AND id = $2', [userId, p.transaction_id]);
    }
}
await execute('DELETE FROM lendings WHERE user_id = $1 AND id = $2', [userId, id]);
```

---

## 6. Payment ↔ Transaction Synchronization

| Event | Payment Side | Transaction Side |
|---|---|---|
| **Create payment** (createTransaction=true) | Insert `lending_payments` with `transaction_id` | Insert transaction, return ID |
| **Create payment** (createTransaction=false) | Insert `lending_payments` with `transaction_id=NULL` | No transaction |
| **Create write_off** | Insert with `transaction_id=NULL`, `payment_type='write_off'` | Never create a transaction |
| **Edit payment** | Update `.amount`, `.payment_date`, `.notes` | **Update `.amount` and `.date` ONLY. Leave `.category` and `.description` untouched.** |
| **Delete payment** | Delete `lending_payments` row | Delete linked transaction (with confirmation) |
| **Delete lending** | Cascades to payments | Explicitly delete all linked transactions first |

---

## 7. Components

### 7.1 `RecordPaymentModal.svelte`

```
Record Payment

Original     ₱20,000
Paid         ₱7,500
Remaining    ₱12,500

Payment Amount   [ ₱________ ]

Payment Date     [ Today ]

Notes (optional) [ __________ ]

Remaining after payment   ₱8,500

Progress   ████░░░░░░  ₱7,500 of ₱20,000 (37% paid)

☑ Create Transaction

[Cancel]  [Record Payment]
```

Progress shows both absolute and percentage. Remaining after payment uses canonical formula.

### 7.2 `PaymentHistoryPanel.svelte`

Payment history ordering: `payment_date DESC, created_at DESC, id DESC` (third tie-breaker for stability).

Each payment row shows the event type label and running remaining balance:

```
Aug 1
Payment
₱2,000
Remaining
₱18,000
─────────────
Aug 15
Payment
₱1,500
Remaining
₱16,500
─────────────
Sep 3
Write-off
₱500
Remaining
₱16,000
```

**Running remaining is derived during rendering from chronological payment history and is never stored.** This tells future developers not to add another column.

**Append-first design:** The primary action is "Record Payment" (add new). Edit and delete are secondary corrective actions per-row.

### 7.3 `EditPaymentModal.svelte`

Pre-filled. Live remaining/progress preview computed as:
```
remaining_after = original - (cash_paid + written_off - this_payment_amount + input_amount)
```

### 7.4 `DeletePaymentConfirmModal.svelte`

Confirmation text: "This will delete the payment and its linked transaction." If no linked transaction, omits the transaction mention.

### 7.5 `ActiveIouList.svelte`

- Use `cash_paid` and `written_off` from enriched data
- Progress: `resolved_total / amount * 100`
- Progress display: `₱7,500 of ₱20,000 (37% paid)` — both absolute and percentage
- Replace "Mark Paid"/"Repay" with "Record Payment"
- "Record Payment" hidden/disabled when `remaining <= 0`
- Remaining as primary (colored by direction), paid as secondary muted mono

### 7.6 `LendingForm.svelte`

- No status field
- When payments exist, lock: `amount`, `direction`, `date_lent` (and `currency` when added)
- Helper text: "Amount, direction, and loan date are locked because payments exist. Create a new record for a different amount."
- Still editable: `borrower_name`, `interest_rate`, `due_date`, `notes`

### 7.7 Summary Cards & Reporting Terminology

Standardized terminology:

| | Lending | Borrowed |
|---|---|---|
| Card 1 | Total Lent | Total Borrowed |
| Card 2 | Cash Collected | Cash Repaid |
| Card 3 | Written Off | Written Off |
| Card 4 | Outstanding (Receivable) | Outstanding (Owing) |

Recommendation: Keep 3 cards for visual consistency. Card 2 shows "Cash Collected" as main value with "Written Off ₱X" as sub-label. Card 3 shows Outstanding.

### 7.8 `+page.svelte` (lending & borrowed)

Wire up new modals, SlideOver with PaymentHistoryPanel, EditPaymentModal, DeletePaymentConfirmModal.

### 7.9 `RowActionsMenu.svelte` and `RowHoverActions.svelte`

`payLabel` default: `'Record Payment'`

---

## 8. Import Wizard

### `src/lib/server/lendingImport.ts`

After inserting each lending, if `recovered_amount > 0`, create a payment row:

```typescript
if (row.recovered_amount > 0 && newLending) {
    await execute(
        `INSERT INTO lending_payments (lending_id, user_id, amount, payment_date, notes, payment_type)
         VALUES ($1, $2, $3, $4, $5, 'payment')`,
        [newLending.id, userId, row.recovered_amount, row.date_lent, 'Imported']
    );
}
```

**Imports never directly populate derived balance fields.** The `recovered_amount` creates a payment row; derived state is computed from history. No transaction created for imported payments.

### `src/lib/utils/lendingImport.ts`

No change needed — `recovered_amount` is already parsed and validated. The `MappedLendingRow` type already includes it.

---

## 9. Other Consumers

### 9.1 `src/lib/server/networth.ts`

Keep using `status = 'active'` (cache maintained by `recalcStatusCache()`). Add comment documenting the cache rule.

### 9.2 `src/routes/dashboard/+page.server.ts` and `src/routes/reports/+page.server.ts`

Switch to payment-driven aggregate queries using the canonical formula:

```sql
SELECT
    COALESCE(SUM(l.amount), 0) as "totalLent",
    COALESCE(SUM(CASE WHEN p.payment_type = 'payment' THEN p.amount ELSE 0 END), 0) as "cashCollected",
    COALESCE(SUM(CASE WHEN p.payment_type = 'write_off' THEN p.amount ELSE 0 END), 0) as "writtenOff"
FROM lendings l
LEFT JOIN lending_payments p ON p.lending_id = l.id
WHERE l.user_id = $1 AND l.direction = 'lent'
```

### 9.3 `src/routes/api/lendings/+server.ts`

POST: Remove `status` from body. New lendings always start `active`.

### 9.4 `src/lib/utils/csv.ts` — Export

Export columns:

```typescript
const header = `${personLabel},Original,Cash Paid,Written Off,Remaining,Interest Rate (%),Date,Due Date,Status,Notes`;
```

Users can reconcile exported data with the canonical formula.

---

## 10. Edge Cases

| Edge Case | Handling |
|---|---|
| **Overpayment** | Reject at validation + atomic check |
| **Payment = remaining** | Allowed. Status → paid. Record Payment hides. |
| **Deleting a payment** | Confirmation: "This will delete the payment and its linked transaction." Deletes both. Recalculates status. May reopen loan. |
| **Editing a payment** | Updates amount, date, notes. Syncs transaction amount+date only. Recalculates status. May reopen loan. |
| **Write-offs** | Reduce remaining. Never create transaction. "Write-off" label in history. |
| **Imported records** | `recovered_amount` → payment row, notes="Imported". No transaction. |
| **Linked transactions** | `transaction_id` link. Delete payment → delete transaction. Delete transaction independently → `transaction_id=NULL`. |
| **Migration failures** | Idempotent. Re-running picks up where it left off. |
| **Principal immutable with payments** | Lock amount, direction, date_lent, currency. |
| **Payment date before loan** | Reject: "Payment date cannot be before the loan date" |
| **Payment date in future** | Reject: "Payment date cannot be in the future" |
| **Editing/deleting reopens loan** | Allowed. Status recalculated. Loan becomes active. Record Payment reappears. |
| **Record Payment on completed loan** | Hidden/disabled. |
| **Progress indicator** | Purely visual. Never stored. |
| **Concurrent payments** | Atomic transaction check at commit time. |
| **Category renamed by user** | Never modified. Fallback lookup. |
| **Transaction category/memo changed** | Preserved on payment edit. Only amount+date synced. |

---

## 11. Implementation Order

1. **Types** (`src/lib/types.ts`) — Add `LendingPayment`, `LendingWithPayments` with `reference`, `resolved_total`
2. **Database schema** (`src/lib/database/init.ts`) — Add `lending_payments` table + migration + category seeding
3. **Query layer** (`src/lib/database/query.ts`) — Add `withTransaction` helper
4. **Server helper** (`src/lib/server/lendingPayments.ts`) — New file with all payment logic
5. **Refactor `recordLendingTransaction.ts`** — Return ID, canonical category names with fallback
6. **Server actions** — Replace `markPaid` with `recordPayment`, add `updatePayment`/`deletePayment`, update `load`/`update`
7. **Import wizard** — Persist `recovered_amount`
8. **Other consumers** — Dashboard, reports, networth, api
9. **New components** — `RecordPaymentModal`, `PaymentHistoryPanel`, `EditPaymentModal`, `DeletePaymentConfirmModal`
10. **Modified components** — `ActiveIouList`, `LendingForm`, `LendingSummaryCards`, `RowActionsMenu`
11. **Page updates** — Wire up modals and SlideOver
12. **CSV utility** — Export with canonical columns
13. **Testing**

---

## 12. Key Architectural Decisions

1. `lending_payments` is the **authoritative settlement ledger** (not "immutable" — edits/deletes are corrective actions)
2. `remaining = original - cash_paid - written_off` — write-offs reduce remaining
3. Exposed fields: `cash_paid`, `written_off`, `resolved_total`, `remaining`
4. `status` is a cache — only `recalcStatusCache()` writes it
5. Unidirectional link — `lending_payments.transaction_id` → transaction
6. Categories: never rename user data. Fallback lookup. Never hardcode IDs.
7. Principal immutable with payments — lock `amount`, `direction`, `date_lent`, `currency`
8. Payment date validation — `>= date_lent`, `<= today`
9. Progress is purely visual — `₱X of ₱Y (Z% paid)` — never stored
10. Payment history ordering — `payment_date DESC, created_at DESC, id DESC`
11. Running remaining derived during rendering — never stored
12. Edit syncs transaction amount+date ONLY — category and memo untouched
13. Concurrency: requirement (single transaction), not mechanism
14. Standardized terminology — Cash Collected/Repaid, Written Off, Outstanding
15. Export: Original, Cash Paid, Written Off, Remaining, Status
16. `reference` column reserved for v2 — costs nothing now
17. History uses event-type labels ("Payment", "Write-off") — scales with future types
18. **Every balance change = a row in `lending_payments`** — extend `payment_type`, not columns

---

## Files Affected

| File | Change Type |
|---|---|
| `src/lib/types.ts` | Add types |
| `src/lib/database/init.ts` | Add table + migration |
| `src/lib/database/query.ts` | Add `withTransaction` helper |
| `src/lib/server/lendingPayments.ts` | **New file** |
| `src/lib/server/recordLendingTransaction.ts` | Refactor (return ID, category names) |
| `src/routes/lending/+page.server.ts` | Replace markPaid, update load/update |
| `src/routes/borrowed/+page.server.ts` | Replace markPaid, update load/update |
| `src/lib/server/lendingImport.ts` | Persist recovered_amount |
| `src/routes/dashboard/+page.server.ts` | Payment-driven totals |
| `src/routes/reports/+page.server.ts` | Payment-driven totals |
| `src/lib/server/networth.ts` | No change (uses status cache) |
| `src/routes/api/lendings/+server.ts` | Remove status from POST body |
| `src/lib/components/RecordPaymentModal.svelte` | **New file** |
| `src/lib/components/PaymentHistoryPanel.svelte` | **New file** |
| `src/lib/components/EditPaymentModal.svelte` | **New file** |
| `src/lib/components/DeletePaymentConfirmModal.svelte` | **New file** |
| `src/lib/components/ActiveIouList.svelte` | Use cash_paid/written_off, rename actions |
| `src/lib/components/LendingForm.svelte` | Remove status field, lock amount/date_lent |
| `src/lib/components/LendingSummaryCards.svelte` | Update terminology |
| `src/lib/components/RowActionsMenu.svelte` | Default label change |
| `src/routes/lending/+page.svelte` | Wire up new modals/panels |
| `src/routes/borrowed/+page.svelte` | Wire up new modals/panels |
| `src/lib/utils/csv.ts` | Add Cash Paid/Written Off/Remaining columns |
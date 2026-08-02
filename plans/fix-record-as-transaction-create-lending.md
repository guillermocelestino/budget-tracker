# Fix "Record as Transaction" in Create Lending/Borrowing Forms

## Problem
The "Record as Transaction" checkbox in the Create Lending and Create Borrowing forms is non-functional. When enabled, it should create a corresponding transaction immediately upon creating the lending/borrowing record, but the server-side `create` actions ignore this field entirely.

## Root Cause
Both `src/routes/lending/+page.server.ts` and `src/routes/borrowed/+page.server.ts` have `create` actions that:
- Read: `borrower_name`, `amount`, `interest_rate`, `date_lent`, `due_date`, `notes`, `direction`
- **Do NOT read**: `record_as_transaction`

Meanwhile, the `markPaid` actions in both files correctly handle this field and create transactions. The UI component (`LendingForm.svelte`) correctly binds the checkbox to state and includes it in form submission.

## Intended Behavior
When "Record as Transaction" is **ON** during creation:
- **Lending (direction='lent')**: Create an **expense** transaction (money went out to borrower)
  - Category: "Lending Recovery" (or create if missing)
  - Description: "Lent to {borrower_name}"
  - Type: `expense`
- **Borrowing (direction='borrowed')**: Create an **income** transaction (money received from lender)
  - Category: "Debt Repayment" (or create if missing)
  - Description: "Borrowed from {lender_name}"
  - Type: `income`

When **OFF**: Only create the lending/borrowing record, no transaction.

Note: This differs from `markPaid` logic where:
- `lent` → repayment = `income` (money returned)
- `borrowed` → repayment = `expense` (money paid out)

## Files to Modify
1. `src/routes/lending/+page.server.ts` - `create` action
2. `src/routes/borrowed/+page.server.ts` - `create` action

## Implementation Plan
Add ~15 lines to each `create` action:
1. Read `record_as_transaction` from form data
2. After inserting the lending record, if `true`:
   - Determine transaction type based on direction
   - Find or create appropriate category
   - Insert transaction with correct amount, description, date, category, type

## Verification Checklist
- [ ] Lending: Record as Transaction OFF → lending record only
- [ ] Lending: Record as Transaction ON → lending record + expense transaction
- [ ] Borrowed: Record as Transaction OFF → borrowing record only
- [ ] Borrowed: Record as Transaction ON → borrowing record + income transaction
- [ ] Checkbox state persists correctly in form
- [ ] No console/TypeScript errors
- [ ] `npm run check` passes
- [ ] `npm run build` passes
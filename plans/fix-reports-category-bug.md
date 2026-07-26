# Plan: Fix Reports Category Data Bug

## Root Cause

The `categoryData` query in `reports/+page.server.ts` has mismatched parameter ordering for SQLite.

**Current SQL:**
```sql
LEFT JOIN transactions t ON t.category_id = c.id AND TO_CHAR(t.date, 'YYYY-MM') = $2 AND t.type = 'expense'
WHERE c.user_id = $1
```

**Current params:** `[userId, month]`

The SQLite translation in `query.ts` replaces all `$N` with `?` globally. Since `$2` appears textually before `$1`, the translated query becomes:
```sql
LEFT JOIN ... strftime(...) = ? ... WHERE c.user_id = ?
```
- First `?` (was `$2`, expects month) → receives `params[0]` (userId) ❌
- Second `?` (was `$1`, expects userId) → receives `params[1]` (month) ❌

This causes no category data to appear in reports on SQLite (local dev). Postgres mode works fine because it matches `$N` by number.

## Fix

Swap `$1`/`$2` references and swap params array:

**File:** `src/routes/reports/+page.server.ts`

**Change SQL:**
```sql
LEFT JOIN transactions t ON t.category_id = c.id AND TO_CHAR(t.date, 'YYYY-MM') = $1 AND t.type = 'expense'
WHERE c.user_id = $2
```

**Change params:** `[month, userId]`

Now `$1` = month appears before `$2` = userId in text order. After translation, first `?` gets month, second `?` gets userId — matching the new params array order.

## Audit: Other Queries

Checked all ~30 queries in the app for the same issue. Only the `categoryData` query in reports has the `$N` out-of-order problem — all other queries have `$1` before `$2` before `$3` textually, matching their params array order.

## Verification

1. Start the dev server (SQLite mode)
2. Create a transaction with type "expense" in the current month
3. Navigate to Reports → the category chart and breakdown table should show the expense data
4. `npm test` — all 17 tests still pass
5. `npm run build` — no errors

# Dashboard Income/Expenses Not Computing — Bug Analysis & Fix Plan

## Context

The Dashboard page (`+page.svelte`) shows SummaryCards for Income, Expenses, and Balance. Users report that these values show $0.00 or undefined even when transactions exist in the database.

## Root Cause: Column Alias Case Mismatch Between Postgres and SQLite

### The Bug

In [src/routes/+page.server.ts](src/routes/+page.server.ts), the dashboard query uses **camelCase** aliases:

```typescript
// +page.server.ts, line 11-14
`SELECT
    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as totalIncome,
    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as totalExpenses
 FROM transactions
 WHERE date >= $1 AND date <= $2`
```

Then accesses those aliases in **lowercase**:

```typescript
// +page.server.ts, line 30-31
totalIncome: parseFloat(summary?.totalincome ?? '0'),  // lowercase 'totalincome'
totalExpenses: parseFloat(summary?.totalexpenses ?? '0'), // lowercase 'totalexpenses'
```

### Why It Fails in SQLite Mode

**PostgreSQL** folds unquoted identifiers to lowercase:
- Alias `totalIncome` → returned key is `totalincome`
- `summary.totalincome` matches → ✅ works

**SQLite (better-sqlite3)** preserves original casing:
- Alias `totalIncome` → returned key is `totalIncome`
- `summary.totalincome` does NOT match → returns `undefined`, falls back to `'0'` → **shows $0.00**

### Why It Works in Postgres Mode

Both the alias and accessor resolve to lowercase, so the match succeeds. This bug only manifests in local development (SQLite mode).

## Affected Files

| File | Alias in Query | Access in Code | SQLite Broken? |
|------|---------------|----------------|----------------|
| [src/routes/+page.server.ts](src/routes/+page.server.ts) | `as totalIncome` | `summary.totalincome` | ✅ Yes |
| [src/routes/+page.server.ts](src/routes/+page.server.ts) | `as totalExpenses` | `summary.totalexpenses` | ✅ Yes |
| [src/routes/reports/+page.server.ts](src/routes/reports/+page.server.ts) | `as income` | `monthSummary.income` | ❌ No (all lowercase both sides) |
| [src/routes/reports/+page.server.ts](src/routes/reports/+page.server.ts) | `as expense` | `monthSummary.expense` | ❌ No (all lowercase both sides) |

## Fix Strategy

**Option A: Normalize aliases to lowercase** (Recommended — simplest)
- Change the SQL aliases from `as totalIncome` → `as totalincome` and `as totalExpenses` → `as totalexpenses`
- Both Postgres and SQLite will return lowercase keys
- Minimal change, no risk of breaking existing behavior

**Option B: Fix the JS access keys**
- Change `summary.totalincome` → `summary.totalIncome` (camelCase)
- This would break Postgres mode because Postgres folds to lowercase

**Option C: Normalize all column keys in the query layer**
- Add a helper in `query.ts` to normalize result keys to lowercase for both Postgres and SQLite
- More invasive change, but fixes the problem for all future queries

## Recommendation

**Go with Option A** — change the SQL aliases to all-lowercase in the dashboard query. This is the minimal, safe fix. Additionally, audit the rest of the codebase for any other queries using camelCase aliases that are accessed with lowercase keys.

## Verification

1. Run the app in SQLite mode (no `POSTGRES_URL` set)
2. Create an income transaction (e.g., $1000 Salary) and an expense transaction (e.g., $200 Food) for the current month
3. Navigate to Dashboard — Income should show $1,000.00 and Expenses should show $200.00
4. Repeat with `POSTGRES_URL` set — same values should appear
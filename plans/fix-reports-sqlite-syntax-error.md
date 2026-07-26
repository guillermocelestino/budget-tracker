# Plan: Fix SQLite Syntax Error on Reports Page

## Context

The `/reports` page returns `[500] SqliteError: near "FROM": syntax error` because the `translatePgToSQLite` function in `src/lib/database/query.ts` fails to fully translate PostgreSQL `EXTRACT(...)` expressions when combined with `::int` casting on the same line.

The error was introduced by the recent YoY comparison changes in `src/routes/reports/+page.server.ts` which added queries like:
```sql
WHERE user_id = $1 AND EXTRACT(YEAR FROM date) = $2::int AND EXTRACT(MONTH FROM date) <= $3::int
```

The existing regex on line 14-15 handles `EXTRACT(YEAR FROM <expr>)` but the `::int` cast ruins the match because the `::w+` removal on line 23 runs AFTER the EXTRACT replacement (wrong order). By the time the cast is stripped, the EXTRACT pattern has already failed to match.

## Fix

Reorder the pipeline so `::int`/`::cast` syntax is stripped **before** the EXTRACT regex attempts to match the expression.

This is a single-line change in `src/lib/database/query.ts`: move the `::cast` removal rule from its current position (after EXTRACT) to before the EXTRACT replacement.

### Current order (broken):
```
TO_CHAR → EXTRACT → NOW → CURRENT_DATE → ::cast removal
```

### Fixed order:
```
::cast removal → TO_CHAR → EXTRACT → NOW → CURRENT_DATE
```

## Files to Modify

1. `src/lib/database/query.ts` — Reorder `.replace()` chain in `translatePgToSQLite()`

## Verification

1. Navigate to `/reports` in the browser
2. Confirm the page loads without a 500 error
3. Check the terminal — no `SqliteError` should appear
4. Verify monthly chart, category breakdowns, and YoY comparison all render correctly
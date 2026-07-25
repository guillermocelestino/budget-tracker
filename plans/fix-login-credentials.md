# Fix Cannot Login with New Credentials

## Context

The existing SQLite database (`data/budget.db`) still has the old `admin` user. The seed check (`SELECT COUNT(*) FROM users`) finds a non-zero count and skips inserting the new `pangdiin` user. The login page queries for `pangdiin`, finds nothing, and returns "Invalid username or password".

## Fix

Delete the old SQLite database so it gets recreated on next `initDb()` call with the new credentials.

```bash
rm -rf data/budget.db data/budget.db-shm data/budget.db-wal
```

Then restart the dev server — `initDb()` will create a fresh database and seed the new credentials.

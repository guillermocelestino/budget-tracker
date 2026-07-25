# Change Default Admin Credentials

## Context

Change the default seed credentials from `admin`/`admin123` to `pangdiin`/`Pangdiin@123`.

## Change

**File**: `src/lib/database/init.ts` (lines 69 and 72)

```diff
- const hash = hashPassword('admin123');
+ const hash = hashPassword('Pangdiin@123');

- ['admin', hash]
+ ['pangdiin', hash]
```

This only affects the seed data that runs when the `users` table is empty (first deploy). For existing SQLite databases, the old credentials remain — this only applies to new Postgres deployments.

## Verification

Check the file compiles: `npm run build`

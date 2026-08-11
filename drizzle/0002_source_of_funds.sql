-- 0002 — Source of Funds (optional transaction metadata)
--
-- Adds a free-text, nullable `source_of_funds` column to transactions.
--   • NULL (and empty/whitespace, normalized server-side) means "not specified".
--   • Existing rows keep NULL — no backfill, no default value, no auto-assign.
--   • Pure metadata: it is NOT used by any financial calculation (income/expense
--     sums, cash balance, net worth, reports, dashboard, or Money Map).
--   • No `funding_sources` reference table yet (deferred to a later phase).
--
-- Idempotent-ish guard: `ADD COLUMN IF NOT EXISTS` so re-running is a no-op.

ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "source_of_funds" text;

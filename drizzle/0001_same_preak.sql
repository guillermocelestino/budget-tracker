-- 0001 — ONE-TIME DATA BACKFILLS
--
-- Extracted from src/lib/database/init.ts (boot-time migrations that previously
-- ran on EVERY application boot). These now run exactly ONCE, recorded by
-- drizzle-kit migrate. Both statements are idempotent:
--   • the payment backfill has a NOT EXISTS guard,
--   • the status recalculation recomputes the same value (status cache).
-- Applying them to an already-migrated database is a no-op / no-data-change.

-- ── Backfill synthetic payments for legacy status='paid' records ──────────
INSERT INTO "lending_payments" ("lending_id", "user_id", "amount", "payment_date", "notes", "payment_type")
SELECT l.id, l.user_id, l.amount, COALESCE(l.due_date, l.date_lent), 'Migrated', 'payment'
FROM "lendings" l
WHERE l.status = 'paid'
  AND NOT EXISTS (SELECT 1 FROM "lending_payments" p WHERE p.lending_id = l.id);

-- ── Recalculate the lendings status cache ─────────────────────────────────
UPDATE "lendings" SET "status" = 'paid'
WHERE COALESCE(
	(SELECT SUM(p.amount) FROM "lending_payments" p
	 WHERE p.lending_id = "lendings"."id"
	   AND p.payment_type IN ('payment', 'write_off')
	), 0
) >= "lendings"."amount";

UPDATE "lendings" SET "status" = 'active'
WHERE COALESCE(
	(SELECT SUM(p.amount) FROM "lending_payments" p
	 WHERE p.lending_id = "lendings"."id"
	   AND p.payment_type IN ('payment', 'write_off')
	), 0
) < "lendings"."amount";

-- 0000 — BASELINE MIGRATION
--
-- Idempotent, non-destructive representation of the EXISTING PostgreSQL
-- schema (previously created only by src/lib/database/init.ts →
-- POSTGRES_SCHEMA_SQL).
--
-- Baseline strategy (Phase 2.4):
--   • FRESH database  → this file creates the full schema, exactly once.
--   • ALREADY-POPULATED database → every statement is `IF NOT EXISTS` /
--     guarded, so applying it is a NO-OP (tables, columns, constraints and
--     indexes already exist, created by init.ts). No tables are recreated,
--     dropped, or altered; no data is touched.
--
-- Constraint names match PostgreSQL's auto-generated defaults from init.ts's
-- DDL (`{table}_{column}_fkey`, `{table}_{column}_key`, `{table}_{column}_check`),
-- so this migration's resulting state matches the Drizzle snapshot
-- (drizzle/meta/0000_snapshot.json) and future `drizzle-kit generate` diffs
-- stay clean.

CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY,
	"username" text NOT NULL UNIQUE,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "categories" (
	"id" serial PRIMARY KEY,
	"user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"name" text NOT NULL,
	"color" text NOT NULL DEFAULT '#6366f1',
	"icon" text NOT NULL DEFAULT '📁',
	"type" text NOT NULL DEFAULT 'expense',
	"budget_limit" numeric(12, 2),
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	UNIQUE ("user_id", "name")
);

CREATE TABLE IF NOT EXISTS "transactions" (
	"id" serial PRIMARY KEY,
	"user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"amount" numeric(12, 2) NOT NULL,
	"description" text NOT NULL,
	"date" date NOT NULL,
	"category_id" integer NOT NULL REFERENCES "categories"("id") ON DELETE RESTRICT,
	"type" text NOT NULL CHECK ("type" IN ('income', 'expense')),
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "lendings" (
	"id" serial PRIMARY KEY,
	"user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"borrower_name" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"interest_rate" numeric(5, 2) DEFAULT 0,
	"date_lent" date NOT NULL,
	"due_date" date,
	"status" text NOT NULL DEFAULT 'active',
	"notes" text,
	"direction" text NOT NULL DEFAULT 'lent' CHECK ("direction" IN ('lent', 'borrowed')),
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "recurring_transactions" (
	"id" serial PRIMARY KEY,
	"user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"type" text NOT NULL CHECK ("type" IN ('income', 'expense')),
	"amount" numeric(12, 2) NOT NULL,
	"description" text NOT NULL,
	"category_id" integer NOT NULL REFERENCES "categories"("id") ON DELETE RESTRICT,
	"frequency" text NOT NULL CHECK ("frequency" IN ('daily', 'weekly', 'monthly', 'yearly')),
	"interval" integer NOT NULL DEFAULT 1,
	"day_of_week" integer CHECK ("day_of_week" BETWEEN 0 AND 6),
	"day_of_month" integer CHECK ("day_of_month" BETWEEN 1 AND 31),
	"month_of_year" integer CHECK ("month_of_year" BETWEEN 1 AND 12),
	"start_date" date NOT NULL,
	"end_date" date,
	"next_run" date NOT NULL,
	"last_generated_at" timestamp with time zone,
	"active" boolean NOT NULL DEFAULT TRUE,
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "lending_payments" (
	"id" serial PRIMARY KEY,
	"lending_id" integer NOT NULL REFERENCES "lendings"("id") ON DELETE CASCADE,
	"user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"amount" numeric(12, 2) NOT NULL,
	"payment_date" date NOT NULL,
	"notes" text,
	"transaction_id" integer REFERENCES "transactions"("id") ON DELETE SET NULL,
	"payment_type" text NOT NULL DEFAULT 'payment' CHECK ("payment_type" IN ('payment', 'write_off')),
	"reference" text,
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_recurring_transactions_user_id" ON "recurring_transactions" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_recurring_transactions_next_run" ON "recurring_transactions" ("next_run");
CREATE INDEX IF NOT EXISTS "idx_recurring_transactions_active" ON "recurring_transactions" ("active");

CREATE INDEX IF NOT EXISTS "idx_categories_user_id" ON "categories" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_transactions_user_id" ON "transactions" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_transactions_date" ON "transactions" ("date" DESC);
CREATE INDEX IF NOT EXISTS "idx_transactions_category" ON "transactions" ("category_id");
CREATE INDEX IF NOT EXISTS "idx_transactions_type" ON "transactions" ("type");

CREATE INDEX IF NOT EXISTS "idx_lendings_user_id" ON "lendings" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_lendings_status" ON "lendings" ("status");

CREATE INDEX IF NOT EXISTS "idx_lending_payments_lending_id" ON "lending_payments" ("lending_id");
CREATE INDEX IF NOT EXISTS "idx_lending_payments_user_id" ON "lending_payments" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_lending_payments_payment_date" ON "lending_payments" ("payment_date" DESC);

-- Legacy guard: databases created BEFORE the `direction` column existed got it
-- added by an inline init.ts migration. Ensure the column + its CHECK exist no
-- matter how this database was created (no-op when already present).
ALTER TABLE "lendings" ADD COLUMN IF NOT EXISTS "direction" text NOT NULL DEFAULT 'lent';
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'lendings_direction_check'
		  AND conrelid = 'lendings'::regclass
	) THEN
		ALTER TABLE "lendings" ADD CONSTRAINT "lendings_direction_check"
			CHECK ("direction" IN ('lent', 'borrowed'));
	END IF;
END $$;

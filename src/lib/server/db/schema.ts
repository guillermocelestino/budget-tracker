/**
 * Drizzle schema — faithful representation of the EXISTING PostgreSQL schema
 * (see src/lib/database/init.ts → POSTGRES_SCHEMA_SQL).
 *
 * Rules honored here:
 *  - No redesign: same table names, column names, types, defaults, and order.
 *  - No renaming: snake_case kept verbatim (drizzle-kit `casing: 'snake_case'`).
 *  - enum/CHECK behavior preserved: columns are `text` + named `check()`
 *    constraints (NOT Postgres enum types), exactly like the live schema.
 *  - Constraint names match what PostgreSQL auto-generates from init.ts's DDL
 *    (FK `{table}_{column}_fkey`, unique `{table}_{columns}_key`, check
 *    `{table}_{column}_check`) so the Drizzle snapshot and the live schema agree
 *    and future generated migrations never fight over names.
 *  - This file is the source of truth for drizzle-kit `generate` (schema diffs)
 *    and future migrations. It is NOT used by the app's runtime query layer yet.
 *
 * The app still queries through src/lib/database/query.ts (raw SQL).
 */
import { sql } from 'drizzle-orm';
import {
	boolean,
	check,
	date,
	foreignKey,
	index,
	integer,
	numeric,
	pgTable,
	serial,
	text,
	timestamp,
	unique,
} from 'drizzle-orm/pg-core';

// ─── users ────────────────────────────────────────────────────────────────
export const users = pgTable(
	'users',
	{
		id: serial('id').primaryKey(),
		username: text('username').notNull(),
		password_hash: text('password_hash').notNull(),
		created_at: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
	},
	(table) => [unique('users_username_key').on(table.username)]
);

// ─── categories ───────────────────────────────────────────────────────────
export const categories = pgTable(
	'categories',
	{
		id: serial('id').primaryKey(),
		user_id: integer('user_id').notNull(),
		name: text('name').notNull(),
		color: text('color').notNull().default('#6366f1'),
		icon: text('icon').notNull().default('📁'),
		type: text('type').notNull().default('expense'),
		budget_limit: numeric('budget_limit', { precision: 12, scale: 2 }),
		created_at: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
	},
	(table) => [
		unique('categories_user_id_name_key').on(table.user_id, table.name),
		index('idx_categories_user_id').on(table.user_id),
		foreignKey({
			name: 'categories_user_id_fkey',
			columns: [table.user_id],
			foreignColumns: [users.id],
		}).onDelete('cascade'),
	]
);

// ─── transactions ─────────────────────────────────────────────────────────
export const transactions = pgTable(
	'transactions',
	{
		id: serial('id').primaryKey(),
		user_id: integer('user_id').notNull(),
		amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
		description: text('description').notNull(),
		date: date('date', { mode: 'string' }).notNull(),
		category_id: integer('category_id').notNull(),
		type: text('type').notNull(),
		source_of_funds: text('source_of_funds'),
		created_at: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
		updated_at: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
	},
	(table) => [
		check('transactions_type_check', sql`${table.type} IN ('income', 'expense')`),
		index('idx_transactions_user_id').on(table.user_id),
		index('idx_transactions_date').on(table.date.desc()),
		index('idx_transactions_category').on(table.category_id),
		index('idx_transactions_type').on(table.type),
		foreignKey({
			name: 'transactions_user_id_fkey',
			columns: [table.user_id],
			foreignColumns: [users.id],
		}).onDelete('cascade'),
		foreignKey({
			name: 'transactions_category_id_fkey',
			columns: [table.category_id],
			foreignColumns: [categories.id],
		}).onDelete('restrict'),
	]
);

// ─── lendings ─────────────────────────────────────────────────────────────
export const lendings = pgTable(
	'lendings',
	{
		id: serial('id').primaryKey(),
		user_id: integer('user_id').notNull(),
		borrower_name: text('borrower_name').notNull(),
		amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
		interest_rate: numeric('interest_rate', { precision: 5, scale: 2 }).default('0'),
		date_lent: date('date_lent', { mode: 'string' }).notNull(),
		due_date: date('due_date', { mode: 'string' }),
		status: text('status').notNull().default('active'),
		notes: text('notes'),
		direction: text('direction').notNull().default('lent'),
		created_at: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
		updated_at: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
	},
	(table) => [
		check('lendings_direction_check', sql`${table.direction} IN ('lent', 'borrowed')`),
		index('idx_lendings_user_id').on(table.user_id),
		index('idx_lendings_status').on(table.status),
		foreignKey({
			name: 'lendings_user_id_fkey',
			columns: [table.user_id],
			foreignColumns: [users.id],
		}).onDelete('cascade'),
	]
);

// ─── recurring_transactions ───────────────────────────────────────────────
export const recurringTransactions = pgTable(
	'recurring_transactions',
	{
		id: serial('id').primaryKey(),
		user_id: integer('user_id').notNull(),
		type: text('type').notNull(),
		amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
		description: text('description').notNull(),
		category_id: integer('category_id').notNull(),
		frequency: text('frequency').notNull(),
		interval: integer('interval').notNull().default(1),
		day_of_week: integer('day_of_week'),
		day_of_month: integer('day_of_month'),
		month_of_year: integer('month_of_year'),
		start_date: date('start_date', { mode: 'string' }).notNull(),
		end_date: date('end_date', { mode: 'string' }),
		next_run: date('next_run', { mode: 'string' }).notNull(),
		last_generated_at: timestamp('last_generated_at', { withTimezone: true, mode: 'date' }),
		active: boolean('active').notNull().default(true),
		created_at: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
		updated_at: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
	},
	(table) => [
		check('recurring_transactions_type_check', sql`${table.type} IN ('income', 'expense')`),
		check(
			'recurring_transactions_frequency_check',
			sql`${table.frequency} IN ('daily', 'weekly', 'monthly', 'yearly')`
		),
		check('recurring_transactions_day_of_week_check', sql`${table.day_of_week} BETWEEN 0 AND 6`),
		check('recurring_transactions_day_of_month_check', sql`${table.day_of_month} BETWEEN 1 AND 31`),
		check('recurring_transactions_month_of_year_check', sql`${table.month_of_year} BETWEEN 1 AND 12`),
		index('idx_recurring_transactions_user_id').on(table.user_id),
		index('idx_recurring_transactions_next_run').on(table.next_run),
		index('idx_recurring_transactions_active').on(table.active),
		foreignKey({
			name: 'recurring_transactions_user_id_fkey',
			columns: [table.user_id],
			foreignColumns: [users.id],
		}).onDelete('cascade'),
		foreignKey({
			name: 'recurring_transactions_category_id_fkey',
			columns: [table.category_id],
			foreignColumns: [categories.id],
		}).onDelete('restrict'),
	]
);

// ─── lending_payments ─────────────────────────────────────────────────────
export const lendingPayments = pgTable(
	'lending_payments',
	{
		id: serial('id').primaryKey(),
		lending_id: integer('lending_id').notNull(),
		user_id: integer('user_id').notNull(),
		amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
		payment_date: date('payment_date', { mode: 'string' }).notNull(),
		notes: text('notes'),
		transaction_id: integer('transaction_id'),
		payment_type: text('payment_type').notNull().default('payment'),
		reference: text('reference'),
		created_at: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
		updated_at: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
	},
	(table) => [
		check(
			'lending_payments_payment_type_check',
			sql`${table.payment_type} IN ('payment', 'write_off')`
		),
		index('idx_lending_payments_lending_id').on(table.lending_id),
		index('idx_lending_payments_user_id').on(table.user_id),
		index('idx_lending_payments_payment_date').on(table.payment_date.desc()),
		foreignKey({
			name: 'lending_payments_lending_id_fkey',
			columns: [table.lending_id],
			foreignColumns: [lendings.id],
		}).onDelete('cascade'),
		foreignKey({
			name: 'lending_payments_user_id_fkey',
			columns: [table.user_id],
			foreignColumns: [users.id],
		}).onDelete('cascade'),
		foreignKey({
			name: 'lending_payments_transaction_id_fkey',
			columns: [table.transaction_id],
			foreignColumns: [transactions.id],
		}).onDelete('set null'),
	]
);

import { getDrizzle } from '$lib/server/db/drizzle';
import { categories, recurringTransactions } from '$lib/server/db/schema';
import { and, eq, asc, gte, lte, or, ilike, sql, inArray } from 'drizzle-orm';
import type { RecurringTransaction, RecurringFrequency, TransactionType } from '$lib/types';
import { calculateNextRun } from '$lib/shared/utils/recurring';

/**
 * Input shape for creating or updating a recurring transaction.
 * Shared by the API endpoints and SvelteKit form actions.
 */
export interface RecurringInput {
	type: TransactionType;
	amount: number;
	description: string;
	category_id: number;
	frequency: RecurringFrequency;
	interval: number;
	day_of_week: number | null;
	day_of_month: number | null;
	month_of_year: number | null;
	start_date: string;
	end_date: string | null;
	active: boolean;
}

export interface RecurringResult {
	success: boolean;
	error?: string;
	errors?: Record<string, string>;
	id?: number;
}

/**
 * Validate recurring input fields.
 * Returns an object with `errors` if validation fails, or `undefined` if valid.
 */
function validateInput(input: RecurringInput): Record<string, string> | undefined {
	const errors: Record<string, string> = {};

	if (!input.type || !['income', 'expense'].includes(input.type)) {
		errors.type = 'Select a type';
	}
	if (!input.amount || isNaN(input.amount) || input.amount === 0) {
		errors.amount = 'Enter a valid amount';
	}
	if (!input.description || input.description.trim().length === 0) {
		errors.description = 'Enter a description';
	}
	if (!input.category_id || isNaN(input.category_id)) {
		errors.category_id = 'Select a category';
	}
	if (!input.frequency || !['daily', 'weekly', 'monthly', 'yearly'].includes(input.frequency)) {
		errors.frequency = 'Select a frequency';
	}
	if (input.interval < 1) {
		errors.interval = 'Interval must be at least 1';
	}
	if (!input.start_date) {
		errors.start_date = 'Select a start date';
	}

	return Object.keys(errors).length > 0 ? errors : undefined;
}

/**
 * The subset of a recurring-transaction row that the update flow reads.
 * Both the raw SQL path (`RecurringTransaction`) and the Drizzle path
 * (`$inferSelect`) satisfy this shape, so the shared scheduling logic below
 * never needs to know which backend produced the row.
 */
interface RecurringRow {
	frequency: string;
	interval: number;
	start_date: string;
	day_of_week: number | null;
	day_of_month: number | null;
	month_of_year: number | null;
	next_run: string;
}

/**
 * Verify that a category belongs to the authenticated user.
 */
async function verifyCategoryOwnership(userId: number, categoryId: number): Promise<boolean> {
	const db = await getDrizzle();
	const rows = await db
		.select({ id: categories.id })
		.from(categories)
		.where(and(eq(categories.user_id, userId), eq(categories.id, categoryId)));
	return rows.length > 0;
}

/**
 * Insert a new recurring transaction.
 * `created_at`/`updated_at` are omitted and filled by the schema's
 * `default now()`.
 */
async function insertRecurring(userId: number, input: RecurringInput, next_run: string): Promise<void> {
	const db = await getDrizzle();
	await db.insert(recurringTransactions).values({
		user_id: userId,
		type: input.type,
		// Drizzle types numeric columns as string; PG stores the identical value.
		amount: String(input.amount),
		description: input.description.trim(),
		category_id: input.category_id,
		frequency: input.frequency,
		interval: input.interval,
		day_of_week: input.day_of_week,
		day_of_month: input.day_of_month,
		month_of_year: input.month_of_year,
		start_date: input.start_date,
		end_date: input.end_date || null,
		next_run,
		active: input.active
	});
}

/**
 * Fetch an existing recurring transaction owned by the user.
 */
async function fetchRecurring(id: number, userId: number): Promise<RecurringRow | undefined> {
	const db = await getDrizzle();
	const rows = await db
		.select()
		.from(recurringTransactions)
		.where(and(eq(recurringTransactions.id, id), eq(recurringTransactions.user_id, userId)));
	return rows[0];
}

/**
 * Update an existing recurring transaction.
 * `updated_at` is set to `new Date()`.
 */
async function updateRecurring(
	id: number,
	userId: number,
	input: RecurringInput,
	next_run: string
): Promise<void> {
	const db = await getDrizzle();
	await db
		.update(recurringTransactions)
		.set({
			type: input.type,
			// Drizzle types numeric columns as string; PG stores the identical value.
			amount: String(input.amount),
			description: input.description.trim(),
			category_id: input.category_id,
			frequency: input.frequency,
			interval: input.interval,
			day_of_week: input.day_of_week,
			day_of_month: input.day_of_month,
			month_of_year: input.month_of_year,
			start_date: input.start_date,
			end_date: input.end_date || null,
			next_run,
			active: input.active,
			updated_at: new Date()
		})
		.where(and(eq(recurringTransactions.id, id), eq(recurringTransactions.user_id, userId)));
}

/**
 * Create a new recurring transaction.
 * Shared by the API POST handler and SvelteKit form actions.
 */
export async function createRecurringTransaction(
	userId: number,
	input: RecurringInput
): Promise<RecurringResult> {
	const errors = validateInput(input);
	if (errors) {
		return { success: false, errors };
	}

	// Verify category ownership
	const ownsCategory = await verifyCategoryOwnership(userId, input.category_id);
	if (!ownsCategory) {
		return { success: false, error: 'Category not found' };
	}

	// Calculate next_run from start_date
	const next_run = calculateNextRun(
		input.start_date,
		input.frequency,
		input.interval,
		input.day_of_week,
		input.day_of_month,
		input.month_of_year,
		input.start_date
	);

	await insertRecurring(userId, input, next_run);

	return { success: true };
}

/**
 * Update an existing recurring transaction.
 * Shared by the API PUT handler and SvelteKit form actions.
 *
 * next_run is recalculated ONLY when scheduling fields change:
 *   frequency, interval, start_date, day_of_week, day_of_month, month_of_year
 * Changing description, amount, category_id, active, or end_date does NOT
 * shift the schedule.
 */
export async function updateRecurringTransaction(
	userId: number,
	id: number,
	input: RecurringInput
): Promise<RecurringResult> {
	const errors = validateInput(input);
	if (errors) {
		return { success: false, errors };
	}

	// Fetch existing recurring transaction
	const current = await fetchRecurring(id, userId);

	if (!current) {
		return { success: false, error: 'Recurring transaction not found' };
	}

	// Verify category ownership
	const ownsCategory = await verifyCategoryOwnership(userId, input.category_id);
	if (!ownsCategory) {
		return { success: false, error: 'Category not found' };
	}

	// Determine if any scheduling fields changed
	const scheduleChanged =
		current.frequency !== input.frequency ||
		current.interval !== input.interval ||
		current.start_date !== input.start_date ||
		current.day_of_week !== input.day_of_week ||
		current.day_of_month !== input.day_of_month ||
		current.month_of_year !== input.month_of_year;

	// Only recalculate next_run if scheduling fields changed;
	// otherwise preserve the existing next_run exactly
	const next_run = scheduleChanged
		? calculateNextRun(
				input.start_date,
				input.frequency,
				input.interval,
				input.day_of_week,
				input.day_of_month,
				input.month_of_year,
				input.start_date
			)
		: current.next_run;

	await updateRecurring(id, userId, input, next_run);

	return { success: true };
}

/** Raw row shape for recurring transaction queries with category join. */
interface RecurringRowWithCategory {
	id: number;
	user_id: number;
	type: string;
	amount: string | number;
	description: string;
	category_id: number;
	frequency: string;
	interval: number;
	day_of_week: number | null;
	day_of_month: number | null;
	month_of_year: number | null;
	start_date: string;
	end_date: string | null;
	next_run: string;
	last_generated_at: Date | string | null;
	active: boolean;
	created_at: Date | string;
	updated_at: Date | string;
	category_name: string | null;
	category_color: string | null;
}

/** Map a raw recurring row (with category join) to the RecurringTransaction type. */
function mapRecurringRow(row: RecurringRowWithCategory): RecurringTransaction {
	const toISO = (val: Date | string | null): string | null => {
		if (val === null || val === undefined) return null;
		return val instanceof Date ? val.toISOString() : String(val);
	};
	const toISORequired = (val: Date | string): string =>
		val instanceof Date ? val.toISOString() : String(val);

	return {
		id: row.id,
		user_id: row.user_id,
		type: row.type as TransactionType,
		amount: parseFloat(String(row.amount)),
		description: row.description,
		category_id: row.category_id,
		frequency: row.frequency as RecurringFrequency,
		interval: row.interval,
		day_of_week: row.day_of_week,
		day_of_month: row.day_of_month,
		month_of_year: row.month_of_year,
		start_date: row.start_date,
		end_date: row.end_date,
		next_run: row.next_run,
		last_generated_at: toISO(row.last_generated_at),
		active: row.active,
		created_at: toISORequired(row.created_at),
		updated_at: toISORequired(row.updated_at),
		category_name: row.category_name ?? undefined,
		category_color: row.category_color ?? undefined,
	};
}

/** Filters for listing recurring transactions. */
export interface RecurringFilters {
	search?: string;
	type?: 'income' | 'expense';
	frequency?: 'daily' | 'weekly' | 'monthly' | 'yearly';
	status?: 'active' | 'paused';
	category_id?: number;
}

/**
 * List recurring transactions for a user with optional filters and pagination.
 * Neon/Postgres → Drizzle; SQLite → the raw query layer (unchanged).
 */
export async function listRecurringTransactions(
	userId: number,
	filters: RecurringFilters = {},
	page = 1,
	limit?: number
): Promise<{ items: RecurringTransaction[]; total: number; page: number; totalPages: number }> {
	const shouldPaginate = limit !== undefined && limit > 0;
	const safePage = Math.max(1, page);
	const safeLimit = shouldPaginate ? Math.max(1, limit) : 20;

	const db = await getDrizzle();
	const conditions = [eq(recurringTransactions.user_id, userId)];

	if (filters.type && (filters.type === 'income' || filters.type === 'expense')) {
		conditions.push(eq(recurringTransactions.type, filters.type));
	}
	if (filters.frequency && ['daily', 'weekly', 'monthly', 'yearly'].includes(filters.frequency)) {
		conditions.push(eq(recurringTransactions.frequency, filters.frequency));
	}
	if (filters.status === 'active') {
		conditions.push(eq(recurringTransactions.active, true));
	} else if (filters.status === 'paused') {
		conditions.push(eq(recurringTransactions.active, false));
	}
	if (filters.category_id) {
		conditions.push(eq(recurringTransactions.category_id, filters.category_id));
	}
	if (filters.search && filters.search.trim()) {
		const like = `%${filters.search.trim()}%`;
		conditions.push(
			or(
				ilike(recurringTransactions.description, like),
				ilike(categories.name, like)
			)!
		);
	}

	const where = and(...conditions);

	const [{ count }] = await db
		.select({ count: sql<number>`count(*)` })
		.from(recurringTransactions)
		.leftJoin(categories, eq(recurringTransactions.category_id, categories.id))
		.where(where);

	const total = Number(count);
	const totalPages = shouldPaginate ? Math.ceil(total / safeLimit) : (total > 0 ? 1 : 0);
	const safePageClamped = shouldPaginate ? Math.max(1, Math.min(safePage, totalPages || 1)) : 1;
	const offsetClamped = (safePageClamped - 1) * safeLimit;

	const baseQuery = db
		.select({
			id: recurringTransactions.id,
			user_id: recurringTransactions.user_id,
			type: recurringTransactions.type,
			amount: recurringTransactions.amount,
			description: recurringTransactions.description,
			category_id: recurringTransactions.category_id,
			frequency: recurringTransactions.frequency,
			interval: recurringTransactions.interval,
			day_of_week: recurringTransactions.day_of_week,
			day_of_month: recurringTransactions.day_of_month,
			month_of_year: recurringTransactions.month_of_year,
			start_date: recurringTransactions.start_date,
			end_date: recurringTransactions.end_date,
			next_run: recurringTransactions.next_run,
			last_generated_at: recurringTransactions.last_generated_at,
			active: recurringTransactions.active,
			created_at: recurringTransactions.created_at,
			updated_at: recurringTransactions.updated_at,
			category_name: categories.name,
			category_color: categories.color,
		})
		.from(recurringTransactions)
		.leftJoin(categories, eq(recurringTransactions.category_id, categories.id))
		.where(where)
		.orderBy(asc(recurringTransactions.next_run), asc(recurringTransactions.id));

	const rows = shouldPaginate
		? await baseQuery.limit(safeLimit).offset(offsetClamped)
		: await baseQuery;

	return {
		items: rows.map((r) => mapRecurringRow(r as unknown as RecurringRowWithCategory)),
		total,
		page: safePageClamped,
		totalPages,
	};
}

/**
 * Get the count of active recurring transactions for a user.
 * Neon/Postgres → Drizzle; SQLite → the raw query layer (unchanged).
 */
export async function getActiveRecurringCount(userId: number): Promise<number> {
	const db = await getDrizzle();
	const [{ count }] = await db
		.select({ count: sql<number>`count(*)` })
		.from(recurringTransactions)
		.where(and(eq(recurringTransactions.user_id, userId), eq(recurringTransactions.active, true)));
	return Number(count);
}

/**
 * Get a single recurring transaction by ID with category join, verifying ownership.
 * Returns null if not found or not owned by the user.
 * Neon/Postgres → Drizzle; SQLite → the raw query layer (unchanged).
 */
export async function getRecurringById(
	userId: number,
	id: number
): Promise<RecurringTransaction | null> {
	const db = await getDrizzle();
	const rows = await db
		.select({
			id: recurringTransactions.id,
			user_id: recurringTransactions.user_id,
			type: recurringTransactions.type,
			amount: recurringTransactions.amount,
			description: recurringTransactions.description,
			category_id: recurringTransactions.category_id,
			frequency: recurringTransactions.frequency,
			interval: recurringTransactions.interval,
			day_of_week: recurringTransactions.day_of_week,
			day_of_month: recurringTransactions.day_of_month,
			month_of_year: recurringTransactions.month_of_year,
			start_date: recurringTransactions.start_date,
			end_date: recurringTransactions.end_date,
			next_run: recurringTransactions.next_run,
			last_generated_at: recurringTransactions.last_generated_at,
			active: recurringTransactions.active,
			created_at: recurringTransactions.created_at,
			updated_at: recurringTransactions.updated_at,
			category_name: categories.name,
			category_color: categories.color,
		})
		.from(recurringTransactions)
		.leftJoin(categories, eq(recurringTransactions.category_id, categories.id))
		.where(and(eq(recurringTransactions.user_id, userId), eq(recurringTransactions.id, id)))
		.limit(1);

	return rows.length > 0 ? mapRecurringRow(rows[0] as unknown as RecurringRowWithCategory) : null;
}

/**
 * Delete a recurring transaction owned by the user.
 * Returns true if a row was deleted, false if none matched (not found).
 * Neon/Postgres → Drizzle; SQLite → the raw query layer (unchanged).
 */
export async function deleteRecurringTransaction(userId: number, id: number): Promise<boolean> {
	const db = await getDrizzle();
	const result = await db
		.delete(recurringTransactions)
		.where(and(eq(recurringTransactions.user_id, userId), eq(recurringTransactions.id, id)))
		.returning({ id: recurringTransactions.id });
	return result.length > 0;
}

/**
 * Bulk-delete multiple recurring transaction rules atomically.
 *
 * Validates that every requested ID belongs to the authenticated user BEFORE
 * any destructive mutation. If any ID is unknown or belongs to another user,
 * the entire operation is rejected and nothing is deleted.
 *
 * CRITICAL: Only the `recurring_transactions` rules are deleted.
 * Already-generated historical rows in the `transactions` table are NOT
 * touched — identical to the single-record delete behaviour.
 *
 * Returns the number of rules actually deleted.
 */
export async function deleteRecurringTransactions(userId: number, ids: number[]): Promise<number> {
	if (ids.length === 0) return 0;

	const db = await getDrizzle();
	return db.transaction(async (tx) => {
		// ── 1. Ownership validation ──────────────────────────────────────────
		// Fetch which of the requested IDs actually exist and belong to this user.
		const ownedRows = await tx
			.select({ id: recurringTransactions.id })
			.from(recurringTransactions)
			.where(and(eq(recurringTransactions.user_id, userId), inArray(recurringTransactions.id, ids)));

		const ownedIds = new Set(ownedRows.map((r) => r.id));

		// Reject the entire operation if any ID is unknown / belongs to another user.
		const allOwned = ids.every((id) => ownedIds.has(id));
		if (!allOwned) {
			throw new Error('One or more recurring transaction IDs are invalid or do not belong to this user');
		}

		// ── 2. Atomic bulk delete ────────────────────────────────────────────
		const deleted = await tx
			.delete(recurringTransactions)
			.where(and(eq(recurringTransactions.user_id, userId), inArray(recurringTransactions.id, ids)))
			.returning({ id: recurringTransactions.id });

		return deleted.length;
	});
}

/** Raw row shape for the upcoming-recurring (dashboard teaser) query. */
interface UpcomingRecurringRow {
	id: number;
	user_id: number;
	type: string;
	amount: string | number;
	description: string;
	category_id: number;
	frequency: string;
	interval: number;
	day_of_week: number | null;
	day_of_month: number | null;
	month_of_year: number | null;
	start_date: string;
	end_date: string | null;
	next_run: string;
	last_generated_at: Date | string | null;
	active: boolean;
	created_at: Date | string;
	updated_at: Date | string;
	category_name: string | null;
	category_color: string | null;
}

/** Map a raw upcoming-recurring row to the RecurringTransaction shape the dashboard expects. */
function mapUpcomingRow(row: UpcomingRecurringRow): RecurringTransaction {
	const toISO = (val: Date | string | null): string | null => {
		if (val === null || val === undefined) return null;
		return val instanceof Date ? val.toISOString() : String(val);
	};
	const toISORequired = (val: Date | string): string =>
		val instanceof Date ? val.toISOString() : String(val);

	return {
		id: row.id,
		user_id: row.user_id,
		type: row.type as TransactionType,
		amount: parseFloat(String(row.amount)),
		description: row.description,
		category_id: row.category_id,
		frequency: row.frequency as RecurringFrequency,
		interval: row.interval,
		day_of_week: row.day_of_week,
		day_of_month: row.day_of_month,
		month_of_year: row.month_of_year,
		start_date: row.start_date,
		end_date: row.end_date,
		next_run: row.next_run,
		last_generated_at: toISO(row.last_generated_at),
		active: row.active,
		created_at: toISORequired(row.created_at),
		updated_at: toISORequired(row.updated_at),
		category_name: row.category_name ?? undefined,
		category_color: row.category_color ?? undefined,
	};
}

/**
 * Get the next `limit` active recurring transactions for a user, ordered by
 * next_run ascending, with category join. Used by the dashboard teaser.
 * Neon/Postgres → Drizzle; SQLite → the raw query layer (unchanged).
 */
export async function getUpcomingRecurring(
	userId: number,
	limit: number
): Promise<RecurringTransaction[]> {
	const today = new Date().toISOString().split('T')[0];

	const db = await getDrizzle();
	const rows = await db
		.select({
			id: recurringTransactions.id,
			user_id: recurringTransactions.user_id,
			type: recurringTransactions.type,
			amount: recurringTransactions.amount,
			description: recurringTransactions.description,
			category_id: recurringTransactions.category_id,
			frequency: recurringTransactions.frequency,
			interval: recurringTransactions.interval,
			day_of_week: recurringTransactions.day_of_week,
			day_of_month: recurringTransactions.day_of_month,
			month_of_year: recurringTransactions.month_of_year,
			start_date: recurringTransactions.start_date,
			end_date: recurringTransactions.end_date,
			next_run: recurringTransactions.next_run,
			last_generated_at: recurringTransactions.last_generated_at,
			active: recurringTransactions.active,
			created_at: recurringTransactions.created_at,
			updated_at: recurringTransactions.updated_at,
			category_name: categories.name,
			category_color: categories.color,
		})
		.from(recurringTransactions)
		.leftJoin(categories, eq(recurringTransactions.category_id, categories.id))
		.where(and(
			eq(recurringTransactions.user_id, userId),
			eq(recurringTransactions.active, true),
			gte(recurringTransactions.next_run, today)
		))
		.orderBy(asc(recurringTransactions.next_run))
		.limit(limit);

	return rows.map((r) => mapUpcomingRow(r as unknown as UpcomingRecurringRow));
}

/**
 * Calculate total upcoming expense commitments due within an inclusive date window [today, today + days].
 */
export async function getUpcomingCommitmentsTotal(
	userId: number,
	days: number,
	todayStr?: string
): Promise<number> {
	const start = todayStr || new Date().toISOString().split('T')[0];
	const startDate = new Date(start + 'T00:00:00');
	const endDate = new Date(startDate.getTime() + days * 86400000);
	const end = endDate.toISOString().split('T')[0];

	const db = await getDrizzle();
	const [row] = await db
		.select({
			total: sql<string>`COALESCE(SUM(${recurringTransactions.amount}), 0)`
		})
		.from(recurringTransactions)
		.where(and(
			eq(recurringTransactions.user_id, userId),
			eq(recurringTransactions.active, true),
			eq(recurringTransactions.type, 'expense'),
			gte(recurringTransactions.next_run, start),
			lte(recurringTransactions.next_run, end)
		));

	return parseFloat(row?.total ?? '0');
}

/**
 * Calculate the monthly equivalent expense total of all active recurring rules for a user.
 */
export async function getMonthlyCommittedTotal(userId: number): Promise<number> {
	const db = await getDrizzle();
	const rows = await db
		.select({
			amount: recurringTransactions.amount,
			frequency: recurringTransactions.frequency,
			interval: recurringTransactions.interval,
		})
		.from(recurringTransactions)
		.where(and(
			eq(recurringTransactions.user_id, userId),
			eq(recurringTransactions.active, true),
			eq(recurringTransactions.type, 'expense')
		));

	let sum = 0;
	for (const r of rows) {
		const amt = parseFloat(String(r.amount));
		const interval = Math.max(1, r.interval || 1);
		switch (r.frequency) {
			case 'daily':
				sum += (amt * 30) / interval;
				break;
			case 'weekly':
				sum += (amt * (52 / 12)) / interval;
				break;
			case 'monthly':
				sum += amt / interval;
				break;
			case 'yearly':
				sum += (amt / 12) / interval;
				break;
		}
	}
	return sum;
}

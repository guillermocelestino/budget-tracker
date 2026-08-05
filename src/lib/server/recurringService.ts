import { queryOne, execute } from '$lib/database/query';
import type { RecurringTransaction, RecurringFrequency, TransactionType } from '$lib/types';
import { calculateNextRun } from '$lib/utils/recurring';

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
 * Verify that a category belongs to the authenticated user.
 */
async function verifyCategoryOwnership(userId: number, categoryId: number): Promise<boolean> {
	const category = await queryOne<{ id: number }>(
		'SELECT id FROM categories WHERE user_id = $1 AND id = $2',
		[userId, categoryId]
	);
	return !!category;
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

	await execute(
		`INSERT INTO recurring_transactions
		 (user_id, type, amount, description, category_id, frequency, interval, day_of_week, day_of_month, month_of_year, start_date, end_date, next_run, active, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())`,
		[
			userId,
			input.type,
			input.amount,
			input.description.trim(),
			input.category_id,
			input.frequency,
			input.interval,
			input.day_of_week,
			input.day_of_month,
			input.month_of_year,
			input.start_date,
			input.end_date || null,
			next_run,
			input.active ? 1 : 0
		]
	);

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
	const current = await queryOne<RecurringTransaction>(
		`SELECT * FROM recurring_transactions WHERE id = $1 AND user_id = $2`,
		[id, userId]
	);

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

	await execute(
		`UPDATE recurring_transactions
		 SET type = $1, amount = $2, description = $3, category_id = $4,
			 frequency = $5, interval = $6, day_of_week = $7, day_of_month = $8,
			 month_of_year = $9, start_date = $10, end_date = $11,
			 next_run = $12, active = $13, updated_at = NOW()
		 WHERE id = $14 AND user_id = $15`,
		[
			input.type,
			input.amount,
			input.description.trim(),
			input.category_id,
			input.frequency,
			input.interval,
			input.day_of_week,
			input.day_of_month,
			input.month_of_year,
			input.start_date,
			input.end_date || null,
			next_run,
			input.active ? 1 : 0,
			id,
			userId
		]
	);

	return { success: true };
}
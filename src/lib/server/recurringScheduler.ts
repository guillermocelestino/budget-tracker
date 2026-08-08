import { queryMany, execute, queryOne } from '$lib/database/query';
import { usePostgres } from '$lib/database';
import { getDrizzle } from '$lib/database/drizzle';
import { recurringTransactions, transactions } from '$lib/database/schema';
import { and, eq, lte, gte, or, isNull, asc } from 'drizzle-orm';
import type { RecurringTransaction } from '$lib/types';
import { calculateNextRun, generatePreview } from '$lib/utils/recurring';
import { getToday } from '$lib/utils/format';

/**
 * Parse a YYYY-MM-DD date string into a local Date object.
 * Avoids the UTC-parsing pitfall of `new Date('YYYY-MM-DD')`.
 */
function parseDateLocal(dateStr: string): Date {
	const [y, m, d] = dateStr.split('-').map(Number);
	return new Date(y, m - 1, d);
}

/**
 * Check if a recurring transaction should be processed today
 */
function shouldProcess(recurring: RecurringTransaction, today: string): boolean {
	if (!recurring.active) return false;

	const nextRun = parseDateLocal(recurring.next_run);
	const todayDate = parseDateLocal(today);
	nextRun.setHours(0, 0, 0, 0);
	todayDate.setHours(0, 0, 0, 0);

	if (nextRun > todayDate) return false;

	// Check end date
	if (recurring.end_date) {
		const endDate = parseDateLocal(recurring.end_date);
		endDate.setHours(0, 0, 0, 0);
		if (todayDate > endDate) return false;
	}

	return true;
}

/**
 * Process all due recurring transactions for a user
 * Returns the number of transactions generated
 */
export async function processRecurringTransactions(userId: number): Promise<number> {
	const today = getToday();

	if (usePostgres) {
		const db = await getDrizzle();

		// Find active recurring transactions that are due
		const dueRecurring = await db
			.select()
			.from(recurringTransactions)
			.where(and(
				eq(recurringTransactions.user_id, userId),
				eq(recurringTransactions.active, true),
				lte(recurringTransactions.next_run, today),
				or(isNull(recurringTransactions.end_date), gte(recurringTransactions.end_date, today))
			))
			.orderBy(asc(recurringTransactions.next_run));

		if (dueRecurring.length === 0) {
			return 0;
		}

		let generated = 0;

		for (const recurring of dueRecurring) {
			// Double-check it should still be processed (idempotency)
			// Drizzle returns amount as string; shouldProcess only reads
			// active/next_run/end_date which are type-compatible.
			if (!shouldProcess(recurring as unknown as RecurringTransaction, today)) continue;

			// Create the actual transaction
			await db.insert(transactions).values({
				user_id: userId,
				amount: String(recurring.amount),
				description: recurring.description,
				date: recurring.next_run,
				category_id: recurring.category_id,
				type: recurring.type
			});

			// Calculate next run
			const nextRun = calculateNextRun(
				recurring.next_run,
				recurring.frequency as RecurringTransaction['frequency'],
				recurring.interval,
				recurring.day_of_week,
				recurring.day_of_month,
				recurring.month_of_year,
				recurring.start_date
			);

			// Check if next run exceeds end_date
			const shouldDeactivate = recurring.end_date && parseDateLocal(nextRun) > parseDateLocal(recurring.end_date);

			// Update the recurring transaction
			await db
				.update(recurringTransactions)
				.set({
					next_run: nextRun,
					last_generated_at: new Date(today),
					active: !shouldDeactivate,
					updated_at: new Date()
				})
				.where(and(eq(recurringTransactions.id, recurring.id), eq(recurringTransactions.user_id, userId)));

			generated++;
		}

		return generated;
	}

	// Find active recurring transactions that are due
	const dueRecurring = await queryMany<RecurringTransaction>(
		`SELECT * FROM recurring_transactions
		 WHERE user_id = $1
		 AND active = true
		 AND next_run <= $2
		 AND (end_date IS NULL OR end_date >= $2)
		 ORDER BY next_run ASC`,
		[userId, today]
	);

	if (dueRecurring.length === 0) {
		return 0;
	}

	let generated = 0;

	for (const recurring of dueRecurring) {
		// Double-check it should still be processed (idempotency)
		if (!shouldProcess(recurring, today)) continue;

		// Create the actual transaction
		await execute(
			`INSERT INTO transactions (user_id, amount, description, date, category_id, type)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			[userId, recurring.amount, recurring.description, recurring.next_run, recurring.category_id, recurring.type]
		);

		// Calculate next run
		const nextRun = calculateNextRun(
			recurring.next_run,
			recurring.frequency,
			recurring.interval,
			recurring.day_of_week,
			recurring.day_of_month,
			recurring.month_of_year,
			recurring.start_date
		);

		// Check if next run exceeds end_date
		const shouldDeactivate = recurring.end_date && parseDateLocal(nextRun) > parseDateLocal(recurring.end_date);

		// Update the recurring transaction
		await execute(
			`UPDATE recurring_transactions
			 SET next_run = $1, last_generated_at = $2, active = $3, updated_at = NOW()
			 WHERE id = $4 AND user_id = $5`,
			[nextRun, today, !shouldDeactivate ? 1 : 0, recurring.id, userId]
		);

		generated++;
	}

	return generated;
}

/**
 * Run a single recurring transaction now (manual trigger)
 * Does NOT change the schedule
 */
export async function runRecurringNow(userId: number, recurringId: number): Promise<{ success: boolean; error?: string }> {
	if (usePostgres) {
		const db = await getDrizzle();
		const [recurring] = await db
			.select()
			.from(recurringTransactions)
			.where(and(eq(recurringTransactions.id, recurringId), eq(recurringTransactions.user_id, userId)));

		if (!recurring) {
			return { success: false, error: 'Recurring transaction not found' };
		}

		if (!recurring.active) {
			return { success: false, error: 'Recurring transaction is paused' };
		}

		// Use next_run as the date for the generated transaction
		const transactionDate = recurring.next_run;

		// Create the transaction
		await db.insert(transactions).values({
			user_id: userId,
			amount: String(recurring.amount),
			description: recurring.description,
			date: transactionDate,
			category_id: recurring.category_id,
			type: recurring.type
		});

		return { success: true };
	}

	const recurring = await queryOne<RecurringTransaction>(
		`SELECT * FROM recurring_transactions WHERE id = $1 AND user_id = $2`,
		[recurringId, userId]
	);

	if (!recurring) {
		return { success: false, error: 'Recurring transaction not found' };
	}

	if (!recurring.active) {
		return { success: false, error: 'Recurring transaction is paused' };
	}

	// Use next_run as the date for the generated transaction
	const transactionDate = recurring.next_run;

	// Create the transaction
	await execute(
		`INSERT INTO transactions (user_id, amount, description, date, category_id, type)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		[userId, recurring.amount, recurring.description, transactionDate, recurring.category_id, recurring.type]
	);

	return { success: true };
}

/**
 * Toggle active/paused status
 */
export async function toggleRecurringStatus(
	userId: number,
	recurringId: number,
	active: boolean
): Promise<{ success: boolean; error?: string }> {
	if (usePostgres) {
		const db = await getDrizzle();
		const [recurring] = await db
			.select({ id: recurringTransactions.id })
			.from(recurringTransactions)
			.where(and(eq(recurringTransactions.id, recurringId), eq(recurringTransactions.user_id, userId)));

		if (!recurring) {
			return { success: false, error: 'Recurring transaction not found' };
		}

		await db
			.update(recurringTransactions)
			.set({ active, updated_at: new Date() })
			.where(and(eq(recurringTransactions.id, recurringId), eq(recurringTransactions.user_id, userId)));

		return { success: true };
	}

	const recurring = await queryOne<{ id: number }>(
		`SELECT id FROM recurring_transactions WHERE id = $1 AND user_id = $2`,
		[recurringId, userId]
	);

	if (!recurring) {
		return { success: false, error: 'Recurring transaction not found' };
	}

	await execute(
		`UPDATE recurring_transactions SET active = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
		[active ? 1 : 0, recurringId, userId]
	);

	return { success: true };
}

/**
 * Duplicate a recurring transaction
 */
export async function duplicateRecurringTransaction(
	userId: number,
	recurringId: number
): Promise<{ success: boolean; error?: string; id?: number }> {
	if (usePostgres) {
		const db = await getDrizzle();
		const [recurring] = await db
			.select()
			.from(recurringTransactions)
			.where(and(eq(recurringTransactions.id, recurringId), eq(recurringTransactions.user_id, userId)));

		if (!recurring) {
			return { success: false, error: 'Recurring transaction not found' };
		}

		// Create duplicate with same next_run (will be processed on next scheduler run)
		const [result] = await db
			.insert(recurringTransactions)
			.values({
				user_id: userId,
				type: recurring.type,
				amount: String(recurring.amount),
				description: recurring.description,
				category_id: recurring.category_id,
				frequency: recurring.frequency,
				interval: recurring.interval,
				day_of_week: recurring.day_of_week,
				day_of_month: recurring.day_of_month,
				month_of_year: recurring.month_of_year,
				start_date: recurring.start_date,
				end_date: recurring.end_date,
				next_run: recurring.next_run,
				last_generated_at: recurring.last_generated_at,
				active: recurring.active
			})
			.returning({ id: recurringTransactions.id });

		if (!result) {
			return { success: false, error: 'Failed to duplicate recurring transaction' };
		}

		return { success: true, id: result.id };
	}

	const recurring = await queryOne<RecurringTransaction>(
		`SELECT * FROM recurring_transactions WHERE id = $1 AND user_id = $2`,
		[recurringId, userId]
	);

	if (!recurring) {
		return { success: false, error: 'Recurring transaction not found' };
	}

	// Create duplicate with same next_run (will be processed on next scheduler run)
	const result = await queryOne<{ id: number }>(
		`INSERT INTO recurring_transactions
		 (user_id, type, amount, description, category_id, frequency, interval, day_of_week, day_of_month, month_of_year, start_date, end_date, next_run, last_generated_at, active, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
		 RETURNING id`,
		[
			userId,
			recurring.type,
			recurring.amount,
			recurring.description,
			recurring.category_id,
			recurring.frequency,
			recurring.interval,
			recurring.day_of_week,
			recurring.day_of_month,
			recurring.month_of_year,
			recurring.start_date,
			recurring.end_date,
			recurring.next_run,
			recurring.last_generated_at,
			recurring.active ? 1 : 0
		]
	);

	if (!result) {
		return { success: false, error: 'Failed to duplicate recurring transaction' };
	}

	return { success: true, id: result.id };
}

export { generatePreview };
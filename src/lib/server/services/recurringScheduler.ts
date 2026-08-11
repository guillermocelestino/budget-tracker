import { getDrizzle } from '$lib/server/db/drizzle';
import { recurringTransactions } from '$lib/server/db/schema';
import { and, eq, lte, gte, or, isNull, asc } from 'drizzle-orm';
import { createTransaction, createTransactionInTxDrizzle } from '$lib/server/services/transactions';
import type { RecurringTransaction } from '$lib/types';
import { calculateNextRun, generatePreview } from '$lib/shared/utils/recurring';
import { getToday } from '$lib/shared/utils/format';

/**
 * Parse a YYYY-MM-DD date string into a local Date object.
 * Avoids the UTC-parsing pitfall of `new Date('YYYY-MM-DD')`.
 */
function parseDateLocal(dateStr: string | Date): Date {
	if (dateStr instanceof Date) {
		return new Date(dateStr.getFullYear(), dateStr.getMonth(), dateStr.getDate());
	}
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

		// Calculate next run (pure computation — no DB access)
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

		// Create the transaction AND advance the schedule atomically — one
		// transaction per due item, so a failure on this item rolls back both
		// the generated transaction and the schedule update (next_run stays put
		// and the item is retried on the next run). Earlier items that already
		// committed are untouched.
		await db.transaction(async (tx) => {
			await createTransactionInTxDrizzle(tx, userId, {
				type: recurring.type as 'income' | 'expense',
				amount: parseFloat(String(recurring.amount)),
				description: recurring.description,
				date: recurring.next_run,
				category_id: recurring.category_id
			});

			// Update the recurring transaction
			await tx
				.update(recurringTransactions)
				.set({
					next_run: nextRun,
					last_generated_at: new Date(today),
					active: !shouldDeactivate,
					updated_at: new Date()
				})
				.where(and(eq(recurringTransactions.id, recurring.id), eq(recurringTransactions.user_id, userId)));
		});

		generated++;
	}

	return generated;
}

/**
 * Run a single recurring transaction now (manual trigger)
 * Does NOT change the schedule
 */
export async function runRecurringNow(userId: number, recurringId: number): Promise<{ success: boolean; error?: string }> {
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
	await createTransaction(userId, {
		type: recurring.type as 'income' | 'expense',
		amount: parseFloat(String(recurring.amount)),
		description: recurring.description,
		date: transactionDate,
		category_id: recurring.category_id
	});

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

/**
 * Duplicate a recurring transaction
 */
export async function duplicateRecurringTransaction(
	userId: number,
	recurringId: number
): Promise<{ success: boolean; error?: string; id?: number }> {
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

export { generatePreview };
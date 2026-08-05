import type { RecurringFrequency } from '$lib/types';

/**
 * Parse a YYYY-MM-DD date string into a local Date object.
 * Avoids the UTC-parsing pitfall of `new Date('YYYY-MM-DD')` which
 * interprets the string as UTC midnight, causing off-by-one errors
 * in negative-UTC timezones when local getters are used.
 */
function parseDateLocal(dateStr: string): Date {
	const [y, m, d] = dateStr.split('-').map(Number);
	return new Date(y, m - 1, d);
}

/**
 * Format a Date object back to a YYYY-MM-DD string using local getters.
 */
function formatDateLocal(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

/**
 * Calculate the next occurrence date for a recurring transaction
 * This is a client-safe version that can be used in components
 */
export function calculateNextRun(
	currentRun: string,
	frequency: RecurringFrequency,
	interval: number,
	dayOfWeek: number | null,
	dayOfMonth: number | null,
	monthOfYear: number | null,
	startDate: string
): string {
	const current = parseDateLocal(currentRun);
	const start = parseDateLocal(startDate);

	// Ensure we don't go before start date
	if (current < start) {
		return startDate;
	}

	let next: Date;

	switch (frequency) {
		case 'daily': {
			next = new Date(current);
			next.setDate(current.getDate() + interval);
			break;
		}
		case 'weekly': {
			next = new Date(current);
			next.setDate(current.getDate() + interval * 7);
			// If day_of_week is specified, adjust to that day of week
			if (dayOfWeek !== null) {
				const targetDay = dayOfWeek; // 0 = Sunday
				const currentDay = next.getDay();
				const daysToAdd = (targetDay - currentDay + 7) % 7;
				if (daysToAdd > 0) {
					next.setDate(next.getDate() + daysToAdd);
				}
			}
			break;
		}
		case 'monthly': {
			next = new Date(current);
			// Set day to 1 before changing month to prevent date overflow
			// (e.g., Jan 31 + 1 month would roll to Mar 3 without this)
			const targetDay = dayOfMonth ?? current.getDate();
			next.setDate(1);
			next.setMonth(current.getMonth() + interval);
			const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
			next.setDate(Math.min(targetDay, maxDay));
			break;
		}
		case 'yearly': {
			next = new Date(current);
			// Set day to 1 before changing year/month to prevent date overflow
			next.setDate(1);
			next.setFullYear(current.getFullYear() + interval);
			// If month_of_year is specified, use that month
			if (monthOfYear !== null) {
				next.setMonth(monthOfYear - 1); // 0-indexed
			}
			const targetDay = dayOfMonth ?? current.getDate();
			const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
			next.setDate(Math.min(targetDay, maxDay));
			break;
		}
		default:
			throw new Error(`Unknown frequency: ${frequency}`);
	}

	return formatDateLocal(next);
}

/**
 * Generate preview of next 5 scheduled dates
 */
export function generatePreview(
	frequency: RecurringFrequency,
	interval: number,
	dayOfWeek: number | null,
	dayOfMonth: number | null,
	monthOfYear: number | null,
	startDate: string,
	count: number = 5
): string[] {
	const dates: string[] = [];
	let current = startDate;

	for (let i = 0; i < count; i++) {
		dates.push(current);
		current = calculateNextRun(current, frequency, interval, dayOfWeek, dayOfMonth, monthOfYear, startDate);
	}

	return dates;
}
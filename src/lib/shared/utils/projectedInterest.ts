/**
 * Projected Interest — pure, presentation-only derived calculation for the
 * Lending page.
 *
 * Formula:
 *   Projected Interest = Principal × (Interest Rate / 100) × Elapsed Whole Calendar Months
 *
 * This is a pure helper: it performs no database reads/writes and persists
 * nothing. All monetary values are rounded to 2 decimal places to match the
 * app's existing NUMERIC(12,2) convention and the shared currency formatter.
 */
import { getToday } from './format';

/**
 * Calculate the number of COMPLETE calendar months between two YYYY-MM-DD
 * dates (inclusive of the start, exclusive of partial trailing months).
 *
 * Examples:
 *   2026-01-01 → 2026-09-01 = 8
 *   2026-01-15 → 2026-09-10 = 7  (Sep 10 < Sep 15, so Sep is not complete)
 *   2026-01-01 → 2026-01-01 = 0  (same day)
 *   2026-09-01 → 2026-01-01 = 0  (reference before lending → no elapsed time)
 *
 * Deterministic: uses the calendar, never approximates months as days/30.
 */
export function calculateElapsedWholeMonths(dateLent: string, referenceDate: string): number {
	const [ly, lm, ld] = dateLent.split('-').map(Number);
	const [ry, rm, rd] = referenceDate.split('-').map(Number);

	// Reference before lending → no elapsed whole months yet.
	if (ry < ly || (ry === ly && rm < lm)) return 0;

	let months = (ry - ly) * 12 + (rm - lm);

	// A whole month is only complete once the reference date has reached the
	// lending date's day-of-month. If it has not, the trailing month is partial.
	if (rd < ld) {
		months = Math.max(0, months - 1);
	}

	return months;
}

/**
 * Pure simple-interest projection.
 *
 *   Projected Interest = principal × (interestRate / 100) × elapsedWholeMonths
 *
 * Guards:
 *   - non-finite / non-positive principal → 0
 *   - non-finite interest rate → 0
 *   - interest rate ≤ 0 → 0
 *   - elapsed months ≤ 0 → 0
 *
 * Returns the monetary value rounded to 2 decimal places (never a string,
 * never persisted).
 */
export function calculateProjectedInterest(
	principal: number,
	interestRate: number,
	dateLent: string,
	referenceDate: string
): number {
	if (!Number.isFinite(principal) || principal <= 0) return 0;
	if (!Number.isFinite(interestRate) || interestRate <= 0) return 0;

	const months = calculateElapsedWholeMonths(dateLent, referenceDate);
	if (months <= 0) return 0;

	const value = principal * (interestRate / 100) * months;
	// Round to 2 decimals to match the app's monetary convention.
	return Math.round(value * 100) / 100;
}

/**
 * Resolve the reference date used to stop interest accumulation for a single
 * lending, following the application's existing semantics:
 *
 *  - Paid / fully settled: interest stops at the ACTUAL settlement date
 *    (the final payment date captured from the payment history). This prevents
 *    interest from continuing to accumulate after the loan is fully paid.
 *  - Active with a due_date: the expected repayment/maturity date is used.
 *  - Active without a due_date: today's date (getToday, honors DEMO_TODAY) is
 *    the natural "as of now" projection reference.
 */
export function projectedReferenceDate(input: {
	derived_status: 'active' | 'paid';
	due_date: string | null;
	settlement_date: string | null;
}): string {
	if (input.derived_status === 'paid') {
		// The final payment settles the loan — stop there.
		return input.settlement_date ?? input.due_date ?? getToday();
	}
	// Active — use the stated maturity date when present, otherwise today.
	return input.due_date ?? getToday();
}

/**
 * Convenience wrapper for a whole `LendingWithPayments`-shaped record.
 * Returns the computed Projected Interest monetary value.
 */
export function calculateProjectedInterestForLending(input: {
	amount: number;
	interest_rate: number;
	date_lent: string;
	due_date: string | null;
	derived_status: 'active' | 'paid';
	settlement_date: string | null;
}): number {
	const referenceDate = projectedReferenceDate(input);
	return calculateProjectedInterest(
		input.amount,
		input.interest_rate,
		input.date_lent,
		referenceDate
	);
}
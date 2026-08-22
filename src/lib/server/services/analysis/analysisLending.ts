/**
 * Lending ("Money Away") Domain Intelligence
 */

import { getDrizzle } from '$lib/server/db/drizzle';
import { lendings, lendingPayments } from '$lib/server/db/schema';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { getLendingTotals } from '$lib/server/services/lendingPayments';
import type { MoneyAwayData, PeriodResolution } from './analysisTypes';

export async function computeLendingData(
	userId: number,
	resolution: PeriodResolution
): Promise<MoneyAwayData> {
	const db = await getDrizzle();
	const { start, end } = resolution.current;

	// Overall all-time totals
	const overallLending = await getLendingTotals(userId, 'lent');

	// Period-specific Lent
	const [periodLentStats] = await db
		.select({
			lent: sql<number>`COALESCE(SUM(CAST(${lendings.amount} AS NUMERIC)), 0)`,
		})
		.from(lendings)
		.where(
			and(
				eq(lendings.user_id, userId),
				eq(lendings.direction, 'lent'),
				gte(lendings.date_lent, start),
				lte(lendings.date_lent, end)
			)
		);

	// Period-specific Returned
	const [periodReturnedStats] = await db
		.select({
			returned: sql<number>`COALESCE(SUM(CAST(${lendingPayments.amount} AS NUMERIC)), 0)`,
		})
		.from(lendingPayments)
		.where(
			and(
				eq(lendingPayments.user_id, userId),
				eq(lendingPayments.payment_type, 'payment'),
				gte(lendingPayments.payment_date, start),
				lte(lendingPayments.payment_date, end)
			)
		);

	// Active lendings and largest outstanding loan
	const activeLendings = await db
		.select({
			id: lendings.id,
			borrowerName: lendings.borrower_name,
			amount: sql<number>`CAST(${lendings.amount} AS NUMERIC)`,
		})
		.from(lendings)
		.where(
			and(
				eq(lendings.user_id, userId),
				eq(lendings.direction, 'lent'),
				eq(lendings.status, 'active')
			)
		)
		.orderBy(sql`CAST(${lendings.amount} AS NUMERIC) DESC`);

	// For each active lending, calculate actual remaining outstanding balance
	let largestOutstanding: { borrowerName: string; amount: number } | null = null;

	if (activeLendings.length > 0) {
		const topLending = activeLendings[0];
		const [pmtSum] = await db
			.select({
				paid: sql<number>`COALESCE(SUM(CAST(${lendingPayments.amount} AS NUMERIC)), 0)`,
			})
			.from(lendingPayments)
			.where(
				and(
					eq(lendingPayments.user_id, userId),
					eq(lendingPayments.lending_id, topLending.id),
					eq(lendingPayments.payment_type, 'payment')
				)
			);

		const rem = Number(topLending.amount) - Number(pmtSum?.paid || 0);
		if (rem > 0) {
			largestOutstanding = {
				borrowerName: topLending.borrowerName,
				amount: rem,
			};
		}
	}

	const lent = Number(periodLentStats?.lent ?? 0);
	const returned = Number(periodReturnedStats?.returned ?? 0);
	const historicalLent = overallLending.total;
	const outstanding = overallLending.outstanding;
	const repaymentRate = historicalLent > 0 ? Math.round((overallLending.cashPaid / historicalLent) * 100) : 100;

	return {
		lent,
		returned,
		outstanding,
		activeLendingCount: activeLendings.length,
		largestOutstanding,
		repaymentRate,
		historicalLent,
	};
}

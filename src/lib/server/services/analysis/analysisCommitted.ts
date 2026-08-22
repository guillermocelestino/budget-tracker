/**
 * Committed Money & Recurring Obligations Intelligence
 */

import { getDrizzle } from '$lib/server/db/drizzle';
import { recurringTransactions, categories, lendings } from '$lib/server/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { getMonthlyCommittedTotal, getUpcomingCommitmentsTotal } from '$lib/server/services/recurringService';
import type { CommittedMoneyData } from './analysisTypes';

export async function computeCommittedData(
	userId: number,
	totalMoneyOut: number
): Promise<CommittedMoneyData> {
	const db = await getDrizzle();

	const [monthlyRecurringTotal, upcoming30Days] = await Promise.all([
		getMonthlyCommittedTotal(userId),
		getUpcomingCommitmentsTotal(userId, 30),
	]);

	// Borrowed debt owed
	const [borrowedStats] = await db
		.select({
			debtOwed: sql<number>`COALESCE(SUM(CAST(${lendings.amount} AS NUMERIC)), 0)`,
		})
		.from(lendings)
		.where(
			and(
				eq(lendings.user_id, userId),
				eq(lendings.direction, 'borrowed'),
				eq(lendings.status, 'active')
			)
		);

	const borrowedCommittedTotal = Number(borrowedStats?.debtOwed ?? 0);

	// Breakdown of active recurring obligations by category
	const categoryRows = await db
		.select({
			name: categories.name,
			amount: sql<number>`SUM(CAST(${recurringTransactions.amount} AS NUMERIC))`,
		})
		.from(recurringTransactions)
		.innerJoin(categories, eq(recurringTransactions.category_id, categories.id))
		.where(
			and(
				eq(recurringTransactions.user_id, userId),
				eq(recurringTransactions.active, true),
				eq(recurringTransactions.type, 'expense')
			)
		)
		.groupBy(categories.name)
		.orderBy(sql`SUM(CAST(${recurringTransactions.amount} AS NUMERIC)) DESC`);

	const recurringCategories = categoryRows.map((r) => ({
		name: r.name,
		amount: Number(r.amount || 0),
	}));

	const totalCommitted = monthlyRecurringTotal + borrowedCommittedTotal;
	const committedPctOfMoneyOut = totalMoneyOut > 0 ? Math.round((totalCommitted / totalMoneyOut) * 100) : 0;

	return {
		recurringTotal: monthlyRecurringTotal,
		upcomingRecurringTotal: upcoming30Days,
		borrowedCommittedTotal,
		recurringCategories,
		committedPctOfMoneyOut,
	};
}

/**
 * Category Breakdown & Behavioral Analysis for Financial Intelligence
 */

import { getDrizzle } from '$lib/server/db/drizzle';
import { transactions, categories } from '$lib/server/db/schema';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import type { CategoryAnalysisItem, PeriodResolution } from './analysisTypes';

export async function computeCategoryAnalysis(
	userId: number,
	resolution: PeriodResolution,
	totalMoneyOut: number
): Promise<CategoryAnalysisItem[]> {
	const db = await getDrizzle();
	const { start, end } = resolution.current;

	const rows = await db
		.select({
			id: categories.id,
			name: categories.name,
			color: categories.color,
			icon: categories.icon,
			amount: sql<number>`SUM(CAST(${transactions.amount} AS NUMERIC))`,
			txCount: sql<number>`COUNT(${transactions.id})`,
		})
		.from(transactions)
		.innerJoin(categories, eq(transactions.category_id, categories.id))
		.where(
			and(
				eq(transactions.user_id, userId),
				eq(transactions.type, 'expense'),
				gte(transactions.date, start),
				lte(transactions.date, end)
			)
		)
		.groupBy(categories.id, categories.name, categories.color, categories.icon)
		.orderBy(sql`SUM(CAST(${transactions.amount} AS NUMERIC)) DESC`);

	const currentList = rows.map((r) => ({
		id: r.id,
		name: r.name,
		color: r.color,
		icon: r.icon,
		amount: Number(r.amount || 0),
		txCount: Number(r.txCount || 0),
	}));

	const safeTotalOut = totalMoneyOut > 0 ? totalMoneyOut : currentList.reduce((acc, c) => acc + c.amount, 0);

	return currentList.map((c) => {
		const percentage = safeTotalOut > 0 ? Math.round((c.amount / safeTotalOut) * 100) : 0;

		return {
			id: c.id,
			name: c.name,
			color: c.color,
			icon: c.icon,
			amount: c.amount,
			percentage,
			txCount: c.txCount,
		};
	});
}


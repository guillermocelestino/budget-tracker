/**
 * Spending Behavior & Daily Drain Intelligence
 */

import { getDrizzle } from '$lib/server/db/drizzle';
import { transactions, categories } from '$lib/server/db/schema';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import type { CategoryAnalysisItem, DailyDrainData, PeriodResolution, SpendingBehaviorData } from './analysisTypes';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export async function computeDailyDrainAndBehavior(
	userId: number,
	resolution: PeriodResolution,
	categoryItems: CategoryAnalysisItem[],
	totalMoneyOut: number,
	txCount: number
): Promise<{ dailyDrain: DailyDrainData; behavior: SpendingBehaviorData }> {
	const db = await getDrizzle();
	const { start, end } = resolution.current;

	// 1. Daily Outflows
	const dailyRows = await db
		.select({
			date: transactions.date,
			amount: sql<number>`SUM(CAST(${transactions.amount} AS NUMERIC))`,
		})
		.from(transactions)
		.where(
			and(
				eq(transactions.user_id, userId),
				eq(transactions.type, 'expense'),
				gte(transactions.date, start),
				lte(transactions.date, end)
			)
		)
		.groupBy(transactions.date)
		.orderBy(transactions.date);

	const dailyMap = new Map<string, number>();
	for (const r of dailyRows) {
		dailyMap.set(r.date, Number(r.amount || 0));
	}

	const dailyOutflows: Array<{ date: string; amount: number }> = [];
	const curDate = new Date(start);
	const endDate = new Date(end);

	let highestDay: { date: string; amount: number; dayOfWeek: string } | null = null;
	let lowestDay: { date: string; amount: number; dayOfWeek: string } | null = null;

	const weekdayAmounts: Map<number, number[]> = new Map();
	const weekdayCounts: Map<number, number> = new Map();
	for (let i = 0; i < 7; i++) {
		weekdayAmounts.set(i, []);
		weekdayCounts.set(i, 0);
	}

	while (curDate <= endDate) {
		const year = curDate.getFullYear();
		const month = String(curDate.getMonth() + 1).padStart(2, '0');
		const day = String(curDate.getDate()).padStart(2, '0');
		const dStr = `${year}-${month}-${day}`;
		const dayOfWeekIndex = curDate.getDay();
		const dayOfWeekName = DAY_NAMES[dayOfWeekIndex];

		const amt = dailyMap.get(dStr) || 0;
		dailyOutflows.push({ date: dStr, amount: amt });

		weekdayAmounts.get(dayOfWeekIndex)?.push(amt);

		if (amt > 0) {
			if (!highestDay || amt > highestDay.amount) {
				highestDay = { date: dStr, amount: amt, dayOfWeek: dayOfWeekName };
			}
			if (!lowestDay || amt < lowestDay.amount) {
				lowestDay = { date: dStr, amount: amt, dayOfWeek: dayOfWeekName };
			}
		}

		curDate.setDate(curDate.getDate() + 1);
	}

	// Fetch transaction details for weekday activity counting
	const txRows = await db
		.select({
			id: transactions.id,
			amount: sql<number>`CAST(${transactions.amount} AS NUMERIC)`,
			description: transactions.description,
			date: transactions.date,
			categoryName: categories.name,
		})
		.from(transactions)
		.leftJoin(categories, eq(transactions.category_id, categories.id))
		.where(
			and(
				eq(transactions.user_id, userId),
				eq(transactions.type, 'expense'),
				gte(transactions.date, start),
				lte(transactions.date, end)
			)
		)
		.orderBy(sql`CAST(${transactions.amount} AS NUMERIC) DESC`);

	for (const t of txRows) {
		const dow = new Date(t.date).getDay();
		weekdayCounts.set(dow, (weekdayCounts.get(dow) || 0) + 1);
	}

	const avgDailyDrain = totalMoneyOut / resolution.daysInPeriod;

	// Unusually High Days (> 1.5x avgDailyDrain and amt >= 100)
	const threshold = Math.max(100, avgDailyDrain * 1.5);
	const unusuallyHighDays = dailyOutflows
		.filter((d) => avgDailyDrain > 0 && d.amount >= threshold)
		.map((d) => ({
			date: d.date,
			amount: d.amount,
			ratioToAvg: Math.round((d.amount / (avgDailyDrain || 1)) * 10) / 10,
		}));

	// Find most active day of week (by tx count)
	let mostActiveDayOfWeek: string | null = null;
	let maxTxCount = 0;
	for (let i = 0; i < 7; i++) {
		const cnt = weekdayCounts.get(i) || 0;
		if (cnt > maxTxCount) {
			maxTxCount = cnt;
			mostActiveDayOfWeek = DAY_NAMES[i];
		}
	}

	// Find highest spending weekday (by avg amount spent on that weekday)
	let highestSpendingWeekday: string | null = null;
	let maxAvgWeekdayAmt = 0;
	for (let i = 0; i < 7; i++) {
		const arr = weekdayAmounts.get(i) || [];
		if (arr.length > 0) {
			const avgAmt = arr.reduce((a, b) => a + b, 0) / arr.length;
			if (avgAmt > maxAvgWeekdayAmt) {
				maxAvgWeekdayAmt = avgAmt;
				highestSpendingWeekday = DAY_NAMES[i];
			}
		}
	}

	// Category Analysis Insights
	const largestCategory = categoryItems.length > 0 ? { name: categoryItems[0].name, amount: categoryItems[0].amount } : null;

	const largestSingleTx = txRows.length > 0
		? {
				description: txRows[0].description,
				amount: Number(txRows[0].amount),
				date: txRows[0].date,
				categoryName: txRows[0].categoryName ?? undefined,
			}
		: null;

	const avgTxSize = txCount > 0 ? totalMoneyOut / txCount : 0;
	const txFrequencyPerDay = Math.round((txCount / resolution.daysInPeriod) * 10) / 10;

	return {
		dailyDrain: {
			avgDailyDrain,
			highestDrainDay: highestDay,
			lowestDrainDay: lowestDay,
			unusuallyHighDays,
			dailyOutflows,
		},
		behavior: {
			avgTxSize,
			txFrequencyPerDay,
			mostActiveDayOfWeek,
			highestSpendingWeekday,
			largestCategory,
			largestSingleTx,
		},
	};
}


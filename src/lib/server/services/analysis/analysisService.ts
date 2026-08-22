/**
 * Orchestration Service for Financial Intelligence (/analysis)
 */

import { getDrizzle } from '$lib/server/db/drizzle';
import { transactions, categories } from '$lib/server/db/schema';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import type {
	AnalysisData,
	AnalysisPeriod,
	LargestMovementsData,
	MoneyOutBreakdownData,
} from './analysisTypes';
import { resolvePeriod } from './analysisPeriods';
import { computeSnapshotData } from './analysisSnapshot';
import { computeTrendData } from './analysisTrends';
import { computeCategoryAnalysis } from './analysisCategories';
import { computeDailyDrainAndBehavior } from './analysisBehavior';
import { computeCommittedData } from './analysisCommitted';
import { computeLendingData } from './analysisLending';
import { computeCashFlowAndReturningData } from './analysisCashFlow';
import { generateStructuredInsights } from './analysisInsights';

export async function getAnalysisData(
	userId: number,
	period: AnalysisPeriod = '1M',
	baseDateStr?: string,
	customStartDateStr?: string,
	customEndDateStr?: string
): Promise<AnalysisData> {
	const db = await getDrizzle();

	// Find earliest transaction date if ALL period requested
	let earliestDateStr: string | undefined = undefined;
	if (period === 'ALL') {
		const [earliestRow] = await db
			.select({ minDate: sql<string>`MIN(${transactions.date})` })
			.from(transactions)
			.where(eq(transactions.user_id, userId));
		if (earliestRow?.minDate) {
			earliestDateStr = earliestRow.minDate;
		}
	}

	// 1. Centralized Period Resolution
	const resolution = resolvePeriod(period, baseDateStr, customStartDateStr, customEndDateStr, earliestDateStr);

	// 1b. Fetch preset counts for all periods
	const presetList: AnalysisPeriod[] = ['1M', '3M', 'YTD', '1Y', 'ALL'];
	const presetCounts: Record<AnalysisPeriod, number> = {
		'1M': 0,
		'3M': 0,
		'YTD': 0,
		'1Y': 0,
		'ALL': 0,
		'CUSTOM': 0,
	};

	await Promise.all(
		presetList.map(async (p) => {
			const res = resolvePeriod(p, baseDateStr, undefined, undefined, earliestDateStr);
			const [row] = await db
				.select({ count: sql<number>`CAST(COUNT(*) AS INTEGER)` })
				.from(transactions)
				.where(
					and(
						eq(transactions.user_id, userId),
						gte(transactions.date, res.current.start),
						lte(transactions.date, res.current.end)
					)
				);
			presetCounts[p] = Number(row?.count ?? 0);
		})
	);

	if (customStartDateStr && customEndDateStr) {
		const customRes = resolvePeriod('CUSTOM', baseDateStr, customStartDateStr, customEndDateStr, earliestDateStr);
		const [row] = await db
			.select({ count: sql<number>`CAST(COUNT(*) AS INTEGER)` })
			.from(transactions)
			.where(
				and(
					eq(transactions.user_id, userId),
					gte(transactions.date, customRes.current.start),
					lte(transactions.date, customRes.current.end)
				)
			);
		presetCounts['CUSTOM'] = Number(row?.count ?? 0);
	}

	// 2. Fetch Snapshot Data
	const snapshot = await computeSnapshotData(userId, resolution);
	presetCounts[resolution.period] = snapshot.transactionCount;

	// 3. Parallel Fetch for Breakdown, Trends, Categories, Behavior, Committed, Lending, Cash Flow
	const [trend, categoryItems, lending, committed, cashFlowAndReturning] = await Promise.all([
		computeTrendData(userId, resolution),
		computeCategoryAnalysis(userId, resolution, snapshot.moneyOut),
		computeLendingData(userId, resolution),
		computeCommittedData(userId, snapshot.moneyOut),
		computeCashFlowAndReturningData(userId, resolution, snapshot.moneyOut),
	]);

	const { dailyDrain, behavior } = await computeDailyDrainAndBehavior(
		userId,
		resolution,
		categoryItems,
		snapshot.moneyOut,
		snapshot.transactionCount
	);

	// 4. Money Out Breakdown Calculation
	const moneyGone = Math.max(0, snapshot.moneyOut - lending.lent);
	const moneyAway = lending.lent;
	const moneyCommitted = committed.recurringTotal + committed.borrowedCommittedTotal;
	const moneyReturning = cashFlowAndReturning.returning.total;

	const breakdown: MoneyOutBreakdownData = {
		moneyGone,
		moneyAway,
		moneyCommitted,
		moneyReturning,
		moneyGonePct: snapshot.moneyOut > 0 ? Math.round((moneyGone / snapshot.moneyOut) * 100) : 0,
		moneyAwayPct: snapshot.moneyOut > 0 ? Math.round((moneyAway / snapshot.moneyOut) * 100) : 0,
		moneyCommittedPct: snapshot.moneyOut > 0 ? Math.round((moneyCommitted / snapshot.moneyOut) * 100) : 0,
	};

	// 5. Rule-Based Insights Engine
	const insights = generateStructuredInsights(
		resolution,
		snapshot,
		categoryItems,
		dailyDrain,
		behavior,
		committed,
		lending
	);

	// 6. Fetch Top Financial Activity (Largest Outflows & Top Categories)
	const largestTxRows = await db
		.select({
			id: transactions.id,
			description: transactions.description,
			amount: sql<number>`CAST(${transactions.amount} AS NUMERIC)`,
			date: transactions.date,
			categoryName: categories.name,
			categoryColor: categories.color,
		})
		.from(transactions)
		.leftJoin(categories, eq(transactions.category_id, categories.id))
		.where(
			and(
				eq(transactions.user_id, userId),
				eq(transactions.type, 'expense'),
				gte(transactions.date, resolution.current.start),
				lte(transactions.date, resolution.current.end)
			)
		)
		.orderBy(sql`CAST(${transactions.amount} AS NUMERIC) DESC`)
		.limit(5);

	const largestOutflows = largestTxRows.map((r) => ({
		id: r.id,
		description: r.description,
		amount: Number(r.amount),
		date: r.date,
		categoryName: r.categoryName ?? 'Uncategorized',
		categoryColor: r.categoryColor ?? '#6366f1',
	}));

	const topCategories = categoryItems.slice(0, 5).map((c) => ({
		id: c.id,
		name: c.name,
		amount: c.amount,
		percentage: c.percentage,
		color: c.color,
		icon: c.icon,
	}));

	const movements: LargestMovementsData = {
		largestOutflows,
		topCategories,
	};

	const hasSufficientData = snapshot.transactionCount > 0 || snapshot.moneyOut > 0 || snapshot.moneyIn > 0;

	return {
		period: resolution.period,
		dateRange: resolution.current,
		resolution,
		snapshot,
		breakdown,
		trend,
		categories: categoryItems,
		dailyDrain,
		behavior,
		committed,
		lending,
		returning: cashFlowAndReturning.returning,
		cashFlow: cashFlowAndReturning.cashFlow,
		insights,
		movements,
		presetCounts,
		hasSufficientData,
	};
}


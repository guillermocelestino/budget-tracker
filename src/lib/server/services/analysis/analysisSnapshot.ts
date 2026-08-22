/**
 * Financial Snapshot Domain Analysis (Money Out, Money In, Net Cash Flow, Daily Drain)
 */

import { getDrizzle } from '$lib/server/db/drizzle';
import { transactions, categories, lendings, lendingPayments } from '$lib/server/db/schema';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import type { MoneySnapshotData, PeriodResolution } from './analysisTypes';

export async function computeSnapshotData(
	userId: number,
	resolution: PeriodResolution
): Promise<MoneySnapshotData> {
	const db = await getDrizzle();
	const { start, end } = resolution.current;

	// 1. Transactions sum & count
	const [txStats] = await db
		.select({
			totalExpense: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END), 0)`,
			totalIncome: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END), 0)`,
			txCount: sql<number>`COUNT(*)`,
			refundsTotal: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' AND LOWER(${transactions.description}) LIKE '%refund%' THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END), 0)`,
		})
		.from(transactions)
		.where(
			and(
				eq(transactions.user_id, userId),
				gte(transactions.date, start),
				lte(transactions.date, end)
			)
		);

	// 2. Lending Extended in period (Money Away)
	const [lendingStats] = await db
		.select({
			totalLent: sql<number>`COALESCE(SUM(CAST(${lendings.amount} AS NUMERIC)), 0)`
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

	// 3. Lending Repayments received in period
	const [repaymentStats] = await db
		.select({
			repaymentsTotal: sql<number>`COALESCE(SUM(CAST(${lendingPayments.amount} AS NUMERIC)), 0)`
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

	// 4. Largest Outflow Transaction
	const largestTxRows = await db
		.select({
			description: transactions.description,
			amount: sql<number>`CAST(${transactions.amount} AS NUMERIC)`,
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
		.orderBy(sql`CAST(${transactions.amount} AS NUMERIC) DESC`)
		.limit(1);

	const largestOutflow = largestTxRows.length > 0
		? {
				description: largestTxRows[0].description,
				amount: Number(largestTxRows[0].amount),
				date: largestTxRows[0].date,
				categoryName: largestTxRows[0].categoryName ?? undefined,
			}
		: null;

	const totalExpense = Number(txStats?.totalExpense ?? 0);
	const totalIncome = Number(txStats?.totalIncome ?? 0);
	const totalLent = Number(lendingStats?.totalLent ?? 0);
	const repaymentsTotal = Number(repaymentStats?.repaymentsTotal ?? 0);
	const refundsTotal = Number(txStats?.refundsTotal ?? 0);
	const transactionCount = Number(txStats?.txCount ?? 0);

	const moneyOut = Math.max(totalExpense, totalLent > 0 && totalExpense === 0 ? totalLent : totalExpense);
	const moneyIn = totalIncome;
	const netCashFlow = moneyIn - moneyOut;
	const avgDailyDrain = resolution.daysInPeriod > 0 ? moneyOut / resolution.daysInPeriod : 0;

	return {
		moneyOut,
		moneyIn,
		netCashFlow,
		avgDailyDrain,
		transactionCount,
		largestOutflow,
		refundsTotal,
		repaymentsTotal,
	};
}


/**
 * Money Returning & Cash Flow Analysis Intelligence
 */

import { getDrizzle } from '$lib/server/db/drizzle';
import { transactions, lendingPayments } from '$lib/server/db/schema';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import type { CashFlowData, MoneyReturningData, PeriodResolution } from './analysisTypes';

export async function computeCashFlowAndReturningData(
	userId: number,
	resolution: PeriodResolution,
	moneyOut: number
): Promise<{ returning: MoneyReturningData; cashFlow: CashFlowData }> {
	const db = await getDrizzle();
	const { start, end } = resolution.current;

	// 1. Fetch Income Breakdown
	const incomeRows = await db
		.select({
			description: transactions.description,
			amount: sql<number>`CAST(${transactions.amount} AS NUMERIC)`,
		})
		.from(transactions)
		.where(
			and(
				eq(transactions.user_id, userId),
				eq(transactions.type, 'income'),
				gte(transactions.date, start),
				lte(transactions.date, end)
			)
		);

	let totalIncome = 0;
	let refunds = 0;

	for (const r of incomeRows) {
		const amt = Number(r.amount || 0);
		totalIncome += amt;
		if (r.description.toLowerCase().includes('refund')) {
			refunds += amt;
		}
	}

	// 2. Fetch Repayments
	const [repaymentRow] = await db
		.select({
			repayments: sql<number>`COALESCE(SUM(CAST(${lendingPayments.amount} AS NUMERIC)), 0)`,
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

	const repayments = Number(repaymentRow?.repayments ?? 0);
	const pureIncome = Math.max(0, totalIncome - refunds);
	const totalReturning = pureIncome + refunds + repayments;

	// 3. Outflow Ratio = Money Out / Money In
	// If Income is zero or insufficient, return null
	const moneyInForRatio = totalIncome + repayments;
	const outflowRatio = moneyInForRatio > 0 ? Math.round((moneyOut / moneyInForRatio) * 1000) / 10 : null;

	// 4. Historical Monthly Cash Flow Chart Data (Last 6 Months or Period)
	const curDate = new Date(end);
	const historicalLabels: string[] = [];
	const historicalIncome: number[] = [];
	const historicalOutflow: number[] = [];

	for (let i = 5; i >= 0; i--) {
		const mDate = new Date(curDate.getFullYear(), curDate.getMonth() - i, 1);
		const y = mDate.getFullYear();
		const m = mDate.getMonth();
		const mStart = `${y}-${String(m + 1).padStart(2, '0')}-01`;
		const lastDay = new Date(y, m + 1, 0).getDate();
		const mEnd = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

		const label = mDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
		historicalLabels.push(label);

		const [mTx] = await db
			.select({
				income: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END), 0)`,
				expense: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END), 0)`,
			})
			.from(transactions)
			.where(
				and(
					eq(transactions.user_id, userId),
					gte(transactions.date, mStart),
					lte(transactions.date, mEnd)
				)
			);

		historicalIncome.push(Number(mTx?.income ?? 0));
		historicalOutflow.push(Number(mTx?.expense ?? 0));
	}

	return {
		returning: {
			income: pureIncome,
			refunds,
			repayments,
			otherReturning: 0,
			total: totalReturning,
		},
		cashFlow: {
			historicalLabels,
			historicalIncome,
			historicalOutflow,
			outflowRatio,
		},
	};
}

/**
 * Financial Trends Domain Analysis (Money Out Trend Visualization Data)
 */

import { getDrizzle } from '$lib/server/db/drizzle';
import { transactions } from '$lib/server/db/schema';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import type { MoneyOutTrendData, PeriodResolution } from './analysisTypes';

export async function computeTrendData(
	userId: number,
	resolution: PeriodResolution
): Promise<MoneyOutTrendData> {
	const db = await getDrizzle();
	const { granularity, current } = resolution;

	const rows = await db
		.select({
			date: transactions.date,
			amount: sql<number>`SUM(CAST(${transactions.amount} AS NUMERIC))`,
		})
		.from(transactions)
		.where(
			and(
				eq(transactions.user_id, userId),
				eq(transactions.type, 'expense'),
				gte(transactions.date, current.start),
				lte(transactions.date, current.end)
			)
		)
		.groupBy(transactions.date)
		.orderBy(transactions.date);

	const currMap = new Map<string, number>();
	for (const r of rows) {
		currMap.set(r.date, Number(r.amount || 0));
	}

	const labels: string[] = [];
	const currentData: number[] = [];

	if (granularity === 'daily') {
		const currDates = generateDateSequence(current.start, current.end);

		for (const dStr of currDates) {
			const dObj = new Date(dStr);
			labels.push(dObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
			currentData.push(currMap.get(dStr) || 0);
		}
	} else if (granularity === 'weekly') {
		const currDates = generateDateSequence(current.start, current.end);
		let bucketSum = 0;
		let bucketCount = 0;
		let bucketStartLabel = '';

		for (let i = 0; i < currDates.length; i++) {
			const dStr = currDates[i];
			if (bucketCount === 0) {
				const dObj = new Date(dStr);
				bucketStartLabel = dObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
			}
			bucketSum += currMap.get(dStr) || 0;
			bucketCount++;

			if (bucketCount === 7 || i === currDates.length - 1) {
				labels.push(`Wk (${bucketStartLabel})`);
				currentData.push(bucketSum);
				bucketSum = 0;
				bucketCount = 0;
			}
		}
	} else {
		// Monthly
		const months = generateMonthSequence(current.start, current.end);

		for (const ym of months) {
			const label = new Date(`${ym}-01`).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
			labels.push(label);

			let sumCurr = 0;
			for (const [d, amt] of currMap.entries()) {
				if (d.startsWith(ym)) sumCurr += amt;
			}
			currentData.push(sumCurr);
		}
	}

	return {
		granularity,
		labels,
		currentData,
	};
}

function generateDateSequence(startStr: string, endStr: string): string[] {
	const dates: string[] = [];
	const cur = new Date(startStr);
	const end = new Date(endStr);

	while (cur <= end) {
		const year = cur.getFullYear();
		const month = String(cur.getMonth() + 1).padStart(2, '0');
		const day = String(cur.getDate()).padStart(2, '0');
		dates.push(`${year}-${month}-${day}`);
		cur.setDate(cur.getDate() + 1);
	}
	return dates;
}

function generateMonthSequence(startStr: string, endStr: string): string[] {
	const months: string[] = [];
	const cur = new Date(startStr);
	cur.setDate(1);
	const end = new Date(endStr);
	end.setDate(1);

	while (cur <= end) {
		const year = cur.getFullYear();
		const month = String(cur.getMonth() + 1).padStart(2, '0');
		months.push(`${year}-${month}`);
		cur.setMonth(cur.getMonth() + 1);
	}
	return months;
}


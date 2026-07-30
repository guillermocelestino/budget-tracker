import { queryOne, queryMany } from '$lib/database/query';
import type { NetWorthSnapshot, NetWorthLeg, CashTrendPoint, LegDelta } from '$lib/types';

/**
 * Get the user's implied cash position from all-time transaction flow.
 *
 * cash = Σ amount WHERE type='income'  MINUS  Σ amount WHERE type='expense', ALL-TIME
 *
 * Seam: swap this to real account balances when an accounts table exists —
 * change only this function. The running balance in the transactions register
 * should equal this value after processing all transactions (ascending date
 * then id). If they drift, one of the two screens is wrong — they share the
 * same underlying data.
 */
async function getCashPosition(userId: number): Promise<number> {
	const row = await queryOne<{ income: string; expense: string }>(
		`SELECT
			COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
			COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
		 FROM transactions
		 WHERE user_id = $1`,
		[userId]
	);
	return parseFloat(row?.income ?? '0') - parseFloat(row?.expense ?? '0');
}

/**
 * Get all-time active lent (asset) — direction = 'lent', status = 'active'.
 */
async function getLentPosition(userId: number): Promise<number> {
	const row = await queryOne<{ total: string }>(
		`SELECT COALESCE(SUM(amount), 0) as total
		 FROM lendings
		 WHERE user_id = $1 AND direction = 'lent' AND status = 'active'`,
		[userId]
	);
	return parseFloat(row?.total ?? '0');
}

/**
 * Get all-time active borrowed (liability) — direction = 'borrowed', status = 'active'.
 */
async function getBorrowedPosition(userId: number): Promise<number> {
	const row = await queryOne<{ total: string }>(
		`SELECT COALESCE(SUM(amount), 0) as total
		 FROM lendings
		 WHERE user_id = $1 AND direction = 'borrowed' AND status = 'active'`,
		[userId]
	);
	return parseFloat(row?.total ?? '0');
}

/**
 * Get cumulative (running-sum) cash position by month.
 *
 * Each row = the net cash flow in that month; the caller cumulates.
 * NOT scoped to user_id — called from computeNetWorth which already scopes.
 */
async function getMonthlyCashFlow(userId: number): Promise<{ month: string; net: number }[]> {
	// Use TO_CHAR for PG, translateQuery handles SQLite strftime
	const rows = await queryMany<{ month: string; income: string; expense: string }>(
		`SELECT TO_CHAR(date, 'YYYY-MM') as month,
				COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
				COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
		 FROM transactions
		 WHERE user_id = $1
		 GROUP BY month
		 ORDER BY month ASC`,
		[userId]
	);
	return rows.map(r => ({
		month: r.month,
		net: parseFloat(r.income) - parseFloat(r.expense),
	}));
}

/**
 * Get total borrowed amount that went due in the next N months (for projection).
 */
async function getUpcomingBorrowedPayments(userId: number): Promise<number> {
	const rows = await queryMany<{ total: string }>(
		`SELECT COALESCE(SUM(amount), 0) as total
		 FROM lendings
		 WHERE user_id = $1 AND direction = 'borrowed' AND status = 'active' AND due_date IS NOT NULL`,
		[userId]
	);
	return parseFloat(rows[0]?.total ?? '0');
}

export async function computeNetWorth(userId: number): Promise<NetWorthSnapshot> {
	// Scope everything at the query (no client-side sums of unfiltered lists)
	const [cash, lentActive, borrowedActive, monthlyFlows, upcomingBorrowed] = await Promise.all([
		getCashPosition(userId),
		getLentPosition(userId),
		getBorrowedPosition(userId),
		getMonthlyCashFlow(userId),
		getUpcomingBorrowedPayments(userId),
	]);

	// Build cash trend (cumulative band)
	const cashTrend: CashTrendPoint[] = [];
	let runningCash = 0;
	for (const m of monthlyFlows) {
		runningCash += m.net;
		cashTrend.push({ month: m.month, cash: runningCash });
	}

	// Net worth today
	const net = cash + lentActive - borrowedActive;

	// Build legs
	const legs: NetWorthLeg[] = [];
	if (cash !== 0 || cashTrend.length > 0) {
		legs.push({ key: 'cash', label: 'Cash position', amount: cash, tone: 'teal' });
	}
	if (lentActive > 0) {
		legs.push({ key: 'lent', label: 'Lent out', amount: lentActive, tone: 'gold' });
	}
	if (borrowedActive > 0) {
		legs.push({ key: 'borrowed', label: 'Borrowed', amount: borrowedActive, tone: 'coral', liability: true });
	}
	// If only one leg or something is off, show what exists
	if (legs.length === 0) {
		legs.push({ key: 'cash', label: 'Cash position', amount: cash, tone: 'teal' });
	}

	// Deltas vs last month (from cash trend if available)
	const deltas: LegDelta[] = [];
	if (cashTrend.length >= 2) {
		const lastMonth = cashTrend[cashTrend.length - 1];
		const prevMonth = cashTrend[cashTrend.length - 2];
		deltas.push({
			key: 'cash',
			amount: lastMonth.cash - prevMonth.cash,
			label: 'Cash flow this month',
		});
	} else if (cashTrend.length === 1) {
		deltas.push({
			key: 'cash',
			amount: cashTrend[0].cash,
			label: 'Life-to-date cash',
		});
	}

	// Biggest mover for the narrative insight
	const biggestMover: LegDelta | null = deltas.length > 0
		? deltas.reduce((a, b) => (Math.abs(a.amount) > Math.abs(b.amount) ? a : b))
		: null;

	// Honesty caption
	const caption = 'Loans & debts aren\'t tracked over time yet — the band is your cash journey with today\'s balances applied.';

	// Naive projection: last 3 months' cash slope + borrowed due_dates
	let projection: { text: string; month: string } | undefined;
	if (cashTrend.length >= 3) {
		const recent = cashTrend.slice(-3);
		const slope = (recent[2].cash - recent[0].cash) / 2; // avg monthly change over 2 intervals
		const monthlySlope = slope;
		if (monthlySlope > 0) {
			// Estimate when net worth reaches a notable milestone
			const targetFromNow = net + monthlySlope * 12; // 1 year projection
			const projMonth = new Date();
			projMonth.setMonth(projMonth.getMonth() + 12);
			const monthStr = `${projMonth.getFullYear()}-${String(projMonth.getMonth() + 1).padStart(2, '0')}`;
			projection = {
				text: `At your current pace, net worth reaches ₱${Math.round(targetFromNow).toLocaleString()} by ${monthStr}. This is a rough estimate.`,
				month: monthStr,
			};
		} else if (upcomingBorrowed > 0) {
			// Debt-free horizon
			projection = {
				text: `Your ₱${Math.round(borrowedActive).toLocaleString()} in borrowings could be cleared by focusing repayment. Debt-free horizon depends on your repayment rate.`,
				month: '',
			};
		}
	} else if (borrowedActive > 0) {
		projection = {
			text: `Clearing ₱${Math.round(borrowedActive).toLocaleString()} in active borrowings would boost net worth by that amount.`,
			month: '',
		};
	}

	return {
		net,
		legs,
		deltas,
		cashTrend,
		lentToday: lentActive,
		borrowedToday: borrowedActive,
		caption,
		projection,
		biggestMover,
	};
}

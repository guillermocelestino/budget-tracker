import { getCurrentMonth } from '$lib/utils/format';
import { getLendingTotals } from '$lib/server/lendingPayments';
import {
	getMonthlyReport,
	getCategorySpendingReport,
	getMonthlySummary,
	getTransactionCountForMonth,
	getAllTimeTransactionCount,
	getYTDSummary
} from '$lib/server/transactions';

export async function load({ url, locals }: { url: URL; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const currentYear = String(new Date().getFullYear());
	const currentMonth = getCurrentMonth();

	const year = url.searchParams.get('year') || currentYear;
	const month = url.searchParams.get('month') || currentMonth;

	// Compute previous year same month
	const prevYear = String(parseInt(year) - 1);
	const prevYearMonth = month.replace(/^\d{4}/, prevYear);

	// Compute YTD range: Jan to selected month
	const selectedMonthNum = parseInt(month.split('-')[1]);

	const monthlyData = await getMonthlyReport(userId, parseInt(year));

	const expenseData = await getCategorySpendingReport(userId, month, 'expense');
	const incomeData = await getCategorySpendingReport(userId, month, 'income');

	const monthSummary = await getMonthlySummary(userId, month);

	const transactionCount = await getTransactionCountForMonth(userId, month);

	// All-time count for E1 vs E2 empty-state distinction
	const allTimeCount = await getAllTimeTransactionCount(userId);

	// YoY: Previous year same month
	const prevMonthSummary = await getMonthlySummary(userId, prevYearMonth);

	// YoY: Current year YTD
	const currentYTD = await getYTDSummary(userId, parseInt(year), selectedMonthNum);

	// YoY: Previous year YTD
	const previousYTD = await getYTDSummary(userId, parseInt(prevYear), selectedMonthNum);

	const prevIncome = prevMonthSummary.totalIncome;
	const prevExpense = prevMonthSummary.totalExpenses;
	const currIncome = monthSummary.totalIncome;
	const currExpense = monthSummary.totalExpenses;

	const lendingTotals = await getLendingTotals(userId, 'lent');

	const currYTDIncome = currentYTD.income;
	const currYTDExpense = currentYTD.expense;
	const prevYTDIncome = previousYTD.income;
	const prevYTDExpense = previousYTD.expense;

	function pctChange(curr: number, prev: number): number {
		if (prev === 0) return curr > 0 ? 100 : 0;
		return Math.round(((curr - prev) / prev) * 100);
	}

	return {
		monthlyData,
		expenseData,
		incomeData,
		year,
		month,
		transactionCount,
		allTimeCount,
		monthSummary: {
			income: currIncome,
			expense: currExpense,
			balance: currIncome - currExpense,
		},
		yoyData: {
			prevYearMonth,
			currentMonth: { income: currIncome, expense: currExpense, balance: currIncome - currExpense },
			previousMonth: { income: prevIncome, expense: prevExpense, balance: prevIncome - prevExpense },
			currentYTD: { income: currYTDIncome, expense: currYTDExpense },
			previousYTD: { income: prevYTDIncome, expense: prevYTDExpense },
			changes: {
				monthIncomeChange: pctChange(currIncome, prevIncome),
				monthExpenseChange: pctChange(currExpense, prevExpense),
				ytdIncomeChange: pctChange(currYTDIncome, prevYTDIncome),
				ytdExpenseChange: pctChange(currYTDExpense, prevYTDExpense),
			},
		},
		lendingSummary: {
			totalLent: lendingTotals.total,
			totalRecovered: lendingTotals.cashPaid,
			// Preserve the existing report formula (total − cash paid). The
			// service's `outstanding` also subtracts write-offs; adopting it
			// would change the reports number whenever write-offs exist, so it
			// is intentionally not used here.
			outstanding: lendingTotals.total - lendingTotals.cashPaid,
		},
	};
}

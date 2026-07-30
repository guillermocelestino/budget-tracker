import { queryMany, queryOne } from '$lib/database/query';
import type { MonthlyReportItem, CategoryReportItem } from '$lib/types';
import { getCurrentMonth } from '$lib/utils/format';

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

	const monthlyData = await queryMany<MonthlyReportItem>(
		`SELECT TO_CHAR(date, 'YYYY-MM') as month,
				COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
				COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
		 FROM transactions
		 WHERE user_id = $1 AND EXTRACT(YEAR FROM date) = $2::int
		 GROUP BY month
		 ORDER BY month ASC`,
		[userId, parseInt(year)]
	);

	const expenseData = await queryMany<CategoryReportItem>(
		`SELECT c.id as category_id, c.name as category_name, c.color as category_color,
				COALESCE(SUM(t.amount), 0) as total
		 FROM categories c
		 LEFT JOIN transactions t ON t.category_id = c.id AND TO_CHAR(t.date, 'YYYY-MM') = $1 AND t.type = 'expense'
		 WHERE c.user_id = $2 AND c.type = 'expense'
		 GROUP BY c.id, c.name, c.color
		 ORDER BY total DESC`,
		[month, userId]
	);

	const incomeData = await queryMany<CategoryReportItem>(
		`SELECT c.id as category_id, c.name as category_name, c.color as category_color,
				COALESCE(SUM(t.amount), 0) as total
		 FROM categories c
		 LEFT JOIN transactions t ON t.category_id = c.id AND TO_CHAR(t.date, 'YYYY-MM') = $1 AND t.type = 'income'
		 WHERE c.user_id = $2 AND c.type = 'income'
		 GROUP BY c.id, c.name, c.color
		 ORDER BY total DESC`,
		[month, userId]
	);

	const monthSummary = await queryOne<{ income: string; expense: string }>(
		`SELECT
			COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
			COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
		 FROM transactions
		 WHERE user_id = $1 AND TO_CHAR(date, 'YYYY-MM') = $2`,
		[userId, month]
	);

		const countResult = await queryOne<{ count: string }>(
			`SELECT COUNT(*) as count
			 FROM transactions
			 WHERE user_id = $1 AND TO_CHAR(date, 'YYYY-MM') = $2`,
			[userId, month]
		);
		const transactionCount = parseInt(countResult?.count ?? '0');

	// YoY: Previous year same month
	const prevYearSummary = await queryOne<{ income: string; expense: string }>(
		`SELECT
			COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
			COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
		 FROM transactions
		 WHERE user_id = $1 AND TO_CHAR(date, 'YYYY-MM') = $2`,
		[userId, prevYearMonth]
	);

	// YoY: Current year YTD
	const currentYTD = await queryOne<{ income: string; expense: string }>(
		`SELECT
			COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
			COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
		 FROM transactions
		 WHERE user_id = $1 AND EXTRACT(YEAR FROM date) = $2::int AND EXTRACT(MONTH FROM date) <= $3::int`,
		[userId, parseInt(year), selectedMonthNum]
	);

	// YoY: Previous year YTD
	const previousYTD = await queryOne<{ income: string; expense: string }>(
		`SELECT
			COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
			COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
		 FROM transactions
		 WHERE user_id = $1 AND EXTRACT(YEAR FROM date) = $2::int AND EXTRACT(MONTH FROM date) <= $3::int`,
		[userId, parseInt(prevYear), selectedMonthNum]
	);

	const prevIncome = parseFloat(prevYearSummary?.income ?? '0');
	const prevExpense = parseFloat(prevYearSummary?.expense ?? '0');
	const currIncome = parseFloat(monthSummary?.income ?? '0');
	const currExpense = parseFloat(monthSummary?.expense ?? '0');

	const lendingSummary = await queryOne<{ totalLent: string; totalRecovered: string }>(
		`SELECT
			COALESCE(SUM(amount), 0) as "totalLent",
			COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as "totalRecovered"
		 FROM lendings
		 WHERE user_id = $1 AND direction = 'lent'`,
		[userId]
	);

	const currYTDIncome = parseFloat(currentYTD?.income ?? '0');
	const currYTDExpense = parseFloat(currentYTD?.expense ?? '0');
	const prevYTDIncome = parseFloat(previousYTD?.income ?? '0');
	const prevYTDExpense = parseFloat(previousYTD?.expense ?? '0');

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
		monthSummary: {
			income: currIncome,
			expense: currExpense,
			balance: currIncome - currExpense,
		},
		yoyData: {
			prevYearMonth,
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
			totalLent: parseFloat(lendingSummary?.totalLent ?? '0'),
			totalRecovered: parseFloat(lendingSummary?.totalRecovered ?? '0'),
			outstanding: parseFloat(lendingSummary?.totalLent ?? '0') - parseFloat(lendingSummary?.totalRecovered ?? '0'),
		},
	};
}

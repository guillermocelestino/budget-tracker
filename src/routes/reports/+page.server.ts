import { queryMany, queryOne } from '$lib/database/query';
import type { MonthlyReportItem, CategoryReportItem } from '$lib/types';

export async function load({ url }: { url: URL }) {
	const currentYear = String(new Date().getFullYear());
	const currentMonth = `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

	const year = url.searchParams.get('year') || currentYear;
	const month = url.searchParams.get('month') || currentMonth;

	const monthlyData = await queryMany<MonthlyReportItem>(
		`SELECT TO_CHAR(date, 'YYYY-MM') as month,
				COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
				COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
		 FROM transactions
		 WHERE EXTRACT(YEAR FROM date) = $1::int
		 GROUP BY month
		 ORDER BY month ASC`,
		[parseInt(year)]
	);

	const categoryData = await queryMany<CategoryReportItem>(
		`SELECT c.id as category_id, c.name as category_name, c.color as category_color,
				COALESCE(SUM(t.amount), 0) as total
		 FROM categories c
		 LEFT JOIN transactions t ON t.category_id = c.id AND TO_CHAR(t.date, 'YYYY-MM') = $1 AND t.type = 'expense'
		 GROUP BY c.id, c.name, c.color
		 ORDER BY total DESC`,
		[month]
	);

	const monthSummary = await queryOne<{ income: string; expense: string }>(
		`SELECT
			COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
			COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
		 FROM transactions
		 WHERE TO_CHAR(date, 'YYYY-MM') = $1`,
		[month]
	);

	return {
		monthlyData,
		categoryData,
		year,
		month,
		monthSummary: {
			income: parseFloat(monthSummary?.income ?? '0'),
			expense: parseFloat(monthSummary?.expense ?? '0'),
			balance: parseFloat(monthSummary?.income ?? '0') - parseFloat(monthSummary?.expense ?? '0'),
		},
	};
}

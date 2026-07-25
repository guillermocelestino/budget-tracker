import { json } from '@sveltejs/kit';
import { queryMany } from '$lib/database/query';
import type { MonthlyReportItem } from '$lib/types';

export async function GET({ url }: { url: URL }) {
	const year = url.searchParams.get('year') || String(new Date().getFullYear());

	const rows = await queryMany<MonthlyReportItem>(
		`SELECT TO_CHAR(date, 'YYYY-MM') as month,
				SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
				SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
		 FROM transactions
		 WHERE EXTRACT(YEAR FROM date) = $1::int
		 GROUP BY month
		 ORDER BY month ASC`,
		[parseInt(year)]
	);

	return json(rows);
}

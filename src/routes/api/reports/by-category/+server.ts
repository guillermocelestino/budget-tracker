import { json } from '@sveltejs/kit';
import { queryMany } from '$lib/database/query';
import type { CategoryReportItem } from '$lib/types';

function getCurrentMonthParam(): string {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export async function GET({ url }: { url: URL }) {
	const month = url.searchParams.get('month') || getCurrentMonthParam();
	const type = url.searchParams.get('type') || 'expense';

	const rows = await queryMany<CategoryReportItem>(
		`SELECT c.id as category_id, c.name as category_name, c.color as category_color, SUM(t.amount) as total
		 FROM transactions t
		 JOIN categories c ON t.category_id = c.id
		 WHERE TO_CHAR(t.date, 'YYYY-MM') = $1 AND t.type = $2
		 GROUP BY t.category_id, c.id, c.name, c.color
		 ORDER BY total DESC`,
		[month, type]
	);

	return json(rows);
}

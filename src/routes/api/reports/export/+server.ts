import { queryMany } from '$lib/database/query';
import { transactionsToCSV } from '$lib/utils/format';
import type { Transaction } from '$lib/types';

export async function GET({ url, locals }: { url: URL; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const year = url.searchParams.get('year') || String(new Date().getFullYear());
	const month = url.searchParams.get('month') || '';

	let dateFrom: string;
	let dateTo: string;

	if (month) {
		dateFrom = `${month}-01`;
		const [y, m] = month.split('-').map(Number);
		const lastDay = new Date(y, m, 0).getDate();
		dateTo = `${month}-${String(lastDay).padStart(2, '0')}`;
	} else {
		dateFrom = `${year}-01-01`;
		dateTo = `${year}-12-31`;
	}

	const transactions = await queryMany<Transaction>(
		`SELECT t.*, c.name as category_name, c.color as category_color
		 FROM transactions t
		 LEFT JOIN categories c ON t.category_id = c.id
		 WHERE t.user_id = $1 AND t.date >= $2 AND t.date <= $3
		 ORDER BY t.date DESC, t.id DESC`,
		[userId, dateFrom, dateTo]
	);

	const csv = transactionsToCSV(transactions);
	const filename = `report-${month || year}-${new Date().toISOString().split('T')[0]}.csv`;

	return new Response(csv, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${filename}"`,
		},
	});
}

import { queryMany } from '$lib/database/query';
import { transactionsToCSV } from '$lib/utils/format';
import type { Transaction } from '$lib/types';

export async function GET({ url, locals }: { url: URL; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const type = url.searchParams.get('type');
	const category_id = url.searchParams.get('category_id');
	const date_from = url.searchParams.get('date_from');
	const date_to = url.searchParams.get('date_to');
	const exportType = url.searchParams.get('exportType') || 'all';

	const limit = 20;
	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
	const offset = (page - 1) * limit;

	const conditions: string[] = ['t.user_id = $1'];
	const params: (string | number)[] = [userId];

	if (type && (type === 'income' || type === 'expense')) {
		conditions.push('t.type = $' + (params.length + 1));
		params.push(type);
	}
	if (category_id) {
		conditions.push('t.category_id = $' + (params.length + 1));
		params.push(parseInt(category_id));
	}
	if (date_from) {
		conditions.push('t.date >= $' + (params.length + 1));
		params.push(date_from);
	}
	if (date_to) {
		conditions.push('t.date <= $' + (params.length + 1));
		params.push(date_to);
	}

	const where = 'WHERE ' + conditions.join(' AND ');

	let sql: string;
	let queryParams: (string | number)[];

	if (exportType === 'page') {
		sql = `SELECT t.*, c.name as category_name, c.color as category_color
			 FROM transactions t
			 LEFT JOIN categories c ON t.category_id = c.id
			 ${where}
			 ORDER BY t.date DESC, t.id DESC
			 LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
		queryParams = [...params, limit, offset];
	} else {
		sql = `SELECT t.*, c.name as category_name, c.color as category_color
			 FROM transactions t
			 LEFT JOIN categories c ON t.category_id = c.id
			 ${where}
			 ORDER BY t.date DESC, t.id DESC`;
		queryParams = params;
	}

	const transactions = await queryMany<Transaction>(sql, queryParams);
	const csv = transactionsToCSV(transactions);
	const filename = `transactions-${exportType}-${new Date().toISOString().split('T')[0]}.csv`;

	return new Response(csv, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${filename}"`,
		},
	});
}

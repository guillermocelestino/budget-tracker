import { fail } from '@sveltejs/kit';
import { queryOne, queryMany, execute } from '$lib/database/query';
import type { Transaction, Category } from '$lib/types';
import { transactionsToCSV } from '$lib/utils/format';

export async function load({ url, locals }: { url: URL; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
	const limit = 20;
	const offset = (page - 1) * limit;
	const type = url.searchParams.get('type');
	const category_id = url.searchParams.get('category_id');
	const date_from = url.searchParams.get('date_from');
	const date_to = url.searchParams.get('date_to');

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

	const countRow = await queryOne<{ total: number }>(
		`SELECT COUNT(*)::int as total FROM transactions t ${where}`,
		params
	);

	const transactions = await queryMany<Transaction>(
		`SELECT t.*, c.name as category_name, c.color as category_color
		 FROM transactions t
		 LEFT JOIN categories c ON t.category_id = c.id
		 ${where}
		 ORDER BY t.date DESC, t.id DESC
		 LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
		[...params, limit, offset]
	);

	// Fetch ALL transactions matching the current filter (no pagination) for running balance computation
	// This ensures the running balance column is correct across pages
	const allForBalance = await queryMany<Transaction>(
		`SELECT t.*, c.name as category_name, c.color as category_color
		 FROM transactions t
		 LEFT JOIN categories c ON t.category_id = c.id
		 ${where}
		 ORDER BY t.date ASC, t.id ASC`,
		params
	);

	const categories = await queryMany<Category>('SELECT * FROM categories WHERE user_id = $1 ORDER BY name ASC', [userId]);

	return {
		transactions,
		allForBalance,
		total: countRow?.total ?? 0,
		page,
		totalPages: Math.ceil((countRow?.total ?? 0) / limit),
		categories,
	};
}

export const actions = {
	delete: async ({ request, locals }) => {
		const userId = locals.user!.userId;
		const data = await request.formData();
		const id = parseInt(data.get('id') as string);

		if (isNaN(id)) {
			return fail(400, { error: 'Invalid transaction ID' });
		}

		const existing = await queryOne<{ id: number }>('SELECT id FROM transactions WHERE user_id = $1 AND id = $2', [userId, id]);
		if (!existing) {
			return fail(404, { error: 'Transaction not found' });
		}

		await execute('DELETE FROM transactions WHERE user_id = $1 AND id = $2', [userId, id]);
		return { success: true };
	},
};

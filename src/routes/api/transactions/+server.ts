import { json } from '@sveltejs/kit';
import { queryOne, queryMany, execute } from '$lib/database/query';
import type { Transaction } from '$lib/types';

export async function GET({ url, locals }: { url: URL; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
	const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20')));
	const offset = (page - 1) * limit;
	const type = url.searchParams.get('type');
	const category_id = url.searchParams.get('category_id');
	const date_from = url.searchParams.get('date_from');
	const date_to = url.searchParams.get('date_to');
	const sort = url.searchParams.get('sort') === 'amount' ? 'amount' : 'date';
	const order = url.searchParams.get('order') === 'asc' ? 'ASC' : 'DESC';

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
		 ORDER BY t.${sort} ${order}
		 LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
		[...params, limit, offset]
	);

	return json({
		items: transactions,
		total: countRow?.total ?? 0,
		page,
		totalPages: Math.ceil((countRow?.total ?? 0) / limit),
	});
}

export async function POST({ request, locals }: { request: Request; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const body = await request.json();

	const { type, amount, description, date, category_id } = body;

	if (!type || !['income', 'expense'].includes(type)) {
		return json({ error: 'Type must be "income" or "expense"' }, { status: 400 });
	}
	if (!amount || typeof amount !== 'number' || amount <= 0) {
		return json({ error: 'Amount must be a positive number' }, { status: 400 });
	}
	if (!description || typeof description !== 'string' || description.trim().length === 0) {
		return json({ error: 'Description is required' }, { status: 400 });
	}
	if (!date || typeof date !== 'string') {
		return json({ error: 'Date is required' }, { status: 400 });
	}
	if (!category_id || typeof category_id !== 'number') {
		return json({ error: 'Category is required' }, { status: 400 });
	}

	const category = await queryOne<{ id: number }>('SELECT id FROM categories WHERE user_id = $1 AND id = $2', [userId, category_id]);
	if (!category) {
		return json({ error: 'Category not found' }, { status: 400 });
	}

	await execute(
		`INSERT INTO transactions (user_id, amount, description, date, category_id, type)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		[userId, amount, description.trim(), date, category_id, type]
	);

	const transaction = await queryOne<Transaction>(
		`SELECT t.*, c.name as category_name, c.color as category_color
		 FROM transactions t
		 LEFT JOIN categories c ON t.category_id = c.id
		 WHERE t.user_id = $1
		 ORDER BY t.id DESC LIMIT 1`,
		[userId]
	);

	return json(transaction, { status: 201 });
}

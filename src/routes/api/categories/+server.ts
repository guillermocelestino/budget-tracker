import { json } from '@sveltejs/kit';
import { queryOne, queryMany, execute } from '$lib/database/query';
import type { Category } from '$lib/types';

export async function GET({ url, locals }: { url: URL; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const categories = await queryMany<Category>('SELECT * FROM categories WHERE user_id = $1 ORDER BY name ASC', [userId]);

	const withSpending = url.searchParams.get('with_spending') === 'true';
	if (withSpending) {
		const spending = await queryMany<{ category_id: number; total: number }>(
			`SELECT category_id, SUM(amount) as total
			 FROM transactions
			 WHERE type = 'expense' AND user_id = $1 AND TO_CHAR(date, 'YYYY-MM') = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
			 GROUP BY category_id`,
			[userId]
		);

		const spendingMap = new Map(spending.map(s => [s.category_id, parseFloat(String(s.total))]));
		return json({
			categories,
			spending: Object.fromEntries(spendingMap),
		});
	}

	return json(categories);
}

export async function POST({ request, locals }: { request: Request; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const body = await request.json();

	const { name, color, icon, budget_limit, type: categoryType } = body;

	if (!name || typeof name !== 'string' || name.trim().length === 0) {
		return json({ error: 'Name is required' }, { status: 400 });
	}

	const existing = await queryOne<{ id: number }>('SELECT id FROM categories WHERE user_id = $1 AND name = $2', [userId, name.trim()]);
	if (existing) {
		return json({ error: 'A category with this name already exists' }, { status: 409 });
	}

	await execute(
		'INSERT INTO categories (user_id, name, color, icon, type, budget_limit) VALUES ($1, $2, $3, $4, $5, $6)',
		[userId, name.trim(), color || '#6366f1', icon || '📁', categoryType || 'expense', budget_limit != null && !isNaN(budget_limit) ? budget_limit : null]
	);

	const category = await queryOne<Category>('SELECT * FROM categories WHERE user_id = $1 ORDER BY id DESC LIMIT 1', [userId]);
	return json(category, { status: 201 });
}

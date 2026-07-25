import { json } from '@sveltejs/kit';
import { queryOne, queryMany, execute } from '$lib/database/query';
import type { Category } from '$lib/types';

export async function GET({ url }: { url: URL }) {
	const categories = await queryMany<Category>('SELECT * FROM categories ORDER BY name ASC');

	const withSpending = url.searchParams.get('with_spending') === 'true';
	if (withSpending) {
		const spending = await queryMany<{ category_id: number; total: number }>(
			`SELECT category_id, SUM(amount) as total
			 FROM transactions
			 WHERE type = 'expense' AND TO_CHAR(date, 'YYYY-MM') = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
			 GROUP BY category_id`
		);

		const spendingMap = new Map(spending.map(s => [s.category_id, parseFloat(s.total)]));
		return json({
			categories,
			spending: Object.fromEntries(spendingMap),
		});
	}

	return json(categories);
}

export async function POST({ request }: { request: Request }) {
	const body = await request.json();

	const { name, color, icon, budget_limit } = body;

	if (!name || typeof name !== 'string' || name.trim().length === 0) {
		return json({ error: 'Name is required' }, { status: 400 });
	}

	const existing = await queryOne<{ id: number }>('SELECT id FROM categories WHERE name = $1', [name.trim()]);
	if (existing) {
		return json({ error: 'A category with this name already exists' }, { status: 409 });
	}

	await execute(
		'INSERT INTO categories (name, color, icon, budget_limit) VALUES ($1, $2, $3, $4)',
		[name.trim(), color || '#6366f1', icon || '📁', budget_limit != null && !isNaN(budget_limit) ? budget_limit : null]
	);

	const category = await queryOne<Category>('SELECT * FROM categories ORDER BY id DESC LIMIT 1');
	return json(category, { status: 201 });
}

import { fail } from '@sveltejs/kit';
import { queryOne, queryMany, execute } from '$lib/database/query';
import type { Category } from '$lib/types';

export async function load() {
	const categories = await queryMany<Category>('SELECT * FROM categories ORDER BY name ASC');

	const spending = await queryMany<{ category_id: number; total: number }>(
		`SELECT category_id, SUM(amount) as total
		 FROM transactions
		 WHERE type = 'expense' AND TO_CHAR(date, 'YYYY-MM') = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
		 GROUP BY category_id`
	);

	const spendingMap: Record<number, number> = {};
	for (const s of spending) {
		spendingMap[s.category_id] = parseFloat(s.total);
	}

	return { categories, spending: spendingMap };
}

export const actions = {
	create: async ({ request }) => {
		const data = await request.formData();

		const name = (data.get('name') as string)?.trim();
		const color = (data.get('color') as string) || '#6366f1';
		const icon = (data.get('icon') as string) || '📁';
		const budgetLimitStr = data.get('budget_limit') as string;

		if (!name || name.length === 0) {
			return fail(400, { error: 'Name is required', field: 'name' });
		}

		const existing = await queryOne<{ id: number }>('SELECT id FROM categories WHERE name = $1', [name]);
		if (existing) {
			return fail(409, { error: 'A category with this name already exists', field: 'name' });
		}

		const budget_limit = budgetLimitStr && budgetLimitStr.length > 0 && !isNaN(parseFloat(budgetLimitStr))
			? parseFloat(budgetLimitStr)
			: null;

		await execute(
			'INSERT INTO categories (name, color, icon, budget_limit) VALUES ($1, $2, $3, $4)',
			[name, color, icon, budget_limit]
		);

		return { success: true };
	},

	update: async ({ request }) => {
		const data = await request.formData();

		const id = parseInt(data.get('id') as string);
		const name = (data.get('name') as string)?.trim();
		const color = (data.get('color') as string) || '#6366f1';
		const icon = (data.get('icon') as string) || '📁';
		const budgetLimitStr = data.get('budget_limit') as string;

		if (isNaN(id)) return fail(400, { error: 'Invalid ID' });
		if (!name || name.length === 0) return fail(400, { error: 'Name is required', field: 'name' });

		const existing = await queryOne<{ id: number }>(
			'SELECT id FROM categories WHERE name = $1 AND id != $2',
			[name, id]
		);
		if (existing) return fail(409, { error: 'A category with this name already exists', field: 'name' });

		const budget_limit = budgetLimitStr && budgetLimitStr.length > 0 && !isNaN(parseFloat(budgetLimitStr))
			? parseFloat(budgetLimitStr)
			: null;

		await execute(
			'UPDATE categories SET name = $1, color = $2, icon = $3, budget_limit = $4 WHERE id = $5',
			[name, color, icon, budget_limit, id]
		);

		return { success: true };
	},

	delete: async ({ request }) => {
		const data = await request.formData();
		const id = parseInt(data.get('id') as string);

		if (isNaN(id)) return fail(400, { error: 'Invalid ID' });

		const existing = await queryOne<{ id: number }>('SELECT id FROM categories WHERE id = $1', [id]);
		if (!existing) return fail(404, { error: 'Category not found' });

		try {
			await execute('DELETE FROM categories WHERE id = $1', [id]);
			return { success: true };
		} catch {
			return fail(409, { error: 'Cannot delete: this category has transactions' });
		}
	},
};

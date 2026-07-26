import { error, fail, redirect } from '@sveltejs/kit';
import { queryOne, queryMany, execute } from '$lib/database/query';
import type { Transaction, Category } from '$lib/types';

export async function load({ params, locals }: { params: { id: string }; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const id = parseInt(params.id);
	if (isNaN(id)) error(400, 'Invalid ID');

	const transaction = await queryOne<Transaction>(
		`SELECT t.*, c.name as category_name, c.color as category_color
		 FROM transactions t
		 LEFT JOIN categories c ON t.category_id = c.id
		 WHERE t.id = $1 AND t.user_id = $2`,
		[id, userId]
	);

	if (!transaction) error(404, 'Transaction not found');

	const categories = await queryMany<Category>('SELECT * FROM categories WHERE user_id = $1 ORDER BY name ASC', [userId]);

	return { transaction, categories };
}

export const actions = {
	default: async ({ request, params, locals }) => {
		const userId = locals.user!.userId;
		const id = parseInt(params.id);
		if (isNaN(id)) return fail(400, { error: 'Invalid ID' });

		const existing = await queryOne<{ id: number }>('SELECT id FROM transactions WHERE user_id = $1 AND id = $2', [userId, id]);
		if (!existing) return fail(404, { error: 'Transaction not found' });

		const data = await request.formData();
		const type = data.get('type') as string;
		const amountStr = data.get('amount') as string;
		const description = data.get('description') as string;
		const date = data.get('date') as string;
		const category_id = data.get('category_id') as string;

		const errors: Record<string, string> = {};
		if (!type || !['income', 'expense'].includes(type)) errors.type = 'Select a type';
		if (!amountStr || isNaN(parseFloat(amountStr)) || parseFloat(amountStr) <= 0) errors.amount = 'Enter a valid amount';
		if (!description || description.trim().length === 0) errors.description = 'Enter a description';
		if (!date) errors.date = 'Select a date';
		if (!category_id || isNaN(parseInt(category_id))) errors.category_id = 'Select a category';

		if (Object.keys(errors).length > 0) {
			return fail(400, { errors, values: { type, amount: amountStr, description, date, category_id } });
		}

		await execute(
			`UPDATE transactions
			 SET amount = $1, description = $2, date = $3, category_id = $4, type = $5, updated_at = NOW()
			 WHERE user_id = $6 AND id = $7`,
			[parseFloat(amountStr), description.trim(), date, parseInt(category_id), type, userId, id]
		);

		redirect(303, '/transactions');
	},
};

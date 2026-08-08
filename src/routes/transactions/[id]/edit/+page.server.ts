import { error, fail, redirect } from '@sveltejs/kit';
import { queryMany } from '$lib/database/query';
import { getTransaction, updateTransaction } from '$lib/server/transactions';
import type { Category } from '$lib/types';

export async function load({ params, locals }: { params: { id: string }; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const id = parseInt(params.id);
	if (isNaN(id)) error(400, 'Invalid ID');

	const transaction = await getTransaction(userId, id);

	if (!transaction) error(404, 'Transaction not found');

	const categories = await queryMany<Category>('SELECT * FROM categories WHERE user_id = $1 ORDER BY name ASC', [userId]);

	return { transaction, categories };
}

export const actions = {
	default: async ({ request, params, locals }) => {
		const userId = locals.user!.userId;
		const id = parseInt(params.id);
		if (isNaN(id)) return fail(400, { error: 'Invalid ID' });

		const data = await request.formData();
		const type = data.get('type') as string;
		const amountStr = data.get('amount') as string;
		const description = data.get('description') as string;
		const date = data.get('date') as string;
		const category_id = data.get('category_id') as string;

		const errors: Record<string, string> = {};
		if (!type || !['income', 'expense'].includes(type)) errors.type = 'Select a type';
		if (!amountStr || isNaN(parseFloat(amountStr)) || parseFloat(amountStr) === 0) errors.amount = 'Enter a valid amount';
		if (!description || description.trim().length === 0) errors.description = 'Enter a description';
		if (!date) errors.date = 'Select a date';
		if (!category_id || isNaN(parseInt(category_id))) errors.category_id = 'Select a category';

		if (Object.keys(errors).length > 0) {
			return fail(400, { errors, values: { type, amount: amountStr, description, date, category_id } });
		}

		try {
			const success = await updateTransaction(userId, id, {
				type: type as 'income' | 'expense',
				amount: parseFloat(amountStr),
				description,
				date,
				category_id: parseInt(category_id, 10),
			});
			if (!success) {
				return fail(404, { error: 'Transaction not found' });
			}
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			if (message === 'Category not found') {
				return fail(400, {
					errors: { category_id: 'Category not found' },
					values: { type, amount: amountStr, description, date, category_id }
				});
			}
			return fail(400, { error: message });
		}

		redirect(303, '/transactions');
	},
};

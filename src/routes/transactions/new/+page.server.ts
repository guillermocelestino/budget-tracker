import { fail, redirect } from '@sveltejs/kit';
import { queryMany, execute } from '$lib/database/query';
import type { Category } from '$lib/types';

export async function load({ locals }: { locals: App.Locals }) {
	const userId = locals.user!.userId;
	const categories = await queryMany<Category>('SELECT * FROM categories WHERE user_id = $1 ORDER BY name ASC', [userId]);
	return { categories };
}

export const actions = {
	default: async ({ request, locals }) => {
		const userId = locals.user!.userId;
		const data = await request.formData();

		const type = data.get('type') as string;
		const amountStr = data.get('amount') as string;
		const description = data.get('description') as string;
		const date = data.get('date') as string;
		const category_id = data.get('category_id') as string;

		const errors: Record<string, string> = {};

		if (!type || !['income', 'expense'].includes(type)) {
			errors.type = 'Select a type';
		}
		if (!amountStr || isNaN(parseFloat(amountStr)) || parseFloat(amountStr) === 0) {
			errors.amount = 'Enter a valid amount';
		}
		if (!description || description.trim().length === 0) {
			errors.description = 'Enter a description';
		}
		if (!date) {
			errors.date = 'Select a date';
		}
		if (!category_id || isNaN(parseInt(category_id))) {
			errors.category_id = 'Select a category';
		}

		if (Object.keys(errors).length > 0) {
			return fail(400, { errors, values: { type, amount: amountStr, description, date, category_id } });
		}

		await execute(
			`INSERT INTO transactions (user_id, amount, description, date, category_id, type)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			[userId, parseFloat(amountStr), description.trim(), date, parseInt(category_id), type]
		);

		redirect(303, '/transactions');
	},
};

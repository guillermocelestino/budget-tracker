import { fail, redirect } from '@sveltejs/kit';
import { queryOne, queryMany, execute } from '$lib/database/query';
import type { Category, Transaction } from '$lib/types';

export async function load() {
	const categories = await queryMany<Category>('SELECT * FROM categories ORDER BY name ASC');
	return { categories };
}

export const actions = {
	default: async ({ request }) => {
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
		if (!amountStr || isNaN(parseFloat(amountStr)) || parseFloat(amountStr) <= 0) {
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
			`INSERT INTO transactions (amount, description, date, category_id, type)
			 VALUES ($1, $2, $3, $4, $5)`,
			[parseFloat(amountStr), description.trim(), date, parseInt(category_id), type]
		);

		redirect(303, '/transactions');
	},
};

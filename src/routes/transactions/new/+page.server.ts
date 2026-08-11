import { fail, redirect } from '@sveltejs/kit';
import { createTransaction } from '$lib/server/services/transactions';
import { getCategories } from '$lib/server/services/categories';

export async function load({ locals }: { locals: App.Locals }) {
	const userId = locals.user!.userId;
	const categories = await getCategories(userId);
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
		const source_of_funds = data.get('source_of_funds') as string | null;

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

		try {
			await createTransaction(userId, {
				type: type as 'income' | 'expense',
				amount: parseFloat(amountStr),
				description,
				date,
				category_id: parseInt(category_id, 10),
				source_of_funds,
			});
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

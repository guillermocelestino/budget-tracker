import { fail, redirect } from '@sveltejs/kit';
import { queryMany } from '$lib/database/query';
import type { Category, TransactionType, RecurringFrequency } from '$lib/types';
import { createRecurringTransaction } from '$lib/server/recurringService';
import type { RecurringInput } from '$lib/server/recurringService';

export async function load({ locals }: { locals: App.Locals }) {
	const userId = locals.user!.userId;
	const categories = await queryMany<Category>('SELECT * FROM categories WHERE user_id = $1 ORDER BY name ASC', [userId]);
	return { categories };
}

export const actions = {
	create: async ({ request, locals }: { request: Request; locals: App.Locals }) => {
		const userId = locals.user!.userId;
		const data = await request.formData();

		const input: RecurringInput = {
			type: data.get('type') as TransactionType,
			amount: parseFloat(data.get('amount') as string),
			description: data.get('description') as string,
			category_id: parseInt(data.get('category_id') as string),
			frequency: data.get('frequency') as RecurringFrequency,
			interval: parseInt(data.get('interval') as string) || 1,
			day_of_week: null,
			day_of_month: null,
			month_of_year: null,
			start_date: data.get('start_date') as string,
			end_date: (data.get('end_date') as string) || null,
			active: data.get('active') === 'on',
		};

		const result = await createRecurringTransaction(userId, input);

		if (!result.success) {
			if (result.errors) {
				return fail(400, { errors: result.errors, values: input });
			}
			return fail(400, { error: result.error });
		}

		throw redirect(303, '/recurring');
	},
};

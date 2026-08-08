import { fail, redirect } from '@sveltejs/kit';
import type { TransactionType, RecurringFrequency } from '$lib/types';
import { updateRecurringTransaction, getRecurringById } from '$lib/server/recurringService';
import type { RecurringInput } from '$lib/server/recurringService';
import { getCategories } from '$lib/server/categories';

export async function load({ params, locals }: { params: { id: string }; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const id = parseInt(params.id, 10);

	const recurring = await getRecurringById(userId, id);

	if (!recurring) {
		return fail(404, { error: 'Recurring transaction not found' });
	}

	const categories = await getCategories(userId);

	return { recurring, categories };
}

export const actions = {
	update: async ({ request, params, locals }: { request: Request; params: { id: string }; locals: App.Locals }) => {
		const userId = locals.user!.userId;
		const id = parseInt(params.id, 10);
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

		const result = await updateRecurringTransaction(userId, id, input);

		if (!result.success) {
			if (result.errors) {
				return fail(400, { errors: result.errors, values: input });
			}
			return fail(400, { error: result.error });
		}

		throw redirect(303, '/recurring');
	},
};

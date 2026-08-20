import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { TransactionType, RecurringFrequency } from '$lib/types';
import {
	updateRecurringTransaction,
	deleteRecurringTransaction,
	deleteRecurringTransactions
} from '$lib/server/services/recurringService';
import type { RecurringInput } from '$lib/server/services/recurringService';
import { loadCommittedWorkspaceData } from '$lib/server/services/committedWorkspaceLoad';

export const load: PageServerLoad = async ({ url, locals }) => {
	return loadCommittedWorkspaceData({ url, locals, defaultView: 'recurring' });
};

export const actions: Actions = {
	update: async ({ request, locals }) => {
		const userId = locals.user!.userId;
		const data = await request.formData();
		const id = parseInt(data.get('id') as string, 10);
		if (isNaN(id)) return fail(400, { error: 'Invalid recurring ID' });

		const type = (data.get('type') as TransactionType) || 'expense';
		const amountStr = (data.get('amount') as string)?.replace(/,/g, '');
		const amount = parseFloat(amountStr);
		const description = (data.get('description') as string)?.trim();
		const rawCatId = data.get('category_id') as string;
		const category_id = parseInt(rawCatId, 10);
		const frequency = (data.get('frequency') as RecurringFrequency) || 'monthly';
		const interval = parseInt(data.get('interval') as string, 10) || 1;
		const start_date = data.get('start_date') as string;
		const end_date = (data.get('end_date') as string) || null;
		const active = data.get('active') === 'on' || data.get('active') === 'true';

		if (!description) return fail(400, { error: 'Description is required' });
		if (isNaN(amount) || amount <= 0) return fail(400, { error: 'Valid amount is required' });
		if (!start_date) return fail(400, { error: 'Start date is required' });

		const input: RecurringInput = {
			type,
			amount,
			description,
			category_id: isNaN(category_id) ? 1 : category_id,
			frequency,
			interval,
			day_of_week: null,
			day_of_month: null,
			month_of_year: null,
			start_date,
			end_date,
			active
		};

		const result = await updateRecurringTransaction(userId, id, input);
		if (!result.success) {
			if (result.errors) {
				return fail(400, { errors: result.errors, values: input });
			}
			return fail(400, { error: result.error || 'Failed to update recurring transaction' });
		}

		return { success: true };
	},

	delete: async ({ request, locals }) => {
		const userId = locals.user!.userId;
		const data = await request.formData();
		const id = parseInt(data.get('id') as string, 10);
		if (isNaN(id)) return fail(400, { error: 'Invalid ID' });

		try {
			const deleted = await deleteRecurringTransaction(userId, id);
			if (!deleted) return fail(400, { error: 'Failed to delete recurring transaction' });
			return { success: true };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Failed to delete recurring transaction';
			return fail(400, { error: message });
		}
	},

	deleteBulk: async ({ request, locals }) => {
		const userId = locals.user!.userId;
		const data = await request.formData();
		const raw = (data.get('id') as string) ?? '';
		const ids = raw
			.split(',')
			.map((s) => parseInt(s.trim(), 10))
			.filter((n) => !isNaN(n) && n > 0);

		if (ids.length === 0) {
			return fail(400, { error: 'No valid recurring IDs provided' });
		}

		try {
			const deleted = await deleteRecurringTransactions(userId, ids);
			return { success: true, deleted };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Failed to delete recurring transactions';
			return fail(400, { error: message });
		}
	}
};

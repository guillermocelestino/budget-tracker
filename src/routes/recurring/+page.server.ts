import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { deleteRecurringTransaction, deleteRecurringTransactions } from '$lib/server/services/recurringService';

export const load: PageServerLoad = async ({ url }) => {
	const view = url.searchParams.get('view');
	const params = new URLSearchParams(url.searchParams);
	params.delete('view');
	const queryString = params.toString() ? `?${params.toString()}` : '';

	if (view === 'borrowed') {
		throw redirect(307, `/committed/borrowed${queryString}`);
	} else {
		throw redirect(307, `/committed/recurring${queryString}`);
	}
};

export const actions: Actions = {
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
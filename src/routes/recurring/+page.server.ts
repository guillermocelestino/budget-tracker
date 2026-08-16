import { fail } from '@sveltejs/kit';
import { deleteRecurringTransactions } from '$lib/server/services/recurringService';
import { loadCommittedWorkspaceData } from '$lib/server/services/committedWorkspaceLoad';

export async function load({ url, locals }: { url: URL; locals: App.Locals }) {
	return loadCommittedWorkspaceData({ url, locals, defaultView: 'borrowed' });
}

export const actions = {
	deleteBulk: async ({ request, locals }: { request: Request; locals: App.Locals }) => {
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
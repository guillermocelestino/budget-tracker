import { fail } from '@sveltejs/kit';
import { listRecurringTransactions, getActiveRecurringCount, deleteRecurringTransactions } from '$lib/server/services/recurringService';
import type { RecurringFilters } from '$lib/server/services/recurringService';
import { getCategories } from '$lib/server/services/categories';

export async function load({ url, locals }: { url: URL; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const rawPage = parseInt(url.searchParams.get('page') ?? '1', 10);
	let page = Number.isFinite(rawPage) ? Math.max(1, rawPage) : 1;

	const rawLimit = url.searchParams.get('limit') ?? url.searchParams.get('pageSize') ?? '20';
	let limit: number | undefined = 20;
	if (rawLimit === 'all' || rawLimit === 'All' || rawLimit === '0') {
		limit = undefined;
	} else {
		const parsed = parseInt(rawLimit, 10);
		if (Number.isFinite(parsed) && [20, 50, 100, 200, 500].includes(parsed)) {
			limit = parsed;
		} else {
			limit = 20;
		}
	}

	const search = url.searchParams.get('search');
	const type = url.searchParams.get('type');
	const frequency = url.searchParams.get('frequency');
	const status = url.searchParams.get('status');
	const category_id = url.searchParams.get('category_id');

	const filters: RecurringFilters = {
		search: search || undefined,
		type: type === 'income' || type === 'expense' ? type : undefined,
		frequency: ['daily', 'weekly', 'monthly', 'yearly'].includes(frequency ?? '')
			? (frequency as 'daily' | 'weekly' | 'monthly' | 'yearly')
			: undefined,
		status: status === 'active' || status === 'paused' ? status : undefined,
		category_id: category_id ? parseInt(category_id, 10) : undefined,
	};

	let result = await listRecurringTransactions(userId, filters, page, limit);

	// Clamp out-of-range pages to the last available page
	if (page > result.totalPages && result.totalPages > 0) {
		page = result.totalPages;
		result = await listRecurringTransactions(userId, filters, page, limit);
	}

	const categories = await getCategories(userId);
	const activeCount = await getActiveRecurringCount(userId);

	return {
		recurring: result.items,
		total: result.total,
		page,
		totalPages: result.totalPages,
		limit: limit ?? 0,
		categories,
		activeCount,
	};
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
	},
};
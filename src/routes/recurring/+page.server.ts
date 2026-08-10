import { listRecurringTransactions, getActiveRecurringCount } from '$lib/server/services/recurringService';
import type { RecurringFilters } from '$lib/server/services/recurringService';
import { getCategories } from '$lib/server/services/categories';

export async function load({ url, locals }: { url: URL; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const rawPage = parseInt(url.searchParams.get('page') ?? '1', 10);
	const page = Number.isFinite(rawPage) ? Math.max(1, rawPage) : 1;
	const limit = 20;

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

	const result = await listRecurringTransactions(userId, filters, page, limit);
	const categories = await getCategories(userId);
	const activeCount = await getActiveRecurringCount(userId);

	return {
		recurring: result.items,
		total: result.total,
		page: result.page,
		totalPages: result.totalPages,
		limit,
		categories,
		activeCount,
	};
}
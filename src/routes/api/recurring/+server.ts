import { json } from '@sveltejs/kit';
import type { TransactionType, RecurringFrequency } from '$lib/types';
import { createRecurringTransaction, listRecurringTransactions } from '$lib/server/services/recurringService';
import type { RecurringInput, RecurringFilters } from '$lib/server/services/recurringService';
import { getCategories } from '$lib/server/services/categories';

export async function GET({ url, locals }: { url: URL; locals: App.Locals }) {
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

	return json({
		recurring: result.items,
		total: result.total,
		page: result.page,
		totalPages: result.totalPages,
		limit,
		categories,
	});
}

export async function POST({ request, locals }: { request: Request; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const data = await request.json();

	const input: RecurringInput = {
		type: data.type as TransactionType,
		amount: parseFloat(data.amount),
		description: data.description as string,
		category_id: parseInt(data.category_id),
		frequency: data.frequency as RecurringFrequency,
		interval: parseInt(data.interval) || 1,
		day_of_week: null,
		day_of_month: null,
		month_of_year: null,
		start_date: data.start_date as string,
		end_date: data.end_date || null,
		active: data.active === true || data.active === 'on',
	};

	const result = await createRecurringTransaction(userId, input);

	if (!result.success) {
		if (result.errors) {
			return json({
				errors: result.errors,
				values: { ...input, amount: String(input.amount), interval: String(input.interval) }
			}, { status: 400 });
		}
		return json({ error: result.error }, { status: 400 });
	}

	return json({ success: true });
}
import { fail } from '@sveltejs/kit';
import { getCategories } from '$lib/server/services/categories';
import {
	listTransactions,
	createTransaction,
	updateTransaction,
	deleteTransaction,
	deleteTransactions,
	getWreckedToday,
	getOutflowVelocity,
	getLargestOutflow,
	getWreckedPeriod
} from '$lib/server/services/transactions';
import { importTransactionsForUser } from '$lib/server/services/transactionImport';
import { getCurrentMonth } from '$lib/shared/utils/format';

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

	const type = url.searchParams.get('type');
	const category_id = url.searchParams.get('category_id');
	const date_from = url.searchParams.get('date_from') ?? url.searchParams.get('from');
	const date_to = url.searchParams.get('date_to') ?? url.searchParams.get('to');
	const search = url.searchParams.get('search');

	const categories = await getCategories(userId);

	// Current month for Money Gone metrics
	const now = new Date();
	const currentMonthStr = getCurrentMonth();

	// Calculate yesterday's date (YYYY-MM-DD)
	const yesterdayDate = new Date(now);
	yesterdayDate.setDate(yesterdayDate.getDate() - 1);
	const yesterdayStr = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getDate()).padStart(2, '0')}`;

	// Calculate previous month YYYY-MM and cutoff date (same day of month)
	const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
	const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
	const daysInPrevMonth = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1, 0).getDate();
	const dayOfMonth = now.getDate();
	const maxDay = Math.min(dayOfMonth, daysInPrevMonth);
	const prevMonthCutoffDate = `${prevMonthStr}-${String(maxDay).padStart(2, '0')}`;
	const prevMonthStartDate = `${prevMonthStr}-01`;

	// Fetch Money Gone KPI metrics & prev-period data for trend deltas
	const [
		wreckedToday,
		velocityData,
		largestOutflow,
		wreckedYesterday,
		wreckedSamePointPrevMonth,
		prevMonthVelocityData
	] = await Promise.all([
		getWreckedToday(userId),
		getOutflowVelocity(userId, currentMonthStr),
		getLargestOutflow(userId, currentMonthStr),
		getWreckedToday(userId, yesterdayStr),
		getWreckedPeriod(userId, prevMonthStartDate, prevMonthCutoffDate),
		getOutflowVelocity(userId, prevMonthStr)
	]);

	const moneyGoneStats = {
		wreckedToday,
		wreckedThisMonth: velocityData.totalExpenses,
		outflowVelocity: velocityData.velocity,
		daysElapsed: velocityData.daysElapsed,
		largestOutflow,
		wreckedYesterday,
		wreckedSamePointPrevMonth,
		prevMonthVelocity: prevMonthVelocityData.velocity
	};

	// Validate date range
	if (date_from && date_to && date_from > date_to) {
		return {
			transactions: [],
			allForBalance: [],
			total: 0,
			page: 1,
			totalPages: 1,
			limit: limit ?? 0,
			categories,
			dateError: 'From date cannot be after End date',
			moneyGoneStats
		};
	}

	const filters = {
		type: type && ['income', 'expense'].includes(type) ? (type as 'income' | 'expense') : undefined,
		category_id: category_id && !isNaN(parseInt(category_id, 10)) ? parseInt(category_id, 10) : undefined,
		date_from: date_from || undefined,
		date_to: date_to || undefined,
		search: search || undefined
	};

	let result = await listTransactions(userId, filters, page, limit);

	// Clamp out-of-range pages to the last available page
	if (page > result.totalPages && result.totalPages > 0) {
		page = result.totalPages;
		result = await listTransactions(userId, filters, page, limit);
	}

	// Fetch ALL transactions matching the current filter (no pagination) for running balance computation
	const unpaginatedResult = await listTransactions(userId, filters);
	const allForBalance = [...unpaginatedResult.items].reverse();

	return {
		transactions: result.items,
		allForBalance,
		total: result.total,
		page,
		totalPages: result.totalPages,
		limit: limit ?? 0,
		categories,
		dateError: null,
		moneyGoneStats
	};
}

export const actions = {
	create: async ({ request, locals }) => {
		const userId = locals.user!.userId;
		const data = await request.formData();

		const type = data.get('type') as string;
		const amountStr = data.get('amount') as string;
		const description = data.get('description') as string;
		const date = data.get('date') as string;
		const category_id = data.get('category_id') as string;
		const source_of_funds = data.get('source_of_funds') as string | null;

		const errors: Record<string, string> = {};
		if (!type || !['income', 'expense'].includes(type)) errors.type = 'Select a type';
		if (!amountStr || isNaN(parseFloat(amountStr)) || parseFloat(amountStr) === 0) errors.amount = 'Enter a valid amount';
		if (!description || description.trim().length === 0) errors.description = 'Enter a description';
		if (!date) errors.date = 'Select a date';
		if (!category_id || isNaN(parseInt(category_id))) errors.category_id = 'Select a category';

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

		return { success: true };
	},

	update: async ({ request, locals }) => {
		const userId = locals.user!.userId;
		const data = await request.formData();

		const idStr = data.get('id') as string;
		const id = parseInt(idStr, 10);
		if (isNaN(id)) return fail(400, { error: 'Invalid ID' });

		const type = data.get('type') as string;
		const amountStr = data.get('amount') as string;
		const description = data.get('description') as string;
		const date = data.get('date') as string;
		const category_id = data.get('category_id') as string;
		const source_of_funds = data.get('source_of_funds') as string | null;

		const errors: Record<string, string> = {};
		if (!type || !['income', 'expense'].includes(type)) errors.type = 'Select a type';
		if (!amountStr || isNaN(parseFloat(amountStr)) || parseFloat(amountStr) === 0) errors.amount = 'Enter a valid amount';
		if (!description || description.trim().length === 0) errors.description = 'Enter a description';
		if (!date) errors.date = 'Select a date';
		if (!category_id || isNaN(parseInt(category_id))) errors.category_id = 'Select a category';

		if (Object.keys(errors).length > 0) {
			return fail(400, { errors, values: { type, amount: amountStr, description, date, category_id } });
		}

		try {
			const success = await updateTransaction(userId, id, {
				type: type as 'income' | 'expense',
				amount: parseFloat(amountStr),
				description,
				date,
				category_id: parseInt(category_id, 10),
				source_of_funds,
			});
			if (!success) {
				return fail(404, { error: 'Transaction not found' });
			}
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

		return { success: true };
	},

	delete: async ({ request, locals }) => {
		const userId = locals.user!.userId;
		const data = await request.formData();
		const raw = (data.get('id') as string) ?? '';
		const ids = raw
			.split(',')
			.map((s) => parseInt(s.trim(), 10))
			.filter((n) => !isNaN(n) && n > 0);

		if (ids.length === 0) {
			return fail(400, { error: 'Invalid transaction ID' });
		}

		if (ids.length === 1) {
			const id = ids[0];
			const success = await deleteTransaction(userId, id);
			if (!success) {
				return fail(404, { error: 'Transaction not found' });
			}
			return { success: true, deleted: 1 };
		}

		const deletedCount = await deleteTransactions(userId, ids);
		if (deletedCount === 0) {
			return fail(404, { error: 'Transaction not found' });
		}
		return { success: true, deleted: deletedCount };
	},

	import: async ({ request, locals }) => {
		const formData = await request.formData();
		const file = formData.get('file') as File;
		const configJson = formData.get('config') as string;

		return importTransactionsForUser(locals.user!.userId, file, configJson);
	},
};

import { fail } from '@sveltejs/kit';
import { getCategories } from '$lib/server/services/categories';
import { listTransactions, createTransaction, updateTransaction, deleteTransaction, deleteTransactions } from '$lib/server/services/transactions';
import { importTransactionsForUser } from '$lib/server/services/transactionImport';

export async function load({ url, locals }: { url: URL; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const rawPage = parseInt(url.searchParams.get('page') ?? '1', 10);
	let page = Number.isFinite(rawPage) ? Math.max(1, rawPage) : 1;
	const limit = 20;
	const type = url.searchParams.get('type');
	const category_id = url.searchParams.get('category_id');
	const date_from = url.searchParams.get('date_from');
	const date_to = url.searchParams.get('date_to');
	const search = url.searchParams.get('search');

	const filters = {
		type: type && ['income', 'expense'].includes(type) ? (type as 'income' | 'expense') : undefined,
		category_id: category_id ? parseInt(category_id, 10) : undefined,
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

	const categories = await getCategories(userId);

	return {
		transactions: result.items,
		allForBalance,
		total: result.total,
		page,
		totalPages: result.totalPages,
		limit,
		categories,
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

import { fail } from '@sveltejs/kit';
import { getCategorySpending, getCategoryUsage } from '$lib/server/services/transactions';
import {
	getCategories,
	getCategory,
	checkCategoryNameExists,
	createCategory,
	updateCategory,
	deleteCategory,
	getRecurringCountsByCategory,
} from '$lib/server/services/categories';

export async function load({ url, locals }: { url: URL; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const selectedMonth = url.searchParams.get('month') || (
		`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
	);
	const categories = await getCategories(userId);

	const spending = await getCategorySpending(userId, selectedMonth);

	const expenseMap: Record<number, number> = {};
	const incomeMap: Record<number, number> = {};
	for (const s of spending) {
		expenseMap[s.category_id] = s.expense;
		incomeMap[s.category_id] = s.income;
	}

	// Per-category usage: all-time transaction count + last-used date, and
	// recurring-schedule count. Feeds the management view + usage-aware delete.
	const txnUsage = await getCategoryUsage(userId);
	const recurringCounts = await getRecurringCountsByCategory(userId);

	const txnCountMap: Record<number, number> = {};
	const lastUsedMap: Record<number, string> = {};
	for (const u of txnUsage) {
		txnCountMap[u.category_id] = u.cnt;
		if (u.last_used) lastUsedMap[u.category_id] = u.last_used;
	}

	return {
		categories,
		spending: expenseMap,
		income: incomeMap,
		selectedMonth,
		txnCounts: txnCountMap,
		recurringCounts,
		lastUsed: lastUsedMap,
	};
}

export const actions = {
	budgetUpdate: async ({ request, locals }) => {
		const userId = locals.user!.userId;
		const data = await request.formData();
		const id = parseInt(data.get('id') as string);
		const budgetLimitStr = data.get('budget_limit') as string;

		if (isNaN(id)) return fail(400, { error: 'Invalid ID' });

		const budget_limit = budgetLimitStr && budgetLimitStr.length > 0
			? parseFloat(budgetLimitStr)
			: null;

		await updateCategory(userId, id, { budget_limit });

		return { success: true };
	},

	create: async ({ request, locals }) => {
		const userId = locals.user!.userId;
		const data = await request.formData();

		const name = (data.get('name') as string)?.trim();
		const color = (data.get('color') as string) || '#6366f1';
		const icon = (data.get('icon') as string) || '📁';
		const categoryType = (data.get('type') as string) || 'expense';
		const budgetLimitStr = data.get('budget_limit') as string;

		if (!name || name.length === 0) {
			return fail(400, { error: 'Name is required', field: 'name' });
		}

		if (!['income', 'expense'].includes(categoryType)) {
			return fail(400, { error: 'Invalid category type' });
		}

		const exists = await checkCategoryNameExists(userId, name);
		if (exists) {
			return fail(409, { error: 'A category with this name already exists', field: 'name' });
		}

		const budget_limit = budgetLimitStr && budgetLimitStr.length > 0 && !isNaN(parseFloat(budgetLimitStr))
			? parseFloat(budgetLimitStr)
			: null;

		await createCategory(userId, { name, color, icon, type: categoryType as 'income' | 'expense', budget_limit });

		return { success: true };
	},

	update: async ({ request, locals }) => {
		const userId = locals.user!.userId;
		const data = await request.formData();

		const id = parseInt(data.get('id') as string);
		const name = (data.get('name') as string)?.trim();
		const color = (data.get('color') as string) || '#6366f1';
		const icon = (data.get('icon') as string) || '📁';
		const categoryType = (data.get('type') as string) || 'expense';
		const budgetLimitStr = data.get('budget_limit') as string;

		if (isNaN(id)) return fail(400, { error: 'Invalid ID' });
		if (!name || name.length === 0) return fail(400, { error: 'Name is required', field: 'name' });

		if (!['income', 'expense'].includes(categoryType)) {
			return fail(400, { error: 'Invalid category type' });
		}

		const exists = await checkCategoryNameExists(userId, name, id);
		if (exists) return fail(409, { error: 'A category with this name already exists', field: 'name' });

		const budget_limit = budgetLimitStr && budgetLimitStr.length > 0 && !isNaN(parseFloat(budgetLimitStr))
			? parseFloat(budgetLimitStr)
			: null;

		await updateCategory(userId, id, {
			name,
			color,
			icon,
			type: categoryType as 'income' | 'expense',
			budget_limit,
		});

		return { success: true };
	},

	delete: async ({ request, locals }) => {
		const userId = locals.user!.userId;
		const data = await request.formData();
		const id = parseInt(data.get('id') as string);

		if (isNaN(id)) return fail(400, { error: 'Invalid ID' });

		const existing = await getCategory(userId, id);
		if (!existing) return fail(404, { error: 'Category not found' });

		try {
			await deleteCategory(userId, id);
			return { success: true };
		} catch {
			return fail(409, { error: 'Cannot delete: this category has transactions' });
		}
	},
};

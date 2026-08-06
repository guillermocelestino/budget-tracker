import { fail } from '@sveltejs/kit';
import { queryOne, queryMany, execute } from '$lib/database/query';
import type { Category } from '$lib/types';

export async function load({ url, locals }: { url: URL; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const selectedMonth = url.searchParams.get('month') || (
		`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
	);
	const categories = await queryMany<Category>('SELECT * FROM categories WHERE user_id = $1 ORDER BY name ASC', [userId]);

	const spending = await queryMany<{ category_id: number; income: number; expense: number }>(
		`SELECT category_id,
				COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
				COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
		 FROM transactions
		 WHERE TO_CHAR(date, 'YYYY-MM') = $1 AND user_id = $2
		 GROUP BY category_id`,
		[selectedMonth, userId]
	);

	const expenseMap: Record<number, number> = {};
	const incomeMap: Record<number, number> = {};
	for (const s of spending) {
		expenseMap[s.category_id] = parseFloat(String(s.expense));
		incomeMap[s.category_id] = parseFloat(String(s.income));
	}

	// Per-category usage: all-time transaction count + last-used date, and
	// recurring-schedule count. Feeds the management view + usage-aware delete.
	const txnUsage = await queryMany<{ category_id: number; cnt: number; last_used: string | null }>(
		`SELECT category_id, COUNT(*)::int as cnt, MAX(date) as last_used
		 FROM transactions WHERE user_id = $1 GROUP BY category_id`,
		[userId]
	);
	const recurringUsage = await queryMany<{ category_id: number; cnt: number }>(
		`SELECT category_id, COUNT(*)::int as cnt
		 FROM recurring_transactions WHERE user_id = $1 GROUP BY category_id`,
		[userId]
	);

	const txnCountMap: Record<number, number> = {};
	const recurringCountMap: Record<number, number> = {};
	const lastUsedMap: Record<number, string> = {};
	for (const u of txnUsage) {
		txnCountMap[u.category_id] = u.cnt;
		if (u.last_used) lastUsedMap[u.category_id] = u.last_used;
	}
	for (const r of recurringUsage) {
		recurringCountMap[r.category_id] = r.cnt;
	}

	return {
		categories,
		spending: expenseMap,
		income: incomeMap,
		selectedMonth,
		txnCounts: txnCountMap,
		recurringCounts: recurringCountMap,
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

		await execute(
			'UPDATE categories SET budget_limit = $1 WHERE user_id = $2 AND id = $3',
			[budget_limit, userId, id]
		);

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

		const existing = await queryOne<{ id: number }>('SELECT id FROM categories WHERE user_id = $1 AND name = $2', [userId, name]);
		if (existing) {
			return fail(409, { error: 'A category with this name already exists', field: 'name' });
		}

		const budget_limit = budgetLimitStr && budgetLimitStr.length > 0 && !isNaN(parseFloat(budgetLimitStr))
			? parseFloat(budgetLimitStr)
			: null;

		await execute(
			'INSERT INTO categories (user_id, name, color, icon, type, budget_limit) VALUES ($1, $2, $3, $4, $5, $6)',
			[userId, name, color, icon, categoryType, budget_limit]
		);

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

		const existing = await queryOne<{ id: number }>(
			'SELECT id FROM categories WHERE user_id = $1 AND name = $2 AND id != $3',
			[userId, name, id]
		);
		if (existing) return fail(409, { error: 'A category with this name already exists', field: 'name' });

		const budget_limit = budgetLimitStr && budgetLimitStr.length > 0 && !isNaN(parseFloat(budgetLimitStr))
			? parseFloat(budgetLimitStr)
			: null;

		await execute(
			'UPDATE categories SET name = $1, color = $2, icon = $3, type = $4, budget_limit = $5 WHERE user_id = $6 AND id = $7',
			[name, color, icon, categoryType, budget_limit, userId, id]
		);

		return { success: true };
	},

	delete: async ({ request, locals }) => {
		const userId = locals.user!.userId;
		const data = await request.formData();
		const id = parseInt(data.get('id') as string);

		if (isNaN(id)) return fail(400, { error: 'Invalid ID' });

		const existing = await queryOne<{ id: number }>('SELECT id FROM categories WHERE user_id = $1 AND id = $2', [userId, id]);
		if (!existing) return fail(404, { error: 'Category not found' });

		try {
			await execute('DELETE FROM categories WHERE user_id = $1 AND id = $2', [userId, id]);
			return { success: true };
		} catch {
			return fail(409, { error: 'Cannot delete: this category has transactions' });
		}
	},
};

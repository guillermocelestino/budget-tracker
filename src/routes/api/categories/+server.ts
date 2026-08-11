import { json } from '@sveltejs/kit';
import { getCurrentMonth } from '$lib/shared/utils/format';
import { getCategorySpending } from '$lib/server/services/transactions';
import { getCategories, checkCategoryNameExists, createCategory, getCategory } from '$lib/server/services/categories';

export async function GET({ url, locals }: { url: URL; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const categories = await getCategories(userId);

	const withSpending = url.searchParams.get('with_spending') === 'true';
	if (withSpending) {
		const spending = await getCategorySpending(userId, getCurrentMonth());
		const spendingMap = new Map(spending.map(s => [s.category_id, s.expense]));
		return json({
			categories,
			spending: Object.fromEntries(spendingMap),
		});
	}

	return json(categories);
}

export async function POST({ request, locals }: { request: Request; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const body = await request.json();

	const { name, color, icon, budget_limit, type: categoryType } = body;

	if (!name || typeof name !== 'string' || name.trim().length === 0) {
		return json({ error: 'Name is required' }, { status: 400 });
	}

	const trimmedName = name.trim();

	const exists = await checkCategoryNameExists(userId, trimmedName);
	if (exists) {
		return json({ error: 'A category with this name already exists' }, { status: 409 });
	}

	const id = await createCategory(userId, {
		name: trimmedName,
		color: color || '#6366f1',
		icon: icon || '📁',
		type: categoryType || 'expense',
		budget_limit: budget_limit != null && !isNaN(budget_limit) ? budget_limit : null,
	});

	const category = await getCategory(userId, id);
	return json(category, { status: 201 });
}

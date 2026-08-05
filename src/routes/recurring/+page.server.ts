import { queryMany, queryOne } from '$lib/database/query';
import type { Category, RecurringTransaction } from '$lib/types';

export async function load({ url, locals }: { url: URL; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const rawPage = parseInt(url.searchParams.get('page') ?? '1', 10);
	let page = Number.isFinite(rawPage) ? Math.max(1, rawPage) : 1;
	const limit = 20;

	const search = url.searchParams.get('search');
	const type = url.searchParams.get('type');
	const frequency = url.searchParams.get('frequency');
	const status = url.searchParams.get('status');
	const category_id = url.searchParams.get('category_id');

	const conditions: string[] = ['rt.user_id = $1'];
	const params: (string | number)[] = [userId];

	if (type && (type === 'income' || type === 'expense')) {
		conditions.push('rt.type = $' + (params.length + 1));
		params.push(type);
	}

	if (frequency && ['daily', 'weekly', 'monthly', 'yearly'].includes(frequency)) {
		conditions.push('rt.frequency = $' + (params.length + 1));
		params.push(frequency);
	}

	if (status === 'active') {
		conditions.push('rt.active = true');
	} else if (status === 'paused') {
		conditions.push('rt.active = false');
	}

	if (category_id) {
		conditions.push('rt.category_id = $' + (params.length + 1));
		params.push(parseInt(category_id));
	}

	if (search && search.trim()) {
		const like = `%${search.trim()}%`;
		conditions.push(`(rt.description ILIKE $${params.length + 1} OR c.name ILIKE $${params.length + 2})`);
		params.push(like, like);
	}

	const where = 'WHERE ' + conditions.join(' AND ');

	const countRow = await queryOne<{ total: number }>(
		`SELECT COUNT(*)::int as total
		 FROM recurring_transactions rt
		 LEFT JOIN categories c ON rt.category_id = c.id
		 ${where}`,
		params
	);

	const total = countRow?.total ?? 0;
	const totalPages = Math.ceil(total / limit);
	page = Math.min(page, Math.max(totalPages, 1));
	const offset = (page - 1) * limit;

	const recurring = await queryMany<RecurringTransaction>(
		`SELECT rt.*, c.name as category_name, c.color as category_color
		 FROM recurring_transactions rt
		 LEFT JOIN categories c ON rt.category_id = c.id
		 ${where}
		 ORDER BY rt.next_run ASC, rt.id ASC
		 LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
		[...params, limit, offset]
	);

	const categories = await queryMany<Category>('SELECT * FROM categories WHERE user_id = $1 ORDER BY name ASC', [userId]);

	const activeCount = (await queryOne<{ total: number }>(
		`SELECT COUNT(*)::int as total
		 FROM recurring_transactions
		 WHERE user_id = $1 AND active = true`,
		[userId]
	))?.total ?? 0;

	return {
		recurring,
		total,
		page,
		totalPages,
		limit,
		categories,
		activeCount,
	};
}
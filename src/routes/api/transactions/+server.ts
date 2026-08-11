import { json } from '@sveltejs/kit';
import { listTransactions, createTransaction, getTransaction } from '$lib/server/services/transactions';

export async function GET({ url, locals }: { url: URL; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
	const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20')));
	const type = url.searchParams.get('type') as 'income' | 'expense' | null;
	const category_id = url.searchParams.get('category_id');
	const date_from = url.searchParams.get('date_from');
	const date_to = url.searchParams.get('date_to');
	const search = url.searchParams.get('search');
	const sort = (url.searchParams.get('sort') === 'amount' ? 'amount' : 'date') as 'date' | 'amount';
	const order = (url.searchParams.get('order') === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc';

	const filters = {
		type: type && ['income', 'expense'].includes(type) ? type : undefined,
		category_id: category_id ? parseInt(category_id) : undefined,
		date_from: date_from || undefined,
		date_to: date_to || undefined,
		search: search || undefined,
		sort,
		order
	};

	const result = await listTransactions(userId, filters, page, limit);

	return json({
		items: result.items,
		total: result.total,
		page: result.page,
		totalPages: result.totalPages
	});
}

export async function POST({ request, locals }: { request: Request; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const body = await request.json();

	const { type, amount, description, date, category_id, source_of_funds } = body;

	if (!type || !['income', 'expense'].includes(type)) {
		return json({ error: 'Type must be "income" or "expense"' }, { status: 400 });
	}
	if (amount === undefined || typeof amount !== 'number' || amount === 0) {
		return json({ error: 'Amount must be a non-zero number' }, { status: 400 });
	}
	if (!description || typeof description !== 'string' || description.trim().length === 0) {
		return json({ error: 'Description is required' }, { status: 400 });
	}
	if (!date || typeof date !== 'string') {
		return json({ error: 'Date is required' }, { status: 400 });
	}
	if (!category_id || typeof category_id !== 'number') {
		return json({ error: 'Category is required' }, { status: 400 });
	}

	try {
		const newId = await createTransaction(userId, {
			type,
			amount,
			description,
			date,
			category_id,
			source_of_funds
		});

		const transaction = await getTransaction(userId, newId);
		return json(transaction, { status: 201 });
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		if (message === 'Category not found') {
			return json({ error: 'Category not found' }, { status: 400 });
		}
		return json({ error: message }, { status: 400 });
	}
}

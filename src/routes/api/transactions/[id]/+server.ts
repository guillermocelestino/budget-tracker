import { json } from '@sveltejs/kit';
import { getTransaction, updateTransaction, deleteTransaction } from '$lib/server/services/transactions';

export async function GET({ params, locals }: { params: { id: string }; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const id = parseInt(params.id);
	if (isNaN(id)) return json({ error: 'Invalid ID' }, { status: 400 });

	const transaction = await getTransaction(userId, id);

	if (!transaction) {
		return json({ error: 'Transaction not found' }, { status: 404 });
	}

	return json(transaction);
}

export async function PUT({ params, request, locals }: { params: { id: string }; request: Request; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const id = parseInt(params.id);
	if (isNaN(id)) return json({ error: 'Invalid ID' }, { status: 400 });

	const body = await request.json();
	const { type, amount, description, date, category_id } = body;

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
		const success = await updateTransaction(userId, id, {
			type,
			amount,
			description,
			date,
			category_id
		});

		if (!success) {
			return json({ error: 'Transaction not found' }, { status: 404 });
		}

		const transaction = await getTransaction(userId, id);
		return json(transaction);
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		if (message === 'Category not found') {
			return json({ error: 'Category not found' }, { status: 400 });
		}
		return json({ error: message }, { status: 400 });
	}
}

export async function DELETE({ params, locals }: { params: { id: string }; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const id = parseInt(params.id);
	if (isNaN(id)) return json({ error: 'Invalid ID' }, { status: 400 });

	const success = await deleteTransaction(userId, id);
	if (!success) {
		return json({ error: 'Transaction not found' }, { status: 404 });
	}

	return new Response(null, { status: 204 });
}

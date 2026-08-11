import { json } from '@sveltejs/kit';
import { getTransaction, updateTransaction, deleteTransaction } from '$lib/server/services/transactions';
import type { UpdateTransactionInput } from '$lib/server/services/transactions';

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
	const { type, amount, description, date, category_id, source_of_funds } = body;

	// Partial updates: the payload may contain ANY subset of the transaction
	// fields. Validate every field that IS supplied with the same rules as a
	// full update; fields that are omitted (undefined) are forwarded to the
	// service's partial-update logic, which writes only the provided keys and
	// preserves the existing values for everything else (including
	// source_of_funds).
	const input: UpdateTransactionInput = {};

	if (type !== undefined) {
		if (!type || !['income', 'expense'].includes(type)) {
			return json({ error: 'Type must be "income" or "expense"' }, { status: 400 });
		}
		input.type = type;
	}
	if (amount !== undefined) {
		if (typeof amount !== 'number' || amount === 0) {
			return json({ error: 'Amount must be a non-zero number' }, { status: 400 });
		}
		input.amount = amount;
	}
	if (description !== undefined) {
		if (!description || typeof description !== 'string' || description.trim().length === 0) {
			return json({ error: 'Description is required' }, { status: 400 });
		}
		input.description = description;
	}
	if (date !== undefined) {
		if (!date || typeof date !== 'string') {
			return json({ error: 'Date is required' }, { status: 400 });
		}
		input.date = date;
	}
	if (category_id !== undefined) {
		if (!category_id || typeof category_id !== 'number') {
			return json({ error: 'Category is required' }, { status: 400 });
		}
		input.category_id = category_id;
	}
	// Source of Funds stays optional on PUT: if the payload omits it, the
	// service's partial-update logic preserves the existing value. An explicit
	// `null` or `""` clears it to NULL. No other type is accepted.
	if (source_of_funds !== undefined) {
		if (source_of_funds !== null && typeof source_of_funds !== 'string') {
			return json({ error: 'Source of Funds must be a string or null' }, { status: 400 });
		}
		input.source_of_funds = source_of_funds;
	}

	if (Object.keys(input).length === 0) {
		return json({ error: 'No valid fields to update' }, { status: 400 });
	}

	try {
		const success = await updateTransaction(userId, id, input);

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

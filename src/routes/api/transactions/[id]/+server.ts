import { json } from '@sveltejs/kit';
import { queryOne, execute } from '$lib/database/query';
import type { Transaction } from '$lib/types';

export async function GET({ params, locals }: { params: { id: string }; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const id = parseInt(params.id);
	if (isNaN(id)) return json({ error: 'Invalid ID' }, { status: 400 });

	const transaction = await queryOne<Transaction>(
		`SELECT t.*, c.name as category_name, c.color as category_color
		 FROM transactions t
		 LEFT JOIN categories c ON t.category_id = c.id
		 WHERE t.id = $1 AND t.user_id = $2`,
		[id, userId]
	);

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

	const existing = await queryOne<{ id: number }>('SELECT id FROM transactions WHERE user_id = $1 AND id = $2', [userId, id]);
	if (!existing) {
		return json({ error: 'Transaction not found' }, { status: 404 });
	}

	await execute(
		`UPDATE transactions
		 SET amount = $1, description = $2, date = $3, category_id = $4, type = $5, updated_at = NOW()
		 WHERE user_id = $6 AND id = $7`,
		[amount, description.trim(), date, category_id, type, userId, id]
	);

	const transaction = await queryOne<Transaction>(
		`SELECT t.*, c.name as category_name, c.color as category_color
		 FROM transactions t
		 LEFT JOIN categories c ON t.category_id = c.id
		 WHERE t.id = $1 AND t.user_id = $2`,
		[id, userId]
	);

	return json(transaction);
}

export async function DELETE({ params, locals }: { params: { id: string }; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const id = parseInt(params.id);
	if (isNaN(id)) return json({ error: 'Invalid ID' }, { status: 400 });

	const existing = await queryOne<{ id: number }>('SELECT id FROM transactions WHERE user_id = $1 AND id = $2', [userId, id]);
	if (!existing) {
		return json({ error: 'Transaction not found' }, { status: 404 });
	}

	await execute('DELETE FROM transactions WHERE user_id = $1 AND id = $2', [userId, id]);
	return new Response(null, { status: 204 });
}

import { json } from '@sveltejs/kit';
import { queryOne, execute } from '$lib/database/query';
import type { Lending } from '$lib/types';

export async function GET({ params, locals }: { params: { id: string }; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const id = parseInt(params.id);
	if (isNaN(id)) return json({ error: 'Invalid ID' }, { status: 400 });

	const lending = await queryOne<Lending>('SELECT * FROM lendings WHERE user_id = $1 AND id = $2', [userId, id]);
	if (!lending) return json({ error: 'Lending not found' }, { status: 404 });

	return json(lending);
}

export async function PUT({ params, request, locals }: { params: { id: string }; request: Request; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const id = parseInt(params.id);
	if (isNaN(id)) return json({ error: 'Invalid ID' }, { status: 400 });

	const existing = await queryOne<Lending>('SELECT * FROM lendings WHERE user_id = $1 AND id = $2', [userId, id]);
	if (!existing) return json({ error: 'Lending not found' }, { status: 404 });

	const body = await request.json();
	const { borrower_name, amount, interest_rate, date_lent, due_date, status, notes } = body;

	await execute(
		`UPDATE lendings SET borrower_name = $1, amount = $2, interest_rate = $3, date_lent = $4, due_date = $5, status = $6, notes = $7, updated_at = NOW()
		 WHERE user_id = $8 AND id = $9`,
		[
			borrower_name ?? existing.borrower_name,
			amount ?? existing.amount,
			interest_rate ?? existing.interest_rate,
			date_lent ?? existing.date_lent,
			due_date !== undefined ? due_date : existing.due_date,
			status ?? existing.status,
			notes !== undefined ? notes : existing.notes,
			userId, id
		]
	);

	const updated = await queryOne<Lending>('SELECT * FROM lendings WHERE user_id = $1 AND id = $2', [userId, id]);
	return json(updated);
}

export async function DELETE({ params, locals }: { params: { id: string }; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const id = parseInt(params.id);
	if (isNaN(id)) return json({ error: 'Invalid ID' }, { status: 400 });

	const existing = await queryOne<Lending>('SELECT * FROM lendings WHERE user_id = $1 AND id = $2', [userId, id]);
	if (!existing) return json({ error: 'Lending not found' }, { status: 404 });

	await execute('DELETE FROM lendings WHERE user_id = $1 AND id = $2', [userId, id]);
	return new Response(null, { status: 204 });
}

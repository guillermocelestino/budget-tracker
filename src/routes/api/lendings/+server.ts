import { json } from '@sveltejs/kit';
import { queryMany, queryOne, execute } from '$lib/database/query';
import type { Lending } from '$lib/types';

export async function GET({ url, locals }: { url: URL; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const status = url.searchParams.get('status');
	const direction = url.searchParams.get('direction');

	let sql = 'SELECT * FROM lendings WHERE user_id = $1';
	const params: unknown[] = [userId];
	let paramIndex = 2;

	if (status && ['active', 'paid'].includes(status)) {
		sql += ` AND status = $${paramIndex}`;
		params.push(status);
		paramIndex++;
	}

	if (direction && ['lent', 'borrowed'].includes(direction)) {
		sql += ` AND direction = $${paramIndex}`;
		params.push(direction);
		paramIndex++;
	}

	sql += ' ORDER BY created_at DESC';

	const lendings = await queryMany<Lending>(sql, params);
	return json(lendings);
}

export async function POST({ request, locals }: { request: Request; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const body = await request.json();

	const { borrower_name, amount, interest_rate, date_lent, due_date, notes, direction, status } = body;

	if (!borrower_name || !amount || !date_lent) {
		return json({ error: 'Borrower name, amount, and date are required' }, { status: 400 });
	}

	await execute(
		`INSERT INTO lendings (user_id, borrower_name, amount, interest_rate, date_lent, due_date, notes, direction, status)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		[userId, borrower_name, amount, interest_rate || 0, date_lent, due_date || null, notes || null, direction || 'lent', status || 'active']
	);

	const lending = await queryOne<Lending>('SELECT * FROM lendings WHERE user_id = $1 ORDER BY id DESC LIMIT 1', [userId]);
	return json(lending, { status: 201 });
}

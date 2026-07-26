import { json } from '@sveltejs/kit';
import { queryOne, execute } from '$lib/database/query';
import type { Category } from '$lib/types';

export async function GET({ params, locals }: { params: { id: string }; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const id = parseInt(params.id);
	if (isNaN(id)) return json({ error: 'Invalid ID' }, { status: 400 });

	const category = await queryOne<Category>('SELECT * FROM categories WHERE user_id = $1 AND id = $2', [userId, id]);
	if (!category) return json({ error: 'Category not found' }, { status: 404 });

	return json(category);
}

export async function PUT({ params, request, locals }: { params: { id: string }; request: Request; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const id = parseInt(params.id);
	if (isNaN(id)) return json({ error: 'Invalid ID' }, { status: 400 });

	const body = await request.json();
	const { name, color, icon, budget_limit } = body;

	const existing = await queryOne<Category>('SELECT * FROM categories WHERE user_id = $1 AND id = $2', [userId, id]);
	if (!existing) return json({ error: 'Category not found' }, { status: 404 });

	if (name && typeof name === 'string') {
		const dup = await queryOne<{ id: number }>(
			'SELECT id FROM categories WHERE user_id = $1 AND name = $2 AND id != $3',
			[userId, name.trim(), id]
		);
		if (dup) return json({ error: 'A category with this name already exists' }, { status: 409 });
	}

	await execute(
		`UPDATE categories
		 SET name = $1, color = $2, icon = $3, budget_limit = $4
		 WHERE user_id = $5 AND id = $6`,
		[
			(name || existing.name).trim(),
			color || existing.color,
			icon || existing.icon,
			budget_limit !== undefined && budget_limit !== null && !isNaN(budget_limit) ? budget_limit : null,
			userId,
			id
		]
	);

	const updated = await queryOne<Category>('SELECT * FROM categories WHERE user_id = $1 AND id = $2', [userId, id]);
	return json(updated);
}

export async function DELETE({ params, locals }: { params: { id: string }; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const id = parseInt(params.id);
	if (isNaN(id)) return json({ error: 'Invalid ID' }, { status: 400 });

	const existing = await queryOne<{ id: number }>('SELECT id FROM categories WHERE user_id = $1 AND id = $2', [userId, id]);
	if (!existing) return json({ error: 'Category not found' }, { status: 404 });

	try {
		await execute('DELETE FROM categories WHERE user_id = $1 AND id = $2', [userId, id]);
		return new Response(null, { status: 204 });
	} catch {
		return json(
			{ error: 'Cannot delete category: it has transactions associated with it' },
			{ status: 409 }
		);
	}
}

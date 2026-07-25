import { json } from '@sveltejs/kit';
import { queryOne, execute } from '$lib/database/query';
import type { Category } from '$lib/types';

export async function GET({ params }: { params: { id: string } }) {
	const id = parseInt(params.id);
	if (isNaN(id)) return json({ error: 'Invalid ID' }, { status: 400 });

	const category = await queryOne<Category>('SELECT * FROM categories WHERE id = $1', [id]);
	if (!category) return json({ error: 'Category not found' }, { status: 404 });

	return json(category);
}

export async function PUT({ params, request }: { params: { id: string }; request: Request }) {
	const id = parseInt(params.id);
	if (isNaN(id)) return json({ error: 'Invalid ID' }, { status: 400 });

	const body = await request.json();
	const { name, color, icon, budget_limit } = body;

	const existing = await queryOne<Category>('SELECT * FROM categories WHERE id = $1', [id]);
	if (!existing) return json({ error: 'Category not found' }, { status: 404 });

	if (name && typeof name === 'string') {
		const dup = await queryOne<{ id: number }>(
			'SELECT id FROM categories WHERE name = $1 AND id != $2',
			[name.trim(), id]
		);
		if (dup) return json({ error: 'A category with this name already exists' }, { status: 409 });
	}

	await execute(
		`UPDATE categories
		 SET name = $1, color = $2, icon = $3, budget_limit = $4
		 WHERE id = $5`,
		[
			(name || existing.name).trim(),
			color || existing.color,
			icon || existing.icon,
			budget_limit !== undefined && budget_limit !== null && !isNaN(budget_limit) ? budget_limit : null,
			id
		]
	);

	const updated = await queryOne<Category>('SELECT * FROM categories WHERE id = $1', [id]);
	return json(updated);
}

export async function DELETE({ params }: { params: { id: string } }) {
	const id = parseInt(params.id);
	if (isNaN(id)) return json({ error: 'Invalid ID' }, { status: 400 });

	const existing = await queryOne<{ id: number }>('SELECT id FROM categories WHERE id = $1', [id]);
	if (!existing) return json({ error: 'Category not found' }, { status: 404 });

	try {
		await execute('DELETE FROM categories WHERE id = $1', [id]);
		return new Response(null, { status: 204 });
	} catch {
		return json(
			{ error: 'Cannot delete category: it has transactions associated with it' },
			{ status: 409 }
		);
	}
}

import { json } from '@sveltejs/kit';
import { getCategory, checkCategoryNameExists, updateCategory, deleteCategory } from '$lib/server/services/categories';

export async function GET({ params, locals }: { params: { id: string }; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const id = parseInt(params.id);
	if (isNaN(id)) return json({ error: 'Invalid ID' }, { status: 400 });

	const category = await getCategory(userId, id);
	if (!category) return json({ error: 'Category not found' }, { status: 404 });

	return json(category);
}

export async function PUT({ params, request, locals }: { params: { id: string }; request: Request; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const id = parseInt(params.id);
	if (isNaN(id)) return json({ error: 'Invalid ID' }, { status: 400 });

	const body = await request.json();
	const { name, color, icon, budget_limit } = body;

	const existing = await getCategory(userId, id);
	if (!existing) return json({ error: 'Category not found' }, { status: 404 });

	if (name && typeof name === 'string') {
		const dup = await checkCategoryNameExists(userId, name, id);
		if (dup) return json({ error: 'A category with this name already exists' }, { status: 409 });
	}

	await updateCategory(userId, id, {
		name: (name || existing.name).trim(),
		color: color || existing.color,
		icon: icon || existing.icon,
		budget_limit: budget_limit !== undefined && budget_limit !== null && !isNaN(budget_limit) ? budget_limit : null,
	});

	const updated = await getCategory(userId, id);
	return json(updated);
}

export async function DELETE({ params, locals }: { params: { id: string }; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const id = parseInt(params.id);
	if (isNaN(id)) return json({ error: 'Invalid ID' }, { status: 400 });

	const existing = await getCategory(userId, id);
	if (!existing) return json({ error: 'Category not found' }, { status: 404 });

	try {
		await deleteCategory(userId, id);
		return new Response(null, { status: 204 });
	} catch {
		return json(
			{ error: 'Cannot delete category: it has transactions associated with it' },
			{ status: 409 }
		);
	}
}

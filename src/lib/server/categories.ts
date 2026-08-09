import { usePostgres } from '$lib/database';
import { queryOne, queryMany, execute } from '$lib/database/query';
import { getDrizzle } from '$lib/database/drizzle';
import { categories, recurringTransactions } from '$lib/database/schema';
import { and, eq, sql, asc, ilike } from 'drizzle-orm';
import type { Category } from '$lib/types';

/** Raw row shape for category queries. */
interface CategoryRow {
	id: number;
	user_id: number;
	name: string;
	color: string;
	icon: string;
	type: string;
	budget_limit: string | number | null;
	created_at: Date | string;
}

/** Map raw row to Category type. */
function mapCategoryRow(row: CategoryRow): Category {
	return {
		id: row.id,
		name: row.name,
		color: row.color,
		icon: row.icon,
		type: row.type as 'income' | 'expense',
		budget_limit: row.budget_limit != null ? parseFloat(String(row.budget_limit)) : null,
		created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
	};
}

/** Get all categories for a user, ordered by name. */
export async function getCategories(userId: number): Promise<Category[]> {
	if (usePostgres) {
		const db = await getDrizzle();
		const rows = await db
			.select({
				id: categories.id,
				user_id: categories.user_id,
				name: categories.name,
				color: categories.color,
				icon: categories.icon,
				type: categories.type,
				budget_limit: categories.budget_limit,
				created_at: categories.created_at,
			})
			.from(categories)
			.where(eq(categories.user_id, userId))
			.orderBy(categories.name);

		return rows.map(mapCategoryRow);
	}

	// SQLite path
	const rows = await queryMany<CategoryRow>(
		'SELECT * FROM categories WHERE user_id = $1 ORDER BY name ASC',
		[userId]
	);
	return rows.map(mapCategoryRow);
}

/** Get a single category by ID, verifying ownership. */
export async function getCategory(userId: number, id: number): Promise<Category | null> {
	if (usePostgres) {
		const db = await getDrizzle();
		const [row] = await db
			.select({
				id: categories.id,
				user_id: categories.user_id,
				name: categories.name,
				color: categories.color,
				icon: categories.icon,
				type: categories.type,
				budget_limit: categories.budget_limit,
				created_at: categories.created_at,
			})
			.from(categories)
			.where(and(eq(categories.user_id, userId), eq(categories.id, id)))
			.limit(1);

		return row ? mapCategoryRow(row) : null;
	}

	const row = await queryOne<CategoryRow>(
		'SELECT * FROM categories WHERE user_id = $1 AND id = $2',
		[userId, id]
	);
	return row ? mapCategoryRow(row) : null;
}

/** Check if a category name already exists for the user (excluding an optional ID). */
export async function checkCategoryNameExists(
	userId: number,
	name: string,
	excludeId?: number
): Promise<boolean> {
	if (usePostgres) {
		const db = await getDrizzle();
		const conditions = [eq(categories.user_id, userId), eq(categories.name, name.trim())];
		if (excludeId !== undefined) {
			conditions.push(sql`${categories.id} != ${excludeId}`);
		}
		const [row] = await db
			.select({ id: categories.id })
			.from(categories)
			.where(and(...conditions))
			.limit(1);
		return !!row;
	}

	const sqlQuery = excludeId !== undefined
		? 'SELECT id FROM categories WHERE user_id = $1 AND name = $2 AND id != $3'
		: 'SELECT id FROM categories WHERE user_id = $1 AND name = $2';
	const params = excludeId !== undefined ? [userId, name.trim(), excludeId] : [userId, name.trim()];

	const row = await queryOne<{ id: number }>(sqlQuery, params);
	return !!row;
}

/** Create a new category. */
export async function createCategory(
	userId: number,
	input: { name: string; color?: string; icon?: string; budget_limit?: number | null; type?: 'income' | 'expense' }
): Promise<number> {
	const { name, color = '#6366f1', icon = '📁', budget_limit = null, type = 'expense' } = input;

	if (usePostgres) {
		const db = await getDrizzle();
		const [row] = await db
			.insert(categories)
			.values({
				user_id: userId,
				name: name.trim(),
				color,
				icon,
				type,
				budget_limit: budget_limit != null ? String(budget_limit) : null,
			})
			.returning({ id: categories.id });
		return row.id;
	}

	await execute(
		'INSERT INTO categories (user_id, name, color, icon, type, budget_limit) VALUES ($1, $2, $3, $4, $5, $6)',
		[userId, name.trim(), color, icon, type, budget_limit]
	);

	const created = await queryOne<{ id: number }>(
		'SELECT id FROM categories WHERE user_id = $1 ORDER BY id DESC LIMIT 1',
		[userId]
	);
	return created!.id;
}

/** Update an existing category. */
export async function updateCategory(
	userId: number,
	id: number,
	input: { name?: string; color?: string; icon?: string; type?: 'income' | 'expense'; budget_limit?: number | null }
): Promise<boolean> {
	const existing = await getCategory(userId, id);
	if (!existing) {
		return false;
	}

	if (usePostgres) {
		const db = await getDrizzle();
		const updateData: Record<string, unknown> = {};

		if (input.name !== undefined) updateData.name = input.name.trim();
		if (input.color !== undefined) updateData.color = input.color;
		if (input.icon !== undefined) updateData.icon = input.icon;
		if (input.type !== undefined) updateData.type = input.type;
		if (input.budget_limit !== undefined) updateData.budget_limit = input.budget_limit != null ? String(input.budget_limit) : null;

		await db
			.update(categories)
			.set(updateData)
			.where(and(eq(categories.user_id, userId), eq(categories.id, id)));

		return true;
	}

	const updateParts: string[] = [];
	const params: (string | number | null)[] = [];

	if (input.name !== undefined) {
		updateParts.push(`name = $${params.length + 1}`);
		params.push(input.name.trim());
	}
	if (input.color !== undefined) {
		updateParts.push(`color = $${params.length + 1}`);
		params.push(input.color);
	}
	if (input.icon !== undefined) {
		updateParts.push(`icon = $${params.length + 1}`);
		params.push(input.icon);
	}
	if (input.type !== undefined) {
		updateParts.push(`type = $${params.length + 1}`);
		params.push(input.type);
	}
	if (input.budget_limit !== undefined) {
		updateParts.push(`budget_limit = $${params.length + 1}`);
		params.push(input.budget_limit ?? null);
	}

	if (updateParts.length === 0) {
		return true; // nothing to update
	}

	params.push(userId, id);

	await execute(
		`UPDATE categories SET ${updateParts.join(', ')} WHERE user_id = $${params.length - 1} AND id = $${params.length}`,
		params
	);

	return true;
}

/** Delete a category by ID. Returns true if deleted, false if not found. */
export async function deleteCategory(userId: number, id: number): Promise<boolean> {
	if (usePostgres) {
		const db = await getDrizzle();
		const result = await db
			.delete(categories)
			.where(and(eq(categories.user_id, userId), eq(categories.id, id)))
			.returning({ id: categories.id });
		return result.length > 0;
	}

	const existing = await queryOne<{ id: number }>(
		'SELECT id FROM categories WHERE user_id = $1 AND id = $2',
		[userId, id]
	);
	if (!existing) {
		return false;
	}

	await execute('DELETE FROM categories WHERE user_id = $1 AND id = $2', [userId, id]);
	return true;
}

/** Get the total budgeted amount for a user's expense categories. */
export async function getTotalBudgeted(userId: number): Promise<number> {
	if (usePostgres) {
		const db = await getDrizzle();
		const [row] = await db
			.select({
				total: sql<string>`COALESCE(SUM(${categories.budget_limit}), 0)`
			})
			.from(categories)
			.where(and(eq(categories.user_id, userId), eq(categories.type, 'expense')));
		return parseFloat(row?.total ?? '0');
	}

	const row = await queryOne<{ total: string }>(
		`SELECT COALESCE(SUM(budget_limit), 0) as total
		 FROM categories
		 WHERE user_id = $1 AND type = 'expense'`,
		[userId]
	);
	return parseFloat(row?.total ?? '0');
}

/** Get recurring transaction counts per category for a user. */
export async function getRecurringCountsByCategory(userId: number): Promise<Record<number, number>> {
	if (usePostgres) {
		const db = await getDrizzle();
		const rows = await db
			.select({
				category_id: recurringTransactions.category_id,
				cnt: sql<number>`COUNT(*)::int`,
			})
			.from(recurringTransactions)
			.where(eq(recurringTransactions.user_id, userId))
			.groupBy(recurringTransactions.category_id);

		const map: Record<number, number> = {};
		for (const r of rows) {
			if (r.category_id != null) map[r.category_id] = Number(r.cnt);
		}
		return map;
	}

	const rows = await queryMany<{ category_id: number; cnt: number }>(
		`SELECT category_id, COUNT(*)::int as cnt FROM recurring_transactions WHERE user_id = $1 GROUP BY category_id`,
		[userId]
	);

	const map: Record<number, number> = {};
	for (const r of rows) {
		map[r.category_id] = r.cnt;
	}
	return map;
}

/**
 * Search categories by name (substring, case-insensitive).
 * Returns up to 5 results ordered by name ASC.
 * Returns only: id, name, icon, color, type
 */
export async function searchCategories(
	userId: number,
	q: string
): Promise<Pick<Category, 'id' | 'name' | 'icon' | 'color' | 'type'>[]> {
	const pattern = `%${q}%`;

	if (usePostgres) {
		const db = await getDrizzle();
		const rows = await db
			.select({
				id: categories.id,
				name: categories.name,
				icon: categories.icon,
				color: categories.color,
				type: categories.type,
			})
			.from(categories)
			.where(and(
				eq(categories.user_id, userId),
				ilike(categories.name, pattern)
			))
			.orderBy(asc(categories.name))
			.limit(5);
		return rows as Pick<Category, 'id' | 'name' | 'icon' | 'color' | 'type'>[];
	}

	const rows = await queryMany<{ id: number; name: string; icon: string; color: string; type: string }>(
		`SELECT id, name, icon, color, type FROM categories
		 WHERE user_id = $1 AND name LIKE $2
		 ORDER BY name ASC
		 LIMIT 5`,
		[userId, pattern]
	);
	return rows as Pick<Category, 'id' | 'name' | 'icon' | 'color' | 'type'>[];
}
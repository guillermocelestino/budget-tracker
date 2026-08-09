import { usePostgres } from '$lib/database';
import { getDrizzle } from '$lib/database/drizzle';
import { searchTransactions } from '$lib/server/transactions';
import { categories, lendings } from '$lib/database/schema';
import { and, eq, ilike, desc, asc } from 'drizzle-orm';
import { queryMany } from '$lib/database/query';
import type { Lending, Category } from '$lib/types';

/**
 * Map a Drizzle `lendings` row (Postgres path) to the app's `Lending` shape.
 * Postgres NUMERIC columns arrive as strings and timestamp columns as JS Date
 * objects, so monetary fields are parsed and timestamps converted to ISO strings.
 * interest_rate is nullable in the DB but `Lending.interest_rate` is a number —
 * null is coerced to 0 (the column's DEFAULT '0'), matching `toLendingWithPayments`.
 */
function mapLendingRow(row: typeof lendings.$inferSelect): Lending {
	return {
		id: row.id,
		user_id: row.user_id,
		borrower_name: row.borrower_name,
		amount: parseFloat(String(row.amount)),
		interest_rate: parseFloat(String(row.interest_rate ?? '0')),
		date_lent: row.date_lent,
		due_date: row.due_date,
		status: row.status as 'active' | 'paid',
		notes: row.notes,
		created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
		updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
		direction: row.direction as 'lent' | 'borrowed',
	};
}

export async function GET({ url, locals }: { url: URL; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const q = url.searchParams.get('q')?.trim();
	const direction = url.searchParams.get('direction');

	if (!q || q.length < 2) {
		return new Response(JSON.stringify({ transactions: [], lendings: [], categories: [] }), {
			headers: { 'Content-Type': 'application/json' },
		});
	}

	// Search transactions by description or amount (already uses Drizzle)
	const transactionsResult = await searchTransactions(userId, q);

	// Search lendings by borrower name
	const pattern = `%${q}%`;
	let lendingsResult: Lending[] = [];

	if (usePostgres) {
		const db = await getDrizzle();
		const conditions = and(
			eq(lendings.user_id, userId),
			ilike(lendings.borrower_name, pattern)
		);

		if (direction && ['lent', 'borrowed'].includes(direction)) {
			const whereWithDirection = and(conditions, eq(lendings.direction, direction as 'lent' | 'borrowed'));
			const rows = await db
				.select()
				.from(lendings)
				.where(whereWithDirection)
				.orderBy(desc(lendings.date_lent))
				.limit(5);
			lendingsResult = rows.map(mapLendingRow);
		} else {
			const rows = await db
				.select()
				.from(lendings)
				.where(conditions)
				.orderBy(desc(lendings.date_lent))
				.limit(5);
			lendingsResult = rows.map(mapLendingRow);
		}
	} else {
		// SQLite path
		let lendingsSql = `SELECT * FROM lendings WHERE user_id = $1 AND borrower_name LIKE $2`;
		const lendingsParams: unknown[] = [userId, pattern];

		if (direction && ['lent', 'borrowed'].includes(direction)) {
			lendingsSql += ` AND direction = $3`;
			lendingsParams.push(direction);
		}

		lendingsSql += ` ORDER BY date_lent DESC LIMIT 5`;

		lendingsResult = await queryMany<Lending>(lendingsSql, lendingsParams);
	}

	// Search categories by name
	let categoriesResult: Category[] = [];

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
		categoriesResult = rows as Category[];
	} else {
		// SQLite path
		const rows = await queryMany<{ id: number; name: string; icon: string; color: string; type: string }>(
			`SELECT id, name, icon, color, type FROM categories
			 WHERE user_id = $1 AND name LIKE $2
			 ORDER BY name ASC
			 LIMIT 5`,
			[userId, pattern]
		);
		categoriesResult = rows as Category[];
	}

	return new Response(JSON.stringify({
		transactions: transactionsResult,
		lendings: lendingsResult,
		categories: categoriesResult
	}), {
		headers: { 'Content-Type': 'application/json' },
	});
}

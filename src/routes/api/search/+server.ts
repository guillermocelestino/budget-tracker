import { queryMany } from '$lib/database/query';
import { searchTransactions } from '$lib/server/transactions';
import type { Lending } from '$lib/types';

export async function GET({ url, locals }: { url: URL; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const q = url.searchParams.get('q')?.trim();
	const direction = url.searchParams.get('direction');

	if (!q || q.length < 2) {
		return new Response(JSON.stringify({ transactions: [], lendings: [], categories: [] }), {
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const pattern = `%${q}%`;

	// Search transactions by description or amount
	const transactions = await searchTransactions(userId, q);

	// Search lendings by borrower name
	let lendingsSql = `SELECT * FROM lendings WHERE user_id = $1 AND borrower_name ILIKE $2`;
	const lendingsParams: unknown[] = [userId, pattern];

	if (direction && ['lent', 'borrowed'].includes(direction)) {
		lendingsSql += ` AND direction = $3`;
		lendingsParams.push(direction);
	}

	lendingsSql += ` ORDER BY date_lent DESC LIMIT 5`;

	const lendings = await queryMany<Lending>(lendingsSql, lendingsParams);

	// Search categories by name
	const categories = await queryMany<{ id: number; name: string; icon: string; color: string; type: string }>(
		`SELECT id, name, icon, color, type FROM categories
		 WHERE user_id = $1 AND name ILIKE $2
		 ORDER BY name ASC
		 LIMIT 5`,
		[userId, pattern]
	);

	return new Response(JSON.stringify({ transactions, lendings, categories }), {
		headers: { 'Content-Type': 'application/json' },
	});
}

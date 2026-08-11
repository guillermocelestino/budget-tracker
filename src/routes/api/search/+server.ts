import { searchTransactions } from '$lib/server/services/transactions';
import { searchLendings } from '$lib/server/services/lendingPayments';
import { searchCategories } from '$lib/server/services/categories';

export async function GET({ url, locals }: { url: URL; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const q = url.searchParams.get('q')?.trim();
	const direction = url.searchParams.get('direction');

	if (!q || q.length < 2) {
		return new Response(JSON.stringify({ transactions: [], lendings: [], categories: [] }), {
			headers: { 'Content-Type': 'application/json' },
		});
	}

	// Search transactions by description or amount
	const transactionsResult = await searchTransactions(userId, q);

	// Search lendings by borrower name
	const lendingsResult = await searchLendings(userId, q, direction as 'lent' | 'borrowed' | undefined);

	// Search categories by name
	const categoriesResult = await searchCategories(userId, q);

	return new Response(JSON.stringify({
		transactions: transactionsResult,
		lendings: lendingsResult,
		categories: categoriesResult
	}), {
		headers: { 'Content-Type': 'application/json' },
	});
}
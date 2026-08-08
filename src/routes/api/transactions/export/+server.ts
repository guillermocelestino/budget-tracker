import { listTransactions } from '$lib/server/transactions';
import { transactionsToCSV } from '$lib/utils/csv';
import type { TransactionFilters } from '$lib/server/transactions';

export async function GET({ url, locals }: { url: URL; locals: App.Locals }) {
	const userId = locals.user!.userId;

	const type = url.searchParams.get('type');
	const category_id = url.searchParams.get('category_id');
	const date_from = url.searchParams.get('date_from');
	const date_to = url.searchParams.get('date_to');
	const search = url.searchParams.get('search');
	const exportType = url.searchParams.get('exportType') || 'all';
	const format = url.searchParams.get('format') || 'csv';

	// Optional comma-separated ids — narrows the export to specific transactions only.
	const ids = (url.searchParams.get('ids') ?? '')
		.split(',')
		.map((s) => parseInt(s, 10))
		.filter((n) => !isNaN(n) && n > 0);

	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
	const limit = 20;

	const filters: TransactionFilters = {};
	if (type === 'income' || type === 'expense') filters.type = type;
	if (category_id) filters.category_id = parseInt(category_id);
	if (date_from) filters.date_from = date_from;
	if (date_to) filters.date_to = date_to;
	if (search && search.trim()) filters.search = search;
	if (ids.length > 0) filters.ids = ids;

	// Page export: return one page of results (date DESC ordering via listTransactions default)
	// All export: return every matching transaction without pagination
	const result = exportType === 'page'
		? await listTransactions(userId, filters, page, limit)
		: await listTransactions(userId, filters);

	const txList = result.items;

	if (format === 'json') {
		const totalIncome = txList
			.filter(t => t.type === 'income')
			.reduce((s, t) => s + t.amount, 0);
		const totalExpenses = txList
			.filter(t => t.type === 'expense')
			.reduce((s, t) => s + t.amount, 0);

		return new Response(JSON.stringify({
			transactions: txList,
			summary: {
				totalIncome,
				totalExpenses,
				net: totalIncome - totalExpenses,
				count: txList.length,
			},
			generatedAt: new Date().toISOString(),
		}), {
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const csv = transactionsToCSV(txList);
	const filename = `transactions-${exportType}-${new Date().toISOString().split('T')[0]}.csv`;

	return new Response(csv, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${filename}"`,
		},
	});
}

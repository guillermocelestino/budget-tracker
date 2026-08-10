import { json } from '@sveltejs/kit';
import { getCategoryReport } from '$lib/server/services/transactions';

function getCurrentMonthParam(): string {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export async function GET({ url, locals }: { url: URL; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const month = url.searchParams.get('month') || getCurrentMonthParam();
	const type = url.searchParams.get('type') || 'expense';

	const rows = await getCategoryReport(userId, month, type as 'income' | 'expense');

	return json(rows);
}

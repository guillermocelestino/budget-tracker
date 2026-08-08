import { json } from '@sveltejs/kit';
import { getMonthlyReport } from '$lib/server/transactions';

export async function GET({ url, locals }: { url: URL; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const yearStr = url.searchParams.get('year') || String(new Date().getFullYear());
	const year = parseInt(yearStr, 10);

	const rows = await getMonthlyReport(userId, year);

	return json(rows);
}

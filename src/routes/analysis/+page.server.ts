import { redirect } from '@sveltejs/kit';
import { getAnalysisData } from '$lib/server/services/analysis/analysisService';
import type { AnalysisPeriod } from '$lib/server/services/analysis/analysisTypes';

export async function load({ url, locals }: { url: URL; locals: App.Locals }) {
	if (!locals.user) {
		throw redirect(303, '/login');
	}

	const userId = locals.user.userId;

	const rawPeriod = (url.searchParams.get('period') ?? '1M').toUpperCase() as AnalysisPeriod;
	const validPeriods: AnalysisPeriod[] = ['1M', '3M', 'YTD', '1Y', 'ALL', 'CUSTOM'];
	const period: AnalysisPeriod = validPeriods.includes(rawPeriod)
		? rawPeriod
		: '1M';

	const startDate = url.searchParams.get('startDate') || undefined;
	const endDate = url.searchParams.get('endDate') || undefined;
	const date = url.searchParams.get('date') || undefined;

	const analysis = await getAnalysisData(userId, period, date, startDate, endDate);

	return {
		analysis,
		period,
		startDate,
		endDate,
	};
}


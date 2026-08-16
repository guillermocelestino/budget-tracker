import {
	listRecurringTransactions,
	getActiveRecurringCount,
	getMonthlyCommittedTotal,
	getUpcomingCommitmentsTotal
} from '$lib/server/services/recurringService';
import type { RecurringFilters } from '$lib/server/services/recurringService';
import { getCategories } from '$lib/server/services/categories';
import {
	getLendingTotals,
	getLendingStatusCounts,
	listLendingsWithPayments
} from '$lib/server/services/lendingPayments';

export async function loadCommittedWorkspaceData({
	url,
	locals,
	defaultView = 'borrowed'
}: {
	url: URL;
	locals: App.Locals;
	defaultView?: 'borrowed' | 'recurring';
}) {
	const userId = locals.user!.userId;

	const rawView = url.searchParams.get('view');
	const view: 'borrowed' | 'recurring' =
		rawView === 'recurring' ? 'recurring' : rawView === 'borrowed' ? 'borrowed' : defaultView;

	const rawPage = parseInt(url.searchParams.get('page') ?? '1', 10);
	let page = Number.isFinite(rawPage) ? Math.max(1, rawPage) : 1;

	const rawLimit = url.searchParams.get('limit') ?? url.searchParams.get('pageSize') ?? '20';
	let limit: number | undefined = 20;
	if (rawLimit === 'all' || rawLimit === 'All' || rawLimit === '0') {
		limit = undefined;
	} else {
		const parsed = parseInt(rawLimit, 10);
		if (Number.isFinite(parsed) && [20, 50, 100, 200, 500].includes(parsed)) {
			limit = parsed;
		} else {
			limit = 20;
		}
	}

	const search = url.searchParams.get('search') || undefined;

	// Shared parallel fetch for tab counts, statistics, and category definitions
	const [
		borrowedCounts,
		borrowedTotals,
		recurringActiveCount,
		categories,
		monthlyCommittedTotal,
		upcoming7Days,
		upcoming30Days
	] = await Promise.all([
		getLendingStatusCounts(userId, 'borrowed'),
		getLendingTotals(userId, 'borrowed'),
		getActiveRecurringCount(userId),
		getCategories(userId),
		getMonthlyCommittedTotal(userId),
		getUpcomingCommitmentsTotal(userId, 7),
		getUpcomingCommitmentsTotal(userId, 30)
	]);

	const debtOwed = borrowedTotals.outstanding;
	const totalCommitted = monthlyCommittedTotal + debtOwed;

	const moneyCommittedStats = {
		totalCommitted,
		next7Days: upcoming7Days,
		next30Days: upcoming30Days,
		debtOwed,
		borrowedActiveCount: borrowedCounts.active
	};

	let lendings: Awaited<ReturnType<typeof listLendingsWithPayments>>['items'] = [];
	let recurring: Awaited<ReturnType<typeof listRecurringTransactions>>['items'] = [];
	let total = 0;
	let totalPages = 1;
	let dateError: string | null = null;

	if (view === 'borrowed') {
		const status = url.searchParams.get('status');
		const date_from = url.searchParams.get('date_from') ?? url.searchParams.get('from');
		const date_to = url.searchParams.get('date_to') ?? url.searchParams.get('to');

		if (date_from && date_to && date_from > date_to) {
			dateError = 'From date cannot be after End date';
		} else {
			const filters = {
				status:
					status && ['all', 'active', 'paid'].includes(status)
						? (status as 'all' | 'active' | 'paid')
						: ('active' as const),
				date_from: date_from || undefined,
				date_to: date_to || undefined,
				search
			};

			let result = await listLendingsWithPayments(userId, 'borrowed', filters, page, limit);
			if (page > result.totalPages && result.totalPages > 0) {
				page = result.totalPages;
				result = await listLendingsWithPayments(userId, 'borrowed', filters, page, limit);
			}

			lendings = result.items;
			total = result.total;
			totalPages = result.totalPages;
		}
	} else {
		// view === 'recurring'
		const type = url.searchParams.get('type');
		const frequency = url.searchParams.get('frequency');
		const status = url.searchParams.get('status');
		const category_id = url.searchParams.get('category_id') ?? url.searchParams.get('category');

		const filters: RecurringFilters = {
			search,
			type: type === 'income' || type === 'expense' ? type : undefined,
			frequency: ['daily', 'weekly', 'monthly', 'yearly'].includes(frequency ?? '')
				? (frequency as 'daily' | 'weekly' | 'monthly' | 'yearly')
				: undefined,
			status: status === 'active' || status === 'paused' ? status : undefined,
			category_id: category_id ? parseInt(category_id, 10) : undefined
		};

		let result = await listRecurringTransactions(userId, filters, page, limit);
		if (page > result.totalPages && result.totalPages > 0) {
			page = result.totalPages;
			result = await listRecurringTransactions(userId, filters, page, limit);
		}

		recurring = result.items;
		total = result.total;
		totalPages = result.totalPages;
	}

	const lendingsList = lendings ?? [];
	const activeLendings = lendingsList.filter((l) => l.derived_status === 'active');
	const paidLendings = lendingsList.filter((l) => l.derived_status === 'paid');

	return {
		view,
		lendings,
		borrowedLendings: lendings,
		activeLendings,
		paidLendings,
		recurring,
		total,
		page,
		totalPages,
		limit: limit ?? 0,
		categories,
		activeCount: recurringActiveCount,
		counts: borrowedCounts,
		borrowedCounts,
		totals: {
			totalLent: borrowedTotals.total,
			totalRecovered: borrowedTotals.cashPaid,
			writtenOff: borrowedTotals.writtenOff,
			outstanding: borrowedTotals.outstanding
		},
		moneyCommittedStats,
		dateError
	};
}

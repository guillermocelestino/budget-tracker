import { fail } from '@sveltejs/kit';
import { getMonthlySummary, getRecentTransactions, getCategoryReport, getMonthlyTrends, deleteTransaction, getWreckedToday, getDailyOutflows } from '$lib/server/services/transactions';
import { getCurrentMonth } from '$lib/shared/utils/format';
import { computeNetWorth } from '$lib/server/services/networth';
import { processRecurringTransactions } from '$lib/server/services/recurringScheduler';
import { getLendingTotals, getLendingsWithPayments } from '$lib/server/services/lendingPayments';
import { getTotalBudgeted, getCategories } from '$lib/server/services/categories';
import { getUpcomingRecurring, getMonthlyCommittedTotal } from '$lib/server/services/recurringService';

export async function load({ url, locals, depends }: { url: URL; locals: App.Locals; depends: (dep: string) => void }) {
	depends('app:dashboard');

	const userId = locals.user!.userId;

	// Process any due recurring transactions on dashboard load
	await processRecurringTransactions(userId);

	const monthParam = url.searchParams.get('month');
	const currentMonthStr = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : getCurrentMonth();
	const currentMonth = new Date(currentMonthStr + '-01');

	const [
		monthlySummary,
		recentTransactions,
		lentTotals,
		borrowedTotals,
		categoryExpenses,
		totalBudgeted,
		trendData,
		netWorth,
		upcomingRecurring,
		monthlyCommittedTotal,
		wreckedToday,
		categoriesList,
		borrowedLendings,
		lentLendings,
		dailyOutflows
	] = await Promise.all([
		getMonthlySummary(userId, currentMonthStr),
		getRecentTransactions(userId, 10),
		getLendingTotals(userId, 'lent'),
		getLendingTotals(userId, 'borrowed'),
		getCategoryReport(userId, currentMonthStr, 'expense'),
		getTotalBudgeted(userId),
		getMonthlyTrends(
			userId,
			`${currentMonth.getFullYear() - 1}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-01`
		),
		computeNetWorth(userId),
		getUpcomingRecurring(userId, 3),
		getMonthlyCommittedTotal(userId),
		getWreckedToday(userId),
		getCategories(userId),
		getLendingsWithPayments(userId, 'borrowed'),
		getLendingsWithPayments(userId, 'lent'),
		getDailyOutflows(userId, currentMonthStr)
	]);

	const totalIncome = monthlySummary.totalIncome;
	const totalExpenses = monthlySummary.totalExpenses;
	const totalLent = lentTotals.total;
	const totalRecovered = lentTotals.cashPaid;
	const totalBorrowed = borrowedTotals.total;
	const totalRepaid = borrowedTotals.cashPaid;
	const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

	const debtOwed = borrowedTotals.outstanding;
	const totalCommitted = monthlyCommittedTotal + debtOwed;

	const activeBorrowed = borrowedLendings.filter(l => l.derived_status === 'active');
	const activeLent = lentLendings.filter(l => l.derived_status === 'active');

	return {
		currentMonthStr,
		summary: {
			totalIncome,
			totalExpenses,
			balance: totalIncome - totalExpenses,
			savingsRate,
		},
		commandCenter: {
			moneyGone: {
				totalExpenses,
				wreckedToday
			},
			moneyAway: {
				totalLent,
				totalRecovered,
				outstanding: lentTotals.outstanding
			},
			moneyCommitted: {
				monthlyCommittedTotal,
				debtOwed,
				totalCommitted
			},
			truePosition: {
				net: netWorth.net,
				cash: netWorth.cash,
				lentActive: netWorth.lentToday,
				borrowedActive: netWorth.borrowedToday
			}
		},
		recentTransactions,
		totalBudgeted,
		lendingSummary: {
			totalLent,
			totalRecovered,
			outstanding: lentTotals.outstanding,
		},
		borrowedSummary: {
			totalBorrowed,
			totalRepaid,
			outstanding: borrowedTotals.outstanding,
		},
		categoryLabels: categoryExpenses.map(c => c.category_name),
		categoryData: categoryExpenses.map(c => c.total),
		categoryColors: categoryExpenses.map(c => c.category_color),
		categoryExpenses,
		dailyOutflows,
		trendLabels: trendData.map(r => r.month),
		trendIncome: trendData.map(r => r.income),
		trendExpenses: trendData.map(r => r.expense),
		incomeChange: trendData.length >= 2
			? (trendData[trendData.length - 2].income > 0
				? ((trendData[trendData.length - 1].income - trendData[trendData.length - 2].income) / trendData[trendData.length - 2].income) * 100
				: (trendData[trendData.length - 1].income > 0 ? 100 : 0))
			: 0,
		expenseChange: trendData.length >= 2
			? (trendData[trendData.length - 2].expense > 0
				? ((trendData[trendData.length - 1].expense - trendData[trendData.length - 2].expense) / trendData[trendData.length - 2].expense) * 100
				: (trendData[trendData.length - 1].expense > 0 ? 100 : 0))
			: 0,
		netWorth,
		upcomingRecurring,
		categories: categoriesList,
		activeBorrowed,
		activeLent
	};
}

export const actions = {
	delete: async ({ request, locals }) => {
		const userId = locals.user!.userId;
		const data = await request.formData();
		const id = parseInt(data.get('id') as string);

		if (isNaN(id)) {
			return fail(400, { error: 'Invalid transaction ID' });
		}

		const deleted = await deleteTransaction(userId, id);
		if (!deleted) {
			return fail(404, { error: 'Transaction not found' });
		}

		return { success: true };
	},
};
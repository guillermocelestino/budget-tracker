import { fail } from '@sveltejs/kit';
import { getMonthlySummary, getRecentTransactions, getCategoryReport, getMonthlyTrends, deleteTransaction } from '$lib/server/transactions';
import { getCurrentMonth } from '$lib/utils/format';
import { computeNetWorth } from '$lib/server/networth';
import { processRecurringTransactions } from '$lib/server/recurringScheduler';
import { getLendingTotals } from '$lib/server/lendingPayments';
import { getTotalBudgeted } from '$lib/server/categories';
import { getUpcomingRecurring } from '$lib/server/recurringService';

export async function load({ locals }: { locals: App.Locals }) {
	const userId = locals.user!.userId;

	// Process any due recurring transactions on dashboard load
	await processRecurringTransactions(userId);
	const currentMonthStr = getCurrentMonth();
	const currentMonth = new Date(currentMonthStr + '-01');

	const monthlySummary = await getMonthlySummary(userId, currentMonthStr);
	const totalIncome = monthlySummary.totalIncome;
	const totalExpenses = monthlySummary.totalExpenses;

	const recentTransactions = await getRecentTransactions(userId, 5);

	const lentTotals = await getLendingTotals(userId, 'lent');
	const totalLent = lentTotals.total;
	const totalRecovered = lentTotals.cashPaid;

	// Borrowed stats for mobile rail
	const borrowedTotals = await getLendingTotals(userId, 'borrowed');
	const totalBorrowed = borrowedTotals.total;
	const totalRepaid = borrowedTotals.cashPaid;

	const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

	// Category expense data for donut chart
	const categoryExpenses = await getCategoryReport(userId, currentMonthStr, 'expense');

	// Budget totals for Safe-to-Spend widget
	const totalBudgeted = await getTotalBudgeted(userId);

	// Monthly trend data for sparklines (last 6 months)
	const trendData = await getMonthlyTrends(
		userId,
		`${currentMonth.getFullYear() - 1}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-01`
	);

	// Net worth for the dashboard teaser (same snapshot as /net-worth)
	const netWorth = await computeNetWorth(userId);

	// Upcoming recurring transactions (next 3)
	const upcomingRecurring = await getUpcomingRecurring(userId, 3);

	return {
		summary: {
			totalIncome,
			totalExpenses,
			balance: totalIncome - totalExpenses,
			savingsRate,
		},
		recentTransactions,
		totalBudgeted,
		lendingSummary: {
			totalLent,
			totalRecovered,
			outstanding: totalLent - totalRecovered,
		},
		borrowedSummary: {
			totalBorrowed,
			totalRepaid,
			outstanding: totalBorrowed - totalRepaid,
		},
		categoryLabels: categoryExpenses.map(c => c.category_name),
		categoryData: categoryExpenses.map(c => c.total),
		categoryColors: categoryExpenses.map(c => c.category_color),
		trendLabels: trendData.map(r => r.month),
		trendIncome: trendData.map(r => r.income),
		trendExpenses: trendData.map(r => r.expense),
		incomeChange: trendData.length >= 2
			? ((trendData[trendData.length - 1].income
				- trendData[trendData.length - 2].income)
				/ trendData[trendData.length - 2].income) * 100
			: 0,
		expenseChange: trendData.length >= 2
			? ((trendData[trendData.length - 1].expense
				- trendData[trendData.length - 2].expense)
				/ trendData[trendData.length - 2].expense) * 100
			: 0,
		netWorth,
		upcomingRecurring,
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
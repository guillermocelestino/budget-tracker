import { getCurrentMonth } from '$lib/shared/utils/format';
import {
	getMonthlySummary,
	getCategoryReport,
	getTransactionCountForMonth,
	getAllTimeTransactionCount
} from '$lib/server/services/transactions';
import { getLendingsWithPayments } from '$lib/server/services/lendingPayments';
import { listRecurringTransactions } from '$lib/server/services/recurringService';

export async function load({ url, locals }: { url: URL; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const currentYear = String(new Date().getFullYear());
	const currentMonthStr = getCurrentMonth();

	const year = url.searchParams.get('year') || currentYear;
	const month = url.searchParams.get('month') || currentMonthStr;

	// Load monthly summary (income, expense, balance)
	const monthSummary = await getMonthlySummary(userId, month);

	// Load active category totals for the month (inner-joined so only categories with data returned)
	const incomeCategories = await getCategoryReport(userId, month, 'income');
	const expenseCategories = await getCategoryReport(userId, month, 'expense');

	// Load active lendings (loans given out to others)
	const lendingsList = await getLendingsWithPayments(userId, 'lent');
	const lendingItems = lendingsList
		.filter((item) => item.status !== 'paid' && item.status !== 'written_off')
		.map((item) => {
			const total = typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount) || '0');
			const paid = typeof item.cash_paid === 'number' ? item.cash_paid : parseFloat(String(item.cash_paid) || '0');
			const outstanding = Math.max(0, total - paid);
			return {
				id: item.id,
				borrower_name: item.borrower_name,
				amount: total,
				cash_paid: paid,
				outstanding,
				status: item.status,
				due_date: item.due_date ?? null
			};
		});

	// Load active recurring commitments
	const recurringRes = await listRecurringTransactions(userId, { status: 'active' }, 1, 50);
	const today = new Date();
	const recurringItems = recurringRes.items.map((rec) => {
		let daysUntil: number | null = null;
		if (rec.next_due_date) {
			const dueDate = new Date(rec.next_due_date);
			const diffTime = dueDate.getTime() - today.getTime();
			daysUntil = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
		}
		return {
			id: rec.id,
			description: rec.description,
			amount: rec.amount,
			type: rec.type,
			frequency: rec.frequency,
			next_due_date: rec.next_due_date ?? null,
			days_until: daysUntil,
			category_name: rec.category_name ?? null
		};
	});

	// Check transaction counts for empty state detection
	const monthTransactionCount = await getTransactionCountForMonth(userId, month);
	const allTimeTransactionCount = await getAllTimeTransactionCount(userId);

	return {
		year,
		month,
		monthSummary: {
			income: monthSummary.totalIncome,
			expense: monthSummary.totalExpenses,
			balance: monthSummary.totalIncome - monthSummary.totalExpenses
		},
		incomeCategories,
		expenseCategories,
		lendingItems,
		recurringItems,
		monthTransactionCount,
		allTimeTransactionCount
	};
}

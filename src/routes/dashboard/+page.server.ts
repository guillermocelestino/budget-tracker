import { fail } from '@sveltejs/kit';
import { queryOne, queryMany, execute } from '$lib/database/query';
import type { Transaction, CategoryReportItem } from '$lib/types';

export async function load({ locals }: { locals: App.Locals }) {
	const userId = locals.user!.userId;
	const currentMonth = new Date();
	const firstDay = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-01`;
	const lastDayDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
	const lastDay = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(lastDayDate.getDate()).padStart(2, '0')}`;

	const summary = await queryOne<{ totalincome: string; totalexpenses: string }>(
		`SELECT
			COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as totalincome,
			COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as totalexpenses
		 FROM transactions
		 WHERE user_id = $1 AND date >= $2 AND date <= $3`,
		[userId, firstDay, lastDay]
	);

	const recentTransactions = await queryMany<Transaction>(
		`SELECT t.*, c.name as category_name, c.color as category_color
		 FROM transactions t
		 LEFT JOIN categories c ON t.category_id = c.id
		 WHERE t.user_id = $1
		 ORDER BY t.date DESC, t.id DESC
		 LIMIT 5`,
		[userId]
	);

	const lendingSummary = await queryOne<{ totalLent: string; totalRecovered: string }>(
			`SELECT
				COALESCE(SUM(amount), 0) as "totalLent",
				COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as "totalRecovered"
			 FROM lendings
			 WHERE user_id = $1`,
			[userId]
		);

	const totalLent = parseFloat(lendingSummary?.totalLent ?? '0');
	const totalRecovered = parseFloat(lendingSummary?.totalRecovered ?? '0');

	const totalIncome = parseFloat(summary?.totalincome ?? '0');
	const totalExpenses = parseFloat(summary?.totalexpenses ?? '0');
	const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

	// Category expense data for donut chart
	const categoryExpenses = await queryMany<CategoryReportItem>(
		`SELECT c.id as category_id, c.name as category_name, c.color as category_color,
				COALESCE(SUM(t.amount), 0) as total
		 FROM transactions t
		 JOIN categories c ON t.category_id = c.id
		 WHERE t.user_id = $1 AND t.type = 'expense' AND t.date >= $2 AND t.date <= $3
		 GROUP BY c.id, c.name, c.color
		 ORDER BY total DESC`,
		[userId, firstDay, lastDay]
	);

	// Monthly trend data for sparklines (last 6 months)
	const trendData = await queryMany<{ month: string; income: string; expense: string }>(
		`SELECT TO_CHAR(date, 'YYYY-MM') as month,
				COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
				COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
		 FROM transactions
		 WHERE user_id = $1 AND date >= $2
		 GROUP BY month
		 ORDER BY month ASC`,
		[userId, `${currentMonth.getFullYear() - 1}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-01`]
	);

	return {
		summary: {
			totalIncome,
			totalExpenses,
			balance: totalIncome - totalExpenses,
			savingsRate,
		},
		recentTransactions,
		lendingSummary: {
			totalLent,
			totalRecovered,
			outstanding: totalLent - totalRecovered,
		},
		categoryLabels: categoryExpenses.map(c => c.category_name),
		categoryData: categoryExpenses.map(c => c.total),
		categoryColors: categoryExpenses.map(c => c.category_color),
		trendLabels: trendData.map(r => r.month),
		trendIncome: trendData.map(r => parseFloat(r.income)),
		trendExpenses: trendData.map(r => parseFloat(r.expense)),
		incomeChange: trendData.length >= 2
			? ((parseFloat(trendData[trendData.length - 1].income)
				- parseFloat(trendData[trendData.length - 2].income))
				/ parseFloat(trendData[trendData.length - 2].income)) * 100
			: 0,
		expenseChange: trendData.length >= 2
			? ((parseFloat(trendData[trendData.length - 1].expense)
				- parseFloat(trendData[trendData.length - 2].expense))
				/ parseFloat(trendData[trendData.length - 2].expense)) * 100
			: 0,
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

		const existing = await queryOne<{ id: number }>('SELECT id FROM transactions WHERE user_id = $1 AND id = $2', [userId, id]);
		if (!existing) {
			return fail(404, { error: 'Transaction not found' });
		}

		await execute('DELETE FROM transactions WHERE user_id = $1 AND id = $2', [userId, id]);

		return { success: true };
	},
};

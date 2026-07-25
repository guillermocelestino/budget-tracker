import { fail } from '@sveltejs/kit';
import { queryOne, queryMany, execute } from '$lib/database/query';
import type { Transaction } from '$lib/types';

export async function load() {
	const currentMonth = new Date();
	const firstDay = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-01`;
	const lastDayDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
	const lastDay = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(lastDayDate.getDate()).padStart(2, '0')}`;

	const summary = await queryOne<{ totalincome: string; totalexpenses: string }>(
		`SELECT
			COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as totalincome,
			COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as totalexpenses
		 FROM transactions
		 WHERE date >= $1 AND date <= $2`,
		[firstDay, lastDay]
	);

	const recentTransactions = await queryMany<Transaction>(
		`SELECT t.*, c.name as category_name, c.color as category_color
		 FROM transactions t
		 LEFT JOIN categories c ON t.category_id = c.id
		 ORDER BY t.date DESC, t.id DESC
		 LIMIT 5`
	);

	return {
		summary: {
			totalIncome: parseFloat(summary?.totalincome ?? '0'),
			totalExpenses: parseFloat(summary?.totalexpenses ?? '0'),
			balance: parseFloat(summary?.totalincome ?? '0') - parseFloat(summary?.totalexpenses ?? '0'),
		},
		recentTransactions,
	};
}

export const actions = {
	delete: async ({ request }) => {
		const data = await request.formData();
		const id = parseInt(data.get('id') as string);

		if (isNaN(id)) {
			return fail(400, { error: 'Invalid transaction ID' });
		}

		const existing = await queryOne<{ id: number }>('SELECT id FROM transactions WHERE id = $1', [id]);
		if (!existing) {
			return fail(404, { error: 'Transaction not found' });
		}

		await execute('DELETE FROM transactions WHERE id = $1', [id]);

		return { success: true };
	},
};

import { fail } from '@sveltejs/kit';
import { queryMany, queryOne, execute } from '$lib/database/query';
import type { Lending } from '$lib/types';

export async function load({ locals }: { locals: App.Locals }) {
	const userId = locals.user!.userId;

	const activeLendings = await queryMany<Lending>(
		'SELECT * FROM lendings WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC',
		[userId, 'active']
	);

	const paidLendings = await queryMany<Lending>(
		'SELECT * FROM lendings WHERE user_id = $1 AND status = $2 ORDER BY updated_at DESC',
		[userId, 'paid']
	);

	const totals = await queryOne<{ total_lent: number; total_recovered: number }>(
		`SELECT
			COALESCE(SUM(CASE WHEN status = 'active' THEN amount ELSE 0 END), 0) as total_lent,
			COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as total_recovered
		 FROM lendings
		 WHERE user_id = $1`,
		[userId]
	);

	const totalLent = parseFloat(String(totals?.total_lent ?? 0));
	const totalRecovered = parseFloat(String(totals?.total_recovered ?? 0));

	return {
		activeLendings,
		paidLendings,
		totals: {
			totalLent,
			totalRecovered,
			outstanding: totalLent - totalRecovered,
		},
	};
}

export const actions = {
	create: async ({ request, locals }) => {
		const userId = locals.user!.userId;
		const data = await request.formData();

		const borrower_name = (data.get('borrower_name') as string)?.trim();
		const amountStr = data.get('amount') as string;
		const interest_rate = parseFloat(data.get('interest_rate') as string) || 0;
		const date_lent = data.get('date_lent') as string;
		const due_date = data.get('due_date') as string;
		const notes = (data.get('notes') as string)?.trim() || null;

		if (!borrower_name) return fail(400, { error: 'Borrower name is required' });
		if (!amountStr || isNaN(parseFloat(amountStr)) || parseFloat(amountStr) <= 0) {
			return fail(400, { error: 'Amount must be a positive number' });
		}
		if (!date_lent) return fail(400, { error: 'Date lent is required' });

		await execute(
			`INSERT INTO lendings (user_id, borrower_name, amount, interest_rate, date_lent, due_date, notes)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			[userId, borrower_name, parseFloat(amountStr), interest_rate, date_lent, due_date || null, notes]
		);

		return { success: true };
	},

	markPaid: async ({ request, locals }) => {
		const userId = locals.user!.userId;
		const data = await request.formData();
		const id = parseInt(data.get('id') as string);
		const recordAsIncome = data.get('record_as_income') === 'true';

		if (isNaN(id)) return fail(400, { error: 'Invalid ID' });

		const lending = await queryOne<Lending>('SELECT * FROM lendings WHERE user_id = $1 AND id = $2', [userId, id]);
		if (!lending) return fail(404, { error: 'Lending not found' });

		await execute(
			'UPDATE lendings SET status = $1, updated_at = NOW() WHERE user_id = $2 AND id = $3',
			['paid', userId, id]
		);

		if (recordAsIncome) {
			// Find or use a "Lending Recovery" category
			const repaymentCategory = await queryOne<{ id: number }>(
				"SELECT id FROM categories WHERE user_id = $1 AND name = 'Lending Recovery'",
				[userId]
			);

			let categoryId: number;
			if (repaymentCategory) {
				categoryId = repaymentCategory.id;
			} else {
				await execute(
					"INSERT INTO categories (user_id, name, color, icon, type) VALUES ($1, 'Lending Recovery', '#8b5cf6', '💳', 'income')",
					[userId]
				);
				const newCat = await queryOne<{ id: number }>(
					"SELECT id FROM categories WHERE user_id = $1 AND name = 'Lending Recovery'",
					[userId]
				);
				categoryId = newCat!.id;
			}

			const today = new Date();
			const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

			await execute(
				'INSERT INTO transactions (user_id, amount, description, date, category_id, type) VALUES ($1, $2, $3, $4, $5, $6)',
				[userId, lending.amount, `Repayment from ${lending.borrower_name}`, dateStr, categoryId, 'income']
			);
		}

		return { success: true };
	},

	delete: async ({ request, locals }) => {
		const userId = locals.user!.userId;
		const data = await request.formData();
		const id = parseInt(data.get('id') as string);
		if (isNaN(id)) return fail(400, { error: 'Invalid ID' });

		await execute('DELETE FROM lendings WHERE user_id = $1 AND id = $2', [userId, id]);
		return { success: true };
	},
};

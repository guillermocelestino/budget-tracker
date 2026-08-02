import { fail } from '@sveltejs/kit';
import { queryMany, queryOne, execute } from '$lib/database/query';
import type { Lending } from '$lib/types';
import { importLendingsForUser } from '$lib/server/lendingImport';
import { recordLendingTransaction } from '$lib/server/recordLendingTransaction';

export async function load({ locals }: { locals: App.Locals }) {
	const userId = locals.user!.userId;

	const activeLendings = await queryMany<Lending>(
		'SELECT * FROM lendings WHERE user_id = $1 AND status = $2 AND direction = $3 ORDER BY created_at DESC',
		[userId, 'active', 'borrowed']
	);

	const paidLendings = await queryMany<Lending>(
		'SELECT * FROM lendings WHERE user_id = $1 AND status = $2 AND direction = $3 ORDER BY updated_at DESC',
		[userId, 'paid', 'borrowed']
	);

	const totals = await queryOne<{ total_lent: string; total_recovered: string }>(
		`SELECT
			COALESCE(SUM(amount), 0) as total_lent,
			COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as total_recovered
		 FROM lendings
		 WHERE user_id = $1 AND direction = 'borrowed'`,
		[userId]
	);

	const totalBorrowed = parseFloat(String(totals?.total_lent ?? '0'));
	const totalRepaid = parseFloat(String(totals?.total_recovered ?? '0'));

	return {
		activeLendings,
		paidLendings,
		totals: {
			totalLent: totalBorrowed,
			totalRecovered: totalRepaid,
			outstanding: totalBorrowed - totalRepaid,
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
		const direction = data.get('direction') as string || 'borrowed';
		const recordAsTransaction = data.get('record_as_transaction') === 'on';

		if (!borrower_name) return fail(400, { error: 'Lender name is required' });
		if (!amountStr || isNaN(parseFloat(amountStr)) || parseFloat(amountStr) <= 0) {
			return fail(400, { error: 'Amount must be a positive number' });
		}
		if (!date_lent) return fail(400, { error: 'Date borrowed is required' });

		await execute(
			`INSERT INTO lendings (user_id, borrower_name, amount, interest_rate, date_lent, due_date, notes, direction)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			[userId, borrower_name, parseFloat(amountStr), interest_rate, date_lent, due_date || null, notes, direction]
		);

		if (recordAsTransaction) {
			await recordLendingTransaction(userId, {
				event: 'create',
				direction: direction as 'lent' | 'borrowed',
				amount: parseFloat(amountStr),
				partyName: borrower_name,
				date: date_lent
			});
		}

		return { success: true };
	},

	update: async ({ request, locals }) => {
		const userId = locals.user!.userId;
		const data = await request.formData();

		const id = parseInt(data.get('id') as string);
		const borrower_name = (data.get('borrower_name') as string)?.trim();
		const amountStr = (data.get('amount') as string)?.replace(/,/g, '');
		const interest_rate = parseFloat(data.get('interest_rate') as string) || 0;
		const date_lent = data.get('date_lent') as string;
		const due_date = data.get('due_date') as string;
		const status = data.get('status') as string;
		const notes = (data.get('notes') as string)?.trim() || null;

		if (isNaN(id)) return fail(400, { error: 'Invalid ID' });
		if (!borrower_name) return fail(400, { error: 'Lender name is required' });
		if (!amountStr || isNaN(parseFloat(amountStr)) || parseFloat(amountStr) <= 0) {
			return fail(400, { error: 'Amount must be a positive number' });
		}
		if (!date_lent) return fail(400, { error: 'Date borrowed is required' });

		await execute(
			`UPDATE lendings SET borrower_name = $1, amount = $2, interest_rate = $3, date_lent = $4, due_date = $5, status = $6, notes = $7, updated_at = NOW()
			 WHERE user_id = $8 AND id = $9`,
			[borrower_name, parseFloat(amountStr), interest_rate, date_lent, due_date || null, status, notes, userId, id]
		);

		return { success: true };
	},

	markPaid: async ({ request, locals }) => {
		const userId = locals.user!.userId;
		const data = await request.formData();
		const id = parseInt(data.get('id') as string);
		const recordAsTransaction = data.get('record_as_transaction') === 'true';

		if (isNaN(id)) return fail(400, { error: 'Invalid ID' });

		const lending = await queryOne<Lending>('SELECT * FROM lendings WHERE user_id = $1 AND id = $2', [userId, id]);
		if (!lending) return fail(404, { error: 'Borrowing not found' });

		await execute(
			'UPDATE lendings SET status = $1, updated_at = NOW() WHERE user_id = $2 AND id = $3',
			['paid', userId, id]
		);

		if (recordAsTransaction) {
			await recordLendingTransaction(userId, {
				event: 'repayment',
				direction: lending.direction,
				amount: lending.amount,
				partyName: lending.borrower_name,
				date: new Date().toISOString().split('T')[0]
			});
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

	import: async ({ request, locals }) => {
		const data = await request.formData();
		return importLendingsForUser(
			locals.user!.userId,
			data.get('rows') as string,
			data.get('config') as string,
			'borrowed'
		);
	},
};
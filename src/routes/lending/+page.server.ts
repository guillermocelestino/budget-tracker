import { fail } from '@sveltejs/kit';
import { queryOne, execute } from '$lib/database/query';
import type { Lending } from '$lib/types';
import { importLendingsForUser } from '$lib/server/lendingImport';
import { recordLendingTransaction } from '$lib/server/recordLendingTransaction';
import {
	getLendingsWithPayments,
	getLendingTotals,
	recordPayment,
	updatePayment,
	deletePayment,
	hasPayments,
	deleteLinkedTransactions,
} from '$lib/server/lendingPayments';
import { getToday } from '$lib/utils/format';

export async function load({ locals }: { locals: App.Locals }) {
	const userId = locals.user!.userId;

	const allLendings = await getLendingsWithPayments(userId, 'lent');
	const activeLendings = allLendings.filter(l => l.derived_status === 'active');
	const paidLendings = allLendings.filter(l => l.derived_status === 'paid');

	const totals = await getLendingTotals(userId, 'lent');

	return {
		activeLendings,
		paidLendings,
		totals: {
			totalLent: totals.total,
			totalRecovered: totals.cashPaid,
			writtenOff: totals.writtenOff,
			outstanding: totals.outstanding,
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
		const recordAsTransaction = data.get('record_as_transaction') === 'on';

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

		if (recordAsTransaction) {
			await recordLendingTransaction(userId, {
				event: 'create',
				direction: 'lent',
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
		const notes = (data.get('notes') as string)?.trim() || null;

		if (isNaN(id)) return fail(400, { error: 'Invalid ID' });
		if (!borrower_name) return fail(400, { error: 'Borrower name is required' });
		if (!date_lent) return fail(400, { error: 'Date lent is required' });

		// Check if payments exist — if so, lock amount, direction, date_lent
		const paymentExists = await hasPayments(userId, id);

		if (paymentExists) {
			// Lock amount, direction, date_lent — only update metadata
			await execute(
				`UPDATE lendings SET borrower_name = $1, interest_rate = $2, due_date = $3, notes = $4, updated_at = NOW()
				 WHERE user_id = $5 AND id = $6`,
				[borrower_name, interest_rate, due_date || null, notes, userId, id]
			);
		} else {
			// No payments — amount is editable
			if (!amountStr || isNaN(parseFloat(amountStr)) || parseFloat(amountStr) <= 0) {
				return fail(400, { error: 'Amount must be a positive number' });
			}
			await execute(
				`UPDATE lendings SET borrower_name = $1, amount = $2, interest_rate = $3, date_lent = $4, due_date = $5, notes = $6, updated_at = NOW()
				 WHERE user_id = $7 AND id = $8`,
				[borrower_name, parseFloat(amountStr), interest_rate, date_lent, due_date || null, notes, userId, id]
			);
		}

		return { success: true };
	},

	recordPayment: async ({ request, locals }) => {
		const userId = locals.user!.userId;
		const data = await request.formData();

		const lendingId = parseInt(data.get('lending_id') as string);
		const amountStr = (data.get('amount') as string)?.replace(/,/g, '');
		const paymentDate = data.get('payment_date') as string;
		const notes = (data.get('notes') as string)?.trim() || null;
		const paymentType = (data.get('payment_type') as string) || 'payment';
		const createTransaction = data.get('create_transaction') === 'on';

		if (isNaN(lendingId)) return fail(400, { error: 'Invalid lending ID' });
		if (!amountStr || isNaN(parseFloat(amountStr)) || parseFloat(amountStr) <= 0) {
			return fail(400, { error: 'Payment amount must be a positive number' });
		}
		if (!paymentDate) return fail(400, { error: 'Payment date is required' });
		if (!['payment', 'write_off'].includes(paymentType)) {
			return fail(400, { error: 'Invalid payment type' });
		}

		const amount = parseFloat(amountStr);
		const today = getToday();

		// Validate payment date >= date_lent and <= today
		const lending = await queryOne<Lending>(
			'SELECT * FROM lendings WHERE user_id = $1 AND id = $2',
			[userId, lendingId]
		);
		if (!lending) return fail(404, { error: 'Lending record not found' });

		if (paymentDate < lending.date_lent) {
			return fail(400, { error: 'Payment date cannot be before the loan date' });
		}
		if (paymentDate > today) {
			return fail(400, { error: 'Payment date cannot be in the future' });
		}

		try {
			await recordPayment(userId, {
				lendingId,
				amount,
				paymentDate,
				notes,
				paymentType: paymentType as 'payment' | 'write_off',
				createTransaction: createTransaction && paymentType === 'payment',
			});
			return { success: true };
		} catch (e) {
			return fail(400, { error: (e as Error).message });
		}
	},

	updatePayment: async ({ request, locals }) => {
		const userId = locals.user!.userId;
		const data = await request.formData();

		const paymentId = parseInt(data.get('payment_id') as string);
		const amountStr = (data.get('amount') as string)?.replace(/,/g, '');
		const paymentDate = data.get('payment_date') as string;
		const notes = (data.get('notes') as string)?.trim() || null;

		if (isNaN(paymentId)) return fail(400, { error: 'Invalid payment ID' });
		if (!amountStr || isNaN(parseFloat(amountStr)) || parseFloat(amountStr) <= 0) {
			return fail(400, { error: 'Payment amount must be a positive number' });
		}
		if (!paymentDate) return fail(400, { error: 'Payment date is required' });

		const amount = parseFloat(amountStr);
		const today = getToday();

		try {
			// Validate payment date
			const payment = await queryOne<{ lending_id: number }>(
				'SELECT lending_id FROM lending_payments WHERE user_id = $1 AND id = $2',
				[userId, paymentId]
			);
			if (!payment) return fail(404, { error: 'Payment not found' });

			const lending = await queryOne<Lending>(
				'SELECT * FROM lendings WHERE user_id = $1 AND id = $2',
				[userId, payment.lending_id]
			);
			if (!lending) return fail(404, { error: 'Lending record not found' });

			if (paymentDate < lending.date_lent) {
				return fail(400, { error: 'Payment date cannot be before the loan date' });
			}
			if (paymentDate > today) {
				return fail(400, { error: 'Payment date cannot be in the future' });
			}

			await updatePayment(userId, paymentId, { amount, paymentDate, notes });
			return { success: true };
		} catch (e) {
			return fail(400, { error: (e as Error).message });
		}
	},

	deletePayment: async ({ request, locals }) => {
		const userId = locals.user!.userId;
		const data = await request.formData();
		const paymentId = parseInt(data.get('payment_id') as string);

		if (isNaN(paymentId)) return fail(400, { error: 'Invalid payment ID' });

		try {
			await deletePayment(userId, paymentId);
			return { success: true };
		} catch (e) {
			return fail(400, { error: (e as Error).message });
		}
	},

	delete: async ({ request, locals }) => {
		const userId = locals.user!.userId;
		const data = await request.formData();
		const id = parseInt(data.get('id') as string);
		if (isNaN(id)) return fail(400, { error: 'Invalid ID' });

		// Delete all linked transactions first, then the lending (cascades to payments)
		await deleteLinkedTransactions(userId, id);
		await execute('DELETE FROM lendings WHERE user_id = $1 AND id = $2', [userId, id]);
		return { success: true };
	},

	import: async ({ request, locals }) => {
		const formData = await request.formData();
		const file = formData.get('file') as File;
		const configJson = formData.get('config') as string;

		if (!file) {
			return fail(400, { error: 'No file provided' });
		}

		return importLendingsForUser(locals.user!.userId, file, configJson, 'lent');
	},
};
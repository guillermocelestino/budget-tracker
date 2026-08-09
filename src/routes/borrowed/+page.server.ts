import { fail } from '@sveltejs/kit';
import { queryOne } from '$lib/database/query';
import type { Lending } from '$lib/types';
import { importLendingsForUser } from '$lib/server/lendingImport';
import {
	getLendingsWithPayments,
	getLendingTotals,
	recordPayment,
	updatePayment,
	deletePayment,
	deleteLending,
	createLending,
	updateLending,
} from '$lib/server/lendingPayments';
import { getToday } from '$lib/utils/format';

export async function load({ locals }: { locals: App.Locals }) {
	const userId = locals.user!.userId;

	const allLendings = await getLendingsWithPayments(userId, 'borrowed');
	const activeLendings = allLendings.filter(l => l.derived_status === 'active');
	const paidLendings = allLendings.filter(l => l.derived_status === 'paid');

	const totals = await getLendingTotals(userId, 'borrowed');

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
		const direction = data.get('direction') as string || 'borrowed';
		const recordAsTransaction = data.get('record_as_transaction') === 'on';

		if (!borrower_name) return fail(400, { error: 'Lender name is required' });
		if (!amountStr || isNaN(parseFloat(amountStr)) || parseFloat(amountStr) <= 0) {
			return fail(400, { error: 'Amount must be a positive number' });
		}
		if (!date_lent) return fail(400, { error: 'Date borrowed is required' });

		return createLending(userId, {
			borrowerName: borrower_name,
			amount: parseFloat(amountStr),
			interestRate: interest_rate,
			dateLent: date_lent,
			dueDate: due_date || null,
			notes,
			direction: direction as 'lent' | 'borrowed',
			recordAsTransaction
		});
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
		if (!borrower_name) return fail(400, { error: 'Lender name is required' });
		if (!date_lent) return fail(400, { error: 'Date borrowed is required' });

		// updateLending owns the payment-lock rules: amount/date_lent are
		// immutable once payments exist, and status is never client-settable.
		try {
			await updateLending(userId, id, {
				borrowerName: borrower_name,
				amount: parseFloat(amountStr) || 0,
				interestRate: interest_rate,
				dateLent: date_lent,
				dueDate: due_date || null,
				notes
			});
			return { success: true };
		} catch (e) {
			return fail(400, { error: (e as Error).message });
		}
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
		if (!lending) return fail(404, { error: 'Borrowing record not found' });

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
			if (!lending) return fail(404, { error: 'Borrowing record not found' });

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

		// Delete linked transactions and the lending atomically (cascades to payments).
		await deleteLending(userId, id);
		return { success: true };
	},

	import: async ({ request, locals }) => {
		const formData = await request.formData();
		const file = formData.get('file') as File;
		const configJson = formData.get('config') as string;

		if (!file) {
			return fail(400, { error: 'No file provided' });
		}

		return importLendingsForUser(locals.user!.userId, file, configJson, 'borrowed');
	},
};
import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { importLendingsForUser } from '$lib/server/services/lendingImport';
import {
	getLending,
	listLendingsWithPayments,
	getLendingStatusCounts,
	getLendingTotals,
	getPayment,
	recordPayment,
	updatePayment,
	deletePayment,
	deleteLending,
	deleteLendings,
	createLending,
	updateLending,
} from '$lib/server/services/lendingPayments';
import { getToday } from '$lib/shared/utils/format';


export const load: PageServerLoad = async ({ url, locals }) => {
	const userId = locals.user!.userId;

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

	const status = url.searchParams.get('status');
	const date_from = url.searchParams.get('date_from') ?? url.searchParams.get('from');
	const date_to = url.searchParams.get('date_to') ?? url.searchParams.get('to');
	const search = url.searchParams.get('search');

	const totals = await getLendingTotals(userId, 'lent');

	// Validate date range
	if (date_from && date_to && date_from > date_to) {
		return {
			lendings: [],
			activeLendings: [],
			paidLendings: [],
			total: 0,
			page: 1,
			totalPages: 1,
			limit: limit ?? 0,
			totals: {
				totalLent: totals.total,
				totalRecovered: totals.cashPaid,
				writtenOff: totals.writtenOff,
				outstanding: totals.outstanding,
			},
			counts: { all: 0, active: 0, paid: 0 },
			dateError: 'From date cannot be after End date'
		};
	}

	const filters = {
		status: status && ['all', 'active', 'paid'].includes(status) ? (status as 'all' | 'active' | 'paid') : 'active' as const,
		date_from: date_from || undefined,
		date_to: date_to || undefined,
		search: search || undefined
	};

	let result = await listLendingsWithPayments(userId, 'lent', filters, page, limit);

	if (page > result.totalPages && result.totalPages > 0) {
		page = result.totalPages;
		result = await listLendingsWithPayments(userId, 'lent', filters, page, limit);
	}

	const counts = await getLendingStatusCounts(userId, 'lent', {
		date_from: filters.date_from,
		date_to: filters.date_to,
		search: filters.search
	});

	const activeLendings = result.items.filter(l => l.derived_status === 'active');
	const paidLendings = result.items.filter(l => l.derived_status === 'paid');

	return {
		lendings: result.items,
		activeLendings,
		paidLendings,
		total: result.total,
		page,
		totalPages: result.totalPages,
		limit: limit ?? 0,
		totals: {
			totalLent: totals.total,
			totalRecovered: totals.cashPaid,
			writtenOff: totals.writtenOff,
			outstanding: totals.outstanding,
		},
		counts,
		dateError: null
	};
}

export const actions: Actions = {
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

		return createLending(userId, {
			borrowerName: borrower_name,
			amount: parseFloat(amountStr),
			interestRate: interest_rate,
			dateLent: date_lent,
			dueDate: due_date || null,
			notes,
			direction: 'lent',
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
		if (!borrower_name) return fail(400, { error: 'Borrower name is required' });
		if (!date_lent) return fail(400, { error: 'Date lent is required' });

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
		const lending = await getLending(userId, lendingId);
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
			const payment = await getPayment(userId, paymentId);
			if (!payment) return fail(404, { error: 'Payment not found' });

			const lending = await getLending(userId, payment.lending_id);
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

		// Delete linked transactions and the lending atomically (cascades to payments).
		await deleteLending(userId, id);
		return { success: true };
	},

	deleteBulk: async ({ request, locals }) => {
		const userId = locals.user!.userId;
		const data = await request.formData();
		const raw = (data.get('id') as string) ?? '';
		const ids = raw
			.split(',')
			.map((s) => parseInt(s.trim(), 10))
			.filter((n) => !isNaN(n) && n > 0);

		if (ids.length === 0) {
			return fail(400, { error: 'No valid lending IDs provided' });
		}

		try {
			const deleted = await deleteLendings(userId, ids);
			return { success: true, deleted };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Failed to delete lendings';
			return fail(400, { error: message });
		}
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
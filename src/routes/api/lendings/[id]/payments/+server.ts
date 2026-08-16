import { json } from '@sveltejs/kit';
import { getPaymentHistory, recordPayment, getLending } from '$lib/server/services/lendingPayments';
import { getToday } from '$lib/shared/utils/format';

export async function GET({ params, locals }: { params: { id: string }; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const lendingId = parseInt(params.id);

	if (isNaN(lendingId)) {
		return json({ error: 'Invalid lending ID' }, { status: 400 });
	}

	try {
		const payments = await getPaymentHistory(userId, lendingId);
		return json(payments);
	} catch (e) {
		return json({ error: (e as Error).message }, { status: 400 });
	}
}

export async function POST({ params, request, locals }: { params: { id: string }; request: Request; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const lendingId = parseInt(params.id);

	if (isNaN(lendingId)) {
		return json({ error: 'Invalid lending ID' }, { status: 400 });
	}

	const body = await request.json();
	const { amount, payment_date, notes, payment_type, create_transaction } = body;

	if (amount === undefined || typeof amount !== 'number' || amount <= 0) {
		return json({ error: 'Amount must be a positive number' }, { status: 400 });
	}

	const paymentDate = payment_date || getToday();
	const today = getToday();

	const lending = await getLending(userId, lendingId);
	if (!lending) {
		return json({ error: 'Lending record not found' }, { status: 404 });
	}

	if (paymentDate < lending.date_lent) {
		return json({ error: 'Payment date cannot be before the loan date' }, { status: 400 });
	}
	if (paymentDate > today) {
		return json({ error: 'Payment date cannot be in the future' }, { status: 400 });
	}

	try {
		const result = await recordPayment(userId, {
			lendingId,
			amount,
			paymentDate,
			notes: notes ? String(notes).trim() : null,
			paymentType: payment_type === 'write_off' ? 'write_off' : 'payment',
			createTransaction: create_transaction !== false
		});
		return json(result, { status: 201 });
	} catch (e) {
		return json({ error: (e as Error).message }, { status: 400 });
	}
}
import { json } from '@sveltejs/kit';
import {
	createLending,
	getLendingsWithPayments,
	getLendingWithPayments
} from '$lib/server/lendingPayments';

function asDirection(value: string | null): 'lent' | 'borrowed' | undefined {
	return value === 'lent' || value === 'borrowed' ? value : undefined;
}

export async function GET({ url, locals }: { url: URL; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const status = url.searchParams.get('status');
	const direction = asDirection(url.searchParams.get('direction'));

	let lendings;
	if (direction) {
		lendings = await getLendingsWithPayments(userId, direction);
	} else {
		// No direction filter — the service scopes by direction, so fetch both
		// and merge, preserving the previous single-query created_at DESC order.
		const [lent, borrowed] = await Promise.all([
			getLendingsWithPayments(userId, 'lent'),
			getLendingsWithPayments(userId, 'borrowed')
		]);
		lendings = [...lent, ...borrowed].sort((a, b) =>
			a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0
		);
	}

	// `status` filters on the derived (payment-driven) status — the same
	// effective value the page uses — not the client-writable cache.
	if (status && ['active', 'paid'].includes(status)) {
		lendings = lendings.filter(l => l.derived_status === status);
	}

	return json(lendings);
}

export async function POST({ request, locals }: { request: Request; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const body = await request.json();

	const { borrower_name, amount, interest_rate, date_lent, due_date, notes, direction } = body;

	if (!borrower_name || !amount || !date_lent) {
		return json({ error: 'Borrower name, amount, and date are required' }, { status: 400 });
	}

	// direction is an enum at the DB level (CHECK constraint) — reject anything
	// other than 'lent'/'borrowed' instead of silently coercing to 'lent'.
	if (direction !== undefined && direction !== 'lent' && direction !== 'borrowed') {
		return json({ error: 'Invalid direction' }, { status: 400 });
	}

	// The legacy API never recorded a ledger transaction on create — preserve
	// that behavior explicitly: recordAsTransaction = false. (The page action
	// opts in via its checkbox; the API stays thin.)
	const result = await createLending(userId, {
		borrowerName: borrower_name,
		amount: Number(amount),
		interestRate: interest_rate || 0,
		dateLent: date_lent,
		dueDate: due_date || null,
		notes: notes || null,
		direction: direction === 'borrowed' ? 'borrowed' : 'lent',
		recordAsTransaction: false
	});

	const lending = await getLendingWithPayments(userId, result.id);
	return json(lending, { status: 201 });
}

import { json } from '@sveltejs/kit';
import {
	deleteLending,
	getLendingWithPayments,
	updateLending
} from '$lib/server/lendingPayments';

function parseId(raw: string): number | null {
	const id = parseInt(raw);
	return isNaN(id) ? null : id;
}

export async function GET({ params, locals }: { params: { id: string }; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const id = parseId(params.id);
	if (id === null) return json({ error: 'Invalid ID' }, { status: 400 });

	const lending = await getLendingWithPayments(userId, id);
	if (!lending) return json({ error: 'Lending not found' }, { status: 404 });

	return json(lending);
}

export async function PUT({ params, request, locals }: { params: { id: string }; request: Request; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const id = parseId(params.id);
	if (id === null) return json({ error: 'Invalid ID' }, { status: 400 });

	const existing = await getLendingWithPayments(userId, id);
	if (!existing) return json({ error: 'Lending not found' }, { status: 404 });

	const body = await request.json();

	// `status` is deliberately NOT read from the body — it is a system-maintained
	// cache derived from payment history, never client-controlled. Any
	// client-supplied status is ignored.
	const { borrower_name, amount, interest_rate, date_lent, due_date, notes } = body;

	try {
		await updateLending(userId, id, {
			borrowerName: borrower_name ?? existing.borrower_name,
			amount: amount !== undefined && amount !== null ? Number(amount) : existing.amount,
			interestRate:
				interest_rate !== undefined && interest_rate !== null ? Number(interest_rate) : existing.interest_rate,
			dateLent: date_lent ?? existing.date_lent,
			dueDate: due_date !== undefined ? due_date : existing.due_date,
			notes: notes !== undefined ? notes : existing.notes
		});
	} catch (e) {
		return json({ error: (e as Error).message }, { status: 400 });
	}

	const updated = await getLendingWithPayments(userId, id);
	return json(updated);
}

export async function DELETE({ params, locals }: { params: { id: string }; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const id = parseId(params.id);
	if (id === null) return json({ error: 'Invalid ID' }, { status: 400 });

	// deleteLending returns true if the lending existed — atomic cleanup of
	// linked transactions + payments + the lending, or false if not found.
	const deleted = await deleteLending(userId, id);
	if (!deleted) return json({ error: 'Lending not found' }, { status: 404 });

	return new Response(null, { status: 204 });
}

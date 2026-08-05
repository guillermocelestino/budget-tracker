import { json } from '@sveltejs/kit';
import { getPaymentHistory } from '$lib/server/lendingPayments';

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
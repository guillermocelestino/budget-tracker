import { queryOne, execute } from '$lib/database/query';
import type { RecurringTransaction, TransactionType, RecurringFrequency } from '$lib/types';
import { runRecurringNow, toggleRecurringStatus, duplicateRecurringTransaction } from '$lib/server/recurringScheduler';
import { updateRecurringTransaction } from '$lib/server/recurringService';
import type { RecurringInput } from '$lib/server/recurringService';

export async function GET({ params, locals }: { params: { id: string }; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const id = parseInt(params.id, 10);

	const recurring = await queryOne<RecurringTransaction>(
		`SELECT rt.*, c.name as category_name, c.color as category_color
		 FROM recurring_transactions rt
		 LEFT JOIN categories c ON rt.category_id = c.id
		 WHERE rt.id = $1 AND rt.user_id = $2`,
		[id, userId]
	);

	if (!recurring) {
		return new Response(JSON.stringify({ error: 'Recurring transaction not found' }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	return new Response(JSON.stringify({ recurring }), {
		headers: { 'Content-Type': 'application/json' }
	});
}

export async function PUT({ request, params, locals }: { request: Request; params: { id: string }; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const id = parseInt(params.id, 10);
	const data = await request.json();

	const input: RecurringInput = {
		type: data.type as TransactionType,
		amount: parseFloat(data.amount),
		description: data.description as string,
		category_id: parseInt(data.category_id),
		frequency: data.frequency as RecurringFrequency,
		interval: parseInt(data.interval) || 1,
		day_of_week: data.day_of_week ?? null,
		day_of_month: data.day_of_month ?? null,
		month_of_year: data.month_of_year ?? null,
		start_date: data.start_date as string,
		end_date: data.end_date || null,
		active: !!data.active,
	};

	const result = await updateRecurringTransaction(userId, id, input);

	if (!result.success) {
		if (result.errors) {
			return new Response(JSON.stringify({
				errors: result.errors,
				values: { ...input, amount: String(input.amount), interval: String(input.interval) }
			}), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		const status = result.error === 'Recurring transaction not found' ? 404 : 400;
		return new Response(JSON.stringify({ error: result.error }), {
			status,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	return new Response(JSON.stringify({ success: true }), {
		headers: { 'Content-Type': 'application/json' }
	});
}

export async function DELETE({ params, locals }: { params: { id: string }; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const id = parseInt(params.id, 10);

	const existing = await queryOne<{ id: number }>(
		`SELECT id FROM recurring_transactions WHERE user_id = $1 AND id = $2`,
		[userId, id]
	);

	if (!existing) {
		return new Response(JSON.stringify({ error: 'Recurring transaction not found' }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	await execute('DELETE FROM recurring_transactions WHERE user_id = $1 AND id = $2', [userId, id]);
	return new Response(JSON.stringify({ success: true, deleted: 1 }), {
		headers: { 'Content-Type': 'application/json' }
	});
}

export async function POST({ request, params, locals }: { request: Request; params: { id: string }; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const id = parseInt(params.id, 10);
	const data = await request.json();
	const action = data.action;

	if (action === 'runNow') {
		const result = await runRecurringNow(userId, id);
		if (!result.success) {
			return new Response(JSON.stringify({ error: result.error }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		return new Response(JSON.stringify({ success: true }), {
			headers: { 'Content-Type': 'application/json' }
		});
	}

	if (action === 'pause') {
		const result = await toggleRecurringStatus(userId, id, false);
		if (!result.success) {
			return new Response(JSON.stringify({ error: result.error }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		return new Response(JSON.stringify({ success: true }), {
			headers: { 'Content-Type': 'application/json' }
		});
	}

	if (action === 'resume') {
		const result = await toggleRecurringStatus(userId, id, true);
		if (!result.success) {
			return new Response(JSON.stringify({ error: result.error }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		return new Response(JSON.stringify({ success: true }), {
			headers: { 'Content-Type': 'application/json' }
		});
	}

	if (action === 'duplicate') {
		const result = await duplicateRecurringTransaction(userId, id);
		if (!result.success) {
			return new Response(JSON.stringify({ error: result.error }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		return new Response(JSON.stringify({ success: true, id: result.id }), {
			headers: { 'Content-Type': 'application/json' }
		});
	}

	return new Response(JSON.stringify({ error: 'Invalid action' }), {
		status: 400,
		headers: { 'Content-Type': 'application/json' }
	});
}
import { queryOne, queryMany, execute, withTransaction } from '$lib/database/query';
import type { Lending, LendingPayment, LendingWithPayments, PaymentType } from '$lib/types';

/**
 * Find or create a repayment category within a transaction context.
 * Uses the fallback lookup chain: "Loan Repayment" → "Lending Recovery" → create.
 */
async function findOrCreateRepaymentCategory(
	tx: {
		queryOne: <U>(text: string, params?: unknown[]) => Promise<U | undefined>;
		execute: (text: string, params?: unknown[]) => Promise<void>;
	},
	userId: number,
	direction: 'lent' | 'borrowed'
): Promise<number> {
	const transactionType = direction === 'lent' ? 'income' : 'expense';
	const canonicalName = direction === 'lent' ? 'Loan Repayment' : 'Debt Repayment';
	const legacyName = direction === 'lent' ? 'Lending Recovery' : null;
	const color = direction === 'lent' ? '#8b5cf6' : '#ef4444';
	const icon = direction === 'lent' ? '💳' : '💸';

	// Try canonical name first
	const canonical = await tx.queryOne<{ id: number }>(
		'SELECT id FROM categories WHERE user_id = $1 AND name = $2',
		[userId, canonicalName]
	);
	if (canonical) return canonical.id;

	// Fallback to legacy name (lending only)
	if (legacyName) {
		const legacy = await tx.queryOne<{ id: number }>(
			'SELECT id FROM categories WHERE user_id = $1 AND name = $2',
			[userId, legacyName]
		);
		if (legacy) return legacy.id;
	}

	// Create new
	await tx.execute(
		'INSERT INTO categories (user_id, name, color, icon, type) VALUES ($1, $2, $3, $4, $5)',
		[userId, canonicalName, color, icon, transactionType]
	);
	const created = await tx.queryOne<{ id: number }>(
		'SELECT id FROM categories WHERE user_id = $1 AND name = $2',
		[userId, canonicalName]
	);
	return created!.id;
}

/**
 * Lending Payments — Server Helper
 *
 * The lending_payments table is the authoritative settlement ledger and source
 * of truth for all loan and debt resolution.
 *
 * Canonical derived state formula:
 *   cash_paid       = SUM(payment.amount WHERE payment_type = 'payment')
 *   written_off     = SUM(payment.amount WHERE payment_type = 'write_off')
 *   resolved_total  = cash_paid + written_off
 *   remaining       = original_amount - resolved_total
 *   status          = remaining > 0 ? 'active' : 'paid'
 *
 * Status cache rule:
 *   Users never edit status. Imports never edit status. Forms never edit status.
 *   Only recalcStatusCache() writes status.
 */

/**
 * Compute derived state for many lendings (single query with LEFT JOIN + GROUP BY).
 */
export async function getLendingsWithPayments(
	userId: number,
	direction: 'lent' | 'borrowed'
): Promise<LendingWithPayments[]> {
	const rows = await queryMany<Lending & { cash_paid: string; written_off: string }>(
		`SELECT l.*,
			COALESCE(SUM(CASE WHEN p.payment_type = 'payment'  THEN p.amount ELSE 0 END), 0) as cash_paid,
			COALESCE(SUM(CASE WHEN p.payment_type = 'write_off' THEN p.amount ELSE 0 END), 0) as written_off
		 FROM lendings l
		 LEFT JOIN lending_payments p ON p.lending_id = l.id
		 WHERE l.user_id = $1 AND l.direction = $2
		 GROUP BY l.id
		 ORDER BY l.created_at DESC`,
		[userId, direction]
	);

	return rows.map(row => {
		const cash_paid = parseFloat(String(row.cash_paid ?? '0'));
		const written_off = parseFloat(String(row.written_off ?? '0'));
		const resolved_total = cash_paid + written_off;
		const remaining = row.amount - resolved_total;
		return {
			...row,
			cash_paid,
			written_off,
			resolved_total,
			remaining,
			derived_status: remaining <= 0 ? 'paid' as const : 'active' as const,
		};
	});
}

/**
 * Get a single lending with its derived payment state.
 */
export async function getLendingWithPayments(
	userId: number,
	lendingId: number
): Promise<LendingWithPayments | undefined> {
	const row = await queryOne<Lending & { cash_paid: string; written_off: string }>(
		`SELECT l.*,
			COALESCE(SUM(CASE WHEN p.payment_type = 'payment'  THEN p.amount ELSE 0 END), 0) as cash_paid,
			COALESCE(SUM(CASE WHEN p.payment_type = 'write_off' THEN p.amount ELSE 0 END), 0) as written_off
		 FROM lendings l
		 LEFT JOIN lending_payments p ON p.lending_id = l.id
		 WHERE l.user_id = $1 AND l.id = $2
		 GROUP BY l.id`,
		[userId, lendingId]
	);

	if (!row) return undefined;

	const cash_paid = parseFloat(String(row.cash_paid ?? '0'));
	const written_off = parseFloat(String(row.written_off ?? '0'));
	const resolved_total = cash_paid + written_off;
	const remaining = row.amount - resolved_total;

	return {
		...row,
		cash_paid,
		written_off,
		resolved_total,
		remaining,
		derived_status: remaining <= 0 ? 'paid' as const : 'active' as const,
	};
}

/**
 * Recalculate and cache status on the lendings row.
 * This is the ONLY function that writes to lendings.status.
 */
export async function recalcStatusCache(
	userId: number,
	lendingId: number
): Promise<'active' | 'paid'> {
	const row = await queryOne<{ amount: string; resolved: string }>(
		`SELECT l.amount,
			COALESCE(
				(SELECT SUM(p.amount) FROM lending_payments p
				 WHERE p.lending_id = l.id AND p.payment_type IN ('payment', 'write_off')
				), 0
			) as resolved
		 FROM lendings l
		 WHERE l.user_id = $1 AND l.id = $2`,
		[userId, lendingId]
	);

	if (!row) return 'active';

	const amount = parseFloat(String(row.amount));
	const resolved = parseFloat(String(row.resolved ?? '0'));
	const status = amount - resolved <= 0 ? 'paid' : 'active';

	await execute(
		'UPDATE lendings SET status = $1, updated_at = NOW() WHERE user_id = $2 AND id = $3',
		[status, userId, lendingId]
	);

	return status;
}

/**
 * Record a new payment.
 *
 * Executes inside a single database transaction:
 * 1. Atomically check remaining >= payment amount
 * 2. Insert the payment row
 * 3. Create a linked transaction (if requested and payment_type='payment')
 * 4. Update the payment's transaction_id
 * 5. Recalculate status cache
 */
export async function recordPayment(
	userId: number,
	params: {
		lendingId: number;
		amount: number;
		paymentDate: string;
		notes: string | null;
		paymentType: PaymentType;
		createTransaction: boolean;
	}
): Promise<{ paymentId: number; transactionId: number | null }> {
	const { lendingId, amount, paymentDate, notes, paymentType, createTransaction } = params;

	// Write-offs never create transactions
	const shouldCreateTransaction = createTransaction && paymentType === 'payment';

	return withTransaction(async (tx) => {
		// 1. Get the lending and verify it exists
		const lending = await tx.queryOne<Lending>(
			'SELECT * FROM lendings WHERE user_id = $1 AND id = $2',
			[userId, lendingId]
		);
		if (!lending) throw new Error('Lending record not found');

		// 2. Atomically check remaining balance
		const balanceRow = await tx.queryOne<{ resolved: string }>(
			`SELECT COALESCE(
				(SELECT SUM(p.amount) FROM lending_payments p
				 WHERE p.lending_id = $1 AND p.payment_type IN ('payment', 'write_off')
				), 0
			) as resolved`,
			[lendingId]
		);
		const resolved = parseFloat(String(balanceRow?.resolved ?? '0'));
		const remaining = lending.amount - resolved;

		if (amount > remaining) {
			throw new Error(
				`Payment amount cannot exceed remaining balance of ₱${remaining.toFixed(2)}`
			);
		}

		// 3. Insert the payment row
		await tx.execute(
			`INSERT INTO lending_payments (lending_id, user_id, amount, payment_date, notes, payment_type)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			[lendingId, userId, amount, paymentDate, notes, paymentType]
		);

		// 4. Get the new payment ID
		const newPayment = await tx.queryOne<{ id: number }>(
			'SELECT id FROM lending_payments WHERE lending_id = $1 AND user_id = $2 ORDER BY id DESC LIMIT 1',
			[lendingId, userId]
		);
		const paymentId = newPayment!.id;

		// 5. Create linked transaction (if requested) — within the transaction context
		let transactionId: number | null = null;
		if (shouldCreateTransaction) {
			// Find or create the repayment category within the transaction
			const categoryId = await findOrCreateRepaymentCategory(tx, userId, lending.direction);

			// Determine transaction type and description
			const transactionType = lending.direction === 'lent' ? 'income' : 'expense';
			const description = lending.direction === 'lent'
				? `Repayment from ${lending.borrower_name}`
				: `Repaid to ${lending.borrower_name}`;

			// Insert the transaction within the transaction context
			await tx.execute(
				'INSERT INTO transactions (user_id, amount, description, date, category_id, type) VALUES ($1, $2, $3, $4, $5, $6)',
				[userId, amount, description, paymentDate, categoryId, transactionType]
			);

			// Get the new transaction ID
			const newTx = await tx.queryOne<{ id: number }>(
				'SELECT id FROM transactions WHERE user_id = $1 ORDER BY id DESC LIMIT 1',
				[userId]
			);
			transactionId = newTx?.id ?? null;

			// 6. Update the payment's transaction_id
			if (transactionId) {
				await tx.execute(
					'UPDATE lending_payments SET transaction_id = $1 WHERE id = $2',
					[transactionId, paymentId]
				);
			}
		}

		// 7. Recalculate status cache
		const amount2 = lending.amount;
		const newResolved = resolved + amount;
		const newStatus = amount2 - newResolved <= 0 ? 'paid' : 'active';
		await tx.execute(
			'UPDATE lendings SET status = $1, updated_at = NOW() WHERE user_id = $2 AND id = $3',
			[newStatus, userId, lendingId]
		);

		return { paymentId, transactionId };
	});
}

/**
 * Update an existing payment.
 * Syncs linked transaction amount + date ONLY (category and memo untouched).
 * Recalculates status cache — may reopen the loan.
 */
export async function updatePayment(
	userId: number,
	paymentId: number,
	params: {
		amount: number;
		paymentDate: string;
		notes: string | null;
	}
): Promise<void> {
	const { amount, paymentDate, notes } = params;

	return withTransaction(async (tx) => {
		// 1. Get the payment and verify ownership
		const payment = await tx.queryOne<LendingPayment>(
			'SELECT * FROM lending_payments WHERE user_id = $1 AND id = $2',
			[userId, paymentId]
		);
		if (!payment) throw new Error('Payment not found');

		// 2. Get the lending
		const lending = await tx.queryOne<Lending>(
			'SELECT * FROM lendings WHERE user_id = $1 AND id = $2',
			[userId, payment.lending_id]
		);
		if (!lending) throw new Error('Lending record not found');

		// 3. Check remaining (excluding this payment's current contribution)
		const balanceRow = await tx.queryOne<{ resolved: string }>(
			`SELECT COALESCE(
				(SELECT SUM(p.amount) FROM lending_payments p
				 WHERE p.lending_id = $1 AND p.payment_type IN ('payment', 'write_off')
				   AND p.id != $2
				), 0
			) as resolved`,
			[payment.lending_id, paymentId]
		);
		const otherResolved = parseFloat(String(balanceRow?.resolved ?? '0'));
		const remaining = lending.amount - otherResolved;

		if (amount > remaining) {
			throw new Error(
				`Payment amount cannot exceed remaining balance of ₱${remaining.toFixed(2)}`
			);
		}

		// 4. Update the payment
		await tx.execute(
			`UPDATE lending_payments SET amount = $1, payment_date = $2, notes = $3, updated_at = NOW()
			 WHERE user_id = $4 AND id = $5`,
			[amount, paymentDate, notes, userId, paymentId]
		);

		// 5. Sync linked transaction (amount + date ONLY, category/memo untouched)
		if (payment.transaction_id) {
			await tx.execute(
				'UPDATE transactions SET amount = $1, date = $2, updated_at = NOW() WHERE user_id = $3 AND id = $4',
				[amount, paymentDate, userId, payment.transaction_id]
			);
		}

		// 6. Recalculate status cache
		const newResolved = otherResolved + amount;
		const newStatus = lending.amount - newResolved <= 0 ? 'paid' : 'active';
		await tx.execute(
			'UPDATE lendings SET status = $1, updated_at = NOW() WHERE user_id = $2 AND id = $3',
			[newStatus, userId, payment.lending_id]
		);
	});
}

/**
 * Delete a payment.
 * Deletes the linked transaction first, then the payment.
 * Recalculates status cache — may reopen the loan.
 */
export async function deletePayment(
	userId: number,
	paymentId: number
): Promise<void> {
	return withTransaction(async (tx) => {
		// 1. Get the payment and verify ownership
		const payment = await tx.queryOne<LendingPayment>(
			'SELECT * FROM lending_payments WHERE user_id = $1 AND id = $2',
			[userId, paymentId]
		);
		if (!payment) throw new Error('Payment not found');

		// 2. Delete linked transaction (if any)
		if (payment.transaction_id) {
			await tx.execute(
				'DELETE FROM transactions WHERE user_id = $1 AND id = $2',
				[userId, payment.transaction_id]
			);
		}

		// 3. Delete the payment
		await tx.execute(
			'DELETE FROM lending_payments WHERE user_id = $1 AND id = $2',
			[userId, paymentId]
		);

		// 4. Recalculate status cache
		const balanceRow = await tx.queryOne<{ amount: string; resolved: string }>(
			`SELECT l.amount,
				COALESCE(
					(SELECT SUM(p.amount) FROM lending_payments p
					 WHERE p.lending_id = l.id AND p.payment_type IN ('payment', 'write_off')
					), 0
				) as resolved
			 FROM lendings l
			 WHERE l.user_id = $1 AND l.id = $2`,
			[userId, payment.lending_id]
		);

		if (balanceRow) {
			const amt = parseFloat(String(balanceRow.amount));
			const resolved = parseFloat(String(balanceRow.resolved ?? '0'));
			const newStatus = amt - resolved <= 0 ? 'paid' : 'active';
			await tx.execute(
				'UPDATE lendings SET status = $1, updated_at = NOW() WHERE user_id = $2 AND id = $3',
				[newStatus, userId, payment.lending_id]
			);
		}
	});
}

/**
 * Get payment history for a lending.
 * Ordered by payment_date DESC, created_at DESC, id DESC.
 */
export async function getPaymentHistory(
	userId: number,
	lendingId: number
): Promise<LendingPayment[]> {
	return queryMany<LendingPayment>(
		`SELECT * FROM lending_payments
		 WHERE user_id = $1 AND lending_id = $2
		 ORDER BY payment_date DESC, created_at DESC, id DESC`,
		[userId, lendingId]
	);
}

/**
 * Check if a lending has any payments.
 */
export async function hasPayments(userId: number, lendingId: number): Promise<boolean> {
	const row = await queryOne<{ count: string }>(
		'SELECT COUNT(*) as count FROM lending_payments WHERE user_id = $1 AND lending_id = $2',
		[userId, lendingId]
	);
	return parseInt(String(row?.count ?? '0')) > 0;
}

/**
 * Delete all linked transactions for a lending (used before deleting the lending itself).
 */
export async function deleteLinkedTransactions(userId: number, lendingId: number): Promise<void> {
	const payments = await queryMany<{ transaction_id: number | null }>(
		'SELECT transaction_id FROM lending_payments WHERE lending_id = $1 AND transaction_id IS NOT NULL',
		[lendingId]
	);
	for (const p of payments) {
		if (p.transaction_id) {
			await execute(
				'DELETE FROM transactions WHERE user_id = $1 AND id = $2',
				[userId, p.transaction_id]
			);
		}
	}
}

/**
 * Get aggregate totals for summary cards (payment-driven, not status-driven).
 */
export async function getLendingTotals(
	userId: number,
	direction: 'lent' | 'borrowed'
): Promise<{ total: number; cashPaid: number; writtenOff: number; outstanding: number }> {
	const row = await queryOne<{ total: string; cash_paid: string; written_off: string }>(
		`SELECT
			COALESCE(SUM(l.amount), 0) as total,
			COALESCE(SUM(CASE WHEN p.payment_type = 'payment'  THEN p.amount ELSE 0 END), 0) as cash_paid,
			COALESCE(SUM(CASE WHEN p.payment_type = 'write_off' THEN p.amount ELSE 0 END), 0) as written_off
		 FROM lendings l
		 LEFT JOIN lending_payments p ON p.lending_id = l.id
		 WHERE l.user_id = $1 AND l.direction = $2`,
		[userId, direction]
	);

	const total = parseFloat(String(row?.total ?? '0'));
	const cashPaid = parseFloat(String(row?.cash_paid ?? '0'));
	const writtenOff = parseFloat(String(row?.written_off ?? '0'));
	const outstanding = total - cashPaid - writtenOff;

	return { total, cashPaid, writtenOff, outstanding };
}
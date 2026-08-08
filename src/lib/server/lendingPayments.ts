import { queryOne, queryMany, execute, withTransaction } from '$lib/database/query';
import { usePostgres } from '$lib/database';
import { getDrizzle } from '$lib/database/drizzle';
import {
	categories,
	lendings,
	lendingPayments,
	transactions
} from '$lib/database/schema';
import { and, eq, sql, desc, isNotNull } from 'drizzle-orm';
import type { Lending, LendingPayment, LendingWithPayments, PaymentType } from '$lib/types';

/** Drizzle client type returned by getDrizzle(). */
type DrizzleDb = Awaited<ReturnType<typeof getDrizzle>>;

/** Transaction object passed to `db.transaction(...)` — derived so it stays in sync with Drizzle. */
type DrizzleTransaction = Parameters<Parameters<DrizzleDb['transaction']>[0]>[0];

/**
 * Raw row shape produced by the Drizzle `select` in getLendingsWithPayments /
 * getLendingWithPayments. Postgres NUMERIC columns arrive as strings, so the
 * monetary fields are typed `string` and coerced via parseFloat in the mapper.
 */
interface LendingRowWithPayments {
	id: number;
	user_id: number;
	borrower_name: string;
	amount: string;
	interest_rate: string | null;
	date_lent: string;
	due_date: string | null;
	status: string;
	notes: string | null;
	direction: string;
	created_at: Date;
	updated_at: Date;
	cash_paid: string;
	written_off: string;
}

/**
 * Format a Postgres timestamp (JS Date) as the 'YYYY-MM-DD HH:MM:SS' UTC string
 * SQLite stores via `datetime('now')`, so both backends emit identical values.
 */
function toSqliteTimestamp(d: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/**
 * Find or create a repayment category within a transaction context (SQLite path).
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
 * Find or create a repayment category within a Drizzle transaction context.
 */
async function findOrCreateRepaymentCategoryDrizzle(
	tx: DrizzleTransaction,
	userId: number,
	direction: 'lent' | 'borrowed'
): Promise<number> {
	const transactionType = direction === 'lent' ? 'income' : 'expense';
	const canonicalName = direction === 'lent' ? 'Loan Repayment' : 'Debt Repayment';
	const legacyName = direction === 'lent' ? 'Lending Recovery' : null;
	const color = direction === 'lent' ? '#8b5cf6' : '#ef4444';
	const icon = direction === 'lent' ? '💳' : '💸';

	// Try canonical name first
	const canonical = await tx
		.select({ id: categories.id })
		.from(categories)
		.where(and(eq(categories.user_id, userId), eq(categories.name, canonicalName)));
	if (canonical[0]) return canonical[0].id;

	// Fallback to legacy name (lending only)
	if (legacyName) {
		const legacy = await tx
			.select({ id: categories.id })
			.from(categories)
			.where(and(eq(categories.user_id, userId), eq(categories.name, legacyName)));
		if (legacy[0]) return legacy[0].id;
	}

	// Create new
	await tx.insert(categories).values({
		user_id: userId,
		name: canonicalName,
		color,
		icon,
		type: transactionType
	});

	const created = await tx
		.select({ id: categories.id })
		.from(categories)
		.where(and(eq(categories.user_id, userId), eq(categories.name, canonicalName)));
	return created![0].id;
}

function toLendingWithPayments(row: LendingRowWithPayments): LendingWithPayments {
	const cash_paid = parseFloat(String(row.cash_paid ?? '0'));
	const written_off = parseFloat(String(row.written_off ?? '0'));
	const resolved_total = cash_paid + written_off;
	const remaining = parseFloat(String(row.amount)) - resolved_total;
	return {
		id: row.id,
		user_id: row.user_id,
		borrower_name: row.borrower_name,
		amount: parseFloat(String(row.amount)),
		interest_rate: parseFloat(String(row.interest_rate ?? '0')),
		date_lent: row.date_lent,
		due_date: row.due_date,
		status: row.status as 'active' | 'paid',
		notes: row.notes,
		direction: row.direction as 'lent' | 'borrowed',
		created_at: toSqliteTimestamp(row.created_at),
		updated_at: toSqliteTimestamp(row.updated_at),
		cash_paid,
		written_off,
		resolved_total,
		remaining,
		derived_status: remaining <= 0 ? ('paid' as const) : ('active' as const)
	};
}

/**
 * Compute derived state for many lendings (single query with LEFT JOIN + GROUP BY).
 */
export async function getLendingsWithPayments(
	userId: number,
	direction: 'lent' | 'borrowed'
): Promise<LendingWithPayments[]> {
	if (usePostgres) {
		const db = await getDrizzle();
		const rows = await db
			.select({
				id: lendings.id,
				user_id: lendings.user_id,
				borrower_name: lendings.borrower_name,
				amount: lendings.amount,
				interest_rate: lendings.interest_rate,
				date_lent: lendings.date_lent,
				due_date: lendings.due_date,
				status: lendings.status,
				notes: lendings.notes,
				direction: lendings.direction,
				created_at: lendings.created_at,
				updated_at: lendings.updated_at,
				cash_paid: sql<string>`COALESCE(SUM(CASE WHEN ${lendingPayments.payment_type} = 'payment' THEN ${lendingPayments.amount} ELSE 0 END), 0)`,
				written_off: sql<string>`COALESCE(SUM(CASE WHEN ${lendingPayments.payment_type} = 'write_off' THEN ${lendingPayments.amount} ELSE 0 END), 0)`
			})
			.from(lendings)
			.leftJoin(lendingPayments, eq(lendingPayments.lending_id, lendings.id))
			.where(and(eq(lendings.user_id, userId), eq(lendings.direction, direction)))
			.groupBy(lendings.id)
			.orderBy(desc(lendings.created_at));

		return rows.map(toLendingWithPayments);
	}

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

	return rows.map((row) => {
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
			derived_status: remaining <= 0 ? 'paid' as const : 'active' as const
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
	if (usePostgres) {
		const db = await getDrizzle();
		const [row] = await db
			.select({
				id: lendings.id,
				user_id: lendings.user_id,
				borrower_name: lendings.borrower_name,
				amount: lendings.amount,
				interest_rate: lendings.interest_rate,
				date_lent: lendings.date_lent,
				due_date: lendings.due_date,
				status: lendings.status,
				notes: lendings.notes,
				direction: lendings.direction,
				created_at: lendings.created_at,
				updated_at: lendings.updated_at,
				cash_paid: sql<string>`COALESCE(SUM(CASE WHEN ${lendingPayments.payment_type} = 'payment' THEN ${lendingPayments.amount} ELSE 0 END), 0)`,
				written_off: sql<string>`COALESCE(SUM(CASE WHEN ${lendingPayments.payment_type} = 'write_off' THEN ${lendingPayments.amount} ELSE 0 END), 0)`
			})
			.from(lendings)
			.leftJoin(lendingPayments, eq(lendingPayments.lending_id, lendings.id))
			.where(and(eq(lendings.user_id, userId), eq(lendings.id, lendingId)))
			.groupBy(lendings.id);

		if (!row) return undefined;
		return toLendingWithPayments(row);
	}

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
		derived_status: remaining <= 0 ? 'paid' as const : 'active' as const
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
	if (usePostgres) {
		const db = await getDrizzle();
		const [row] = await db
			.select({
				amount: lendings.amount,
				resolved: sql<string>`COALESCE((SELECT SUM(p.amount) FROM ${lendingPayments} p WHERE p.lending_id = ${lendingId} AND p.payment_type IN ('payment', 'write_off')), 0)`
			})
			.from(lendings)
			.where(and(eq(lendings.user_id, userId), eq(lendings.id, lendingId)))
			.limit(1);

		if (!row) return 'active';

		const amount = parseFloat(String(row.amount));
		const resolved = parseFloat(String(row.resolved ?? '0'));
		const status = amount - resolved <= 0 ? 'paid' : 'active';

		await db
			.update(lendings)
			.set({ status, updated_at: new Date() })
			.where(and(eq(lendings.user_id, userId), eq(lendings.id, lendingId)));

		return status as 'active' | 'paid';
	}

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

	if (usePostgres) {
		const db = await getDrizzle();
		return db.transaction(async (tx) => {
			// 1. Get the lending and verify it exists
			const [lending] = await tx
				.select()
				.from(lendings)
				.where(and(eq(lendings.user_id, userId), eq(lendings.id, lendingId)));
			if (!lending) throw new Error('Lending record not found');

			// 2. Atomically check remaining balance
			const [balanceRow] = await tx
				.select({
					resolved: sql<string>`COALESCE((SELECT SUM(p.amount) FROM ${lendingPayments} p WHERE p.lending_id = ${lendingId} AND p.payment_type IN ('payment', 'write_off')), 0)`
				})
				.from(lendings)
				.where(eq(lendings.id, lendingId))
				.limit(1);
			const resolved = parseFloat(String(balanceRow?.resolved ?? '0'));
			const remaining = parseFloat(String(lending.amount)) - resolved;

			if (amount > remaining) {
				throw new Error(
					`Payment amount cannot exceed remaining balance of ₱${remaining.toFixed(2)}`
				);
			}

			// 3. Insert the payment row
			const [payment] = await tx
				.insert(lendingPayments)
				.values({
					lending_id: lendingId,
					user_id: userId,
					amount: String(amount),
					payment_date: paymentDate,
					notes,
					payment_type: paymentType
				})
				.returning({ id: lendingPayments.id });
			const paymentId = payment.id;

			// 4. Create linked transaction (if requested) — within the transaction context
			let transactionId: number | null = null;
			if (shouldCreateTransaction) {
				// Find or create the repayment category within the transaction
				const categoryId = await findOrCreateRepaymentCategoryDrizzle(tx, userId, lending.direction as 'lent' | 'borrowed');

				// Determine transaction type and description
				const transactionType = lending.direction === 'lent' ? 'income' : 'expense';
				const description = lending.direction === 'lent'
					? `Repayment from ${lending.borrower_name}`
					: `Repaid to ${lending.borrower_name}`;

				// Insert the transaction within the transaction context
				const [newTx] = await tx
					.insert(transactions)
					.values({
						user_id: userId,
						amount: String(amount),
						description,
						date: paymentDate,
						category_id: categoryId,
						type: transactionType
					})
					.returning({ id: transactions.id });
				transactionId = newTx?.id ?? null;

				// 5. Update the payment's transaction_id
				if (transactionId) {
					await tx
						.update(lendingPayments)
						.set({ transaction_id: transactionId })
						.where(eq(lendingPayments.id, paymentId));
				}
			}

			// 6. Recalculate status cache
			const newResolved = resolved + amount;
			const newStatus = parseFloat(String(lending.amount)) - newResolved <= 0 ? 'paid' : 'active';
			await tx
				.update(lendings)
				.set({ status: newStatus, updated_at: new Date() })
				.where(and(eq(lendings.user_id, userId), eq(lendings.id, lendingId)));

			return { paymentId, transactionId };
		});
	}

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

	if (usePostgres) {
		const db = await getDrizzle();
		return db.transaction(async (tx) => {
			// 1. Get the payment and verify ownership
			const [payment] = await tx
				.select()
				.from(lendingPayments)
				.where(and(eq(lendingPayments.user_id, userId), eq(lendingPayments.id, paymentId)));
			if (!payment) throw new Error('Payment not found');

			// 2. Get the lending
			const [lending] = await tx
				.select()
				.from(lendings)
				.where(and(eq(lendings.user_id, userId), eq(lendings.id, payment.lending_id)));
			if (!lending) throw new Error('Lending record not found');

			// 3. Check remaining (excluding this payment's current contribution)
			const [balanceRow] = await tx
				.select({
					resolved: sql<string>`COALESCE((SELECT SUM(p.amount) FROM ${lendingPayments} p WHERE p.lending_id = ${payment.lending_id} AND p.payment_type IN ('payment', 'write_off') AND p.id != ${paymentId}), 0)`
				})
				.from(lendings)
				.where(eq(lendings.id, payment.lending_id))
				.limit(1);
			const otherResolved = parseFloat(String(balanceRow?.resolved ?? '0'));
			const remaining = parseFloat(String(lending.amount)) - otherResolved;

			if (amount > remaining) {
				throw new Error(
					`Payment amount cannot exceed remaining balance of ₱${remaining.toFixed(2)}`
				);
			}

			// 4. Update the payment
			await tx
				.update(lendingPayments)
				.set({ amount: String(amount), payment_date: paymentDate, notes, updated_at: new Date() })
				.where(and(eq(lendingPayments.user_id, userId), eq(lendingPayments.id, paymentId)));

			// 5. Sync linked transaction (amount + date ONLY, category/memo untouched)
			if (payment.transaction_id) {
				await tx
					.update(transactions)
					.set({ amount: String(amount), date: paymentDate, updated_at: new Date() })
					.where(and(eq(transactions.user_id, userId), eq(transactions.id, payment.transaction_id)));
			}

			// 6. Recalculate status cache
			const newResolved = otherResolved + amount;
			const newStatus = parseFloat(String(lending.amount)) - newResolved <= 0 ? 'paid' : 'active';
			await tx
				.update(lendings)
				.set({ status: newStatus, updated_at: new Date() })
				.where(and(eq(lendings.user_id, userId), eq(lendings.id, payment.lending_id)));
		});
	}

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
	if (usePostgres) {
		const db = await getDrizzle();
		return db.transaction(async (tx) => {
			// 1. Get the payment and verify ownership
			const [payment] = await tx
				.select()
				.from(lendingPayments)
				.where(and(eq(lendingPayments.user_id, userId), eq(lendingPayments.id, paymentId)));
			if (!payment) throw new Error('Payment not found');

			// 2. Delete linked transaction (if any)
			if (payment.transaction_id) {
				await tx
					.delete(transactions)
					.where(and(eq(transactions.user_id, userId), eq(transactions.id, payment.transaction_id)));
			}

			// 3. Delete the payment
			await tx
				.delete(lendingPayments)
				.where(and(eq(lendingPayments.user_id, userId), eq(lendingPayments.id, paymentId)));

			// 4. Recalculate status cache
			const [balanceRow] = await tx
				.select({
					amount: lendings.amount,
					resolved: sql<string>`COALESCE((SELECT SUM(p.amount) FROM ${lendingPayments} p WHERE p.lending_id = ${payment.lending_id} AND p.payment_type IN ('payment', 'write_off')), 0)`
				})
				.from(lendings)
				.where(and(eq(lendings.user_id, userId), eq(lendings.id, payment.lending_id)))
				.limit(1);

			if (balanceRow) {
				const amt = parseFloat(String(balanceRow.amount));
				const resolved = parseFloat(String(balanceRow.resolved ?? '0'));
				const newStatus = amt - resolved <= 0 ? 'paid' : 'active';
				await tx
					.update(lendings)
					.set({ status: newStatus, updated_at: new Date() })
					.where(and(eq(lendings.user_id, userId), eq(lendings.id, payment.lending_id)));
			}
		});
	}

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
	if (usePostgres) {
		const db = await getDrizzle();
		const rows = await db
			.select()
			.from(lendingPayments)
			.where(and(eq(lendingPayments.user_id, userId), eq(lendingPayments.lending_id, lendingId)))
			.orderBy(desc(lendingPayments.payment_date), desc(lendingPayments.created_at), desc(lendingPayments.id));

		return rows.map((row) => ({
			id: row.id,
			lending_id: row.lending_id,
			user_id: row.user_id,
			amount: parseFloat(String(row.amount)),
			payment_date: row.payment_date,
			notes: row.notes,
			transaction_id: row.transaction_id,
			payment_type: row.payment_type as PaymentType,
			reference: row.reference,
			created_at: row.created_at.toISOString(),
			updated_at: row.updated_at.toISOString()
		})) as LendingPayment[];
	}

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
	if (usePostgres) {
		const db = await getDrizzle();
		const [row] = await db
			.select({ count: sql<number>`count(*)` })
			.from(lendingPayments)
			.where(and(eq(lendingPayments.user_id, userId), eq(lendingPayments.lending_id, lendingId)));
		return (row?.count ?? 0) > 0;
	}

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
	if (usePostgres) {
		const db = await getDrizzle();
		const payments = await db
			.select({ transaction_id: lendingPayments.transaction_id })
			.from(lendingPayments)
			.where(and(eq(lendingPayments.lending_id, lendingId), isNotNull(lendingPayments.transaction_id)));

		for (const p of payments) {
			if (p.transaction_id) {
				await db
					.delete(transactions)
					.where(and(eq(transactions.user_id, userId), eq(transactions.id, p.transaction_id)));
			}
		}
		return;
	}

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
	if (usePostgres) {
		const db = await getDrizzle();
		const [row] = await db
			.select({
				total: sql<string>`COALESCE((SELECT SUM(li.amount) FROM ${lendings} li WHERE li.user_id = ${userId} AND li.direction = ${direction}), 0)`,
				cash_paid: sql<string>`COALESCE(SUM(CASE WHEN ${lendingPayments.payment_type} = 'payment' THEN ${lendingPayments.amount} ELSE 0 END), 0)`,
				written_off: sql<string>`COALESCE(SUM(CASE WHEN ${lendingPayments.payment_type} = 'write_off' THEN ${lendingPayments.amount} ELSE 0 END), 0)`
			})
			.from(lendings)
			.leftJoin(lendingPayments, eq(lendingPayments.lending_id, lendings.id))
			.where(and(eq(lendings.user_id, userId), eq(lendings.direction, direction)));

		const total = parseFloat(String(row?.total ?? '0'));
		const cashPaid = parseFloat(String(row?.cash_paid ?? '0'));
		const writtenOff = parseFloat(String(row?.written_off ?? '0'));
		const outstanding = total - cashPaid - writtenOff;

		return { total, cashPaid, writtenOff, outstanding };
	}

	const row = await queryOne<{ total: string; cash_paid: string; written_off: string }>(
		`SELECT
			COALESCE((SELECT SUM(l2.amount) FROM lendings l2 WHERE l2.user_id = $1 AND l2.direction = $2), 0) as total,
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
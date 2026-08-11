import { getDrizzle } from '$lib/server/db/drizzle';
import {
	categories,
	lendings,
	lendingPayments,
	transactions
} from '$lib/server/db/schema';
import { and, eq, sql, desc, isNotNull, ilike, gte, lte, or } from 'drizzle-orm';
import type { Lending, LendingPayment, LendingWithPayments, PaymentType } from '$lib/types';
import { recordLendingTransactionInTxDrizzle } from '$lib/server/services/recordLendingTransaction';

export interface LendingFilters {
	status?: 'all' | 'active' | 'paid';
	date_from?: string;
	date_to?: string;
	search?: string;
}

export interface ListLendingsResult {
	items: LendingWithPayments[];
	total: number;
	page: number;
	totalPages: number;
}

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

/**
 * List lendings with payment calculations, supporting server-side filtering and pagination.
 */
export async function listLendingsWithPayments(
	userId: number,
	direction: 'lent' | 'borrowed',
	filters: LendingFilters = {},
	page = 1,
	limit?: number
): Promise<ListLendingsResult> {
	const db = await getDrizzle();

	const conditions = [
		eq(lendings.user_id, userId),
		eq(lendings.direction, direction)
	];

	if (filters.status && ['active', 'paid'].includes(filters.status)) {
		conditions.push(eq(lendings.status, filters.status));
	}

	if (filters.date_from) {
		conditions.push(gte(lendings.date_lent, filters.date_from));
	}

	if (filters.date_to) {
		conditions.push(lte(lendings.date_lent, filters.date_to));
	}

	if (filters.search && filters.search.trim()) {
		const pattern = `%${filters.search.trim()}%`;
		conditions.push(
			or(
				ilike(lendings.borrower_name, pattern),
				ilike(lendings.notes, pattern)
			)!
		);
	}

	const whereClause = and(...conditions);

	const [countRow] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(lendings)
		.where(whereClause);

	const total = countRow?.count ? Number(countRow.count) : 0;

	const effectiveLimit = limit && limit > 0 ? limit : undefined;
	let totalPages = 1;
	let currentPage = Math.max(1, page);

	if (effectiveLimit) {
		totalPages = total > 0 ? Math.ceil(total / effectiveLimit) : 1;
		if (currentPage > totalPages && totalPages > 0) {
			currentPage = totalPages;
		}
	}

	const query = db
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
		.where(whereClause)
		.groupBy(lendings.id)
		.orderBy(desc(lendings.created_at));

	if (effectiveLimit) {
		query.limit(effectiveLimit).offset((currentPage - 1) * effectiveLimit);
	}

	const rows = await query;
	const items = rows.map(toLendingWithPayments);

	return {
		items,
		total,
		page: currentPage,
		totalPages
	};
}

/**
 * Get count of lendings by status for the filter options, optionally filtered by date/search.
 */
export async function getLendingStatusCounts(
	userId: number,
	direction: 'lent' | 'borrowed',
	filters: Omit<LendingFilters, 'status'> = {}
): Promise<{ all: number; active: number; paid: number }> {
	const db = await getDrizzle();

	const conditions = [
		eq(lendings.user_id, userId),
		eq(lendings.direction, direction)
	];

	if (filters.date_from) {
		conditions.push(gte(lendings.date_lent, filters.date_from));
	}

	if (filters.date_to) {
		conditions.push(lte(lendings.date_lent, filters.date_to));
	}

	if (filters.search && filters.search.trim()) {
		const pattern = `%${filters.search.trim()}%`;
		conditions.push(
			or(
				ilike(lendings.borrower_name, pattern),
				ilike(lendings.notes, pattern)
			)!
		);
	}

	const rows = await db
		.select({
			status: lendings.status,
			count: sql<number>`count(*)::int`
		})
		.from(lendings)
		.where(and(...conditions))
		.groupBy(lendings.status);

	let active = 0;
	let paid = 0;
	for (const row of rows) {
		if (row.status === 'active') active = Number(row.count);
		if (row.status === 'paid') paid = Number(row.count);
	}

	return {
		all: active + paid,
		active,
		paid
	};
}

/**
 * Get a single lending with its derived payment state.
 */
export async function getLendingWithPayments(
	userId: number,
	lendingId: number
): Promise<LendingWithPayments | undefined> {
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

/**
 * Recalculate and cache status on the lendings row.
 * This is the ONLY function that writes to lendings.status.
 */
export async function recalcStatusCache(
	userId: number,
	lendingId: number
): Promise<'active' | 'paid'> {
	const db = await getDrizzle();
	const [row] = await db
		.select({
			amount: lendings.amount,
			resolved: sql<string>`COALESCE((SELECT SUM(p.amount) FROM ${lendingPayments} p WHERE p.lending_id = ${lendingId} AND p.payment_type IN ('payment', 'write_off')), 0)`
		})
		.from(lendings)
		.where(and(eq(lendings.user_id, userId), eq(lendings.id, lendingId)))
		.limit(1);

	if (!row) throw new Error('Lending not found');

	const amount = parseFloat(String(row.amount));
	const resolved = parseFloat(String(row.resolved ?? '0'));
	const status = amount - resolved <= 0 ? 'paid' : 'active';

	await db
		.update(lendings)
		.set({ status, updated_at: new Date() })
		.where(and(eq(lendings.user_id, userId), eq(lendings.id, lendingId)));

	return status as 'active' | 'paid';
}

/**
 * Record a new payment.
 *
 * Executes inside a single database transaction:
 * 1. Lock the lending row with SELECT FOR UPDATE to prevent concurrent payment races
 * 2. Atomically check remaining >= payment amount
 * 3. Insert the payment row
 * 4. Create a linked transaction (if requested and payment_type='payment')
 * 5. Update the payment's transaction_id
 * 6. Recalculate status cache
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

	const db = await getDrizzle();
	return db.transaction(async (tx) => {
		// 1. Lock the lending row and verify it exists (SELECT FOR UPDATE prevents concurrent modifications)
		const [lending] = await tx
			.select()
			.from(lendings)
			.where(and(eq(lendings.user_id, userId), eq(lendings.id, lendingId)))
			.for('update');
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

	const db = await getDrizzle();
	return db.transaction(async (tx) => {
		// 1. Get the payment and verify ownership
		const [payment] = await tx
			.select()
			.from(lendingPayments)
			.where(and(eq(lendingPayments.user_id, userId), eq(lendingPayments.id, paymentId)));
		if (!payment) throw new Error('Payment not found');

		// 2. Get and lock the lending row (SELECT FOR UPDATE)
		const [lending] = await tx
			.select()
			.from(lendings)
			.where(and(eq(lendings.user_id, userId), eq(lendings.id, payment.lending_id)))
			.for('update');
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

/**
 * Delete a payment.
 * Deletes the linked transaction first, then the payment.
 * Recalculates status cache — may reopen the loan.
 */
export async function deletePayment(
	userId: number,
	paymentId: number
): Promise<void> {
	const db = await getDrizzle();
	return db.transaction(async (tx) => {
		// 1. Get the payment and verify ownership
		const [payment] = await tx
			.select()
			.from(lendingPayments)
			.where(and(eq(lendingPayments.user_id, userId), eq(lendingPayments.id, paymentId)));
		if (!payment) throw new Error('Payment not found');

		// 2. Get and lock the lending row (SELECT FOR UPDATE)
		const [lending] = await tx
			.select()
			.from(lendings)
			.where(and(eq(lendings.user_id, userId), eq(lendings.id, payment.lending_id)))
			.for('update');
		if (!lending) throw new Error('Lending record not found');

		// 3. Delete linked transaction (if any)
		if (payment.transaction_id) {
			await tx
				.delete(transactions)
				.where(and(eq(transactions.user_id, userId), eq(transactions.id, payment.transaction_id)));
		}

		// 4. Delete the payment
		await tx
			.delete(lendingPayments)
			.where(and(eq(lendingPayments.user_id, userId), eq(lendingPayments.id, paymentId)));

		// 5. Recalculate status cache
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

/**
 * Get payment history for a lending.
 * Ordered by payment_date DESC, created_at DESC, id DESC.
 */
export async function getPaymentHistory(
	userId: number,
	lendingId: number
): Promise<LendingPayment[]> {
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

/**
 * Check if a lending has any payments.
 */
export async function hasPayments(userId: number, lendingId: number): Promise<boolean> {
	const db = await getDrizzle();
	const [row] = await db
		.select({ count: sql<number>`count(*)` })
		.from(lendingPayments)
		.where(and(eq(lendingPayments.user_id, userId), eq(lendingPayments.lending_id, lendingId)));
	return (row?.count ?? 0) > 0;
}

/**
 * Delete all linked transactions for a lending (used before deleting the lending itself).
 */
export async function deleteLinkedTransactions(userId: number, lendingId: number): Promise<void> {
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
}

/**
 * Delete a lending's linked transactions inside an existing Drizzle transaction.
 *
 * Uses the supplied transaction context ONLY — never the global db, which on
 * Postgres can use another pooled connection and silently escape the
 * transaction. Must NOT be called outside a transaction; it does not open one.
 */
async function deleteLinkedTransactionsInTxDrizzle(
	tx: DrizzleTransaction,
	userId: number,
	lendingId: number
): Promise<void> {
	const payments = await tx
		.select({ transaction_id: lendingPayments.transaction_id })
		.from(lendingPayments)
		.where(and(eq(lendingPayments.lending_id, lendingId), isNotNull(lendingPayments.transaction_id)));

	for (const p of payments) {
		if (p.transaction_id) {
			await tx
				.delete(transactions)
				.where(and(eq(transactions.user_id, userId), eq(transactions.id, p.transaction_id)));
		}
	}
}

/**
 * Delete a lending AND its linked transactions atomically.
 *
 * Mirrors the existing Option-C transaction pattern (recordPayment/updatePayment/
 * deletePayment): the public function owns ONE transaction and every internal
 * operation runs through the supplied transaction context. If any step fails,
 * the whole delete — linked transactions plus the lending (and its cascaded
 * lending_payments) — rolls back together.
 *
 * Returns true if the lending existed and was deleted, false if it did not
 * exist. Callers preserve the existing "delete always reports success" route
 * behavior and may ignore the boolean.
 */
export async function deleteLending(userId: number, lendingId: number): Promise<boolean> {
	const db = await getDrizzle();
	return db.transaction(async (tx) => {
		await deleteLinkedTransactionsInTxDrizzle(tx, userId, lendingId);

		const [row] = await tx
			.delete(lendings)
			.where(and(eq(lendings.user_id, userId), eq(lendings.id, lendingId)))
			.returning({ id: lendings.id });
		return !!row;
	});
}

/**
 * Create a lending AND, when requested, its linked category/ledger transaction
 * atomically.
 *
 * Mirrors the established Option-C transaction pattern (recordPayment/deleteLending):
 * the public function owns ONE transaction and every internal operation runs
 * through the supplied transaction context. The lending INSERT and the linked
 * transaction's category lookup/create + INSERT commit or roll back together on
 * both SQLite and Postgres.
 *
 * When recordAsTransaction is false the lending is still created transactionally,
 * but no ledger transaction or category is written.
 *
 * Returns { success: true, id } (the new lending's id) on success; throws
 * (rolling everything back) on failure.
 */
export async function createLending(
	userId: number,
	input: {
		borrowerName: string;
		amount: number;
		interestRate: number;
		dateLent: string;
		dueDate: string | null;
		notes: string | null;
		direction: 'lent' | 'borrowed';
		recordAsTransaction: boolean;
	}
): Promise<{ success: true; id: number }> {
	const db = await getDrizzle();
	return db.transaction(async (tx) => {
		const [created] = await tx
			.insert(lendings)
			.values({
				user_id: userId,
				borrower_name: input.borrowerName,
				amount: String(input.amount),
				interest_rate: String(input.interestRate),
				date_lent: input.dateLent,
				due_date: input.dueDate,
				notes: input.notes,
				direction: input.direction
			})
			.returning({ id: lendings.id });

		if (input.recordAsTransaction) {
			await recordLendingTransactionInTxDrizzle(tx, userId, {
				event: 'create',
				direction: input.direction,
				amount: input.amount,
				partyName: input.borrowerName,
				date: input.dateLent
			});
		}

		return { success: true as const, id: created.id };
	});
}

/**
 * Update an existing lending, applying the payment lock.
 *
 * One source of truth for the lending-update rules shared by the lending/
 * borrowed page actions and the API PUT:
 *   - Ownership is enforced inside the transaction (throws 'Lending not found').
 *   - If any payments exist, amount and date_lent are LOCKED — only metadata
 *     (borrower_name, interest_rate, due_date, notes) is updated. The caller's
 *     amount/dateLent values are ignored, matching the page-action behavior.
 *   - If no payments exist, amount and date_lent are editable (amount must be
 *     a positive number).
 *   - `status` is never part of the input: it is a system-maintained cache
 *     derived from payment history and cannot be set by the client. A lending
 *     update never writes status — with no payments the remaining balance is
 *     amount > 0, so the derived status stays 'active', which the cache already
 *     holds; with payments the amount is locked so the derived status is
 *     unchanged too.
 *
 * Option-C transaction pattern: the public function owns ONE transaction and
 * every read/write runs through the supplied transaction context — never the
 * global db, which on Postgres would use another pooled connection and escape
 * the transaction.
 */
export async function updateLending(
	userId: number,
	lendingId: number,
	input: {
		borrowerName: string;
		amount: number;
		interestRate: number;
		dateLent: string;
		dueDate: string | null;
		notes: string | null;
	}
): Promise<{ success: true }> {
	const db = await getDrizzle();
	return db.transaction(async (tx) => {
		// Enforce ownership inside the transaction.
		const [existing] = await tx
			.select()
			.from(lendings)
			.where(and(eq(lendings.user_id, userId), eq(lendings.id, lendingId)));
		if (!existing) throw new Error('Lending not found');

		// Payment lock: if any payments exist, amount/date_lent are immutable.
		const [paymentsRow] = await tx
			.select({ count: sql<number>`count(*)` })
			.from(lendingPayments)
			.where(and(eq(lendingPayments.user_id, userId), eq(lendingPayments.lending_id, lendingId)));
		const hasPayments = (paymentsRow?.count ?? 0) > 0;

		if (hasPayments) {
			await tx
				.update(lendings)
				.set({
					borrower_name: input.borrowerName,
					interest_rate: String(input.interestRate),
					due_date: input.dueDate,
					notes: input.notes,
					updated_at: new Date()
				})
				.where(and(eq(lendings.user_id, userId), eq(lendings.id, lendingId)));
		} else {
			if (!(input.amount > 0)) throw new Error('Amount must be a positive number');
			await tx
				.update(lendings)
				.set({
					borrower_name: input.borrowerName,
					amount: String(input.amount),
					interest_rate: String(input.interestRate),
					date_lent: input.dateLent,
					due_date: input.dueDate,
					notes: input.notes,
					updated_at: new Date()
				})
				.where(and(eq(lendings.user_id, userId), eq(lendings.id, lendingId)));
		}

		return { success: true as const };
	});
}

/**
 * Get aggregate totals for summary cards (payment-driven, not status-driven).
 */
export async function getLendingTotals(
	userId: number,
	direction: 'lent' | 'borrowed'
): Promise<{ total: number; cashPaid: number; writtenOff: number; outstanding: number }> {
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

/**
 * Map a Drizzle `lendings` row (Postgres path) to the app's `Lending` shape.
 * Postgres NUMERIC columns arrive as strings and timestamp columns as JS Date
 * objects, so monetary fields are parsed and timestamps converted to ISO strings.
 * interest_rate is nullable in the DB but `Lending.interest_rate` is a number —
 * null is coerced to 0 (the column's DEFAULT '0'), matching `toLendingWithPayments`.
 */
function mapLendingRow(row: typeof lendings.$inferSelect): Lending {
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
		created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
		updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
		direction: row.direction as 'lent' | 'borrowed',
	};
}

/**
 * Search lendings by borrower name (substring, case-insensitive).
 * Returns up to 5 results ordered by date_lent DESC.
 */
export async function searchLendings(
	userId: number,
	q: string,
	direction?: 'lent' | 'borrowed'
): Promise<Lending[]> {
	const pattern = `%${q}%`;

	const db = await getDrizzle();
	const conditions = and(
		eq(lendings.user_id, userId),
		ilike(lendings.borrower_name, pattern)
	);

	if (direction && ['lent', 'borrowed'].includes(direction)) {
		const rows = await db
			.select()
			.from(lendings)
			.where(and(conditions, eq(lendings.direction, direction)))
			.orderBy(desc(lendings.date_lent))
			.limit(5);
		return rows.map(mapLendingRow);
	}

	const rows = await db
		.select()
		.from(lendings)
		.where(conditions)
		.orderBy(desc(lendings.date_lent))
		.limit(5);
	return rows.map(mapLendingRow);
}

/**
 * Get a lending by ID (user-scoped).
 * Returns the raw lending row with all fields.
 * Does NOT normalize dates or coerce numeric values.
 * Preserves PostgreSQL Date objects for date_lent.
 */
export async function getLending(
	userId: number,
	lendingId: number
): Promise<Lending | undefined> {
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
		})
		.from(lendings)
		.where(and(eq(lendings.user_id, userId), eq(lendings.id, lendingId)))
		.limit(1);
	if (!rows.length) return undefined;
	// Coerce numeric fields from string (Postgres NUMERIC) to number
	const row = rows[0];
	return {
		...row,
		amount: parseFloat(String(row.amount)),
		interest_rate: parseFloat(String(row.interest_rate ?? '0')),
		created_at: toSqliteTimestamp(row.created_at),
		updated_at: toSqliteTimestamp(row.updated_at),
	} as Lending;
}

/**
 * Get a lending_payment by ID (user-scoped).
 * Returns only the lending_id needed for updatePayment validation.
 */
export async function getPayment(
	userId: number,
	paymentId: number
): Promise<{ lending_id: number } | undefined> {
	const db = await getDrizzle();
	const rows = await db
		.select({ lending_id: lendingPayments.lending_id })
		.from(lendingPayments)
		.where(and(eq(lendingPayments.user_id, userId), eq(lendingPayments.id, paymentId)))
		.limit(1);
	if (!rows.length) return undefined;
	return rows[0];
}
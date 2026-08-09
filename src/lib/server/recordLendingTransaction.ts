import { queryOne, execute } from '$lib/database/query';
import { usePostgres } from '$lib/database';
import { getDrizzle } from '$lib/database/drizzle';
import { categories, transactions } from '$lib/database/schema';
import { and, eq } from 'drizzle-orm';

type DrizzleDb = Awaited<ReturnType<typeof getDrizzle>>;
type DrizzleTransaction = Parameters<Parameters<DrizzleDb['transaction']>[0]>[0];

export type RecordLendingTransactionParams = {
	event: 'create' | 'repayment';
	direction: 'lent' | 'borrowed';
	amount: number;
	partyName: string;
	date: string;
};

/** Raw/query tx-helper shape used by recordLendingTransactionInTx(). */
type RawTx = {
	queryOne: <U>(text: string, params?: unknown[]) => Promise<U | undefined>;
	execute: (text: string, params?: unknown[]) => Promise<void>;
};

/**
 * Map a lending lifecycle event + direction to the linked transaction's type,
 * category and description. Pure computation — no DB access — shared by the
 * public recordLendingTransaction() and its transaction-aware variants so the
 * business rules can never drift apart.
 */
function resolveLendingTransactionMapping(
	event: 'create' | 'repayment',
	direction: 'lent' | 'borrowed',
	partyName: string
): {
	transactionType: 'income' | 'expense';
	categoryName: string;
	categoryColor: string;
	categoryIcon: string;
	description: string;
} {
	if (event === 'create') {
		if (direction === 'lent') {
			return {
				transactionType: 'expense',
				categoryName: 'Lending Recovery',
				categoryColor: '#8b5cf6',
				categoryIcon: '💳',
				description: `Lent to ${partyName}`
			};
		}
		return {
			transactionType: 'income',
			categoryName: 'Debt Repayment',
			categoryColor: '#ef4444',
			categoryIcon: '💸',
			description: `Borrowed from ${partyName}`
		};
	}
	// event === 'repayment'
	if (direction === 'lent') {
		return {
			transactionType: 'income',
			// Canonical name: "Loan Repayment" — fallback to legacy "Lending Recovery"
			categoryName: 'Loan Repayment',
			categoryColor: '#8b5cf6',
			categoryIcon: '💳',
			description: `Repayment from ${partyName}`
		};
	}
	return {
		transactionType: 'expense',
		categoryName: 'Debt Repayment',
		categoryColor: '#ef4444',
		categoryIcon: '💸',
		description: `Repaid to ${partyName}`
	};
}

/**
 * Transaction-aware variant of recordLendingTransaction() for the SQLite path.
 *
 * Uses ONLY the supplied transaction context (tx.queryOne / tx.execute) — never
 * the global query layer, which on SQLite would only appear transactional because
 * of the single shared connection. Must be called from inside an open
 * withTransaction(); it does not open its own transaction.
 *
 * Returns the created transaction's ID (or null if none was created).
 */
export async function recordLendingTransactionInTx(
	tx: RawTx,
	userId: number,
	params: RecordLendingTransactionParams
): Promise<number | null> {
	const { event, direction, amount, partyName, date } = params;
	const { transactionType, categoryName, categoryColor, categoryIcon, description } =
		resolveLendingTransactionMapping(event, direction, partyName);

	// Find or create category — fallback lookup chain for lending repayments
	let categoryId: number;

	if (event === 'repayment' && direction === 'lent') {
		// Try canonical name "Loan Repayment" first
		const canonicalCat = await tx.queryOne<{ id: number }>(
			'SELECT id FROM categories WHERE user_id = $1 AND name = $2',
			[userId, 'Loan Repayment']
		);
		if (canonicalCat) {
			categoryId = canonicalCat.id;
		} else {
			// Fallback to legacy name "Lending Recovery"
			const legacyCat = await tx.queryOne<{ id: number }>(
				'SELECT id FROM categories WHERE user_id = $1 AND name = $2',
				[userId, 'Lending Recovery']
			);
			if (legacyCat) {
				categoryId = legacyCat.id;
			} else {
				// Create "Loan Repayment"
				await tx.execute(
					'INSERT INTO categories (user_id, name, color, icon, type) VALUES ($1, $2, $3, $4, $5)',
					[userId, 'Loan Repayment', categoryColor, categoryIcon, transactionType]
				);
				const newCat = await tx.queryOne<{ id: number }>(
					'SELECT id FROM categories WHERE user_id = $1 AND name = $2',
					[userId, 'Loan Repayment']
				);
				categoryId = newCat!.id;
			}
		}
	} else {
		// Standard lookup for all other cases
		const existingCategory = await tx.queryOne<{ id: number }>(
			'SELECT id FROM categories WHERE user_id = $1 AND name = $2',
			[userId, categoryName]
		);

		if (existingCategory) {
			categoryId = existingCategory.id;
		} else {
			await tx.execute(
				'INSERT INTO categories (user_id, name, color, icon, type) VALUES ($1, $2, $3, $4, $5)',
				[userId, categoryName, categoryColor, categoryIcon, transactionType]
			);
			const newCat = await tx.queryOne<{ id: number }>(
				'SELECT id FROM categories WHERE user_id = $1 AND name = $2',
				[userId, categoryName]
			);
			categoryId = newCat!.id;
		}
	}

	// Insert transaction
	await tx.execute(
		'INSERT INTO transactions (user_id, amount, description, date, category_id, type) VALUES ($1, $2, $3, $4, $5, $6)',
		[userId, amount, description, date, categoryId, transactionType]
	);

	// Return the created transaction ID
	const newTx = await tx.queryOne<{ id: number }>(
		'SELECT id FROM transactions WHERE user_id = $1 ORDER BY id DESC LIMIT 1',
		[userId]
	);
	return newTx?.id ?? null;
}

/**
 * Transaction-aware variant of recordLendingTransaction() for the Postgres/Drizzle
 * path.
 *
 * Uses ONLY the supplied Drizzle transaction context (tx.select / tx.insert) —
 * never getDrizzle()'s global db, which would use a different pooled connection
 * and escape the outer transaction. Must be called from inside a db.transaction();
 * it does not open its own transaction.
 *
 * Returns the created transaction's ID (or null if none was created).
 */
export async function recordLendingTransactionInTxDrizzle(
	tx: DrizzleTransaction,
	userId: number,
	params: RecordLendingTransactionParams
): Promise<number | null> {
	const { event, direction, amount, partyName, date } = params;
	const { transactionType, categoryName, categoryColor, categoryIcon, description } =
		resolveLendingTransactionMapping(event, direction, partyName);

	// Find or create category — fallback lookup chain for lending repayments
	let categoryId: number;

	if (event === 'repayment' && direction === 'lent') {
		// Try canonical name "Loan Repayment" first
		const [canonicalCat] = await tx
			.select({ id: categories.id })
			.from(categories)
			.where(and(eq(categories.user_id, userId), eq(categories.name, 'Loan Repayment')));
		if (canonicalCat) {
			categoryId = canonicalCat.id;
		} else {
			// Fallback to legacy name "Lending Recovery"
			const [legacyCat] = await tx
				.select({ id: categories.id })
				.from(categories)
				.where(and(eq(categories.user_id, userId), eq(categories.name, 'Lending Recovery')));
			if (legacyCat) {
				categoryId = legacyCat.id;
			} else {
				// Create "Loan Repayment"
				const [newCat] = await tx
					.insert(categories)
					.values({
						user_id: userId,
						name: 'Loan Repayment',
						color: categoryColor,
						icon: categoryIcon,
						type: transactionType
					})
					.returning({ id: categories.id });
				categoryId = newCat.id;
			}
		}
	} else {
		// Standard lookup for all other cases
		const [existingCategory] = await tx
			.select({ id: categories.id })
			.from(categories)
			.where(and(eq(categories.user_id, userId), eq(categories.name, categoryName)));
		if (existingCategory) {
			categoryId = existingCategory.id;
		} else {
			const [newCat] = await tx
				.insert(categories)
				.values({
					user_id: userId,
					name: categoryName,
					color: categoryColor,
					icon: categoryIcon,
					type: transactionType
				})
				.returning({ id: categories.id });
			categoryId = newCat.id;
		}
	}

	// Insert transaction
	const [newTx] = await tx
		.insert(transactions)
		.values({
			user_id: userId,
			amount: String(amount),
			description,
			date,
			category_id: categoryId,
			type: transactionType
		})
		.returning({ id: transactions.id });
	return newTx.id;
}

/**
 * Records a financial transaction linked to a lending/borrowing lifecycle event.
 *
 * Business rule mapping:
 * - event='create' + direction='lent'        → expense ("Lent to {party}")
 * - event='create' + direction='borrowed'    → income ("Borrowed from {party}")
 * - event='repayment' + direction='lent'     → income ("Repayment from {party}")
 * - event='repayment' + direction='borrowed' → expense ("Repaid to {party}")
 *
 * Categories are looked up by name with a fallback chain:
 * - Lending repayment → "Loan Repayment" (fallback: "Lending Recovery")
 * - Borrowed repayment → "Debt Repayment"
 * Never renames existing user categories. Never hardcodes category IDs.
 *
 * Returns the created transaction's ID (or null if no transaction was created).
 */
export async function recordLendingTransaction(
	userId: number,
	params: RecordLendingTransactionParams
): Promise<number | null> {
	const { event, direction, amount, partyName, date } = params;
	const { transactionType, categoryName, categoryColor, categoryIcon, description } =
		resolveLendingTransactionMapping(event, direction, partyName);

	// Find or create category — fallback lookup chain for lending repayments
	let categoryId: number;

	if (usePostgres) {
		const db = await getDrizzle();

		if (event === 'repayment' && direction === 'lent') {
			// Try canonical name "Loan Repayment" first
			const [canonicalCat] = await db
				.select({ id: categories.id })
				.from(categories)
				.where(and(eq(categories.user_id, userId), eq(categories.name, 'Loan Repayment')));
			if (canonicalCat) {
				categoryId = canonicalCat.id;
			} else {
				// Fallback to legacy name "Lending Recovery"
				const [legacyCat] = await db
					.select({ id: categories.id })
					.from(categories)
					.where(and(eq(categories.user_id, userId), eq(categories.name, 'Lending Recovery')));
				if (legacyCat) {
					categoryId = legacyCat.id;
				} else {
					// Create "Loan Repayment"
					const [newCat] = await db
						.insert(categories)
						.values({
							user_id: userId,
							name: 'Loan Repayment',
							color: categoryColor,
							icon: categoryIcon,
							type: transactionType
						})
						.returning({ id: categories.id });
					categoryId = newCat.id;
				}
			}
		} else {
			// Standard lookup for all other cases
			const [existingCategory] = await db
				.select({ id: categories.id })
				.from(categories)
				.where(and(eq(categories.user_id, userId), eq(categories.name, categoryName)));
			if (existingCategory) {
				categoryId = existingCategory.id;
			} else {
				const [newCat] = await db
					.insert(categories)
					.values({
						user_id: userId,
						name: categoryName,
						color: categoryColor,
						icon: categoryIcon,
						type: transactionType
					})
					.returning({ id: categories.id });
				categoryId = newCat.id;
			}
		}
	} else {
		// SQLite / raw query path
		if (event === 'repayment' && direction === 'lent') {
			// Try canonical name "Loan Repayment" first
			const canonicalCat = await queryOne<{ id: number }>(
				'SELECT id FROM categories WHERE user_id = $1 AND name = $2',
				[userId, 'Loan Repayment']
			);
			if (canonicalCat) {
				categoryId = canonicalCat.id;
			} else {
				// Fallback to legacy name "Lending Recovery"
				const legacyCat = await queryOne<{ id: number }>(
					'SELECT id FROM categories WHERE user_id = $1 AND name = $2',
					[userId, 'Lending Recovery']
				);
				if (legacyCat) {
					categoryId = legacyCat.id;
				} else {
					// Create "Loan Repayment"
					await execute(
						'INSERT INTO categories (user_id, name, color, icon, type) VALUES ($1, $2, $3, $4, $5)',
						[userId, 'Loan Repayment', categoryColor, categoryIcon, transactionType]
					);
					const newCat = await queryOne<{ id: number }>(
						'SELECT id FROM categories WHERE user_id = $1 AND name = $2',
						[userId, 'Loan Repayment']
					);
					categoryId = newCat!.id;
				}
			}
		} else {
			// Standard lookup for all other cases
			const existingCategory = await queryOne<{ id: number }>(
				'SELECT id FROM categories WHERE user_id = $1 AND name = $2',
				[userId, categoryName]
			);

			if (existingCategory) {
				categoryId = existingCategory.id;
			} else {
				await execute(
					'INSERT INTO categories (user_id, name, color, icon, type) VALUES ($1, $2, $3, $4, $5)',
					[userId, categoryName, categoryColor, categoryIcon, transactionType]
				);
				const newCat = await queryOne<{ id: number }>(
					'SELECT id FROM categories WHERE user_id = $1 AND name = $2',
					[userId, categoryName]
				);
				categoryId = newCat!.id;
			}
		}
	}

	// Insert transaction
	if (usePostgres) {
		const db = await getDrizzle();
		const [newTx] = await db
			.insert(transactions)
			.values({
				user_id: userId,
				amount: String(amount),
				description,
				date,
				category_id: categoryId,
				type: transactionType
			})
			.returning({ id: transactions.id });
		return newTx.id;
	}

	// SQLite path
	await execute(
		'INSERT INTO transactions (user_id, amount, description, date, category_id, type) VALUES ($1, $2, $3, $4, $5, $6)',
		[userId, amount, description, date, categoryId, transactionType]
	);

	// Return the created transaction ID
	const newTx = await queryOne<{ id: number }>(
		'SELECT id FROM transactions WHERE user_id = $1 ORDER BY id DESC LIMIT 1',
		[userId]
	);
	return newTx?.id ?? null;
}

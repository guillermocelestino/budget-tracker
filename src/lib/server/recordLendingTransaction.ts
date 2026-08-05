import { queryOne, execute } from '$lib/database/query';

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
	params: {
		event: 'create' | 'repayment';
		direction: 'lent' | 'borrowed';
		amount: number;
		partyName: string;
		date: string;
	}
): Promise<number | null> {
	const { event, direction, amount, partyName, date } = params;

	// Business rule: determine transaction type, category, and description from event + direction
	let transactionType: 'income' | 'expense';
	let categoryName: string;
	let categoryColor: string;
	let categoryIcon: string;
	let description: string;

	if (event === 'create') {
		if (direction === 'lent') {
			transactionType = 'expense';
			categoryName = 'Lending Recovery';
			categoryColor = '#8b5cf6';
			categoryIcon = '💳';
			description = `Lent to ${partyName}`;
		} else {
			transactionType = 'income';
			categoryName = 'Debt Repayment';
			categoryColor = '#ef4444';
			categoryIcon = '💸';
			description = `Borrowed from ${partyName}`;
		}
	} else {
		// event === 'repayment'
		if (direction === 'lent') {
			transactionType = 'income';
			// Canonical name: "Loan Repayment" — fallback to legacy "Lending Recovery"
			categoryName = 'Loan Repayment';
			categoryColor = '#8b5cf6';
			categoryIcon = '💳';
			description = `Repayment from ${partyName}`;
		} else {
			transactionType = 'expense';
			categoryName = 'Debt Repayment';
			categoryColor = '#ef4444';
			categoryIcon = '💸';
			description = `Repaid to ${partyName}`;
		}
	}

	// Find or create category — fallback lookup chain for lending repayments
	let categoryId: number;

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

	// Insert transaction
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
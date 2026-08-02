import { queryOne, execute } from '$lib/database/query';

/**
 * Records a financial transaction linked to a lending/borrowing lifecycle event.
 *
 * This helper owns the business rule mapping:
 * - event='create' + direction='lent'      → expense ("Lent to {party}")
 * - event='create' + direction='borrowed'  → income ("Borrowed from {party}")
 * - event='repayment' + direction='lent'   → income ("Repayment from {party}")
 * - event='repayment' + direction='borrowed' → expense ("Repaid to {party}")
 *
 * Categories are looked up or created as needed.
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
): Promise<void> {
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
			categoryName = 'Lending Recovery';
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

	// Find or create category
	const existingCategory = await queryOne<{ id: number }>(
		'SELECT id FROM categories WHERE user_id = $1 AND name = $2',
		[userId, categoryName]
	);

	let categoryId: number;
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

	// Insert transaction
	await execute(
		'INSERT INTO transactions (user_id, amount, description, date, category_id, type) VALUES ($1, $2, $3, $4, $5, $6)',
		[userId, amount, description, date, categoryId, transactionType]
	);
}
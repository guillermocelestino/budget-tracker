import { fail } from '@sveltejs/kit';
import { execute, queryOne } from '$lib/database/query';

interface ImportRow {
	date: string;
	description: string;
	amount: number;
	type: 'income' | 'expense';
	category_name: string;
}

export const actions = {
	import: async ({ request, locals }) => {
		const userId = locals.user!.userId;
		const data = await request.formData();
		const rowsJson = data.get('rows') as string;

		if (!rowsJson) {
			return fail(400, { error: 'No transaction data provided' });
		}

		let rows: ImportRow[];
		try {
			rows = JSON.parse(rowsJson);
		} catch {
			return fail(400, { error: 'Invalid transaction data format' });
		}

		if (!Array.isArray(rows) || rows.length === 0) {
			return fail(400, { error: 'No transactions to import' });
		}

		// Validate each row
		const errors: string[] = [];
		const validRows: ImportRow[] = [];

		for (let i = 0; i < rows.length; i++) {
			const row = rows[i];
			const rowNum = i + 1;
			const rowErrors: string[] = [];

			if (!row.date || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
				rowErrors.push('invalid date (expected YYYY-MM-DD)');
			}
			if (!row.description || row.description.trim().length === 0) {
				rowErrors.push('missing description');
			}
			if (typeof row.amount !== 'number' || isNaN(row.amount) || row.amount <= 0) {
				rowErrors.push('invalid amount (must be positive number)');
			}
			if (!['income', 'expense'].includes(row.type)) {
				rowErrors.push('type must be income or expense');
			}
			if (!row.category_name || row.category_name.trim().length === 0) {
				rowErrors.push('missing category name');
			}

			if (rowErrors.length > 0) {
				errors.push(`Row ${rowNum}: ${rowErrors.join(', ')}`);
			} else {
				validRows.push(row);
			}
		}

		if (errors.length > 0) {
			return fail(400, { error: 'Validation failed', details: errors });
		}

		let inserted = 0;
		for (const row of validRows) {
			// Find or create matching category
			const catName = row.category_name.trim();
			let cat = await queryOne<{ id: number }>(
				'SELECT id FROM categories WHERE user_id = $1 AND LOWER(name) = LOWER($2)',
				[userId, catName]
			);

			if (!cat) {
				await execute(
					`INSERT INTO categories (user_id, name, color, icon, type)
					 VALUES ($1, $2, $3, $4, $5)`,
					[userId, catName, '#6366f1', '📁', row.type]
				);
				cat = await queryOne<{ id: number }>(
					'SELECT id FROM categories WHERE user_id = $1 AND name = $2',
					[userId, catName]
				);
			}

			if (!cat) continue;

			await execute(
				`INSERT INTO transactions (user_id, amount, description, date, category_id, type)
				 VALUES ($1, $2, $3, $4, $5, $6)`,
				[userId, Math.abs(row.amount), row.description.trim(), row.date, cat.id, row.type]
			);
			inserted++;
		}

		return {
			success: true,
			imported: inserted,
			total: validRows.length,
		};
	},
};

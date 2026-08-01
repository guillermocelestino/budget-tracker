import { fail } from '@sveltejs/kit';
import { queryOne, queryMany, execute } from '$lib/database/query';
import type { Transaction, Category } from '$lib/types';
import { validateMappedRow, detectDuplicates, normCategoryName, type ImportMappingConfig } from '$lib/utils/importValidation';

interface ImportRow {
	date: string;
	description: string;
	amount: number;
	type: 'income' | 'expense';
	category_name: string;
}

export async function load({ url, locals }: { url: URL; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
	const limit = 20;
	const offset = (page - 1) * limit;
	const type = url.searchParams.get('type');
	const category_id = url.searchParams.get('category_id');
	const date_from = url.searchParams.get('date_from');
	const date_to = url.searchParams.get('date_to');
	const search = url.searchParams.get('search');

	const conditions: string[] = ['t.user_id = $1'];
	const params: (string | number)[] = [userId];

	if (type && (type === 'income' || type === 'expense')) {
		conditions.push('t.type = $' + (params.length + 1));
		params.push(type);
	}
	if (category_id) {
		conditions.push('t.category_id = $' + (params.length + 1));
		params.push(parseInt(category_id));
	}
	if (date_from) {
		conditions.push('t.date >= $' + (params.length + 1));
		params.push(date_from);
	}
	if (date_to) {
		conditions.push('t.date <= $' + (params.length + 1));
		params.push(date_to);
	}
	if (search && search.trim()) {
		const like = `%${search.trim()}%`;
		conditions.push(`(t.description ILIKE $${params.length + 1} OR c.name ILIKE $${params.length + 2})`);
		params.push(like, like);
	}

	const where = 'WHERE ' + conditions.join(' AND ');

	const countRow = await queryOne<{ total: number }>(
		`SELECT COUNT(*)::int as total
		 FROM transactions t
		 LEFT JOIN categories c ON t.category_id = c.id
		 ${where}`,
		params
	);

	const transactions = await queryMany<Transaction>(
		`SELECT t.*, c.name as category_name, c.color as category_color
		 FROM transactions t
		 LEFT JOIN categories c ON t.category_id = c.id
		 ${where}
		 ORDER BY t.date DESC, t.id DESC
		 LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
		[...params, limit, offset]
	);

	// Fetch ALL transactions matching the current filter (no pagination) for running balance computation
	// This ensures the running balance column is correct across pages
	const allForBalance = await queryMany<Transaction>(
		`SELECT t.*, c.name as category_name, c.color as category_color
		 FROM transactions t
		 LEFT JOIN categories c ON t.category_id = c.id
		 ${where}
		 ORDER BY t.date ASC, t.id ASC`,
		params
	);

	const categories = await queryMany<Category>('SELECT * FROM categories WHERE user_id = $1 ORDER BY name ASC', [userId]);

	return {
		transactions,
		allForBalance,
		total: countRow?.total ?? 0,
		page,
		totalPages: Math.ceil((countRow?.total ?? 0) / limit),
		categories,
	};
}

export const actions = {
	delete: async ({ request, locals }) => {
		const userId = locals.user!.userId;
		const data = await request.formData();
		const id = parseInt(data.get('id') as string);

		if (isNaN(id)) {
			return fail(400, { error: 'Invalid transaction ID' });
		}

		const existing = await queryOne<{ id: number }>('SELECT id FROM transactions WHERE user_id = $1 AND id = $2', [userId, id]);
		if (!existing) {
			return fail(404, { error: 'Transaction not found' });
		}

		await execute('DELETE FROM transactions WHERE user_id = $1 AND id = $2', [userId, id]);
		return { success: true };
	},

	import: async ({ request, locals }) => {
		const userId = locals.user!.userId;
		const data = await request.formData();
		const rowsJson = data.get('rows') as string;
		const configJson = data.get('config') as string;

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

		// Parse config (values are re-validated defensively — the client already
		// produced them, but a crafted request must not smuggle an invalid rule)
		let config: ImportMappingConfig = { dateFormat: 'YYYY-MM-DD', typeRule: 'sign' };
		try {
			const parsed = configJson ? JSON.parse(configJson) : {};
			if (typeof parsed.dateFormat === 'string' && parsed.dateFormat) {
				config.dateFormat = parsed.dateFormat;
			}
			if (['sign', 'column', 'debit_credit'].includes(parsed.typeRule)) {
				config.typeRule = parsed.typeRule;
			}
		} catch {
			// keep safe defaults
		}

		// Fetch user categories for validation + duplicate detection (needs id to map category_id → name)
		const userCategories = await queryMany<Category>(
			'SELECT id, name, type FROM categories WHERE user_id = $1 ORDER BY name ASC',
			[userId]
		);

		// Validate each row
		const errors: string[] = [];
		const validRows: ImportRow[] = [];

		for (let i = 0; i < rows.length; i++) {
			const row = rows[i];
			const rowNum = i + 1;
			const rowErrors: string[] = [];

			const result = validateMappedRow(row, userCategories, config);

			if (result.valid) {
				validRows.push(row);
			} else {
				for (const err of result.errors) {
					errors.push(`Row ${rowNum}: ${err}`);
				}
			}
		}

		if (validRows.length === 0) {
			return fail(400, {
				error: 'Validation failed: no valid rows to import',
				details: errors,
			});
		}

		// Fetch existing transactions for duplicate detection
		const existingTransactions = await queryMany<{
			date: string;
			amount: number;
			description: string;
			category_id: number;
		}>(
			`SELECT date, amount, description, category_id FROM transactions WHERE user_id = $1`,
			[userId]
		);

		// Detect duplicates
		const dupIndices = await detectDuplicates(userId, validRows, existingTransactions, userCategories);

		// Filter out duplicates
		const rowsToInsert = validRows.filter((_, i) => !dupIndices.includes(i));
		const skippedDuplicateCount = dupIndices.length;

		if (rowsToInsert.length === 0) {
			return {
				success: true,
				imported: 0,
				total: validRows.length,
				skippedDuplicates: skippedDuplicateCount,
				skippedInvalid: errors.length,
			};
		}

		// Insert valid, non-duplicate rows
		let inserted = 0;
		const insertErrors: string[] = [];

		for (let i = 0; i < rowsToInsert.length; i++) {
			const row = rowsToInsert[i];
			// Shared normalizer — same trim+lowercase rule the client preview used,
			// so the stored resolution can never disagree with the preview verdict.
			const catName = normCategoryName(row.category_name);

			// Find category by name, trim+case-insensitive on BOTH sides, scoped to
			// this user only. category_id is never taken from the payload.
			let cat = await queryOne<{ id: number }>(
				'SELECT id FROM categories WHERE user_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2))',
				[userId, catName]
			);

			if (!cat) {
				// Category doesn't exist - this shouldn't happen if validation passed, but handle gracefully
				insertErrors.push(`Row ${i + 1}: Category "${catName}" not found`);
				continue;
			}

			await execute(
				`INSERT INTO transactions (user_id, amount, description, date, category_id, type)
				 VALUES ($1, $2, $3, $4, $5, $6)`,
				[userId, row.amount, row.description.trim(), row.date, cat.id, row.type]
			);
			inserted++;
		}

		return {
			success: true,
			imported: inserted,
			total: validRows.length,
			skippedDuplicates: skippedDuplicateCount,
			skippedInvalid: errors.length,
			details: errors.length > 0 ? errors : undefined,
		};
	},
};
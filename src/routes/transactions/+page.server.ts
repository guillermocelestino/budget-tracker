import { fail } from '@sveltejs/kit';
import { queryOne, queryMany, execute } from '$lib/database/query';
import type { Transaction, Category } from '$lib/types';
import {
	detectDuplicates,
	normCategoryName,
	type ImportMappingConfig,
	autoMap,
	buildMappedRows,
	validateAllRows,
	DEFAULT_IMPORT_FIELDS,
} from '$lib/utils/importValidation';
import { parseImportFile } from '$lib/utils/fileImport';

export async function load({ url, locals }: { url: URL; locals: App.Locals }) {
	const userId = locals.user!.userId;
	const rawPage = parseInt(url.searchParams.get('page') ?? '1', 10);
	let page = Number.isFinite(rawPage) ? Math.max(1, rawPage) : 1;
	const limit = 20;
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

	const total = countRow?.total ?? 0;
	const totalPages = Math.ceil(total / limit);
	// Clamp out-of-range pages to the last available page (NaN already → 1 above).
	page = Math.min(page, Math.max(totalPages, 1));
	const offset = (page - 1) * limit;

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
		total,
		page,
		totalPages,
		limit,
		categories,
	};
}

export const actions = {
	create: async ({ request, locals }) => {
		const userId = locals.user!.userId;
		const data = await request.formData();

		const type = data.get('type') as string;
		const amountStr = data.get('amount') as string;
		const description = data.get('description') as string;
		const date = data.get('date') as string;
		const category_id = data.get('category_id') as string;

		const errors: Record<string, string> = {};
		if (!type || !['income', 'expense'].includes(type)) errors.type = 'Select a type';
		if (!amountStr || isNaN(parseFloat(amountStr)) || parseFloat(amountStr) === 0) errors.amount = 'Enter a valid amount';
		if (!description || description.trim().length === 0) errors.description = 'Enter a description';
		if (!date) errors.date = 'Select a date';
		if (!category_id || isNaN(parseInt(category_id))) errors.category_id = 'Select a category';

		if (Object.keys(errors).length > 0) {
			return fail(400, { errors, values: { type, amount: amountStr, description, date, category_id } });
		}

		await execute(
			`INSERT INTO transactions (user_id, amount, description, date, category_id, type)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			[userId, parseFloat(amountStr), description.trim(), date, parseInt(category_id), type]
		);

		return { success: true };
	},

	update: async ({ request, locals }) => {
		const userId = locals.user!.userId;
		const data = await request.formData();

		const idStr = data.get('id') as string;
		const id = parseInt(idStr, 10);
		if (isNaN(id)) return fail(400, { error: 'Invalid ID' });

		const existing = await queryOne<{ id: number }>('SELECT id FROM transactions WHERE user_id = $1 AND id = $2', [userId, id]);
		if (!existing) return fail(404, { error: 'Transaction not found' });

		const type = data.get('type') as string;
		const amountStr = data.get('amount') as string;
		const description = data.get('description') as string;
		const date = data.get('date') as string;
		const category_id = data.get('category_id') as string;

		const errors: Record<string, string> = {};
		if (!type || !['income', 'expense'].includes(type)) errors.type = 'Select a type';
		if (!amountStr || isNaN(parseFloat(amountStr)) || parseFloat(amountStr) === 0) errors.amount = 'Enter a valid amount';
		if (!description || description.trim().length === 0) errors.description = 'Enter a description';
		if (!date) errors.date = 'Select a date';
		if (!category_id || isNaN(parseInt(category_id))) errors.category_id = 'Select a category';

		if (Object.keys(errors).length > 0) {
			return fail(400, { errors, values: { type, amount: amountStr, description, date, category_id } });
		}

		await execute(
			`UPDATE transactions
			 SET amount = $1, description = $2, date = $3, category_id = $4, type = $5, updated_at = NOW()
			 WHERE user_id = $6 AND id = $7`,
			[parseFloat(amountStr), description.trim(), date, parseInt(category_id), type, userId, id]
		);

		return { success: true };
	},

	delete: async ({ request, locals }) => {
		const userId = locals.user!.userId;
		const data = await request.formData();
		const raw = (data.get('id') as string) ?? '';
		const ids = raw
			.split(',')
			.map((s) => parseInt(s.trim(), 10))
			.filter((n) => !isNaN(n) && n > 0);

		if (ids.length === 0) {
			return fail(400, { error: 'Invalid transaction ID' });
		}

		if (ids.length === 1) {
			const id = ids[0];
			const existing = await queryOne<{ id: number }>('SELECT id FROM transactions WHERE user_id = $1 AND id = $2', [userId, id]);
			if (!existing) {
				return fail(404, { error: 'Transaction not found' });
			}
			await execute('DELETE FROM transactions WHERE user_id = $1 AND id = $2', [userId, id]);
			return { success: true, deleted: 1 };
		}

		const placeholders = ids.map((_, i) => `$${i + 2}`).join(', ');
		const existing = await queryMany<{ id: number }>(
			`SELECT id FROM transactions WHERE user_id = $1 AND id IN (${placeholders})`,
			[userId, ...ids]
		);
		if (existing.length === 0) {
			return fail(404, { error: 'Transaction not found' });
		}
		await execute(
			`DELETE FROM transactions WHERE user_id = $1 AND id IN (${placeholders})`,
			[userId, ...ids]
		);
		return { success: true, deleted: existing.length };
	},

	import: async ({ request, locals }) => {
		const userId = locals.user!.userId;
		const formData = await request.formData();
		const file = formData.get('file') as File;
		const configJson = formData.get('config') as string;

		console.log('[Import] Received file:', file?.name, file?.size, file?.type);

		if (!file) {
			return fail(400, { error: 'No file provided' });
		}

		const config: ImportMappingConfig = { dateFormat: 'YYYY-MM-DD', typeRule: 'sign' };
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

		// Parse the file (same utility as client preview)
		const { headers, rows } = await parseImportFile(file);

		if (headers.length < 2) {
			return fail(400, { error: 'File must have a header row and at least one data row' });
		}

		// Auto-map headers using default transaction fields
		const mapping = autoMap(headers, DEFAULT_IMPORT_FIELDS);

		// Required guard
		const requiredUnmapped = DEFAULT_IMPORT_FIELDS
			.filter(f => f.required)
			.filter(f => !Object.values(mapping).includes(f.key));

		if (requiredUnmapped.length > 0) {
			const labels = requiredUnmapped.map(f => f.label).join(', ');
			return fail(400, { error: `Could not auto-map required column(s): ${labels}. Download the template.` });
		}

		// Build and validate
		const mappedRows = buildMappedRows(rows, headers, mapping, config);

		// Fetch user categories for validation + duplicate detection
		const userCategories = await queryMany<Category>(
			'SELECT id, name, type FROM categories WHERE user_id = $1 ORDER BY name ASC',
			[userId]
		);

		const { validRows, invalidRows, unknownCategories } = validateAllRows(mappedRows, userCategories, config);

		if (validRows.length === 0) {
			const errors = invalidRows.flatMap(({ errors }, i) => errors.map(e => `Row ${i + 1}: ${e}`));
			return fail(400, { error: 'Validation failed: no valid rows to import', details: errors });
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
				skippedInvalid: invalidRows.length,
				unknownCategories,
			};
		}

		// Insert valid, non-duplicate rows
		let inserted = 0;
		const insertErrors: string[] = [];

		for (let i = 0; i < rowsToInsert.length; i++) {
			const row = rowsToInsert[i];
			const catName = normCategoryName(row.category_name);

			const cat = await queryOne<{ id: number }>(
				'SELECT id FROM categories WHERE user_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2))',
				[userId, catName]
			);

			if (!cat) {
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
			skippedInvalid: invalidRows.length,
			unknownCategories,
			details: [...insertErrors, ...invalidRows.flatMap(({ errors }, i) => errors.map(e => `Row ${i + 1}: ${e}`))].length > 0
				? [...insertErrors, ...invalidRows.flatMap(({ errors }, i) => errors.map(e => `Row ${i + 1}: ${e}`))]
				: undefined,
		};
	},
};
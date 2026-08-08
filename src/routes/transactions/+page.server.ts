import { fail } from '@sveltejs/kit';
import { queryOne, queryMany, execute } from '$lib/database/query';
import { listTransactions, createTransaction, updateTransaction, deleteTransaction, deleteTransactions } from '$lib/server/transactions';
import type { Category } from '$lib/types';
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

	const filters = {
		type: type && ['income', 'expense'].includes(type) ? (type as 'income' | 'expense') : undefined,
		category_id: category_id ? parseInt(category_id, 10) : undefined,
		date_from: date_from || undefined,
		date_to: date_to || undefined,
		search: search || undefined
	};

	let result = await listTransactions(userId, filters, page, limit);

	// Clamp out-of-range pages to the last available page
	if (page > result.totalPages && result.totalPages > 0) {
		page = result.totalPages;
		result = await listTransactions(userId, filters, page, limit);
	}

	// Fetch ALL transactions matching the current filter (no pagination) for running balance computation
	const unpaginatedResult = await listTransactions(userId, filters);
	const allForBalance = [...unpaginatedResult.items].reverse();

	const categories = await queryMany<Category>('SELECT * FROM categories WHERE user_id = $1 ORDER BY name ASC', [userId]);

	return {
		transactions: result.items,
		allForBalance,
		total: result.total,
		page,
		totalPages: result.totalPages,
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

		try {
			await createTransaction(userId, {
				type: type as 'income' | 'expense',
				amount: parseFloat(amountStr),
				description,
				date,
				category_id: parseInt(category_id, 10),
			});
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			if (message === 'Category not found') {
				return fail(400, {
					errors: { category_id: 'Category not found' },
					values: { type, amount: amountStr, description, date, category_id }
				});
			}
			return fail(400, { error: message });
		}

		return { success: true };
	},

	update: async ({ request, locals }) => {
		const userId = locals.user!.userId;
		const data = await request.formData();

		const idStr = data.get('id') as string;
		const id = parseInt(idStr, 10);
		if (isNaN(id)) return fail(400, { error: 'Invalid ID' });

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

		try {
			const success = await updateTransaction(userId, id, {
				type: type as 'income' | 'expense',
				amount: parseFloat(amountStr),
				description,
				date,
				category_id: parseInt(category_id, 10),
			});
			if (!success) {
				return fail(404, { error: 'Transaction not found' });
			}
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			if (message === 'Category not found') {
				return fail(400, {
					errors: { category_id: 'Category not found' },
					values: { type, amount: amountStr, description, date, category_id }
				});
			}
			return fail(400, { error: message });
		}

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
			const success = await deleteTransaction(userId, id);
			if (!success) {
				return fail(404, { error: 'Transaction not found' });
			}
			return { success: true, deleted: 1 };
		}

		const deletedCount = await deleteTransactions(userId, ids);
		if (deletedCount === 0) {
			return fail(404, { error: 'Transaction not found' });
		}
		return { success: true, deleted: deletedCount };
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
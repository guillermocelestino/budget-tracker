import { fail } from '@sveltejs/kit';
import { queryMany } from '$lib/server/db/query';
import { getDrizzle } from '$lib/server/db/drizzle';
import { categories } from '$lib/server/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import {
	createTransactionInTxDrizzle,
	getTransactionsForDuplicateCheck,
} from '$lib/server/services/transactions';
import type { Category } from '$lib/types';
import {
	detectDuplicates,
	normCategoryName,
	type ImportMappingConfig,
	autoMap,
	buildMappedRows,
	validateAllRows,
	DEFAULT_IMPORT_FIELDS,
} from '$lib/shared/utils/importValidation';
import { parseImportFile } from '$lib/shared/utils/fileImport';

/**
 * Shared server-side transaction CSV import. `userId` comes from the session
 * ONLY (never the payload). Receives the File directly, re-parses it, and
 * re-runs the SAME validateAllRows the client preview used, so the store
 * verdict can never disagree with the preview.
 *
 * Pre-flight reads (category snapshot, existing-transaction duplicate lookup)
 * and pure validation run BEFORE the transaction. The write phase — every
 * per-row category-name→ID lookup and transaction INSERT — runs inside ONE
 * atomic transaction: all rows commit together or roll back together, so a
 * hard failure on any row undoes the entire import (no partial or orphaned
 * rows). A missing category at insert time is a soft skip: that row is not
 * inserted, its error is reported in `details`, and the rest still commit.
 */
export async function importTransactionsForUser(
	userId: number,
	file: File,
	configJson: string
) {
	if (!file) {
		return fail(400, { error: 'No file provided' });
	}

	console.log('[Import] Received file:', file?.name, file?.size, file?.type);

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

	// Fetch user categories for validation + duplicate detection (pre-flight read, outside the tx)
	const userCategories = await queryMany<Category>(
		'SELECT id, name, type FROM categories WHERE user_id = $1 ORDER BY name ASC',
		[userId]
	);

	const { validRows, invalidRows, unknownCategories } = validateAllRows(mappedRows, userCategories, config);

	if (validRows.length === 0) {
		const errors = invalidRows.flatMap(({ errors }, i) => errors.map(e => `Row ${i + 1}: ${e}`));
		return fail(400, { error: 'Validation failed: no valid rows to import', details: errors });
	}

	// Existing transactions for duplicate detection (pre-flight read, outside the tx)
	const existingTransactions = await getTransactionsForDuplicateCheck(userId);

	// Detect duplicates (pure, outside the tx)
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

	// The whole write phase is ONE atomic transaction (a single user action):
	// every per-row category lookup and transaction INSERT runs through the tx
	// handle — never the global query layer / global Drizzle db (which on PG
	// would use a different pooled connection and escape the transaction). A
	// hard failure on any row rolls back the entire import — no partial or
	// orphaned rows. A missing category at insert time is a soft skip: the row
	// is not inserted, its error is reported in `details`, and the rest commit.
	let inserted = 0;
	const insertErrors: string[] = [];

	const db = await getDrizzle();
	await db.transaction(async (tx) => {
		for (let i = 0; i < rowsToInsert.length; i++) {
			const row = rowsToInsert[i];
			const catName = normCategoryName(row.category_name);

			// Per-row category name → ID lookup (user-scoped), via tx.
			const [cat] = await tx
				.select({ id: categories.id })
				.from(categories)
				.where(and(
					eq(categories.user_id, userId),
					sql`LOWER(TRIM(${categories.name})) = LOWER(TRIM(${catName}))`
				))
				.limit(1);

			if (!cat) {
				insertErrors.push(`Row ${i + 1}: Category "${catName}" not found`);
				continue;
			}

			await createTransactionInTxDrizzle(tx, userId, {
				type: row.type,
				amount: row.amount,
				description: row.description.trim(),
				date: row.date,
				category_id: cat.id,
				source_of_funds: row.source_of_funds,
			});
			inserted++;
		}
	});

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
}

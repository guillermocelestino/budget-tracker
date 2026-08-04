import { fail } from '@sveltejs/kit';
import { queryMany, execute } from '$lib/database/query';
import { normName, type ImportMappingConfig, autoMap } from '$lib/utils/importValidation';
import {
	validateMappedLendingRow,
	detectLendingDuplicates,
	type MappedLendingRow,
	LENDING_IMPORT_FIELDS,
	buildMappedLendingRows,
	validateAllLendingRows,
} from '$lib/utils/lendingImport';
import { parseImportFile } from '$lib/utils/fileImport';

/**
 * Shared server-side lending import. `userId` comes from the session ONLY
 * (never the payload). Receives the File directly, re-parses it, and
 * re-runs the SAME validateMappedLendingRow the client preview used,
 * so the store verdict can never disagree with the preview.
 * Unknown people are auto-created simply by inserting the row (borrower_name
 * is free text, scoped to this user).
 */
export async function importLendingsForUser(
	userId: number,
	file: File,
	configJson: string,
	direction: 'lent' | 'borrowed'
) {
	if (!file) {
		return fail(400, { error: 'No file provided' });
	}

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

	// Parse the file (same utility as client preview)
	const { headers, rows } = await parseImportFile(file);

	if (headers.length < 2) {
		return fail(400, { error: 'File must have a header row and at least one data row' });
	}

	// Auto-map headers
	const mapping = autoMap(headers, LENDING_IMPORT_FIELDS);

	// Required guard
	const requiredUnmapped = LENDING_IMPORT_FIELDS
		.filter(f => f.required)
		.filter(f => !Object.values(mapping).includes(f.key));

	if (requiredUnmapped.length > 0) {
		const labels = requiredUnmapped.map(f => f.label).join(', ');
		return fail(400, { error: `Could not auto-map required column(s): ${labels}. Download the template.` });
	}

	// Build and validate
	const mappedRows = buildMappedLendingRows(rows, headers, mapping, config);
	const { validRows, invalidRows, newPeople } = validateAllLendingRows(mappedRows, [], config);

	if (validRows.length === 0) {
		const errors = invalidRows.flatMap(({ row, errors }, i) => errors.map(e => `Row ${i + 1}: ${e}`));
		return fail(400, { error: 'Validation failed: no valid rows to import', details: errors });
	}

	// Existing lendings for dedup + existing people
	const existingLendings = await queryMany<{ borrower_name: string; date_lent: string; amount: number; direction: string }>(
		'SELECT borrower_name, date_lent, amount, direction FROM lendings WHERE user_id = $1',
		[userId]
	);
	const existingPeople = Array.from(new Set(existingLendings.map(l => l.borrower_name)));

	// Dedup — key (user_id, person, date_lent, amount, direction)
	const dupIndices = detectLendingDuplicates(userId, validRows, existingLendings, direction);
	const rowsToInsert = validRows.filter((_, i) => !dupIndices.includes(i));
	const skippedDuplicateCount = dupIndices.length;

	const newPeopleFiltered = Array.from(new Set(
		validRows
			.map(r => r.person_name)
			.filter(p => !existingPeople.some(e => normName(e) === normName(p)))
	));

	if (rowsToInsert.length === 0) {
		return {
			success: true,
			imported: 0,
			total: validRows.length,
			skippedDuplicates: skippedDuplicateCount,
			skippedInvalid: invalidRows.length,
			newPeople: newPeopleFiltered,
		};
	}

	// Insert valid, non-duplicate rows — parameterized via query.ts (portable).
	// The lendings schema stores only `status` ('active' | 'paid'); the recovered
	// amount is used to DERIVE status (recovered >= amount → 'paid') and is not
	// persisted.
	let inserted = 0;
	for (const row of rowsToInsert) {
		await execute(
			`INSERT INTO lendings (user_id, borrower_name, amount, interest_rate, date_lent, due_date, notes, direction, status)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
			[userId, row.person_name, row.amount, row.interest_rate, row.date_lent, row.due_date || null, row.notes, direction, row.status]
		);
		inserted++;
	}

	return {
		success: true,
		imported: inserted,
		total: validRows.length,
		skippedDuplicates: skippedDuplicateCount,
		skippedInvalid: invalidRows.length,
		newPeople: newPeopleFiltered,
		details: invalidRows.length > 0 ? invalidRows.flatMap(({ row, errors }, i) => errors.map(e => `Row ${i + 1}: ${e}`)) : undefined,
	};
}
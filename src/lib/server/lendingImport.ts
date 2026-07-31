import { fail } from '@sveltejs/kit';
import { queryMany, execute } from '$lib/database/query';
import { normName, type ImportMappingConfig } from '$lib/utils/importValidation';
import {
	validateMappedLendingRow,
	detectLendingDuplicates,
	type MappedLendingRow,
} from '$lib/utils/lendingImport';

/**
 * Shared server-side lending import. `userId` comes from the session ONLY
 * (never the payload). Re-runs the SAME validateMappedLendingRow the client
 * preview used, so the store verdict can never disagree with the preview.
 * Unknown people are auto-created simply by inserting the row (borrower_name
 * is free text, scoped to this user).
 */
export async function importLendingsForUser(
	userId: number,
	rowsJson: string,
	configJson: string,
	direction: 'lent' | 'borrowed'
) {
	if (!rowsJson) {
		return fail(400, { error: 'No lending data provided' });
	}

	let rows: MappedLendingRow[];
	try {
		rows = JSON.parse(rowsJson);
	} catch {
		return fail(400, { error: 'Invalid lending data format' });
	}

	if (!Array.isArray(rows) || rows.length === 0) {
		return fail(400, { error: 'No lendings to import' });
	}

	// Parse config defensively — a crafted request must not smuggle an invalid rule.
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

	// Existing lendings (all directions) → dedup context + existing people.
	const existingLendings = await queryMany<{ borrower_name: string; date_lent: string; amount: number; direction: string }>(
		'SELECT borrower_name, date_lent, amount, direction FROM lendings WHERE user_id = $1',
		[userId]
	);
	const existingPeople = Array.from(new Set(existingLendings.map(l => l.borrower_name)));

	// Validate each row with the shared validator.
	const errors: string[] = [];
	const validRows: MappedLendingRow[] = [];
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		const result = validateMappedLendingRow(row, existingPeople, config);
		if (result.valid) {
			validRows.push(row);
		} else {
			for (const err of result.errors) {
				errors.push(`Row ${i + 1}: ${err}`);
			}
		}
	}

	if (validRows.length === 0) {
		return fail(400, { error: 'Validation failed: no valid rows to import', details: errors });
	}

	// Dedup — key (user_id, person, date_lent, amount, direction).
	const dupIndices = detectLendingDuplicates(userId, validRows, existingLendings, direction);
	const rowsToInsert = validRows.filter((_, i) => !dupIndices.includes(i));
	const skippedDuplicateCount = dupIndices.length;

	const newPeople = Array.from(new Set(
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
			skippedInvalid: errors.length,
			newPeople,
		};
	}

	// Insert valid, non-duplicate rows — parameterized via query.ts (portable).
	let inserted = 0;
	for (const row of rowsToInsert) {
		await execute(
			`INSERT INTO lendings (user_id, borrower_name, amount, interest_rate, date_lent, due_date, notes, direction)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			[userId, row.person_name, row.amount, row.interest_rate, row.date_lent, row.due_date || null, row.notes, direction]
		);
		inserted++;
	}

	return {
		success: true,
		imported: inserted,
		total: validRows.length,
		skippedDuplicates: skippedDuplicateCount,
		skippedInvalid: errors.length,
		newPeople,
		details: errors.length > 0 ? errors : undefined,
	};
}

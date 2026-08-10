import { fail } from '@sveltejs/kit';
import { getDrizzle } from '$lib/server/db/drizzle';
import { lendings, lendingPayments } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { normName, type ImportMappingConfig, autoMap } from '$lib/shared/utils/importValidation';
import {
	detectLendingDuplicates,
	LENDING_IMPORT_FIELDS,
	buildMappedLendingRows,
	validateAllLendingRows,
} from '$lib/shared/utils/lendingImport';
import { parseImportFile } from '$lib/shared/utils/fileImport';

/**
 * Shared server-side lending import. `userId` comes from the session ONLY
 * (never the payload). Receives the File directly, re-parses it, and
 * re-runs the SAME validateAllLendingRows the client preview used,
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
	const { validRows, invalidRows } = validateAllLendingRows(mappedRows, [], config);

	if (validRows.length === 0) {
		const errors = invalidRows.flatMap(({ errors }, i) => errors.map(e => `Row ${i + 1}: ${e}`));
		return fail(400, { error: 'Validation failed: no valid rows to import', details: errors });
	}

	// Existing lendings for dedup + existing people
	const db = await getDrizzle();
	const existingLendingRows = await db
		.select({
			borrower_name: lendings.borrower_name,
			date_lent: lendings.date_lent,
			amount: lendings.amount,
			direction: lendings.direction
		})
		.from(lendings)
		.where(eq(lendings.user_id, userId));
	const existingLendings = existingLendingRows.map(r => ({
		...r,
		amount: parseFloat(r.amount)
	}));
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

	// Insert valid, non-duplicate rows — parameterized via Drizzle.
	// The lendings schema stores only `status` ('active' | 'paid'); the recovered
	// amount creates a payment row in lending_payments (the authoritative ledger).
	// Imports never directly populate derived balance fields — derived state is
	// computed from payment history. No transaction is created for imported payments.
	//
	// The whole write phase is ONE atomic transaction (a single user action): every
	// lending + recovered-payment insert commits together or rolls back together, so
	// a failure on any row undoes the entire import — no partial or orphaned records.
	let inserted = 0;

	await db.transaction(async (tx) => {
		for (const row of rowsToInsert) {
			const [newLending] = await tx
				.insert(lendings)
				.values({
					user_id: userId,
					borrower_name: row.person_name,
					amount: String(row.amount),
					interest_rate: String(row.interest_rate),
					date_lent: row.date_lent,
					due_date: row.due_date || null,
					notes: row.notes,
					direction: direction,
					status: row.status
				})
				.returning({ id: lendings.id });

			// If recovered_amount > 0, create a historical payment row
			if (row.recovered_amount > 0) {
				await tx.insert(lendingPayments).values({
					lending_id: newLending.id,
					user_id: userId,
					amount: String(row.recovered_amount),
					payment_date: row.date_lent,
					notes: 'Imported',
					payment_type: 'payment'
				});
			}

			inserted++;
		}
	});

	return {
		success: true,
		imported: inserted,
		total: validRows.length,
		skippedDuplicates: skippedDuplicateCount,
		skippedInvalid: invalidRows.length,
		newPeople: newPeopleFiltered,
		details: invalidRows.length > 0 ? invalidRows.flatMap(({
			errors,
			row
		}) => errors.map(e => `Row ${row}: ${e}`)) : []
	};
}
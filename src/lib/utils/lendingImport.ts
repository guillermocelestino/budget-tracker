import {
	parseDateFlexible,
	parseAmountFlexible,
	normName,
	type ImportMappingConfig,
	type ImportFieldDef,
	type ValidationResult,
} from './importValidation';

/**
 * Lending field definitions for the schema-driven import components + autoMap.
 * Direction is deliberately NOT a mapping target — it comes from which page
 * (/lending → 'lent', /borrowed → 'borrowed') the import is opened from.
 */
export const LENDING_IMPORT_FIELDS: ImportFieldDef[] = [
	{ key: 'person_name', label: '👤 Person / Borrower', required: true, aliases: ['person', 'borrower', 'borrower name', 'name', 'person name', 'counterparty', 'client', 'contact', 'lender', 'lender name'] },
	{ key: 'amount', label: '💰 Amount', required: true, aliases: ['amount', 'amt', 'value', 'loan amount', 'lent', 'total', 'sum'] },
	{ key: 'date_lent', label: '📅 Date Lent', required: true, aliases: ['date lent', 'date', 'lent on', 'lending date', 'start date', 'transaction date', 'posting date', 'date borrowed', 'borrowed on'] },
	{ key: 'due_date', label: '🗓 Due Date', aliases: ['due date', 'due', 'repayment date', 'payback date', 'maturity date', 'deadline'] },
	{ key: 'interest_rate', label: '📈 Interest Rate (%)', aliases: ['interest', 'interest rate', 'rate', 'apr', 'annual interest'] },
	{ key: 'notes', label: '📝 Notes', aliases: ['notes', 'note', 'description', 'details', 'memo', 'remarks'] },
];

// Type alias so it gains an implicit index signature and is assignable to
// ImportRow (Record<string, unknown>) for the schema-driven preview components.
export type MappedLendingRow = {
	person_name: string;
	amount: number;
	interest_rate: number;
	date_lent: string;
	due_date: string;
	notes: string;
};

/**
 * Parse an interest-rate string: strip '%' and whitespace, parse a float.
 * Empty → 0; unparseable → NaN (flagged by validation).
 */
export function parseRate(s: string): number {
	if (!s || !s.trim()) return 0;
	const n = parseFloat(String(s).replace(/[%\s]/g, ''));
	return isNaN(n) ? NaN : n;
}

/**
 * Build mapped lending rows from raw CSV data + column mapping. Unparseable
 * dates are kept raw so validation flags them (no silent substitution).
 */
export function buildMappedLendingRows(
	rawRows: string[][],
	headers: string[],
	mapping: Record<string, string>,
	config: ImportMappingConfig
): MappedLendingRow[] {
	const personCol = headers.find(c => mapping[c] === 'person_name');
	const amountCol = headers.find(c => mapping[c] === 'amount');
	const dateLentCol = headers.find(c => mapping[c] === 'date_lent');
	const dueDateCol = headers.find(c => mapping[c] === 'due_date');
	const rateCol = headers.find(c => mapping[c] === 'interest_rate');
	const notesCol = headers.find(c => mapping[c] === 'notes');

	return rawRows.map(rawRow => {
		const getVal = (col: string | undefined, fallback = '') =>
			col ? rawRow[headers.indexOf(col)] ?? fallback : fallback;

		const rawPerson = getVal(personCol);
		const rawAmount = getVal(amountCol, '0');
		const rawDateLent = getVal(dateLentCol);
		const rawDueDate = getVal(dueDateCol);
		const rawRate = getVal(rateCol);
		const rawNotes = getVal(notesCol);

		const parsedLent = parseDateFlexible(rawDateLent, config.dateFormat);
		const parsedDue = rawDueDate.trim() ? parseDateFlexible(rawDueDate, config.dateFormat) : null;

		return {
			person_name: rawPerson.trim(),
			amount: parseAmountFlexible(rawAmount) ?? 0,
			interest_rate: parseRate(rawRate),
			date_lent: parsedLent ?? rawDateLent.trim(),
			due_date: rawDueDate.trim() ? (parsedDue ?? rawDueDate.trim()) : '',
			notes: rawNotes.trim(),
		};
	});
}

/**
 * Validate a single mapped lending row. Unknown persons are NOT an error —
 * they are auto-created on import; the validator only warns.
 */
export function validateMappedLendingRow(
	row: MappedLendingRow,
	existingPeople: string[],
	config: ImportMappingConfig
): ValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Person
	if (!row.person_name || row.person_name.trim().length === 0) {
		errors.push('Missing person name');
	}

	// Amount must be > 0 (direction comes from page context, not the sign)
	if (row.amount === null || row.amount === undefined || isNaN(row.amount)) {
		errors.push('Invalid amount');
	} else if (row.amount <= 0) {
		errors.push('Amount must be greater than zero');
	}

	// Date lent — required, must parse
	if (!parseDateFlexible(row.date_lent, config.dateFormat)) {
		errors.push(`Invalid date: "${row.date_lent}"`);
	}

	// Due date — optional, must parse if present
	if (row.due_date && row.due_date.trim()) {
		if (!parseDateFlexible(row.due_date, config.dateFormat)) {
			errors.push(`Invalid due date: "${row.due_date}"`);
		}
	}

	// Interest rate — numeric
	if (row.interest_rate === null || row.interest_rate === undefined || isNaN(row.interest_rate)) {
		errors.push('Invalid interest rate');
	}

	// New person → non-blocking "will be created" warning (auto-create on import)
	if (errors.length === 0 && row.person_name && existingPeople?.length > 0
		&& !existingPeople.some(p => normName(p) === normName(row.person_name))) {
		warnings.push(`"${row.person_name}" is a new person — it will be created on import`);
	}

	return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate all mapped lending rows and collect the distinct people who will be
 * auto-created.
 */
export function validateAllLendingRows(
	rows: MappedLendingRow[],
	existingPeople: string[],
	config: ImportMappingConfig
): {
	validRows: MappedLendingRow[];
	invalidRows: { row: MappedLendingRow; errors: string[]; warnings: string[] }[];
	newPeople: string[];
} {
	const validRows: MappedLendingRow[] = [];
	const invalidRows: { row: MappedLendingRow; errors: string[]; warnings: string[] }[] = [];
	const newPeople = new Set<string>();

	for (const row of rows) {
		const result = validateMappedLendingRow(row, existingPeople, config);
		if (result.valid) {
			validRows.push(row);
			if (!existingPeople.some(p => normName(p) === normName(row.person_name))) {
				newPeople.add(row.person_name);
			}
		} else {
			invalidRows.push({ row, errors: result.errors, warnings: result.warnings });
		}
	}

	return { validRows, invalidRows, newPeople: Array.from(newPeople) };
}

/**
 * Deterministic hash for duplicate detection — key: (user_id, person, date_lent,
 * amount, direction). Re-importing the same file skips instead of doubling.
 */
export function generateLendingHash(
	userId: number,
	row: MappedLendingRow,
	direction: 'lent' | 'borrowed'
): string {
	const str = `${userId}|${normName(row.person_name)}|${row.date_lent}|${row.amount}|${direction}`;
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = ((hash << 5) - hash) + str.charCodeAt(i);
		hash |= 0;
	}
	return Math.abs(hash).toString(36);
}

/**
 * Return indices of rows that duplicate an existing lending (same user, person,
 * date, amount, direction). Rows already accepted in this batch also count, so
 * intra-file duplicates are caught too.
 */
export function detectLendingDuplicates(
	userId: number,
	rows: MappedLendingRow[],
	existingLendings: { borrower_name: string; date_lent: string; amount: number; direction: string }[],
	direction: 'lent' | 'borrowed'
): number[] {
	const dupIndices: number[] = [];
	const seen = new Set<string>();

	for (const l of existingLendings) {
		seen.add(generateLendingHash(userId, {
			person_name: l.borrower_name,
			amount: l.amount,
			interest_rate: 0,
			date_lent: l.date_lent,
			due_date: '',
			notes: '',
		}, (l.direction as 'lent' | 'borrowed')));
	}

	for (let i = 0; i < rows.length; i++) {
		const h = generateLendingHash(userId, rows[i], direction);
		if (seen.has(h)) {
			dupIndices.push(i);
		} else {
			seen.add(h);
		}
	}

	return dupIndices;
}

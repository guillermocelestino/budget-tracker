import { describe, it, expect } from 'vitest';
import { normName, autoMap } from './importValidation';
import {
	LENDING_IMPORT_FIELDS,
	buildMappedLendingRows,
	validateAllLendingRows,
	detectLendingDuplicates,
	parseRate,
} from './lendingImport';

const CONFIG = { dateFormat: 'YYYY-MM-DD', typeRule: 'sign' as const };
const EXISTING_PEOPLE = ['Juan Dela Cruz'];

// The 10-row sample as parseCSV would produce (headers + rows, quotes stripped).
const headers = ['Person', 'Amount', 'Interest Rate', 'Date Lent', 'Due Date', 'Notes'];
const csvRows = [
	['Juan Dela Cruz', '5000', '5', '2026-07-01', '2026-10-01', 'Starter loan'],
	['Maria Santos', '12000', '0', '2026-07-02', '', 'No interest'],
	['Ana Reyes', '10,000.00', '3.5', '2026-07-03', '2026-09-15', 'With comma amount'],
	['Pedro Garcia', '2500', '2', '2026-07-32', '2026-08-01', 'Bad date lent'],
	['Liza Cruz', '0', '1', '2026-07-05', '', 'Zero amount'],
	['Carlos Mendez', '-3000', '0', '2026-07-06', '', 'Negative amount'],
	['New Person', '800', '0', '2026-07-07', '2026-12-01', 'Unknown person auto-created'],
	['', '600', '0', '2026-07-08', '', 'Missing person'],
	['Jose Ramos', '1500', '0', '2026-07-09', '2026-07-32', 'Bad due date'],
	['Juan Dela Cruz', '5000', '5', '2026-07-01', '2026-10-01', 'Duplicate of row 1'],
];
const mapping = {
	Person: 'person_name',
	Amount: 'amount',
	'Interest Rate': 'interest_rate',
	'Date Lent': 'date_lent',
	'Due Date': 'due_date',
	Notes: 'notes',
};

describe('normName (shared normalizer)', () => {
	it('trims + lowercases', () => {
		expect(normName('  Juan Dela Cruz  ')).toBe('juan dela cruz');
		expect(normName('MARIA')).toBe('maria');
		expect(normName('')).toBe('');
	});
});

describe('parseRate', () => {
	it('parses plain numbers, strips %, default 0, flags garbage', () => {
		expect(parseRate('5')).toBe(5);
		expect(parseRate('5%')).toBe(5);
		expect(parseRate(' 3.5 ')).toBe(3.5);
		expect(parseRate('')).toBe(0);
		expect(Number.isNaN(parseRate('abc'))).toBe(true);
	});
});

describe('buildMappedLendingRows', () => {
	it('parses amounts (commas), rates, and dates', () => {
		const rows = buildMappedLendingRows(csvRows, headers, mapping, CONFIG);
		expect(rows[0]).toMatchObject({ person_name: 'Juan Dela Cruz', amount: 5000, interest_rate: 5, date_lent: '2026-07-01', due_date: '2026-10-01' });
		expect(rows[2]).toMatchObject({ person_name: 'Ana Reyes', amount: 10000, interest_rate: 3.5, date_lent: '2026-07-03', due_date: '2026-09-15' });
		expect(rows[3].date_lent).toBe('2026-07-32'); // unparseable kept raw → row error
		expect(rows[8].due_date).toBe('2026-07-32');   // unparseable kept raw → row error
	});
});

describe('validateAllLendingRows — 5 valid · 5 invalid', () => {
	it('tally: valid / bad date / zero amount / negative amount / unknown person / missing person / bad due date', () => {
		const rows = buildMappedLendingRows(csvRows, headers, mapping, CONFIG);
		const result = validateAllLendingRows(rows, EXISTING_PEOPLE, CONFIG);

		expect(result.validRows.length).toBe(5);
		expect(result.invalidRows.length).toBe(5);
		expect(result.newPeople).toEqual(['Maria Santos', 'Ana Reyes', 'New Person']);

		const invalidErrors = result.invalidRows.map(x => x.errors.join(' | '));
		expect(invalidErrors.some(e => e.includes('Invalid date'))).toBe(true);            // row 4 bad date lent
		expect(invalidErrors.some(e => e.includes('greater than zero'))).toBe(true);        // rows 5-6
		expect(invalidErrors.some(e => e.includes('Missing person name'))).toBe(true);      // row 8
		expect(invalidErrors.some(e => e.includes('Invalid due date'))).toBe(true);         // row 9
	});

	it('unknown person is VALID (auto-created), not a row error', () => {
		const rows = buildMappedLendingRows(csvRows, headers, mapping, CONFIG);
		const result = validateAllLendingRows(rows, EXISTING_PEOPLE, CONFIG);
		expect(result.validRows.some(r => r.person_name === 'New Person')).toBe(true);
	});
});

describe('detectLendingDuplicates', () => {
	const existing = [{ borrower_name: 'Juan Dela Cruz', date_lent: '2026-07-01', amount: 5000, direction: 'lent' }];

	it('flags the existing row and the intra-file duplicate (the pair)', () => {
		const rows = buildMappedLendingRows(csvRows, headers, mapping, CONFIG);
		const valid = validateAllLendingRows(rows, EXISTING_PEOPLE, CONFIG).validRows;
		const dups = detectLendingDuplicates(1, valid, existing, 'lent');
		// valid rows indices: 0 (Juan, dup of existing), 1, 2, 6, 9 (Juan dup of row 0)
		expect(dups).toContain(0);
		expect(dups).toContain(4); // valid[4] === csvRows[9] (the duplicate pair leg)
		expect(dups.length).toBe(2);
	});

	it('a borrowed import does not collide with an existing lent row (direction is in the key)', () => {
		const rows = buildMappedLendingRows(csvRows, headers, mapping, CONFIG);
		const valid = validateAllLendingRows(rows, EXISTING_PEOPLE, CONFIG).validRows;
		const dups = detectLendingDuplicates(1, valid, existing, 'borrowed');
		// valid[0] (Juan, lent in `existing`) hashed with 'borrowed' → NOT a dup of the lent row.
		expect(dups).not.toContain(0);
		// valid[4] is still the intra-file duplicate of valid[0] (both borrowed).
		expect(dups).toEqual([4]);
	});

	it('a different amount is not a duplicate of the existing row', () => {
		const rows = buildMappedLendingRows(csvRows, headers, mapping, CONFIG);
		const valid = validateAllLendingRows(rows, EXISTING_PEOPLE, CONFIG).validRows;
		const diffAmount = [{ borrower_name: 'Juan Dela Cruz', date_lent: '2026-07-01', amount: 1234, direction: 'lent' }];
		const dups = detectLendingDuplicates(1, valid, diffAmount, 'lent');
		expect(dups).not.toContain(0);
		expect(dups).toEqual([4]); // only the intra-file pair
	});

	it('LENDING_IMPORT_FIELDS drives autoMap for the sample headers', () => {
		const aliases = LENDING_IMPORT_FIELDS.map(f => f.key);
		expect(aliases).toEqual(['person_name', 'amount', 'date_lent', 'due_date', 'interest_rate', 'notes']);
	});

	it('autoMap maps the borrowed sample headers (Lender, Date Borrowed)', () => {
		const mapping = autoMap(
			['Lender', 'Amount', 'Interest Rate', 'Date Borrowed', 'Due Date', 'Notes'],
			LENDING_IMPORT_FIELDS
		);
		expect(mapping).toEqual({
			Lender: 'person_name',
			Amount: 'amount',
			'Interest Rate': 'interest_rate',
			'Date Borrowed': 'date_lent',
			'Due Date': 'due_date',
			Notes: 'notes',
		});
	});

	it('borrowed sample pipeline: 5 valid · 3 invalid, New Lender auto-created, dup pair caught', () => {
		const headers = ['Lender', 'Amount', 'Interest Rate', 'Date Borrowed', 'Due Date', 'Notes'];
		const borrowedRows = [
			['Tita Beth', '3000', '2', '2026-06-15', '2026-09-15', 'Borrowed for market day'],
			['Kuya Jon', '15000', '0', '2026-06-20', '', 'School fee advance'],
			['Carlo', '2500', '5', '2026-06-25', '2026-07-25', 'Gadget installment'],
			['New Lender', '1000', '1', '2026-07-12', '2026-08-12', 'Unknown lender auto-created'],
			['Jessa', '0', '0', '2026-06-30', '', 'Zero amount'],
			['Mark', '-500', '0', '2026-07-05', '', 'Negative amount'],
			['Aling Rosa', '2000', '0', '2026-07-32', '2026-08-15', 'Bad date borrowed'],
			['Tita Beth', '3000', '2', '2026-06-15', '2026-09-15', 'Duplicate of row 1'],
		];
		const mapping = autoMap(headers, LENDING_IMPORT_FIELDS);
		const built = buildMappedLendingRows(borrowedRows, headers, mapping, CONFIG);
		const result = validateAllLendingRows(built, ['Tita Beth', 'Kuya Jon', 'Carlo', 'Jessa', 'Mark', 'Aling Rosa'], CONFIG);

		expect(result.validRows.length).toBe(5);
		expect(result.invalidRows.length).toBe(3);
		expect(result.newPeople).toEqual(['New Lender']);

		// In-batch duplicate: the last Tita Beth row is a dup of the first.
		const dups = detectLendingDuplicates(3, result.validRows, [], 'borrowed');
		expect(dups).toEqual([4]);
	});
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseImportFile } from '$lib/shared/utils/fileImport';
import {
	autoMap,
	buildMappedRows,
	validateAllRows,
	parseCSV,
	DEFAULT_IMPORT_FIELDS,
	type ImportMappingConfig,
} from '$lib/shared/utils/importValidation';
import {
	LENDING_IMPORT_FIELDS,
	buildMappedLendingRows,
	validateAllLendingRows,
} from '$lib/shared/utils/lendingImport';

const CONFIG: ImportMappingConfig = { dateFormat: 'YYYY-MM-DD', typeRule: 'sign' };

const templatesDir = fileURLToPath(new URL('../../static/templates/', import.meta.url));

function xlsxFile(name: string): File {
	const buffer = readFileSync(templatesDir + name);
	return new File([buffer], name);
}

describe('parseImportFile — CSV', () => {
	it('returns { headers, rows } for a text/csv File', async () => {
		const csv = [
			'Date,Description,Amount,Type,Category Name',
			'2026-07-15,Salary deposit,50000,income,Salary',
			'2026-07-30,Groceries,1200.50,expense,Food',
		].join('\n');

		const { headers, rows } = await parseImportFile(new File([csv], 'sample.csv', { type: 'text/csv' }));

		expect(headers).toEqual(['Date', 'Description', 'Amount', 'Type', 'Category Name']);
		expect(rows).toEqual([
			['2026-07-15', 'Salary deposit', '50000', 'income', 'Salary'],
			['2026-07-30', 'Groceries', '1200.50', 'expense', 'Food'],
		]);
	});

	it('returns empty headers for a file without a data row', async () => {
		const { headers, rows } = await parseImportFile(new File(['Date,Description'], 'empty.csv', { type: 'text/csv' }));
		expect(headers).toEqual([]);
		expect(rows).toEqual([]);
	});
});

describe('parseImportFile — XLSX', () => {
	it('parses the generated transactions.xlsx template into { headers, rows }', async () => {
		const { headers, rows } = await parseImportFile(xlsxFile('transactions.xlsx'));

		// Same import contract as the CSV template: same columns, same order.
		expect(headers).toEqual(['Date', 'Description', 'Amount', 'Type', 'Category Name', 'Source of Funds']);
		expect(rows).toHaveLength(1);
		// Cells are coerced to strings (numbers → String, dates → YYYY-MM-DD).
		expect(rows[0][0]).toBe('2026-07-15');
		expect(rows[0][2]).toBe('50000');
		expect(rows[0][5]).toBe('Bank Transfer');
	});
});

describe('round-trip: generated xlsx templates → map → build → validate', () => {
	it('transactions.xlsx → all rows valid with Source of Funds carried through', async () => {
		const { headers, rows } = await parseImportFile(xlsxFile('transactions.xlsx'));
		const mapping = autoMap(headers, DEFAULT_IMPORT_FIELDS);
		const built = buildMappedRows(rows, headers, mapping, CONFIG);
		expect(built).toHaveLength(1);
		expect(built[0].source_of_funds).toBe('Bank Transfer');
		// Sample row category is "Salary" (income) — match it in the user's categories.
		const { validRows, invalidRows } = validateAllRows(
			built,
			[{ name: 'Salary', type: 'income' }],
			CONFIG
		);
		expect(invalidRows).toHaveLength(0);
		expect(validRows).toHaveLength(1);
		expect(validRows[0].source_of_funds).toBe('Bank Transfer');
	});

	it('lending.xlsx → all rows valid', async () => {
		const { headers, rows } = await parseImportFile(xlsxFile('lending.xlsx'));
		const mapping = autoMap(headers, LENDING_IMPORT_FIELDS);
		const built = buildMappedLendingRows(rows, headers, mapping, CONFIG);
		const { validRows, invalidRows } = validateAllLendingRows(built, [], CONFIG);
		expect(invalidRows).toHaveLength(0);
		expect(validRows).toHaveLength(1);
	});

	it('borrowed.xlsx → all rows valid', async () => {
		const { headers, rows } = await parseImportFile(xlsxFile('borrowed.xlsx'));
		const mapping = autoMap(headers, LENDING_IMPORT_FIELDS);
		const built = buildMappedLendingRows(rows, headers, mapping, CONFIG);
		const { validRows, invalidRows } = validateAllLendingRows(built, [], CONFIG);
		expect(invalidRows).toHaveLength(0);
		expect(validRows).toHaveLength(1);
	});
});

describe('downloadable CSV transaction template (static/sample-transactions.csv)', () => {
	const csvTemplatePath = fileURLToPath(new URL('../../static/sample-transactions.csv', import.meta.url));
	const csv = readFileSync(csvTemplatePath, 'utf8');

	it('contains the Source of Funds header as the final column (same contract as the XLSX template)', () => {
		const { headers } = parseCSV(csv);
		expect(headers).toEqual(['Date', 'Description', 'Amount', 'Type', 'Category Name', 'Source of Funds']);
	});

	it('auto-maps the Source of Funds column to the source_of_funds field', () => {
		const { headers } = parseCSV(csv);
		const mapping = autoMap(headers, DEFAULT_IMPORT_FIELDS);
		expect(mapping['Source of Funds']).toBe('source_of_funds');
	});

	it('imports through the full File parsing path (parseImportFile) like the ImportWizard — valid rows accepted', async () => {
		const file = new File([csv], 'sample-transactions.csv', { type: 'text/csv' });
		const { headers, rows } = await parseImportFile(file);
		const mapping = autoMap(headers, DEFAULT_IMPORT_FIELDS);
		const built = buildMappedRows(rows, headers, mapping, CONFIG);
		const { validRows, invalidRows } = validateAllRows(
			built,
			[
				{ name: 'Salary', type: 'income' },
				{ name: 'Freelance', type: 'income' },
				{ name: 'Food & Dining', type: 'expense' },
				{ name: 'Transportation', type: 'expense' },
				{ name: 'Shopping', type: 'expense' },
				{ name: 'Entertainment', type: 'expense' },
				{ name: 'Bills & Utilities', type: 'expense' },
			],
			CONFIG
		);
		// 8 importable rows accepted; the Source of Funds value survives end-to-end.
		expect(validRows.length).toBe(8);
		expect(invalidRows.length).toBe(2);
		const salary = validRows.find(r => r.description === 'Salary deposit');
		expect(salary?.source_of_funds).toBe('Bank Transfer');
	});

	it('valid rows remain valid for import, with populated sources preserved and blank sources left blank', () => {
		const { headers, rows } = parseCSV(csv);
		const mapping = autoMap(headers, DEFAULT_IMPORT_FIELDS);
		const built = buildMappedRows(rows, headers, mapping, CONFIG);

		const byDesc = new Map(built.map(r => [r.description, r]));
		expect(byDesc.get('Salary deposit')?.source_of_funds).toBe('Bank Transfer');
		expect(byDesc.get('Electric bill (Meralco)')?.source_of_funds).toBe("Mother's Money");
		// Blank Source of Funds is accepted — an empty string that the server
		// normalizes to NULL on import, never an auto-assigned value.
		expect(byDesc.get('Groceries at SM Supermarket')?.source_of_funds).toBe('');
		expect(byDesc.get('Netflix subscription')?.source_of_funds).toBe('');

		// The template's example rows behave exactly as before the Source of Funds
		// column was added: the 8 importable rows stay valid, and the 2 pre-existing
		// demo rows remain flagged (Unknown category + the "Invalid date test" row,
		// whose positive sign derives type=income against the expense category).
		const result = validateAllRows(
			built,
			[
				{ name: 'Salary', type: 'income' },
				{ name: 'Freelance', type: 'income' },
				{ name: 'Food & Dining', type: 'expense' },
				{ name: 'Transportation', type: 'expense' },
				{ name: 'Shopping', type: 'expense' },
				{ name: 'Entertainment', type: 'expense' },
				{ name: 'Bills & Utilities', type: 'expense' },
			],
			CONFIG
		);
		expect(result.validRows.length).toBe(8);
		expect(result.invalidRows.length).toBe(2);
		expect(result.unknownCategories).toEqual(['Nonexistent Category']);
	});
});

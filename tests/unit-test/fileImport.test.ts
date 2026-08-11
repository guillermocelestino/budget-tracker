import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseImportFile } from '$lib/shared/utils/fileImport';
import {
	autoMap,
	buildMappedRows,
	validateAllRows,
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

		expect(headers).toEqual(['Date', 'Description', 'Amount', 'Type', 'Category Name']);
		expect(rows).toHaveLength(1);
		// Cells are coerced to strings (numbers → String, dates → YYYY-MM-DD).
		expect(rows[0][2]).toBe('50000');
		expect(rows[0][0]).toBe('2026-07-15');
	});
});

describe('round-trip: generated xlsx templates → map → build → validate', () => {
	it('transactions.xlsx → all rows valid', async () => {
		const { headers, rows } = await parseImportFile(xlsxFile('transactions.xlsx'));
		const mapping = autoMap(headers, DEFAULT_IMPORT_FIELDS);
		const built = buildMappedRows(rows, headers, mapping, CONFIG);
		// Sample row category is "Salary" (income) — match it in the user's categories.
		const { validRows, invalidRows } = validateAllRows(
			built,
			[{ name: 'Salary', type: 'income' }],
			CONFIG
		);
		expect(invalidRows).toHaveLength(0);
		expect(validRows).toHaveLength(1);
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

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
	parseCSV,
	autoMap,
	buildMappedRows,
	validateAllRows,
	parseDateFlexible,
	parseAmountFlexible,
	deriveType,
	normCategoryName,
	type ImportMappingConfig,
} from '$lib/shared/utils/importValidation';

const CONFIG: ImportMappingConfig = { dateFormat: 'YYYY-MM-DD', typeRule: 'sign' };

const USER_CATEGORIES = [
	{ name: 'Salary', type: 'income' as const },
	{ name: 'Freelance', type: 'income' as const },
	{ name: 'Other Income', type: 'income' as const },
	{ name: 'Food & Dining', type: 'expense' as const },
	{ name: 'Transportation', type: 'expense' as const },
	{ name: 'Shopping', type: 'expense' as const },
	{ name: 'Entertainment', type: 'expense' as const },
	{ name: 'Bills & Utilities', type: 'expense' as const },
	{ name: 'Healthcare', type: 'expense' as const },
	{ name: 'Education', type: 'expense' as const },
	{ name: 'Other Expense', type: 'expense' as const },
];

describe('CSV import client pipeline (against docs/sample-transactions.csv)', () => {
	const csvPath = path.join(process.cwd(), 'docs', 'sample-transactions.csv');
	const csv = fs.readFileSync(csvPath, 'utf8');

	it('parseCSV reads the sample header + 10 rows', () => {
		const { headers, rows } = parseCSV(csv);
		expect(headers).toEqual(['Date', 'Description', 'Amount', 'Type', 'Category Name']);
		expect(rows.length).toBe(10);
	});

	it('autoMap maps all 5 sample columns to fields', () => {
		const { headers } = parseCSV(csv);
		const mapping = autoMap(headers);
		expect(mapping['Date']).toBe('date');
		expect(mapping['Amount']).toBe('amount');
		expect(mapping['Type']).toBe('type');
		expect(mapping['Description']).toBe('description');
		expect(mapping['Category Name']).toBe('category_name');
	});

	it('parses the tricky amounts (symbols, commas, parenthetical negatives)', () => {
		expect(parseAmountFlexible('₱15,000.00')).toBe(15000);
		expect(parseAmountFlexible('(1,200.00)')).toBe(-1200);
		expect(parseAmountFlexible('-2,500.50')).toBe(-2500.5);
		expect(parseAmountFlexible('50000.00')).toBe(50000);
	});

	it('derives type from sign by default', () => {
		expect(deriveType(50000, 'income', 'sign')).toBe('income');
		expect(deriveType(-2500.5, 'expense', 'sign')).toBe('expense');
	});

	it('buildMappedRows yields 8 valid rows + 2 invalid (bad date, unknown category)', () => {
		const { headers, rows } = parseCSV(csv);
		const mapping = autoMap(headers);
		const mapped = buildMappedRows(rows, headers, mapping, CONFIG);
		const result = validateAllRows(mapped, USER_CATEGORIES, CONFIG);

		expect(mapped.length).toBe(10);
		expect(result.validRows.length).toBe(8);
		expect(result.invalidRows.length).toBe(2);
		expect(result.unknownCategories).toEqual(['Nonexistent Category']);
	});

	it('normalizes rows the way the server stores them', () => {
		const { headers, rows } = parseCSV(csv);
		const mapping = autoMap(headers);
		const mapped = buildMappedRows(rows, headers, mapping, CONFIG);
		const result = validateAllRows(mapped, USER_CATEGORIES, CONFIG);

		const byDesc = new Map(result.validRows.map(r => [r.description, r]));
		expect(byDesc.get('Salary deposit')).toMatchObject({ amount: 50000, type: 'income', category_name: 'Salary', date: '2026-07-01' });
		expect(byDesc.get('Freelance payment')).toMatchObject({ amount: 15000, type: 'income', category_name: 'Freelance', date: '2026-07-03' });
		expect(byDesc.get('Gas station refill')).toMatchObject({ amount: 1200, type: 'expense', category_name: 'Transportation', date: '2026-07-04' });
		expect(byDesc.get('FOOD & DINING refund (case insensitive test)')).toMatchObject({ amount: 500, type: 'expense', date: '2026-07-06' });
	});

	it('rejects the bad date row and the unknown-category row', () => {
		const { headers, rows } = parseCSV(csv);
		const mapping = autoMap(headers);
		const mapped = buildMappedRows(rows, headers, mapping, CONFIG);
		const result = validateAllRows(mapped, USER_CATEGORIES, CONFIG);

		const bad = result.invalidRows.map(x => x.errors.join(' | '));
		expect(bad.some(e => e.includes('Invalid date'))).toBe(true);
		expect(bad.some(e => e.includes('Unknown category: "Nonexistent Category"'))).toBe(true);
	});

	it('parseDateFlexible handles month-name and US formats', () => {
		expect(parseDateFlexible('Jul 15, 2026', 'MMM DD, YYYY')).toBe('2026-07-15');
		expect(parseDateFlexible('15 Jul 2026', 'DD MMM YYYY')).toBe('2026-07-15');
		expect(parseDateFlexible('07/15/2026', 'MM/DD/YYYY')).toBe('2026-07-15');
		expect(parseDateFlexible('2026-07-15')).toBe('2026-07-15');
	});
});

describe('normCategoryName (shared normalizer)', () => {
	it('trims and lowercases', () => {
		expect(normCategoryName('  Food & Dining  ')).toBe('food & dining');
		expect(normCategoryName('SALARY')).toBe('salary');
		expect(normCategoryName('Other Expense')).toBe('other expense');
	});

	it('handles empty / undefined-ish input without throwing', () => {
		expect(normCategoryName('')).toBe('');
		expect(normCategoryName('   ')).toBe('');
	});
});

describe('category resolution — 9 of 10 sample names resolve, 1 is truly unknown', () => {
	const SAMPLE_CATEGORY_NAMES = [
		'Salary',
		'Food & Dining',
		'Freelance',
		'Transportation',
		'Shopping',
		'FOOD & DINING', // case-insensitive variant must resolve
		'Food & Dining',
		'Nonexistent Category', // the only real unknown
		'Entertainment',
		'Bills & Utilities',
	];

	it('resolves every real name (case/trim-insensitive) and rejects only Nonexistent Category', () => {
		const allowSet = new Set(USER_CATEGORIES.map(c => normCategoryName(c.name)));
		const resolved = SAMPLE_CATEGORY_NAMES.map(name => allowSet.has(normCategoryName(name)));

		expect(resolved.filter(Boolean).length).toBe(9);
		expect(resolved[5]).toBe(true); // 'FOOD & DINING' -> 'food & dining'
		expect(resolved[7]).toBe(false); // 'Nonexistent Category' stays unknown
	});

	it('preview tally: 8 valid · 2 invalid (bad date + unknown category), unknown list = only Nonexistent Category', () => {
		const csvPath = path.join(process.cwd(), 'docs', 'sample-transactions.csv');
		const csv = fs.readFileSync(csvPath, 'utf8');
		const { headers, rows } = parseCSV(csv);
		const mapping = autoMap(headers);
		const mapped = buildMappedRows(rows, headers, mapping, CONFIG);
		const result = validateAllRows(mapped, USER_CATEGORIES, CONFIG);

		expect(result.validRows.length).toBe(8);
		expect(result.invalidRows.length).toBe(2);
		expect(result.unknownCategories).toEqual(['Nonexistent Category']);
	});
});
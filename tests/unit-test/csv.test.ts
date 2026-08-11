import { describe, it, expect } from 'vitest';
import { csvEscape, transactionsToCSV } from '$lib/shared/utils/csv';

describe('transactionsToCSV — Source of Funds export column', () => {
	const base = {
		date: '2026-08-01',
		type: 'expense',
		category_name: 'Food',
		description: 'Groceries',
		amount: 250.5,
	};

	it('emits "Source of Funds" as the final header column', () => {
		const csv = transactionsToCSV([base]);
		const header = csv.split('\n')[0];
		expect(header).toBe('Date,Type,Category,Description,Amount,Source of Funds');
	});

	it('appends the source value in the final column when present', () => {
		const csv = transactionsToCSV([{ ...base, source_of_funds: "Mother's Money" }]);
		const line = csv.split('\n')[1];
		expect(line).toBe('2026-08-01,expense,Food,Groceries,₱250.50,Mother\'s Money');
	});

	it('writes an empty final cell when source_of_funds is null/undefined', () => {
		const csv = transactionsToCSV([base, { ...base, source_of_funds: null }]);
		const lines = csv.split('\n');
		expect(lines[1]).toBe('2026-08-01,expense,Food,Groceries,₱250.50,');
		expect(lines[2]).toBe('2026-08-01,expense,Food,Groceries,₱250.50,');
	});

	it('escapes commas and quotes inside source_of_funds values', () => {
		const csv = transactionsToCSV([{ ...base, source_of_funds: 'Aunt, "Money"' }]);
		const line = csv.split('\n')[1];
		expect(line).toBe('2026-08-01,expense,Food,Groceries,₱250.50,"Aunt, ""Money"""');
	});

	it('does not reorder existing columns (description before amount)', () => {
		const csv = transactionsToCSV([base]);
		const line = csv.split('\n')[1];
		// Existing column order is preserved; Source of Funds only appends.
		expect(line.indexOf('Groceries')).toBeLessThan(line.indexOf('₱250.50'));
	});
});

describe('csvEscape', () => {
	it('returns the raw value for plain text', () => {
		expect(csvEscape('plain')).toBe('plain');
	});

	it('wraps values containing commas in quotes', () => {
		expect(csvEscape('a, b')).toBe('"a, b"');
	});

	it('doubles embedded quotes', () => {
		expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
	});

	it('wraps values containing newlines in quotes', () => {
		expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
	});

	it('coerces null/undefined to an empty string', () => {
		expect(csvEscape(null)).toBe('');
		expect(csvEscape(undefined)).toBe('');
	});
});

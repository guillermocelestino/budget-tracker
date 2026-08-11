#!/usr/bin/env node
/**
 * Generate Excel import templates for Transactions, Lending, and Borrowed.
 * Run with: npm run generate:import
 * Outputs to static/templates/
 */

import writeXlsxFile from 'write-excel-file/node';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const templatesDir = join(__dirname, '../static/templates');

// Ensure templates directory exists
import { mkdirSync } from 'fs';
mkdirSync(templatesDir, { recursive: true });

/**
 * Transactions template
 * Headers: Date, Description, Amount, Type, Category Name, Source of Funds
 * Sample row with various formats
 */
const transactionsHeaders = ['Date', 'Description', 'Amount', 'Type', 'Category Name', 'Source of Funds'];
const transactionsSampleRow = [
	'2026-07-15',
	'Salary deposit',
	50000.00,
	'income',
	'Salary',
	'Bank Transfer'
];
// Reasonable column widths for the transaction import template.
const transactionsColumns = [
	{ width: 14 }, // Date
	{ width: 34 }, // Description
	{ width: 14 }, // Amount
	{ width: 10 }, // Type
	{ width: 18 }, // Category Name
	{ width: 22 }, // Source of Funds
];

/**
 * Lending template (for /lending page)
 * Headers: Person, Amount, Interest Rate, Date Lent, Due Date, Notes, Status, Amount Recovered
 */
const lendingHeaders = ['Person', 'Amount', 'Interest Rate', 'Date Lent', 'Due Date', 'Notes', 'Status', 'Amount Recovered'];
const lendingSampleRow = [
	'Juan Dela Cruz',
	5000,
	5,
	'2026-07-01',
	'2026-10-01',
	'Starter loan',
	'active',
	0
];

/**
 * Borrowed template (for /borrowed page)
 * Headers: Lender, Amount, Interest Rate, Date Borrowed, Due Date, Notes, Status, Amount Repaid
 */
const borrowedHeaders = ['Lender', 'Amount', 'Interest Rate', 'Date Borrowed', 'Due Date', 'Notes', 'Status', 'Amount Repaid'];
const borrowedSampleRow = [
	'Tita Beth',
	3000,
	2,
	'2026-06-15',
	'2026-09-15',
	'Borrowed for market day',
	'active',
	0
];

async function generate() {
	console.log('Generating Excel import templates...');

	// Transactions template
	await writeXlsxFile([
		transactionsHeaders,
		transactionsSampleRow,
	], { columns: transactionsColumns }).toFile(join(templatesDir, 'transactions.xlsx'));
	console.log('✓ static/templates/transactions.xlsx');

	// Lending template
	await writeXlsxFile([
		lendingHeaders,
		lendingSampleRow,
	], join(templatesDir, 'lending.xlsx')).toFile(join(templatesDir, 'lending.xlsx'));
	console.log('✓ static/templates/lending.xlsx');

	// Borrowed template
	await writeXlsxFile([
		borrowedHeaders,
		borrowedSampleRow,
	], join(templatesDir, 'borrowed.xlsx')).toFile(join(templatesDir, 'borrowed.xlsx'));
	console.log('✓ static/templates/borrowed.xlsx');

	console.log('\nAll templates generated successfully!');
	console.log('Add to git: git add static/templates/');
}

generate().catch(err => {
	console.error('Error generating templates:', err);
	process.exit(1);
});
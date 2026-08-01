/**
 * CSV utilities — the single home for all CSV serialization and download logic.
 *
 * Responsibilities:
 *  - csvEscape()         escape one field (single source of truth)
 *  - transactionsToCSV() serialize transactions
 *  - lendingsToCSV()     serialize lending/borrowing records
 *  - downloadCsv()       trigger a browser download (client-only)
 *
 * Display formatting (currency, dates, etc.) lives in format.ts, not here.
 */

/**
 * Escape a single CSV field value.
 * Wraps in quotes and doubles internal quotes when the value contains
 * a comma, quote, or newline. Single source of truth for CSV escaping.
 */
export function csvEscape(val: string | number | null | undefined): string {
	const str = String(val ?? '');
	if (str.includes(',') || str.includes('"') || str.includes('\n')) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}

/**
 * Convert an array of transactions to CSV format.
 * Handles escaping of commas and quotes in descriptions.
 */
export function transactionsToCSV(
	transactions: Array<{
		date: string;
		type: string;
		category_name?: string | null;
		description: string;
		amount: number;
	}>
): string {
	const header = 'Date,Type,Category,Description,Amount';
	const rows = transactions.map((t) =>
		[
			csvEscape(t.date),
			csvEscape(t.type),
			csvEscape(t.category_name),
			csvEscape(t.description),
			csvEscape(`₱${t.amount.toFixed(2)}`),
		].join(',')
	);

	return [header, ...rows].join('\n');
}

/**
 * Convert an array of lending/borrowing records to CSV format.
 * `direction` only changes the person-column header label.
 */
export function lendingsToCSV(
	lendings: Array<{
		borrower_name: string;
		amount: number;
		interest_rate: number;
		date_lent: string;
		due_date: string | null;
		status: string;
		notes: string | null;
	}>,
	direction: 'lent' | 'borrowed' = 'lent'
): string {
	const personLabel = direction === 'borrowed' ? 'Lender' : 'Borrower';
	const header = `${personLabel},Amount,Interest Rate (%),Date,Due Date,Status,Notes`;
	const rows = lendings.map((l) =>
		[
			csvEscape(l.borrower_name),
			csvEscape(`₱${l.amount.toFixed(2)}`),
			csvEscape(l.interest_rate),
			csvEscape(l.date_lent),
			csvEscape(l.due_date),
			csvEscape(l.status),
			csvEscape(l.notes),
		].join(',')
	);

	return [header, ...rows].join('\n');
}

/**
 * Trigger a client-side CSV download. Owns all Blob/URL/anchor/cleanup
 * logic so pages never touch these browser APIs directly.
 * Browser-only: called from client code paths (never on the server).
 */
export function downloadCsv(csvContent: string, filename: string): void {
	const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

/**
 * CSV utilities — client-side extensions (browser download).
 *
 * Re-exports pure CSV serialization from shared, adds browser-only download.
 *
 * - csvEscape              → from $lib/shared/utils/csv
 * - transactionsToCSV      → from $lib/shared/utils/csv
 * - lendingsToCSV          → from $lib/shared/utils/csv
 * - downloadCsv()          → browser-only (Blob, URL, document, anchor)
 */

export { csvEscape, transactionsToCSV, lendingsToCSV } from '$lib/shared/utils/csv';

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
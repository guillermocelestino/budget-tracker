import { parseCSV } from './importValidation';

/**
 * Unified file parser for CSV and Excel (.xlsx) files.
 * Returns the exact same shape as parseCSV: { headers: string[], rows: string[][] }
 * This is the ONLY place that looks at file type — everything downstream is format-agnostic.
 *
 * Runs in browser (preview) and on server (authoritative validation).
 */
export async function parseImportFile(file: File): Promise<{ headers: string[]; rows: string[][] }> {
	const name = file.name.toLowerCase();

	console.log('[parseImportFile] Processing file:', name, file.size, file.type);

	if (name.endsWith('.csv')) {
		const text = await file.text();
		console.log('[parseImportFile] CSV text length:', text.length);
		console.log('[parseImportFile] First 200 chars:', text.slice(0, 200));
		return parseCSV(text);
	}

	if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
		// Dynamic import of read-excel-file universal — works in both browser and Node
		const readXlsxFile = (await import('read-excel-file/universal')).default;

		// getValues: true returns cell values (not formatted strings), so dates arrive as Date objects
		const sheets = await readXlsxFile(file);

		if (sheets.length === 0 || sheets[0].data.length < 2) {
			return { headers: [], rows: [] };
		}

		const rows = sheets[0].data;

		// Coerce all cells to strings for the normalized pipeline
		const stringRows = rows.map((row: unknown[]) =>
			row.map((cell: unknown) => coerceCellToString(cell))
		);

		const headers = stringRows[0].filter((h: string) => h.length > 0);
		const dataRows = stringRows.slice(1).filter((r: string[]) => r.some((c: string) => c.trim().length > 0));

		console.log('[parseImportFile] Excel headers:', headers);
		console.log('[parseImportFile] Excel data rows:', dataRows.length);

		return { headers, rows: dataRows };
	}

	// Unsupported format — return empty (caller will error)
	return { headers: [], rows: [] };
}

/**
 * Coerce an Excel cell value to a string for the normalized pipeline.
 * - Date → YYYY-MM-DD
 * - number → String (no locale formatting)
 * - boolean → 'true' / 'false'
 * - null/undefined → ''
 * - string → trimmed
 */
function coerceCellToString(cell: unknown): string {
	if (cell === null || cell === undefined) return '';
	if (cell instanceof Date) {
		// Excel date → YYYY-MM-DD
		if (isNaN(cell.getTime())) return '';
		return cell.toISOString().slice(0, 10);
	}
	if (typeof cell === 'number') {
		// Avoid scientific notation for large ints
		return Number.isInteger(cell) ? String(cell) : cell.toString();
	}
	if (typeof cell === 'boolean') {
		return cell ? 'true' : 'false';
	}
	return String(cell).trim();
}
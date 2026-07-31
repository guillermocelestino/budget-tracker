export interface MappedTransaction {
	date: string;
	description: string;
	amount: number;
	type: 'income' | 'expense';
	category_name: string;
}

export interface ValidationResult {
	valid: boolean;
	errors: string[];
	warnings: string[];
}

/**
 * Type derivation rules for amount sign → type mapping
 */
export type TypeDerivationRule = 'sign' | 'column' | 'debit_credit';

export interface ImportMappingConfig {
	dateFormat: string;
	typeRule: TypeDerivationRule;
}

/**
 * Single shared normalizer for category names — used by BOTH the client preview
 * and the server store so their verdicts can never disagree. Trim + lowercase
 * on both the allow-list entries and the CSV value.
 */
export function normCategoryName(s: string): string {
	return (s ?? '').trim().toLowerCase();
}

/**
 * Parse date with multiple format support
 * Returns ISO YYYY-MM-DD or null if invalid
 */
export function parseDateFlexible(dateStr: string, format?: string): string | null {
	if (!dateStr || !dateStr.trim()) return null;

	const trimmed = dateStr.trim();

	// If format is provided, use it
	if (format) {
		try {
			// Handle common format patterns
			const parsed = parseDateWithFormat(trimmed, format);
			if (parsed) return parsed;
		} catch {
			// fall through to auto-detect
		}
	}

	// Auto-detect common formats
	return autoDetectDate(trimmed);
}

const MONTH_NAMES: Record<string, string> = {
	jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
	jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function parseDateWithFormat(dateStr: string, format: string): string | null {
	// Tokenize the format into capture patterns. Supports YYYY, YY, MM, M,
	// DD, D (numeric) and MMM (month name, e.g. "Jul").
	const tokenRe = /YYYY|YY|MM|MMM|M|DD|D/g;
	const parts: string[] = [];
	const tokenNames: string[] = [];
	let last = 0;
	let m: RegExpExecArray | null;
	tokenRe.lastIndex = 0;
	while ((m = tokenRe.exec(format)) !== null) {
		if (m.index > last) {
			// Literal text between tokens — escape regex-special chars, and
			// allow any of the common date separators (- / . space comma)
			const lit = format.slice(last, m.index);
			parts.push(lit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[-\/.]/g, '[-\\/.]'));
		}
		const tok = m[0];
		tokenNames.push(tok);
		if (tok === 'YYYY') parts.push('(\\d{4})');
		else if (tok === 'YY') parts.push('(\\d{2})');
		else if (tok === 'MMM') parts.push('([A-Za-z]{3})');
		else if (tok === 'MM') parts.push('(\\d{2})');
		else if (tok === 'M') parts.push('(\\d{1,2})');
		else if (tok === 'DD') parts.push('(\\d{2})');
		else if (tok === 'D') parts.push('(\\d{1,2})');
		last = m.index + tok.length;
	}
	if (last < format.length) {
		parts.push(format.slice(last).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[-\/.]/g, '[-\\/.]'));
	}

	const match = dateStr.match(new RegExp(`^${parts.join('')}$`));
	if (!match) return null;

	let year = '', month = '', day = '';
	tokenNames.forEach((tok, i) => {
		const val = match[i + 1];
		if (tok === 'YYYY' || tok === 'YY') year = val;
		else if (tok === 'MMM') month = MONTH_NAMES[val.toLowerCase()] ?? '';
		else if (tok === 'MM' || tok === 'M') month = val.padStart(2, '0');
		else if (tok === 'DD' || tok === 'D') day = val.padStart(2, '0');
	});

	if (!year) return null;
	if (year.length === 2) year = `20${year}`;
	if (!month) month = '01';
	if (!day) day = '01';

	const monthNum = parseInt(month);
	const dayNum = parseInt(day);
	if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) return null;

	const testDate = new Date(`${year}-${month}-${day}`);
	if (isNaN(testDate.getTime())) return null;

	return `${year}-${month}-${day}`;
}

function autoDetectDate(dateStr: string): string | null {
	const patterns = [
		// YYYY-MM-DD
		/^(\d{4})-(\d{2})-(\d{2})$/,
		// DD/MM/YYYY or DD-MM-YYYY (ambiguous for US files — the mapping step's
		// explicit date format overrides; native Date below also catches US order)
		/^(\d{2})[-\/](\d{2})[-\/](\d{4})$/,
		// YYYY/MM/DD
		/^(\d{4})\/(\d{2})\/(\d{2})$/,
		// DD.MM.YYYY
		/^(\d{2})\.(\d{2})\.(\d{4})$/,
		// M/D/YYYY (US shorthand)
		/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/,
		// YYYYMMDD
		/^(\d{4})(\d{2})(\d{2})$/,
	];

	for (const pattern of patterns) {
		const match = dateStr.match(pattern);
		if (!match) continue;

		let year: string, month: string, day: string;

		if (pattern.source.startsWith('^(\\d{4})')) {
			// YYYY first → groups: year, month, day
			year = match[1];
			month = match[2];
			day = match[3];
		} else {
			// DD/MM/YYYY or MM/DD/YYYY - assume DD/MM for international (ambiguous);
			// the mapping step's explicit date format overrides this
			year = match[3];
			month = match[2];
			day = match[1];
		}

		if (parseInt(year) < 1900 || parseInt(year) > 2100) continue;
		if (parseInt(month) > 12 || parseInt(month) < 1) continue;
		if (parseInt(day) > 31 || parseInt(day) < 1) continue;

		const testDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
		if (isNaN(testDate.getTime())) continue;

		return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
	}

	// Try native Date parsing as last resort
	const d = new Date(dateStr);
	if (!isNaN(d.getTime())) {
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		if (y >= 1900 && y <= 2100) return `${y}-${m}-${day}`;
	}

	return null;
}

/**
 * Parse amount from various formats:
 * - Plain numbers: "1234.56", "1,234.56"
 * - Currency symbols: "₱1,234.56", "$1,234.56"
 * - Parenthetical negatives: "(1,234.56)"
 * - Leading negative: "-1,234.56"
 * Returns the numeric value (negative for refunds/expenses if sign-based)
 */
export function parseAmountFlexible(amountStr: string): number | null {
	if (!amountStr || !amountStr.trim()) return null;

	let str = amountStr.trim();

	// Handle parenthetical negative: (1,234.56) → -1234.56
	const parenMatch = str.match(/^\((.+)\)$/);
	if (parenMatch) {
		str = '-' + parenMatch[1];
	}

	// Strip currency symbols and commas
	str = str.replace(/[₱$€£¥,\s]/g, '');

	const num = parseFloat(str);
	return isNaN(num) ? null : num;
}

/**
 * Derive transaction type from amount and/or type column
 */
export function deriveType(
	amount: number,
	typeCol?: string,
	rule: TypeDerivationRule = 'sign'
): 'income' | 'expense' {
	switch (rule) {
		case 'sign':
			// Negative amount → expense, positive → income
			return amount < 0 ? 'expense' : 'income';
		case 'column':
			if (typeCol) {
				const t = typeCol.toLowerCase().trim();
				if (['income', 'in', 'credit', '+', 'deposit', 'received'].includes(t)) return 'income';
				if (['expense', 'out', 'debit', '-', 'withdrawal', 'payment', 'spent'].includes(t)) return 'expense';
			}
			// Fallback to sign
			return amount < 0 ? 'expense' : 'income';
		case 'debit_credit':
			if (typeCol) {
				const t = typeCol.toLowerCase().trim();
				if (['credit', 'cr', 'deposit', 'received'].includes(t)) return 'income';
				if (['debit', 'dr', 'withdrawal', 'payment', 'spent'].includes(t)) return 'expense';
			}
			return amount < 0 ? 'expense' : 'income';
		default:
			return amount < 0 ? 'expense' : 'income';
	}
}

/**
 * Normalize amount for storage: always positive, type determines sign
 * Refunds are stored as positive amount with type='expense' (or negative amount with type='income')
 * but per app convention: amount is always positive, type determines direction
 */
export function normalizeAmountForStorage(amount: number, type: 'income' | 'expense'): number {
	// Store as positive; the sign is implied by type
	// Negative amounts in CSV with type='expense' are refunds
	return Math.abs(amount);
}

/**
 * Validate a single mapped transaction row
 */
export function validateMappedRow(
	row: MappedTransaction,
	userCategories: { name: string; type: 'income' | 'expense' }[],
	config: ImportMappingConfig,
	catNames?: Set<string>
): ValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Build the normalized allow-list once per batch when available (see
	// validateAllRows), otherwise on demand. Every entry is normalized via
	// normCategoryName so a wrong-field/shape set can never silently pass.
	const names = catNames ?? new Set(userCategories.map(c => normCategoryName(c.name)));

	// Date
	const parsedDate = parseDateFlexible(row.date, config.dateFormat);
	if (!parsedDate) {
		errors.push(`Invalid date: "${row.date}"`);
	} else {
		// Check if date is reasonable (not in far future, not before 1900)
		const year = parseInt(parsedDate.split('-')[0]);
		if (year < 1900 || year > 2100) {
			warnings.push(`Date "${row.date}" is outside reasonable range (1900-2100)`);
		}
	}

	// Description
	if (!row.description || row.description.trim().length === 0) {
		errors.push('Missing description');
	} else if (row.description.trim().length > 500) {
		warnings.push('Description exceeds 500 characters, will be trimmed');
	}

	// Amount
	if (row.amount === null || row.amount === undefined || isNaN(row.amount)) {
		errors.push('Invalid amount');
	} else if (row.amount === 0) {
		warnings.push('Amount is zero');
	}

	// Type
	if (!['income', 'expense'].includes(row.type)) {
		errors.push(`Invalid type: "${row.type}"`);
	}

	// Category — resolve by NAME against the allow-list (Set of normalized
	// names). The type-side check runs ONLY after a name resolves, and its
	// message is distinct from "Unknown category".
	if (!row.category_name || row.category_name.trim().length === 0) {
		errors.push('Missing category name');
	} else {
		const normalized = normCategoryName(row.category_name);
		const catMatch = names.has(normalized)
			? userCategories.find(c => normCategoryName(c.name) === normalized)
			: undefined;
		if (!catMatch) {
			errors.push(`Unknown category: "${row.category_name}" (not in your categories)`);
		} else if (catMatch.type !== row.type) {
			errors.push(
				`Category "${catMatch.name}" is ${catMatch.type} but transaction type is ${row.type}`
			);
		}
	}

	return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate all mapped rows and collect unknown categories
 */
export function validateAllRows(
	rows: MappedTransaction[],
	userCategories: { name: string; type: 'income' | 'expense' }[],
	config: ImportMappingConfig
): {
	validRows: MappedTransaction[];
	invalidRows: { row: MappedTransaction; errors: string[]; warnings: string[] }[];
	unknownCategories: string[];
} {
	const validRows: MappedTransaction[] = [];
	const invalidRows: { row: MappedTransaction; errors: string[]; warnings: string[] }[] = [];
	const unknownCategories = new Set<string>();

	// Build the normalized category-name allow-list ONCE for the whole batch —
	// the same normalizer the server uses, so preview and store never diverge.
	const catNames = new Set(userCategories.map(c => normCategoryName(c.name)));

	for (const row of rows) {
		const result = validateMappedRow(row, userCategories, config, catNames);

		if (result.valid) {
			validRows.push(row);
		} else {
			invalidRows.push({ row, errors: result.errors, warnings: result.warnings });
			// Collect unknown categories
			for (const err of result.errors) {
				if (err.startsWith('Unknown category:')) {
					const catName = err.match(/Unknown category: "([^"]+)"/)?.[1];
					if (catName) unknownCategories.add(catName);
				}
			}
		}
	}

	return {
		validRows,
		invalidRows,
		unknownCategories: Array.from(unknownCategories),
	};
}

/**
 * Build mapped rows from raw CSV data and column mapping
 */
export function buildMappedRows(
	rawRows: string[][],
	headers: string[],
	mapping: Record<string, string>,
	config: ImportMappingConfig
): MappedTransaction[] {
	const dateCol = headers.find(c => mapping[c] === 'date');
	const descCol = headers.find(c => mapping[c] === 'description');
	const amtCol = headers.find(c => mapping[c] === 'amount');
	const typeCol = headers.find(c => mapping[c] === 'type');
	const catCol = headers.find(c => mapping[c] === 'category_name');

	return rawRows.map(rawRow => {
		const getVal = (col: string | undefined, fallback = '') =>
			col ? rawRow[headers.indexOf(col)] ?? fallback : fallback;

		const rawDate = getVal(dateCol);
		const rawAmt = getVal(amtCol, '0');
		const rawType = getVal(typeCol);
		const rawCat = getVal(catCol, 'Other Expense');
		const rawDesc = getVal(descCol, 'Imported transaction');

		// Parse date — if unparseable, keep the raw value so validation flags
		// it as a row error instead of silently substituting today's date.
		const date = parseDateFlexible(rawDate, config.dateFormat) ?? rawDate.trim();

		// Parse amount (preserve sign for type derivation)
		const amount = parseAmountFlexible(rawAmt) ?? 0;

		// Derive type
		const type = deriveType(amount, rawType, config.typeRule);

		// Normalize amount for storage (always positive)
		const normalizedAmount = normalizeAmountForStorage(amount, type);

		return {
			date,
			description: rawDesc.trim().slice(0, 500),
			amount: normalizedAmount,
			type,
			category_name: rawCat.trim(),
		};
	});
}

/**
 * Generate a deterministic hash for a transaction to detect duplicates
 * Based on user_id + date + amount + description + category_name
 */
export function generateTransactionHash(
	userId: number,
	tx: MappedTransaction
): string {
	const str = `${userId}|${tx.date}|${tx.amount}|${tx.description.trim().toLowerCase()}|${tx.category_name.trim().toLowerCase()}`;
	// Simple hash for duplicate detection
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = ((hash << 5) - hash) + str.charCodeAt(i);
		hash |= 0;
	}
	return Math.abs(hash).toString(36);
}

/**
 * Check for duplicates against existing transactions
 * Returns indices of rows that are duplicates
 */
export async function detectDuplicates(
	userId: number,
	rows: MappedTransaction[],
	existingTransactions: { date: string; amount: number; description: string; category_id: number }[],
	userCategories: { id: number; name: string }[]
): Promise<number[]> {
	const dupIndices: number[] = [];

	// Build a map of existing transactions by hash
	const existingHashes = new Set<string>();
	for (const extx of existingTransactions) {
		const cat = userCategories.find(c => c.id === extx.category_id);
		if (!cat) continue;
		const hash = generateTransactionHash(userId, {
			date: extx.date,
			amount: extx.amount,
			description: extx.description,
			type: 'expense', // type doesn't matter for dedup if amount+cat match
			category_name: cat.name,
		});
		existingHashes.add(hash);
	}

	// Check each new row
	for (let i = 0; i < rows.length; i++) {
		const hash = generateTransactionHash(userId, rows[i]);
		if (existingHashes.has(hash)) {
			dupIndices.push(i);
		} else {
			// Add to set so subsequent rows in the same import are also caught
			existingHashes.add(hash);
		}
	}

	return dupIndices;
}

/**
 * Parse CSV text into headers + rows.
 * Handles quoted values, escaped quotes, and CRLF / LF line endings.
 * Returns empty arrays if there aren't at least a header row and one data row.
 */
export function parseCSV(text: string): { headers: string[]; rows: string[][] } {
	const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
	if (lines.length < 2) return { headers: [], rows: [] };

	function parseLine(line: string): string[] {
		const result: string[] = [];
		let current = '';
		let inQuotes = false;
		for (let i = 0; i < line.length; i++) {
			const ch = line[i];
			if (ch === '"') {
				if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
					current += '"';
					i++;
				} else {
					inQuotes = !inQuotes;
				}
			} else if (ch === ',' && !inQuotes) {
				result.push(current.trim());
				current = '';
			} else {
				current += ch;
			}
		}
		result.push(current.trim());
		return result;
	}

	const headers = parseLine(lines[0]).filter(h => h.length > 0);
	const rows = lines.slice(1).map(parseLine).filter(r => r.some(c => c.trim().length > 0));
	return { headers, rows };
}

/**
 * Auto-map CSV header names to import fields using common synonyms.
 * Returns a Record<header, field>; unmapped headers are left out (→ "skip").
 */
export function autoMap(cols: string[]): Record<string, string> {
	const map: Record<string, string> = {};
	const lower = cols.map(c => c.toLowerCase().replace(/[\s_]+/g, ' ').trim());
	const known: [string, string[]][] = [
		['date', ['date', 'transaction date', 'posting date', 'fecha', 'datum', 'data', 'valor', 'booking date']],
		['description', ['description', 'desc', 'description', 'name', 'notes', 'note', 'memo', 'payee', 'merchant', 'details', 'narrative', 'transaction']],
		['amount', ['amount', 'amt', 'value', 'sum', 'total', 'price', 'cost', 'number', 'num', 'transaction amount', 'withdrawal amount', 'deposit amount']],
		['type', ['type', 'kind', 'category type', 'transaction type', 'class', 'transaction type']],
		['category_name', ['category', 'cat', 'category name', 'group', 'label', 'tags', 'category label']],
	];

	for (const [field, aliases] of known) {
		for (let i = 0; i < lower.length; i++) {
			if (aliases.includes(lower[i]) && cols[i] && !Object.values(map).includes(field)) {
				map[cols[i]] = field;
				break;
			}
		}
	}
	return map;
}
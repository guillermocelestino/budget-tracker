/**
 * Format a date value to a short "MMM D" string.
 * Returns empty string for null/undefined.
 */
export function formatDateShort(dateStr: string | Date | null | undefined): string {
	if (dateStr == null) return '';
	const date = parseDate(dateStr);
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
	}).format(date);
}

/**
 * Parse a date string or Date object into a local Date.
 * Postgres returns `date` columns as JS Date objects (SQLite returns
 * 'YYYY-MM-DD' strings). Normalize both to a local-midnight Date so
 * Intl formatting and comparisons behave the same on either backend.
 */
export function parseDate(dateStr: string | Date): Date {
	if (dateStr instanceof Date) {
		return new Date(dateStr.getFullYear(), dateStr.getMonth(), dateStr.getDate());
	}
	const [y, m, d] = dateStr.split('-').map(Number);
	return new Date(y, m - 1, d);
}

/**
 * Format a Date object to YYYY-MM-DD for input fields.
 */
export function formatDateInput(date: Date = new Date()): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

/**
 * Normalize a date value to a 'YYYY-MM-DD' string.
 * Postgres returns `date` columns as JS Date objects (SQLite returns strings),
 * so DB-backed dates reach components as either. Returns null for nullish input.
 */
export function dateToString(date: string | Date | null | undefined): string | null {
	if (date == null) return null;
	return date instanceof Date ? formatDateInput(date) : date;
}

/**
 * Get current month as YYYY-MM string.
 * In demo mode, uses DEMO_TODAY env var to pin "today" for consistent demo experience.
 */
export function getCurrentMonth(): string {
	// Demo mode: pin to fixed date for consistent demo experience
	if (typeof process !== 'undefined' && process.env?.DEMO_TODAY) {
		const [y, m] = process.env.DEMO_TODAY.split('-').map(Number);
		return `${y}-${String(m).padStart(2, '0')}`;
	}
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Get today's date as YYYY-MM-DD string.
 * In demo mode, uses DEMO_TODAY env var to pin "today".
 */
export function getToday(): string {
	if (typeof process !== 'undefined' && process.env?.DEMO_TODAY) {
		return process.env.DEMO_TODAY;
	}
	const now = new Date();
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, '0');
	const d = String(now.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

export function getMonthLabel(monthStr: string): string {
	const [y, m] = monthStr.split('-').map(Number);
	const date = new Date(y, m - 1);
	return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(date);
}

export function validateAmount(value: string | number): { valid: boolean; error?: string; value?: number } {
	const num = typeof value === 'string' ? parseFloat(value) : value;
	if (isNaN(num)) return { valid: false, error: 'Amount must be a number' };
	if (num <= 0) return { valid: false, error: 'Amount must be greater than zero' };
	return { valid: true, value: Math.round(num * 100) / 100 };
}

/**
 * Format a raw number string with comma separators for display.
 * Strips non-numeric characters except for one decimal point.
 */
export function formatWithCommas(value: string): string {
	const parts = value.split('.');
	parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
	return parts.join('.');
}

/**
 * Format a stored amount string for edit display.
 */
export function formatEditAmount(value: string): string {
	const num = parseFloat(value.replace(/,/g, ''));
	if (isNaN(num)) return '';
	return formatWithCommas(num % 1 === 0 ? String(num) : num.toFixed(2));
}
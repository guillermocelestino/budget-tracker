import { prefs } from '$lib/stores/preferences.svelte';

// Currency → locale + symbol mapping
const CURRENCY_MAP: Record<string, { locale: string; symbol: string }> = {
	PHP: { locale: 'en-PH', symbol: '₱' },
	USD: { locale: 'en-US', symbol: '$' },
	EUR: { locale: 'de-DE', symbol: '€' },
	GBP: { locale: 'en-GB', symbol: '£' },
	JPY: { locale: 'ja-JP', symbol: '¥' },
};

export function formatCurrency(amount: number): string {
	const code = (typeof prefs !== 'undefined' ? prefs.currency : 'PHP') || 'PHP';
	const cfg = CURRENCY_MAP[code] ?? CURRENCY_MAP.PHP;
	const formatted = Math.abs(amount).toLocaleString(cfg.locale, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
	return amount < 0 ? `-${cfg.symbol}${formatted}` : `${cfg.symbol}${formatted}`;
}

export function formatDate(dateStr: string): string {
	const date = parseDate(dateStr);
	// Determine the format based on user preference
	const format = prefs?.dateFormat ?? 'MMM DD, YYYY';
	// Map format strings to Intl.DateTimeFormat options
	const formatMap: Record<string, Intl.DateTimeFormatOptions> = {
		'MMM DD, YYYY': { month: 'short', day: 'numeric', year: 'numeric' },
		'DD/MM/YYYY': { day: '2-digit', month: '2-digit', year: 'numeric' },
		'YYYY-MM-DD': { year: 'numeric', month: '2-digit', day: '2-digit' },
		'MM/DD/YYYY': { month: '2-digit', day: '2-digit', year: 'numeric' },
		'EEEE, MMMM d': { weekday: 'long', month: 'long', day: 'numeric' },
	};
	const options = formatMap[format] ?? formatMap['MMM DD, YYYY'];
	return new Intl.DateTimeFormat('en-US', options).format(date);
}

export function formatDateShort(dateStr: string): string {
	const date = parseDate(dateStr);
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
	}).format(date);
}

export function parseDate(dateStr: string): Date {
	const [y, m, d] = dateStr.split('-').map(Number);
	return new Date(y, m - 1, d);
}

export function formatDateInput(date: Date = new Date()): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
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
 * Handle amount input events: strips non-numeric chars, formats with commas.
 * Returns the raw number string and updates the input element's display value.
 */
export function handleAmountInput(e: Event): string {
	const input = e.target as HTMLInputElement;
	let raw = input.value.replace(/[^0-9.]/g, '');
	const dots = raw.match(/\./g);
	if (dots && dots.length > 1) raw = raw.slice(0, raw.lastIndexOf('.'));
	input.value = raw ? formatWithCommas(raw) : '';
	return raw;
}

/**
 * On focus: swap display value back to raw number for editing.
 */
export function handleAmountFocus(e: Event, rawAmount: string): void {
	const input = e.target as HTMLInputElement;
	input.value = rawAmount;
	const len = input.value.length;
	input.setSelectionRange(len, len);
}

/**
 * On blur: reformat the raw amount with comma separators.
 */
export function handleAmountBlur(e: Event, rawAmount: string): void {
	const input = e.target as HTMLInputElement;
	if (rawAmount) {
		const num = parseFloat(rawAmount);
		if (!isNaN(num)) {
			input.value = formatWithCommas(
				num % 1 === 0 ? String(num) : num.toFixed(2)
			);
		}
	}
}

/**
 * Format a stored amount string for edit display.
 */
export function formatEditAmount(value: string): string {
	const num = parseFloat(value.replace(/,/g, ''));
	if (isNaN(num)) return '';
	return formatWithCommas(num % 1 === 0 ? String(num) : num.toFixed(2));
}

/**
 * Animate a number counting up from 0 to target.
 * Calls onFrame with each intermediate value.
 * Returns a cancel function.
 */
export function countUp(
	target: number,
	duration: number,
	onFrame: (value: number) => void
): () => void {
	const start = performance.now();
	let rafId: number;

	function animate(now: number) {
		const elapsed = now - start;
		const progress = Math.min(elapsed / duration, 1);
		const eased = 1 - Math.pow(1 - progress, 3);
		const current = eased * target;
		onFrame(current);
		if (progress < 1) {
			rafId = requestAnimationFrame(animate);
		}
	}

	rafId = requestAnimationFrame(animate);
	return () => cancelAnimationFrame(rafId);
}

/**
 * Convert an array of transactions to CSV format.
 * Handles escaping of commas and quotes in descriptions.
 */
export function transactionsToCSV(transactions: Array<{
	date: string;
	type: string;
	category_name?: string | null;
	description: string;
	amount: number;
}>): string {
	const escape = (val: string | number | null | undefined): string => {
		const str = String(val ?? '');
		if (str.includes(',') || str.includes('"') || str.includes('\n')) {
			return `"${str.replace(/"/g, '""')}"`;
		}
		return str;
	};

	const header = 'Date,Type,Category,Description,Amount';
	const rows = transactions.map(t =>
		[escape(t.date), escape(t.type), escape(t.category_name), escape(t.description), escape(`₱${t.amount.toFixed(2)}`)].join(',')
	);

	return [header, ...rows].join('\n');
}

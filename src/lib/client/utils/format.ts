import { prefs } from '$lib/client/stores/preferences.svelte';
import { formatWithCommas, parseDate } from '$lib/shared/utils/format';

// Currency → locale + symbol mapping
const CURRENCY_MAP: Record<string, { locale: string; symbol: string }> = {
	PHP: { locale: 'en-PH', symbol: '₱' },
	USD: { locale: 'en-US', symbol: '$' },
	EUR: { locale: 'de-DE', symbol: '€' },
	GBP: { locale: 'en-GB', symbol: '£' },
	JPY: { locale: 'ja-JP', symbol: '¥' },
};

export function formatCurrency(amount: number | null | undefined): string {
	const val = amount == null || isNaN(amount) ? 0 : amount;
	const code = (typeof prefs !== 'undefined' ? prefs.currency : 'PHP') || 'PHP';
	const cfg = CURRENCY_MAP[code] ?? CURRENCY_MAP.PHP;
	const formatted = Math.abs(val).toLocaleString(cfg.locale, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
	return val < 0 ? `-${cfg.symbol}${formatted}` : `${cfg.symbol}${formatted}`;
}

/**
 * Format an amount with an explicit direction sign — "+" for inflows,
 * U+2212 MINUS "−" for outflows. Used for the mono, tabular-nums money
 * figures across list pages (rule 2).
 */
export function formatSignedCurrency(amount: number | null | undefined): string {
	const val = amount == null || isNaN(amount) ? 0 : amount;
	return (val >= 0 ? '+' : '−') + formatCurrency(Math.abs(val));
}

/**
 * Format an amount as a plain figure with thousands separators and two
 * decimal places — no currency symbol and no sign. Used for PDF output.
 */
export function formatPlainAmount(amount: number): string {
	const code = (typeof prefs !== 'undefined' ? prefs.currency : 'PHP') || 'PHP';
	const cfg = CURRENCY_MAP[code] ?? CURRENCY_MAP.PHP;
	return Math.abs(amount).toLocaleString(cfg.locale, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
}

/**
 * Format a date string to a human-readable format using user preferences.
 * Returns empty string for null/undefined.
 */
export function formatDate(dateStr: string | Date | null | undefined): string {
	if (dateStr == null) return '';
	// Reuse parseDate from shared - need to import or copy
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

// Re-export formatWithCommas from shared (pure function)
export { formatWithCommas } from '$lib/shared/utils/format';
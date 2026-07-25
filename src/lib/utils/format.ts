export function formatCurrency(amount: number): string {
	return new Intl.NumberFormat('en-PH', {
		style: 'currency',
		currency: 'PHP',
	}).format(amount);
}

export function formatDate(dateStr: string): string {
	const date = parseDate(dateStr);
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	}).format(date);
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

export function getCurrentMonth(): string {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
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

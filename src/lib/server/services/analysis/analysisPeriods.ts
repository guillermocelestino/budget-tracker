/**
 * Centralized Period Resolver for Financial Analysis
 */

import type { AnalysisPeriod, DateRange, PeriodResolution } from './analysisTypes';

function formatDate(d: Date): string {
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function parseDate(s: string): Date {
	const [y, m, d] = s.split('-').map(Number);
	return new Date(y, m - 1, d);
}

export function isValidDateStr(s?: string | null): boolean {
	if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
	const [y, m, d] = s.split('-').map(Number);
	const date = new Date(y, m - 1, d);
	return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

function getDaysBetween(startStr: string, endStr: string): number {
	const s = parseDate(startStr).getTime();
	const e = parseDate(endStr).getTime();
	const diffDays = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
	return Math.max(1, diffDays);
}

export function resolvePeriod(
	period: AnalysisPeriod = '1M',
	baseDateStr?: string,
	customStartDateStr?: string,
	customEndDateStr?: string,
	earliestDbDateStr?: string
): PeriodResolution {
	const base = baseDateStr ? parseDate(baseDateStr) : new Date();
	const year = base.getFullYear();
	const month = base.getMonth();

	let currentStart: Date;
	let currentEnd: Date;
	let granularity: 'daily' | 'weekly' | 'monthly' = 'daily';

	if (period === 'CUSTOM') {
		const startValid = isValidDateStr(customStartDateStr);
		const endValid = isValidDateStr(customEndDateStr);

		if (startValid && endValid && customStartDateStr! <= customEndDateStr!) {
			currentStart = parseDate(customStartDateStr!);
			currentEnd = parseDate(customEndDateStr!);
		} else {
			// Graceful fallback if custom dates are missing or invalid
			currentStart = new Date(year, month, 1);
			currentEnd = new Date(year, month + 1, 0);
		}

		const days = getDaysBetween(formatDate(currentStart), formatDate(currentEnd));
		if (days <= 31) {
			granularity = 'daily';
		} else if (days <= 180) {
			granularity = 'weekly';
		} else {
			granularity = 'monthly';
		}
	} else if (period === '1M') {
		currentStart = new Date(year, month, 1);
		currentEnd = new Date(year, month + 1, 0);
		granularity = 'daily';
	} else if (period === '3M') {
		currentStart = new Date(year, month - 2, 1);
		currentEnd = new Date(year, month + 1, 0);
		granularity = 'weekly';
	} else if (period === 'YTD') {
		currentStart = new Date(year, 0, 1);
		currentEnd = base;
		granularity = month <= 1 ? 'daily' : 'monthly';
	} else if (period === '1Y') {
		currentStart = new Date(year - 1, month + 1, 1);
		currentEnd = new Date(year, month + 1, 0);
		granularity = 'monthly';
	} else {
		// ALL
		const earliest = earliestDbDateStr ? parseDate(earliestDbDateStr) : new Date(year - 1, 0, 1);
		currentStart = earliest;
		currentEnd = base;
		granularity = 'monthly';
	}

	const currentRange: DateRange = {
		start: formatDate(currentStart),
		end: formatDate(currentEnd),
	};

	const daysInPeriod = getDaysBetween(currentRange.start, currentRange.end);

	return {
		period,
		current: currentRange,
		daysInPeriod,
		granularity,
	};
}


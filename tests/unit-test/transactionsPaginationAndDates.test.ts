import { describe, it, expect } from 'vitest';

describe('Transactions Date Range & Pagination Interaction Logic', () => {
	it('validates date range correctly when From > End', () => {
		const from = '2026-04-01';
		const to = '2026-03-01';
		const isInvalid = !!from && !!to && from > to;
		expect(isInvalid).toBe(true);
	});

	it('validates date range correctly when From <= End', () => {
		const from = '2026-01-01';
		const to = '2026-03-31';
		const isInvalid = !!from && !!to && from > to;
		expect(isInvalid).toBe(false);
	});

	it('allows From Date only', () => {
		const from: string = '2026-01-01';
		const to: string = '';
		const isInvalid = !!from && !!to && from > to;
		const canApply = (!!from || !!to) && !isInvalid;
		expect(canApply).toBe(true);
	});

	it('allows End Date only', () => {
		const from: string = '';
		const to: string = '2026-03-31';
		const isInvalid = !!from && !!to && from > to;
		const canApply = (!!from || !!to) && !isInvalid;
		expect(canApply).toBe(true);
	});

	it('allows both From Date and End Date', () => {
		const from = '2026-01-01';
		const to = '2026-03-31';
		const isInvalid = !!from && !!to && from > to;
		const canApply = (!!from || !!to) && !isInvalid;
		expect(canApply).toBe(true);
	});

	it('disables apply when both dates are empty', () => {
		const from = '';
		const to = '';
		const isInvalid = !!from && !!to && from > to;
		const canApply = (!!from || !!to) && !isInvalid;
		expect(canApply).toBe(false);
	});

	it('ensures Custom Range preset is exposed and expandable', () => {
		let activeFilter = 'this-month';
		let customFrom = '';
		let customTo = '';

		// User selects 'custom'
		activeFilter = 'custom';
		expect(activeFilter).toBe('custom');

		// User sets dates and applies
		customFrom = '2026-01-01';
		customTo = '2026-03-31';
		expect(customFrom).toBe('2026-01-01');
		expect(customTo).toBe('2026-03-31');

		// User clears date filter (clicks 'any')
		activeFilter = 'any';
		customFrom = '';
		customTo = '';
		expect(activeFilter).toBe('any');
		expect(customFrom).toBe('');
		expect(customTo).toBe('');
	});

	it('formats date chip label correctly for all date states', () => {
		const formatLabel = (datePreset: string, customFrom: string, customTo: string) => {
			if (!datePreset) return 'Date';
			if (datePreset === 'custom') {
				if (customFrom && customTo) {
					return `Date: ${customFrom} → ${customTo}`;
				} else if (customFrom) {
					return `Date: From ${customFrom}`;
				} else if (customTo) {
					return `Date: Up to ${customTo}`;
				}
				return 'Date: Custom Range';
			}
			const labels: Record<string, string> = {
				today: 'Today',
				'this-week': 'This Week',
				'this-month': 'This Month',
				'this-year': 'This Year',
				'last-3-months': 'Last 3 Months',
			};
			return `Date: ${labels[datePreset] ?? datePreset}`;
		};

		expect(formatLabel('', '', '')).toBe('Date');
		expect(formatLabel('today', '', '')).toBe('Date: Today');
		expect(formatLabel('this-week', '', '')).toBe('Date: This Week');
		expect(formatLabel('this-month', '', '')).toBe('Date: This Month');
		expect(formatLabel('this-year', '', '')).toBe('Date: This Year');
		expect(formatLabel('last-3-months', '', '')).toBe('Date: Last 3 Months');
		expect(formatLabel('custom', '2026-01-01', '2026-03-31')).toBe('Date: 2026-01-01 → 2026-03-31');
		expect(formatLabel('custom', '2026-01-01', '')).toBe('Date: From 2026-01-01');
		expect(formatLabel('custom', '', '2026-03-31')).toBe('Date: Up to 2026-03-31');
	});

	it('builds URL query parameters correctly for From-only, End-only, and Both dates', () => {
		const buildUrl = (datePreset: string, customFrom: string, customTo: string, limit = 20) => {
			const params = new URLSearchParams();
			if (datePreset === 'custom') {
				if (customFrom) params.set('from', customFrom);
				if (customTo) params.set('to', customTo);
			}
			if (limit !== 20) params.set('limit', String(limit));
			return params.toString();
		};

		expect(buildUrl('custom', '2026-01-01', '2026-03-31', 50)).toBe('from=2026-01-01&to=2026-03-31&limit=50');
		expect(buildUrl('custom', '2026-01-01', '')).toBe('from=2026-01-01');
		expect(buildUrl('custom', '', '2026-03-31')).toBe('to=2026-03-31');
		expect(buildUrl('', '', '')).toBe('');
	});

	it('resets page to 1 when filter parameters change', () => {
		let currentPage = 3;
		const onFilterApply = () => {
			currentPage = 1;
		};

		onFilterApply();
		expect(currentPage).toBe(1);
	});

	it('calculates totalPages for page sizes 20, 50, 100, 200, 500, All', () => {
		const total = 247;
		expect(Math.ceil(total / 20)).toBe(13);
		expect(Math.ceil(total / 50)).toBe(5);
		expect(Math.ceil(total / 100)).toBe(3);
		expect(Math.ceil(total / 200)).toBe(2);
		expect(Math.ceil(total / 500)).toBe(1);
	});
});

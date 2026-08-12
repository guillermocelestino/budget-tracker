import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	calculateElapsedWholeMonths,
	calculateProjectedInterest,
	projectedReferenceDate,
	calculateProjectedInterestForLending
} from '$lib/shared/utils/projectedInterest';

// Mock getToday so tests are deterministic regardless of the real clock.
vi.mock('$lib/shared/utils/format', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/shared/utils/format')>();
	return {
		...actual,
		getToday: vi.fn(() => '2026-09-01')
	};
});

import { getToday } from '$lib/shared/utils/format';
const mockGetToday = vi.mocked(getToday);

describe('calculateElapsedWholeMonths', () => {
	it('counts complete calendar months (Jan 1 → Sep 1 = 8)', () => {
		expect(calculateElapsedWholeMonths('2026-01-01', '2026-09-01')).toBe(8);
	});

	it('returns 0 for same-day lending/repayment', () => {
		expect(calculateElapsedWholeMonths('2026-01-01', '2026-01-01')).toBe(0);
	});

	it('returns 0 when reference date is before the lending date', () => {
		expect(calculateElapsedWholeMonths('2026-09-01', '2026-01-01')).toBe(0);
	});

	it('does not count a partial trailing month (Jan 15 → Sep 10 = 7)', () => {
		expect(calculateElapsedWholeMonths('2026-01-15', '2026-09-10')).toBe(7);
	});

	it('counts a full month when the reference day matches the lending day', () => {
		expect(calculateElapsedWholeMonths('2026-01-15', '2026-09-15')).toBe(8);
	});

	it('is deterministic and does not use days/30 approximation', () => {
		// Feb 1 → Mar 1 = 1 month (not 28/30 ≈ 0.93)
		expect(calculateElapsedWholeMonths('2026-02-01', '2026-03-01')).toBe(1);
		// Feb 1 → Mar 1 across a leap year boundary still = 1
		expect(calculateElapsedWholeMonths('2024-02-01', '2024-03-01')).toBe(1);
	});
});

describe('calculateProjectedInterest', () => {
	it('₱5,000 at 6% for 8 months → ₱2,400', () => {
		expect(calculateProjectedInterest(5000, 6, '2026-01-01', '2026-09-01')).toBe(2400);
	});

	it('0% interest → ₱0', () => {
		expect(calculateProjectedInterest(5000, 0, '2026-01-01', '2026-09-01')).toBe(0);
	});

	it('0 elapsed months → ₱0', () => {
		expect(calculateProjectedInterest(5000, 6, '2026-01-01', '2026-01-01')).toBe(0);
	});

	it('different lending records use their own rates', () => {
		// Same principal + dates, different rates
		expect(calculateProjectedInterest(5000, 6, '2026-01-01', '2026-09-01')).toBe(2400);
		expect(calculateProjectedInterest(5000, 10, '2026-01-01', '2026-09-01')).toBe(4000);
		expect(calculateProjectedInterest(5000, 2, '2026-01-01', '2026-09-01')).toBe(800);
	});

	it('supports decimal rates such as 2.5%', () => {
		// 5000 × 0.025 × 8 = 1000
		expect(calculateProjectedInterest(5000, 2.5, '2026-01-01', '2026-09-01')).toBe(1000);
	});

	it('rounds to 2 decimal places', () => {
		// 333.33 × 0.06 × 1 = 19.9998 → 20.00
		expect(calculateProjectedInterest(333.33, 6, '2026-01-01', '2026-02-01')).toBe(20);
	});

	it('returns 0 for non-finite / non-positive principal', () => {
		expect(calculateProjectedInterest(0, 6, '2026-01-01', '2026-09-01')).toBe(0);
		expect(calculateProjectedInterest(-100, 6, '2026-01-01', '2026-09-01')).toBe(0);
		expect(calculateProjectedInterest(NaN, 6, '2026-01-01', '2026-09-01')).toBe(0);
		expect(calculateProjectedInterest(Infinity, 6, '2026-01-01', '2026-09-01')).toBe(0);
	});

	it('returns 0 for non-finite / negative interest rate', () => {
		expect(calculateProjectedInterest(5000, -6, '2026-01-01', '2026-09-01')).toBe(0);
		expect(calculateProjectedInterest(5000, NaN, '2026-01-01', '2026-09-01')).toBe(0);
		expect(calculateProjectedInterest(5000, Infinity, '2026-01-01', '2026-09-01')).toBe(0);
	});
});

describe('projectedReferenceDate', () => {
	beforeEach(() => {
		mockGetToday.mockReturnValue('2026-09-01');
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('paid lending stops at the actual settlement date', () => {
		expect(projectedReferenceDate({
			derived_status: 'paid',
			due_date: '2026-12-31',
			settlement_date: '2026-08-15'
		})).toBe('2026-08-15');
	});

	it('paid lending without settlement falls back to due_date', () => {
		expect(projectedReferenceDate({
			derived_status: 'paid',
			due_date: '2026-12-31',
			settlement_date: null
		})).toBe('2026-12-31');
	});

	it('paid lending without settlement or due_date falls back to today', () => {
		expect(projectedReferenceDate({
			derived_status: 'paid',
			due_date: null,
			settlement_date: null
		})).toBe('2026-09-01');
	});

	it('active lending uses due_date when present', () => {
		expect(projectedReferenceDate({
			derived_status: 'active',
			due_date: '2026-12-31',
			settlement_date: null
		})).toBe('2026-12-31');
	});

	it('active lending without due_date uses today', () => {
		expect(projectedReferenceDate({
			derived_status: 'active',
			due_date: null,
			settlement_date: null
		})).toBe('2026-09-01');
	});
});

describe('calculateProjectedInterestForLending', () => {
	beforeEach(() => {
		mockGetToday.mockReturnValue('2026-09-01');
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('computes projected interest for an active lending with due_date', () => {
		// Lent Jan 1, due Sep 1 → 8 months at 6% on ₱5,000 = ₱2,400
		expect(calculateProjectedInterestForLending({
			amount: 5000,
			interest_rate: 6,
			date_lent: '2026-01-01',
			due_date: '2026-09-01',
			derived_status: 'active',
			settlement_date: null
		})).toBe(2400);
	});

	it('paid lending stops at the actual settlement date', () => {
		// Lent Jan 1, settled Aug 15 → 7 whole months at 6% on ₱5,000 = ₱2,100
		expect(calculateProjectedInterestForLending({
			amount: 5000,
			interest_rate: 6,
			date_lent: '2026-01-01',
			due_date: '2026-12-31',
			derived_status: 'paid',
			settlement_date: '2026-08-15'
		})).toBe(2100);
	});

	it('active lending without due_date uses today (2026-09-01)', () => {
		// Lent Jan 1, today Sep 1 → 8 months at 6% on ₱5,000 = ₱2,400
		expect(calculateProjectedInterestForLending({
			amount: 5000,
			interest_rate: 6,
			date_lent: '2026-01-01',
			due_date: null,
			derived_status: 'active',
			settlement_date: null
		})).toBe(2400);
	});

	it('same-day lending/repayment → 0 months → ₱0', () => {
		expect(calculateProjectedInterestForLending({
			amount: 5000,
			interest_rate: 6,
			date_lent: '2026-01-01',
			due_date: '2026-01-01',
			derived_status: 'paid',
			settlement_date: '2026-01-01'
		})).toBe(0);
	});

	it('missing/invalid financial data follows app conventions (0 rate → ₱0)', () => {
		expect(calculateProjectedInterestForLending({
			amount: 5000,
			interest_rate: 0,
			date_lent: '2026-01-01',
			due_date: null,
			derived_status: 'active',
			settlement_date: null
		})).toBe(0);
	});
});
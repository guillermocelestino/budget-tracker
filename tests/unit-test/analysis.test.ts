import { describe, expect, it } from 'vitest';
import { resolvePeriod, isValidDateStr } from '$lib/server/services/analysis/analysisPeriods';
import { generateStructuredInsights } from '$lib/server/services/analysis/analysisInsights';
import type {
	CategoryAnalysisItem,
	CommittedMoneyData,
	DailyDrainData,
	MoneyAwayData,
	MoneySnapshotData,
	PeriodResolution,
	SpendingBehaviorData,
} from '$lib/server/services/analysis/analysisTypes';

describe('Analysis Domain Services', () => {
	describe('resolvePeriod() & Date Validation', () => {
		const baseDate = '2026-08-20';

		it('isValidDateStr validates date strings correctly', () => {
			expect(isValidDateStr('2026-08-01')).toBe(true);
			expect(isValidDateStr('2026-02-29')).toBe(false); // Not a leap year in 2026
			expect(isValidDateStr('invalid-date')).toBe(false);
			expect(isValidDateStr('')).toBe(false);
			expect(isValidDateStr(null)).toBe(false);
		});

		it('resolves 1M period correctly', () => {
			const res = resolvePeriod('1M', baseDate);
			expect(res.period).toBe('1M');
			expect(res.current.start).toBe('2026-08-01');
			expect(res.current.end).toBe('2026-08-31');
			expect(res.granularity).toBe('daily');
		});

		it('resolves 3M period correctly', () => {
			const res = resolvePeriod('3M', baseDate);
			expect(res.period).toBe('3M');
			expect(res.current.start).toBe('2026-06-01');
			expect(res.current.end).toBe('2026-08-31');
			expect(res.granularity).toBe('weekly');
		});

		it('resolves YTD period correctly', () => {
			const res = resolvePeriod('YTD', baseDate);
			expect(res.period).toBe('YTD');
			expect(res.current.start).toBe('2026-01-01');
			expect(res.current.end).toBe('2026-08-20');
		});

		it('resolves 1Y period correctly', () => {
			const res = resolvePeriod('1Y', baseDate);
			expect(res.period).toBe('1Y');
			expect(res.current.start).toBe('2025-09-01');
			expect(res.current.end).toBe('2026-08-31');
			expect(res.granularity).toBe('monthly');
		});

		it('resolves ALL period correctly with earliest date', () => {
			const res = resolvePeriod('ALL', baseDate, undefined, undefined, '2024-01-15');
			expect(res.period).toBe('ALL');
			expect(res.current.start).toBe('2024-01-15');
			expect(res.current.end).toBe('2026-08-20');
			expect(res.granularity).toBe('monthly');
		});

		it('resolves CUSTOM valid date range correctly', () => {
			const res = resolvePeriod('CUSTOM', baseDate, '2026-05-10', '2026-05-25');
			expect(res.period).toBe('CUSTOM');
			expect(res.current.start).toBe('2026-05-10');
			expect(res.current.end).toBe('2026-05-25');
			expect(res.granularity).toBe('daily');
		});

		it('handles CUSTOM period missing start/end date gracefully', () => {
			const res = resolvePeriod('CUSTOM', baseDate, undefined, '2026-05-25');
			expect(res.period).toBe('CUSTOM');
			expect(res.current.start).toBe('2026-08-01');
			expect(res.current.end).toBe('2026-08-31');
		});

		it('handles CUSTOM period invalid date string gracefully', () => {
			const res = resolvePeriod('CUSTOM', baseDate, 'invalid-start', '2026-05-25');
			expect(res.period).toBe('CUSTOM');
			expect(res.current.start).toBe('2026-08-01');
			expect(res.current.end).toBe('2026-08-31');
		});

		it('handles CUSTOM period start date after end date gracefully', () => {
			const res = resolvePeriod('CUSTOM', baseDate, '2026-06-01', '2026-05-01');
			expect(res.period).toBe('CUSTOM');
			expect(res.current.start).toBe('2026-08-01');
			expect(res.current.end).toBe('2026-08-31');
		});
	});

	describe('generateStructuredInsights()', () => {
		const mockResolution: PeriodResolution = {
			period: '1M',
			current: { start: '2026-08-01', end: '2026-08-31' },
			daysInPeriod: 31,
			granularity: 'daily',
		};

		const mockSnapshot: MoneySnapshotData = {
			moneyOut: 42000,
			moneyIn: 65000,
			netCashFlow: 23000,
			avgDailyDrain: 1354.8,
			transactionCount: 28,
			largestOutflow: { description: 'MacBook M3', amount: 15000, date: '2026-08-10', categoryName: 'Tech' },
			refundsTotal: 500,
			repaymentsTotal: 2500,
		};

		const mockCategories: CategoryAnalysisItem[] = [
			{ id: 1, name: 'Food & Dining', color: '#ff0000', icon: '🍔', amount: 12000, percentage: 28, txCount: 15 },
			{ id: 2, name: 'Shopping', color: '#00ff00', icon: '🛍️', amount: 8000, percentage: 19, txCount: 5 },
		];

		const mockDailyDrain: DailyDrainData = {
			avgDailyDrain: 1354.8,
			highestDrainDay: { date: '2026-08-10', amount: 15000, dayOfWeek: 'Saturday' },
			lowestDrainDay: { date: '2026-08-04', amount: 120, dayOfWeek: 'Tuesday' },
			unusuallyHighDays: [{ date: '2026-08-10', amount: 15000, ratioToAvg: 11.1 }],
			dailyOutflows: [],
		};

		const mockBehavior: SpendingBehaviorData = {
			avgTxSize: 1500,
			txFrequencyPerDay: 0.9,
			mostActiveDayOfWeek: 'Saturday',
			highestSpendingWeekday: 'Saturday',
			largestCategory: { name: 'Food & Dining', amount: 12000 },
			largestSingleTx: { description: 'MacBook M3', amount: 15000, date: '2026-08-10', categoryName: 'Tech' },
		};

		const mockCommitted: CommittedMoneyData = {
			recurringTotal: 7500,
			upcomingRecurringTotal: 4000,
			borrowedCommittedTotal: 2500,
			recurringCategories: [{ name: 'Bills & Utilities', amount: 5000 }],
			committedPctOfMoneyOut: 24,
		};

		const mockLending: MoneyAwayData = {
			lent: 5000,
			returned: 2500,
			outstanding: 7500,
			activeLendingCount: 2,
			largestOutstanding: { borrowerName: 'Alice', amount: 5000 },
			repaymentRate: 50,
			historicalLent: 15000,
		};

		it('generates expected data-driven Key Insights without comparison language', () => {
			const insights = generateStructuredInsights(
				mockResolution,
				mockSnapshot,
				mockCategories,
				mockDailyDrain,
				mockBehavior,
				mockCommitted,
				mockLending
			);

			expect(insights.length).toBeGreaterThan(0);

			const topCat = insights.find((i) => i.id === 'largest-category');
			expect(topCat).toBeDefined();
			expect(topCat?.description).toContain('Food & Dining is your largest spending category');

			const highDrain = insights.find((i) => i.id === 'high-drain-day');
			expect(highDrain).toBeDefined();
			expect(highDrain?.description).toContain('Saturday was your highest-drain day');

			const avgDrain = insights.find((i) => i.id === 'avg-daily-drain');
			expect(avgDrain).toBeDefined();
			expect(avgDrain?.description).toContain('Your average daily drain is');

			const lendingInsight = insights.find((i) => i.id === 'lending-status');
			expect(lendingInsight).toBeDefined();
			expect(lendingInsight?.description).toContain('currently away through outstanding lending');

			const committedInsight = insights.find((i) => i.id === 'committed-obligations');
			expect(committedInsight).toBeDefined();
			expect(committedInsight?.description).toContain('currently committed through recurring obligations');
		});

		it('handles empty/zero data without producing NaN, Infinity or throwing', () => {
			const emptySnapshot: MoneySnapshotData = {
				moneyOut: 0,
				moneyIn: 0,
				netCashFlow: 0,
				avgDailyDrain: 0,
				transactionCount: 0,
				largestOutflow: null,
				refundsTotal: 0,
				repaymentsTotal: 0,
			};

			const emptyDailyDrain: DailyDrainData = {
				avgDailyDrain: 0,
				highestDrainDay: null,
				lowestDrainDay: null,
				unusuallyHighDays: [],
				dailyOutflows: [],
			};

			const emptyBehavior: SpendingBehaviorData = {
				avgTxSize: 0,
				txFrequencyPerDay: 0,
				mostActiveDayOfWeek: null,
				highestSpendingWeekday: null,
				largestCategory: null,
				largestSingleTx: null,
			};

			const emptyCommitted: CommittedMoneyData = {
				recurringTotal: 0,
				upcomingRecurringTotal: 0,
				borrowedCommittedTotal: 0,
				recurringCategories: [],
				committedPctOfMoneyOut: 0,
			};

			const emptyLending: MoneyAwayData = {
				lent: 0,
				returned: 0,
				outstanding: 0,
				activeLendingCount: 0,
				largestOutstanding: null,
				repaymentRate: 100,
				historicalLent: 0,
			};

			const insights = generateStructuredInsights(
				mockResolution,
				emptySnapshot,
				[],
				emptyDailyDrain,
				emptyBehavior,
				emptyCommitted,
				emptyLending
			);

			expect(Array.isArray(insights)).toBe(true);
			for (const insight of insights) {
				expect(insight.description).not.toContain('NaN');
				expect(insight.description).not.toContain('Infinity');
				expect(insight.description).not.toContain('undefined');
			}
		});
	});
});


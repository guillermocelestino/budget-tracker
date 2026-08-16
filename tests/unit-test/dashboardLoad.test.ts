import { describe, it, expect, beforeAll, vi } from 'vitest';

describe('Dashboard server load edge cases', () => {
	let dashboardLoad: typeof import('../../src/routes/dashboard/+page.server').load;

	beforeAll(async () => {
		vi.doMock('$lib/server/services/transactions', () => ({
			getMonthlySummary: async () => ({ totalIncome: 0, totalExpenses: 0 }),
			getRecentTransactions: async () => [],
			getCategoryReport: async () => [],
			getMonthlyTrends: async () => [
				{ month: '2026-07', income: 0, expense: 0 },
				{ month: '2026-08', income: 5000, expense: 1200 }
			],
			deleteTransaction: async () => true,
			getWreckedToday: async () => 0,
			getDailyOutflows: async () => []
		}));
		vi.doMock('$lib/server/services/networth', () => ({
			computeNetWorth: async () => ({ net: 0, cash: 0, lentToday: 0, borrowedToday: 0, legs: [], deltas: [], cashTrend: [] })
		}));
		vi.doMock('$lib/server/services/recurringScheduler', () => ({
			processRecurringTransactions: async () => 0
		}));
		vi.doMock('$lib/server/services/lendingPayments', () => ({
			getLendingTotals: async () => ({ total: 0, cashPaid: 0, writtenOff: 0, outstanding: 0 }),
			getLendingsWithPayments: async () => []
		}));
		vi.doMock('$lib/server/services/categories', () => ({
			getTotalBudgeted: async () => 0,
			getCategories: async () => []
		}));
		vi.doMock('$lib/server/services/recurringService', () => ({
			getUpcomingRecurring: async () => [],
			getMonthlyCommittedTotal: async () => 0
		}));

		vi.resetModules();
		const mod = await import('../../src/routes/dashboard/+page.server');
		dashboardLoad = mod.load;
	});

	it('handles zero income or zero expense in previous trendData without producing NaN or Infinity', async () => {
		const mockUrl = new URL('http://localhost/dashboard');
		const mockLocals = { user: { userId: 1 } } as any;
		const mockDepends = vi.fn();

		const result = await dashboardLoad({ url: mockUrl, locals: mockLocals, depends: mockDepends });
		console.log('incomeChange:', result.incomeChange);
		console.log('expenseChange:', result.expenseChange);

		expect(Number.isFinite(result.incomeChange)).toBe(true);
		expect(Number.isFinite(result.expenseChange)).toBe(true);
	});
});

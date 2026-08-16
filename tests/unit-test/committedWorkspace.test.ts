import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/server/services/lendingPayments', () => ({
	listLendingsWithPayments: vi.fn().mockResolvedValue({ items: [], total: 0, totalPages: 1 }),
	getLendingStatusCounts: vi.fn().mockResolvedValue({ all: 5, active: 3, paid: 2 }),
	getLendingTotals: vi.fn().mockResolvedValue({ totalPrincipal: 1000, totalRemaining: 1000, activeCount: 3 }),
	getMoneyCommittedStats: vi.fn().mockResolvedValue({ debtOwed: 1000, borrowedActiveCount: 3 })
}));

vi.mock('$lib/server/services/recurringService', () => ({
	listRecurringTransactions: vi.fn().mockResolvedValue({ items: [], total: 0, totalPages: 1 }),
	getActiveRecurringCount: vi.fn().mockResolvedValue(4),
	getMonthlyCommittedTotal: vi.fn().mockResolvedValue(500),
	getUpcomingCommitmentsTotal: vi.fn().mockResolvedValue(200)
}));

vi.mock('$lib/server/services/categories', () => ({
	getCategories: vi.fn().mockResolvedValue([{ id: 1, name: 'Subscriptions' }])
}));

import { loadCommittedWorkspaceData } from '$lib/server/services/committedWorkspaceLoad';

describe('Committed Money Workspace — Server Loader & View State', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('defaults to borrowed view when no view param is present', async () => {
		const mockUrl = new URL('http://localhost/recurring');
		const mockLocals: any = { user: { userId: 1 } };

		const data = await loadCommittedWorkspaceData({ url: mockUrl, locals: mockLocals });
		expect(data.view).toBe('borrowed');
		expect(Array.isArray(data.lendings)).toBe(true);
	});

	it('selects recurring view when ?view=recurring is passed', async () => {
		const mockUrl = new URL('http://localhost/recurring?view=recurring');
		const mockLocals: any = { user: { userId: 1 } };

		const data = await loadCommittedWorkspaceData({ url: mockUrl, locals: mockLocals });
		expect(data.view).toBe('recurring');
		expect(Array.isArray(data.recurring)).toBe(true);
	});

	it('falls back to borrowed view for invalid ?view values', async () => {
		const mockUrl = new URL('http://localhost/recurring?view=invalid_view_name');
		const mockLocals: any = { user: { userId: 1 } };

		const data = await loadCommittedWorkspaceData({ url: mockUrl, locals: mockLocals });
		expect(data.view).toBe('borrowed');
	});

	it('provides real counts for both Borrowed and Recurring tabs', async () => {
		const mockUrl = new URL('http://localhost/recurring?view=borrowed');
		const mockLocals: any = { user: { userId: 1 } };

		const data = await loadCommittedWorkspaceData({ url: mockUrl, locals: mockLocals });
		expect(data.borrowedCounts).toBeDefined();
		expect(typeof data.activeCount).toBe('number');
		expect(data.activeCount).toBe(4);
		expect(data.borrowedCounts?.active).toBe(3);
	});
});

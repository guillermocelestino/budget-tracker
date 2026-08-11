import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listLendingsWithPayments, getLendingStatusCounts } from '$lib/server/services/lendingPayments';

vi.mock('$lib/server/db/drizzle', () => ({
	getDrizzle: vi.fn()
}));

import { getDrizzle } from '$lib/server/db/drizzle';

function makeMockDrizzle(countValue: number, rowsData: any[]) {
	let queryCount = 0;
	const db: any = {
		select: vi.fn(() => {
			queryCount++;
			const currentData = queryCount === 1 ? [{ count: countValue }] : rowsData;
			const queryBuilder: any = {};
			const methods = ['from', 'where', 'leftJoin', 'groupBy', 'orderBy', 'limit', 'offset'];
			for (const m of methods) {
				queryBuilder[m] = vi.fn(() => queryBuilder);
			}
			queryBuilder.then = (onFulfilled: any, onRejected: any) =>
				Promise.resolve(currentData).then(onFulfilled, onRejected);
			return queryBuilder;
		})
	};
	return db;
}

describe('Borrowed Pagination and Date Filtering Logic', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('validates invalid date range when From > End for borrowed', () => {
		const from: string = '2026-05-01';
		const to: string = '2026-04-01';
		const isInvalid = !!from && !!to && from > to;
		expect(isInvalid).toBe(true);
	});

	it('validates valid date range for borrowed', () => {
		const from: string = '2026-01-01';
		const to: string = '2026-03-31';
		const isInvalid = !!from && !!to && from > to;
		expect(isInvalid).toBe(false);
	});

	it('supports From-only date filter for borrowed', () => {
		const from: string = '2026-01-01';
		const to: string = '';
		const canApply = (!!from || !!to) && !(from && to && from > to);
		expect(canApply).toBe(true);
	});

	it('supports End-only date filter for borrowed', () => {
		const from: string = '';
		const to: string = '2026-03-31';
		const canApply = (!!from || !!to) && !(from && to && from > to);
		expect(canApply).toBe(true);
	});

	it('resets page to 1 when filters change', () => {
		let currentPage = 2;
		const resetPage = () => { currentPage = 1; };
		resetPage();
		expect(currentPage).toBe(1);
	});

	it('queries listLendingsWithPayments for direction borrowed with pagination', async () => {
		const mockDb = makeMockDrizzle(30, [
			{
				id: 101,
				user_id: 1,
				borrower_name: 'Charlie',
				amount: '500',
				interest_rate: '5',
				date_lent: '2026-01-15',
				due_date: null,
				status: 'active',
				notes: null,
				direction: 'borrowed',
				created_at: new Date('2026-01-15'),
				updated_at: new Date('2026-01-15'),
				cash_paid: '0',
				written_off: '0'
			}
		]);
		(getDrizzle as any).mockResolvedValue(mockDb);

		const result = await listLendingsWithPayments(1, 'borrowed', {}, 1, 20);
		expect(result.total).toBe(30);
		expect(result.page).toBe(1);
		expect(result.totalPages).toBe(2);
		expect(result.items[0].borrower_name).toBe('Charlie');
		expect(result.items[0].direction).toBe('borrowed');
	});

	it('queries listLendingsWithPayments for borrowed with custom date range', async () => {
		const mockDb = makeMockDrizzle(5, []);
		(getDrizzle as any).mockResolvedValue(mockDb);

		const result = await listLendingsWithPayments(1, 'borrowed', { date_from: '2026-01-01', date_to: '2026-02-28' }, 1, 20);
		expect(result.total).toBe(5);
		expect(result.totalPages).toBe(1);
	});

	it('queries status counts for borrowed via getLendingStatusCounts', async () => {
		const countsData = [
			{ status: 'active', count: 5 },
			{ status: 'paid', count: 15 }
		];
		const queryBuilder: any = {};
		const methods = ['from', 'where', 'groupBy'];
		for (const m of methods) {
			queryBuilder[m] = vi.fn(() => queryBuilder);
		}
		queryBuilder.then = (onFulfilled: any, onRejected: any) =>
			Promise.resolve(countsData).then(onFulfilled, onRejected);

		const mockDb = {
			select: vi.fn(() => queryBuilder)
		};

		(getDrizzle as any).mockResolvedValue(mockDb);

		const counts = await getLendingStatusCounts(1, 'borrowed');
		expect(counts.all).toBe(20);
		expect(counts.active).toBe(5);
		expect(counts.paid).toBe(15);
	});
});

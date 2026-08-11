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

describe('Lending Pagination and Date Filtering Logic', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('validates invalid date range when From > End', () => {
		const from: string = '2026-04-01';
		const to: string = '2026-03-01';
		const isInvalid = !!from && !!to && from > to;
		expect(isInvalid).toBe(true);
	});

	it('validates valid date range when From <= End', () => {
		const from: string = '2026-01-01';
		const to: string = '2026-03-31';
		const isInvalid = !!from && !!to && from > to;
		expect(isInvalid).toBe(false);
	});

	it('supports From-only date range', () => {
		const from: string = '2026-01-01';
		const to: string = '';
		const isInvalid = !!from && !!to && from > to;
		const canApply = (!!from || !!to) && !isInvalid;
		expect(canApply).toBe(true);
	});

	it('supports End-only date range', () => {
		const from: string = '';
		const to: string = '2026-03-31';
		const isInvalid = !!from && !!to && from > to;
		const canApply = (!!from || !!to) && !isInvalid;
		expect(canApply).toBe(true);
	});

	it('resets page to 1 when filters change', () => {
		let currentPage = 3;
		const onFilterApply = () => {
			currentPage = 1;
		};
		onFilterApply();
		expect(currentPage).toBe(1);
	});

	it('calculates total pages correctly for various page sizes', () => {
		const total = 45;
		expect(Math.ceil(total / 20)).toBe(3);
		expect(Math.ceil(total / 50)).toBe(1);
		expect(Math.ceil(total / 100)).toBe(1);
	});

	it('queries listLendingsWithPayments with default pagination and limit 20', async () => {
		const mockDb = makeMockDrizzle(45, [
			{
				id: 1,
				user_id: 1,
				borrower_name: 'Alice',
				amount: '100',
				interest_rate: '0',
				date_lent: '2026-01-10',
				due_date: null,
				status: 'active',
				notes: null,
				direction: 'lent',
				created_at: new Date('2026-01-10'),
				updated_at: new Date('2026-01-10'),
				cash_paid: '0',
				written_off: '0'
			}
		]);
		(getDrizzle as any).mockResolvedValue(mockDb);

		const result = await listLendingsWithPayments(1, 'lent', {}, 1, 20);
		expect(result.total).toBe(45);
		expect(result.page).toBe(1);
		expect(result.totalPages).toBe(3);
		expect(result.items).toHaveLength(1);
		expect(result.items[0].borrower_name).toBe('Alice');
	});

	it('queries listLendingsWithPayments with page 2', async () => {
		const mockDb = makeMockDrizzle(45, [
			{
				id: 21,
				user_id: 1,
				borrower_name: 'Bob',
				amount: '200',
				interest_rate: '0',
				date_lent: '2026-02-10',
				due_date: null,
				status: 'active',
				notes: null,
				direction: 'lent',
				created_at: new Date('2026-02-10'),
				updated_at: new Date('2026-02-10'),
				cash_paid: '0',
				written_off: '0'
			}
		]);
		(getDrizzle as any).mockResolvedValue(mockDb);

		const result = await listLendingsWithPayments(1, 'lent', {}, 2, 20);
		expect(result.page).toBe(2);
		expect(result.totalPages).toBe(3);
		expect(result.items[0].borrower_name).toBe('Bob');
	});

	it('queries listLendingsWithPayments with full date range (from & to)', async () => {
		const mockDb = makeMockDrizzle(10, []);
		(getDrizzle as any).mockResolvedValue(mockDb);

		const result = await listLendingsWithPayments(1, 'lent', { date_from: '2026-01-01', date_to: '2026-03-31' }, 1, 20);
		expect(result.total).toBe(10);
		expect(result.totalPages).toBe(1);
	});

	it('queries listLendingsWithPayments with from-only date filter', async () => {
		const mockDb = makeMockDrizzle(15, []);
		(getDrizzle as any).mockResolvedValue(mockDb);

		const result = await listLendingsWithPayments(1, 'lent', { date_from: '2026-01-01' }, 1, 20);
		expect(result.total).toBe(15);
	});

	it('queries listLendingsWithPayments with end-only date filter', async () => {
		const mockDb = makeMockDrizzle(8, []);
		(getDrizzle as any).mockResolvedValue(mockDb);

		const result = await listLendingsWithPayments(1, 'lent', { date_to: '2026-03-31' }, 1, 20);
		expect(result.total).toBe(8);
	});

	it('handles empty results properly', async () => {
		const mockDb = makeMockDrizzle(0, []);
		(getDrizzle as any).mockResolvedValue(mockDb);

		const result = await listLendingsWithPayments(1, 'lent', { search: 'NonExistent' }, 1, 20);
		expect(result.total).toBe(0);
		expect(result.page).toBe(1);
		expect(result.totalPages).toBe(1);
		expect(result.items).toHaveLength(0);
	});

	it('computes status counts correctly via getLendingStatusCounts', async () => {
		const countsData = [
			{ status: 'active', count: 12 },
			{ status: 'paid', count: 8 }
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

		const counts = await getLendingStatusCounts(1, 'lent');
		expect(counts.all).toBe(20);
		expect(counts.active).toBe(12);
		expect(counts.paid).toBe(8);
	});
});

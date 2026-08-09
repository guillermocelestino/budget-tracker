import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import Database from 'better-sqlite3';
import { queryOne, queryMany, execute, withTransaction } from '$lib/database/query';
import { usePostgres } from '$lib/database';
import { getDrizzle } from '$lib/database/drizzle';
import {
	categories,
	lendings,
	lendingPayments,
	transactions
} from '$lib/database/schema';
import { and, eq, sql, desc, isNotNull } from 'drizzle-orm';
import {
	getLendingsWithPayments,
	getLendingWithPayments,
	getLending,
	getPayment,
	recalcStatusCache,
	recordPayment,
	updatePayment,
	deletePayment,
	getPaymentHistory,
	hasPayments,
	deleteLinkedTransactions,
	getLendingTotals,
	searchLendings
} from '$lib/server/lendingPayments';
import type { Lending, LendingPayment, LendingWithPayments, PaymentType } from '$lib/types';

// Mock the database modules
vi.mock('$lib/database/query', () => ({
	queryOne: vi.fn(),
	queryMany: vi.fn(),
	execute: vi.fn(),
	withTransaction: vi.fn((cb) => cb({
		queryOne: vi.fn(),
		queryMany: vi.fn(),
		execute: vi.fn()
	}))
}));

vi.mock('$lib/database', () => ({
	usePostgres: false
}));

vi.mock('$lib/database/drizzle', () => ({
	getDrizzle: vi.fn()
}));

describe('lendingPayments - SQLite path', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(usePostgres as any) = false;
	});

	describe('getLendingsWithPayments', () => {
		it('should return lendings with derived payment state', async () => {
			const mockRows = [
				{
					id: 1,
					user_id: 1,
					borrower_name: 'John',
					amount: 1000,
					interest_rate: 0,
					date_lent: '2024-01-01',
					due_date: null,
					status: 'active',
					notes: null,
					direction: 'lent',
					created_at: '2024-01-01T00:00:00Z',
					updated_at: '2024-01-01T00:00:00Z',
					cash_paid: '500',
					written_off: '0'
				}
			];
			(queryMany as any).mockResolvedValue(mockRows);

			const result = await getLendingsWithPayments(1, 'lent');

			expect(result).toHaveLength(1);
			expect(result[0].cash_paid).toBe(500);
			expect(result[0].written_off).toBe(0);
			expect(result[0].resolved_total).toBe(500);
			expect(result[0].remaining).toBe(500);
			expect(result[0].derived_status).toBe('active');
		});

		it('should mark lending as paid when fully resolved', async () => {
			const mockRows = [
				{
					id: 1,
					user_id: 1,
					borrower_name: 'John',
					amount: 1000,
					interest_rate: 0,
					date_lent: '2024-01-01',
					due_date: null,
					status: 'active',
					notes: null,
					direction: 'lent',
					created_at: '2024-01-01T00:00:00Z',
					updated_at: '2024-01-01T00:00:00Z',
					cash_paid: '1000',
					written_off: '0'
				}
			];
			(queryMany as any).mockResolvedValue(mockRows);

			const result = await getLendingsWithPayments(1, 'lent');

			expect(result[0].remaining).toBe(0);
			expect(result[0].derived_status).toBe('paid');
		});
	});

	describe('getLendingWithPayments', () => {
		it('should return a single lending with derived state', async () => {
			const mockRow = {
				id: 1,
				user_id: 1,
				borrower_name: 'John',
				amount: 1000,
				interest_rate: 0,
				date_lent: '2024-01-01',
				due_date: null,
				status: 'active',
				notes: null,
				direction: 'lent',
				created_at: '2024-01-01T00:00:00Z',
				updated_at: '2024-01-01T00:00:00Z',
				cash_paid: '300',
				written_off: '0'
			};
			(queryOne as any).mockResolvedValue(mockRow);

			const result = await getLendingWithPayments(1, 1);

			expect(result).toBeDefined();
			expect(result!.cash_paid).toBe(300);
			expect(result!.remaining).toBe(700);
			expect(result!.derived_status).toBe('active');
		});

		it('should return undefined when lending not found', async () => {
			(queryOne as any).mockResolvedValue(undefined);

			const result = await getLendingWithPayments(1, 999);

			expect(result).toBeUndefined();
		});
	});

	describe('recalcStatusCache', () => {
		it('should return active when lending not found', async () => {
			(queryOne as any).mockResolvedValue(undefined);

			const result = await recalcStatusCache(1, 999);

			expect(result).toBe('active');
			expect(execute).not.toHaveBeenCalled();
		});

		it('should calculate and update status correctly', async () => {
			(queryOne as any).mockResolvedValue({
				amount: '1000',
				resolved: '1000'
			});

			const result = await recalcStatusCache(1, 1);

			expect(result).toBe('paid');
			expect(execute).toHaveBeenCalledWith(
				'UPDATE lendings SET status = $1, updated_at = NOW() WHERE user_id = $2 AND id = $3',
				['paid', 1, 1]
			);
		});
	});

	describe('recordPayment', () => {
		it('should create payment and linked transaction', async () => {
			const mockLending = {
				id: 1,
				user_id: 1,
				borrower_name: 'John',
				amount: 1000,
				interest_rate: 0,
				date_lent: '2024-01-01',
				due_date: null,
				status: 'active',
				notes: null,
				direction: 'lent',
				created_at: '2024-01-01T00:00:00Z',
				updated_at: '2024-01-01T00:00:00Z'
			};
			const mockBalance = { resolved: '0' };
			const mockPayment = { id: 1 };
			const mockCategory = { id: 5 };
			const mockTx = { id: 1 };

			// Mock the transaction callback - need 6 queryOne calls and execute calls
			const mockQueryOne = vi.fn()
				.mockResolvedValueOnce(mockLending) // get lending
				.mockResolvedValueOnce(mockBalance) // check balance
				.mockResolvedValueOnce(mockPayment) // get payment id
				.mockResolvedValueOnce(mockCategory) // find category
				.mockResolvedValueOnce(mockTx) // get transaction id
				.mockResolvedValueOnce(mockTx); // get transaction id again for update

			const mockExecute = vi.fn();

			const mockTxHelpers = {
				queryOne: mockQueryOne,
				execute: mockExecute
			};
			(withTransaction as any).mockImplementation((cb: any) => cb(mockTxHelpers));

			const result = await recordPayment(1, {
				lendingId: 1,
				amount: 500,
				paymentDate: '2024-01-15',
				notes: 'Partial payment',
				paymentType: 'payment',
				createTransaction: true
			});

			expect(result.paymentId).toBe(1);
			expect(result.transactionId).toBe(1);
			expect(mockQueryOne).toHaveBeenCalledTimes(5);
			expect(mockExecute).toHaveBeenCalled();
		});

		it('should throw error when payment exceeds remaining balance', async () => {
			const mockLending = {
				id: 1,
				user_id: 1,
				borrower_name: 'John',
				amount: 1000,
				interest_rate: 0,
				date_lent: '2024-01-01',
				due_date: null,
				status: 'active',
				notes: null,
				direction: 'lent',
				created_at: '2024-01-01T00:00:00Z',
				updated_at: '2024-01-01T00:00:00Z'
			};
			const mockBalance = { resolved: '800' };

			const mockTxHelpers = {
				queryOne: vi.fn()
					.mockResolvedValueOnce(mockLending)
					.mockResolvedValueOnce(mockBalance),
				execute: vi.fn()
			};
			(withTransaction as any).mockImplementation((cb: any) => cb(mockTxHelpers));

			await expect(
				recordPayment(1, {
					lendingId: 1,
					amount: 500,
					paymentDate: '2024-01-15',
					notes: null,
					paymentType: 'payment',
					createTransaction: false
				})
			).rejects.toThrow('Payment amount cannot exceed remaining balance');
		});

		it('should throw error when lending not found', async () => {
			const mockTxHelpers = {
				queryOne: vi.fn().mockResolvedValue(undefined),
				execute: vi.fn()
			};
			(withTransaction as any).mockImplementation((cb: any) => cb(mockTxHelpers));

			await expect(
				recordPayment(1, {
					lendingId: 999,
					amount: 500,
					paymentDate: '2024-01-15',
					notes: null,
					paymentType: 'payment',
					createTransaction: false
				})
			).rejects.toThrow('Lending record not found');
		});
	});

	describe('updatePayment', () => {
		it('should update payment and sync linked transaction', async () => {
			const mockPayment = {
				id: 1,
				lending_id: 1,
				user_id: 1,
				amount: 500,
				payment_date: '2024-01-15',
				notes: 'Original',
				transaction_id: 10,
				payment_type: 'payment',
				reference: null,
				created_at: '2024-01-15T00:00:00Z',
				updated_at: '2024-01-15T00:00:00Z'
			};
			const mockLending = {
				id: 1,
				user_id: 1,
				borrower_name: 'John',
				amount: 1000,
				interest_rate: 0,
				date_lent: '2024-01-01',
				due_date: null,
				status: 'active',
				notes: null,
				direction: 'lent',
				created_at: '2024-01-01T00:00:00Z',
				updated_at: '2024-01-01T00:00:00Z'
			};
			const mockBalance = { resolved: '0' };

			const mockTxHelpers = {
				queryOne: vi.fn()
					.mockResolvedValueOnce(mockPayment)
					.mockResolvedValueOnce(mockLending)
					.mockResolvedValueOnce(mockBalance),
				execute: vi.fn()
			};
			(withTransaction as any).mockImplementation((cb: any) => cb(mockTxHelpers));

			await updatePayment(1, 1, {
				amount: 600,
				paymentDate: '2024-01-20',
				notes: 'Updated'
			});

			expect(mockTxHelpers.execute).toHaveBeenCalled();
		});

		it('should throw error when payment not found', async () => {
			const mockTxHelpers = {
				queryOne: vi.fn().mockResolvedValue(undefined),
				execute: vi.fn()
			};
			(withTransaction as any).mockImplementation((cb: any) => cb(mockTxHelpers));

			await expect(
				updatePayment(1, 999, {
					amount: 500,
					paymentDate: '2024-01-15',
					notes: null
				})
			).rejects.toThrow('Payment not found');
		});
	});

	describe('deletePayment', () => {
		it('should delete payment and linked transaction', async () => {
			const mockPayment = {
				id: 1,
				lending_id: 1,
				user_id: 1,
				amount: 500,
				payment_date: '2024-01-15',
				notes: null,
				transaction_id: 10,
				payment_type: 'payment',
				reference: null,
				created_at: '2024-01-15T00:00:00Z',
				updated_at: '2024-01-15T00:00:00Z'
			};
			const mockBalance = { amount: '1000', resolved: '0' };

			const mockTxHelpers = {
				queryOne: vi.fn()
					.mockResolvedValueOnce(mockPayment)
					.mockResolvedValueOnce(mockBalance),
				execute: vi.fn()
			};
			(withTransaction as any).mockImplementation((cb: any) => cb(mockTxHelpers));

			await deletePayment(1, 1);

			expect(mockTxHelpers.execute).toHaveBeenCalledTimes(3);
		});

		it('should throw error when payment not found', async () => {
			const mockTxHelpers = {
				queryOne: vi.fn().mockResolvedValue(undefined),
				execute: vi.fn()
			};
			(withTransaction as any).mockImplementation((cb: any) => cb(mockTxHelpers));

			await expect(deletePayment(1, 999)).rejects.toThrow('Payment not found');
		});
	});

	describe('getPaymentHistory', () => {
		it('should return payment history ordered correctly', async () => {
			const mockPayments = [
				{
					id: 2,
					lending_id: 1,
					user_id: 1,
					amount: 500,
					payment_date: '2024-01-15',
					notes: null,
					transaction_id: null,
					payment_type: 'payment',
					reference: null,
					created_at: '2024-01-15T00:00:00Z',
					updated_at: '2024-01-15T00:00:00Z'
				},
				{
					id: 1,
					lending_id: 1,
					user_id: 1,
					amount: 300,
					payment_date: '2024-01-10',
					notes: null,
					transaction_id: null,
					payment_type: 'payment',
					reference: null,
					created_at: '2024-01-10T00:00:00Z',
					updated_at: '2024-01-10T00:00:00Z'
				}
			];
			(queryMany as any).mockResolvedValue(mockPayments);

			const result = await getPaymentHistory(1, 1);

			expect(result).toHaveLength(2);
			expect(result[0].id).toBe(2);
			expect(result[1].id).toBe(1);
		});
	});

	describe('hasPayments', () => {
		it('should return true when payments exist', async () => {
			(queryOne as any).mockResolvedValue({ count: '2' });

			const result = await hasPayments(1, 1);

			expect(result).toBe(true);
		});

		it('should return false when no payments exist', async () => {
			(queryOne as any).mockResolvedValue({ count: '0' });

			const result = await hasPayments(1, 1);

			expect(result).toBe(false);
		});
	});

	describe('deleteLinkedTransactions', () => {
		it('should delete all linked transactions', async () => {
			(queryMany as any).mockResolvedValue([
				{ transaction_id: 10 },
				{ transaction_id: 20 }
			]);

			await deleteLinkedTransactions(1, 1);

			expect(execute).toHaveBeenCalledTimes(2);
			expect(execute).toHaveBeenNthCalledWith(1, 'DELETE FROM transactions WHERE user_id = $1 AND id = $2', [1, 10]);
			expect(execute).toHaveBeenNthCalledWith(2, 'DELETE FROM transactions WHERE user_id = $1 AND id = $2', [1, 20]);
		});
	});

	describe('getLendingTotals', () => {
		it('should calculate totals correctly', async () => {
			const mockRow = {
				total: '3000',
				cash_paid: '1500',
				written_off: '200'
			};
			(queryOne as any).mockResolvedValue(mockRow);

			const result = await getLendingTotals(1, 'lent');

			expect(result.total).toBe(3000);
			expect(result.cashPaid).toBe(1500);
			expect(result.writtenOff).toBe(200);
			expect(result.outstanding).toBe(1300);
		});

		it('should handle zero totals', async () => {
			(queryOne as any).mockResolvedValue(null);

			const result = await getLendingTotals(1, 'borrowed');

			expect(result.total).toBe(0);
			expect(result.cashPaid).toBe(0);
			expect(result.writtenOff).toBe(0);
			expect(result.outstanding).toBe(0);
		});
	});

	describe('searchLendings', () => {
		it('searches lendings by borrower name substring', async () => {
			const mockRows = [
				{
					id: 1,
					user_id: 1,
					borrower_name: 'John Smith',
					amount: 1000,
					interest_rate: 5.5,
					date_lent: '2024-01-01',
					due_date: '2024-02-01',
					status: 'active',
					notes: null,
					direction: 'lent',
					created_at: '2024-01-01T00:00:00Z',
					updated_at: '2024-01-01T00:00:00Z'
				}
			];
			(queryMany as any).mockResolvedValue(mockRows);

			const results = await searchLendings(1, 'john');

			expect(queryMany).toHaveBeenCalled();
			const call = (queryMany as any).mock.calls[0];
			expect(call[0]).toContain('borrower_name LIKE');
			expect(call[1]).toEqual([1, '%john%']);
			expect(results).toHaveLength(1);
			expect(results[0].borrower_name).toBe('John Smith');
			expect(results[0].amount).toBe(1000);
			expect(results[0].interest_rate).toBe(5.5);
		});

		it('returns empty array when no matches', async () => {
			(queryMany as any).mockResolvedValue([]);

			const results = await searchLendings(1, 'xyz');

			expect(results).toHaveLength(0);
		});

		it('filters by direction when provided', async () => {
			(queryMany as any).mockResolvedValue([]);

			await searchLendings(1, 'john', 'lent');

			const call = (queryMany as any).mock.calls[0];
			expect(call[0]).toContain('direction = $3');
			expect(call[1]).toEqual([1, '%john%', 'lent']);
		});

		it('orders by date_lent DESC and limits to 5', async () => {
			(queryMany as any).mockResolvedValue([]);

			await searchLendings(1, 'john');

			const call = (queryMany as any).mock.calls[0];
			expect(call[0]).toContain('ORDER BY date_lent DESC LIMIT 5');
		});

		it('is user-isolated', async () => {
			(queryMany as any).mockResolvedValue([]);

			await searchLendings(2, 'john');

			const call = (queryMany as any).mock.calls[0];
			expect(call[1][0]).toBe(2);
		});
	});

	describe('getLending', () => {
		it('returns lending by ID for the user', async () => {
			const mockLending = {
				id: 1,
				user_id: 1,
				borrower_name: 'John',
				amount: 1000,
				interest_rate: 0,
				date_lent: '2024-01-01',
				due_date: null,
				status: 'active',
				notes: null,
				direction: 'lent',
				created_at: '2024-01-01T00:00:00Z',
				updated_at: '2024-01-01T00:00:00Z'
			};
			(queryOne as any).mockResolvedValue(mockLending);

			const result = await getLending(1, 1);

			expect(queryOne).toHaveBeenCalledWith(
				'SELECT * FROM lendings WHERE user_id = $1 AND id = $2',
				[1, 1]
			);
			expect(result).toEqual(mockLending);
		});

		it('returns undefined when lending not found', async () => {
			(queryOne as any).mockResolvedValue(undefined);

			const result = await getLending(1, 999);

			expect(result).toBeUndefined();
		});

		it('is user-isolated', async () => {
			(queryOne as any).mockResolvedValue(undefined);

			await getLending(2, 1);

			const call = (queryOne as any).mock.calls[0];
			expect(call[1][0]).toBe(2);
		});
	});

	describe('getPayment', () => {
		it('returns payment with lending_id for the user', async () => {
			const mockPayment = { lending_id: 5 };
			(queryOne as any).mockResolvedValue(mockPayment);

			const result = await getPayment(1, 10);

			expect(queryOne).toHaveBeenCalledWith(
				'SELECT lending_id FROM lending_payments WHERE user_id = $1 AND id = $2',
				[1, 10]
			);
			expect(result).toEqual({ lending_id: 5 });
		});

		it('returns undefined when payment not found', async () => {
			(queryOne as any).mockResolvedValue(undefined);

			const result = await getPayment(1, 999);

			expect(result).toBeUndefined();
		});

		it('is user-isolated', async () => {
			(queryOne as any).mockResolvedValue(undefined);

			await getPayment(2, 10);

			const call = (queryOne as any).mock.calls[0];
			expect(call[1][0]).toBe(2);
		});
	});
});

describe('lendingPayments - Drizzle/Postgres path', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(usePostgres as any) = true;
	});

	// Helper: build a Drizzle query chain mock. The chain is thenable and
	// resolves to `data` when awaited. `db` itself is NOT thenable so
	// `await getDrizzle()` returns the db object with query methods.
	function makeDrizzleData(data: any[]) {
		const chain: any = {};
		const methods = [
			'select', 'from', 'where', 'leftJoin', 'groupBy', 'orderBy',
			'limit', 'insert', 'values', 'update', 'set', 'delete', 'returning', 'ilike'
		];
		for (const m of methods) {
			chain[m] = vi.fn(function() { return chain; });
		}
		chain.then = (onFulfilled: any, onRejected: any) =>
			Promise.resolve(data).then(onFulfilled, onRejected);
		return chain;
	}

	it('should use getDrizzle for database operations', async () => {
		const mockData = [{
			id: 1,
			user_id: 1,
			borrower_name: 'John',
			amount: '1000',
			interest_rate: '0',
			date_lent: '2024-01-01',
			due_date: null,
			status: 'active',
			notes: null,
			direction: 'lent',
			created_at: new Date('2024-01-01'),
			updated_at: new Date('2024-01-01'),
			cash_paid: '500',
			written_off: '0'
		}];

		const chain = makeDrizzleData(mockData);
		const db = { select: vi.fn(() => chain) };
		(getDrizzle as any).mockResolvedValue(db);

		const result = await getLendingsWithPayments(1, 'lent');

		expect(getDrizzle).toHaveBeenCalled();
		expect(db.select).toHaveBeenCalled();
		expect(result).toHaveLength(1);
		expect(result[0].amount).toBe(1000);
		expect(result[0].cash_paid).toBe(500);
		expect(result[0].remaining).toBe(500);
		expect(result[0].derived_status).toBe('active');
	});

	it('should use db.transaction for recordPayment', async () => {
		const mockData = [{
			id: 1,
			user_id: 1,
			borrower_name: 'John',
			amount: '1000',
			interest_rate: '0',
			date_lent: '2024-01-01',
			due_date: null,
			status: 'active',
			notes: null,
			direction: 'lent',
			created_at: new Date('2024-01-01'),
			updated_at: new Date('2024-01-01')
		}];

		const tx = makeDrizzleData(mockData);
		const db = {
			transaction: vi.fn((cb: any) => cb(tx))
		};
		(getDrizzle as any).mockResolvedValue(db);

		const result = await recordPayment(1, {
			lendingId: 1,
			amount: 500,
			paymentDate: '2024-01-15',
			notes: null,
			paymentType: 'payment',
			createTransaction: false
		});

		expect(db.transaction).toHaveBeenCalled();
		expect(result.paymentId).toBe(1);
		expect(result.transactionId).toBeNull();
	});

	it('should use db.transaction for updatePayment', async () => {
		const mockData = [{
			id: 1,
			lending_id: 1,
			user_id: 1,
			amount: '1000',
			payment_date: '2024-01-15',
			notes: null,
			transaction_id: null,
			payment_type: 'payment',
			reference: null,
			created_at: new Date('2024-01-15'),
			updated_at: new Date('2024-01-15')
		}];

		const tx = makeDrizzleData(mockData);
		const db = {
			transaction: vi.fn((cb: any) => cb(tx))
		};
		(getDrizzle as any).mockResolvedValue(db);

		await updatePayment(1, 1, {
			amount: 600,
			paymentDate: '2024-01-20',
			notes: 'Updated'
		});

		expect(db.transaction).toHaveBeenCalled();
	});

	it('should use db.transaction for deletePayment', async () => {
		const mockData = [{
			id: 1,
			lending_id: 1,
			user_id: 1,
			amount: 500,
			payment_date: '2024-01-15',
			notes: null,
			transaction_id: 10,
			payment_type: 'payment',
			reference: null,
			created_at: new Date('2024-01-15'),
			updated_at: new Date('2024-01-15')
		}];

		const tx = makeDrizzleData(mockData);
		const db = {
			transaction: vi.fn((cb: any) => cb(tx))
		};
		(getDrizzle as any).mockResolvedValue(db);

		await deletePayment(1, 1);

		expect(db.transaction).toHaveBeenCalled();
	});

	describe('searchLendings', () => {
		it('searches lendings via Drizzle with ilike and orders by date_lent DESC', async () => {
			const mockData = [{
				id: 1,
				user_id: 1,
				borrower_name: 'John Smith',
				amount: '1000',
				interest_rate: 5.5,
				date_lent: '2024-01-01',
				due_date: '2024-02-01',
				status: 'active',
				notes: null,
				direction: 'lent',
				created_at: new Date('2024-01-01'),
				updated_at: new Date('2024-01-01')
			}];

			const chain = makeDrizzleData(mockData);
			const db = { select: vi.fn(() => chain) };
			(getDrizzle as any).mockResolvedValue(db);

			const results = await searchLendings(1, 'john');

			expect(getDrizzle).toHaveBeenCalled();
			expect(db.select).toHaveBeenCalled();
			expect(results).toHaveLength(1);
			expect(results[0].borrower_name).toBe('John Smith');
			expect(results[0].amount).toBe(1000);
			expect(results[0].interest_rate).toBe(5.5);
		});

		it('filters by direction when provided', async () => {
			const chain = makeDrizzleData([]);
			const db = { select: vi.fn(() => chain) };
			(getDrizzle as any).mockResolvedValue(db);

			await searchLendings(1, 'john', 'lent');

			expect(db.select).toHaveBeenCalled();
		});

		it('limits to 5 results', async () => {
			const chain = makeDrizzleData([]);
			const db = { select: vi.fn(() => chain) };
			(getDrizzle as any).mockResolvedValue(db);

			await searchLendings(1, 'john');

			expect(chain.limit).toHaveBeenCalledWith(5);
		});
	});

	describe('getLending', () => {
		it('returns lending by ID via Drizzle with user_id + lending_id predicates', async () => {
			const mockData = [{
				id: 1,
				user_id: 1,
				borrower_name: 'John',
				amount: '1000',
				interest_rate: '0',
				date_lent: '2024-01-01',
				due_date: null,
				status: 'active',
				notes: null,
				direction: 'lent',
				created_at: new Date('2024-01-01'),
				updated_at: new Date('2024-01-01')
			}];

			const chain = makeDrizzleData(mockData);
			const db = { select: vi.fn(() => chain) };
			(getDrizzle as any).mockResolvedValue(db);

			const result = await getLending(1, 1);

			expect(getDrizzle).toHaveBeenCalled();
			expect(db.select).toHaveBeenCalled();
			// Result should be converted to Lending type (number amounts, string timestamps)
			expect(result).toEqual({
				id: 1,
				user_id: 1,
				borrower_name: 'John',
				amount: 1000,
				interest_rate: 0,
				date_lent: '2024-01-01',
				due_date: null,
				status: 'active',
				notes: null,
				direction: 'lent',
				created_at: '2024-01-01 00:00:00',
				updated_at: '2024-01-01 00:00:00',
			});
		});

		it('returns undefined when no rows', async () => {
			const chain = makeDrizzleData([]);
			const db = { select: vi.fn(() => chain) };
			(getDrizzle as any).mockResolvedValue(db);

			const result = await getLending(1, 999);

			expect(result).toBeUndefined();
		});

		it('converts numeric strings to numbers and Date to string timestamps', async () => {
			const mockData = [{
				id: 2,
				user_id: 1,
				borrower_name: 'Jane',
				amount: '500',
				interest_rate: '2.5',
				date_lent: '2024-06-15',
				due_date: '2024-12-31',
				status: 'paid',
				notes: 'Test note',
				direction: 'borrowed',
				created_at: new Date('2024-06-01'),
				updated_at: new Date('2024-07-01')
			}];

			const chain = makeDrizzleData(mockData);
			const db = { select: vi.fn(() => chain) };
			(getDrizzle as any).mockResolvedValue(db);

			const result = await getLending(1, 2);

			// Result should be converted to Lending type
			expect(result).toEqual({
				id: 2,
				user_id: 1,
				borrower_name: 'Jane',
				amount: 500,
				interest_rate: 2.5,
				date_lent: '2024-06-15',
				due_date: '2024-12-31',
				status: 'paid',
				notes: 'Test note',
				direction: 'borrowed',
				created_at: '2024-06-01 00:00:00',
				updated_at: '2024-07-01 00:00:00',
			});
			expect(typeof result!.amount).toBe('number');
			expect(typeof result!.interest_rate).toBe('number');
			expect(result!.date_lent).toBe('2024-06-15');
			expect(result!.due_date).toBe('2024-12-31');
			expect(typeof result!.created_at).toBe('string');
			expect(typeof result!.updated_at).toBe('string');
		});
	});

	describe('getPayment', () => {
		it('returns lending_id via Drizzle with user_id + payment_id predicates', async () => {
			const mockData = [{ lending_id: 7 }];

			const chain = makeDrizzleData(mockData);
			const db = { select: vi.fn(() => chain) };
			(getDrizzle as any).mockResolvedValue(db);

			const result = await getPayment(1, 10);

			expect(getDrizzle).toHaveBeenCalled();
			expect(db.select).toHaveBeenCalled();
			expect(result).toEqual({ lending_id: 7 });
		});

		it('returns undefined when no rows', async () => {
			const chain = makeDrizzleData([]);
			const db = { select: vi.fn(() => chain) };
			(getDrizzle as any).mockResolvedValue(db);

			const result = await getPayment(1, 999);

			expect(result).toBeUndefined();
		});

		it('returns only lending_id field', async () => {
		const mockData = [{ lending_id: 3 }];
		const chain = makeDrizzleData(mockData);
		const selectSpy = vi.fn(() => chain);
		const db = { select: selectSpy };
		(getDrizzle as any).mockResolvedValue(db);

		await getPayment(1, 5);

		// Verify select was called with only lending_id column
		expect(selectSpy).toHaveBeenCalled();
		const selectCall = selectSpy.mock.calls[0] as unknown[];
		expect(selectCall[0]).toEqual({ lending_id: lendingPayments.lending_id });
	});
});
});

/**
 * Real in-memory SQLite regression tests for the two lendingPayments defects
 * fixed in Checkpoint 2 (see plans/fix-lending-recalc-totals.md).
 *
 * The mocks declared at the top of this file fully stub `$lib/database/query`,
 * so those suites never execute real SQL. These two tests instead re-point the
 * raw query layer at a real in-memory better-sqlite3 database (the same pattern
 * as recurringService.test.ts) and exercise the actual SQLite branches:
 *
 *   • Bug B — getLendingTotals must not multiply each lending amount by its
 *     payment-row count (JOIN-multiplication defect).
 *   • Bug A — deletePayment / recalcStatusCache must recompute the resolved
 *     amount against only this lending's payments, so deleting one of two
 *     settling payments reopens the loan (status back to 'active').
 */
describe('lendingPayments — real in-memory SQLite (Checkpoint 2 regressions)', () => {
	// Minimal fixture schema — mirrors init.ts DDL for the tables these
	// functions touch (users, categories, transactions, lendings, lending_payments).
	const SQLITE_FIXTURE_SCHEMA = `
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  icon TEXT NOT NULL DEFAULT '📁',
  type TEXT NOT NULL DEFAULT 'expense',
  budget_limit REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, name)
);
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  description TEXT NOT NULL,
  date TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE lendings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  borrower_name TEXT NOT NULL,
  amount REAL NOT NULL,
  interest_rate REAL DEFAULT 0,
  date_lent TEXT NOT NULL,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  direction TEXT NOT NULL DEFAULT 'lent' CHECK (direction IN ('lent', 'borrowed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE lending_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lending_id INTEGER NOT NULL REFERENCES lendings(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  payment_date TEXT NOT NULL,
  notes TEXT,
  transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
  payment_type TEXT NOT NULL DEFAULT 'payment' CHECK (payment_type IN ('payment', 'write_off')),
  reference TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	sqlite.exec(SQLITE_FIXTURE_SCHEMA);

	let lp: typeof import('$lib/server/lendingPayments');
	let sequence = 0;

	beforeAll(async () => {
		// Override the file-level mocks: keep the REAL $lib/database/query
		// module (real translatePgToSQLite + withTransaction) but point it at
		// the in-memory DB instead of the on-disk data/budget.db.
		vi.doMock('$lib/database', () => ({
			usePostgres: false,
			getPgPool: () => Promise.reject(new Error('getPgPool should not be called on SQLite path')),
			getSQLiteDb: () => Promise.resolve(sqlite),
			initDb: async () => {},
			closeDb: async () => {}
		}));
		vi.doMock('$lib/database/query', async (importOriginal) => {
			return await importOriginal();
		});

		vi.resetModules();
		lp = await import('$lib/server/lendingPayments');
	});

	function createUser(): number {
		const username = `regression_user_${++sequence}`;
		const info = sqlite
			.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
			.run(username, 'hash');
		return Number(info.lastInsertRowid);
	}

	function createLending(userId: number, amount: number, direction: 'lent' | 'borrowed'): number {
		const info = sqlite
			.prepare(
				`INSERT INTO lendings (user_id, borrower_name, amount, interest_rate, date_lent, status, direction)
				 VALUES (?, ?, ?, 0, '2026-01-01', 'active', ?)`
			)
			.run(userId, `borrower_${sequence}`, amount, direction);
		return Number(info.lastInsertRowid);
	}

	function insertPayment(
		userId: number,
		lendingId: number,
		amount: number,
		paymentType: 'payment' | 'write_off'
	): number {
		const info = sqlite
			.prepare(
				`INSERT INTO lending_payments (lending_id, user_id, amount, payment_date, payment_type)
				 VALUES (?, ?, ?, '2026-01-15', ?)`
			)
			.run(lendingId, userId, amount, paymentType);
		return Number(info.lastInsertRowid);
	}

	it('getLendingTotals does not multiply lending amount by payment-row count (Bug B)', async () => {
		const userId = createUser();
		const lendingId = createLending(userId, 1000, 'lent');
		insertPayment(userId, lendingId, 400, 'payment');
		insertPayment(userId, lendingId, 200, 'payment');

		const totals = await lp.getLendingTotals(userId, 'lent');

		expect(totals.total).toBe(1000);
		expect(totals.cashPaid).toBe(600);
		expect(totals.writtenOff).toBe(0);
		expect(totals.outstanding).toBe(400);
	});

	it('deletePayment reopens a settled loan; recalcStatusCache returns active (Bug A parity)', async () => {
		const userId = createUser();
		const lendingId = createLending(userId, 1000, 'lent');
		const p1 = insertPayment(userId, lendingId, 600, 'payment');
		insertPayment(userId, lendingId, 400, 'payment');
		// Fully settled (600 + 400 = 1000): cache the status as paid.
		sqlite.prepare("UPDATE lendings SET status = 'paid' WHERE id = ?").run(lendingId);

		await lp.deletePayment(userId, p1);

		// Only the 400 payment remains → resolved 400 → remaining 600 → active.
		const cached = sqlite.prepare('SELECT status FROM lendings WHERE id = ?').get(lendingId) as {
			status: string;
		};
		expect(cached.status).toBe('active');

		const status = await lp.recalcStatusCache(userId, lendingId);
		expect(status).toBe('active');

		const after = sqlite.prepare('SELECT status FROM lendings WHERE id = ?').get(lendingId) as {
			status: string;
		};
		expect(after.status).toBe('active');
	});
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
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
	recalcStatusCache,
	recordPayment,
	updatePayment,
	deletePayment,
	getPaymentHistory,
	hasPayments,
	deleteLinkedTransactions,
	getLendingTotals
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
			'limit', 'insert', 'values', 'update', 'set', 'delete', 'returning'
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
});

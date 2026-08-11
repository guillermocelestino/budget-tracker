import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDrizzle } from '$lib/server/db/drizzle';
import { lendingPayments } from '$lib/server/db/schema';
import {
	getLendingsWithPayments,
	getLending,
	getPayment,
	recordPayment,
	updatePayment,
	deletePayment,
	searchLendings
} from '$lib/server/services/lendingPayments';

// Mock the database modules
vi.mock('$lib/server/db/query', () => ({
	queryOne: vi.fn(),
	queryMany: vi.fn(),
	execute: vi.fn(),
	withTransaction: vi.fn((cb) => cb({
		queryOne: vi.fn(),
		queryMany: vi.fn(),
		execute: vi.fn()
	}))
}));

vi.mock('$lib/server/db/drizzle', () => ({
	getDrizzle: vi.fn()
}));

describe('lendingPayments - Drizzle/Postgres path', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	// Helper: build a Drizzle query chain mock. The chain is thenable and
	// resolves to `data` when awaited. `db` itself is NOT thenable so
	// `await getDrizzle()` returns the db object with query methods.
	function makeDrizzleData(data: any[]) {
		const chain: any = {};
		const methods = [
			'select', 'from', 'where', 'leftJoin', 'groupBy', 'orderBy',
			'limit', 'insert', 'values', 'update', 'set', 'delete', 'returning', 'ilike', 'for'
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

	describe('recordPayment - concurrency & balance validation', () => {
		it('allows payment within remaining balance', async () => {
			// Lending: 1000, existing payments: 300, remaining: 700
			// Payment: 500 (within remaining)
			const lendingRow = {
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
			};

			// First call: select lending with FOR UPDATE
			// Second call: select balance
			// Third call: insert payment
			// Fourth call: update lending status
			const lendingChain = makeDrizzleData([lendingRow]);
			const balanceChain = makeDrizzleData([{ resolved: '300' }]);
			const paymentChain = makeDrizzleData([{ id: 1 }]);
			const statusChain = makeDrizzleData([{}]);

			let callCount = 0;
			const tx = {
				select: vi.fn(() => {
					callCount++;
					if (callCount === 1) return lendingChain;
					if (callCount === 2) return balanceChain;
					if (callCount === 3) return statusChain;
					return makeDrizzleData([]);
				}),
				insert: vi.fn(() => paymentChain),
				update: vi.fn(() => statusChain),
			};

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

			expect(result.paymentId).toBe(1);
			expect(db.transaction).toHaveBeenCalled();
		});

		it('allows payment exactly equal to remaining balance', async () => {
			// Lending: 1000, existing payments: 300, remaining: 700
			// Payment: 700 (exactly remaining)
			const lendingRow = {
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
			};

			const lendingChain = makeDrizzleData([lendingRow]);
			const balanceChain = makeDrizzleData([{ resolved: '300' }]);
			const paymentChain = makeDrizzleData([{ id: 1 }]);
			const statusChain = makeDrizzleData([{}]);

			let callCount = 0;
			const tx = {
				select: vi.fn(() => {
					callCount++;
					if (callCount === 1) return lendingChain;
					if (callCount === 2) return balanceChain;
					if (callCount === 3) return statusChain;
					return makeDrizzleData([]);
				}),
				insert: vi.fn(() => paymentChain),
				update: vi.fn(() => statusChain),
			};

			const db = {
				transaction: vi.fn((cb: any) => cb(tx))
			};
			(getDrizzle as any).mockResolvedValue(db);

			const result = await recordPayment(1, {
				lendingId: 1,
				amount: 700,
				paymentDate: '2024-01-15',
				notes: null,
				paymentType: 'payment',
				createTransaction: false
			});

			expect(result.paymentId).toBe(1);
		});

		it('rejects payment exceeding remaining balance', async () => {
			// Lending: 1000, existing payments: 300, remaining: 700
			// Payment: 800 (exceeds remaining)
			const lendingRow = {
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
			};

			const lendingChain = makeDrizzleData([lendingRow]);
			const balanceChain = makeDrizzleData([{ resolved: '300' }]);

			let callCount = 0;
			const tx = {
				select: vi.fn(() => {
					callCount++;
					if (callCount === 1) return lendingChain;
					if (callCount === 2) return balanceChain;
					return makeDrizzleData([]);
				}),
				insert: vi.fn(() => makeDrizzleData([{ id: 1 }])),
				update: vi.fn(() => makeDrizzleData([{}])),
			};

			const db = {
				transaction: vi.fn((cb: any) => cb(tx))
			};
			(getDrizzle as any).mockResolvedValue(db);

			await expect(recordPayment(1, {
				lendingId: 1,
				amount: 800,
				paymentDate: '2024-01-15',
				notes: null,
				paymentType: 'payment',
				createTransaction: false
			})).rejects.toThrow('Payment amount cannot exceed remaining balance of ₱700.00');
		});

		it('rejects payment for non-existent lending', async () => {
			const lendingChain = makeDrizzleData([]); // No lending found

			const tx = {
				select: vi.fn(() => lendingChain),
				insert: vi.fn(() => makeDrizzleData([{ id: 1 }])),
				update: vi.fn(() => makeDrizzleData([{}])),
			};

			const db = {
				transaction: vi.fn((cb: any) => cb(tx))
			};
			(getDrizzle as any).mockResolvedValue(db);

			await expect(recordPayment(1, {
				lendingId: 999,
				amount: 500,
				paymentDate: '2024-01-15',
				notes: null,
				paymentType: 'payment',
				createTransaction: false
			})).rejects.toThrow('Lending record not found');
		});

		it('handles write-off payment type without creating transaction', async () => {
			const lendingRow = {
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
			};

			const lendingChain = makeDrizzleData([lendingRow]);
			const balanceChain = makeDrizzleData([{ resolved: '300' }]);
			const paymentChain = makeDrizzleData([{ id: 1 }]);
			const statusChain = makeDrizzleData([{}]);

			let callCount = 0;
			const tx = {
				select: vi.fn(() => {
					callCount++;
					if (callCount === 1) return lendingChain;
					if (callCount === 2) return balanceChain;
					if (callCount === 3) return statusChain;
					return makeDrizzleData([]);
				}),
				insert: vi.fn(() => paymentChain),
				update: vi.fn(() => statusChain),
			};

			const db = {
				transaction: vi.fn((cb: any) => cb(tx))
			};
			(getDrizzle as any).mockResolvedValue(db);

			const result = await recordPayment(1, {
				lendingId: 1,
				amount: 700,
				paymentDate: '2024-01-15',
				notes: 'Write off',
				paymentType: 'write_off',
				createTransaction: true // Should be ignored for write_off
			});

			expect(result.paymentId).toBe(1);
			expect(result.transactionId).toBeNull();
		});

		it('handles final payment that exactly exhausts the lending amount', async () => {
			// Lending: 1000, existing payments: 1000, remaining: 0
			// Trying to pay more should fail
			const lendingRow = {
				id: 1,
				user_id: 1,
				borrower_name: 'John',
				amount: '1000',
				interest_rate: '0',
				date_lent: '2024-01-01',
				due_date: null,
				status: 'paid',
				notes: null,
				direction: 'lent',
				created_at: new Date('2024-01-01'),
				updated_at: new Date('2024-01-01')
			};

			const lendingChain = makeDrizzleData([lendingRow]);
			const balanceChain = makeDrizzleData([{ resolved: '1000' }]);

			let selectCallCount = 0;
			const tx = {
				select: vi.fn(() => {
					selectCallCount++;
					if (selectCallCount === 1) return lendingChain;
					return balanceChain;
				}),
				insert: vi.fn(() => makeDrizzleData([{ id: 1 }])),
				update: vi.fn(() => makeDrizzleData([{}])),
			};

			const db = {
				transaction: vi.fn((cb: any) => cb(tx))
			};
			(getDrizzle as any).mockResolvedValue(db);

			await expect(recordPayment(1, {
				lendingId: 1,
				amount: 100,
				paymentDate: '2024-01-15',
				notes: null,
				paymentType: 'payment',
				createTransaction: false
			})).rejects.toThrow('Payment amount cannot exceed remaining balance of ₱0.00');
		});
	});

	describe('updatePayment - concurrency & balance validation', () => {
		it('allows update within remaining balance (excluding current payment)', async () => {
			// Lending: 1000, other payments: 300, this payment: 400, remaining if updated: 700
			// Update to: 600 (within remaining: 1000 - 300 = 700)
			const paymentRow = {
				id: 1,
				lending_id: 1,
				user_id: 1,
				amount: '400',
				payment_date: '2024-01-15',
				notes: null,
				transaction_id: null,
				payment_type: 'payment',
				reference: null,
				created_at: new Date('2024-01-15'),
				updated_at: new Date('2024-01-15')
			};
			const lendingRow = {
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
			};

			const paymentChain = makeDrizzleData([paymentRow]);
			const lendingChain = makeDrizzleData([lendingRow]);
			const balanceChain = makeDrizzleData([{ resolved: '300' }]); // Other payments sum
			const statusChain = makeDrizzleData([{}]);

			let selectCallCount = 0;
			const tx = {
				select: vi.fn(() => {
					selectCallCount++;
					if (selectCallCount === 1) return paymentChain;
					if (selectCallCount === 2) return lendingChain;
					if (selectCallCount === 3) return balanceChain;
					if (selectCallCount === 4) return statusChain;
					return makeDrizzleData([]);
				}),
				update: vi.fn(() => makeDrizzleData([{}])),
			};

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

		it('rejects update exceeding remaining balance (excluding current payment)', async () => {
			// Lending: 1000, other payments: 300, this payment: 400, remaining if updated: 700
			// Update to: 800 (exceeds remaining: 1000 - 300 = 700)
			const paymentRow = {
				id: 1,
				lending_id: 1,
				user_id: 1,
				amount: '400',
				payment_date: '2024-01-15',
				notes: null,
				transaction_id: null,
				payment_type: 'payment',
				reference: null,
				created_at: new Date('2024-01-15'),
				updated_at: new Date('2024-01-15')
			};
			const lendingRow = {
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
			};

			const paymentChain = makeDrizzleData([paymentRow]);
			const lendingChain = makeDrizzleData([lendingRow]);
			const balanceChain = makeDrizzleData([{ resolved: '300' }]);

			let selectCallCount = 0;
			const tx = {
				select: vi.fn(() => {
					selectCallCount++;
					if (selectCallCount === 1) return paymentChain;
					if (selectCallCount === 2) return lendingChain;
					if (selectCallCount === 3) return balanceChain;
					return makeDrizzleData([]);
				}),
				update: vi.fn(() => makeDrizzleData([{}])),
			};

			const db = {
				transaction: vi.fn((cb: any) => cb(tx))
			};
			(getDrizzle as any).mockResolvedValue(db);

			await expect(updatePayment(1, 1, {
				amount: 800,
				paymentDate: '2024-01-20',
				notes: 'Updated'
			})).rejects.toThrow('Payment amount cannot exceed remaining balance of ₱700.00');
		});
	});

	describe('deletePayment - status recalculation', () => {
		it('recalculates status correctly after deletion', async () => {
			// Lending: 1000, payments: 500+300=800, after delete 500 -> remaining 500 (active)
			const paymentRow = {
				id: 1,
				lending_id: 1,
				user_id: 1,
				amount: '500',
				payment_date: '2024-01-15',
				notes: null,
				transaction_id: null,
				payment_type: 'payment',
				reference: null,
				created_at: new Date('2024-01-15'),
				updated_at: new Date('2024-01-15')
			};
			const lendingRow = {
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
			};

			const paymentChain = makeDrizzleData([paymentRow]);
			const lendingChain = makeDrizzleData([lendingRow]);
			const balanceChain = makeDrizzleData([{ amount: '1000', resolved: '300' }]); // After deletion
			const statusChain = makeDrizzleData([{}]);

			let selectCallCount = 0;
			const tx = {
				select: vi.fn(() => {
					selectCallCount++;
					if (selectCallCount === 1) return paymentChain;
					if (selectCallCount === 2) return lendingChain;
					if (selectCallCount === 3) return balanceChain;
					if (selectCallCount === 4) return statusChain;
					return makeDrizzleData([]);
				}),
				delete: vi.fn(() => makeDrizzleData([{}])),
				update: vi.fn(() => statusChain),
			};

			const db = {
				transaction: vi.fn((cb: any) => cb(tx))
			};
			(getDrizzle as any).mockResolvedValue(db);

			await deletePayment(1, 1);

			expect(db.transaction).toHaveBeenCalled();
		});
	});
});
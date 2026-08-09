import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

/**
 * API routing tests for the lending REST handlers. `$lib/server/lendingPayments`
 * is mocked, so these tests verify the ROUTE layer only: the correct service
 * functions are called with the right arguments (including that client-supplied
 * `status` is never forwarded to the service), ownership/404/400 semantics are
 * preserved, and response shapes are intact. The service behavior itself is
 * covered by tests/unit-test/updateLending.test.ts and createLending.test.ts.
 */

const mocks = {
	getLendingsWithPayments: vi.fn(),
	getLendingWithPayments: vi.fn(),
	createLending: vi.fn(),
	updateLending: vi.fn(),
	deleteLending: vi.fn()
};

function makeLocals(userId = 1) {
	return { user: { userId, username: 'user' } };
}

function makeRequest(method: string, body?: unknown): Request {
	return new Request('http://test', {
		method,
		body: body !== undefined ? JSON.stringify(body) : undefined,
		headers: { 'content-type': 'application/json' }
	});
}

function lending(overrides: Record<string, unknown> = {}) {
	return {
		id: 1,
		user_id: 1,
		borrower_name: 'Alice',
		amount: 1000,
		interest_rate: 0,
		date_lent: '2026-01-01',
		due_date: null,
		status: 'active',
		notes: null,
		created_at: '2026-08-01 00:00:00',
		updated_at: '2026-08-01 00:00:00',
		direction: 'lent',
		cash_paid: 0,
		written_off: 0,
		resolved_total: 0,
		remaining: 1000,
		derived_status: 'active',
		...overrides
	};
}

describe('api/lendings +server.ts (GET list, POST create)', () => {
	let GET: any;
	let POST: any;

	beforeAll(async () => {
		vi.doMock('$lib/server/lendingPayments', () => ({ ...mocks }));
		vi.resetModules();
		const mod = await import('../../src/routes/api/lendings/+server.ts');
		GET = mod.GET;
		POST = mod.POST;
	});

	beforeEach(() => vi.clearAllMocks());

	it('GET with direction=lent routes through getLendingsWithPayments and returns the list', async () => {
		mocks.getLendingsWithPayments.mockResolvedValue([lending()]);

		const res = await GET({ url: new URL('http://test/api/lendings?direction=lent'), locals: makeLocals() });

		expect(mocks.getLendingsWithPayments).toHaveBeenCalledTimes(1);
		expect(mocks.getLendingsWithPayments).toHaveBeenCalledWith(1, 'lent');
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual([lending()]);
	});

	it('GET with direction=borrowed routes with the borrowed direction', async () => {
		mocks.getLendingsWithPayments.mockResolvedValue([lending({ direction: 'borrowed', borrower_name: 'Bob' })]);

		const res = await GET({ url: new URL('http://test/api/lendings?direction=borrowed'), locals: makeLocals() });

		expect(mocks.getLendingsWithPayments).toHaveBeenCalledWith(1, 'borrowed');
		expect((await res.json())[0].borrower_name).toBe('Bob');
	});

	it('GET without a direction merges lent + borrowed in created_at DESC order', async () => {
		mocks.getLendingsWithPayments
			.mockResolvedValueOnce([lending({ id: 1, created_at: '2026-08-01 00:00:00', direction: 'lent' })])
			.mockResolvedValueOnce([lending({ id: 2, created_at: '2026-09-01 00:00:00', direction: 'borrowed', borrower_name: 'Bob' })]);

		const res = await GET({ url: new URL('http://test/api/lendings'), locals: makeLocals() });

		expect(mocks.getLendingsWithPayments).toHaveBeenNthCalledWith(1, 1, 'lent');
		expect(mocks.getLendingsWithPayments).toHaveBeenNthCalledWith(2, 1, 'borrowed');
		const body = await res.json();
		expect(body).toHaveLength(2);
		expect(body[0].id).toBe(2); // newest first
		expect(body[1].id).toBe(1);
	});

	it('GET filters by derived_status when ?status=active', async () => {
		mocks.getLendingsWithPayments.mockResolvedValue([
			lending({ id: 1, derived_status: 'active' }),
			lending({ id: 2, borrower_name: 'Bob', derived_status: 'paid', status: 'paid' })
		]);

		const res = await GET({ url: new URL('http://test/api/lendings?status=active&direction=lent'), locals: makeLocals() });

		const body = await res.json();
		expect(body).toHaveLength(1);
		expect(body[0].id).toBe(1);
	});

	it('POST routes through createLending with recordAsTransaction: false and returns 201 + the created lending', async () => {
		mocks.createLending.mockResolvedValue({ success: true, id: 5 });
		mocks.getLendingWithPayments.mockResolvedValue(lending({ id: 5 }));

		const res = await POST({
			request: makeRequest('POST', { borrower_name: 'Alice', amount: 1000, interest_rate: 2.5, date_lent: '2026-01-01', due_date: null, notes: 'friend', direction: 'lent' }),
			locals: makeLocals()
		});

		expect(mocks.createLending).toHaveBeenCalledTimes(1);
		expect(mocks.createLending).toHaveBeenCalledWith(1, {
			borrowerName: 'Alice',
			amount: 1000,
			interestRate: 2.5,
			dateLent: '2026-01-01',
			dueDate: null,
			notes: 'friend',
			direction: 'lent',
			recordAsTransaction: false
		});
		expect(mocks.getLendingWithPayments).toHaveBeenCalledWith(1, 5);
		expect(res.status).toBe(201);
		expect((await res.json()).id).toBe(5);
	});

	it('POST defaults direction to lent and recordAsTransaction stays false', async () => {
		mocks.createLending.mockResolvedValue({ success: true, id: 9 });
		mocks.getLendingWithPayments.mockResolvedValue(lending({ id: 9 }));

		await POST({ request: makeRequest('POST', { borrower_name: 'Alice', amount: 100, date_lent: '2026-01-01' }), locals: makeLocals() });

		expect(mocks.createLending).toHaveBeenCalledWith(1, expect.objectContaining({
			direction: 'lent',
			recordAsTransaction: false,
			interestRate: 0,
			dueDate: null,
			notes: null
		}));
	});

	it('POST rejects missing required fields with 400 and does not call the service', async () => {
		const res = await POST({ request: makeRequest('POST', { borrower_name: '' }), locals: makeLocals() });

		expect(res.status).toBe(400);
		expect(mocks.createLending).not.toHaveBeenCalled();
	});

	describe('POST direction validation', () => {
		beforeEach(() => {
			mocks.createLending.mockResolvedValue({ success: true, id: 1 });
			mocks.getLendingWithPayments.mockResolvedValue(lending({ id: 1 }));
		});

		it('missing direction defaults to lent', async () => {
			await POST({ request: makeRequest('POST', { borrower_name: 'Alice', amount: 100, date_lent: '2026-01-01' }), locals: makeLocals() });

			expect(mocks.createLending).toHaveBeenCalledWith(1, expect.objectContaining({ direction: 'lent' }));
		});

		it('direction=lent is forwarded as lent', async () => {
			await POST({ request: makeRequest('POST', { borrower_name: 'Alice', amount: 100, date_lent: '2026-01-01', direction: 'lent' }), locals: makeLocals() });

			expect(mocks.createLending).toHaveBeenCalledWith(1, expect.objectContaining({ direction: 'lent' }));
		});

		it('direction=borrowed is forwarded as borrowed', async () => {
			await POST({ request: makeRequest('POST', { borrower_name: 'Alice', amount: 100, date_lent: '2026-01-01', direction: 'borrowed' }), locals: makeLocals() });

			expect(mocks.createLending).toHaveBeenCalledWith(1, expect.objectContaining({ direction: 'borrowed' }));
		});

		it('invalid direction returns 400 with { error: "Invalid direction" }', async () => {
			const res = await POST({ request: makeRequest('POST', { borrower_name: 'Alice', amount: 100, date_lent: '2026-01-01', direction: 'garbage' }), locals: makeLocals() });

			expect(res.status).toBe(400);
			expect(await res.json()).toEqual({ error: 'Invalid direction' });
		});

		it('invalid direction creates no lending record (service never called)', async () => {
			const res = await POST({ request: makeRequest('POST', { borrower_name: 'Alice', amount: 100, date_lent: '2026-01-01', direction: 'borrwed' }), locals: makeLocals() });

			expect(res.status).toBe(400);
			expect(mocks.createLending).not.toHaveBeenCalled();
			expect(mocks.getLendingWithPayments).not.toHaveBeenCalled();
		});
	});
});

describe('api/lendings/[id] +server.ts (GET, PUT, DELETE)', () => {
	let GET: any;
	let PUT: any;
	let DELETE: any;

	beforeAll(async () => {
		vi.doMock('$lib/server/lendingPayments', () => ({ ...mocks }));
		vi.resetModules();
		const mod = await import('../../src/routes/api/lendings/[id]/+server.ts');
		GET = mod.GET;
		PUT = mod.PUT;
		DELETE = mod.DELETE;
	});

	beforeEach(() => vi.clearAllMocks());

	it('GET returns 400 for a non-numeric id without calling the service', async () => {
		const res = await GET({ params: { id: 'abc' }, locals: makeLocals() });
		expect(res.status).toBe(400);
		expect(mocks.getLendingWithPayments).not.toHaveBeenCalled();
	});

	it('GET returns 404 when the lending is missing', async () => {
		mocks.getLendingWithPayments.mockResolvedValue(undefined);
		const res = await GET({ params: { id: '5' }, locals: makeLocals() });
		expect(res.status).toBe(404);
	});

	it('GET returns the lending when found', async () => {
		mocks.getLendingWithPayments.mockResolvedValue(lending({ id: 5 }));
		const res = await GET({ params: { id: '5' }, locals: makeLocals() });
		expect(mocks.getLendingWithPayments).toHaveBeenCalledWith(1, 5);
		expect(res.status).toBe(200);
		expect((await res.json()).id).toBe(5);
	});

	it('PUT routes through updateLending, never forwards client status, and returns the updated lending', async () => {
		mocks.getLendingWithPayments
			.mockResolvedValueOnce(lending({ id: 5 }))                        // existence check
			.mockResolvedValueOnce(lending({ id: 5, borrower_name: 'Renamed' })); // post-update read
		mocks.updateLending.mockResolvedValue({ success: true });

		const res = await PUT({
			params: { id: '5' },
			request: makeRequest('PUT', { borrower_name: 'Renamed', status: 'paid', amount: 9999, date_lent: '2099-01-01' }),
			locals: makeLocals()
		});

		expect(mocks.updateLending).toHaveBeenCalledTimes(1);
		const call = mocks.updateLending.mock.calls[0][2];
		// client-supplied status is stripped — the service input has no status key
		expect(call).not.toHaveProperty('status');
		expect(call.borrowerName).toBe('Renamed');
		// amount/date forwarded (no payments in the fixture → editable)
		expect(call.amount).toBe(9999);
		expect(call.dateLent).toBe('2099-01-01');
		expect(res.status).toBe(200);
		expect((await res.json()).borrower_name).toBe('Renamed');
	});

	it('PUT falls back to existing values for omitted fields', async () => {
		mocks.getLendingWithPayments.mockResolvedValue(
			lending({ id: 5, borrower_name: 'Alice', amount: 1000, interest_rate: 0, date_lent: '2026-01-01', due_date: null, notes: null })
		);
		mocks.updateLending.mockResolvedValue({ success: true });

		const res = await PUT({
			params: { id: '5' },
			request: makeRequest('PUT', { notes: 'updated note' }),
			locals: makeLocals()
		});

		const call = mocks.updateLending.mock.calls[0][2];
		expect(call.borrowerName).toBe('Alice');
		expect(call.amount).toBe(1000);
		expect(call.interestRate).toBe(0);
		expect(call.dateLent).toBe('2026-01-01');
		expect(call.dueDate).toBe(null);
		expect(call.notes).toBe('updated note');
		expect(res.status).toBe(200);
	});

	it('PUT returns 404 for a missing lending without calling updateLending', async () => {
		mocks.getLendingWithPayments.mockResolvedValue(undefined);
		const res = await PUT({ params: { id: '5' }, request: makeRequest('PUT', { borrower_name: 'X' }), locals: makeLocals() });
		expect(res.status).toBe(404);
		expect(mocks.updateLending).not.toHaveBeenCalled();
	});

	it('PUT returns 400 when the service rejects (e.g. non-positive amount with no payments)', async () => {
		mocks.getLendingWithPayments.mockResolvedValue(lending({ id: 5 }));
		mocks.updateLending.mockRejectedValue(new Error('Amount must be a positive number'));

		const res = await PUT({ params: { id: '5' }, request: makeRequest('PUT', { amount: 0 }), locals: makeLocals() });

		expect(res.status).toBe(400);
		expect((await res.json()).error).toBe('Amount must be a positive number');
	});

	it('DELETE returns 204 when the lending existed and 404 when it did not', async () => {
		mocks.deleteLending.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

		const ok = await DELETE({ params: { id: '5' }, locals: makeLocals() });
		expect(ok.status).toBe(204);
		expect(mocks.deleteLending).toHaveBeenCalledWith(1, 5);

		const missing = await DELETE({ params: { id: '5' }, locals: makeLocals() });
		expect(missing.status).toBe(404);
	});

	it('DELETE returns 400 for a non-numeric id without calling the service', async () => {
		const res = await DELETE({ params: { id: 'x' }, locals: makeLocals() });
		expect(res.status).toBe(400);
		expect(mocks.deleteLending).not.toHaveBeenCalled();
	});
});

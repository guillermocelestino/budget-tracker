import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

/**
 * API routing tests for the transaction `[id]` PUT handler. `$lib/server/services/transactions`
 * is mocked, so these tests verify the ROUTE layer only: partial payloads (e.g. the inline-edit
 * `{ id, amount }`) are validated per supplied field, omitted fields are never forwarded so the
 * service preserves them (including source_of_funds), explicit source_of_funds updates still work,
 * and invalid supplied values are still rejected. The service-layer preservation itself is covered
 * by tests/unit-test/transactions.test.ts.
 */

const mocks = {
	getTransaction: vi.fn(),
	updateTransaction: vi.fn(),
	deleteTransaction: vi.fn()
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

function transaction(overrides: Record<string, unknown> = {}) {
	return {
		id: 5,
		amount: 5000,
		description: 'Groceries',
		date: '2026-08-01',
		category_id: 3,
		type: 'expense',
		source_of_funds: null,
		created_at: '2026-08-01 00:00:00',
		updated_at: '2026-08-01 00:00:00',
		category_name: 'Food',
		category_color: '#fff',
		...overrides
	};
}

describe('api/transactions/[id] +server.ts PUT (partial updates)', () => {
	let PUT: any;

	beforeAll(async () => {
		vi.doMock('$lib/server/services/transactions', () => ({ ...mocks }));
		vi.resetModules();
		const mod = await import('../../src/routes/api/transactions/[id]/+server.ts');
		PUT = mod.PUT;
	});

	beforeEach(() => vi.clearAllMocks());

	it('accepts a partial payload (id + amount only) and forwards only that field', async () => {
		mocks.updateTransaction.mockResolvedValue(true);
		mocks.getTransaction.mockResolvedValue(transaction({ amount: 5000 }));

		const res = await PUT({
			params: { id: '5' },
			request: makeRequest('PUT', { amount: 5000 }),
			locals: makeLocals()
		});

		expect(res.status).toBe(200);
		// The service input is exactly { amount } — no other key is invented or required.
		expect(mocks.updateTransaction).toHaveBeenCalledTimes(1);
		expect(mocks.updateTransaction).toHaveBeenCalledWith(1, 5, { amount: 5000 });
		expect((await res.json()).amount).toBe(5000);
	});

	it('a partial amount update does not forward source_of_funds (service preserves it)', async () => {
		mocks.updateTransaction.mockResolvedValue(true);
		mocks.getTransaction.mockResolvedValue(transaction({ amount: 5000, source_of_funds: "Mother's Money" }));

		const res = await PUT({
			params: { id: '5' },
			request: makeRequest('PUT', { amount: 5000 }),
			locals: makeLocals()
		});

		expect(res.status).toBe(200);
		const call = mocks.updateTransaction.mock.calls[0][2];
		expect(call).toEqual({ amount: 5000 });
		expect(call).not.toHaveProperty('source_of_funds');
	});

	it('a partial update of another field also omits source_of_funds', async () => {
		mocks.updateTransaction.mockResolvedValue(true);
		mocks.getTransaction.mockResolvedValue(transaction({ description: 'Renamed', source_of_funds: "Mother's Money" }));

		const res = await PUT({
			params: { id: '5' },
			request: makeRequest('PUT', { description: 'Renamed' }),
			locals: makeLocals()
		});

		expect(res.status).toBe(200);
		const call = mocks.updateTransaction.mock.calls[0][2];
		expect(call).toEqual({ description: 'Renamed' });
		expect(call).not.toHaveProperty('source_of_funds');
	});

	it('an explicit source_of_funds update is still forwarded', async () => {
		mocks.updateTransaction.mockResolvedValue(true);
		mocks.getTransaction.mockResolvedValue(transaction({ source_of_funds: "Mother's Money" }));

		const res = await PUT({
			params: { id: '5' },
			request: makeRequest('PUT', { source_of_funds: "Mother's Money" }),
			locals: makeLocals()
		});

		expect(res.status).toBe(200);
		expect(mocks.updateTransaction).toHaveBeenCalledWith(1, 5, { source_of_funds: "Mother's Money" });
	});

	it('an explicit empty source_of_funds is forwarded so the service clears it to NULL', async () => {
		mocks.updateTransaction.mockResolvedValue(true);
		mocks.getTransaction.mockResolvedValue(transaction({ source_of_funds: null }));

		const res = await PUT({
			params: { id: '5' },
			request: makeRequest('PUT', { source_of_funds: '' }),
			locals: makeLocals()
		});

		expect(res.status).toBe(200);
		expect(mocks.updateTransaction).toHaveBeenCalledWith(1, 5, { source_of_funds: '' });
	});

	it('an explicit null source_of_funds is forwarded (clears to NULL)', async () => {
		mocks.updateTransaction.mockResolvedValue(true);
		mocks.getTransaction.mockResolvedValue(transaction({ source_of_funds: null }));

		const res = await PUT({
			params: { id: '5' },
			request: makeRequest('PUT', { source_of_funds: null }),
			locals: makeLocals()
		});

		expect(res.status).toBe(200);
		expect(mocks.updateTransaction).toHaveBeenCalledWith(1, 5, { source_of_funds: null });
	});

	it('a full payload still works and is forwarded intact', async () => {
		mocks.updateTransaction.mockResolvedValue(true);
		mocks.getTransaction.mockResolvedValue(transaction());

		const res = await PUT({
			params: { id: '5' },
			request: makeRequest('PUT', {
				type: 'expense',
				amount: 5000,
				description: 'Groceries',
				date: '2026-08-01',
				category_id: 3,
				source_of_funds: "Mother's Money"
			}),
			locals: makeLocals()
		});

		expect(res.status).toBe(200);
		expect(mocks.updateTransaction).toHaveBeenCalledWith(1, 5, {
			type: 'expense',
			amount: 5000,
			description: 'Groceries',
			date: '2026-08-01',
			category_id: 3,
			source_of_funds: "Mother's Money"
		});
	});

	it('rejects invalid supplied values with 400 and never calls the service', async () => {
		const cases: { body: Record<string, unknown> }[] = [
			{ body: { type: 'garbage' } },
			{ body: { amount: 'abc' } },
			{ body: { amount: 0 } },
			{ body: { description: '' } },
			{ body: { description: 42 } },
			{ body: { date: '' } },
			{ body: { category_id: 'x' } },
			{ body: { category_id: 0 } },
			{ body: { source_of_funds: 123 } }
		];

		for (const { body } of cases) {
			const res = await PUT({ params: { id: '5' }, request: makeRequest('PUT', body), locals: makeLocals() });
			expect(res.status, JSON.stringify(body)).toBe(400);
		}
		expect(mocks.updateTransaction).not.toHaveBeenCalled();
	});

	it('rejects an empty payload with 400', async () => {
		const res = await PUT({ params: { id: '5' }, request: makeRequest('PUT', {}), locals: makeLocals() });
		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: 'No valid fields to update' });
		expect(mocks.updateTransaction).not.toHaveBeenCalled();
	});

	it('returns 400 for a non-numeric id without calling the service', async () => {
		const res = await PUT({ params: { id: 'abc' }, request: makeRequest('PUT', { amount: 5000 }), locals: makeLocals() });
		expect(res.status).toBe(400);
		expect(mocks.updateTransaction).not.toHaveBeenCalled();
	});

	it('returns 404 when the service reports the transaction does not exist', async () => {
		mocks.updateTransaction.mockResolvedValue(false);

		const res = await PUT({ params: { id: '5' }, request: makeRequest('PUT', { amount: 5000 }), locals: makeLocals() });

		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ error: 'Transaction not found' });
	});

	it('maps a service "Category not found" rejection to 400', async () => {
		mocks.updateTransaction.mockRejectedValue(new Error('Category not found'));

		const res = await PUT({ params: { id: '5' }, request: makeRequest('PUT', { category_id: 99 }), locals: makeLocals() });

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: 'Category not found' });
	});

	it('maps other service rejections to 400 with the message', async () => {
		mocks.updateTransaction.mockRejectedValue(new Error('Enter a valid amount'));

		const res = await PUT({ params: { id: '5' }, request: makeRequest('PUT', { amount: -5 }), locals: makeLocals() });

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: 'Enter a valid amount' });
	});
});

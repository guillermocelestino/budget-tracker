import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

/**
 * Regression test for the Source of Funds CREATE bug.
 *
 * The `/transactions/new` route's default action previously dropped
 * `source_of_funds` when building the `createTransaction()` payload, so a
 * transaction created there always stored `NULL` even when the form had a
 * value (e.g. "Mama Cel"). The UPDATE path already forwarded the field, which
 * is why editing-and-saving later worked. This test locks in the CREATE
 * forwarding at the route layer; the service-layer normalization semantics
 * (trim, "" → NULL, "Mama Cel" → "Mama Cel") are covered by
 * transactions.test.ts.
 */
const mocks = {
	createTransaction: vi.fn(),
	getCategories: vi.fn()
};

function makeLocals(userId = 1) {
	return { user: { userId, username: 'user' } };
}

function makeForm(overrides: Record<string, string> = {}): Request {
	const form = new FormData();
	form.append('type', 'expense');
	form.append('amount', '250');
	form.append('description', 'Dinner');
	form.append('date', '2026-08-01');
	form.append('category_id', '5');
	for (const [k, v] of Object.entries(overrides)) form.set(k, v);
	return new Request('http://test/transactions/new', { method: 'POST', body: form });
}

describe('routes/transactions/new — default create action', () => {
	let actions: any;

	beforeAll(async () => {
		vi.doMock('$lib/server/services/transactions', () => ({ ...mocks }));
		vi.doMock('$lib/server/services/categories', () => ({ getCategories: mocks.getCategories }));
		vi.resetModules();
		const mod = await import('../../src/routes/transactions/new/+page.server.ts');
		actions = mod.actions;
	});

	beforeEach(() => vi.clearAllMocks());

	it('forwards source_of_funds to createTransaction when the form has a value', async () => {
		mocks.createTransaction.mockResolvedValue(1);

		await expect(
			actions.default({ request: makeForm({ source_of_funds: 'Mama Cel' }), locals: makeLocals() })
		).rejects.toMatchObject({ status: 303 });

		expect(mocks.createTransaction).toHaveBeenCalledTimes(1);
		expect(mocks.createTransaction).toHaveBeenCalledWith(
			1,
			expect.objectContaining({ source_of_funds: 'Mama Cel' })
		);
	});

	it('forwards the raw source_of_funds value (trim/normalize stays in the service)', async () => {
		mocks.createTransaction.mockResolvedValue(1);

		await expect(
			actions.default({ request: makeForm({ source_of_funds: '   ' }), locals: makeLocals() })
		).rejects.toMatchObject({ status: 303 });

		expect(mocks.createTransaction).toHaveBeenCalledWith(
			1,
			expect.objectContaining({ source_of_funds: '   ' })
		);
	});

	it('passes null for an absent source_of_funds (service normalizes to NULL — unchanged semantics)', async () => {
		mocks.createTransaction.mockResolvedValue(1);

		await expect(
			actions.default({ request: makeForm(), locals: makeLocals() })
		).rejects.toMatchObject({ status: 303 });

		expect(mocks.createTransaction).toHaveBeenCalledWith(
			1,
			expect.objectContaining({ source_of_funds: null })
		);
	});

	it('still validates required fields and never calls the service on invalid input', async () => {
		const res = await actions.default({
			request: makeForm({ amount: '' }),
			locals: makeLocals()
		});

		expect(res).toMatchObject({ status: 400 });
		expect(mocks.createTransaction).not.toHaveBeenCalled();
	});
});

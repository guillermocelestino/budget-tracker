import { describe, it, expect, beforeAll, vi } from 'vitest';

describe('updateLending — Drizzle/Postgres structural (tx used, global db never touched)', () => {
	let getDrizzle: any;
	let updateLending: (userId: number, lendingId: number, input: any) => Promise<{ success: true }>;

	const TABLE_NAME = Symbol.for('drizzle:Name');
	function tableNameOf(table: unknown): string {
		return (table as Record<symbol, string> | undefined)?.[TABLE_NAME] ?? 'unknown';
	}

	function makeFakeTx(options: { existing?: unknown; paymentCount?: number }) {
		const calls: { setPayloads: Record<string, unknown>[] } = { setPayloads: [] };
		const tx = {
			calls,
			select: vi.fn((_fields?: Record<string, unknown>) => ({
				from: vi.fn((table: unknown) => ({
					where: vi.fn(async () => {
						const name = tableNameOf(table);
						if (name === 'lendings') {
							return options.existing !== undefined ? [options.existing] : [];
						}
						return [{ count: options.paymentCount ?? 0 }];
					})
				}))
			})),
			update: vi.fn(() => ({
				set: vi.fn((values: Record<string, unknown>) => {
					calls.setPayloads.push(values);
					return { where: vi.fn(async () => ({ rows: [] })) };
				})
			}))
		};
		return tx;
	}

	function fakeDb(tx: ReturnType<typeof makeFakeTx>) {
		return {
			transaction: vi.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
			select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn() })) })),
			update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) }))
		};
	}

	beforeAll(async () => {
		vi.doMock('$lib/database', () => ({
			getPgPool: vi.fn(),
			initDb: async () => {},
			closeDb: async () => {}
		}));
		vi.doMock('$lib/database/drizzle', () => ({
			getDrizzle: vi.fn()
		}));
		vi.resetModules();
		getDrizzle = (await import('$lib/database/drizzle')).getDrizzle;
		const mod = await import('$lib/server/lendingPayments');
		updateLending = mod.updateLending;
	});

	const input = {
		borrowerName: 'Renamed',
		amount: 2000,
		interestRate: 5,
		dateLent: '2026-03-01',
		dueDate: '2026-12-31',
		notes: 'new note'
	};

	it('runs the ownership check + payment count + UPDATE all through tx and never the global db', async () => {
		const tx = makeFakeTx({ existing: { id: 1 }, paymentCount: 0 });
		const db = fakeDb(tx);
		getDrizzle.mockResolvedValue(db);

		const result = await updateLending(1, 1, input);

		expect(result).toEqual({ success: true });
		expect(db.transaction).toHaveBeenCalledTimes(1);
		// lendings ownership SELECT + lending_payments count SELECT
		expect(tx.select).toHaveBeenCalledTimes(2);
		expect(tx.update).toHaveBeenCalledTimes(1);
		// the global db was never touched inside the transaction
		expect(db.select).not.toHaveBeenCalled();
		expect(db.update).not.toHaveBeenCalled();
	});

	it('no-payment branch writes amount/date_lent (and never status)', async () => {
		const tx = makeFakeTx({ existing: { id: 1 }, paymentCount: 0 });
		getDrizzle.mockResolvedValue(fakeDb(tx));

		await updateLending(1, 1, input);

		const payload = tx.calls.setPayloads[0];
		expect(payload.amount).toBe('2000');
		expect(payload.date_lent).toBe('2026-03-01');
		expect(payload.borrower_name).toBe('Renamed');
		expect(payload.notes).toBe('new note');
		expect('status' in payload).toBe(false);
	});

	it('payment-lock branch does NOT write amount/date_lent (or status)', async () => {
		const tx = makeFakeTx({ existing: { id: 1 }, paymentCount: 1 });
		getDrizzle.mockResolvedValue(fakeDb(tx));

		await updateLending(1, 1, input);

		const payload = tx.calls.setPayloads[0];
		expect('amount' in payload).toBe(false);
		expect('date_lent' in payload).toBe(false);
		expect('status' in payload).toBe(false);
		expect(payload.borrower_name).toBe('Renamed');
		expect(payload.notes).toBe('new note');
		expect(payload.interest_rate).toBe('5');
		expect(payload.due_date).toBe('2026-12-31');
	});

	it('enforces ownership inside the transaction — no UPDATE for a missing lending', async () => {
		const tx = makeFakeTx({ existing: undefined, paymentCount: 0 });
		getDrizzle.mockResolvedValue(fakeDb(tx));

		await expect(updateLending(1, 999, input))
			.rejects.toThrow('Lending not found');
		expect(tx.update).not.toHaveBeenCalled();
	});
});

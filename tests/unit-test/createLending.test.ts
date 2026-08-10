import { describe, it, expect, beforeAll, vi } from 'vitest';

describe('createLending — Drizzle/Postgres structural (tx used, global db never touched)', () => {
	let getDrizzle: any;
	let createLending: (userId: number, input: any) => Promise<{ success: true }>;

	beforeAll(async () => {
		vi.doMock('$lib/server/db', () => ({
			getPgPool: vi.fn(),
			initDb: async () => {},
			closeDb: async () => {}
		}));
		vi.doMock('$lib/server/db/drizzle', () => ({
			getDrizzle: vi.fn()
		}));
		vi.resetModules();
		getDrizzle = (await import('$lib/server/db/drizzle')).getDrizzle;
		const mod = await import('$lib/server/services/lendingPayments');
		createLending = mod.createLending;
	});

	function fakeTx() {
		return {
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(async () => [])
				}))
			})),
			insert: vi.fn(() => ({
				values: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 7 }]) }))
			}))
		};
	}

	function fakeDb(tx: ReturnType<typeof fakeTx>) {
		return {
			transaction: vi.fn((cb: (t: typeof tx) => Promise<{ success: true }>) => cb(tx)),
			select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn() })) })),
			insert: vi.fn(() => ({ values: vi.fn() }))
		};
	}

	it('runs lending + category + transaction through db.transaction/tx and never the global db', async () => {
		const tx = fakeTx();
		const db = fakeDb(tx);
		getDrizzle.mockResolvedValue(db);

		const result = await createLending(1, {
			borrowerName: 'Alice', amount: 1000, interestRate: 0,
			dateLent: '2026-01-01', dueDate: null, notes: null,
			direction: 'lent', recordAsTransaction: true
		});

		expect(result.success).toBe(true);
		expect(db.transaction).toHaveBeenCalledTimes(1);
		// lending INSERT + category INSERT + transaction INSERT all via tx
		expect(tx.insert).toHaveBeenCalledTimes(3);
		// category lookup via tx.select
		expect(tx.select).toHaveBeenCalledTimes(1);
		// the global db was never touched inside the transaction
		expect(db.insert).not.toHaveBeenCalled();
		expect(db.select).not.toHaveBeenCalled();
	});

	it('creates only the lending via tx when recordAsTransaction=false', async () => {
		const tx = fakeTx();
		const db = fakeDb(tx);
		getDrizzle.mockResolvedValue(db);

		const result = await createLending(1, {
			borrowerName: 'Bob', amount: 2000, interestRate: 0,
			dateLent: '2026-01-01', dueDate: null, notes: null,
			direction: 'borrowed', recordAsTransaction: false
		});

		expect(result.success).toBe(true);
		expect(db.transaction).toHaveBeenCalledTimes(1);
		expect(tx.insert).toHaveBeenCalledTimes(1);
		expect(tx.select).not.toHaveBeenCalled();
		expect(db.insert).not.toHaveBeenCalled();
		expect(db.select).not.toHaveBeenCalled();
	});
});

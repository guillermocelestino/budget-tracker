import { describe, it, expect, beforeAll, vi } from 'vitest';

describe('deleteLending — Drizzle/Postgres structural (tx used, global db never touched)', () => {
	let getDrizzle: any;
	let deleteLending: (userId: number, lendingId: number) => Promise<boolean>;

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
		deleteLending = mod.deleteLending;
	});

	it('runs all reads and deletes through db.transaction/tx and never the global db', async () => {
		const tx = {
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(async () => [
						{ transaction_id: 10 },
						{ transaction_id: 20 }
					])
				}))
			})),
			delete: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 7 }]) })) }))
		};
		const db = {
			transaction: vi.fn((cb: (t: typeof tx) => Promise<boolean>) => cb(tx)),
			select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn() })) })),
			delete: vi.fn(() => ({ where: vi.fn() }))
		};
		getDrizzle.mockResolvedValue(db);

		const result = await deleteLending(1, 7);

		expect(result).toBe(true);
		expect(db.transaction).toHaveBeenCalledTimes(1);
		// Linked ids were found via tx.select, not db.select...
		expect(tx.select).toHaveBeenCalledTimes(1);
		// ...and both linked deletes + the lending delete went through tx.delete.
		expect(tx.delete).toHaveBeenCalledTimes(3);
		// The global db was never touched inside the transaction (Postgres would
		// otherwise use a different pooled connection and escape atomicity).
		expect(db.select).not.toHaveBeenCalled();
		expect(db.delete).not.toHaveBeenCalled();
	});

	it('returns false when the lending is not found (no row returned)', async () => {
		const tx = {
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(async () => [])
				}))
			})),
			delete: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => []) })) }))
		};
		const db = {
			transaction: vi.fn((cb: (t: typeof tx) => Promise<boolean>) => cb(tx)),
			select: vi.fn(),
			delete: vi.fn()
		};
		getDrizzle.mockResolvedValue(db);

		const result = await deleteLending(1, 999);

		expect(result).toBe(false);
		expect(db.transaction).toHaveBeenCalledTimes(1);
		expect(db.select).not.toHaveBeenCalled();
		expect(db.delete).not.toHaveBeenCalled();
	});
});

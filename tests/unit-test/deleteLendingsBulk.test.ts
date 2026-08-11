import { describe, it, expect, beforeAll, vi } from 'vitest';

describe('deleteLendings — Bulk deletion unit tests', () => {
	let getDrizzle: any;
	let deleteLendings: (userId: number, ids: number[]) => Promise<number>;
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
		deleteLendings = mod.deleteLendings;
		deleteLending = mod.deleteLending;
	});

	it('returns 0 immediately if empty IDs array provided without opening transaction', async () => {
		const db = {
			transaction: vi.fn()
		};
		getDrizzle.mockResolvedValue(db);

		const result = await deleteLendings(1, []);
		expect(result).toBe(0);
		expect(db.transaction).not.toHaveBeenCalled();
	});

	it('deletes multiple lendings and linked transactions atomically inside ONE transaction', async () => {
		const tx = {
			select: vi.fn((cols?: Record<string, unknown>) => ({
				from: vi.fn(() => ({
					where: vi.fn(async () => {
						// Ownership check returns owned IDs: 10, 20
						if (cols && 'id' in cols) {
							return [{ id: 10 }, { id: 20 }];
						}
						// Linked payments check
						return [{ transaction_id: 101 }];
					})
				}))
			})),
			delete: vi.fn(() => ({
				where: vi.fn(() => ({
					returning: vi.fn(async () => [{ id: 10 }, { id: 20 }])
				}))
			}))
		};
		const db = {
			transaction: vi.fn((cb: (t: typeof tx) => Promise<number>) => cb(tx)),
			select: vi.fn(),
			delete: vi.fn()
		};
		getDrizzle.mockResolvedValue(db);

		const count = await deleteLendings(1, [10, 20]);

		expect(count).toBe(2);
		expect(db.transaction).toHaveBeenCalledTimes(1);
		// Global db never touched
		expect(db.select).not.toHaveBeenCalled();
		expect(db.delete).not.toHaveBeenCalled();
	});

	it('throws error and rolls back if any requested ID is not owned by the user', async () => {
		const tx = {
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(async () => [
						{ id: 10 } // Only 10 is owned, 999 is missing
					])
				}))
			})),
			delete: vi.fn()
		};
		const db = {
			transaction: vi.fn((cb: (t: typeof tx) => Promise<number>) => cb(tx)),
			select: vi.fn(),
			delete: vi.fn()
		};
		getDrizzle.mockResolvedValue(db);

		await expect(deleteLendings(1, [10, 999])).rejects.toThrow(
			'One or more lending IDs are invalid or do not belong to this user'
		);

		// Delete was never called because ownership check failed
		expect(tx.delete).not.toHaveBeenCalled();
	});

	it('single delete regression: deleteLending still functions correctly', async () => {
		const tx = {
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(async () => [])
				}))
			})),
			delete: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 5 }]) })) }))
		};
		const db = {
			transaction: vi.fn((cb: (t: typeof tx) => Promise<boolean>) => cb(tx)),
			select: vi.fn(),
			delete: vi.fn()
		};
		getDrizzle.mockResolvedValue(db);

		const res = await deleteLending(1, 5);
		expect(res).toBe(true);
	});
});

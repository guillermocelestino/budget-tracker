import { describe, it, expect, beforeAll, vi } from 'vitest';

describe('deleteRecurringTransactions — Bulk deletion unit tests', () => {
	let getDrizzle: any;
	let deleteRecurringTransactions: (userId: number, ids: number[]) => Promise<number>;
	let deleteRecurringTransaction: (userId: number, id: number) => Promise<boolean>;

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
		const mod = await import('$lib/server/services/recurringService');
		deleteRecurringTransactions = mod.deleteRecurringTransactions;
		deleteRecurringTransaction = mod.deleteRecurringTransaction;
	});

	it('returns 0 immediately if empty IDs array provided', async () => {
		const db = {
			transaction: vi.fn(),
			select: vi.fn(),
			delete: vi.fn()
		};
		getDrizzle.mockResolvedValue(db);

		const result = await deleteRecurringTransactions(1, []);
		expect(result).toBe(0);
		expect(db.transaction).not.toHaveBeenCalled();
	});

	it('deletes multiple recurring transactions atomically when all IDs are owned by the user', async () => {
		const tx = {
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(async () => [{ id: 1 }, { id: 2 }])
				}))
			})),
			delete: vi.fn(() => ({
				where: vi.fn(() => ({
					returning: vi.fn(async () => [{ id: 1 }, { id: 2 }])
				}))
			}))
		};
		const db = {
			transaction: vi.fn((cb: (t: typeof tx) => Promise<number>) => cb(tx)),
			select: vi.fn(),
			delete: vi.fn()
		};
		getDrizzle.mockResolvedValue(db);

		const count = await deleteRecurringTransactions(1, [1, 2]);
		expect(count).toBe(2);
		expect(db.transaction).toHaveBeenCalledTimes(1);
		expect(tx.select).toHaveBeenCalledTimes(1);
		expect(tx.delete).toHaveBeenCalledTimes(1);
		expect(db.select).not.toHaveBeenCalled();
		expect(db.delete).not.toHaveBeenCalled();
	});

	it('throws error and does not execute delete if any ID is not owned by the user', async () => {
		const tx = {
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(async () => [{ id: 1 }]) // ID 999 is missing
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

		await expect(deleteRecurringTransactions(1, [1, 999])).rejects.toThrow(
			'One or more recurring transaction IDs are invalid or do not belong to this user'
		);

		expect(tx.delete).not.toHaveBeenCalled();
	});

	it('single delete regression: deleteRecurringTransaction still functions correctly', async () => {
		const db = {
			delete: vi.fn(() => ({
				where: vi.fn(() => ({
					returning: vi.fn(async () => [{ id: 1 }])
				}))
			}))
		};
		getDrizzle.mockResolvedValue(db);

		const result = await deleteRecurringTransaction(1, 1);
		expect(result).toBe(true);
	});
});

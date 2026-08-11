import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

describe('networth — Drizzle / Postgres path (recorded fake client)', () => {
	let computeNetWorth: typeof import('$lib/server/services/networth').computeNetWorth;
	let calls: { selects: { table: string; cols: string[] }[] };

	function fakeDb() {
		// Generic thenable query chain. Every builder method returns the same
		// chain so Drizzle's fluent API (from/leftJoin/on/where/groupBy/orderBy/
		// limit) keeps working; awaiting the chain resolves to an empty row set.
		const chain: any = {
			leftJoin() { return chain; },
			on() { return chain; },
			where() { return chain; },
			groupBy() { return chain; },
			orderBy() { return chain; },
			limit() { return chain; }
		};
		chain.then = (onFulfilled: any, onRejected: any) =>
			Promise.resolve([]).then(onFulfilled, onRejected);
		return {
			select(cols?: Record<string, unknown>) {
				const colNames = cols ? Object.keys(cols) : [];
				return {
					from(table: { name?: string }) {
						const tableName = table?.name ?? 'unknown';
						calls.selects.push({ table: tableName, cols: colNames });
						return chain;
					}
				};
			}
		};
	}

	beforeAll(async () => {
		vi.doMock('$lib/server/db', () => ({
			getPgPool: () => Promise.reject(new Error('getPgPool should not be called on Drizzle path')),
			initDb: async () => {},
			closeDb: async () => {}
		}));
		vi.doMock('$lib/server/db/drizzle', () => ({
			getDrizzle: () => Promise.resolve(fakeDb())
		}));
		vi.resetModules();
		const svc = await import('$lib/server/services/networth');
		computeNetWorth = svc.computeNetWorth;
	});

	beforeEach(() => {
		calls = { selects: [] };
	});

	it('computeNetWorth issues 5 selects (one per helper) and returns a NetWorthSnapshot', async () => {
		const result = await computeNetWorth(42);
		expect(calls.selects).toHaveLength(5);
		// Verify the column sets selected by each helper:
		// getCashPosition → ['income','expense'], getLentPosition → ['total'],
		// getBorrowedPosition → ['total'], getMonthlyCashFlow → ['month','income','expense'],
		// getUpcomingBorrowedPayments → ['total']
		const colSets = calls.selects.map(s => s.cols.join(','));
		expect(colSets).toContain('income,expense');
		expect(colSets).toContain('month,income,expense');
		expect(colSets.filter(c => c === 'total')).toHaveLength(3);
		expect(result).toHaveProperty('net');
		expect(result).toHaveProperty('legs');
		expect(result).toHaveProperty('cashTrend');
		expect(result).toHaveProperty('lentToday');
		expect(result).toHaveProperty('borrowedToday');
		expect(result).toHaveProperty('caption');
		expect(result).toHaveProperty('projection');
		expect(result).toHaveProperty('biggestMover');
	});

	it('computeNetWorth returns zero net worth when all aggregates are empty', async () => {
		const result = await computeNetWorth(42);
		expect(result.net).toBe(0);
		expect(result.legs).toHaveLength(1);
		expect(result.legs[0]!.key).toBe('cash');
		expect(result.legs[0]!.amount).toBe(0);
	});
});
import { describe, it, expect } from 'vitest';

describe('GET WRECK Command Center Data Contract', () => {
	it('defines the 4 GET WRECK modalities shape', () => {
		const commandCenter = {
			moneyGone: {
				totalExpenses: 42300,
				wreckedToday: 1500,
			},
			moneyAway: {
				totalLent: 50000,
				totalRecovered: 14700,
				outstanding: 35300,
			},
			moneyCommitted: {
				monthlyCommittedTotal: 10000,
				debtOwed: 8250,
				totalCommitted: 18250,
			},
			truePosition: {
				net: 145800,
				cash: 120500,
				lentActive: 35300,
				borrowedActive: 10000,
			},
		};

		expect(commandCenter.moneyGone.totalExpenses).toBe(42300);
		expect(commandCenter.moneyAway.outstanding).toBe(35300);
		expect(commandCenter.moneyCommitted.totalCommitted).toBe(18250);
		expect(commandCenter.truePosition.net).toBe(145800);
	});
});

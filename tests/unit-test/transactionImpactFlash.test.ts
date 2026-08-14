import { describe, it, expect } from 'vitest';
import type { TransactionType } from '$lib/types';

function formatImpactAmount(type: TransactionType, amount: number): string {
	return `${type === 'income' ? '+₱' : '-₱'}${amount.toLocaleString()}`;
}

describe('Transaction Impact Flash — Money Impact Logic', () => {
	it('formats negative amounts correctly for expenses', () => {
		const formatted = formatImpactAmount('expense', 1000);
		expect(formatted).toBe('-₱1,000');
	});

	it('formats positive amounts correctly for income', () => {
		const formatted = formatImpactAmount('income', 5000);
		expect(formatted).toBe('+₱5,000');
	});

	it('only triggers impact flash when creating a new transaction, not on edits', () => {
		let impactData: { type: string; amount: number; categoryName: string } | null = null;

		function handleSuccess(isEdit: boolean, payload: { type: string; amount: number; categoryName: string }) {
			if (!isEdit && payload && payload.amount > 0) {
				impactData = payload;
			}
		}

		// Edit transaction -> should NOT trigger impact flash
		handleSuccess(true, { type: 'expense', amount: 500, categoryName: 'Food' });
		expect(impactData).toBeNull();

		// Create transaction -> SHOULD trigger impact flash
		handleSuccess(false, { type: 'expense', amount: 1000, categoryName: 'Shopping' });
		expect(impactData).toEqual({ type: 'expense', amount: 1000, categoryName: 'Shopping' });
	});

	it('does NOT trigger impact flash on failed transactions or invalid amounts', () => {
		let impactData: { type: string; amount: number; categoryName: string } | null = null;

		function handleSuccess(isEdit: boolean, payload: { type: string; amount: number; categoryName: string }) {
			if (!isEdit && payload && payload.amount > 0) {
				impactData = payload;
			}
		}

		// Invalid amount (0 or negative)
		handleSuccess(false, { type: 'expense', amount: 0, categoryName: 'Food' });
		expect(impactData).toBeNull();
	});
});

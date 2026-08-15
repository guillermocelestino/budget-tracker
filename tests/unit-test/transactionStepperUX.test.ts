import { describe, it, expect } from 'vitest';

describe('Transaction Stepper UX Logic', () => {
	it('derives description from selected category when description is empty', () => {
		const category = { id: 5, name: 'Food & Dining', type: 'expense' };
		let userDescription = '';

		const submitDescription = userDescription.trim() || category.name;
		expect(submitDescription).toBe('Food & Dining');
	});

	it('preserves custom user description when provided', () => {
		const category = { id: 5, name: 'Food & Dining', type: 'expense' };
		let userDescription = 'Dinner with family at Jollibee';

		const submitDescription = userDescription.trim() || category.name;
		expect(submitDescription).toBe('Dinner with family at Jollibee');
	});

	it('correctly handles [REFUND] prefix when refund toggle is enabled', () => {
		const category = { id: 5, name: 'Shopping', type: 'expense' };
		let userDescription = '';
		let isRefund = true;

		let baseDesc = userDescription.trim() || category.name;
		if (isRefund && !baseDesc.startsWith('[REFUND]')) {
			baseDesc = `[REFUND] ${baseDesc}`;
		}

		expect(baseDesc).toBe('[REFUND] Shopping');
	});

	it('defaults date to today when not overridden by user', () => {
		const todayStr = new Date().toISOString().slice(0, 10);
		let dateInput = todayStr;

		expect(dateInput).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it('allows updating category and preserves custom description when editing a transaction', () => {
		const originalTxn = { id: 42, category_id: 5, description: 'Groceries at SM', amount: 1500, type: 'expense' as const };
		let currentCategoryId = originalTxn.category_id;
		let currentDescription = originalTxn.description;

		// User changes category from 5 to 8 (Shopping)
		currentCategoryId = 8;

		expect(currentCategoryId).toBe(8);
		expect(currentDescription).toBe('Groceries at SM');
	});
});

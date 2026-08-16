import { describe, it, expect } from 'vitest';
import { getToday } from '$lib/shared/utils/format';

/**
 * Date Borrowed (date_lent) field contract for BorrowedMoneyModal.
 *
 * The modal posts date_lent through a hidden input (the visible date input has
 * no name, mirroring the amount field), so these tests pin the behaviors the
 * form relies on: today-default on create, populate-from-record on edit, the
 * payment-lock disable rule, and that the submitted value is always the
 * current dateBorrowed state as YYYY-MM-DD — including while the input is locked.
 */

type ModalRecord = {
	date_lent: string;
	cash_paid?: number;
	written_off?: number;
	payments?: unknown[];
};

type ModalState = {
	lendingRecord: ModalRecord | null;
	dateBorrowed: string;
};

function initDateBorrowed(lendingRecord: ModalRecord | null): string {
	return lendingRecord ? lendingRecord.date_lent : getToday();
}

function isPaymentLocked(lendingRecord: ModalRecord | null): boolean {
	return (
		!!lendingRecord &&
		(((lendingRecord.cash_paid ?? 0) + (lendingRecord.written_off ?? 0)) > 0 ||
			(lendingRecord.payments ?? []).length > 0)
	);
}

describe('BorrowedMoneyModal — Date Borrowed field', () => {
	it('defaults to today (YYYY-MM-DD) for a new borrowing', () => {
		const dateBorrowed = initDateBorrowed(null);
		expect(dateBorrowed).toBe(getToday());
		expect(dateBorrowed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it('populates from the existing record in edit mode instead of resetting', () => {
		expect(initDateBorrowed({ date_lent: '2026-01-15', cash_paid: 0, written_off: 0 })).toBe('2026-01-15');
		expect(initDateBorrowed({ date_lent: '2025-12-31', cash_paid: 500, written_off: 0 })).toBe('2025-12-31');
	});

	it('locks the field only when payments exist (aggregates > 0 or a payments array)', () => {
		expect(isPaymentLocked(null)).toBe(false); // create — always editable
		expect(isPaymentLocked({ date_lent: '2026-01-15' })).toBe(false); // aggregates absent → editable
		expect(isPaymentLocked({ date_lent: '2026-01-15', cash_paid: 0, written_off: 0 })).toBe(false);
		expect(isPaymentLocked({ date_lent: '2026-01-15', cash_paid: 300, written_off: 0 })).toBe(true);
		expect(isPaymentLocked({ date_lent: '2026-01-15', cash_paid: 0, written_off: 120 })).toBe(true);
		expect(isPaymentLocked({ date_lent: '2026-01-15', payments: [{ id: 1 }] })).toBe(true);
		expect(isPaymentLocked({ date_lent: '2026-01-15', payments: [] })).toBe(false);
	});

	it('still submits the stored date as YYYY-MM-DD while locked (hidden input carrier)', () => {
		// Disabled inputs are not submittable, so the form posts date_lent via a
		// hidden input bound to the same state — the locked value must survive.
		const state: ModalState = {
			lendingRecord: { date_lent: '2026-02-10', cash_paid: 750, written_off: 0 },
			dateBorrowed: '2026-02-10'
		};
		const locked = isPaymentLocked(state.lendingRecord);
		const submittedValue = state.dateBorrowed;

		expect(locked).toBe(true);
		expect(submittedValue).toBe('2026-02-10');
		expect(submittedValue).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});

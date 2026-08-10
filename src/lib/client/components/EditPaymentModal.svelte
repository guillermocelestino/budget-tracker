<script lang="ts">
	import { enhance } from '$app/forms';
	import { showSuccess, showError } from '$lib/client/stores/toast.svelte';
	import { formatCurrency } from '$lib/client/utils/format';
import { formatWithCommas } from '$lib/shared/utils/format';
	import ModalDialog from '$lib/client/components/ModalDialog.svelte';
	import Button from '$lib/client/components/Button.svelte';
	import type { LendingWithPayments, LendingPayment } from '$lib/types';

	let {
		lending,
		payment,
		direction = 'lent',
		onclose,
	}: {
		lending: LendingWithPayments;
		payment: LendingPayment;
		direction?: 'lent' | 'borrowed';
		onclose?: () => void;
	} = $props();

	let rawAmount = $state(payment.amount.toString());
	let paymentDate = $state(payment.payment_date);
	let notes = $state(payment.notes ?? '');

	const displayAmount = $derived(rawAmount ? formatWithCommas(rawAmount) : '');

	// Live remaining preview (excluding this payment's current contribution)
	const inputAmount = $derived(rawAmount ? parseFloat(rawAmount) || 0 : 0);
	const otherResolved = $derived(lending.resolved_total - payment.amount);
	const remainingAfter = $derived(Math.max(lending.amount - otherResolved - inputAmount, 0));
	const newResolvedTotal = $derived(otherResolved + inputAmount);
	const progressPct = $derived(lending.amount > 0 ? Math.min((newResolvedTotal / lending.amount) * 100, 100) : 0);

	function onAmountInput(e: Event) {
		const input = e.target as HTMLInputElement;
		let raw = input.value.replace(/[^0-9.]/g, '');
		const dots = raw.match(/\./g);
		if (dots && dots.length > 1) raw = raw.slice(0, raw.lastIndexOf('.'));
		rawAmount = raw;
		input.value = raw ? formatWithCommas(raw) : '';
	}

	function onAmountFocus(e: Event) {
		const input = e.target as HTMLInputElement;
		input.value = rawAmount;
		const len = input.value.length;
		input.setSelectionRange(len, len);
	}

	function onAmountBlur(e: Event) {
		const input = e.target as HTMLInputElement;
		if (rawAmount) {
			const num = parseFloat(rawAmount);
			if (!isNaN(num)) {
				input.value = formatWithCommas(num % 1 === 0 ? String(num) : num.toFixed(2));
			}
		}
	}

	function handleEnhance() {
		return async ({ result, update }: { result: { type: string; data?: { error?: string } }; update: () => Promise<void> }) => {
			if (result.type === 'success') {
				showSuccess('Payment updated successfully');
				onclose?.();
			} else if (result.type === 'failure') {
				showError(result.data?.error || 'An error occurred');
			}
			await update();
		};
	}
</script>

<ModalDialog open={true} onclose={onclose} title="Edit Payment">
	<div class="modal-icon-wrap">
		<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
		</svg>
	</div>

	<div class="payment-summary">
		<div class="summary-row">
			<span class="summary-label">Original</span>
			<span class="summary-value">{formatCurrency(lending.amount)}</span>
		</div>
		<div class="summary-row">
			<span class="summary-label">{direction === 'lent' ? 'Collected' : 'Repaid'}</span>
			<span class="summary-value muted">{formatCurrency(lending.cash_paid)}</span>
		</div>
		<div class="summary-row remaining">
			<span class="summary-label">Remaining</span>
			<span class="summary-value" class:teal={direction === 'lent'} class:rose={direction === 'borrowed'}>
				{formatCurrency(lending.remaining)}
			</span>
		</div>
	</div>

	<form method="POST" action="?/updatePayment" use:enhance={handleEnhance}>
		<input type="hidden" name="payment_id" value={payment.id} />
		<input type="hidden" name="amount" value={rawAmount} />

		<div class="form-group">
			<label class="form-label" for="edit_amount">Payment Amount</label>
			<div class="amount-wrap">
				<span class="amount-prefix">₱</span>
				<input
					id="edit_amount"
					type="text"
					inputmode="decimal"
					required
					placeholder="0.00"
					value={displayAmount}
					oninput={onAmountInput}
					onfocus={onAmountFocus}
					onblur={onAmountBlur}
					autocomplete="off"
				/>
			</div>
		</div>

		<div class="form-group">
			<label class="form-label" for="edit_date">Payment Date</label>
			<input
				id="edit_date"
				name="payment_date"
				type="date"
				required
				bind:value={paymentDate}
			/>
		</div>

		<div class="form-group">
			<label class="form-label" for="edit_notes">Notes</label>
			<textarea
				id="edit_notes"
				name="notes"
				rows="2"
				placeholder="Optional notes"
				bind:value={notes}
			></textarea>
		</div>

		<div class="remaining-preview">
			<div class="preview-row">
				<span class="preview-label">Remaining after payment</span>
				<span class="preview-value">{formatCurrency(remainingAfter)}</span>
			</div>
			<div class="progress-section">
				<div class="progress-track">
					<div class="progress-fill" style="width: {progressPct}%;"></div>
				</div>
				<span class="progress-text">
					{formatCurrency(newResolvedTotal)} of {formatCurrency(lending.amount)} ({Math.round(progressPct)}% paid)
				</span>
			</div>
		</div>

		<div class="modal-actions">
			<Button variant="teal" type="submit">Update Payment</Button>
			<Button variant="ghost" type="button" onclick={onclose}>Cancel</Button>
		</div>
	</form>
</ModalDialog>

<style>
	.modal-icon-wrap {
		width: 64px;
		height: 64px;
		margin: 0 auto var(--space-md);
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, var(--color-teal-bg) 0%, rgba(16, 185, 129, 0.1) 100%);
		color: var(--color-teal);
		border-radius: var(--radius-lg);
	}

	.payment-summary {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: var(--space-sm) var(--space-md);
		background: var(--color-bg);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-md);
		margin-bottom: var(--space-md);
	}

	.summary-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.summary-label {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	.summary-value {
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--color-text);
	}

	.summary-value.muted {
		color: var(--color-text-muted);
	}

	.summary-row.remaining {
		padding-top: 4px;
		border-top: 1px dashed var(--color-border);
		margin-top: 2px;
	}

	.summary-value.teal {
		color: var(--color-teal);
	}

	.summary-value.rose {
		color: var(--color-rose);
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: var(--space-md);
	}

	.form-label {
		font-family: var(--font-display);
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-text);
		letter-spacing: 0.02em;
	}

	.form-group input,
	.form-group textarea {
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-md);
		font-size: var(--font-size-base);
		font-family: var(--font-body);
		background: var(--color-cream);
		color: var(--color-text);
		width: 100%;
		min-height: 44px;
		transition: border-color 200ms var(--ease), box-shadow 200ms var(--ease);
		appearance: none;
		-webkit-appearance: none;
	}

	.form-group input:focus,
	.form-group textarea:focus {
		outline: none;
		border-color: var(--color-teal);
		box-shadow: var(--focus);
	}

	.form-group textarea {
		min-height: 80px;
		resize: vertical;
	}

	.amount-wrap {
		display: flex;
		align-items: stretch;
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-md);
		background: var(--color-cream);
		overflow: hidden;
		transition: border-color 200ms var(--ease), box-shadow 200ms var(--ease);
	}

	.amount-wrap:focus-within {
		border-color: var(--color-teal);
		box-shadow: var(--focus);
	}

	.amount-prefix {
		display: flex;
		align-items: center;
		padding: 0 12px 0 16px;
		font-family: var(--font-display);
		font-size: 22px;
		font-weight: 700;
		color: var(--color-text-muted);
		background: transparent;
	}

	.amount-wrap input {
		border: none !important;
		background: transparent !important;
		font-family: var(--font-display);
		font-size: 24px;
		font-weight: 700;
		color: var(--color-text);
		padding: 8px 16px 8px 0;
		min-height: 48px;
		box-shadow: none !important;
		letter-spacing: -0.01em;
	}

	.remaining-preview {
		padding: var(--space-sm) var(--space-md);
		background: var(--color-bg);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-md);
		margin-bottom: var(--space-md);
	}

	.preview-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--space-sm);
	}

	.preview-label {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	.preview-value {
		font-family: var(--font-mono);
		font-size: var(--font-size-base);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--color-text);
	}

	.progress-section {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.progress-track {
		height: 6px;
		background: var(--color-hairline);
		border-radius: var(--radius-pill);
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: var(--color-teal);
		border-radius: var(--radius-pill);
		transition: width 300ms var(--ease);
	}

	.progress-text {
		font-family: var(--font-mono);
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		font-variant-numeric: tabular-nums;
	}

	.modal-actions {
		display: flex;
		gap: var(--space-sm);
		margin-top: var(--space-lg);
	}

	.modal-actions :global(.btn) {
		flex: 1;
	}
</style>
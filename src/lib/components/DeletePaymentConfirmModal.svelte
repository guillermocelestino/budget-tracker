<script lang="ts">
	import { enhance } from '$app/forms';
	import { showSuccess, showError } from '$lib/stores/toast.svelte';
	import { formatCurrency, formatDate } from '$lib/utils/format';
	import ModalDialog from '$lib/components/ModalDialog.svelte';
	import Button from '$lib/components/Button.svelte';
	import type { LendingPayment } from '$lib/types';

	let {
		payment,
		onclose,
	}: {
		payment: LendingPayment;
		onclose?: () => void;
	} = $props();

	const hasTransaction = $derived(payment.transaction_id !== null);

	function handleEnhance() {
		return async ({ result, update }: { result: { type: string; data?: { error?: string } }; update: () => Promise<void> }) => {
			if (result.type === 'success') {
				showSuccess('Payment deleted successfully');
				onclose?.();
			} else if (result.type === 'failure') {
				showError(result.data?.error || 'An error occurred');
			}
			await update();
		};
	}
</script>

<ModalDialog open={true} onclose={onclose} title="Delete Payment">
	<div class="modal-icon-wrap danger">
		<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<polyline points="3 6 5 6 21 6"/>
			<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
		</svg>
	</div>

	<p class="modal-desc">
		Are you sure you want to delete this payment?
	</p>

	<div class="payment-info">
		<div class="info-row">
			<span class="info-label">Date</span>
			<span class="info-value">{formatDate(payment.payment_date)}</span>
		</div>
		<div class="info-row">
			<span class="info-label">Amount</span>
			<span class="info-value">{formatCurrency(payment.amount)}</span>
		</div>
		{#if payment.notes}
			<div class="info-row">
				<span class="info-label">Notes</span>
				<span class="info-value">{payment.notes}</span>
			</div>
		{/if}
	</div>

	{#if hasTransaction}
		<div class="warning-box">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
				<line x1="12" y1="9" x2="12" y2="13"/>
				<line x1="12" y1="17" x2="12.01" y2="17"/>
			</svg>
			<span>This will also delete the linked transaction.</span>
		</div>
	{:else}
		<div class="warning-box info">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="12" r="10"/>
				<line x1="12" y1="16" x2="12" y2="12"/>
				<line x1="12" y1="8" x2="12.01" y2="8"/>
			</svg>
			<span>No linked transaction to delete.</span>
		</div>
	{/if}

	<form method="POST" action="?/deletePayment" use:enhance={handleEnhance}>
		<input type="hidden" name="payment_id" value={payment.id} />
		<div class="modal-actions">
			<Button variant="danger" type="submit">Delete</Button>
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
		background: linear-gradient(135deg, var(--color-expense-light) 0%, rgba(239, 68, 68, 0.1) 100%);
		color: var(--color-expense);
		border-radius: var(--radius-lg);
	}

	.modal-desc {
		text-align: center;
		margin-bottom: var(--space-md);
		font-size: var(--font-size-base);
		color: var(--color-text);
	}

	.payment-info {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: var(--space-sm) var(--space-md);
		background: var(--color-bg);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-md);
		margin-bottom: var(--space-md);
	}

	.info-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.info-label {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	.info-value {
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--color-text);
	}

	.warning-box {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		background: var(--color-expense-light);
		border: 1px solid rgba(239, 68, 68, 0.2);
		border-radius: var(--radius-md);
		color: var(--color-expense);
		font-size: var(--font-size-sm);
		font-weight: 600;
		margin-bottom: var(--space-md);
	}

	.warning-box.info {
		background: var(--color-bg);
		border-color: var(--color-hairline);
		color: var(--color-text-muted);
		font-weight: 400;
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
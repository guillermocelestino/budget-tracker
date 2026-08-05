<script lang="ts">
	import { formatCurrency, formatDate } from '$lib/utils/format';
	import Button from '$lib/components/Button.svelte';
	import type { LendingWithPayments, LendingPayment } from '$lib/types';

	let {
		lending,
		payments = [],
		direction = 'lent',
		onRecordPayment,
		onEditPayment,
		onDeletePayment,
	}: {
		lending: LendingWithPayments;
		payments: LendingPayment[];
		direction?: 'lent' | 'borrowed';
		onRecordPayment?: () => void;
		onEditPayment?: (paymentId: number) => void;
		onDeletePayment?: (paymentId: number) => void;
	} = $props();

	// Running remaining is derived during rendering from chronological payment history.
	// It is never stored. We reverse the payments (oldest first) to compute the running
	// balance, then reverse back for display (newest first).
	const paymentsChronological = $derived([...payments].reverse());

	const progressPct = $derived(
		lending.amount > 0 ? Math.min((lending.resolved_total / lending.amount) * 100, 100) : 0
	);

	const isComplete = $derived(lending.remaining <= 0);

	// Compute running remaining for each payment (chronological)
	const paymentsWithRunning = $derived.by(() => {
		let running = lending.amount;
		return paymentsChronological.map(p => {
			running -= p.amount;
			return { ...p, runningRemaining: Math.max(running, 0) };
		});
	});

	// Reverse back for display (newest first)
	const displayPayments = $derived([...paymentsWithRunning].reverse());
</script>

<div class="payment-history-panel">
	<!-- Header summary -->
	<div class="history-header">
		<h3 class="history-name">{lending.borrower_name}</h3>
		<div class="history-summary">
			<div class="summary-item">
				<span class="summary-label">Original</span>
				<span class="summary-value">{formatCurrency(lending.amount)}</span>
			</div>
			<div class="summary-item">
				<span class="summary-label">{direction === 'lent' ? 'Collected' : 'Repaid'}</span>
				<span class="summary-value muted">{formatCurrency(lending.cash_paid)}</span>
			</div>
			{#if lending.written_off > 0}
				<div class="summary-item">
					<span class="summary-label">Written Off</span>
					<span class="summary-value muted">{formatCurrency(lending.written_off)}</span>
				</div>
			{/if}
			<div class="summary-item remaining">
				<span class="summary-label">Remaining</span>
				<span class="summary-value" class:teal={direction === 'lent'} class:rose={direction === 'borrowed'}>
					{formatCurrency(lending.remaining)}
				</span>
			</div>
		</div>

		<!-- Progress bar -->
		<div class="history-progress">
			<div class="progress-track">
				<div class="progress-fill" style="width: {progressPct}%;"></div>
			</div>
			<span class="progress-text">
				{formatCurrency(lending.resolved_total)} of {formatCurrency(lending.amount)} ({Math.round(progressPct)}% paid)
			</span>
		</div>
	</div>

	<!-- Record Payment button (hidden when complete) -->
	{#if !isComplete}
		<div class="record-payment-section">
			<Button variant="teal" onclick={onRecordPayment}>
				<span class="btn-lead">+</span>
				Record Payment
			</Button>
		</div>
	{/if}

	<!-- Payment history list -->
	{#if displayPayments.length === 0}
		<div class="empty-history">
			<p>No payments recorded yet</p>
		</div>
	{:else}
		<div class="payment-list">
			<div class="list-header">Payment History</div>
			{#each displayPayments as payment (payment.id)}
				<div class="payment-row" class:write-off={payment.payment_type === 'write_off'}>
					<div class="payment-row-main">
						<div class="payment-date">{formatDate(payment.payment_date)}</div>
						<div class="payment-type-label">
							{payment.payment_type === 'write_off' ? 'Write-off' : 'Payment'}
						</div>
						<div class="payment-amount">{formatCurrency(payment.amount)}</div>
						{#if payment.notes}
							<div class="payment-notes">{payment.notes}</div>
						{/if}
						{#if payment.transaction_id}
							<div class="payment-tx-link">
								<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
									<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
								</svg>
								Transaction linked
							</div>
						{/if}
					</div>
					<div class="payment-row-aside">
						<div class="running-remaining">
							<span class="rr-label">Remaining</span>
							<span class="rr-value">{formatCurrency(payment.runningRemaining)}</span>
						</div>
						<div class="payment-actions">
							<button
								class="payment-action-btn"
								onclick={() => onEditPayment?.(payment.id)}
								aria-label="Edit payment"
								type="button"
							>
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
							</button>
							<button
								class="payment-action-btn danger"
								onclick={() => onDeletePayment?.(payment.id)}
								aria-label="Delete payment"
								type="button"
							>
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.payment-history-panel {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.history-header {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.history-name {
		font-family: var(--font-display);
		font-size: var(--font-size-lg);
		font-weight: 700;
		color: var(--color-ink);
		margin: 0;
	}

	.history-summary {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: var(--space-sm) var(--space-md);
		background: var(--color-bg);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-md);
	}

	.summary-item {
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

	.summary-item.remaining {
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

	.history-progress {
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

	.record-payment-section {
		display: flex;
		justify-content: center;
	}

	.btn-lead {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 18px;
		height: 18px;
		font-weight: var(--font-weight-extrabold);
	}

	.empty-history {
		text-align: center;
		padding: var(--space-xl) var(--space-md);
		color: var(--color-text-muted);
		font-style: italic;
		font-size: var(--font-size-sm);
	}

	.payment-list {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.list-header {
		font-family: var(--font-display);
		font-size: var(--font-size-xs);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-muted);
		padding: var(--space-sm) 0;
		border-bottom: 1px solid var(--color-hairline);
	}

	.payment-row {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--space-sm);
		padding: var(--space-sm) 0;
		border-bottom: 1px solid var(--color-hairline);
	}

	.payment-row:last-child {
		border-bottom: none;
	}

	.payment-row.write-off .payment-type-label {
		color: var(--color-amber-dark, #b45309);
	}

	.payment-row-main {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		flex: 1;
	}

	.payment-date {
		font-family: var(--font-mono);
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		font-variant-numeric: tabular-nums;
	}

	.payment-type-label {
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-text);
	}

	.payment-amount {
		font-family: var(--font-mono);
		font-size: var(--font-size-base);
		font-weight: 700;
		color: var(--color-text);
		font-variant-numeric: tabular-nums;
	}

	.payment-notes {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		margin-top: 2px;
	}

	.payment-tx-link {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: var(--font-size-xs);
		color: var(--color-teal);
		margin-top: 2px;
	}

	.payment-row-aside {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: var(--space-xs);
		flex-shrink: 0;
	}

	.running-remaining {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0;
	}

	.rr-label {
		font-size: 9px;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.rr-value {
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-text-muted);
		font-variant-numeric: tabular-nums;
	}

	.payment-actions {
		display: flex;
		gap: 4px;
		opacity: 0;
		transition: opacity 150ms ease;
	}

	.payment-row:hover .payment-actions {
		opacity: 1;
	}

	.payment-action-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: all 120ms ease;
	}

	.payment-action-btn:hover {
		background: var(--color-bg);
		color: var(--color-text);
	}

	.payment-action-btn.danger:hover {
		background: var(--color-expense-light);
		color: var(--color-expense);
	}
</style>
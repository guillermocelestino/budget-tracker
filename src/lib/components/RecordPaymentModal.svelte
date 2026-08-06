<script lang="ts">
	import { enhance } from '$app/forms';
	import { fade } from 'svelte/transition';
	import { showSuccess, showError } from '$lib/stores/toast.svelte';
	import { formatCurrency, formatWithCommas, formatDate, getToday } from '$lib/utils/format';
	import ModalDialog from '$lib/components/ModalDialog.svelte';
	import Button from '$lib/components/Button.svelte';
	import type { LendingWithPayments, PaymentType } from '$lib/types';

	let {
		lending,
		direction = 'lent',
		onclose,
	}: {
		lending: LendingWithPayments;
		direction?: 'lent' | 'borrowed';
		onclose?: () => void;
	} = $props();

	let rawAmount = $state('');
	let paymentDate = $state(getToday());
	let notes = $state('');
	let createTransaction = $state(true);
	let paymentType = $state<PaymentType>('payment');
	let submitting = $state(false);

	// Preview value element + last rendered value (drives the subtle opacity pulse)
	let previewValueEl = $state<HTMLElement | null>(null);
	let prevPreviewValue = $state<number | null>(null);

	const displayAmount = $derived(rawAmount ? formatWithCommas(rawAmount) : '');

	// Live remaining preview
	const inputAmount = $derived(rawAmount ? parseFloat(rawAmount) || 0 : 0);
	const remainingAfter = $derived(Math.max(lending.remaining - inputAmount, 0));
	const newResolvedTotal = $derived(lending.resolved_total + inputAmount);
	const progressPct = $derived(lending.amount > 0 ? Math.min((newResolvedTotal / lending.amount) * 100, 100) : 0);

	const isWriteOff = $derived(paymentType === 'write_off');
	const showCreateTransaction = $derived(!isWriteOff);
	const isSettling = $derived(
		inputAmount > 0 && lending.remaining > 0 && inputAmount <= lending.remaining && remainingAfter === 0
	);
	const amountHelperInvalid = $derived(inputAmount > lending.remaining);

	const initials = $derived(
		lending.borrower_name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((w) => w[0].toUpperCase())
			.join('') || '?'
	);

	// Contextual helper text — display only, validation is untouched
	const amountHelper = $derived.by(() => {
		if (inputAmount === 0) {
			return `Available to record: ${formatCurrency(lending.remaining)}`;
		}
		if (amountHelperInvalid) {
			return 'Cannot exceed remaining balance.';
		}
		if (remainingAfter === 0) {
			return isWriteOff
				? 'This write-off will clear this lending.'
				: 'This payment will complete this lending.';
		}
		return `You'll still have ${formatCurrency(remainingAfter)} remaining.`;
	});

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
				input.value = formatWithCommas(
					num % 1 === 0 ? String(num) : num.toFixed(2)
				);
			}
		}
	}

	// Subtle opacity pulse on the preview value whenever it changes (CSS transition only — no JS animation)
	$effect(() => {
		const el = previewValueEl;
		if (!el) return;
		const value = remainingAfter;
		if (prevPreviewValue !== null && value === prevPreviewValue) return;
		prevPreviewValue = value;
		el.style.opacity = '0.4';
		requestAnimationFrame(() => {
			el.style.opacity = '1';
		});
	});

	function handleEnhance(opts: { cancel: () => void }) {
		// Prevent duplicate submissions
		if (submitting) {
			opts.cancel();
			return;
		}
		submitting = true;
		return async ({ result, update }: { result: { type: string; data?: { error?: string } }; update: () => Promise<void> }) => {
			submitting = false;
			if (result.type === 'success') {
				showSuccess('Payment recorded successfully');
				onclose?.();
			} else if (result.type === 'failure') {
				showError(result.data?.error || 'An error occurred');
			}
			await update();
		};
	}
</script>

<ModalDialog open={true} onclose={submitting ? undefined : onclose} title="Record Payment">
	<div class="modal-shell">
		<!-- Header subtitle -->
		<p class="modal-subtitle">
			{direction === 'lent' ? 'Add a payment to this lending' : 'Record a repayment for this borrowing'}
		</p>

		<!-- Borrower context card (replaces the old icon block) -->
		<div class="context-card">
			<div class="ctx-avatar" class:borrowed={direction === 'borrowed'}>{initials}</div>
			<div class="ctx-info">
				<span class="ctx-name">{lending.borrower_name}</span>
				<span class="ctx-meta">{direction === 'lent' ? 'Lent' : 'Borrowed'} • {formatDate(lending.date_lent)}</span>
			</div>
			<span class="ctx-loan-pill">Loan #{lending.id}</span>
		</div>

		<!-- Summary context -->
		<div class="payment-summary">
			<div class="summary-row">
				<span class="summary-label">Original</span>
				<span class="summary-value">{formatCurrency(lending.amount)}</span>
			</div>
			<div class="summary-row">
				<span class="summary-label">{direction === 'lent' ? 'Collected' : 'Repaid'}</span>
				<span class="summary-value muted">{formatCurrency(lending.cash_paid)}</span>
			</div>
			{#if lending.written_off > 0}
				<div class="summary-row">
					<span class="summary-label">Written Off</span>
					<span class="summary-value muted">{formatCurrency(lending.written_off)}</span>
				</div>
			{/if}
			<div class="summary-row remaining">
				<span class="summary-label">Remaining</span>
				<span class="summary-value" class:teal={direction === 'lent'} class:rose={direction === 'borrowed'}>
					{formatCurrency(lending.remaining)}
				</span>
			</div>
		</div>

		<form method="POST" action="?/recordPayment" use:enhance={handleEnhance}>
			<input type="hidden" name="lending_id" value={lending.id} />
			<input type="hidden" name="payment_type" value={paymentType} />
			<input type="hidden" name="amount" value={rawAmount} />

			<div class="modal-scroll">
				<!-- Payment type selector -->
				<div class="payment-type-toggle" role="group" aria-label="Payment type">
					<button
						type="button"
						class:active={paymentType === 'payment'}
						aria-pressed={paymentType === 'payment'}
						onclick={() => paymentType = 'payment'}
					>
						Payment
					</button>
					<button
						type="button"
						class:active={paymentType === 'write_off'}
						aria-pressed={paymentType === 'write_off'}
						onclick={() => { paymentType = 'write_off'; createTransaction = false; }}
					>
						Write-off
					</button>
				</div>

				<!-- Amount -->
				<div class="form-group">
					<label class="form-label" for="payment_amount">Payment Amount</label>
					<div class="amount-wrap">
						<span class="amount-prefix">₱</span>
						<input
							id="payment_amount"
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
					<p class="amount-helper" class:error={amountHelperInvalid}>{amountHelper}</p>
				</div>

				<!-- Settlement pill (only when the amount fully resolves the loan) -->
				{#if isSettling}
					<div class="settle-pill" transition:fade|local={{ duration: 180 }} role="status">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
							<path d="M20 6L9 17l-5-5"/>
						</svg>
						{isWriteOff ? 'Loan will be fully written off' : 'Loan will be fully paid'}
					</div>
				{/if}

				<!-- Live preview (updates as the amount changes) -->
				<div class="remaining-preview">
					<span class="preview-title">After this payment</span>
					<div class="preview-body" aria-live="polite" role="status">
						{#if inputAmount > 0}
							<div class="preview-row">
								<span class="preview-label">Remaining</span>
								<span class="preview-value" bind:this={previewValueEl}>{formatCurrency(remainingAfter)}</span>
							</div>
							<div class="progress-track">
								<div class="progress-fill" style="width: {progressPct}%;"></div>
							</div>
							<div class="progress-caption">
								<span>{formatCurrency(newResolvedTotal)} of {formatCurrency(lending.amount)}</span>
								<span>{Math.round(progressPct)}% paid</span>
							</div>
						{:else}
							<p class="preview-empty">No changes yet</p>
						{/if}
					</div>
				</div>

				<div class="form-group">
					<label class="form-label" for="payment_date">Payment Date</label>
					<input
						id="payment_date"
						name="payment_date"
						type="date"
						required
						bind:value={paymentDate}
					/>
				</div>

				<div class="form-group">
					<label class="form-label" for="notes">Notes (optional)</label>
					<textarea
						id="notes"
						name="notes"
						rows="2"
						placeholder="Optional notes"
						bind:value={notes}
					></textarea>
					<span class="char-count">{notes.length} / 500</span>
				</div>

				<!-- Create Transaction card -->
				{#if showCreateTransaction}
					<label class="create-tx-card" transition:fade|local={{ duration: 200 }}>
						<input type="checkbox" name="create_transaction" bind:checked={createTransaction} />
						<span class="ct-content">
							<strong class="ct-title">Create Transaction</strong>
							<span class="ct-desc">
								{direction === 'lent'
									? 'Creates an income transaction for this payment'
									: 'Creates an expense transaction for this payment'}
							</span>
						</span>
					</label>
				{/if}
			</div>

			<!-- Pinned footer — Cancel on the left, Primary on the right -->
			<div class="modal-footer">
				<Button variant="ghost" type="button" onclick={onclose} disabled={submitting}>Cancel</Button>
				<div class="footer-primary-wrap">
					<Button variant="teal" type="submit" disabled={submitting}>
						{#if submitting}
							<span class="btn-spinner" aria-hidden="true"></span>
							<span>Recording...</span>
						{:else}
							<span>Record {isWriteOff ? 'Write-off' : 'Payment'}</span>
							<span class="btn-amount" class:shown={inputAmount > 0}>• {formatCurrency(inputAmount)}</span>
						{/if}
					</Button>
				</div>
			</div>
		</form>
	</div>
</ModalDialog>

<style>
	/* ═══ Viewport-aware shell: footer stays pinned, only the field region scrolls ═══ */
	.modal-shell {
		display: flex;
		flex-direction: column;
		max-height: calc(100dvh - 110px);
	}

	.modal-shell > .modal-subtitle,
	.modal-shell > .context-card,
	.modal-shell > .payment-summary {
		flex-shrink: 0;
	}

	.modal-shell form {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}

	.modal-scroll {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		overflow-x: hidden;
	}

	/* ═══ Header subtitle ═══ */
	.modal-subtitle {
		margin: 0 0 var(--space-md);
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	/* ═══ Borrower context card ═══ */
	.context-card {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		padding: var(--space-sm) var(--space-md);
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-md);
		margin-bottom: var(--space-md);
	}

	.ctx-avatar {
		width: 40px;
		height: 40px;
		border-radius: var(--radius-full);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		background: var(--color-teal-bg);
		box-shadow: inset 0 0 0 2px var(--color-teal);
		color: var(--color-teal);
		font-family: var(--font-display);
		font-weight: var(--font-weight-bold);
		font-size: var(--font-size-base);
	}

	.ctx-avatar.borrowed {
		background: var(--rose-soft);
		box-shadow: inset 0 0 0 2px var(--rose);
		color: var(--rose);
	}

	.ctx-info {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.ctx-name {
		font-family: var(--font-display);
		font-weight: var(--font-weight-bold);
		font-size: var(--font-size-base);
		color: var(--color-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.ctx-meta {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	.ctx-loan-pill {
		margin-left: auto;
		padding: 2px var(--space-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-pill);
		background: var(--color-bg);
		color: var(--color-text-muted);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		white-space: nowrap;
	}

	/* ═══ Summary card ═══ */
	.payment-summary {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
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
		font-weight: var(--font-weight-semibold);
		font-variant-numeric: tabular-nums;
		color: var(--color-text);
	}

	.summary-value.muted {
		color: var(--color-text-muted);
	}

	.summary-row.remaining {
		margin-top: var(--space-xs);
		padding: 6px var(--space-sm);
		background: var(--color-teal-bg);
		border-radius: var(--radius-sm);
	}

	.summary-row.remaining .summary-value {
		font-size: var(--font-size-base);
		font-weight: var(--font-weight-bold);
	}

	.summary-value.teal {
		color: var(--color-teal);
	}

	.summary-value.rose {
		color: var(--rose);
	}

	/* ═══ Payment / Write-off toggle ═══ */
	.payment-type-toggle {
		display: flex;
		gap: var(--space-xs);
		margin-bottom: var(--space-md);
		padding: 4px;
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.payment-type-toggle button {
		flex: 1;
		padding: var(--space-sm) var(--space-md);
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-text-secondary);
		font-weight: var(--font-weight-semibold);
		font-size: var(--font-size-sm);
		font-family: var(--font-body);
		cursor: pointer;
		min-height: 40px;
		transition: background var(--transition-fast), color var(--transition-fast), box-shadow var(--transition-fast);
	}

	.payment-type-toggle button:hover {
		background: var(--color-surface);
		color: var(--color-text);
	}

	.payment-type-toggle button:focus-visible {
		outline: none;
		box-shadow: var(--focus);
	}

	.payment-type-toggle button.active {
		background: linear-gradient(135deg, var(--color-teal) 0%, var(--color-teal-dark) 100%);
		color: var(--color-ink-inverse);
		box-shadow: var(--shadow-sm);
	}

	/* ═══ Form fields ═══ */
	.form-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: var(--space-md);
	}

	.form-label {
		font-family: var(--font-display);
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-semibold);
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
		transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
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

	.char-count {
		align-self: flex-end;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		opacity: 0.55;
	}

	.amount-wrap {
		display: flex;
		align-items: stretch;
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-md);
		background: var(--color-cream);
		overflow: hidden;
		transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
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
		font-weight: var(--font-weight-bold);
		color: var(--color-text-muted);
		background: transparent;
	}

	.amount-wrap input {
		border: none !important;
		background: transparent !important;
		font-family: var(--font-display);
		font-size: 24px;
		font-weight: var(--font-weight-bold);
		color: var(--color-text);
		padding: 8px 16px 8px 0;
		min-height: 48px;
		box-shadow: none !important;
		letter-spacing: -0.01em;
	}

	.amount-wrap input:focus {
		box-shadow: none !important;
	}

	.amount-helper {
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	.amount-helper.error {
		color: var(--rose);
	}

	/* ═══ Settlement pill ═══ */
	.settle-pill {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		padding: var(--space-xs) var(--space-md);
		margin: 0 0 var(--space-md);
		background: var(--color-teal-bg);
		color: var(--color-teal-dark);
		border: 1px solid var(--color-teal);
		border-radius: var(--radius-pill);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-bold);
	}

	/* ═══ Live preview card ═══ */
	.remaining-preview {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		padding: var(--space-md);
		background: var(--color-bg);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-md);
		margin-bottom: var(--space-md);
	}

	.preview-title {
		font-family: var(--font-display);
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-semibold);
		color: var(--color-text);
	}

	/* Reserved height so the card never shifts between empty and full states */
	.preview-body {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: var(--space-sm);
		min-height: 76px;
	}

	.preview-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}

	.preview-label {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	.preview-value {
		font-family: var(--font-mono);
		font-size: var(--font-size-xl);
		font-weight: var(--font-weight-bold);
		font-variant-numeric: tabular-nums;
		color: var(--color-text);
		line-height: 1.1;
		transition: opacity 200ms var(--ease);
	}

	.progress-track {
		height: 9px;
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

	.progress-caption {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-family: var(--font-mono);
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		font-variant-numeric: tabular-nums;
	}

	.preview-empty {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	/* ═══ Create Transaction card ═══ */
	.create-tx-card {
		display: flex;
		align-items: flex-start;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: background var(--transition-fast), border-color var(--transition-fast);
	}

	.create-tx-card:hover {
		background: var(--color-teal-bg);
		border-color: var(--color-teal);
	}

	.create-tx-card input {
		margin-top: 2px;
		accent-color: var(--color-teal);
		width: 18px;
		height: 18px;
		flex-shrink: 0;
		appearance: auto;
		-webkit-appearance: auto;
		outline: none;
		box-shadow: none;
	}

	.ct-content {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: var(--font-size-sm);
		color: var(--color-text);
		line-height: 1.4;
	}

	.ct-title {
		font-family: var(--font-display);
		font-weight: var(--font-weight-bold);
	}

	.ct-desc {
		font-weight: var(--font-weight-normal);
		color: var(--color-text-secondary);
		font-size: var(--font-size-xs);
	}

	/* ═══ Pinned footer ═══ */
	.modal-footer {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		flex-shrink: 0;
		margin: var(--space-md) calc(-1 * var(--space-lg)) calc(-1 * var(--space-lg));
		padding: var(--space-md) var(--space-lg);
		border-top: 1px solid var(--color-border);
		background: var(--color-surface);
		border-radius: 0 0 var(--radius-xl) var(--radius-xl);
	}

	.modal-footer :global(.btn-ghost) {
		flex: 1;
		color: var(--color-teal-dark);
		border-color: var(--color-teal-dark);
	}

	.modal-footer :global(.btn-ghost:hover) {
		background: var(--color-teal-bg);
	}

	.footer-primary-wrap {
		flex: 1.25;
		display: flex;
		min-width: 0;
	}

	.footer-primary-wrap :global(.btn-teal) {
		flex: 1;
		background: var(--color-teal);
		color: var(--color-surface);
		box-shadow: var(--shadow-sm);
		white-space: nowrap;
	}

	.footer-primary-wrap :global(.btn-teal:hover) {
		background: var(--color-teal-dark);
		box-shadow: var(--shadow-sm);
		transform: translateY(-1px);
	}

	.btn-spinner {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
		border: 2px solid var(--color-surface);
		border-top-color: transparent;
		border-radius: 50%;
		opacity: 0.9;
		animation: btn-spin 700ms linear infinite;
	}

	@keyframes btn-spin {
		to { transform: rotate(360deg); }
	}

	.btn-amount {
		font-weight: var(--font-weight-normal);
		font-size: var(--font-size-xs);
		opacity: 0;
		visibility: hidden;
		white-space: nowrap;
		transition: opacity var(--transition-fast);
	}

	.btn-amount.shown {
		opacity: 1;
		visibility: visible;
	}
</style>

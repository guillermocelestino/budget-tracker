<script lang="ts">
	import { enhance } from '$app/forms';
	import { fade } from 'svelte/transition';
	import { showSuccess, showError } from '$lib/client/stores/toast.svelte';
	import { formatCurrency, formatDate } from '$lib/client/utils/format';
import { formatWithCommas, getToday } from '$lib/shared/utils/format';
	import ModalDialog from '$lib/client/components/ModalDialog.svelte';
	import Button from '$lib/client/components/Button.svelte';
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

	// Live remaining preview — derived from VALID input only, so it never overruns
	const inputAmount = $derived(rawAmount ? parseFloat(rawAmount) || 0 : 0);
	const validAmount = $derived(inputAmount > 0 && inputAmount <= lending.remaining ? inputAmount : 0);
	const remainingAfter = $derived(lending.remaining - validAmount);
	const settledTotal = $derived(lending.cash_paid + lending.written_off + validAmount);
	const progressPct = $derived(lending.amount > 0 ? Math.min((settledTotal / lending.amount) * 100, 100) : 0);

	const isWriteOff = $derived(paymentType === 'write_off');
	const showCreateTransaction = $derived(!isWriteOff);
	// Settle only when the input is valid and matches the remaining balance to the cent
	const isSettling = $derived(
		validAmount > 0 && Math.round(validAmount * 100) === Math.round(lending.remaining * 100)
	);
	const amountHelperInvalid = $derived(inputAmount > lending.remaining);
	// Disable submit for empty / non-positive / over-remaining amounts or a missing date
	const canSubmit = $derived(inputAmount > 0 && inputAmount <= lending.remaining && !!paymentDate);

	const initials = $derived(
		lending.borrower_name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((w) => w[0].toUpperCase())
			.join('') || '?'
	);

	// Header subtitle (mode-adaptive)
	const headerSubtitle = $derived(
		direction === 'lent' ? 'Add a payment to this lending' : 'Add a payment to this borrowing'
	);

	// Footer reassurance line (mode-adaptive)
	const reassuranceText = $derived(
		isWriteOff
			? 'This will be recorded as a write-off and cannot exceed the remaining balance.'
			: 'This will be recorded as a payment and cannot exceed the remaining balance.'
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

{#snippet headerIcon()}
	<span class="header-icon-chip">
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/>
			<path d="M8 7h8M8 11h8M8 15h4"/>
		</svg>
	</span>
{/snippet}

<ModalDialog open={true} onclose={submitting ? undefined : onclose} title="Record Payment" icon={headerIcon} subtitle={headerSubtitle}>
	<div class="modal-shell">
		<!-- Borrower context card -->
		<div class="context-card">
			<div class="ctx-avatar" class:borrowed={direction === 'borrowed'}>{initials}</div>
			<div class="ctx-info">
				<span class="ctx-name">{lending.borrower_name}</span>
				<span class="ctx-meta">{direction === 'lent' ? 'Lent' : 'Borrowed'} • {formatDate(lending.date_lent)}</span>
			</div>
			<span class="ctx-loan-pill">{direction === 'lent' ? '#L-' : '#B-'}{lending.id}</span>
		</div>

		<!-- Summary context -->
		<div class="payment-summary">
			<div class="summary-row">
				<span class="summary-chip">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<rect x="2" y="6" width="20" height="12" rx="2"/>
						<circle cx="12" cy="12" r="2"/>
						<path d="M6 12h.01M18 12h.01"/>
					</svg>
				</span>
				<span class="summary-label">Original</span>
				<span class="summary-value">{formatCurrency(lending.amount)}</span>
			</div>
			<div class="summary-row">
				<span class="summary-chip">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M12 3v12"/>
						<path d="m6 9 6 6 6-6"/>
						<path d="M4 21h16"/>
					</svg>
				</span>
				<span class="summary-label">{direction === 'lent' ? 'Collected' : 'Repaid'}</span>
				<span class="summary-value muted">{formatCurrency(lending.cash_paid)}</span>
			</div>
			{#if lending.written_off > 0}
				<div class="summary-row">
					<span class="summary-chip">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/>
							<path d="M22 21H7"/>
							<path d="m5 11 9 9"/>
						</svg>
					</span>
					<span class="summary-label">Written Off</span>
					<span class="summary-value muted">{formatCurrency(lending.written_off)}</span>
				</div>
			{/if}
			<div class="summary-row remaining">
				<span class="summary-chip">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/>
						<path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/>
						<path d="M7 21h10"/>
						<path d="M12 3v18"/>
						<path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>
					</svg>
				</span>
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
						class="mode-pay"
						class:active={paymentType === 'payment'}
						aria-pressed={paymentType === 'payment'}
						onclick={() => paymentType = 'payment'}
					>
						<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<rect x="2" y="6" width="20" height="12" rx="2"/>
							<circle cx="12" cy="12" r="2"/>
							<path d="M6 12h.01M18 12h.01"/>
						</svg>
						Payment
					</button>
					<button
						type="button"
						class="mode-off"
						class:active={paymentType === 'write_off'}
						aria-pressed={paymentType === 'write_off'}
						onclick={() => { paymentType = 'write_off'; createTransaction = false; }}
					>
						<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/>
							<path d="M22 21H7"/>
							<path d="m5 11 9 9"/>
						</svg>
						Write-off
					</button>
				</div>

				<!-- Amount -->
				<div class="form-group">
					<label class="form-label" for="payment_amount">Payment Amount<span class="req">*</span></label>
					<div class="amount-wrap">
						<span class="amount-prefix">₱</span>
						<input
							id="payment_amount"
							type="text"
							inputmode="decimal"
							required
							placeholder="0.00"
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
						This will fully settle the loan
					</div>
				{/if}

				<!-- Live preview (always compact — shows the current state at input 0) -->
				<div class="remaining-preview">
					<span class="preview-title">After this payment</span>
					<div class="preview-body" aria-live="polite" role="status">
						<div class="preview-row">
							<span class="preview-label">Remaining</span>
							<span
								class="preview-value"
								class:teal={direction === 'lent'}
								class:rose={direction === 'borrowed'}
								bind:this={previewValueEl}
							>{formatCurrency(remainingAfter)}</span>
						</div>
						<div class="progress-track">
							<div class="progress-fill" style="width: {progressPct}%;"></div>
						</div>
						<div class="progress-caption">
							{formatCurrency(settledTotal)} of {formatCurrency(lending.amount)} ({Math.round(progressPct)}% settled)
						</div>
					</div>
				</div>

				<div class="form-group">
					<label class="form-label" for="payment_date">Payment Date<span class="req">*</span></label>
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

			<!-- Pinned footer — Cancel on the left, Primary on the right, reassurance below -->
			<div class="modal-footer">
				<div class="footer-actions">
					<Button variant="ghost" type="button" onclick={onclose} disabled={submitting}>Cancel</Button>
					<div class="footer-primary-wrap">
						<Button variant="teal" type="submit" disabled={submitting || !canSubmit}>
							{#if submitting}
								<span class="btn-spinner" aria-hidden="true"></span>
								<span>Recording...</span>
							{:else}
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
									<path d="M20 6L9 17l-5-5"/>
								</svg>
								<span>Record {isWriteOff ? 'Write-off' : 'Payment'}</span>
							{/if}
						</Button>
					</div>
				</div>
				<p class="footer-note">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
						<path d="m9 12 2 2 4-4"/>
					</svg>
					<span>{reassuranceText}</span>
				</p>
			</div>
		</form>
	</div>
</ModalDialog>

<style>
	/* ═══ Viewport-aware shell: footer stays pinned, only the field region scrolls ═══ */
	.modal-shell {
		display: flex;
		flex-direction: column;
		max-height: calc(100dvh - 130px);
	}

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

	/* ═══ Header icon chip (rendered inside the modal header) ═══ */
	.header-icon-chip {
		width: 40px;
		height: 40px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--mint-tint);
		color: var(--teal-deep);
		border-radius: var(--radius-md);
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
		background: var(--mint-tint);
		box-shadow: inset 0 0 0 2px var(--teal-deep);
		color: var(--teal-deep);
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

	/* Mint mono loan-ID pill */
	.ctx-loan-pill {
		margin-left: auto;
		padding: 2px var(--space-sm);
		background: var(--mint-tint);
		color: var(--teal-deep);
		border-radius: var(--radius-pill);
		font-family: var(--font-mono);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-bold);
		white-space: nowrap;
	}

	/* ═══ Summary card — white card, per-row icon chips, mint accent on Remaining ═══ */
	.payment-summary {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		padding: var(--space-sm) var(--space-md);
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-md);
		margin-bottom: var(--space-md);
	}

	.summary-row {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.summary-chip {
		width: 28px;
		height: 28px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--mint-tint);
		color: var(--teal-deep);
		border-radius: var(--radius-sm);
	}

	.summary-label {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		margin-right: auto;
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
		padding: var(--space-xs) var(--space-sm);
		background: var(--mint-tint);
		border-radius: var(--radius-sm);
	}

	.summary-row.remaining .summary-chip {
		background: var(--color-surface);
	}

	.summary-row.remaining .summary-value {
		font-size: var(--font-size-base);
		font-weight: var(--font-weight-bold);
	}

	.summary-value.teal {
		color: var(--teal-deep);
	}

	.summary-value.rose {
		color: var(--rose);
	}

	/* ═══ Payment / Write-off toggle — tinted active, never a solid teal block ═══ */
	.payment-type-toggle {
		display: flex;
		gap: var(--space-xs);
		margin-bottom: var(--space-md);
		padding: 4px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.payment-type-toggle button {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-xs);
		padding: var(--space-sm) var(--space-md);
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--muted);
		font-weight: var(--font-weight-semibold);
		font-size: var(--font-size-sm);
		font-family: var(--font-body);
		cursor: pointer;
		min-height: 40px;
		transition: background var(--transition-fast), color var(--transition-fast), box-shadow var(--transition-fast);
	}

	.payment-type-toggle button:hover {
		background: var(--color-surface-inset);
		color: var(--color-text);
	}

	.payment-type-toggle button:focus-visible {
		outline: none;
		box-shadow: var(--focus);
	}

	.payment-type-toggle button.mode-pay.active {
		background: var(--mint-tint);
		color: var(--teal-deep);
	}

	.payment-type-toggle button.mode-off.active {
		background: var(--rose-soft);
		color: var(--rose);
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

	.form-label .req {
		color: var(--rose);
		margin-left: 2px;
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
		padding: 0 var(--space-md) 0 var(--space-lg);
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
		padding: 8px var(--space-lg) 8px 0;
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
		background: var(--mint-tint);
		color: var(--teal-deep);
		border: 1px solid var(--teal-deep);
		border-radius: var(--radius-pill);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-bold);
	}

	/* ═══ Live preview card — compact, always rendered ═══ */
	.remaining-preview {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		padding: var(--space-md);
		background: var(--color-surface);
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

	.preview-body {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
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
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-bold);
		font-variant-numeric: tabular-nums;
		line-height: 1.1;
		transition: opacity 200ms var(--ease);
	}

	.preview-value.teal {
		color: var(--teal-deep);
	}

	.preview-value.rose {
		color: var(--rose);
	}

	.progress-track {
		height: 9px;
		background: var(--color-hairline);
		border-radius: var(--radius-pill);
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: var(--teal-deep);
		border-radius: var(--radius-pill);
		transition: width 300ms var(--ease);
	}

	.progress-caption {
		font-family: var(--font-mono);
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		font-variant-numeric: tabular-nums;
	}

	/* ═══ Create Transaction card ═══ */
	.create-tx-card {
		display: flex;
		align-items: flex-start;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: background var(--transition-fast), border-color var(--transition-fast);
	}

	.create-tx-card:hover {
		background: var(--mint-tint);
		border-color: var(--teal-deep);
	}

	.create-tx-card input {
		margin-top: 2px;
		accent-color: var(--teal-deep);
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

	/* ═══ Pinned footer — buttons row + reassurance line ═══ */
	.modal-footer {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		flex-shrink: 0;
		margin: var(--space-md) calc(-1 * var(--space-lg)) calc(-1 * var(--space-lg));
		padding: var(--space-md) var(--space-lg);
		border-top: 1px solid var(--color-border);
		background: var(--color-surface);
		border-radius: 0 0 var(--radius-xl) var(--radius-xl);
	}

	.footer-actions {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.modal-footer :global(.btn-ghost) {
		flex: 1;
		color: var(--teal-deep);
		border-color: var(--teal-deep);
	}

	.modal-footer :global(.btn-ghost:hover) {
		background: var(--mint-tint);
	}

	.footer-primary-wrap {
		flex: 1.25;
		display: flex;
		min-width: 0;
	}

	.footer-primary-wrap :global(.btn-teal) {
		flex: 1;
		background: var(--teal-deep);
		color: var(--color-surface);
		box-shadow: var(--shadow-sm);
		white-space: nowrap;
	}

	.footer-primary-wrap :global(.btn-teal:hover) {
		background: var(--color-teal-dark);
		box-shadow: var(--shadow-sm);
		transform: translateY(-1px);
	}

	.footer-note {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	.footer-note svg {
		flex-shrink: 0;
		color: var(--teal-deep);
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
</style>

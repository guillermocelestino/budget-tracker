<script lang="ts">
	import { enhance } from '$app/forms';
	import { tick } from 'svelte';
	import { showSuccess, showError } from '$lib/client/stores/toast.svelte';
	import { formatCurrency, formatDate } from '$lib/client/utils/format';
	import { formatWithCommas, getToday } from '$lib/shared/utils/format';
	import type { LendingWithPayments, PaymentType } from '$lib/types';

	let {
		lending,
		direction: _direction = 'lent',
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
	let modalRef = $state<HTMLElement | null>(null);

	const inputAmount = $derived(rawAmount ? parseFloat(rawAmount) || 0 : 0);
	const recoveryPct = $derived(
		lending.amount > 0 ? Math.min((lending.cash_paid / lending.amount) * 100, 100) : 0
	);

	const isWriteOff = $derived(paymentType === 'write_off');
	const canSubmit = $derived(inputAmount > 0 && inputAmount <= lending.remaining && !!paymentDate);

	const statusLabel = $derived.by(() => {
		if (lending.derived_status === 'paid' || lending.remaining <= 0) return 'Settled';
		if (lending.due_date) {
			const diff = Math.ceil((new Date(lending.due_date).getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));
			if (diff < 0) return 'Overdue';
		}
		return 'Active';
	});

	const formattedInputAmount = $derived(
		rawAmount && !isNaN(parseFloat(rawAmount)) && parseFloat(rawAmount) > 0
			? formatWithCommas(rawAmount)
			: ''
	);

	const ctaLabel = $derived(
		isWriteOff
			? (formattedInputAmount ? `Record ₱${formattedInputAmount} Write-off` : 'Record Write-off')
			: (formattedInputAmount ? `Record ₱${formattedInputAmount} Recovered` : 'Mark as Recovered')
	);

	const dueSubtitle = $derived(
		lending.due_date ? `Expected back ${formatDate(lending.due_date)}` : `Lent on ${formatDate(lending.date_lent)}`
	);

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

	function close() {
		if (!submitting) onclose?.();
	}

	function handleBackdrop(e: MouseEvent) {
		if (e.target === e.currentTarget) close();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}

	function handleEnhance(opts: { cancel: () => void }) {
		if (submitting) {
			opts.cancel();
			return;
		}
		submitting = true;
		return async ({ result, update }: { result: { type: string; data?: { error?: string } }; update: () => Promise<void> }) => {
			submitting = false;
			if (result.type === 'success') {
				showSuccess(isWriteOff ? 'Write-off recorded' : 'Recovery recorded successfully!');
				onclose?.();
			} else if (result.type === 'failure') {
				showError(result.data?.error || 'An error occurred');
			}
			await update();
		};
	}

	$effect(() => {
		tick().then(() => {
			const amountInput = modalRef?.querySelector<HTMLElement>('input[name="amount_input"]');
			amountInput?.focus();
		});
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="modal-backdrop" onclick={handleBackdrop} role="dialog" aria-modal="true" aria-label="Record Recovery">
	<div class="modal-card" bind:this={modalRef}>
		<!-- Header -->
		<div class="modal-header">
			<div class="header-badge">MONEY AWAY</div>
			<h2 class="header-title">{lending.borrower_name}</h2>
			<p class="header-subtitle">{dueSubtitle}</p>
			<button type="button" class="close-btn" onclick={close} aria-label="Close">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="18" y1="6" x2="6" y2="18"/>
					<line x1="6" y1="6" x2="18" y2="18"/>
				</svg>
			</button>
		</div>

		<div class="modal-scroll-area">
			<!-- CARD 1: Status & Remaining Card -->
			<div class="status-card">
				<div class="status-card-header">
					<span class="status-card-label">REMAINING</span>
					<span class="remaining-value">{formatCurrency(lending.remaining)}</span>
				</div>

				<!-- Progress Bar -->
				<div class="progress-container">
					<div class="progress-track">
						<div class="progress-fill" style="width: {recoveryPct}%;"></div>
					</div>
					<div class="progress-text">{Math.round(recoveryPct)}% recovered</div>
				</div>

				<!-- 3-Column Metadata Row -->
				<div class="meta-grid">
					<div class="meta-col">
						<span class="meta-label">ORIGINAL</span>
						<span class="meta-value">{formatCurrency(lending.amount)}</span>
					</div>
					<div class="meta-col">
						<span class="meta-label">RECOVERED</span>
						<span class="meta-value">{formatCurrency(lending.cash_paid)}</span>
					</div>
					<div class="meta-col">
						<span class="meta-label">STATUS</span>
						<span class="status-badge" class:settled={statusLabel === 'Settled'} class:overdue={statusLabel === 'Overdue'}>
							{statusLabel}
						</span>
					</div>
				</div>
			</div>

			<!-- CARD 2: RECORD RECOVERY Form Card -->
			<div class="form-card">
				<form method="POST" action="?/recordPayment" use:enhance={handleEnhance}>
					<input type="hidden" name="lending_id" value={lending.id} />
					<input type="hidden" name="payment_type" value={paymentType} />
					<input type="hidden" name="amount" value={rawAmount} />
					<input type="hidden" name="payment_date" value={paymentDate} />
					{#if createTransaction && !isWriteOff}
						<input type="hidden" name="create_transaction" value="on" />
					{/if}

					<!-- Section Label & Optional Write-off toggle -->
					<div class="form-card-head">
						<span class="form-card-label">RECORD RECOVERY</span>
						<div class="mode-toggle">
							<button
								type="button"
								class="mode-btn"
								class:active={paymentType === 'payment'}
								onclick={() => paymentType = 'payment'}
							>
								Payment
							</button>
							<button
								type="button"
								class="mode-btn mode-writeoff"
								class:active={paymentType === 'write_off'}
								onclick={() => { paymentType = 'write_off'; createTransaction = false; }}
							>
								Write-off
							</button>
						</div>
					</div>

					<!-- Field 1: Amount -->
					<div class="field-group">
						<div class="pill-input amount-input-wrap" class:invalid={inputAmount > lending.remaining}>
							<span class="currency-prefix">₱</span>
							<input
								id="amount_input"
								name="amount_input"
								type="text"
								inputmode="decimal"
								required
								placeholder="0.00"
								value={formattedInputAmount}
								oninput={onAmountInput}
								onfocus={onAmountFocus}
								onblur={onAmountBlur}
								autocomplete="off"
								class="amount-input"
							/>
						</div>
						{#if inputAmount > lending.remaining}
							<p class="error-text">Cannot exceed remaining balance ({formatCurrency(lending.remaining)})</p>
						{/if}
					</div>

					<!-- Field 2: Note (optional) -->
					<div class="field-group">
						<input
							id="notes"
							name="notes"
							type="text"
							placeholder="Note (optional)"
							bind:value={notes}
							class="pill-input note-input"
						/>
					</div>

					<!-- Submit Button -->
					<button type="submit" class="cta-button" disabled={!canSubmit || submitting}>
						{#if submitting}
							<span class="spinner"></span>
							<span>Saving...</span>
						{:else}
							<span>{ctaLabel}</span>
						{/if}
					</button>
				</form>
			</div>

			<!-- CARD 3: PAYMENT HISTORY (If history exists) -->
			{#if lending.payments && lending.payments.length > 0}
				<div class="history-card">
					<span class="form-card-label">PAYMENT HISTORY</span>
					<div class="history-list">
						{#each lending.payments as p (p.id)}
							<div class="history-item">
								<div class="item-left">
									<span class="item-date">{formatDate(p.payment_date)}</span>
									{#if p.notes}
										<span class="item-note">{p.notes}</span>
									{/if}
								</div>
								<div class="item-right">
									<span class="item-amount" class:writeoff={p.payment_type === 'write_off'}>
										+{formatCurrency(p.amount)}
									</span>
									<span class="item-tag">{p.payment_type === 'write_off' ? 'Write-off' : 'Payment'}</span>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	/* ─── Backdrop ─── */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(14, 42, 39, 0.45);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: var(--space-md);
	}

	/* ─── Modal Shell ─── */
	.modal-card {
		background: var(--color-bg, #EFF8F7);
		border-radius: 28px;
		max-width: 480px;
		width: 100%;
		position: relative;
		box-shadow: 0 20px 40px rgba(14, 42, 39, 0.15), 0 0 0 1px rgba(43, 168, 162, 0.2);
		animation: modalPop 280ms var(--bounce, cubic-bezier(0.34, 1.56, 0.64, 1));
		overflow: hidden;
		padding: 28px 24px;
		max-height: calc(100dvh - 40px);
		display: flex;
		flex-direction: column;
	}

	[data-theme="dark"] .modal-card {
		background: #101715;
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(60, 196, 189, 0.25);
	}

	@keyframes modalPop {
		from {
			opacity: 0;
			transform: scale(0.94) translateY(12px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	.modal-scroll-area {
		overflow-y: auto;
		overflow-x: hidden;
		flex: 1;
		padding-right: 2px;
	}

	/* ─── Header ─── */
	.modal-header {
		position: relative;
		margin-bottom: 18px;
		flex-shrink: 0;
	}

	.header-badge {
		font-family: var(--font-body);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-text-muted, #5C7A78);
		margin-bottom: 2px;
	}

	.header-title {
		font-family: var(--font-display);
		font-size: clamp(2rem, 5vw, 2.5rem);
		font-weight: 800;
		color: var(--color-ink, #0E2A27);
		margin: 0 0 4px 0;
		line-height: 1.1;
		letter-spacing: -0.02em;
	}

	.header-subtitle {
		font-size: 13px;
		line-height: 1.4;
		color: var(--color-text-muted, #5C7A78);
		margin: 0;
		padding-right: 32px;
	}

	.close-btn {
		position: absolute;
		top: -4px;
		right: -4px;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		border: none;
		background: rgba(20, 48, 46, 0.06);
		color: var(--color-text-muted, #5C7A78);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 180ms ease;
	}

	.close-btn:hover {
		background: rgba(239, 108, 74, 0.15);
		color: var(--color-coral, #EF6C4A);
		transform: rotate(90deg);
	}

	/* ─── Card 1: Status & Remaining Card ─── */
	.status-card {
		background: var(--color-surface, #FFFFFF);
		border-radius: 22px;
		padding: 20px;
		box-shadow: 0 4px 16px rgba(14, 42, 39, 0.04);
		border: 1px solid var(--color-hairline, rgba(20, 48, 46, 0.08));
		border-left: 4.5px solid var(--color-money-away, #5DADE2);
		margin-bottom: 16px;
	}

	[data-theme="dark"] .status-card {
		background: #161F1C;
		border-color: rgba(255, 255, 255, 0.08);
		border-left-color: var(--color-money-away, #6FC0F0);
	}

	.status-card-header {
		display: flex;
		flex-direction: column;
		margin-bottom: 12px;
	}

	.status-card-label {
		font-family: var(--font-body);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-text-muted, #5C7A78);
		margin-bottom: 4px;
	}

	.remaining-value {
		font-family: var(--font-display);
		font-size: clamp(2rem, 5vw, 2.75rem);
		font-weight: 800;
		color: var(--color-money-away, #5DADE2);
		letter-spacing: -0.02em;
		line-height: 1;
	}

	/* ─── Progress Bar ─── */
	.progress-container {
		margin-bottom: 18px;
	}

	.progress-track {
		height: 10px;
		background: var(--color-gold-bg, rgba(255, 210, 63, 0.18));
		border-radius: 999px;
		overflow: hidden;
		margin-bottom: 6px;
	}

	.progress-fill {
		height: 100%;
		background: var(--color-money-away, #5DADE2);
		border-radius: 999px;
		transition: width 400ms var(--ease, ease);
	}

	.progress-text {
		font-size: 12px;
		font-weight: 700;
		color: var(--color-text-muted, #5C7A78);
	}

	/* ─── 3-Column Metadata Row ─── */
	.meta-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
		padding-top: 14px;
		border-top: 1px solid var(--color-hairline, rgba(20, 48, 46, 0.08));
	}

	.meta-col {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.meta-label {
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-text-muted, #5C7A78);
	}

	.meta-value {
		font-family: var(--font-mono);
		font-size: 14px;
		font-weight: 800;
		color: var(--color-ink, #14302E);
	}

	[data-theme="dark"] .meta-value {
		color: #EAF7F5;
	}

	.status-badge {
		font-family: var(--font-body);
		font-size: 13px;
		font-weight: 800;
		color: var(--color-teal, #2BA8A2);
	}

	.status-badge.settled {
		color: var(--color-text-muted);
	}

	.status-badge.overdue {
		color: var(--color-coral, #EF6C4A);
	}

	/* ─── Card 2: RECORD RECOVERY Form Card ─── */
	.form-card {
		background: var(--color-surface, #FFFFFF);
		border-radius: 22px;
		padding: 20px;
		box-shadow: 0 4px 16px rgba(14, 42, 39, 0.04);
		border: 1px solid var(--color-hairline, rgba(20, 48, 46, 0.08));
		margin-bottom: 16px;
	}

	[data-theme="dark"] .form-card {
		background: #161F1C;
		border-color: rgba(255, 255, 255, 0.08);
	}

	.form-card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 14px;
	}

	.form-card-label {
		font-family: var(--font-body);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-text-muted, #5C7A78);
	}

	.mode-toggle {
		display: flex;
		gap: 4px;
		padding: 2px;
		background: var(--color-surface-inset, #F0F9F8);
		border-radius: var(--radius-pill, 999px);
		border: 1px solid var(--color-hairline);
	}

	.mode-btn {
		padding: 3px 10px;
		border: none;
		border-radius: var(--radius-pill);
		background: transparent;
		font-size: 10px;
		font-weight: 800;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: all 180ms ease;
	}

	.mode-btn.active {
		background: var(--color-teal, #2BA8A2);
		color: #FFFFFF;
	}

	.mode-btn.mode-writeoff.active {
		background: var(--color-coral, #EF6C4A);
	}

	/* ─── Field Groups & Inputs ─── */
	.field-group {
		display: flex;
		flex-direction: column;
		margin-bottom: 14px;
	}

	.pill-input {
		width: 100%;
		height: 48px;
		border-radius: 14px;
		border: 1px dashed var(--color-money-returning, rgba(43, 168, 162, 0.4));
		background: var(--color-surface, #FFFFFF);
		color: var(--color-ink, #14302E);
		padding: 0 16px;
		font-family: var(--font-body);
		font-size: 15px;
		font-weight: 600;
		transition: all 180ms ease;
		outline: none;
		box-sizing: border-box;
	}

	[data-theme="dark"] .pill-input {
		background: #1A2421;
		color: #EAF7F5;
		border-color: rgba(60, 196, 189, 0.35);
	}

	.pill-input:focus,
	.pill-input:focus-within {
		border-style: solid;
		border-color: var(--color-money-returning, #2BA8A2);
		box-shadow: 0 0 0 3.5px rgba(43, 168, 162, 0.25);
	}

	.pill-input.invalid {
		border-color: var(--color-coral);
	}

	.amount-input-wrap {
		display: flex;
		align-items: center;
		padding: 0 16px;
	}

	.currency-prefix {
		font-family: var(--font-display);
		font-size: 22px;
		font-weight: 800;
		color: var(--color-text-muted, #5C7A78);
		margin-right: 6px;
	}

	.amount-input {
		flex: 1;
		border: none !important;
		outline: none !important;  /* suppress browser native blue ring — wrapper shows :focus-within ring */
		background: transparent !important;
		padding: 0 !important;
		font-family: var(--font-display);
		font-size: 24px;
		font-weight: 800;
		color: var(--color-ink, #14302E);
		letter-spacing: -0.02em;
		box-shadow: none !important;
	}

	[data-theme="dark"] .amount-input {
		color: #EAF7F5;
	}

	.note-input {
		font-size: 13px;
		font-weight: 500;
		border-style: solid;
		border-color: var(--color-hairline);
	}

	.note-input::placeholder {
		color: var(--color-text-muted);
		opacity: 0.7;
	}

	.error-text {
		font-size: 11px;
		color: var(--color-coral);
		margin: 4px 0 0 4px;
		font-weight: 700;
	}

	/* ─── CTA Button ─── */
	.cta-button {
		width: 100%;
		height: 50px;
		border-radius: 999px;
		border: none;
		background: var(--color-money-returning, #2BA8A2);
		color: #FFFFFF;
		font-family: var(--font-display);
		font-size: 16px;
		font-weight: 800;
		letter-spacing: -0.01em;
		cursor: pointer;
		box-shadow: 0 6px 20px rgba(43, 168, 162, 0.35);
		transition: all 180ms var(--bounce, ease);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}

	.cta-button:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 8px 24px rgba(43, 168, 162, 0.5);
		filter: brightness(1.05);
	}

	.cta-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		transform: none;
		box-shadow: none;
	}

	/* ─── Card 3: PAYMENT HISTORY Card ─── */
	.history-card {
		background: var(--color-surface, #FFFFFF);
		border-radius: 22px;
		padding: 20px;
		box-shadow: 0 4px 16px rgba(14, 42, 39, 0.04);
		border: 1px solid var(--color-hairline, rgba(20, 48, 46, 0.08));
	}

	[data-theme="dark"] .history-card {
		background: #161F1C;
		border-color: rgba(255, 255, 255, 0.08);
	}

	.history-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: 10px;
	}

	.history-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 12px;
		background: var(--color-surface-inset, #F0F9F8);
		border-radius: var(--radius-md);
		font-size: 12px;
	}

	[data-theme="dark"] .history-item {
		background: rgba(255, 255, 255, 0.04);
	}

	.item-left {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.item-date {
		font-weight: 700;
		color: var(--color-ink);
	}

	.item-note {
		font-size: 11px;
		color: var(--color-text-muted);
	}

	.item-right {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 1px;
	}

	.item-amount {
		font-family: var(--font-mono);
		font-weight: 800;
		color: var(--color-teal);
	}

	.item-amount.writeoff {
		color: var(--color-coral);
	}

	.item-tag {
		font-size: 10px;
		color: var(--color-text-muted);
		text-transform: uppercase;
	}

	@media (max-width: 480px) {
		.modal-card {
			padding: 20px 16px;
			border-radius: 24px;
		}
		.status-card, .form-card, .history-card {
			padding: 16px;
		}
	}
</style>

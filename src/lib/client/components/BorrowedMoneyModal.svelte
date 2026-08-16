<script lang="ts">
	import { enhance } from '$app/forms';
	import { tick } from 'svelte';
	import { showSuccess, showError } from '$lib/client/stores/toast.svelte';
	import { formatWithCommas, getToday } from '$lib/shared/utils/format';
	import type { Lending, LendingPayment } from '$lib/types';

	let {
		open = false,
		onClose,
		onSuccess,
		lendingRecord
	}: {
		open?: boolean;
		onClose?: () => void;
		onSuccess?: () => void;
		lendingRecord?: Lending & { cash_paid?: number; written_off?: number; payments?: LendingPayment[] };
	} = $props();

	let lenderName = $state('');
	let rawAmount = $state('');
	let interestRate = $state('');
	let dateBorrowed = $state(getToday());
	let dueDate = $state('');
	let notes = $state('');
	let recordAsTransaction = $state(false);
	let submitting = $state(false);
	let modalRef = $state<HTMLElement | null>(null);

	// Sync state if editing an existing borrowing record
	$effect(() => {
		if (lendingRecord) {
			lenderName = lendingRecord.borrower_name;
			rawAmount = lendingRecord.amount.toString();
			interestRate = lendingRecord.interest_rate ? lendingRecord.interest_rate.toString() : '';
			dateBorrowed = lendingRecord.date_lent;
			dueDate = lendingRecord.due_date ?? '';
			notes = lendingRecord.notes ?? '';
		} else if (open) {
			// Reset on open if creating new
			lenderName = '';
			rawAmount = '';
			interestRate = '';
			dateBorrowed = getToday();
			dueDate = '';
			notes = '';
			recordAsTransaction = false;
		}
	});

	// updateLending locks amount and date_lent once a borrowing has payments.
	// The list rows carry the payment aggregates (and payments), so detect the
	// lock from those — same rule as the lending flow.
	const paymentLocked = $derived(
		!!lendingRecord &&
		(((lendingRecord.cash_paid ?? 0) + (lendingRecord.written_off ?? 0)) > 0 ||
			(lendingRecord.payments ?? []).length > 0)
	);

	// Dynamic button title: "Record ₱1,111 Borrowed"
	const formattedAmount = $derived(
		rawAmount && !isNaN(parseFloat(rawAmount)) && parseFloat(rawAmount) > 0
			? formatWithCommas(rawAmount)
			: ''
	);

	const submitButtonLabel = $derived(
		lendingRecord
			? (formattedAmount ? `Update ₱${formattedAmount} Borrowed` : 'Update Borrowed Money')
			: (formattedAmount ? `Record ₱${formattedAmount} Borrowed` : 'Record Borrowed Money')
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
		if (!submitting) onClose?.();
	}

	function handleBackdrop(e: MouseEvent) {
		if (e.target === e.currentTarget) close();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) {
			close();
		}
	}

	function handleEnhance() {
		if (submitting) return;
		submitting = true;
		return async ({ result, update }: { result: { type: string; data?: { error?: string } }; update: () => Promise<void> }) => {
			submitting = false;
			if (result.type === 'success') {
				showSuccess(lendingRecord ? 'Borrowing updated successfully' : 'Borrowed money recorded successfully!');
				onSuccess?.();
				close();
			} else if (result.type === 'failure') {
				showError(result.data?.error || 'An error occurred while saving.');
			}
			await update();
		};
	}

	$effect(() => {
		if (open) {
			tick().then(() => {
				const firstInput = modalRef?.querySelector<HTMLElement>('input[name="borrower_name"]');
				firstInput?.focus();
			});
		}
	});
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="modal-backdrop" onclick={handleBackdrop} role="dialog" aria-modal="true" aria-label="Borrowed Money">
		<div class="modal-card" bind:this={modalRef}>
			<!-- Header -->
			<div class="modal-header">
				<div class="header-badge">MONEY COMMITTED</div>
				<h2 class="header-title">{lendingRecord ? 'Edit Borrowed Money' : 'Add Borrowed Money'}</h2>
				<p class="header-subtitle">
					You owe this back. Track who you borrowed from and when it's due.
				</p>
				<button type="button" class="close-btn" onclick={close} aria-label="Close">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="18" y1="6" x2="6" y2="18"/>
						<line x1="6" y1="6" x2="18" y2="18"/>
					</svg>
				</button>
			</div>

			<!-- White Card Container -->
			<div class="form-container">
				<form method="POST" action={lendingRecord ? '/borrowed?/update' : '/borrowed?/create'} use:enhance={handleEnhance}>
					{#if lendingRecord}
						<input type="hidden" name="id" value={lendingRecord.id} />
					{/if}
					<input type="hidden" name="direction" value="borrowed" />
					<!-- Submit carrier: the visible date input below has no name (mirrors the
					     amount field), so a disabled (payment-locked) input still posts. -->
					<input type="hidden" name="date_lent" value={dateBorrowed} />

					<!-- Field 1: Who Did You Borrow From? -->
					<div class="field-group">
						<label class="field-label" for="borrower_name">WHO DID YOU BORROW FROM?</label>
						<input
							id="borrower_name"
							name="borrower_name"
							type="text"
							required
							placeholder="Enter name"
							bind:value={lenderName}
							class="pill-input text-input"
						/>
					</div>

					<!-- Field 2: How Much? -->
					<div class="field-group">
						<label class="field-label" for="amount">HOW MUCH?</label>
						<div class="pill-input amount-input-wrap">
							<span class="currency-prefix">₱</span>
							<input
								id="amount"
								type="text"
								inputmode="decimal"
								required
								placeholder="0"
								value={formattedAmount}
								oninput={onAmountInput}
								onfocus={onAmountFocus}
								onblur={onAmountBlur}
								autocomplete="off"
								class="amount-input"
								disabled={paymentLocked}
							/>
						</div>
						<input type="hidden" name="amount" value={rawAmount} />
					</div>

					<!-- Field 3: Date Borrowed -->
					<div class="field-group">
						<label class="field-label" for="date_lent">Date Borrowed</label>
						<div class="date-input-wrap">
							<input
								id="date_lent"
								type="date"
								required
								bind:value={dateBorrowed}
								disabled={paymentLocked}
								aria-describedby={paymentLocked ? 'date_lent_lock_hint' : undefined}
								class="pill-input date-input"
							/>
						</div>
						{#if paymentLocked}
							<p id="date_lent_lock_hint" class="field-hint">
								Locked — a payment is already recorded for this borrowing
							</p>
						{/if}
					</div>

					<!-- Field 4: When Is It Due? -->
					<div class="field-group">
						<label class="field-label" for="due_date">WHEN IS IT DUE?</label>
						<div class="date-input-wrap">
							<input
								id="due_date"
								name="due_date"
								type="date"
								bind:value={dueDate}
								class="pill-input date-input"
							/>
						</div>
					</div>

					<!-- Optional Interest & Note Row -->
					<div class="field-row">
						<div class="field-group">
							<input
								id="interest_rate"
								name="interest_rate"
								type="number"
								step="0.1"
								placeholder="Interest (optional)"
								bind:value={interestRate}
								class="pill-input optional-input"
							/>
						</div>
						<div class="field-group">
							<input
								id="notes"
								name="notes"
								type="text"
								placeholder="Note (optional)"
								bind:value={notes}
								class="pill-input optional-input"
							/>
						</div>
					</div>

					<!-- Cash Flow Sync Checkbox -->
					<div class="checkbox-field">
						<label class="checkbox-label">
							<input type="checkbox" name="record_as_transaction" bind:checked={recordAsTransaction} />
							<span class="checkbox-text">Record repayment as expense transaction when paid</span>
						</label>
					</div>

					<!-- Submit Button -->
					<button type="submit" class="cta-button" disabled={submitting}>
						{#if submitting}
							<span>{lendingRecord ? 'Updating...' : 'Recording...'}</span>
						{:else}
							<span>{submitButtonLabel}</span>
						{/if}
					</button>
				</form>
			</div>
		</div>
	</div>
{/if}

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

	/* ─── Main Modal Card Shell ─── */
	.modal-card {
		background: var(--color-bg, #EFF8F7);
		border-radius: 28px;
		max-width: 480px;
		width: 100%;
		position: relative;
		box-shadow: 0 20px 40px rgba(14, 42, 39, 0.15), 0 0 0 1px rgba(217, 119, 6, 0.2);
		animation: modalPop 280ms var(--bounce, cubic-bezier(0.34, 1.56, 0.64, 1));
		overflow: hidden;
		padding: 28px 24px;
		max-height: calc(100dvh - 40px);
		display: flex;
		flex-direction: column;
	}

	[data-theme="dark"] .modal-card {
		background: #101715;
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(245, 158, 11, 0.2);
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

	/* ─── Header Section ─── */
	.modal-header {
		position: relative;
		margin-bottom: 20px;
		flex-shrink: 0;
	}

	.header-badge {
		font-family: var(--font-body);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-text-muted, #5C7A78);
		margin-bottom: 4px;
	}

	.header-title {
		font-family: var(--font-display);
		font-size: clamp(1.75rem, 4vw, 2.25rem);
		font-weight: 800;
		color: var(--color-ink, #0E2A27);
		margin: 0 0 6px 0;
		line-height: 1.1;
		letter-spacing: -0.02em;
	}

	.header-subtitle {
		font-size: 13px;
		line-height: 1.45;
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

	[data-theme="dark"] .close-btn {
		background: rgba(255, 255, 255, 0.08);
		color: var(--color-text-muted);
	}

	.close-btn:hover {
		background: rgba(239, 108, 74, 0.15);
		color: var(--color-coral, #EF6C4A);
		transform: rotate(90deg);
	}

	/* ─── White Form Card ─── */
	.form-container {
		background: var(--color-surface, #FFFFFF);
		border-radius: 22px;
		padding: 20px;
		box-shadow: 0 4px 16px rgba(14, 42, 39, 0.04);
		border: 1px solid var(--color-hairline, rgba(20, 48, 46, 0.08));
		overflow-y: auto;
		flex: 1;
	}

	[data-theme="dark"] .form-container {
		background: #161F1C;
		border-color: rgba(255, 255, 255, 0.08);
	}

	.field-group {
		display: flex;
		flex-direction: column;
		margin-bottom: 16px;
	}

	.field-label {
		font-family: var(--font-body);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-text-muted, #5C7A78);
		margin-bottom: 6px;
	}

	/* ─── Pill Inputs ─── */
	.pill-input {
		width: 100%;
		height: 48px;
		border-radius: 14px;
		border: 1px solid var(--color-hairline, rgba(217, 119, 6, 0.3));
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
		border-color: rgba(245, 158, 11, 0.25);
	}

	.pill-input:focus,
	.pill-input:focus-within {
		border-color: var(--color-money-committed, #D97706);
		box-shadow: 0 0 0 3.5px rgba(217, 119, 6, 0.25);
	}

	.text-input {
		font-weight: 700;
		font-size: 16px;
	}

	/* ─── Amount Input ─── */
	.amount-input-wrap {
		display: flex;
		align-items: center;
		padding: 0 16px;
	}

	.currency-prefix {
		font-family: var(--font-display);
		font-size: 20px;
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

	.date-input {
		appearance: none;
		-webkit-appearance: none;
		cursor: pointer;
	}

	.pill-input:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.field-hint {
		margin: 6px 0 0 2px;
		font-family: var(--font-body);
		font-size: 12px;
		font-weight: 600;
		color: var(--color-text-muted, #5C7A78);
	}

	/* ─── Field Row (Optional Interest & Note) ─── */
	.field-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		margin-bottom: 16px;
	}

	.field-row .field-group {
		margin-bottom: 0;
	}

	.optional-input {
		font-size: 13px;
		font-weight: 500;
	}

	.optional-input::placeholder {
		color: var(--color-text-muted);
		opacity: 0.7;
	}

	/* ─── Checkbox Field ─── */
	.checkbox-field {
		margin-bottom: 20px;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		font-size: 12px;
		color: var(--color-text-muted, #5C7A78);
		font-weight: 600;
		user-select: none;
	}

	.checkbox-label input {
		accent-color: var(--color-money-committed, #D97706);
		width: 16px;
		height: 16px;
		cursor: pointer;
	}

	.checkbox-text {
		line-height: 1.3;
	}

	/* ─── CTA Button ─── */
	.cta-button {
		width: 100%;
		height: 50px;
		border-radius: 999px;
		border: none;
		background: var(--color-money-committed, #D97706);
		color: #FFFFFF;
		font-family: var(--font-display);
		font-size: 16px;
		font-weight: 800;
		letter-spacing: -0.01em;
		cursor: pointer;
		box-shadow: 0 6px 20px rgba(217, 119, 6, 0.35);
		transition: all 180ms var(--bounce, ease);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.cta-button:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 8px 24px rgba(217, 119, 6, 0.5);
		filter: brightness(1.05);
	}

	.cta-button:active:not(:disabled) {
		transform: translateY(0) scale(0.98);
	}

	.cta-button:disabled {
		opacity: 0.55;
		cursor: not-allowed;
		transform: none;
		box-shadow: none;
	}

	@media (max-width: 480px) {
		.modal-card {
			padding: 20px 16px;
			border-radius: 24px;
		}
		.form-container {
			padding: 16px;
		}
		.field-row {
			grid-template-columns: 1fr;
		}
	}
</style>

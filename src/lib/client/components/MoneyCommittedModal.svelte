<script lang="ts">
	import { enhance } from '$app/forms';
	import { tick } from 'svelte';
	import { showSuccess, showError } from '$lib/client/stores/toast.svelte';
	import { formatDateInput, formatWithCommas } from '$lib/shared/utils/format';
	import type { Category, RecurringFrequency } from '$lib/types';

	let {
		open = false,
		initialMode = 'scheduled',
		categories = [],
		onClose,
		onSuccess
	}: {
		open?: boolean;
		initialMode?: 'scheduled' | 'debt';
		categories?: Category[];
		onClose?: () => void;
		onSuccess?: () => void;
	} = $props();

	let mode = $state<'scheduled' | 'debt'>('scheduled');

	// Common / Scheduled state
	let rawAmount = $state('');
	let description = $state('');
	let frequency = $state<RecurringFrequency>('monthly');
	let nextOutflow = $state(formatDateInput());
	let category_id = $state<number | string>('');

	// Debt / Borrowed state
	let borrowerName = $state('');
	let dueDate = $state('');
	let interestRate = $state('');
	let notes = $state('');

	let submitting = $state(false);
	let modalRef = $state<HTMLElement | null>(null);

	$effect(() => {
		if (open) {
			mode = initialMode;
			rawAmount = '';
			description = '';
			frequency = 'monthly';
			nextOutflow = formatDateInput();
			borrowerName = '';
			dueDate = '';
			interestRate = '';
			notes = '';
			if (categories.length > 0 && !category_id) {
				const expenseCat = categories.find((c) => c.type === 'expense');
				category_id = expenseCat ? expenseCat.id : categories[0].id;
			}
		}
	});

	const formattedAmount = $derived(
		rawAmount && !isNaN(parseFloat(rawAmount)) && parseFloat(rawAmount) > 0
			? formatWithCommas(rawAmount)
			: ''
	);

	const scheduledCtaLabel = $derived(
		formattedAmount ? `Commit ₱${formattedAmount}` : 'Commit'
	);

	const debtCtaLabel = $derived(
		formattedAmount ? `Confirm ₱${formattedAmount} Borrowed Money` : 'Confirm Borrowed Money'
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
		if (e.key === 'Escape') close();
	}

	// Submit handler for Scheduled mode (posts to /api/recurring via JSON fetch)
	async function submitScheduled(e: SubmitEvent) {
		e.preventDefault();
		if (submitting) return;

		const numAmt = parseFloat(rawAmount);
		if (isNaN(numAmt) || numAmt <= 0) {
			showError('Please enter a valid amount');
			return;
		}

		if (!description.trim()) {
			showError('Please enter a description for what this commitment is for');
			return;
		}

		submitting = true;
		try {
			const res = await fetch('/api/recurring', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: 'expense',
					amount: numAmt,
					description: description.trim(),
					category_id: category_id ? Number(category_id) : (categories[0]?.id ?? 1),
					frequency,
					interval: 1,
					start_date: nextOutflow,
					active: true
				})
			});

			const data = await res.json();
			if (res.ok && data.success) {
				showSuccess('Commitment added successfully!');
				onSuccess?.();
				close();
			} else {
				showError(data.error || 'Failed to add commitment');
			}
		} catch (err: unknown) {
			showError(err instanceof Error ? err.message : 'Network error occurred');
		} finally {
			submitting = false;
		}
	}

	function handleDebtEnhance() {
		if (submitting) return;
		submitting = true;
		return async ({ result, update }: { result: { type: string; data?: { error?: string } }; update: () => Promise<void> }) => {
			submitting = false;
			if (result.type === 'success') {
				showSuccess('Borrowed debt recorded successfully!');
				onSuccess?.();
				close();
			} else if (result.type === 'failure') {
				showError(result.data?.error || 'Could not record debt.');
			}
			await update();
		};
	}

	$effect(() => {
		if (open) {
			tick().then(() => {
				const firstInput = modalRef?.querySelector<HTMLElement>(
					mode === 'scheduled' ? 'input[name="what_description"]' : 'input[name="borrower_name"]'
				);
				firstInput?.focus();
			});
		}
	});
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="modal-backdrop" onclick={handleBackdrop} role="dialog" aria-modal="true" aria-label="Money Committed">
		<div class="modal-card" bind:this={modalRef}>
			<!-- Header -->
			<div class="modal-header">
				<div class="header-badge">MONEY COMMITTED</div>
				<h2 class="header-title">
					{mode === 'scheduled' ? 'Add a Commitment' : 'Add a Debt'}
				</h2>
				<p class="header-subtitle">
					{mode === 'scheduled'
						? "Rent, subscriptions, recurring bills — commit them so future you isn't surprised."
						: "This isn't gone yet, but it's already spoken for."}
				</p>
				<button type="button" class="close-btn" onclick={close} aria-label="Close">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="18" y1="6" x2="6" y2="18"/>
						<line x1="6" y1="6" x2="18" y2="18"/>
					</svg>
				</button>
			</div>

			<!-- Top Mode Toggle Bar (Scheduled vs Debt) -->
			<div class="mode-toggle-bar">
				<button
					type="button"
					class="toggle-btn"
					class:active={mode === 'scheduled'}
					onclick={() => (mode = 'scheduled')}
				>
					Scheduled
				</button>
				<button
					type="button"
					class="toggle-btn"
					class:active={mode === 'debt'}
					onclick={() => (mode = 'debt')}
				>
					Debt
				</button>
			</div>

			<!-- White Card Container -->
			<div class="form-container">
				{#if mode === 'scheduled'}
					<!-- ═══ MODE 1: SCHEDULED COMMITMENT FORM ═══ -->
					<form onsubmit={submitScheduled}>
						<!-- Field 1: WHAT? -->
						<div class="field-group">
							<label class="field-label" for="what_description">WHAT?</label>
							<input
								id="what_description"
								name="what_description"
								type="text"
								required
								placeholder="e.g. Rent, Netflix, Credit Card"
								bind:value={description}
								class="pill-input text-input"
							/>
						</div>

						<!-- Field 2: HOW MUCH? -->
						<div class="field-group">
							<label class="field-label" for="amount_scheduled">HOW MUCH?</label>
							<div class="pill-input amount-input-wrap">
								<span class="currency-prefix">₱</span>
								<input
									id="amount_scheduled"
									name="amount_scheduled"
									type="text"
									inputmode="decimal"
									required
									placeholder="0.00"
									value={formattedAmount}
									oninput={onAmountInput}
									onfocus={onAmountFocus}
									onblur={onAmountBlur}
									autocomplete="off"
									class="amount-input"
								/>
							</div>
						</div>

						<!-- Field 3: HOW OFTEN? -->
						<div class="field-group">
							<label class="field-label" for="frequency_group">HOW OFTEN?</label>
							<div id="frequency_group" class="freq-pill-row">
								<button
									type="button"
									class="freq-pill"
									class:active={frequency === 'weekly'}
									onclick={() => (frequency = 'weekly')}
								>
									Weekly
								</button>
								<button
									type="button"
									class="freq-pill"
									class:active={frequency === 'biweekly'}
									onclick={() => (frequency = 'biweekly')}
								>
									Biweekly
								</button>
								<button
									type="button"
									class="freq-pill"
									class:active={frequency === 'monthly'}
									onclick={() => (frequency = 'monthly')}
								>
									Monthly
								</button>
								<button
									type="button"
									class="freq-pill"
									class:active={frequency === 'yearly'}
									onclick={() => (frequency = 'yearly')}
								>
									Yearly
								</button>
							</div>
						</div>

						<!-- Field 4: NEXT OUTFLOW -->
						<div class="field-group">
							<label class="field-label" for="next_outflow">NEXT OUTFLOW</label>
							<input
								id="next_outflow"
								name="next_outflow"
								type="date"
								required
								bind:value={nextOutflow}
								class="pill-input date-input"
							/>
						</div>

						<!-- Field 5: CATEGORY (Optional) -->
						{#if categories.length > 0}
							<div class="field-group">
								<label class="field-label" for="category_scheduled">CATEGORY</label>
								<select
									id="category_scheduled"
									class="pill-input select-input"
									bind:value={category_id}
								>
									{#each categories as cat (cat.id)}
										<option value={cat.id}>{cat.icon} {cat.name}</option>
									{/each}
								</select>
							</div>
						{/if}

						<!-- Submit CTA Button -->
						<button
							type="submit"
							class="cta-button"
							disabled={submitting || !description.trim() || parseFloat(rawAmount) <= 0}
						>
							{#if submitting}
								<span>Committing...</span>
							{:else}
								<span>{scheduledCtaLabel}</span>
							{/if}
						</button>
					</form>
				{:else}
					<!-- ═══ MODE 2: DEBT / BORROWED FORM ═══ -->
					<form method="POST" action="/lending?/create" use:enhance={handleDebtEnhance}>
						<input type="hidden" name="direction" value="borrowed" />
						<input type="hidden" name="date_lent" value={formatDateInput()} />
						<input type="hidden" name="amount" value={rawAmount} />

						<!-- Field 1: WHO DID YOU BORROW FROM? -->
						<div class="field-group">
							<label class="field-label" for="borrower_name">WHO DID YOU BORROW FROM?</label>
							<input
								id="borrower_name"
								name="borrower_name"
								type="text"
								required
								placeholder="e.g. John"
								bind:value={borrowerName}
								class="pill-input text-input"
							/>
						</div>

						<!-- Field 2: HOW MUCH? -->
						<div class="field-group">
							<label class="field-label" for="amount_debt">HOW MUCH?</label>
							<div class="pill-input amount-input-wrap">
								<span class="currency-prefix">₱</span>
								<input
									id="amount_debt"
									name="amount_debt"
									type="text"
									inputmode="decimal"
									required
									placeholder="0.00"
									value={formattedAmount}
									oninput={onAmountInput}
									onfocus={onAmountFocus}
									onblur={onAmountBlur}
									autocomplete="off"
									class="amount-input"
								/>
							</div>
						</div>

						<!-- Field 3: WHEN IS IT DUE? -->
						<div class="field-group">
							<label class="field-label" for="due_date">WHEN IS IT DUE?</label>
							<input
								id="due_date"
								name="due_date"
								type="date"
								bind:value={dueDate}
								class="pill-input date-input"
							/>
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

						<!-- Submit CTA Button -->
						<button
							type="submit"
							class="cta-button"
							disabled={submitting || !borrowerName.trim() || parseFloat(rawAmount) <= 0}
						>
							{#if submitting}
								<span>Recording...</span>
							{:else}
								<span>{debtCtaLabel}</span>
							{/if}
						</button>
					</form>
				{/if}
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

	/* ─── Modal Shell ─── */
	.modal-card {
		background: var(--color-bg, #EFF8F7);
		border-radius: 28px;
		max-width: 480px;
		width: 100%;
		position: relative;
		box-shadow: 0 20px 40px rgba(14, 42, 39, 0.15), 0 0 0 1px rgba(255, 210, 63, 0.25);
		animation: modalPop 280ms var(--bounce, cubic-bezier(0.34, 1.56, 0.64, 1));
		overflow: hidden;
		padding: 28px 24px;
		max-height: calc(100dvh - 40px);
		display: flex;
		flex-direction: column;
	}

	[data-theme="dark"] .modal-card {
		background: #101715;
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 210, 63, 0.25);
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

	/* ─── Header ─── */
	.modal-header {
		position: relative;
		margin-bottom: 16px;
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

	/* ─── Mode Toggle Bar (Scheduled vs Debt) ─── */
	.mode-toggle-bar {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		margin-bottom: 18px;
		flex-shrink: 0;
	}

	.toggle-btn {
		height: 48px;
		border-radius: 999px;
		border: 1px solid var(--color-hairline, rgba(93, 173, 226, 0.3));
		font-family: var(--font-display);
		font-size: 15px;
		font-weight: 800;
		cursor: pointer;
		background: #FFFDF5;
		color: var(--color-text-muted, #5C7A78);
		transition: all 200ms var(--bounce, ease);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	[data-theme="dark"] .toggle-btn {
		background: rgba(255, 255, 255, 0.05);
	}

	.toggle-btn.active {
		background: var(--color-gold, #FFD23F);
		color: #14302E;
		border-color: transparent;
		box-shadow: 0 6px 18px rgba(255, 210, 63, 0.4);
	}

	/* ─── White Form Container ─── */
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

	/* ─── Fields & Inputs ─── */
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

	.pill-input {
		width: 100%;
		height: 52px;
		border-radius: 16px;
		border: 1px solid var(--color-hairline, rgba(93, 173, 226, 0.3));
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
		border-color: rgba(255, 255, 255, 0.12);
	}

	.select-input {
		cursor: pointer;
		appearance: none;
		-webkit-appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%235C7A78' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 16px center;
		padding-right: 40px;
	}

	.pill-input:focus {
		border-color: var(--color-gold, #FFD23F);
		box-shadow: 0 0 0 3.5px rgba(255, 210, 63, 0.3);
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
		font-size: 24px;
		font-weight: 800;
		color: var(--color-text-muted, #5C7A78);
		margin-right: 6px;
	}

	.amount-input {
		flex: 1;
		border: none !important;
		background: transparent !important;
		padding: 0 !important;
		font-family: var(--font-display);
		font-size: 28px;
		font-weight: 800;
		color: var(--color-ink, #14302E);
		letter-spacing: -0.02em;
		box-shadow: none !important;
	}

	[data-theme="dark"] .amount-input {
		color: #EAF7F5;
	}

	/* ─── Frequency Pill Selector Row ─── */
	.freq-pill-row {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 6px;
	}

	.freq-pill {
		height: 38px;
		border-radius: 999px;
		border: none;
		background: #FFFDF5;
		color: var(--color-text-muted, #5C7A78);
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 700;
		cursor: pointer;
		transition: all 180ms ease;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	[data-theme="dark"] .freq-pill {
		background: rgba(255, 255, 255, 0.05);
	}

	.freq-pill.active {
		background: var(--color-gold, #FFD23F);
		color: #14302E;
		box-shadow: 0 3px 10px rgba(255, 210, 63, 0.35);
	}

	.date-input {
		cursor: pointer;
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

	/* ─── CTA Submit Button ─── */
	.cta-button {
		width: 100%;
		height: 52px;
		border-radius: 999px;
		border: none;
		background: var(--color-gold, #FFD23F);
		color: #14302E;
		font-family: var(--font-display);
		font-size: 16px;
		font-weight: 800;
		letter-spacing: -0.01em;
		cursor: pointer;
		box-shadow: 0 6px 20px rgba(255, 210, 63, 0.4);
		transition: all 180ms var(--bounce, ease);
		display: flex;
		align-items: center;
		justify-content: center;
		margin-top: 10px;
	}

	.cta-button:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 8px 24px rgba(255, 210, 63, 0.55);
		filter: brightness(1.05);
	}

	.cta-button:disabled {
		opacity: 0.45;
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
		.freq-pill-row {
			grid-template-columns: 1fr 1fr;
		}
		.field-row {
			grid-template-columns: 1fr;
		}
	}
</style>

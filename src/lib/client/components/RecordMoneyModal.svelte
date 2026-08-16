<script lang="ts">
	import { enhance } from '$app/forms';
	import { tick, untrack } from 'svelte';
	import { showSuccess, showError } from '$lib/client/stores/toast.svelte';
	import { formatDateInput, formatWithCommas } from '$lib/shared/utils/format';
	import type { Category, Transaction, TransactionType } from '$lib/types';

	let {
		open = false,
		categories = [],
		transaction,
		action = '?/create',
		onClose,
		onSuccess
	}: {
		open?: boolean;
		categories: Category[];
		transaction?: Transaction;
		action?: string;
		onClose?: () => void;
		onSuccess?: (createdPayload?: { type: TransactionType; amount: number; categoryName: string }) => void;
	} = $props();

	let type = $state<TransactionType>('expense');
	let rawAmount = $state('');
	let category_id = $state<number | string>('');
	let description = $state('');
	let date = $state(formatDateInput());
	let sourceOfFunds = $state('');
	let notes = $state('');
	let showDetails = $state(false); // collapsed by default; expands on "+ Add details" click
	let submitting = $state(false);
	let modalRef = $state<HTMLElement | null>(null);

	// Sync when editing an existing transaction or opening
	$effect(() => {
		if (transaction) {
			type = transaction.type;
			rawAmount = String(transaction.amount);
			category_id = transaction.category_id;
			description = transaction.description;
			date = transaction.date;
			sourceOfFunds = transaction.source_of_funds ?? '';
			showDetails = true;
		} else if (open) {
			untrack(() => {
				if (!transaction) {
					type = 'expense';
					rawAmount = '';
					category_id = '';
					description = '';
					date = formatDateInput();
					sourceOfFunds = '';
					notes = '';
					showDetails = false;
				}
			});
		}
	});

	const filteredCategories = $derived(
		categories.filter((cat) => cat.type === type)
	);

	// Reset selected category if switching between Expense/Income and it doesn't belong to the active type
	$effect(() => {
		if (category_id && !filteredCategories.find((c) => c.id === Number(category_id))) {
			category_id = filteredCategories[0]?.id ?? '';
		}
	});

	// Auto-select first category if empty
	$effect(() => {
		if (!category_id && filteredCategories.length > 0) {
			category_id = filteredCategories[0].id;
		}
	});

	const selectedCategory = $derived(
		categories.find((c) => c.id === Number(category_id))
	);

	const numericAmount = $derived(rawAmount ? parseFloat(rawAmount) || 0 : 0);

	const formattedAmount = $derived(
		rawAmount && !isNaN(parseFloat(rawAmount)) && parseFloat(rawAmount) > 0
			? formatWithCommas(rawAmount)
			: ''
	);

	const ctaLabel = $derived.by(() => {
		if (transaction) return 'Save Changes';
		if (type === 'income') {
			return formattedAmount ? `Record ₱${formattedAmount} Income` : 'Record Income';
		}
		return formattedAmount ? `Record ₱${formattedAmount} Expense` : 'Record Expense';
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

	function getSubmitDescription(): string {
		const base = (description || '').trim();
		if (base.length > 0) return base;
		return selectedCategory?.name ?? (type === 'income' ? 'Income' : 'Expense');
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

	function handleEnhance() {
		if (submitting) return;
		submitting = true;
		return async ({ result, update }: { result: { type: string; data?: { errors?: Record<string, string> } }; update: () => Promise<void> }) => {
			submitting = false;
			if (result.type === 'redirect' || result.type === 'success') {
				showSuccess(transaction ? 'Transaction updated' : `${type === 'income' ? 'Income' : 'Expense'} recorded!`);
				onSuccess?.({
					type,
					amount: numericAmount,
					categoryName: selectedCategory?.name ?? ''
				});
				close();
			} else if (result.type === 'failure') {
				const errMsg = result.data?.errors
					? Object.values(result.data.errors).join(', ')
					: 'Could not record transaction. Please check inputs.';
				showError(errMsg);
			}
			await update();
		};
	}

	$effect(() => {
		if (open) {
			tick().then(() => {
				const amountEl = modalRef?.querySelector<HTMLElement>('input[name="amount_input"]');
				amountEl?.focus();
			});
		}
	});
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="modal-backdrop" onclick={handleBackdrop} role="dialog" aria-modal="true" aria-label="Record Money">
		<div class="modal-card" bind:this={modalRef}>
			<!-- Header -->
			<div class="modal-header">
				<div class="header-badge">MONEY OUT</div>
				<h2 class="header-title">{transaction ? 'Edit Transaction' : 'Record Money'}</h2>
				<p class="header-subtitle">Fast entry. Expense or income, in seconds.</p>
				<button type="button" class="close-btn" onclick={close} aria-label="Close">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="18" y1="6" x2="6" y2="18"/>
						<line x1="6" y1="6" x2="18" y2="18"/>
					</svg>
				</button>
			</div>

			<!-- White Card Container -->
			<div class="form-container">
				<form method="POST" {action} use:enhance={handleEnhance}>
					{#if transaction?.id}
						<input type="hidden" name="id" value={transaction.id} />
					{/if}
					<input type="hidden" name="type" value={type} />
					<input type="hidden" name="category_id" value={category_id} />
					<input type="hidden" name="amount" value={rawAmount} />
					<input type="hidden" name="description" value={getSubmitDescription()} />
					<input type="hidden" name="date" value={date} />
					<input type="hidden" name="source_of_funds" value={sourceOfFunds} />

					<!-- Top Type Toggle: Expense vs Income -->
					<div class="type-toggle-bar">
						<button
							type="button"
							class="toggle-btn expense-btn"
							class:active={type === 'expense'}
							onclick={() => (type = 'expense')}
						>
							Expense
						</button>
						<button
							type="button"
							class="toggle-btn income-btn"
							class:active={type === 'income'}
							onclick={() => (type = 'income')}
						>
							Income
						</button>
					</div>

					<!-- Field 1: CATEGORY -->
					<div class="field-group">
						<label class="field-label" for="category_select">CATEGORY</label>
						<select
							id="category_select"
							class="pill-input select-input"
							bind:value={category_id}
							required
						>
							{#if filteredCategories.length === 0}
								<option value="" disabled>No {type} categories found</option>
							{:else}
								{#each filteredCategories as cat (cat.id)}
									<option value={cat.id}>{cat.icon} {cat.name}</option>
								{/each}
							{/if}
						</select>
					</div>

					<!-- Field 2: AMOUNT -->
					<div class="field-group">
						<label class="field-label" for="amount_input">AMOUNT</label>
						<div class="pill-input amount-input-wrap">
							<span class="currency-prefix">₱</span>
							<input
								id="amount_input"
								name="amount_input"
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

					<!-- Details Toggle button -->
					<div class="details-toggle-row">
						<button
							type="button"
							class="details-toggle-btn"
							onclick={() => (showDetails = !showDetails)}
						>
							{showDetails ? '– Hide details' : '+ Add details'}
						</button>
					</div>

					<!-- Expandable Details Section -->
					{#if showDetails}
						<div class="details-fields">
							<!-- Description -->
							<div class="field-group">
								<input
									id="description_input"
									type="text"
									placeholder="Description"
									bind:value={description}
									class="pill-input text-input"
								/>
							</div>

							<!-- Date -->
							<div class="field-group">
								<input
									id="date_input"
									type="date"
									required
									bind:value={date}
									class="pill-input date-input"
								/>
							</div>

							<!-- Source of funds -->
							<div class="field-group">
								<input
									id="source_input"
									type="text"
									placeholder="Source of funds"
									bind:value={sourceOfFunds}
									class="pill-input text-input"
								/>
							</div>

							<!-- Notes -->
							<div class="field-group">
								<textarea
									id="notes_input"
									rows="2"
									placeholder="Notes"
									bind:value={notes}
									class="pill-input notes-textarea"
								></textarea>
							</div>
						</div>
					{/if}

					<!-- Primary CTA Submit Button -->
					<button
						type="submit"
						class="cta-button"
						class:is-income={type === 'income'}
						class:is-expense={type === 'expense'}
						disabled={submitting || numericAmount <= 0 || !category_id}
					>
						{#if submitting}
							<span>Saving...</span>
						{:else}
							<span>{ctaLabel}</span>
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

	/* ─── Modal Shell ─── */
	.modal-card {
		background: var(--color-bg, #EFF8F7);
		border-radius: 28px;
		max-width: 480px;
		width: 100%;
		position: relative;
		box-shadow: 0 20px 40px rgba(14, 42, 39, 0.15), 0 0 0 1px rgba(239, 108, 74, 0.2);
		animation: modalPop 280ms var(--bounce, cubic-bezier(0.34, 1.56, 0.64, 1));
		overflow: hidden;
		padding: 28px 24px;
		max-height: calc(100dvh - 40px);
		display: flex;
		flex-direction: column;
	}

	[data-theme="dark"] .modal-card {
		background: #101715;
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 138, 106, 0.25);
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

	/* ─── White Form Card Container ─── */
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

	/* ─── Type Toggle Bar (Expense vs Income) ─── */
	.type-toggle-bar {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		margin-bottom: 20px;
	}

	.toggle-btn {
		height: 48px;
		border-radius: 999px;
		border: none;
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

	.expense-btn.active {
		background: var(--color-money-gone, #F06543);
		color: #FFFFFF;
		box-shadow: 0 6px 18px rgba(240, 101, 67, 0.35);
	}

	.income-btn.active {
		background: var(--color-money-returning, #2BA8A2);
		color: #FFFFFF;
		box-shadow: 0 6px 18px rgba(43, 168, 162, 0.35);
	}

	/* ─── Fields & Labels ─── */
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

	/* ─── Pill Input Styling ─── */
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

	.pill-input:focus,
	.pill-input:focus-within {
		border-color: var(--color-money-returning, #2BA8A2);
		box-shadow: 0 0 0 3.5px rgba(43, 168, 162, 0.25);
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
		outline: none !important;  /* suppress browser native blue ring — wrapper shows :focus-within ring */
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

	/* ─── Details Toggle Link ─── */
	.details-toggle-row {
		margin: 12px 0 16px 0;
	}

	.details-toggle-btn {
		background: none;
		border: none;
		padding: 0;
		font-family: var(--font-body);
		font-size: 13px;
		font-weight: 800;
		color: var(--color-money-returning, #2BA8A2);
		cursor: pointer;
		transition: opacity 150ms ease;
	}

	.details-toggle-btn:hover {
		opacity: 0.8;
	}

	.details-fields {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.text-input::placeholder,
	.notes-textarea::placeholder {
		color: var(--color-text-muted);
		opacity: 0.6;
	}

	.date-input {
		cursor: pointer;
	}

	.notes-textarea {
		height: 70px;
		padding: 12px 16px;
		resize: none;
	}

	/* ─── CTA Submit Button ─── */
	.cta-button {
		width: 100%;
		height: 52px;
		border-radius: 999px;
		border: none;
		font-family: var(--font-display);
		font-size: 16px;
		font-weight: 800;
		color: #FFFFFF;
		cursor: pointer;
		transition: all 180ms var(--bounce, ease);
		display: flex;
		align-items: center;
		justify-content: center;
		margin-top: 10px;
	}

	.cta-button.is-expense {
		background: var(--color-money-gone, #F06543);
		box-shadow: 0 6px 20px rgba(240, 101, 67, 0.35);
	}

	.cta-button.is-income {
		background: var(--color-money-returning, #2BA8A2);
		box-shadow: 0 6px 20px rgba(43, 168, 162, 0.35);
	}

	.cta-button:hover:not(:disabled) {
		transform: translateY(-1px);
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
	}
</style>

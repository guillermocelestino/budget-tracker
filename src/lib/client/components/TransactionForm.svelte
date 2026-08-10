<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import Button from '$lib/client/components/Button.svelte';
	import LiveImpactPreview from '$lib/client/components/LiveImpactPreview.svelte';
	import { themeState } from '$lib/client/stores/preferences.svelte';
	import { getCategoryHue, getCategoryTint, getCategoryText } from '$lib/shared/utils/categoryColors';
	import { formatDateInput, formatWithCommas } from '$lib/shared/utils/format';
import { formatDate, formatCurrency, handleAmountInput, handleAmountFocus, handleAmountBlur } from '$lib/client/utils/format';
	import { showSuccess } from '$lib/client/stores/toast.svelte';
	import type { Category, Transaction, TransactionType } from '$lib/types';

	let {
		categories = [],
		transaction,
		action,
		errors = {},
		spendingMap = {},
		categoryTxnCounts = {},
		onCancel,
		onSuccess,
	}: {
		categories: Category[];
		transaction?: Transaction;
		action?: string;
		errors?: Record<string, string>;
		spendingMap?: Record<number, number>;
		categoryTxnCounts?: Record<number, number>;
		onCancel?: () => void;
		onSuccess?: () => void;
	} = $props();

	let type = $state<TransactionType>('expense');
	let rawAmount = $state('');
	let description = $state('');
	let date = $state(formatDateInput());
	let category_id = $state<number | string>('');
	let isRefund = $state(false);

	const isDark = $derived(themeState.isDark);

	$effect(() => {
		if (transaction) {
			type = transaction.type;
			rawAmount = String(transaction.amount);
			description = transaction.description;
			date = transaction.date;
			category_id = transaction.category_id;
			isRefund = description.startsWith('[REFUND]');
		} else {
			type = 'expense';
			rawAmount = '';
			description = '';
			date = formatDateInput();
			category_id = '';
			isRefund = false;
		}
	});

	const filteredCategories = $derived(
		categories.filter(cat => cat.type === type)
	);

	$effect(() => {
		if (category_id && !filteredCategories.find(c => c.id === Number(category_id))) {
			category_id = '';
		}
	});

	// ─── Selective Memoization (Svelte 5 Runes) ───
	// Recomputed ONLY when category_id, type, rawAmount, isRefund, or spendingMap changes.
	// Typing in description, date, or notes does NOT recompute these.
	const selectedCategory = $derived(
		categories.find(c => c.id === Number(category_id))
	);

	const currentCategoryTotal = $derived(
		category_id ? (spendingMap[Number(category_id)] ?? 0) : 0
	);

	const currentTxnCount = $derived(
		category_id ? (categoryTxnCounts[Number(category_id)] ?? 0) : 0
	);

	const numericAmount = $derived(rawAmount ? parseFloat(rawAmount) || 0 : 0);

	const projectedCategoryTotal = $derived(
		isRefund
			? Math.max(0, currentCategoryTotal - numericAmount)
			: currentCategoryTotal + numericAmount
	);

	function onAmountInput(e: Event) {
		rawAmount = handleAmountInput(e);
	}

	function onAmountFocus(e: Event) {
		handleAmountFocus(e, rawAmount);
	}

	function onAmountBlur(e: Event) {
		handleAmountBlur(e, rawAmount);
	}

	const displayAmount = $derived(rawAmount ? formatWithCommas(rawAmount) : '');

	function adjustAmount(delta: number) {
		const val = parseFloat(rawAmount) || 0;
		rawAmount = String(Math.max(0, val + delta));
	}

	function handleEnhance() {
		return async ({ result, update }: { result: { type: string }; update: () => Promise<void> }) => {
			if (result.type === 'redirect' || result.type === 'success') {
				showSuccess(transaction ? 'Transaction updated successfully' : 'Transaction added successfully');
				onSuccess?.();
			}
			await update();
		};
	}

	function handleCancelClick() {
		if (onCancel) {
			onCancel();
		} else {
			goto('/transactions');
		}
	}

	function getSubmitDescription(): string {
		if (isRefund && !description.startsWith('[REFUND]')) {
			return `[REFUND] ${description}`;
		}
		if (!isRefund && description.startsWith('[REFUND]')) {
			return description.replace('[REFUND] ', '');
		}
		return description;
	}
</script>

<form method="POST" {action} use:enhance={handleEnhance}>
	{#if transaction?.id}
		<input type="hidden" name="id" value={transaction.id} />
	{/if}
	<div class="form-grid">
		<!-- 1. Type Toggle -->
		<fieldset class="form-group">
			<legend class="form-label">Type</legend>
			<div class="type-toggle" role="radiogroup" aria-label="Transaction type">
				<label class="type-option" class:active={type === 'expense'}>
					<input type="radio" name="type" value="expense" bind:group={type} />
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
					</svg>
					Expense
				</label>
				<label class="type-option" class:active={type === 'income'}>
					<input type="radio" name="type" value="income" bind:group={type} />
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
					</svg>
					Income
				</label>
			</div>
			{#if errors.type}
				<span class="form-error">{errors.type}</span>
			{/if}
		</fieldset>

		<!-- 2. Category Selector -->
		<div class="form-group">
			<label class="form-label">Category</label>
			<div class="category-section">
				<input type="hidden" name="category_id" value={category_id} />
				{#if filteredCategories.length > 0}
					<div class="category-chips">
						{#each filteredCategories as cat (cat.id)}
							{@const hue = getCategoryHue('', cat.color)}
							{@const tint = getCategoryTint('', hue, isDark)}
							{@const fg = getCategoryText('', hue, isDark)}
							<button type="button" class="cat-chip" class:active={Number(category_id) === cat.id}
								onclick={() => category_id = cat.id}
								aria-pressed={Number(category_id) === cat.id}
							>
								<span class="cat-chip-icon" style="background: {tint}; color: {fg}">{cat.icon}</span>
								<span class="cat-chip-name">{cat.name}</span>
							</button>
						{/each}
					</div>
				{:else}
					<div class="no-categories">
						<span class="form-error">No {type} categories found. Create one in Categories first.</span>
					</div>
				{/if}
				{#if errors.category_id && filteredCategories.length > 0}
					<span class="form-error">{errors.category_id}</span>
				{/if}
			</div>
		</div>

		<!-- 3. Context Card (Appears immediately below Category selection) -->
		<div class="context-card-container">
			{#if transaction}
				<!-- Edit Mode Context Card -->
				<div class="context-card edit-mode">
					<div class="context-card-header">
						<span class="context-badge">Editing Transaction</span>
						<span class="context-cat-title">{selectedCategory?.name ?? 'Transaction'}</span>
					</div>
					<div class="context-body">
						<div class="context-row">
							<span class="context-label">Original transaction</span>
							<span class="context-val-highlight">
								{formatCurrency(transaction.amount)} {transaction.type} • Created {formatDate(transaction.date)}
							</span>
						</div>
						<div class="context-row">
							<span class="context-label">This month</span>
							<span class="context-val">
								{currentTxnCount} {currentTxnCount === 1 ? 'transaction' : 'transactions'} • {formatCurrency(currentCategoryTotal)} {type === 'income' ? 'earned' : 'spent'}
							</span>
						</div>
					</div>
				</div>
			{:else if selectedCategory}
				<!-- Add Mode Context Card (Category Selected) -->
				<div class="context-card add-mode">
					<div class="context-card-header">
						<span class="context-cat-icon">{selectedCategory.icon}</span>
						<span class="context-cat-title">{selectedCategory.name}</span>
					</div>
					<div class="context-body">
						<div class="context-stats-line">
							<span class="stat-pill">{currentTxnCount} {currentTxnCount === 1 ? 'transaction' : 'transactions'} this month</span>
							<span class="stat-pill primary">
								{type === 'income' ? 'Income' : 'Spent'} this month: <strong>{formatCurrency(currentCategoryTotal)}</strong>
							</span>
						</div>
					</div>
				</div>
			{:else}
				<!-- Add Mode Context Card (No Category Selected) -->
				<div class="context-card prompt-mode">
					<span class="prompt-icon">💡</span>
					<span class="prompt-text">Select a category to view monthly activity</span>
				</div>
			{/if}
		</div>

		<!-- 4. Amount Section -->
		<div class="form-group">
			<label class="form-label" for="amount">Amount</label>
			<div class="amount-section">
				<button type="button" class="amt-btn amt-minus" onclick={() => adjustAmount(-500)} aria-label="Subtract 500">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
				</button>
				<div class="amount-display-wrap" class:refund-active={isRefund}>
					<span class="amount-prefix">{isRefund ? '↩' : '₱'}</span>
					<input
						id="amount"
						type="text"
						inputmode="decimal"
						required
						placeholder="0.00"
						value={displayAmount}
						oninput={onAmountInput}
						onfocus={onAmountFocus}
						onblur={onAmountBlur}
						class:input-error={errors.amount}
						autocomplete="off"
					/>
				</div>
				<button type="button" class="amt-btn amt-plus" onclick={() => adjustAmount(500)} aria-label="Add 500">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
				</button>
			</div>
			<input type="hidden" name="amount" value={rawAmount} />
			{#if errors.amount}
				<span class="form-error">{errors.amount}</span>
			{/if}
		</div>

		<!-- 5. Description Input -->
		<div class="form-group">
			<label class="form-label" for="description">Description</label>
			<div class="desc-input-wrap">
				<textarea
					id="description"
					name="description"
					required
					maxlength="500"
					bind:value={description}
					class:input-error={errors.description}
					placeholder="What was this for?"
					rows="3"
				></textarea>
				<span class="char-count">{description.length}/500</span>
			</div>
			<input type="hidden" name="description" value={getSubmitDescription()} />
			{#if errors.description}
				<span class="form-error">{errors.description}</span>
			{/if}
		</div>

		<!-- 6. Date Picker -->
		<div class="form-group">
			<label class="form-label" for="date">Date</label>
			<div class="date-input-row">
				<input
					id="date"
					name="date"
					type="date"
					required
					bind:value={date}
					class:input-error={errors.date}
				/>
				<button type="button" class="btn-today" onclick={() => date = formatDateInput()} title="Set to today">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="10"/>
						<polyline points="12 6 12 12 16 14"/>
					</svg>
					Today
				</button>
			</div>
			{#if errors.date}
				<span class="form-error">{errors.date}</span>
			{/if}
		</div>

		<!-- 7. Refund Toggle (Moved below Date) -->
		<div class="form-group refund-section">
			<div class="refund-toggle">
				<label class="refund-label">
					<input type="checkbox" bind:checked={isRefund} />
					<span class="refund-text">Record as refund</span>
					{#if isRefund}
						<span class="refund-chip">↩ Refund</span>
					{/if}
				</label>
			</div>
			<p class="refund-helper">Record this transaction as a refund or reimbursement.</p>
		</div>

		<!-- 8. Live Impact Preview (Display-only) -->
		<LiveImpactPreview
			currentTotal={currentCategoryTotal}
			projectedTotal={projectedCategoryTotal}
			type={type}
			isRefund={isRefund}
			categoryName={selectedCategory?.name ?? ''}
		/>
	</div>

	<!-- 9. Footer (Equal 2-Column Grid) -->
	<div class="form-actions">
		<Button type="submit" variant="primary" fullWidth>
			{transaction ? 'Save Changes' : 'Add Transaction'}
		</Button>
		<Button variant="ghost" type="button" fullWidth onclick={handleCancelClick}>
			Cancel
		</Button>
	</div>
</form>

<style>
	fieldset.form-group {
		border: none;
		padding: 0;
		margin: 0;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.form-grid {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
	}

	/* ── Flip7 Labels ── */
	.form-label {
		font-family: var(--font-display);
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-text);
		text-transform: none;
		letter-spacing: 0.02em;
	}

	/* ── Input surfaces ── */
	input[type="text"],
	input[type="number"],
	input[type="date"],
	textarea {
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-md);
		font-size: var(--font-size-base);
		font-family: var(--font-body);
		background: var(--color-cream);
		color: var(--color-text);
		transition: border-color 200ms var(--ease), box-shadow 200ms var(--ease);
		width: 100%;
		-webkit-appearance: none;
		appearance: none;
	}

	input,
	textarea {
		min-height: 44px;
	}

	textarea {
		resize: vertical;
		min-height: 80px;
		line-height: 1.5;
		background: var(--color-cream);
	}

	input:focus,
	textarea:focus {
		outline: none;
		border-color: var(--color-teal);
		box-shadow: var(--focus);
	}

	.input-error {
		border-color: var(--color-coral) !important;
		box-shadow: 0 0 0 4px rgba(239, 108, 74, 0.12) !important;
	}

	.form-error {
		font-size: var(--font-size-sm);
		color: var(--color-coral);
		font-weight: 500;
	}

	/* ── Context Card ── */
	.context-card-container {
		min-height: 52px;
	}

	.context-card {
		background: var(--color-surface-inset);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--space-md);
		transition: all 200ms var(--ease);
	}

	.context-card.prompt-mode {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		background: rgba(43, 168, 162, 0.06);
		border: 1px dashed var(--color-teal);
		padding: var(--space-sm) var(--space-md);
	}

	.prompt-icon {
		font-size: 16px;
	}

	.prompt-text {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		font-weight: 500;
	}

	.context-card-header {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		margin-bottom: var(--space-xs);
	}

	.context-badge {
		font-family: var(--font-display);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 2px 8px;
		background: var(--color-gold-bg);
		color: var(--color-on-gold);
		border-radius: var(--radius-pill);
	}

	.context-cat-title {
		font-family: var(--font-display);
		font-size: var(--font-size-sm);
		font-weight: 700;
		color: var(--color-text);
	}

	.context-body {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.context-row {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.context-label {
		font-size: 11px;
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.context-val-highlight {
		font-size: var(--font-size-xs);
		font-weight: 600;
		color: var(--color-coral);
	}

	.context-val {
		font-size: var(--font-size-xs);
		color: var(--color-text);
		font-weight: 500;
	}

	.context-stats-line {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-xs);
	}

	.stat-pill {
		font-size: var(--font-size-xs);
		padding: 4px 10px;
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-pill);
		color: var(--color-text-muted);
	}

	.stat-pill.primary {
		color: var(--color-text);
		border-color: var(--color-border);
	}

	/* ── Refund toggle ── */
	.refund-section {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.refund-toggle {
		display: flex;
		align-items: center;
	}

	.refund-label {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		cursor: pointer;
		padding: var(--space-xs) var(--space-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		transition: all 200ms var(--ease);
		user-select: none;
		min-height: 44px;
		width: 100%;
	}

	.refund-label:has(input:checked) {
		background: var(--mint-tint);
		border-color: var(--teal);
	}

	.refund-label input {
		width: 18px;
		height: 18px;
		flex-shrink: 0;
		accent-color: var(--teal-deep);
		appearance: auto;
		-webkit-appearance: auto;
		outline: none;
		box-shadow: none;
		cursor: pointer;
	}

	.refund-text {
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.refund-label:has(input:checked) .refund-text {
		color: var(--teal-deep);
	}

	.refund-chip {
		margin-left: auto;
		padding: 2px 10px;
		background: var(--mint-tint-2);
		color: var(--teal-deep);
		border-radius: var(--radius-pill);
		font-family: var(--font-display);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.03em;
	}

	.refund-helper {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		margin: 2px 0 0 4px;
	}

	/* ── Type toggle ── */
	.type-toggle {
		display: flex;
		gap: var(--space-xs);
		padding: 4px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.type-option {
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
		font-family: var(--font-body);
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-semibold);
		cursor: pointer;
		min-height: 44px;
		user-select: none;
		-webkit-tap-highlight-color: transparent;
		transition: background var(--transition-fast), color var(--transition-fast), box-shadow var(--transition-fast);
	}

	.type-option:hover {
		background: var(--color-surface-inset);
		color: var(--color-text);
	}

	.type-option:focus-visible {
		outline: none;
		box-shadow: var(--focus);
	}

	.type-option input {
		display: none;
	}

	.type-option:first-child.active {
		background: var(--rose-soft);
		color: var(--rose);
	}

	.type-option:nth-child(2).active {
		background: var(--mint-tint);
		color: var(--teal-deep);
	}

	/* ── Amount counter row ── */
	.amount-section {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.amt-btn {
		width: 44px;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
		font-size: 20px;
		font-weight: 700;
		font-family: var(--font-display);
		flex-shrink: 0;
		transition: all 150ms var(--ease);
		-webkit-tap-highlight-color: transparent;
		background: var(--color-teal-bg);
		color: var(--color-teal);
		box-shadow: var(--glow-soft);
	}

	.amt-btn:active {
		transform: scale(0.92);
	}

	.amt-minus {
		background: rgba(239, 108, 74, 0.10);
		color: var(--color-coral);
	}

	.amt-minus:hover {
		background: rgba(239, 108, 74, 0.18);
	}

	.amt-plus {
		background: var(--color-teal-bg);
		color: var(--color-teal);
	}

	.amt-plus:hover {
		background: rgba(43, 168, 162, 0.18);
	}

	.amount-display-wrap {
		display: flex;
		align-items: stretch;
		flex: 1;
		background: var(--color-cream);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-md);
		overflow: hidden;
		transition: border-color 200ms var(--ease), box-shadow 200ms var(--ease);
	}

	.amount-display-wrap:focus-within {
		border-color: var(--color-teal);
		box-shadow: var(--focus);
	}

	.amount-display-wrap.refund-active {
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
		border: none;
	}

	.amount-display-wrap input {
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

	.amount-display-wrap input:focus {
		box-shadow: none !important;
	}

	.amount-display-wrap input::placeholder {
		color: var(--color-text-muted);
		opacity: 0.5;
	}

	/* ── Description ── */
	.desc-input-wrap {
		position: relative;
	}

	.desc-input-wrap textarea {
		padding-right: 60px;
	}

	.char-count {
		position: absolute;
		bottom: 10px;
		right: 12px;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		font-family: var(--font-mono);
		opacity: 0.6;
		pointer-events: none;
	}

	/* ── Date row ── */
	.date-input-row {
		display: flex;
		gap: var(--space-sm);
		align-items: center;
	}

	.date-input-row input[type="date"] {
		flex: 1;
		background: var(--color-cream);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-md);
		padding: var(--space-sm) var(--space-md);
		font-family: var(--font-body);
		font-size: var(--font-size-base);
		min-height: 44px;
		color: var(--color-text);
		transition: border-color 200ms var(--ease), box-shadow 200ms var(--ease);
	}

	.date-input-row input[type="date"]:focus {
		outline: none;
		border-color: var(--color-teal);
		box-shadow: var(--focus);
	}

	.btn-today {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: var(--space-xs) var(--space-lg);
		background: var(--color-teal-bg);
		border: 1px solid var(--color-teal);
		border-radius: var(--radius-pill);
		cursor: pointer;
		font-family: var(--font-display);
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-teal);
		min-height: 44px;
		white-space: nowrap;
		transition: all 200ms var(--ease);
		box-shadow: var(--glow-card);
	}

	.btn-today:hover {
		background: var(--color-teal);
		color: white;
		box-shadow: 0 4px 20px rgba(43, 168, 162, 0.30);
	}

	.btn-today:active {
		transform: scale(0.96);
	}

	/* ── Category chips grid ── */
	.category-section {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.category-chips {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--space-md);
	}

	.cat-chip {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: 10px 14px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		cursor: pointer;
		font-family: var(--font-body);
		transition: all 200ms var(--bounce);
		min-height: 48px;
		-webkit-tap-highlight-color: transparent;
		text-align: left;
	}

	.cat-chip:hover {
		border-color: var(--color-teal);
		background: var(--color-surface-inset);
	}

	.cat-chip:active {
		transform: scale(0.97);
	}

	.cat-chip.active {
		background: var(--color-teal-bg);
		border: 2px solid var(--color-teal);
		transform: scale(1.01);
		box-shadow: var(--shadow-sm);
	}

	.cat-chip-icon {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-md);
		font-size: 18px;
		flex-shrink: 0;
	}

	.cat-chip.active .cat-chip-name {
		color: var(--color-teal-dark);
		font-weight: var(--font-weight-extrabold);
	}

	.cat-chip-name {
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-text);
	}

	.no-categories {
		padding: var(--space-sm) var(--space-md);
	}

	/* ── Buttons ── */
	.form-actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-md);
		margin-top: var(--space-xl);
		width: 100%;
	}

	.form-actions :global(.btn) {
		width: 100%;
		height: 48px;
		min-height: 48px;
		border-radius: var(--radius-pill);
	}

	.form-actions :global(.btn:focus-visible) {
		outline: none;
		box-shadow: var(--focus);
	}

	@media (max-width: 639px) {
		.form-actions {
			grid-template-columns: 1fr;
		}

		.category-chips {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 480px) {
		.refund-label {
			width: 100%;
		}

		.amount-section {
			gap: var(--space-xs);
		}

		.amount-display-wrap input {
			font-size: 20px;
		}

		.amt-btn {
			width: 40px;
			height: 40px;
		}
	}
</style>

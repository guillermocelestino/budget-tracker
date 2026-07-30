<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { formatDateInput, formatWithCommas, handleAmountInput, handleAmountFocus, handleAmountBlur } from '$lib/utils/format';
	import { showSuccess } from '$lib/stores/toast.svelte';
	import type { Category, Transaction, TransactionType } from '$lib/types';

	let {
		categories = [],
		transaction,
		action,
		form,
		errors = {},
	}: {
		categories: Category[];
		transaction?: Transaction;
		action?: string;
		form?: Record<string, unknown>;
		errors?: Record<string, string>;
	} = $props();

	let type = $state<TransactionType>('expense');
	let rawAmount = $state('');
	let description = $state('');
	let date = $state(formatDateInput());
	let category_id = $state<number | string>('');
	let isRefund = $state(false);

	$effect(() => {
		if (transaction) {
			type = transaction.type;
			rawAmount = String(transaction.amount);
			description = transaction.description;
			date = transaction.date;
			category_id = transaction.category_id;
			isRefund = description.startsWith('[REFUND]');
		}
	});

	const filteredCategories = $derived(
		categories.filter(cat => cat.type === type)
	);

	$effect(() => {
		if (category_id && !filteredCategories.find(c => c.id === category_id)) {
			category_id = '';
		}
	});

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
			if (result.type === 'redirect') {
				showSuccess(transaction ? 'Transaction updated successfully' : 'Transaction added successfully');
			}
			await update();
		};
	}

	// ─── Refund: prepend marker to description ───
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
	<div class="form-grid">
		<fieldset class="form-group">
			<legend class="form-label">Type</legend>
			<div class="type-toggle">
				<label class="type-option" class:active={type === 'expense'}>
					<input type="radio" name="type" value="expense" bind:group={type} />
					💸 Expense
				</label>
				<label class="type-option" class:active={type === 'income'}>
					<input type="radio" name="type" value="income" bind:group={type} />
					💰 Income
				</label>
			</div>
			{#if errors.type}
				<span class="form-error">{errors.type}</span>
			{/if}
		</fieldset>

		<!-- ═══ Refund toggle ═══ -->
		<div class="refund-toggle">
			<label class="refund-label">
				<input type="checkbox" bind:checked={isRefund} />
				<span class="refund-check">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="23 4 23 10 17 10"/>
						<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
					</svg>
				</span>
				<span class="refund-text">Record as refund</span>
				{#if isRefund}
					<span class="refund-chip">↩ Refund</span>
				{/if}
			</label>
		</div>

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
			<!-- Pass potentially modified description with refund marker -->
			<input type="hidden" name="description" value={getSubmitDescription()} />
			{#if errors.description}
				<span class="form-error">{errors.description}</span>
			{/if}
		</div>

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

		<div class="form-group">
			<label class="form-label">Category</label>
			<div class="category-section">
				<input type="hidden" name="category_id" value={category_id} />
				{#if filteredCategories.length > 0}
					<div class="category-chips">
						{#each filteredCategories as cat (cat.id)}
							<button type="button" class="cat-chip" class:active={category_id === cat.id}
								onclick={() => category_id = cat.id}
								style="--chip-color: {cat.color || 'var(--color-teal)'}"
							>
								<span class="cat-chip-icon">{cat.icon}</span>
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
	</div>

	<div class="form-actions">
		<button type="submit" class="btn btn-submit">
			{transaction ? 'Update Transaction' : 'Add Transaction'}
		</button>
		<button type="button" class="btn btn-cancel" onclick={() => goto('/transactions')}>
			Cancel
		</button>
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

	/* ── Refund toggle ── */
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
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-pill);
		transition: all 200ms var(--ease);
		user-select: none;
		min-height: 40px;
	}

	.refund-label:has(input:checked) {
		background: rgba(93, 173, 226, 0.08);
		border-color: var(--color-sky);
		box-shadow: var(--glow-sky);
	}

	.refund-label input {
		display: none;
	}

	.refund-check {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border: 2px solid var(--color-hairline);
		border-radius: var(--radius-sm);
		transition: all 200ms var(--bounce);
		flex-shrink: 0;
		color: transparent;
	}

	.refund-label:has(input:checked) .refund-check {
		background: var(--color-sky);
		border-color: var(--color-sky);
		color: white;
	}

	.refund-text {
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.refund-label:has(input:checked) .refund-text {
		color: var(--color-sky);
	}

	.refund-chip {
		margin-left: auto;
		padding: 2px 10px;
		background: rgba(93, 173, 226, 0.15);
		color: var(--color-sky);
		border-radius: var(--radius-pill);
		font-family: var(--font-display);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.03em;
	}

	/* ── Type toggle ── */
	.type-toggle {
		display: flex;
		border-radius: var(--radius-pill);
		background: var(--color-bg);
		padding: 3px;
		gap: 2px;
	}

	.type-option {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-xs);
		padding: 8px var(--space-md);
		border-radius: var(--radius-pill);
		cursor: pointer;
		font-family: var(--font-display);
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-text-muted);
		transition: all 300ms var(--bounce);
		min-height: 44px;
		border: none;
		background: transparent;
		user-select: none;
		-webkit-tap-highlight-color: transparent;
	}

	.type-option input {
		display: none;
	}

	.type-option:first-child.active {
		background: var(--color-coral);
		color: white;
		box-shadow: var(--glow-coral);
	}

	.type-option:nth-child(2).active {
		background: var(--color-teal);
		color: white;
		box-shadow: var(--glow-card);
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
		border-color: var(--color-sky);
		box-shadow: 0 0 0 4px rgba(93, 173, 226, 0.12);
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
		gap: var(--space-sm);
	}

	.cat-chip {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: 10px 14px;
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-lg);
		background: var(--color-cream);
		cursor: pointer;
		font-family: var(--font-body);
		transition: all 200ms var(--bounce);
		min-height: 48px;
		-webkit-tap-highlight-color: transparent;
		text-align: left;
	}

	.cat-chip:hover {
		border-color: var(--color-teal);
		background: var(--color-teal-bg);
	}

	.cat-chip:active {
		transform: scale(0.97);
	}

	.cat-chip.active {
		background: var(--color-teal-bg);
		border-color: var(--color-teal);
		box-shadow: var(--glow-card);
		transform: scale(1.05);
	}

	.cat-chip-icon {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-md);
		font-size: 18px;
		background: var(--color-teal-bg);
		flex-shrink: 0;
	}

	.cat-chip.active .cat-chip-icon {
		background: var(--color-teal);
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
		display: flex;
		gap: var(--space-sm);
		margin-top: var(--space-xl);
	}

	.btn {
		padding: 12px var(--space-xl);
		border-radius: var(--radius-pill);
		font-family: var(--font-display);
		font-size: var(--font-size-base);
		font-weight: 700;
		cursor: pointer;
		border: none;
		transition: all 200ms var(--bounce);
		min-height: 48px;
		flex: 1;
		-webkit-tap-highlight-color: transparent;
	}

	.btn-submit {
		background: linear-gradient(135deg, var(--color-gold), var(--color-gold-light));
		color: #14302E;
		box-shadow: var(--glow-gold);
	}

	.btn-submit:hover {
		transform: translateY(-1px);
		box-shadow: 0 6px 24px rgba(255, 210, 63, 0.55);
	}

	.btn-submit:active {
		transform: translateY(0) scale(0.98);
	}

	.btn-cancel {
		background: var(--color-bg);
		color: var(--color-text-muted);
		border: 1px solid var(--color-hairline);
		font-weight: 600;
	}

	.btn-cancel:hover {
		background: var(--color-cream);
		border-color: var(--color-border);
		color: var(--color-text);
	}

	@media (max-width: 480px) {
		.form-actions {
			flex-direction: column;
		}

		.btn {
			width: 100%;
		}

		.category-chips {
			grid-template-columns: 1fr;
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

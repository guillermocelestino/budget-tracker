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

	$effect(() => {
		if (transaction) {
			type = transaction.type;
			rawAmount = String(transaction.amount);
			description = transaction.description;
			date = transaction.date;
			category_id = transaction.category_id;
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


	function handleEnhance() {
		return async ({ result, update }: { result: { type: string }; update: () => Promise<void> }) => {
			if (result.type === 'redirect') {
				showSuccess(transaction ? 'Transaction updated successfully' : 'Transaction added successfully');
			}
			await update();
		};
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

		<div class="form-group">
			<label class="form-label" for="amount">Amount</label>
			<div class="amount-wrap">
				<span class="amount-prefix">₱</span>
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
			<label class="form-label" for="category_id">Category</label>
			<select id="category_id" name="category_id" required bind:value={category_id} class:input-error={errors.category_id}>
				<option value="">Select a category</option>
				{#each filteredCategories as cat (cat.id)}
					<option value={cat.id}>{cat.icon} {cat.name}</option>
				{/each}
			</select>
			{#if filteredCategories.length === 0}
				<span class="form-error">No {type} categories found. Create one in Categories first.</span>
			{:else if errors.category_id}
				<span class="form-error">{errors.category_id}</span>
			{/if}
		</div>
	</div>

	<div class="form-actions">
		<button type="submit" class="btn btn-primary">
			{transaction ? 'Update Transaction' : 'Add Transaction'}
		</button>
		<button type="button" class="btn btn-secondary" onclick={() => goto('/transactions')}>
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
		gap: 4px;
	}

	.form-grid {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.form-label {
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-text);
		margin-bottom: var(--space-xs);
	}

	input[type="text"],
	input[type="number"],
	input[type="date"],
	select,
	textarea {
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		font-size: var(--font-size-base);
		font-family: inherit;
		background: var(--color-surface);
		color: var(--color-text);
		transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
		width: 100%;
		-webkit-appearance: none;
		appearance: none;
	}

	input,
	select,
	textarea {
		min-height: 44px;
	}

	textarea {
		resize: vertical;
		min-height: 80px;
		line-height: 1.5;
	}

	input:focus,
	select:focus,
	textarea:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 3px var(--color-primary-light);
	}

	.input-error {
		border-color: var(--color-expense) !important;
	}

	.form-error {
		font-size: var(--font-size-sm);
		color: var(--color-expense);
	}

	.amount-wrap {
		display: flex;
		align-items: stretch;
		position: relative;
	}

	.amount-prefix {
		display: flex;
		align-items: center;
		padding: 0 12px;
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-right: none;
		border-radius: var(--radius-sm) 0 0 var(--radius-sm);
		font-weight: 600;
		font-size: var(--font-size-base);
		color: var(--color-text-secondary);
	}

	.amount-wrap input {
		border-top-left-radius: 0;
		border-bottom-left-radius: 0;
	}

	.type-toggle {
		display: flex;
		gap: var(--space-sm);
	}

	.type-option {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-xs);
		padding: var(--space-sm) var(--space-md);
		border: 2px solid var(--color-border);
		border-radius: var(--radius-md);
		cursor: pointer;
		font-size: var(--font-size-base);
		font-weight: 500;
		transition: all var(--transition-fast);
		min-height: 48px;
	}

	.type-option input {
		display: none;
	}

	.type-option.active {
		border-color: var(--color-primary);
		background: var(--color-primary-light);
		color: var(--color-primary);
	}

	.form-actions {
		display: flex;
		gap: var(--space-sm);
		margin-top: var(--space-lg);
	}

	.btn {
		padding: 12px var(--space-lg);
		border-radius: var(--radius-md);
		font-size: var(--font-size-base);
		font-weight: 600;
		cursor: pointer;
		border: none;
		transition: all var(--transition-fast);
		min-height: 44px;
		flex: 1;
	}

	.btn-primary {
		background: var(--color-primary);
		color: white;
	}

	.btn-primary:hover {
		background: var(--color-primary-hover);
	}

	.btn-secondary {
		background: var(--color-bg);
		color: var(--color-text);
		border: 1px solid var(--color-border);
	}

	.btn-secondary:hover {
		background: var(--color-border);
	}

	.date-input-row {
		display: flex;
		gap: var(--space-sm);
		align-items: center;
	}

	.date-input-row input {
		flex: 1;
	}

	.btn-today {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: var(--space-xs) var(--space-md);
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		cursor: pointer;
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-primary);
		min-height: 44px;
		white-space: nowrap;
		transition: all var(--transition-fast);
	}

	.btn-today:hover {
		background: var(--color-primary-light);
		border-color: var(--color-primary);
	}

	@media (max-width: 480px) {
		.form-actions {
			flex-direction: column;
		}

		.btn {
			width: 100%;
		}
	}
</style>

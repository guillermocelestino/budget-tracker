<script lang="ts">
	import { enhance } from '$app/forms';
	import { showSuccess, showError } from '$lib/stores/toast.svelte';
	import type { Category } from '$lib/types';

	let {
		category,
		onCancel,
		action,
		onSuccess,
	}: {
		category?: Category;
		onCancel?: () => void;
		action?: string;
		onSuccess?: () => void;
	} = $props();

	let name = $state('');
	let color = $state('#6366f1');
	let icon = $state('📁');
	let rawBudgetLimit = $state('');

	$effect(() => {
		if (category) {
			name = category.name;
			color = category.color;
			icon = category.icon;
			rawBudgetLimit = category.budget_limit != null ? String(category.budget_limit) : '';
		}
	});

	function formatWithCommas(value: string): string {
		const parts = value.split('.');
		parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
		return parts.join('.');
	}

	function onBudgetInput(e: Event) {
		const input = e.target as HTMLInputElement;
		let raw = input.value.replace(/[^0-9.]/g, '');
		const dots = raw.match(/\./g);
		if (dots && dots.length > 1) raw = raw.slice(0, raw.lastIndexOf('.'));
		rawBudgetLimit = raw;
		input.value = raw ? formatWithCommas(raw) : '';
	}

	function onBudgetFocus(e: Event) {
		const input = e.target as HTMLInputElement;
		input.value = rawBudgetLimit;
		const len = input.value.length;
		input.setSelectionRange(len, len);
	}

	function onBudgetBlur(e: Event) {
		const input = e.target as HTMLInputElement;
		if (rawBudgetLimit) {
			const num = parseFloat(rawBudgetLimit);
			if (!isNaN(num)) {
				input.value = formatWithCommas(
					num % 1 === 0 ? String(num) : num.toFixed(2)
				);
			}
		}
	}

	const displayBudget = $derived(rawBudgetLimit ? formatWithCommas(rawBudgetLimit) : '');

	function handleEnhance() {
		return async ({ result, update }: { result: { type: string; data?: { error?: string } }; update: () => Promise<void> }) => {
			if (result.type === 'success') {
				showSuccess(category ? 'Category updated successfully' : 'Category created successfully');
				onSuccess?.();
			} else if (result.type === 'failure') {
				showError(result.data?.error || 'An error occurred');
			}
			await update();
		};
	}

	const presetColors = [
		'#ef4444', '#f97316', '#f59e0b', '#10b981',
		'#14b8a6', '#3b82f6', '#6366f1', '#8b5cf6',
		'#ec4899', '#6b7280',
	];
</script>

<form method="POST" {action} use:enhance={handleEnhance}>
	{#if category}
		<input type="hidden" name="id" value={category.id} />
	{/if}

	<div class="form-group">
		<label class="form-label" for="cat-name">Name</label>
		<input id="cat-name" name="name" type="text" required bind:value={name} placeholder="Category name" />
	</div>

	<div class="form-group">
		<label class="form-label" for="cat-color">Color</label>
		<div class="color-picker">
			<input type="color" id="cat-color" name="color" bind:value={color} class="color-input" />
			<div class="color-swatches">
				{#each presetColors as c}
					<button
						type="button"
						class="swatch"
						class:selected={color === c}
						style="background: {c}"
						onclick={() => color = c}
						aria-label="Color {c}"
					></button>
				{/each}
			</div>
		</div>
	</div>

	<div class="form-group">
		<label class="form-label" for="cat-icon">Icon (emoji)</label>
		<input id="cat-icon" name="icon" type="text" bind:value={icon} maxlength="2" class="icon-input" />
	</div>

	<div class="form-group">
		<label class="form-label" for="cat-budget">Budget Limit (optional)</label>
		<div class="amount-wrap">
			<span class="amount-prefix">₱</span>
			<input
				id="cat-budget"
				type="text"
				inputmode="decimal"
				placeholder="No limit"
				value={displayBudget}
				oninput={onBudgetInput}
				onfocus={onBudgetFocus}
				onblur={onBudgetBlur}
				autocomplete="off"
			/>
		</div>
		<input type="hidden" name="budget_limit" value={rawBudgetLimit} />
	</div>

	<div class="form-actions">
		<button type="submit" class="btn btn-primary">
			{category ? 'Update Category' : 'Add Category'}
		</button>
		{#if onCancel}
			<button type="button" class="btn btn-secondary" onclick={onCancel}>Cancel</button>
		{/if}
	</div>
</form>

<style>
	.form-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-bottom: var(--space-md);
	}

	.form-label {
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-text);
	}

	input[type="text"],
	input[type="number"],
	input[type="color"] {
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		font-size: var(--font-size-base);
		font-family: inherit;
		background: var(--color-surface);
		color: var(--color-text);
		transition: border-color var(--transition-fast);
		width: 100%;
	}

	input:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 3px var(--color-primary-light);
	}

	.icon-input {
		width: 60px;
		text-align: center;
		font-size: 1.5rem;
	}

	.color-picker {
		display: flex;
		align-items: center;
		gap: var(--space-md);
	}

	.color-input {
		width: 48px;
		height: 48px;
		padding: 2px;
		border-radius: var(--radius-md);
		cursor: pointer;
	}

	.color-swatches {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}

	.swatch {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: 2px solid transparent;
		cursor: pointer;
		padding: 0;
		transition: transform var(--transition-fast);
	}

	.swatch:hover {
		transform: scale(1.15);
	}

	.swatch.selected {
		border-color: var(--color-text);
		transform: scale(1.1);
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

	.form-actions {
		display: flex;
		gap: var(--space-sm);
		margin-top: var(--space-lg);
	}

	.btn {
		padding: var(--space-sm) var(--space-lg);
		border-radius: var(--radius-md);
		font-size: var(--font-size-base);
		font-weight: 600;
		cursor: pointer;
		border: none;
		transition: all var(--transition-fast);
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
</style>

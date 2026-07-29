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
	let categoryType = $state<'income' | 'expense'>('expense');
	let rawBudgetLimit = $state('');

	$effect(() => {
		if (category) {
			name = category.name;
			color = category.color;
			icon = category.icon;
			categoryType = category.type || 'expense';
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

	const flip7Colors = [
		'#2BA8A2', '#FFD23F', '#EF6C4A', '#5DADE2',
		'#27AE60', '#E74C3C', '#14302E', '#FFE47A',
		'#3CC4BD', '#FF8A6A',
	];

	const iconOptions = ['📁', '💰', '🍔', '🚗', '🏠', '⚡', '🛒', '💊', '🎓', '✈️', '👕', '🎮', '📱', '🎵', '🐾', '🎁'];
</script>

<form method="POST" {action} use:enhance={handleEnhance}>
	{#if category}
		<input type="hidden" name="id" value={category.id} />
	{/if}

	<!-- Live Preview Chip -->
	<div class="preview-chip" style="background: {color}12; border-color: {color}40">
		<span class="preview-icon" style="color: {color}">{icon || '📁'}</span>
		<span class="preview-name" style="color: {color}">{name || 'Category Name'}</span>
		<span class="preview-type">{categoryType === 'expense' ? 'Expense' : 'Income'}</span>
	</div>

	<div class="form-group">
		<label class="form-label">Type</label>
		<div class="type-toggle">
			<label class="type-option expense-side" class:active={categoryType === 'expense'}>
				<input type="radio" name="type" value="expense" bind:group={categoryType} />
				Expense
			</label>
			<label class="type-option income-side" class:active={categoryType === 'income'}>
				<input type="radio" name="type" value="income" bind:group={categoryType} />
				Income
			</label>
		</div>
	</div>

	<div class="form-group">
		<label class="form-label" for="cat-name">Name</label>
		<input id="cat-name" name="name" type="text" required bind:value={name} placeholder="Category name" />
	</div>

	<div class="form-group">
		<label class="form-label" for="cat-icon">Icon</label>
		<div class="icon-grid">
			{#each iconOptions as opt}
				<button
					type="button"
					class="icon-opt"
					class:selected={icon === opt}
					style={icon === opt ? `background: ${color}18; border-color: ${color}60; color: ${color}` : ''}
					onclick={() => icon = opt}
					aria-label="Icon {opt}"
				>{opt}</button>
			{/each}
		</div>
		<input type="hidden" name="icon" value={icon} />
	</div>

	<div class="form-group">
		<label class="form-label">Color</label>
		<div class="color-picker">
			<div class="color-swatches">
				{#each flip7Colors as c}
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
			<div class="custom-color-wrap">
				<label class="custom-label" for="cat-color">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="4.93" x2="9.17" y1="4.93" y2="9.17"/><line x1="14.83" x2="19.07" y1="14.83" y2="19.07"/><line x1="14.83" x2="19.07" y1="9.17" y2="4.93"/><line x1="4.93" x2="9.17" y1="19.07" y2="14.83"/></svg>
				</label>
				<input type="color" id="cat-color" name="color" bind:value={color} class="color-input" />
			</div>
		</div>
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
		color: var(--color-ink);
	}

	/* ─── Live Preview Chip ─── */
	.preview-chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		border: 1px solid;
		border-radius: var(--radius-pill);
		margin-bottom: var(--space-md);
		width: fit-content;
	}

	.preview-icon {
		font-size: 1.25rem;
	}

	.preview-name {
		font-weight: 600;
		font-size: var(--font-size-sm);
	}

	.preview-type {
		font-size: 11px;
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 2px 8px;
		background: var(--color-hairline);
		border-radius: var(--radius-pill);
	}

	/* ─── Type Toggle (Pill SegmentedControl) ─── */
	.type-toggle {
		display: flex;
		border-radius: var(--radius-pill);
		overflow: hidden;
		border: 1px solid var(--color-border);
		background: var(--color-cream);
	}

	.type-option {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-sm) var(--space-md);
		cursor: pointer;
		font-size: var(--font-size-base);
		font-weight: 600;
		transition: all var(--transition-fast);
		min-height: 48px;
		color: var(--color-text-muted);
	}

	.type-option input { display: none; }

	.type-option.expense-side.active {
		background: rgba(239, 108, 74, 0.12);
		color: var(--color-coral);
	}

	.type-option.income-side.active {
		background: var(--color-teal-bg);
		color: var(--color-teal);
	}

	/* ─── Inputs ─── */
	input[type="text"],
	input[type="number"],
	input[type="color"] {
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		font-size: var(--font-size-base);
		font-family: inherit;
		background: var(--color-cream);
		color: var(--color-ink);
		transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
		width: 100%;
	}

	input:focus {
		outline: none;
		border-color: var(--color-teal);
		box-shadow: var(--focus);
	}

	/* ─── Icon Grid ─── */
	.icon-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.icon-opt {
		width: 44px;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.25rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-cream);
		cursor: pointer;
		transition: all 200ms var(--bounce);
	}

	.icon-opt:hover {
		transform: scale(1.08);
		border-color: var(--color-teal);
	}

	.icon-opt.selected {
		transform: scale(1.1);
		border-width: 2px;
		box-shadow: var(--glow-card);
	}

	/* ─── Color Picker ─── */
	.color-picker {
		display: flex;
		align-items: center;
		gap: var(--space-md);
	}

	.color-swatches {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.swatch {
		width: 32px;
		height: 32px;
		border-radius: var(--radius-full);
		border: 2px solid transparent;
		cursor: pointer;
		padding: 0;
		transition: all 200ms var(--bounce);
	}

	.swatch:hover {
		transform: scale(1.2);
	}

	.swatch.selected {
		border-color: var(--color-ink);
		transform: scale(1.15);
		box-shadow: var(--glow-card);
	}

	.custom-color-wrap {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.custom-label {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: var(--radius-full);
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		cursor: pointer;
		color: var(--color-text-muted);
	}

	.color-input {
		width: 0;
		height: 0;
		opacity: 0;
		position: absolute;
		pointer-events: none;
	}

	/* ─── Amount wrap ─── */
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
		border-radius: var(--radius-lg) 0 0 var(--radius-lg);
		font-weight: 600;
		font-size: var(--font-size-base);
		color: var(--color-text-muted);
	}

	.amount-wrap input {
		border-top-left-radius: 0;
		border-bottom-left-radius: 0;
	}

	/* ─── Form Actions ─── */
	.form-actions {
		display: flex;
		gap: var(--space-sm);
		margin-top: var(--space-lg);
	}

	.btn {
		padding: var(--space-sm) var(--space-lg);
		border-radius: var(--radius-pill);
		font-size: var(--font-size-base);
		font-weight: 600;
		cursor: pointer;
		border: none;
		font-family: var(--font-body);
		transition: all var(--transition-fast);
		min-height: 44px;
	}

	.btn-primary {
		background: linear-gradient(135deg, var(--color-teal), var(--color-teal-light));
		color: white;
	}

	.btn-primary:hover {
		background: linear-gradient(135deg, var(--color-teal-dark), var(--color-teal));
		transform: scale(1.02);
	}

	.btn-secondary {
		background: var(--color-bg);
		color: var(--color-ink);
		border: 1px solid var(--color-border);
	}

	.btn-secondary:hover {
		background: var(--color-teal-bg);
		border-color: var(--color-teal);
	}
</style>

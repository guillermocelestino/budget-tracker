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
</script>

<form method="POST" {action} use:enhance={handleEnhance}>
	{#if category}
		<input type="hidden" name="id" value={category.id} />
	{/if}

	<!-- Live Preview Chip -->
	<div class="preview-chip" style="background: {color}12; border-color: {color}40">
		<span class="preview-icon">{icon}</span>
		<span class="preview-name">{name || 'Category Name'}</span>
		<span class="preview-type">{categoryType === 'income' ? 'Income' : 'Expense'}</span>
	</div>

	<!-- Type Toggle -->
	<div class="form-group">
		<label class="form-label">Type</label>
		<div class="type-toggle">
			<label class="type-option" class:active={categoryType === 'expense'}>
				<input type="radio" name="type" value="expense" bind:group={categoryType} /> 💸 Expense
			</label>
			<label class="type-option" class:active={categoryType === 'income'}>
				<input type="radio" name="type" value="income" bind:group={categoryType} /> 💰 Income
			</label>
		</div>
	</div>

	<!-- Name -->
	<div class="form-group">
		<label class="form-label" for="cat-name">Name</label>
		<input id="cat-name" name="name" type="text" required bind:value={name} placeholder="Category name" class="cream-input" />
	</div>

	<!-- Icon Grid -->
	<div class="form-group">
		<label class="form-label">Icon</label>
		<div class="icon-grid">
			{#each ['🍽️', '🚗', '🛍️', '🎬', '📄', '🏥', '📚', '📦', '💰', '💻', '💵', '🏠', '✈️', '🎮', '👕', '🐾'] as opt}
				<button
					type="button"
					class="icon-opt"
					class:selected={icon === opt}
					style={icon === opt ? `background: ${color}18; border-color: ${color}60; color: ${color}` : ''}
					onclick={() => icon = opt}
				>{opt}</button>
			{/each}
		</div>
		<input type="hidden" name="icon" value={icon} />
	</div>

	<!-- Color -->
	<div class="form-group">
		<label class="form-label">Color</label>
		<div class="color-picker">
			<div class="color-swatches">
				{#each ['#ef4444','#f97316','#f59e0b','#10b981','#14b8a6','#3b82f6','#6366f1','#8b5cf6','#ec4899','#6b7280'] as c}
					<button
						type="button"
						class="swatch"
						class:selected={color === c}
						style="background: {c}"
						onclick={() => color = c}
						aria-label={c}
					></button>
				{/each}
			</div>
			<div class="custom-color-wrap">
				<label class="custom-label" for="cat-color" style="background: {color}">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3h.01"/><path d="M12 21h.01"/><path d="M3 12h.01"/><path d="M21 12h.01"/><path d="m3 21 6-6"/><path d="m21 3-6 6"/></svg>
				</label>
				<input type="color" id="cat-color" name="color" bind:value={color} class="color-input" />
			</div>
		</div>
	</div>

	<!-- Budget Limit (styled like TransactionForm amount input) -->
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
		<button type="submit" class="btn btn-submit">
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
		font-family: var(--font-display);
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-text);
		letter-spacing: 0.02em;
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

	.preview-icon { font-size: 1.25rem; }
	.preview-name { font-weight: 600; font-size: var(--font-size-sm); }
	.preview-type { font-size: 11px; font-weight: 600; opacity: 0.6; }

	/* ─── Cream inputs (matches TransactionForm) ─── */
	.cream-input,
	input[type="text"],
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
		min-height: 44px;
	}

	input:focus,
	textarea:focus {
		outline: none;
		border-color: var(--color-teal);
		box-shadow: var(--focus);
	}

	/* ─── Type toggle ─── */
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

	.type-option input { display: none; }

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

	/* ─── Icon Grid ─── */
	.icon-grid {
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		gap: var(--space-sm);
	}

	.icon-opt {
		width: 100%;
		aspect-ratio: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-md);
		background: var(--color-cream);
		cursor: pointer;
		font-size: 1.25rem;
		transition: all 200ms var(--bounce);
	}

	.icon-opt:hover {
		border-color: var(--color-teal);
		background: var(--color-teal-bg);
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

	.swatch:hover { transform: scale(1.2); }

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
		cursor: pointer;
		color: rgba(255,255,255,0.7);
	}

	.color-input {
		width: 0;
		height: 0;
		opacity: 0;
		position: absolute;
		pointer-events: none;
	}

	/* ─── Amount wrap (matches TransactionForm) ─── */
	.amount-wrap {
		display: flex;
		align-items: stretch;
		flex: 1;
		background: var(--color-cream);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-md);
		overflow: hidden;
		transition: border-color 200ms var(--ease), box-shadow 200ms var(--ease);
	}

	.amount-wrap:focus-within {
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
	}

	.amount-wrap input {
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

	.amount-wrap input:focus {
		box-shadow: none !important;
	}

	.amount-wrap input::placeholder {
		color: var(--color-text-muted);
		opacity: 0.5;
	}

	/* ─── Form Actions ─── */
	.form-actions {
		display: flex;
		gap: var(--space-sm);
		margin-top: var(--space-lg);
	}

	.btn {
		flex: 1;
		padding: 12px var(--space-xl);
		border-radius: var(--radius-pill);
		font-family: var(--font-display);
		font-size: var(--font-size-base);
		font-weight: 700;
		cursor: pointer;
		border: none;
		min-height: 48px;
		transition: all 200ms var(--bounce);
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

	.btn-secondary {
		background: var(--color-bg);
		color: var(--color-text-muted);
		border: 1px solid var(--color-hairline);
		font-weight: 600;
	}

	.btn-secondary:hover {
		background: var(--color-cream);
		border-color: var(--color-border);
		color: var(--color-text);
	}

	@media (max-width: 640px) {
		.icon-grid {
			grid-template-columns: repeat(4, 1fr);
		}
	}
</style>

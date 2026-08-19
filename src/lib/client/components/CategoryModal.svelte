<script lang="ts">
	import { enhance } from '$app/forms';
	import { tick, untrack } from 'svelte';
	import { showSuccess, showError } from '$lib/client/stores/toast.svelte';
	import type { Category } from '$lib/types';

	let {
		open = false,
		category,
		action = '?/create',
		defaultType,
		onClose,
		onSuccess
	}: {
		open?: boolean;
		category?: Category;
		action?: string;
		/** Type preselected when creating (per-column "+ Add" CTAs). */
		defaultType?: 'income' | 'expense';
		onClose?: () => void;
		onSuccess?: () => void;
	} = $props();

	const ICONS = ['🍔', '🛍️', '🚗', '💡', '🎬', '🏠', '💳', '📱', '🐾', '💊', '🍽️', '✈️', '🎮', '👕', '📦', '💻'];

	let name = $state('');
	let icon = $state('🍔');
	let color = $state('#3f8f79');
	let categoryType = $state<'income' | 'expense'>('expense');
	let rawBudgetLimit = $state('');
	let submitting = $state(false);
	let modalRef = $state<HTMLElement | null>(null);

	$effect(() => {
		if (category) {
			name = category.name;
			color = category.color || '#3f8f79';
			icon = category.icon || '🍔';
			categoryType = category.type || 'expense';
			rawBudgetLimit = category.budget_limit != null ? String(category.budget_limit) : '';
		} else if (open) {
			untrack(() => {
				name = '';
				icon = '🍔';
				color = '#3f8f79';
				categoryType = defaultType ?? 'expense';
				rawBudgetLimit = '';
			});
		}
	});

	function formatCurrencyInput(value: string): string {
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
		input.value = raw ? formatCurrencyInput(raw) : '';
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
				input.value = formatCurrencyInput(
					num % 1 === 0 ? String(num) : num.toFixed(2)
				);
			}
		}
	}

	const displayBudget = $derived(rawBudgetLimit ? formatCurrencyInput(rawBudgetLimit) : '');

	const headerTitle = $derived(
		categoryType === 'income' ? 'Categories organize Money In' : 'Categories organize Money Gone'
	);
	const headerSubtitle = $derived(
		categoryType === 'income'
			? 'Organize the income that brings money into your pocket.'
			: 'Organize the expenses that take money out of your pocket.'
	);

	let dragY = $state(0);
	let isDragging = $state(false);
	let startY = 0;
	let lastY = 0;
	let lastTime = 0;
	let velocityY = 0;

	function close() {
		dragY = 0;
		isDragging = false;
		if (!submitting) onClose?.();
	}

	function handleBackdrop(e: MouseEvent) {
		if (e.target === e.currentTarget) close();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}

	function onPointerDown(e: PointerEvent) {
		if (window.innerWidth > 640) return;
		const target = e.target as HTMLElement;
		if (target.closest('button, input, select, textarea, a')) return;

		isDragging = true;
		startY = e.clientY;
		lastY = e.clientY;
		lastTime = performance.now();
		velocityY = 0;

		if (modalRef) {
			modalRef.setPointerCapture(e.pointerId);
		}
	}

	function onPointerMove(e: PointerEvent) {
		if (!isDragging) return;
		const now = performance.now();
		const dt = now - lastTime;
		const dy = e.clientY - startY;

		if (dy > 0) {
			dragY = dy;
			if (dt > 0) {
				velocityY = (e.clientY - lastY) / dt;
			}
		} else {
			dragY = dy * 0.2;
		}

		lastY = e.clientY;
		lastTime = now;
	}

	function onPointerUp(e: PointerEvent) {
		if (!isDragging) return;
		isDragging = false;

		if (modalRef && modalRef.hasPointerCapture(e.pointerId)) {
			modalRef.releasePointerCapture(e.pointerId);
		}

		if (dragY > 100 || velocityY > 0.4) {
			close();
		} else {
			dragY = 0;
		}
	}

	function handleEnhance() {
		if (submitting) return;
		submitting = true;
		return async ({ result, update }: { result: { type: string; data?: { error?: string } }; update: () => Promise<void> }) => {
			submitting = false;
			if (result.type === 'success' || result.type === 'redirect') {
				showSuccess(category ? 'Category updated successfully' : 'Category created successfully');
				onSuccess?.();
				close();
			} else if (result.type === 'failure') {
				showError(result.data?.error || 'Could not save category.');
			}
			await update();
		};
	}

	$effect(() => {
		if (open) {
			dragY = 0;
			isDragging = false;
			tick().then(() => {
				const nameEl = modalRef?.querySelector<HTMLElement>('input[name="name"]');
				nameEl?.focus();
			});
		}
	});
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="modal-backdrop" onclick={handleBackdrop} role="dialog" aria-modal="true" aria-label="Category Management">
		<div
			class="modal-card"
			class:dragging={isDragging}
			bind:this={modalRef}
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerUp}
			style={dragY > 0 ? `transform: translateY(${dragY}px)` : dragY < 0 ? `transform: translateY(${dragY}px)` : ''}
		>
			<!-- Mobile sheet drag handle -->
			<div class="sheet-grab-bar" aria-hidden="true">
				<div class="sheet-grab-handle"></div>
			</div>

			<!-- Header -->
			<div class="modal-header">
				<div class="header-badge">CATEGORIES</div>
				<h2 class="header-title">{headerTitle}</h2>
				<p class="header-subtitle">{headerSubtitle}</p>
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
					{#if category}
						<input type="hidden" name="id" value={category.id} />
					{/if}
					<input type="hidden" name="color" value={color} />
					<input type="hidden" name="icon" value={icon} />
					<input type="hidden" name="type" value={categoryType} />
					<input type="hidden" name="budget_limit" value={rawBudgetLimit} />

					<div class="card-label">{category ? 'EDIT CATEGORY' : 'NEW CATEGORY'}</div>

					<!-- Icon Picker Circle Row -->
					<div class="icon-picker-wrap">
						<div class="icon-picker-row">
							{#each ICONS as item (item)}
								<button
									type="button"
									class="icon-circle"
									class:selected={icon === item}
									onclick={() => (icon = item)}
									aria-label={item}
								>
									<span>{item}</span>
								</button>
							{/each}
						</div>
					</div>

					<!-- Field 1: Category Name -->
					<div class="field-group">
						<input
							id="cat_name_input"
							name="name"
							type="text"
							required
							placeholder="Category name"
							bind:value={name}
							class="pill-input text-input"
						/>
					</div>

					<!-- Type Toggle: Expense vs Income -->
					<div class="type-toggle-bar">
						<button
							type="button"
							class="toggle-btn expense-btn"
							class:active={categoryType === 'expense'}
							onclick={() => (categoryType = 'expense')}
						>
							Expense
						</button>
						<button
							type="button"
							class="toggle-btn income-btn"
							class:active={categoryType === 'income'}
							onclick={() => (categoryType = 'income')}
						>
							Income
						</button>
					</div>

					<!-- Field 2: Monthly budget (optional) - Visible in Expense mode -->
					{#if categoryType === 'expense'}
						<div class="field-group">
							<input
								id="cat_budget_input"
								type="text"
								inputmode="decimal"
								placeholder="Monthly budget (optional)"
								value={displayBudget}
								oninput={onBudgetInput}
								onfocus={onBudgetFocus}
								onblur={onBudgetBlur}
								autocomplete="off"
								class="pill-input text-input"
							/>
						</div>
					{/if}

					<!-- Submit CTA Button -->
					<button
						type="submit"
						class="cta-button"
						disabled={submitting || !name.trim()}
					>
						{#if submitting}
							<span>Saving...</span>
						{:else}
							<span>{category ? 'Update Category' : 'Add Category'}</span>
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
		background: rgba(10, 20, 18, 0.45);
		backdrop-filter: blur(20px) saturate(180%);
		-webkit-backdrop-filter: blur(20px) saturate(180%);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: var(--space-md);
	}

	[data-theme="dark"] .modal-backdrop {
		background: rgba(0, 0, 0, 0.65);
	}

	.sheet-grab-bar {
		display: none;
		justify-content: center;
		padding: 10px 0 2px;
		cursor: grab;
	}

	.sheet-grab-handle {
		width: 36px;
		height: 5px;
		border-radius: 999px;
		background: var(--color-hairline, rgba(20, 48, 46, 0.2));
	}

	[data-theme="dark"] .sheet-grab-handle {
		background: rgba(255, 255, 255, 0.25);
	}

	/* ─── Modal Shell ─── */
	.modal-card {
		background: var(--color-bg, #EFF8F7);
		border-radius: 28px;
		max-width: 480px;
		width: 100%;
		position: relative;
		box-shadow: 0 20px 48px rgba(14, 42, 39, 0.18), 0 0 0 1px rgba(43, 168, 162, 0.2);
		animation: modalPop 320ms cubic-bezier(0.16, 1, 0.3, 1);
		transition: transform 250ms cubic-bezier(0.16, 1, 0.3, 1);
		touch-action: none;
		overflow: hidden;
		padding: 28px 24px;
		max-height: calc(100dvh - 40px);
		display: flex;
		flex-direction: column;
	}

	.modal-card.dragging {
		transition: none !important;
	}

	[data-theme="dark"] .modal-card {
		background: #101715;
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(60, 196, 189, 0.25);
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
		font-size: clamp(1.875rem, 5vw, 2.35rem);
		font-weight: 800;
		color: var(--color-ink, #0E2A27);
		margin: 0 0 4px 0;
		line-height: 1.15;
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

	.card-label {
		font-family: var(--font-body);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-text-muted, #5C7A78);
		margin-bottom: 14px;
	}

	/* ─── Icon Picker Circle Row ─── */
	.icon-picker-wrap {
		overflow-x: auto;
		margin-bottom: 16px;
		padding: 8px 8px 12px;
		-webkit-overflow-scrolling: touch;
	}

	.icon-picker-row {
		display: flex;
		gap: 8px;
		min-width: max-content;
	}

	.icon-circle {
		width: 42px;
		height: 42px;
		border-radius: 50%;
		border: 1px solid rgba(20, 48, 46, 0.1);
		background: rgba(20, 48, 46, 0.04);
		font-size: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 180ms ease;
	}

	[data-theme="dark"] .icon-circle {
		background: rgba(255, 255, 255, 0.05);
		border-color: rgba(255, 255, 255, 0.1);
	}

	.icon-circle:hover {
		transform: scale(1.08);
	}

	.icon-circle.selected {
		border-color: var(--color-teal, #2BA8A2);
		background: rgba(43, 168, 162, 0.15);
		box-shadow: 0 0 0 3px rgba(43, 168, 162, 0.3);
		transform: scale(1.1);
	}

	/* ─── Fields & Inputs ─── */
	.field-group {
		display: flex;
		flex-direction: column;
		margin-bottom: 16px;
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

	.pill-input:focus {
		border-color: var(--color-gold, #FFD23F);
		box-shadow: 0 0 0 3.5px rgba(255, 210, 63, 0.3);
	}

	.text-input::placeholder {
		color: var(--color-text-muted);
		opacity: 0.6;
	}

	/* ─── Type Toggle Bar (Expense vs Income) ─── */
	.type-toggle-bar {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		margin-bottom: 16px;
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

	@media (max-width: 640px) {
		.modal-backdrop {
			padding: 0;
			align-items: flex-end;
		}

		.sheet-grab-bar {
			display: flex;
		}

		.modal-card {
			max-width: 100vw;
			border-radius: 28px 28px 0 0;
			border-bottom: none;
			border-left: none;
			border-right: none;
			max-height: 90dvh;
			padding: 16px;
			animation: sheet-spring-up 380ms cubic-bezier(0.16, 1, 0.3, 1);
		}

		.form-container {
			padding: 16px;
		}

		@keyframes sheet-spring-up {
			from { transform: translateY(100%); }
			to { transform: translateY(0); }
		}
	}
</style>

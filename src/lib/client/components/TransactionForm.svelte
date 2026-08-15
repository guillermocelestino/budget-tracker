<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { tick, untrack } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import Button from '$lib/client/components/Button.svelte';
	import LiveImpactPreview from '$lib/client/components/LiveImpactPreview.svelte';
	import { themeState } from '$lib/client/stores/preferences.svelte';
	import { getCategoryHue, getCategoryTint, getCategoryText } from '$lib/shared/utils/categoryColors';
	import { formatDateInput, formatWithCommas } from '$lib/shared/utils/format';
	import { formatCurrency, handleAmountInput, handleAmountFocus, handleAmountBlur } from '$lib/client/utils/format';
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
		onSuccess?: (createdPayload?: { type: TransactionType; amount: number; categoryName: string }) => void;
	} = $props();

	// Stepper state
	let currentStep = $state<number>(transaction ? 3 : 1);
	let animDirection = $state<'forward' | 'backward'>('forward');
	let detailsOpen = $state<boolean>(!!transaction);

	// Form fields
	let type = $state<TransactionType>('expense');
	let rawAmount = $state('');
	let description = $state('');
	let date = $state(formatDateInput());
	let category_id = $state<number | string>('');
	let sourceOfFunds = $state('');
	let isRefund = $state(false);

	const isDark = $derived(themeState.isDark);

	let lastTxnId = $state<number | string | null>(null);

	$effect(() => {
		const currentTxnId = transaction ? transaction.id : 'new';
		if (currentTxnId !== lastTxnId) {
			lastTxnId = currentTxnId;
			if (transaction) {
				untrack(() => {
					type = transaction.type;
					rawAmount = String(transaction.amount);
					description = transaction.description;
					date = transaction.date;
					category_id = transaction.category_id;
					sourceOfFunds = transaction.source_of_funds ?? '';
					isRefund = (transaction.description || '').startsWith('[REFUND]');
					currentStep = 3;
					detailsOpen = true;
				});
			} else {
				untrack(() => {
					type = 'expense';
					rawAmount = '';
					description = '';
					date = formatDateInput();
					category_id = '';
					sourceOfFunds = '';
					isRefund = false;
					currentStep = 1;
					detailsOpen = false;
				});
			}
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

	const selectedCategory = $derived(
		categories.find(c => c.id === Number(category_id))
	);

	const currentCategoryTotal = $derived(
		category_id ? (spendingMap[Number(category_id)] ?? 0) : 0
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

	// Navigation actions
	function selectType(selectedType: TransactionType) {
		type = selectedType;
		if (category_id && !categories.some(c => c.id === Number(category_id) && c.type === selectedType)) {
			category_id = '';
		}
		animDirection = 'forward';
		currentStep = 2;
	}

	function selectCategory(catId: number) {
		category_id = catId;
		const cat = categories.find(c => c.id === catId);
		if (!description || description.trim() === '' || categories.some(c => c.name === description)) {
			description = cat?.name ?? '';
		}
		animDirection = 'forward';
		currentStep = 3;
	}

	function goToStep(targetStep: number) {
		if (targetStep < 1 || targetStep > 3) return;
		animDirection = targetStep > currentStep ? 'forward' : 'backward';
		currentStep = targetStep;
	}

	function goBack() {
		if (currentStep > 1) {
			goToStep(currentStep - 1);
		} else {
			handleCancelClick();
		}
	}

	function handleEnhance() {
		return async ({ result, update }: { result: { type: string }; update: () => Promise<void> }) => {
			if (result.type === 'redirect' || result.type === 'success') {
				if (transaction) {
					showSuccess('Transaction updated successfully');
				}
				onSuccess?.({
					type,
					amount: numericAmount,
					categoryName: selectedCategory?.name ?? ''
				});
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
		const baseDesc = (description || '').trim() || selectedCategory?.name || (type === 'income' ? 'Income' : 'Expense');
		if (isRefund && !baseDesc.startsWith('[REFUND]')) {
			return `[REFUND] ${baseDesc}`;
		}
		if (!isRefund && baseDesc.startsWith('[REFUND]')) {
			return baseDesc.replace('[REFUND] ', '');
		}
		return baseDesc;
	}

	// Auto-jump to step if server returns errors
	$effect(() => {
		if (errors && Object.keys(errors).length > 0) {
			if (errors.amount || errors.description || errors.date) {
				currentStep = 3;
				detailsOpen = true;
			} else if (errors.category_id) {
				currentStep = 2;
			} else if (errors.type) {
				currentStep = 1;
			}
		}
	});

	// Focus element refs
	let firstTypeBtn = $state<HTMLButtonElement | null>(null);
	let firstCategoryBtn = $state<HTMLButtonElement | null>(null);
	let amountInputEl = $state<HTMLInputElement | null>(null);

	$effect(() => {
		const step = currentStep;
		tick().then(() => {
			if (step === 1) {
				firstTypeBtn?.focus();
			} else if (step === 2) {
				firstCategoryBtn?.focus();
			} else if (step === 3) {
				amountInputEl?.focus();
			}
		});
	});

	// Reduced motion check
	const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	function transitionIn(node: HTMLElement) {
		if (prefersReducedMotion) return fade(node, { duration: 100 });
		return fly(node, {
			x: animDirection === 'forward' ? 60 : -60,
			duration: 180,
			opacity: 0
		});
	}

	function transitionOut(node: HTMLElement) {
		if (prefersReducedMotion) return fade(node, { duration: 100 });
		return fly(node, {
			x: animDirection === 'forward' ? -60 : 60,
			duration: 180,
			opacity: 0
		});
	}
</script>

<form method="POST" {action} use:enhance={handleEnhance} class="stepper-form">
	{#if transaction?.id}
		<input type="hidden" name="id" value={transaction.id} />
	{/if}
	<input type="hidden" name="type" value={type} />
	<input type="hidden" name="category_id" value={category_id} />
	<input type="hidden" name="amount" value={rawAmount} />
	<input type="hidden" name="description" value={getSubmitDescription()} />
	<input type="hidden" name="date" value={date} />
	<input type="hidden" name="source_of_funds" value={sourceOfFunds} />

	<!-- Stepper Header Navigation -->
	<header class="stepper-header">
		<div class="stepper-header-left">
			<button
				type="button"
				class="btn-step-back"
				onclick={goBack}
				aria-label={currentStep > 1 ? "Go to previous step" : "Cancel and close"}
			>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
					<line x1="19" y1="12" x2="5" y2="12"/>
					<polyline points="12 19 5 12 12 5"/>
				</svg>
				<span>{currentStep > 1 ? 'Back' : 'Cancel'}</span>
			</button>
		</div>

		<div class="stepper-progress" aria-label="Step {currentStep} of 3">
			<button type="button" class="step-pill" class:active={currentStep === 1} onclick={() => goToStep(1)}>1</button>
			<span class="step-line" class:active={currentStep >= 2}></span>
			<button type="button" class="step-pill" class:active={currentStep === 2} onclick={() => goToStep(2)}>2</button>
			<span class="step-line" class:active={currentStep >= 3}></span>
			<button type="button" class="step-pill" class:active={currentStep === 3} onclick={() => category_id ? goToStep(3) : null}>3</button>
		</div>
	</header>

	<!-- Stepper Viewport -->
	<div class="stepper-viewport">
		{#key currentStep}
			<div class="step-panel" in:transitionIn out:transitionOut>
				{#if currentStep === 1}
					<!-- STEP 1: TRANSACTION TYPE -->
					<div class="step-content">
						<div class="step-title-wrap">
							<h2 class="step-title">What happened?</h2>
							<p class="step-subtitle">Select the type of transaction you want to record</p>
						</div>

						<div class="type-cards-grid" role="radiogroup" aria-label="Transaction type">
							<button
								type="button"
								bind:this={firstTypeBtn}
								class="type-card expense-card"
								class:active={type === 'expense'}
								onclick={() => selectType('expense')}
							>
								<div class="type-icon-circle expense-icon">
									<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
										<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
									</svg>
								</div>
								<div class="type-info">
									<span class="type-title">Expense</span>
									<span class="type-desc">Money spent on bills, food, or shopping</span>
								</div>
								<div class="type-arrow">
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
								</div>
							</button>

							<button
								type="button"
								class="type-card income-card"
								class:active={type === 'income'}
								onclick={() => selectType('income')}
							>
								<div class="type-icon-circle income-icon">
									<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
										<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
									</svg>
								</div>
								<div class="type-info">
									<span class="type-title">Income</span>
									<span class="type-desc">Money received from salary, sales, or gifts</span>
								</div>
								<div class="type-arrow">
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
								</div>
							</button>
						</div>

						{#if errors.type}
							<span class="form-error">{errors.type}</span>
						{/if}
					</div>

				{:else if currentStep === 2}
					<!-- STEP 2: CATEGORY SELECTION -->
					<div class="step-content">
						<div class="step-title-wrap">
							<div class="step-type-badge {type}">
								{type === 'income' ? 'Income' : 'Expense'}
							</div>
							<h2 class="step-title">What was it for?</h2>
							<p class="step-subtitle">Choose a category for this {type}</p>
						</div>

						{#if filteredCategories.length > 0}
							<div class="category-grid">
								{#each filteredCategories as cat, i (cat.id)}
									{@const hue = getCategoryHue('', cat.color)}
									{@const tint = getCategoryTint('', hue, isDark)}
									{@const fg = getCategoryText('', hue, isDark)}
									{@const isSelected = Number(category_id) === cat.id}
									{#if i === 0}
										<button
											type="button"
											bind:this={firstCategoryBtn}
											class="cat-card"
											class:active={isSelected}
											onclick={() => selectCategory(cat.id)}
											aria-pressed={isSelected}
										>
											<span class="cat-icon-wrap" style="background: {tint}; color: {fg}">{cat.icon}</span>
											<div class="cat-card-body">
												<span class="cat-name">{cat.name}</span>
												{#if categoryTxnCounts[cat.id]}
													<span class="cat-meta">{categoryTxnCounts[cat.id]} {categoryTxnCounts[cat.id] === 1 ? 'txn' : 'txns'} • {formatCurrency(spendingMap[cat.id] ?? 0)}</span>
												{/if}
											</div>
										</button>
									{:else}
										<button
											type="button"
											class="cat-card"
											class:active={isSelected}
											onclick={() => selectCategory(cat.id)}
											aria-pressed={isSelected}
										>
											<span class="cat-icon-wrap" style="background: {tint}; color: {fg}">{cat.icon}</span>
											<div class="cat-card-body">
												<span class="cat-name">{cat.name}</span>
												{#if categoryTxnCounts[cat.id]}
													<span class="cat-meta">{categoryTxnCounts[cat.id]} {categoryTxnCounts[cat.id] === 1 ? 'txn' : 'txns'} • {formatCurrency(spendingMap[cat.id] ?? 0)}</span>
												{/if}
											</div>
										</button>
									{/if}
								{/each}
							</div>
						{:else}
							<div class="no-categories">
								<span class="form-error">No {type} categories found. Create one in Categories first.</span>
							</div>
						{/if}

						{#if errors.category_id}
							<span class="form-error">{errors.category_id}</span>
						{/if}
					</div>

				{:else if currentStep === 3}
					<!-- STEP 3: AMOUNT & RECORD -->
					<div class="step-content">
						<button type="button" class="category-header-banner" onclick={() => goToStep(2)} title="Click to change category">
							<div class="cat-banner-left">
								{#if selectedCategory}
									{@const hue = getCategoryHue('', selectedCategory.color)}
									{@const tint = getCategoryTint('', hue, isDark)}
									{@const fg = getCategoryText('', hue, isDark)}
									<span class="cat-banner-icon" style="background: {tint}; color: {fg}">{selectedCategory.icon}</span>
									<span class="cat-banner-name">{selectedCategory.name}</span>
								{:else}
									<span class="cat-banner-name">Select Category</span>
								{/if}
							</div>
							<span class="cat-banner-change">Change</span>
						</button>

						<!-- Hero Amount Display -->
						<div class="hero-amount-section" class:refund-active={isRefund}>
							<span class="hero-amount-prefix">{isRefund ? '↩' : (type === 'income' ? '+₱' : '₱')}</span>
							<input
								id="amount"
								bind:this={amountInputEl}
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
						{#if errors.amount}
							<span class="form-error center-error">{errors.amount}</span>
						{/if}

						<!-- Quick Amount Adjusters -->
						<div class="quick-amounts-row">
							<button type="button" class="quick-amt-btn" onclick={() => adjustAmount(100)}>+100</button>
							<button type="button" class="quick-amt-btn" onclick={() => adjustAmount(500)}>+500</button>
							<button type="button" class="quick-amt-btn" onclick={() => adjustAmount(1000)}>+1,000</button>
							<button type="button" class="quick-amt-btn reset-amt" onclick={() => rawAmount = ''} title="Clear amount">Clear</button>
						</div>

						<!-- Primary CTA Button -->
						<div class="primary-cta-wrap">
							<Button type="submit" variant="primary" fullWidth>
								{transaction ? 'Save Changes' : (type === 'income' ? 'Record Income ✓' : 'Record Expense ✓')}
							</Button>
						</div>

						<!-- Progressive Disclosure: Optional Details -->
						<div class="details-accordion">
							<button
								type="button"
								class="btn-toggle-details"
								onclick={() => detailsOpen = !detailsOpen}
								aria-expanded={detailsOpen}
							>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class:rotated={detailsOpen}>
									<polyline points="6 9 12 15 18 9"/>
								</svg>
								<span>{detailsOpen ? 'Hide details' : '+ Add details'}</span>
								<span class="details-subtext">{detailsOpen ? '' : '(Description, Date, Source, Refund)'}</span>
							</button>

							{#if detailsOpen}
								<div class="details-body" in:fade={{ duration: 150 }}>
									<!-- Description -->
									<div class="form-group">
										<label class="form-label" for="description">
											Description <span class="optional-tag">optional</span>
										</label>
										<div class="desc-input-wrap">
											<textarea
												id="description"
												maxlength="500"
												bind:value={description}
												placeholder={selectedCategory?.name ?? "What was this for?"}
												rows="2"
											></textarea>
											<span class="char-count">{description.length}/500</span>
										</div>
										<p class="field-hint">If left blank, defaults to "{selectedCategory?.name ?? 'Category name'}".</p>
									</div>

									<!-- Date -->
									<div class="form-group">
										<label class="form-label" for="date">Date</label>
										<div class="date-input-row">
											<input
												id="date"
												type="date"
												required
												bind:value={date}
											/>
											<button type="button" class="btn-today" onclick={() => date = formatDateInput()} title="Set to today">
												Today
											</button>
										</div>
									</div>

									<!-- Source of Funds -->
									<div class="form-group">
										<label class="form-label" for="source_of_funds">
											Source of Funds <span class="optional-tag">optional</span>
										</label>
										<input
											id="source_of_funds"
											type="text"
											bind:value={sourceOfFunds}
											placeholder="e.g. Personal Account, Cash, Mama Cel"
											autocomplete="off"
										/>
									</div>

									<!-- Refund Toggle -->
									{#if type === 'expense'}
										<div class="form-group refund-section">
											<label class="refund-label">
												<input type="checkbox" bind:checked={isRefund} />
												<span class="refund-text">Record as refund</span>
												{#if isRefund}
													<span class="refund-chip">↩ Refund</span>
												{/if}
											</label>
										</div>
									{/if}

									<!-- Live Impact Preview -->
									<LiveImpactPreview
										currentTotal={currentCategoryTotal}
										projectedTotal={projectedCategoryTotal}
										type={type}
										isRefund={isRefund}
										categoryName={selectedCategory?.name ?? ''}
									/>
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		{/key}
	</div>
</form>

<style>
	.stepper-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		width: 100%;
	}

	/* ── Stepper Header ── */
	.stepper-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: var(--space-sm);
		border-bottom: 1px dashed var(--color-border);
	}

	.btn-step-back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: transparent;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-pill);
		padding: 6px 14px;
		font-family: var(--font-body);
		font-size: var(--font-size-xs);
		font-weight: 600;
		color: var(--color-text-muted);
		cursor: pointer;
		min-height: 36px;
		transition: all 150ms var(--ease);
	}

	.btn-step-back:hover {
		background: var(--color-surface-inset);
		color: var(--color-text);
		border-color: var(--color-teal);
	}

	.stepper-progress {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.step-pill {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		border-radius: var(--radius-full);
		background: var(--color-surface-inset);
		color: var(--color-text-muted);
		font-size: 12px;
		font-weight: 700;
		font-family: var(--font-mono);
		cursor: pointer;
		border: none;
		transition: all 200ms var(--ease);
	}

	.step-pill.active {
		background: var(--color-teal);
		color: white;
		box-shadow: 0 0 0 3px var(--color-teal-bg);
	}

	.step-line {
		width: 18px;
		height: 2px;
		background: var(--color-border);
		transition: background 200ms var(--ease);
	}

	.step-line.active {
		background: var(--color-teal);
	}

	/* ── Stepper Viewport ── */
	.stepper-viewport {
		position: relative;
		overflow: hidden;
		min-height: 380px;
	}

	.step-panel {
		width: 100%;
	}

	.step-content {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		padding-top: var(--space-xs);
	}

	.step-title-wrap {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.step-title {
		font-family: var(--font-display);
		font-size: var(--font-size-xl);
		font-weight: 800;
		color: var(--color-text);
		margin: 0;
		letter-spacing: -0.01em;
	}

	.step-subtitle {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		margin: 0;
	}

	.step-type-badge {
		display: inline-flex;
		align-self: flex-start;
		font-family: var(--font-display);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 2px 8px;
		border-radius: var(--radius-pill);
	}

	.step-type-badge.expense {
		background: var(--rose-soft);
		color: var(--rose);
	}

	.step-type-badge.income {
		background: var(--mint-tint);
		color: var(--teal-deep);
	}

	/* ── Step 1: Type Selection Cards ── */
	.type-cards-grid {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.type-card {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		padding: var(--space-lg);
		background: var(--color-surface);
		border: 2px solid var(--color-border);
		border-radius: var(--radius-lg);
		cursor: pointer;
		text-align: left;
		transition: all 200ms var(--bounce);
		-webkit-tap-highlight-color: transparent;
		min-height: 84px;
		position: relative;
	}

	.type-card:hover {
		transform: translateY(-2px);
		box-shadow: var(--shadow-md);
	}

	.type-card:active {
		transform: scale(0.98);
	}

	.expense-card:hover,
	.expense-card.active {
		border-color: var(--rose);
		background: var(--rose-soft);
	}

	.income-card:hover,
	.income-card.active {
		border-color: var(--teal);
		background: var(--mint-tint);
	}

	.type-icon-circle {
		width: 48px;
		height: 48px;
		border-radius: var(--radius-full);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.expense-icon {
		background: rgba(239, 108, 74, 0.15);
		color: var(--rose);
	}

	.income-icon {
		background: rgba(43, 168, 162, 0.15);
		color: var(--teal-deep);
	}

	.type-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
	}

	.type-title {
		font-family: var(--font-display);
		font-size: var(--font-size-lg);
		font-weight: 700;
		color: var(--color-text);
	}

	.type-desc {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	.type-arrow {
		color: var(--color-text-muted);
		opacity: 0.5;
		transition: transform 150ms var(--ease);
	}

	.type-card:hover .type-arrow {
		transform: translateX(4px);
		opacity: 1;
	}

	/* ── Step 2: Category Grid ── */
	.category-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--space-sm);
		max-height: 380px;
		overflow-y: auto;
		padding: 6px 8px 6px 4px;
	}

	.cat-card {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		cursor: pointer;
		text-align: left;
		transition: all 180ms var(--bounce);
		min-height: 54px;
		-webkit-tap-highlight-color: transparent;
	}

	.cat-card:hover {
		border-color: var(--color-teal);
		background: var(--color-surface-inset);
		transform: translateY(-1px);
	}

	.cat-card:active {
		transform: scale(0.97);
	}

	.cat-card.active {
		border: 2px solid var(--color-teal);
		background: var(--color-teal-bg);
		box-shadow: var(--shadow-sm);
	}

	.cat-icon-wrap {
		width: 36px;
		height: 36px;
		border-radius: var(--radius-md);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 18px;
		flex-shrink: 0;
	}

	.cat-card-body {
		display: flex;
		flex-direction: column;
		gap: 2px;
		overflow: hidden;
	}

	.cat-name {
		font-family: var(--font-display);
		font-size: var(--font-size-sm);
		font-weight: 700;
		color: var(--color-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.cat-meta {
		font-size: 10px;
		color: var(--color-text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* ── Step 3: Hero Amount & CTA ── */
	.category-header-banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-xs) var(--space-md);
		background: var(--color-surface-inset);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		cursor: pointer;
		width: 100%;
		transition: all 150ms var(--ease);
	}

	.category-header-banner:hover {
		border-color: var(--color-teal);
	}

	.cat-banner-left {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.cat-banner-icon {
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 15px;
	}

	.cat-banner-name {
		font-family: var(--font-display);
		font-size: var(--font-size-sm);
		font-weight: 700;
		color: var(--color-text);
	}

	.cat-banner-change {
		font-size: var(--font-size-xs);
		font-weight: 600;
		color: var(--color-teal);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.hero-amount-section {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: var(--space-md);
		background: var(--color-cream);
		border: 2px solid var(--color-hairline);
		border-radius: var(--radius-xl);
		transition: border-color 200ms var(--ease), box-shadow 200ms var(--ease);
	}

	.hero-amount-section:focus-within {
		border-color: var(--color-teal);
		box-shadow: var(--focus);
	}

	.hero-amount-prefix {
		font-family: var(--font-display);
		font-size: 32px;
		font-weight: 800;
		color: var(--color-text-muted);
	}

	.hero-amount-section input,
	.hero-amount-section input[type="text"],
	.hero-amount-section #amount {
		border: none !important;
		background: transparent !important;
		font-family: var(--font-display) !important;
		font-size: 36px !important;
		font-weight: 800;
		color: var(--color-text);
		width: 100%;
		text-align: left;
		padding: 0 !important;
		min-height: 48px;
		box-shadow: none !important;
	}

	.hero-amount-section input:focus {
		outline: none;
	}

	.quick-amounts-row {
		display: flex;
		gap: var(--space-xs);
	}

	.quick-amt-btn {
		flex: 1;
		padding: 8px 12px;
		background: var(--color-teal-bg);
		border: 1px solid var(--color-teal);
		border-radius: var(--radius-pill);
		color: var(--color-teal);
		font-family: var(--font-display);
		font-size: var(--font-size-xs);
		font-weight: 700;
		cursor: pointer;
		min-height: 38px;
		transition: all 150ms var(--ease);
	}

	.quick-amt-btn:hover {
		background: var(--color-teal);
		color: white;
	}

	.quick-amt-btn:active {
		transform: scale(0.95);
	}

	.quick-amt-btn.reset-amt {
		background: transparent;
		border-color: var(--color-border);
		color: var(--color-text-muted);
		flex: 0 0 auto;
	}

	.quick-amt-btn.reset-amt:hover {
		background: var(--color-surface-inset);
		color: var(--color-text);
	}

	.primary-cta-wrap {
		margin-top: var(--space-xs);
	}

	.primary-cta-wrap :global(.btn) {
		height: 52px;
		font-size: var(--font-size-base);
		font-weight: 700;
		border-radius: var(--radius-pill);
	}

	/* ── Progressive Disclosure ── */
	.details-accordion {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		border-top: 1px dashed var(--color-border);
		padding-top: var(--space-md);
	}

	.btn-toggle-details {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: none;
		border: none;
		color: var(--color-teal);
		font-family: var(--font-body);
		font-size: var(--font-size-xs);
		font-weight: 600;
		cursor: pointer;
		padding: 4px 0;
		text-align: left;
	}

	.btn-toggle-details svg {
		transition: transform 200ms var(--ease);
	}

	.btn-toggle-details svg.rotated {
		transform: rotate(180deg);
	}

	.details-subtext {
		color: var(--color-text-muted);
		font-weight: 400;
	}

	.details-body {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		padding: var(--space-md);
		background: var(--color-surface-inset);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.form-label {
		font-family: var(--font-display);
		font-size: var(--font-size-xs);
		font-weight: 700;
		color: var(--color-text);
	}

	.optional-tag {
		font-size: 10px;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 1px 6px;
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-pill);
	}

	.desc-input-wrap {
		position: relative;
	}

	textarea,
	input[type="text"],
	input[type="date"] {
		width: 100%;
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-md);
		font-size: var(--font-size-sm);
		font-family: var(--font-body);
		background: var(--color-surface);
		color: var(--color-text);
		transition: border-color 150ms var(--ease);
	}

	textarea {
		resize: vertical;
		min-height: 64px;
	}

	input:focus,
	textarea:focus {
		outline: none;
		border-color: var(--color-teal);
		box-shadow: var(--focus);
	}

	.char-count {
		position: absolute;
		bottom: 8px;
		right: 10px;
		font-size: 10px;
		color: var(--color-text-muted);
		font-family: var(--font-mono);
		opacity: 0.7;
	}

	.field-hint {
		font-size: 11px;
		color: var(--color-text-muted);
		margin: 2px 0 0 2px;
	}

	.date-input-row {
		display: flex;
		gap: var(--space-sm);
		align-items: center;
	}

	.btn-today {
		padding: 8px 16px;
		background: var(--color-teal-bg);
		border: 1px solid var(--color-teal);
		border-radius: var(--radius-pill);
		color: var(--color-teal);
		font-family: var(--font-display);
		font-size: var(--font-size-xs);
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
		min-height: 40px;
	}

	.refund-label {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		cursor: pointer;
		padding: 8px 12px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		user-select: none;
	}

	.refund-label input {
		accent-color: var(--teal-deep);
		width: 16px;
		height: 16px;
	}

	.refund-text {
		font-size: var(--font-size-xs);
		font-weight: 600;
		color: var(--color-text);
	}

	.refund-chip {
		margin-left: auto;
		padding: 2px 8px;
		background: var(--mint-tint);
		color: var(--teal-deep);
		border-radius: var(--radius-pill);
		font-size: 10px;
		font-weight: 700;
	}

	.form-error {
		font-size: var(--font-size-xs);
		color: var(--color-coral);
		font-weight: 600;
	}

	.center-error {
		text-align: center;
	}

	.no-categories {
		padding: var(--space-md);
		text-align: center;
	}
</style>

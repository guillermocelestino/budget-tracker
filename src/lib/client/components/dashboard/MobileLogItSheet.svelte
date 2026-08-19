<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { getToday, formatWithCommas } from '$lib/shared/utils/format';
	import { showSuccess } from '$lib/client/stores/toast.svelte';
	import type { Category, LendingWithPayments } from '$lib/types';
	import type { PunchType } from './MobileMoneyPunchOverlay.svelte';

	type LogType = 'spent' | 'lent' | 'repaid' | null;

	let {
		isOpen = false,
		categories = [],
		activeBorrowed = [],
		onclose,
		onsuccess
	}: {
		isOpen?: boolean;
		categories?: Category[];
		activeBorrowed?: LendingWithPayments[];
		onclose?: () => void;
		onsuccess?: (info: { type: PunchType; amount: number }) => void;
	} = $props();

	let selectedType = $state<LogType>(null);
	let submitting = $state(false);
	let errorMessage = $state<string | null>(null);

	// Spent form fields
	let spentAmount = $state('');
	let spentCategoryId = $state<number | null>(null);
	let spentDescription = $state('');
	let spentDate = $state(getToday());

	// Lent form fields
	let lentAmount = $state('');
	let lentBorrowerName = $state('');
	let lentDate = $state(getToday());
	let lentNotes = $state('');

	// Repaid form fields
	let repaidLendingId = $state<number | null>(null);
	let repaidAmount = $state('');
	let repaidDate = $state(getToday());
	let repaidNotes = $state('');

	// Auto-select first category if available
	$effect(() => {
		if (categories.length > 0 && spentCategoryId === null) {
			spentCategoryId = categories[0].id;
		}
	});

	// Auto-select first active borrowed obligation if available
	$effect(() => {
		if (activeBorrowed.length > 0 && repaidLendingId === null) {
			repaidLendingId = activeBorrowed[0].id;
		}
	});

	// Body scroll locking
	$effect(() => {
		if (typeof document !== 'undefined') {
			if (isOpen) {
				document.body.style.overflow = 'hidden';
			} else {
				document.body.style.overflow = '';
			}
		}
		return () => {
			if (typeof document !== 'undefined') {
				document.body.style.overflow = '';
			}
		};
	});

	function resetForm() {
		selectedType = null;
		submitting = false;
		errorMessage = null;
		spentAmount = '';
		spentDescription = '';
		spentDate = getToday();
		lentAmount = '';
		lentBorrowerName = '';
		lentDate = getToday();
		lentNotes = '';
		repaidAmount = '';
		repaidDate = getToday();
		repaidNotes = '';
	}

	function forceCloseSheet() {
		submitting = false;
		resetForm();
		onclose?.();
	}

	function closeSheet() {
		if (submitting) return;
		forceCloseSheet();
	}

	function selectType(type: LogType) {
		selectedType = type;
		errorMessage = null;
	}

	function onAmountInput(e: Event, setter: (val: string) => void) {
		const input = e.target as HTMLInputElement;
		let raw = input.value.replace(/[^0-9.]/g, '');
		const dots = raw.match(/\./g);
		if (dots && dots.length > 1) raw = raw.slice(0, raw.lastIndexOf('.'));
		setter(raw);
		input.value = raw ? formatWithCommas(raw) : '';
	}

	async function submitSpent() {
		const amount = parseFloat(spentAmount);
		if (isNaN(amount) || amount <= 0) {
			errorMessage = 'Please enter a valid amount';
			return;
		}
		if (!spentCategoryId) {
			errorMessage = 'Please select a category';
			return;
		}

		submitting = true;
		errorMessage = null;

		try {
			const res = await fetch('/api/transactions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: 'expense',
					amount,
					description: spentDescription.trim() || categories.find(c => c.id === spentCategoryId)?.name || 'Expense',
					date: spentDate,
					category_id: spentCategoryId
				})
			});

			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Failed to log expense');

			showSuccess('Expense logged successfully!');
			onsuccess?.({ type: 'spent', amount });
			forceCloseSheet();
			invalidate('app:dashboard');
		} catch (err: unknown) {
			errorMessage = err instanceof Error ? err.message : String(err);
		} finally {
			submitting = false;
		}
	}

	async function submitLent() {
		const amount = parseFloat(lentAmount);
		if (isNaN(amount) || amount <= 0) {
			errorMessage = 'Please enter a valid amount';
			return;
		}
		if (!lentBorrowerName.trim()) {
			errorMessage = 'Please enter the borrower name';
			return;
		}

		submitting = true;
		errorMessage = null;

		try {
			const res = await fetch('/api/lendings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					borrower_name: lentBorrowerName.trim(),
					amount,
					date_lent: lentDate,
					notes: lentNotes.trim() || null,
					direction: 'lent'
				})
			});

			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Failed to log lent money');

			showSuccess('Lent money logged successfully!');
			onsuccess?.({ type: 'lent', amount });
			forceCloseSheet();
			invalidate('app:dashboard');
		} catch (err: unknown) {
			errorMessage = err instanceof Error ? err.message : String(err);
		} finally {
			submitting = false;
		}
	}

	async function submitRepaid() {
		const amount = parseFloat(repaidAmount);
		if (isNaN(amount) || amount <= 0) {
			errorMessage = 'Please enter a valid amount';
			return;
		}
		if (!repaidLendingId) {
			errorMessage = 'Please select a debt obligation to repay';
			return;
		}

		submitting = true;
		errorMessage = null;

		try {
			const res = await fetch(`/api/lendings/${repaidLendingId}/payments`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					amount,
					payment_date: repaidDate,
					notes: repaidNotes.trim() || null,
					payment_type: 'payment',
					create_transaction: true
				})
			});

			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Failed to log repayment');

			showSuccess('Repayment logged successfully!');
			onsuccess?.({ type: 'repaid', amount });
			forceCloseSheet();
			invalidate('app:dashboard');
		} catch (err: unknown) {
			errorMessage = err instanceof Error ? err.message : String(err);
		} finally {
			submitting = false;
		}
	}
</script>

{#if isOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="sheet-backdrop" onclick={closeSheet}>
		<div class="sheet-modal" onclick={(e) => e.stopPropagation()}>
			<div class="sheet-drag-handle"></div>

			<!-- Header -->
			<div class="sheet-header">
				{#if selectedType}
					<button type="button" class="back-btn" onclick={() => selectType(null)} disabled={submitting}>
						‹ change
					</button>
				{:else}
					<span class="sheet-subtitle">LOG IT</span>
				{/if}

				<button type="button" class="close-btn" onclick={closeSheet} disabled={submitting} aria-label="Close">
					✕
				</button>
			</div>

			<!-- Error Alert -->
			{#if errorMessage}
				<div class="error-banner">{errorMessage}</div>
			{/if}

			<!-- STEP 1: Type Selection -->
			{#if !selectedType}
				<div class="type-selector-step">
					<h2 class="step-title">What left your pocket?</h2>
					<p class="step-desc">Choose a type to log in one tap.</p>

					<div class="type-cards">
						<button type="button" class="type-card spent-type" onclick={() => selectType('spent')}>
							<div class="type-icon-wrap">💸</div>
							<div class="type-info">
								<span class="type-name">Spent</span>
								<span class="type-sub">Money that is gone.</span>
							</div>
							<span class="arrow-indicator">›</span>
						</button>

						<button type="button" class="type-card lent-type" onclick={() => selectType('lent')}>
							<div class="type-icon-wrap">🤝</div>
							<div class="type-info">
								<span class="type-name">Lent</span>
								<span class="type-sub">Money that left your hands — but you expect it back.</span>
							</div>
							<span class="arrow-indicator">›</span>
						</button>

						<button type="button" class="type-card repaid-type" onclick={() => selectType('repaid')}>
							<div class="type-icon-wrap">🧾</div>
							<div class="type-info">
								<span class="type-name">Repaid</span>
								<span class="type-sub">Paying back money you borrowed.</span>
							</div>
							<span class="arrow-indicator">›</span>
						</button>
					</div>
				</div>
			{/if}

			<!-- STEP 2: Spent Form -->
			{#if selectedType === 'spent'}
				<form class="form-step" onsubmit={(e) => { e.preventDefault(); submitSpent(); }}>
					<h2 class="form-title">Log Expense</h2>

					<!-- Amount Input -->
					<div class="input-group">
						<label for="spent_amount" class="input-label">AMOUNT</label>
						<div class="amount-input-box">
							<span class="currency-sym">₱</span>
							<input
								id="spent_amount"
								type="text"
								inputmode="decimal"
								placeholder="0.00"
								value={spentAmount ? formatWithCommas(spentAmount) : ''}
								oninput={(e) => onAmountInput(e, (v) => (spentAmount = v))}
								required
								autocomplete="off"
								class="big-amount-input"
							/>
						</div>
					</div>

					<!-- Category Selector -->
					<div class="input-group">
						<label for="spent_cat" class="input-label">CATEGORY</label>
						<select id="spent_cat" bind:value={spentCategoryId} class="select-input">
							{#each categories as cat (cat.id)}
								<option value={cat.id}>{cat.icon} {cat.name}</option>
							{/each}
						</select>
					</div>

					<!-- Description Input -->
					<div class="input-group">
						<label for="spent_desc" class="input-label">DESCRIPTION (OPTIONAL)</label>
						<input
							id="spent_desc"
							type="text"
							placeholder="What was this for?"
							bind:value={spentDescription}
							class="text-input"
						/>
					</div>

					<!-- Date Input -->
					<div class="input-group">
						<label for="spent_date" class="input-label">DATE</label>
						<input id="spent_date" type="date" bind:value={spentDate} class="text-input" />
					</div>

					<button type="submit" class="submit-btn spent-submit-btn" disabled={submitting}>
						{submitting ? 'Logging...' : 'Log Spent'}
					</button>
				</form>
			{/if}

			<!-- STEP 2: Lent Form -->
			{#if selectedType === 'lent'}
				<form class="form-step" onsubmit={(e) => { e.preventDefault(); submitLent(); }}>
					<h2 class="form-title">Log Lent Money</h2>

					<!-- Amount Input -->
					<div class="input-group">
						<label for="lent_amount" class="input-label">AMOUNT</label>
						<div class="amount-input-box">
							<span class="currency-sym">₱</span>
							<input
								id="lent_amount"
								type="text"
								inputmode="decimal"
								placeholder="0.00"
								value={lentAmount ? formatWithCommas(lentAmount) : ''}
								oninput={(e) => onAmountInput(e, (v) => (lentAmount = v))}
								required
								autocomplete="off"
								class="big-amount-input"
							/>
						</div>
					</div>

					<!-- Borrower Name Input -->
					<div class="input-group">
						<label for="lent_borrower" class="input-label">PERSON / BORROWER</label>
						<input
							id="lent_borrower"
							type="text"
							placeholder="Who did you lend to?"
							bind:value={lentBorrowerName}
							required
							class="text-input"
						/>
					</div>

					<!-- Date Lent -->
					<div class="input-group">
						<label for="lent_date" class="input-label">DATE LENT</label>
						<input id="lent_date" type="date" bind:value={lentDate} class="text-input" />
					</div>

					<!-- Notes -->
					<div class="input-group">
						<label for="lent_notes" class="input-label">NOTES (OPTIONAL)</label>
						<input
							id="lent_notes"
							type="text"
							placeholder="Add optional details"
							bind:value={lentNotes}
							class="text-input"
						/>
					</div>

					<button type="submit" class="submit-btn lent-submit-btn" disabled={submitting}>
						{submitting ? 'Logging...' : 'Log Lent'}
					</button>
				</form>
			{/if}

			<!-- STEP 2: Repaid Form -->
			{#if selectedType === 'repaid'}
				<form class="form-step" onsubmit={(e) => { e.preventDefault(); submitRepaid(); }}>
					<h2 class="form-title">Log Debt Repayment</h2>

					{#if activeBorrowed.length === 0}
						<div class="no-borrowed-notice">
							<span>No active borrowed obligations found to repay.</span>
						</div>
					{:else}
						<!-- Select Active Borrowed -->
						<div class="input-group">
							<label for="repaid_lending" class="input-label">DEBT OBLIGATION</label>
							<select id="repaid_lending" bind:value={repaidLendingId} class="select-input">
								{#each activeBorrowed as b (b.id)}
									<option value={b.id}>
										{b.borrower_name} — ₱{formatWithCommas(String(b.remaining))} remaining
									</option>
								{/each}
							</select>
						</div>

						<!-- Amount Input -->
						<div class="input-group">
							<label for="repaid_amount" class="input-label">REPAYMENT AMOUNT</label>
							<div class="amount-input-box">
								<span class="currency-sym">₱</span>
								<input
									id="repaid_amount"
									type="text"
									inputmode="decimal"
									placeholder="0.00"
									value={repaidAmount ? formatWithCommas(repaidAmount) : ''}
									oninput={(e) => onAmountInput(e, (v) => (repaidAmount = v))}
									required
									autocomplete="off"
									class="big-amount-input"
								/>
							</div>
						</div>

						<!-- Date -->
						<div class="input-group">
							<label for="repaid_date" class="input-label">PAYMENT DATE</label>
							<input id="repaid_date" type="date" bind:value={repaidDate} class="text-input" />
						</div>

						<!-- Notes -->
						<div class="input-group">
							<label for="repaid_notes" class="input-label">NOTES (OPTIONAL)</label>
							<input
								id="repaid_notes"
								type="text"
								placeholder="Add optional payment notes"
								bind:value={repaidNotes}
								class="text-input"
							/>
						</div>

						<button type="submit" class="submit-btn repaid-submit-btn" disabled={submitting}>
							{submitting ? 'Logging...' : 'Log Repayment'}
						</button>
					{/if}
				</form>
			{/if}
		</div>
	</div>
{/if}

<style>
	.sheet-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(14, 42, 39, 0.5);
		backdrop-filter: blur(6px);
		-webkit-backdrop-filter: blur(6px);
		z-index: 1000;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		animation: fadeIn 200ms ease;
	}

	.sheet-modal {
		background: var(--color-surface);
		border-radius: 28px 28px 0 0;
		padding: 16px 20px calc(20px + var(--safe-bottom, 0px));
		max-height: 85vh;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 16px;
		box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.2);
		animation: slideUp 280ms cubic-bezier(0.34, 1.56, 0.64, 1);
		border-top: 1px solid var(--color-hairline);
	}

	.sheet-drag-handle {
		width: 36px;
		height: 5px;
		border-radius: 999px;
		background: var(--color-hairline, rgba(0, 0, 0, 0.2));
		margin: 0 auto 4px auto;
	}

	.sheet-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.sheet-subtitle {
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.1em;
		color: var(--color-text-muted);
	}

	.back-btn {
		background: none;
		border: none;
		font-size: 14px;
		font-weight: 700;
		color: var(--color-teal);
		cursor: pointer;
		padding: 0;
	}

	.close-btn {
		background: var(--color-surface-inset, rgba(0, 0, 0, 0.05));
		border: none;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		font-size: 12px;
		color: var(--color-text-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.error-banner {
		background: rgba(239, 108, 74, 0.12);
		color: var(--color-money-gone, #EF6C4A);
		padding: 10px 14px;
		border-radius: var(--radius-md);
		font-size: 12px;
		font-weight: 700;
	}

	/* Step 1 Styles */
	.type-selector-step {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.step-title {
		font-family: var(--font-display);
		font-size: 20px;
		font-weight: 800;
		color: var(--color-ink);
		margin: 0;
	}

	.step-desc {
		font-size: 13px;
		color: var(--color-text-muted);
		margin: -8px 0 4px 0;
	}

	.type-cards {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.type-card {
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-xl, 18px);
		padding: 14px;
		display: flex;
		align-items: center;
		gap: 12px;
		text-align: left;
		cursor: pointer;
		transition: all 140ms ease;
	}

	.type-card:active {
		transform: scale(0.98);
	}

	.spent-type { border-left: 4px solid var(--color-money-gone, #EF6C4A); }
	.lent-type { border-left: 4px solid var(--color-money-away, #5DADE2); }
	.repaid-type { border-left: 4px solid var(--color-gold, #FFD23F); }

	.type-icon-wrap {
		font-size: 24px;
		width: 44px;
		height: 44px;
		border-radius: var(--radius-full);
		background: var(--color-surface-inset, rgba(0, 0, 0, 0.05));
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.type-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
	}

	.type-name {
		font-family: var(--font-display);
		font-size: 15px;
		font-weight: 800;
		color: var(--color-ink);
	}

	.type-sub {
		font-size: 12px;
		color: var(--color-text-muted);
		line-height: 1.3;
	}

	.arrow-indicator {
		font-size: 18px;
		font-weight: 700;
		color: var(--color-text-muted);
	}

	/* Step 2 Form Styles */
	.form-step {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.form-title {
		font-family: var(--font-display);
		font-size: 18px;
		font-weight: 800;
		color: var(--color-ink);
		margin: 0;
	}

	.input-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.input-label {
		font-family: var(--font-display);
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.08em;
		color: var(--color-text-muted);
	}

	.amount-input-box {
		display: flex;
		align-items: center;
		background: var(--color-surface-inset, rgba(0, 0, 0, 0.04));
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-xl, 16px);
		padding: 8px 14px;
	}

	.currency-sym {
		font-family: var(--font-display);
		font-size: 24px;
		font-weight: 800;
		color: var(--color-text-muted);
		margin-right: 6px;
	}

	.big-amount-input {
		width: 100%;
		border: none;
		background: transparent;
		font-family: var(--font-display);
		font-size: 26px;
		font-weight: 800;
		color: var(--color-ink);
		outline: none;
	}

	.select-input, .text-input {
		width: 100%;
		height: 46px;
		border-radius: var(--radius-lg, 12px);
		border: 1px solid var(--color-hairline);
		background: var(--color-surface);
		color: var(--color-ink);
		padding: 0 14px;
		font-size: 14px;
		font-weight: 600;
		outline: none;
	}

	.no-borrowed-notice {
		background: var(--color-surface-inset, rgba(0, 0, 0, 0.04));
		border-radius: var(--radius-md);
		padding: 16px;
		text-align: center;
		font-size: 13px;
		color: var(--color-text-muted);
	}

	.submit-btn {
		height: 52px;
		border-radius: var(--radius-pill, 999px);
		border: none;
		font-family: var(--font-display);
		font-size: 16px;
		font-weight: 800;
		cursor: pointer;
		margin-top: 6px;
		transition: transform 140ms ease, box-shadow 140ms ease, opacity 140ms ease;
	}

	.submit-btn:active {
		transform: scale(0.97);
	}

	.submit-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		transform: none;
	}

	.spent-submit-btn {
		background: var(--color-money-gone, #EF6C4A);
		color: #ffffff;
		box-shadow: 0 4px 16px rgba(239, 108, 74, 0.4);
	}

	.lent-submit-btn {
		background: var(--color-money-away, #5DADE2);
		color: #ffffff;
		box-shadow: 0 4px 16px rgba(93, 173, 226, 0.4);
	}

	.repaid-submit-btn {
		background: var(--color-gold, #FFD23F);
		color: var(--color-on-gold, #14302E);
		box-shadow: var(--glow-gold, 0 4px 16px rgba(255, 210, 63, 0.4));
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes slideUp {
		from { transform: translateY(100%); }
		to { transform: translateY(0); }
	}
</style>

<script lang="ts">
	import { enhance } from '$app/forms';
	import { showSuccess, showError } from '$lib/stores/toast.svelte';
	import { formatWithCommas } from '$lib/utils/format';
	import type { Lending } from '$lib/types';

	let {
		lendingRecord,
		onCancel,
		onSuccess,
	}: {
		lendingRecord?: Lending;
		onCancel?: () => void;
		onSuccess?: () => void;
	} = $props();

	let borrowerName = $state('');
	let rawAmount = $state('');
	let interestRate = $state('0');
	let dateLent = $state('');
	let dueDate = $state('');
	let notes = $state('');

	// Initialize state when lendingRecord is provided (edit mode)
	$effect(() => {
		if (lendingRecord) {
			borrowerName = lendingRecord.borrower_name;
			rawAmount = lendingRecord.amount.toString();
			interestRate = lendingRecord.interest_rate.toString();
			dateLent = lendingRecord.date_lent;
			dueDate = lendingRecord.due_date ?? '';
			notes = lendingRecord.notes ?? '';
		}
	});

	const displayAmount = $derived(rawAmount ? formatWithCommas(rawAmount) : '');

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

	function handleEnhance() {
		return async ({ result, update }: { result: { type: string; data?: { error?: string } }; update: () => Promise<void> }) => {
			if (result.type === 'success') {
				showSuccess(lendingRecord ? 'Lending updated successfully' : 'Lending recorded successfully');
				onSuccess?.();
			} else if (result.type === 'failure') {
				showError(result.data?.error || 'An error occurred');
			}
			await update();
		};
	}
</script>

<form method="POST" action={lendingRecord ? '?/update' : '?/create'} use:enhance={handleEnhance}>
	{#if lendingRecord}
		<input type="hidden" name="id" value={lendingRecord.id} />
		<input type="hidden" name="status" value={lendingRecord.status} />
	{/if}

	<div class="form-group">
		<label class="form-label" for="borrower_name">Borrower Name</label>
		<input
			id="borrower_name"
			name="borrower_name"
			type="text"
			required
			placeholder="Who borrowed the money?"
			bind:value={borrowerName}
		/>
	</div>

	<div class="form-row">
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
					autocomplete="off"
				/>
			</div>
			<input type="hidden" name="amount" value={rawAmount} />
		</div>

		<div class="form-group">
			<label class="form-label" for="interest_rate">Interest %</label>
			<input
				id="interest_rate"
				name="interest_rate"
				type="number"
				step="0.1"
				placeholder="0"
				bind:value={interestRate}
			/>
		</div>
	</div>

	<div class="form-row">
		<div class="form-group">
			<label class="form-label" for="date_lent">Date Lent</label>
			<input
				id="date_lent"
				name="date_lent"
				type="date"
				required
				bind:value={dateLent}
			/>
		</div>

		<div class="form-group">
			<label class="form-label" for="due_date">Due Date</label>
			<input
				id="due_date"
				name="due_date"
				type="date"
				bind:value={dueDate}
			/>
		</div>
	</div>

	<div class="form-group">
		<label class="form-label" for="notes">Notes</label>
		<textarea
			id="notes"
			name="notes"
			rows="2"
			placeholder="Optional notes"
			bind:value={notes}
		></textarea>
	</div>

	<div class="form-actions">
		<button type="submit" class="btn btn-submit">
			{lendingRecord ? 'Update Lending' : 'Record Lending'}
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
		gap: 6px;
		margin-bottom: var(--space-md);
	}

	.form-label {
		font-family: var(--font-display);
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-text);
		letter-spacing: 0.02em;
	}

	.form-group input,
	.form-group textarea {
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-md);
		font-size: var(--font-size-base);
		font-family: var(--font-body);
		background: var(--color-cream);
		color: var(--color-text);
		width: 100%;
		min-height: 44px;
		transition: border-color 200ms var(--ease), box-shadow 200ms var(--ease);
		appearance: none;
		-webkit-appearance: none;
	}

	.form-group input:focus,
	.form-group textarea:focus {
		outline: none;
		border-color: var(--color-teal);
		box-shadow: var(--focus);
	}

	.form-group textarea {
		min-height: 80px;
		resize: vertical;
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-md);
	}

	.amount-wrap {
		display: flex;
		align-items: stretch;
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-md);
		background: var(--color-cream);
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
		color: var(--color-ink);
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
		.form-row {
			grid-template-columns: 1fr;
		}
	}
</style>

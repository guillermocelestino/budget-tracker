<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { formatDateInput, formatWithCommas } from '$lib/shared/utils/format';
import { handleAmountInput, handleAmountFocus, handleAmountBlur } from '$lib/client/utils/format';
	import { showSuccess, type ToastAction } from '$lib/client/stores/toast.svelte';
	import type { Category, RecurringTransaction, TransactionType, RecurringFrequency, RecurringFormInitial } from '$lib/types';
	import { generatePreview } from '$lib/shared/utils/recurring';

	let {
		categories = [],
		recurring,
		action,
		errors = {},
		onSuccess,
		onSubmit,
		initial,
		onCancel,
		submitLabel,
		successToast,
		dirty = $bindable(false),
	}: {
		categories: Category[];
		recurring?: RecurringTransaction;
		action?: string;
		errors?: Record<string, string>;
		onSuccess?: () => void;
		onSubmit?: (formData: FormData) => Promise<boolean>;
		initial?: RecurringFormInitial;
		onCancel?: () => void;
		submitLabel?: string;
		successToast?: { message?: string; action?: ToastAction };
		dirty?: boolean;
	} = $props();

	// ── Form state ─────────────────────────────────────────────────────
	// Seeded SYNCHRONOUSLY from the source record (`recurring` edit mode or
	// `initial` pre-filled create) via the $state initializers. This removes
	// any dependence on effect/mount timing: the values are in place the moment
	// the component is created, so edit mode always opens already-populated.
	// `src` is a snapshot of the source at instantiation (intentionally NOT
	// reactive — untrack makes that explicit); a re-sync $effect below handles
	// a NEW source arriving without a remount.
	const src = untrack(() => recurring ?? initial);

	let type = $state<TransactionType>(src?.type ?? 'expense');
	let rawAmount = $state(src ? String(src.amount) : '');
	let description = $state(src?.description ?? '');
	let category_id = $state<number | string>(src?.category_id ?? '');
	let frequency = $state<RecurringFrequency>(src?.frequency ?? 'monthly');
	let interval = $state(src?.interval ?? 1);
	let start_date = $state(src?.start_date ?? formatDateInput());
	let end_date = $state(src?.end_date ?? '');
	let active = $state(src?.active ?? true);

	type FormSeed = {
		type: TransactionType;
		amount: number;
		description: string;
		category_id: number | string;
		frequency: RecurringFrequency;
		interval: number;
		start_date: string;
		end_date: string;
		active: boolean;
	};

	// Snapshot of what was seeded, for the `dirty` discard check.
	let seed = $state<FormSeed | null>(
		src
			? {
					type: src.type,
					amount: src.amount,
					description: src.description,
					category_id: src.category_id,
					frequency: src.frequency,
					interval: src.interval,
					start_date: src.start_date,
					end_date: src.end_date ?? '',
					active: src.active,
				}
			: {
					type: 'expense',
					amount: 0,
					description: '',
					category_id: '',
					frequency: 'monthly',
					interval: 1,
					start_date: formatDateInput(),
					end_date: '',
					active: true,
				}
	);

	// Re-sync when a NEW source record arrives without a remount. Idempotent
	// on first run (same source → no-op). Built from the SOURCE, never from the
	// live $state fields, so this effect tracks only `recurring`/`initial` and
	// never self-triggers on user edits.
	let lastSource: RecurringTransaction | RecurringFormInitial | null = src ?? null;

	$effect(() => {
		const next = recurring ?? initial ?? null;
		if (next === lastSource) return;
		lastSource = next;
		if (next) {
			type = next.type;
			rawAmount = String(next.amount);
			description = next.description;
			category_id = next.category_id;
			frequency = next.frequency;
			interval = next.interval;
			start_date = next.start_date;
			end_date = next.end_date ?? '';
			active = next.active;
			seed = {
				type: next.type,
				amount: next.amount,
				description: next.description,
				category_id: next.category_id,
				frequency: next.frequency,
				interval: next.interval,
				start_date: next.start_date,
				end_date: next.end_date ?? '',
				active: next.active,
			};
		} else {
			start_date = formatDateInput();
			seed = {
				type: 'expense',
				amount: 0,
				description: '',
				category_id: '',
				frequency: 'monthly',
				interval: 1,
				start_date: formatDateInput(),
				end_date: '',
				active: true,
			};
		}
	});

	// Dirty = any field differs from the seeded snapshot.
	$effect(() => {
		if (!seed) return;
		dirty =
			type !== seed.type ||
			(parseFloat(rawAmount) || 0) !== seed.amount ||
			description !== seed.description ||
			category_id !== seed.category_id ||
			frequency !== seed.frequency ||
			interval !== seed.interval ||
			start_date !== seed.start_date ||
			(end_date || '') !== (seed.end_date || '') ||
			active !== seed.active;
	});

	const filteredCategories = $derived(
		categories.filter(cat => cat.type === type)
	);

	$effect(() => {
		// Don't wipe category_id during seeding — only validate on user-driven changes
		if (!seed) return;
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

	const successMessage = () =>
		successToast?.message ?? (recurring ? 'Recurring transaction updated successfully' : 'Recurring transaction added successfully');

	function handleEnhance() {
		return async ({ result, update }: { result: { type: string }; update: () => Promise<void> }) => {
			if (result.type === 'redirect') {
				showSuccess(successMessage(), undefined, successToast?.action);
				onSuccess?.();
			}
			await update();
		};
	}

	// When onSubmit is provided (slide panel mode), intercept the form submission
	// and call the API via fetch instead of using SvelteKit form actions.
	async function handleSubmit(e: SubmitEvent) {
		if (!onSubmit) return; // Fall through to use:enhance
		e.preventDefault();
		const form = e.target as HTMLFormElement;
		const formData = new FormData(form);
		const success = await onSubmit(formData);
		if (success) {
			showSuccess(successMessage(), undefined, successToast?.action);
			onSuccess?.();
		}
	}

	// Preview next 5 runs
	const previewDates = $derived(
		generatePreview(frequency, interval, null, null, null, start_date, 5)
	);

	const frequencyLabels: Record<RecurringFrequency, string> = {
		daily: 'Day',
		weekly: 'Week',
		monthly: 'Month',
		yearly: 'Year'
	};
</script>

<form action={action} use:enhance={onSubmit ? undefined : handleEnhance} onsubmit={handleSubmit}>
	{#if recurring}
		<input type="hidden" name="id" value={recurring.id} />
	{/if}
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
			<div class="amount-section">
				<button type="button" class="amt-btn amt-minus" onclick={() => adjustAmount(-500)} aria-label="Subtract 500">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
				</button>
				<div class="amount-display-wrap">
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
					placeholder="What is this for?"
					rows="3"
				></textarea>
				<span class="char-count">{description.length}/500</span>
			</div>
			<input type="hidden" name="description" value={description} />
			{#if errors.description}
				<span class="form-error">{errors.description}</span>
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

		<!-- ═══ Recurring-specific fields ═══ -->
		<fieldset class="form-group">
			<legend class="form-label">Frequency</legend>
			<div class="frequency-selector">
				<select
					name="frequency"
					bind:value={frequency}
					class:input-error={errors.frequency}
					onchange={() => { if (frequency === 'yearly' && interval === 1) interval = 1; }}
				>
					<option value="daily">Daily</option>
					<option value="weekly">Weekly</option>
					<option value="monthly" selected>Monthly</option>
					<option value="yearly">Yearly</option>
				</select>
				{#if errors.frequency}
					<span class="form-error">{errors.frequency}</span>
				{/if}
			</div>
		</fieldset>

		<div class="form-row">
			<div class="form-group">
				<label class="form-label" for="interval">Every</label>
				<input
					id="interval"
					name="interval"
					type="number"
					min="1"
					max="99"
					required
					bind:value={interval}
					class:input-error={errors.interval}
				/>
				<span class="interval-suffix">{frequencyLabels[frequency]}{interval > 1 ? 's' : ''}</span>
				{#if errors.interval}
					<span class="form-error">{errors.interval}</span>
				{/if}
			</div>

			<div class="form-group">
				<label class="form-label" for="start_date">Start Date</label>
				<input
					id="start_date"
					name="start_date"
					type="date"
					required
					bind:value={start_date}
					class:input-error={errors.start_date}
				/>
				{#if errors.start_date}
					<span class="form-error">{errors.start_date}</span>
				{/if}
			</div>
		</div>

		<div class="form-group">
			<label class="form-label" for="end_date">End Date (optional)</label>
			<input
				id="end_date"
				name="end_date"
				type="date"
				bind:value={end_date}
			/>
			<span class="form-hint">Leave blank for never ending</span>
		</div>

		<!-- ═══ Preview ═══ -->
		<div class="form-group preview-section">
			<legend class="form-label">Next Runs (Preview)</legend>
			<div class="preview-dates">
				{#each previewDates as date (date)}
					<span class="preview-date">{new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
				{/each}
			</div>
		</div>

		<!-- ═══ Active toggle ═══ -->
		<div class="form-group checkbox-group">
			<label class="checkbox-label">
				<input type="checkbox" name="active" bind:checked={active} />
				<span class="checkbox-text">
					<strong>Active</strong>
					<br />
					<span class="checkbox-desc">Pause to stop generating transactions</span>
				</span>
			</label>
		</div>
	</div>

	<div class="form-actions">
		<button type="submit" class="btn btn-submit">
			{submitLabel ?? (recurring ? 'Update Recurring Transaction' : 'Add Recurring Transaction')}
		</button>
		<button type="button" class="btn btn-cancel" onclick={() => (onCancel ? onCancel() : goto('/recurring'))}>
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

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-md);
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
	textarea,
	select {
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

	select {
		cursor: pointer;
	}

	select:focus,
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

	.form-hint {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		margin-top: 4px;
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

	/* ── Frequency selector ── */
	.frequency-selector select {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 12px center;
		padding-right: 40px;
	}

	/* ── Interval with suffix ── */
	.form-row .form-group {
		position: relative;
	}

	.interval-suffix {
		position: absolute;
		bottom: 12px;
		right: 12px;
		font-family: var(--font-display);
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-text-muted);
		pointer-events: none;
	}

	/* ── Preview section ── */
	.preview-section {
		background: var(--color-bg);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-lg);
		padding: var(--space-md);
	}

	.preview-dates {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
		margin-top: var(--space-xs);
	}

	.preview-date {
		display: inline-flex;
		align-items: center;
		padding: var(--space-xs) var(--space-md);
		background: var(--color-teal-bg);
		color: var(--color-teal);
		border-radius: var(--radius-pill);
		font-family: var(--font-display);
		font-size: var(--font-size-sm);
		font-weight: 600;
	}

	/* ── Checkbox group ── */
	.checkbox-group {
		margin-top: var(--space-sm);
	}

	.checkbox-label {
		display: flex;
		align-items: flex-start;
		gap: var(--space-sm);
		cursor: pointer;
		padding: var(--space-sm);
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.checkbox-label input {
		margin-top: 2px;
		accent-color: var(--color-primary);
		width: 18px;
		height: 18px;
		flex-shrink: 0;
		appearance: auto;
		-webkit-appearance: auto;
		outline: none;
		box-shadow: none;
		min-height: auto;
	}

	.checkbox-label input:focus {
		box-shadow: none;
		border-color: transparent;
	}

	.checkbox-label:has(input:focus) {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 3px var(--color-primary-light);
	}

	.checkbox-text {
		font-size: var(--font-size-sm);
		color: var(--color-text);
		line-height: 1.4;
	}

	.checkbox-desc {
		font-weight: 400;
		color: var(--color-text-secondary);
		font-size: var(--font-size-xs);
		margin-top: 2px;
	}

	.checkbox-label:has(input:checked) {
		background: rgba(43, 168, 162, 0.08);
		border-color: var(--color-teal);
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

		.form-row {
			grid-template-columns: 1fr;
		}

		.interval-suffix {
			display: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		* {
			transition: none !important;
		}
	}
</style>
<script lang="ts">
	let {
		selectedMonth = '',
		onChange,
	}: {
		selectedMonth?: string;
		onChange?: (month: string) => void;
	} = $props();

	const now = new Date();
	const currentYear = now.getFullYear();
	const currentMonth = now.getMonth() + 1;

	const months = $derived.by(() => {
		const items: { value: string; label: string }[] = [];

		// Last 12 months
		for (let i = 11; i >= 0; i--) {
			const d = new Date(currentYear, currentMonth - 1 - i, 1);
			const y = d.getFullYear();
			const m = d.getMonth() + 1;
			const value = `${y}-${String(m).padStart(2, '0')}`;
			const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
			items.push({ value, label });
		}
		return items;
	});

	function goForward() {
		const idx = months.findIndex(m => m.value === selectedMonth);
		if (idx < months.length - 1) onChange?.(months[idx + 1].value);
	}

	function goBack() {
		const idx = months.findIndex(m => m.value === selectedMonth);
		if (idx > 0) onChange?.(months[idx - 1].value);
	}
</script>

<div class="month-picker">
	<button
		class="mp-arrow"
		disabled={selectedMonth === months[0]?.value}
		onclick={goBack}
		aria-label="Previous month"
	>
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
			<polyline points="15 18 9 12 15 6"/>
		</svg>
	</button>

	<select
		class="mp-select"
		value={selectedMonth}
		onchange={(e) => onChange?.((e.target as HTMLSelectElement).value)}
	>
		{#each months as m (m.value)}
			<option value={m.value} selected={m.value === selectedMonth}>{m.label}</option>
		{/each}
	</select>

	<button
		class="mp-arrow"
		disabled={selectedMonth === months[months.length - 1]?.value}
		onclick={goForward}
		aria-label="Next month"
	>
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
			<polyline points="9 18 15 12 9 6"/>
		</svg>
	</button>
</div>

<style>
	.month-picker {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		background: var(--color-bg);
		padding: 3px;
		border-radius: var(--radius-pill);
		border: 1px solid var(--color-hairline);
	}

	.mp-arrow {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		border-radius: 50%;
		background: transparent;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: all 150ms var(--ease);
		min-height: 36px;
	}

	.mp-arrow:hover:not(:disabled) {
		background: var(--color-teal-bg);
		color: var(--color-teal);
	}

	.mp-arrow:active:not(:disabled) {
		transform: scale(0.9);
	}

	.mp-arrow:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.mp-select {
		padding: 6px 32px 6px 14px;
		border: none;
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		color: var(--color-ink);
		font-family: var(--font-display);
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-bold);
		min-height: 36px;
		appearance: none;
		-webkit-appearance: none;
		cursor: pointer;
		transition: all 150ms var(--ease);
		text-align: center;
	}

	.mp-select:hover {
		background: var(--color-teal-bg);
	}

	.mp-select:focus {
		outline: none;
		box-shadow: var(--focus);
	}
</style>

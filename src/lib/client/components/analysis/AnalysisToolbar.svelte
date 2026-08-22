<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import type { AnalysisPeriod, DateRange } from '$lib/server/services/analysis/analysisTypes';

	let {
		period = '1M',
		startDate = '',
		endDate = '',
		dateRange,
		presetCounts: _presetCounts,
		transactionCount = 0,
	}: {
		period: AnalysisPeriod;
		startDate?: string;
		endDate?: string;
		dateRange?: DateRange;
		presetCounts?: Record<AnalysisPeriod, number>;
		transactionCount?: number;
	} = $props();

	const presetPeriods: Array<{ id: AnalysisPeriod; label: string }> = [
		{ id: '1M', label: '1M' },
		{ id: '3M', label: '3M' },
		{ id: 'YTD', label: 'YTD' },
		{ id: '1Y', label: '1Y' },
		{ id: 'ALL', label: 'ALL' },
	];

	let startVal = $state(startDate || dateRange?.start || '');
	let endVal = $state(endDate || dateRange?.end || '');
	let startInputEl: HTMLInputElement | null = $state(null);
	let endInputEl: HTMLInputElement | null = $state(null);

	$effect(() => {
		if (startDate) startVal = startDate;
		else if (dateRange?.start && !startVal) startVal = dateRange.start;

		if (endDate) endVal = endDate;
		else if (dateRange?.end && !endVal) endVal = dateRange.end;
	});

	function setPeriod(p: AnalysisPeriod) {
		const url = new URL($page.url);
		url.searchParams.set('period', p);
		if (p !== 'CUSTOM') {
			url.searchParams.delete('startDate');
			url.searchParams.delete('endDate');
			goto(url.toString(), { keepFocus: true, noScroll: true });
		} else {
			if (startVal && endVal && startVal <= endVal) {
				url.searchParams.set('startDate', startVal);
				url.searchParams.set('endDate', endVal);
				goto(url.toString(), { keepFocus: true, noScroll: true });
			} else {
				goto(url.toString(), { keepFocus: true, noScroll: true });
			}
		}
	}

	function handleDateChange() {
		if (startVal && endVal && startVal <= endVal) {
			const url = new URL($page.url);
			url.searchParams.set('period', 'CUSTOM');
			url.searchParams.set('startDate', startVal);
			url.searchParams.set('endDate', endVal);
			goto(url.toString(), { keepFocus: true, noScroll: true });
		}
	}

	function openPicker(inputEl: HTMLInputElement | null) {
		if (inputEl && typeof inputEl.showPicker === 'function') {
			try {
				inputEl.showPicker();
			} catch {
				inputEl.focus();
			}
		} else if (inputEl) {
			inputEl.focus();
		}
	}

	const resolvedLabel = $derived.by(() => {
		if (!dateRange || !dateRange.start || !dateRange.end) return '';
		const [sY, sM, sD] = dateRange.start.split('-').map(Number);
		const [eY, eM, eD] = dateRange.end.split('-').map(Number);
		if (!sY || !sM || !sD || !eY || !eM || !eD) return '';

		const startDateObj = new Date(sY, sM - 1, sD);
		const endDateObj = new Date(eY, eM - 1, eD);

		const startMonth = startDateObj.toLocaleDateString('en-US', { month: 'short' });
		const endMonth = endDateObj.toLocaleDateString('en-US', { month: 'short' });

		if (sY === eY) {
			return `${startMonth} ${sD} – ${endMonth} ${eD}, ${eY}`;
		}
		return `${startMonth} ${sD}, ${sY} – ${endMonth} ${eD}, ${eY}`;
	});
</script>

<div class="analysis-toolbar-row">
	<!-- LEFT: Segmented Control [1M | 3M | YTD | 1Y | ALL | ┆ Custom] -->
	<div class="segmented-control" role="radiogroup" aria-label="Analysis timeframe filter">
		{#each presetPeriods as p (p.id)}
			<button
				type="button"
				class="seg-btn"
				class:active={period === p.id}
				onclick={() => setPeriod(p.id)}
			>
				{p.label}
			</button>
		{/each}
		<span class="seg-divider" aria-hidden="true"></span>
		<button
			type="button"
			class="seg-btn seg-btn-custom"
			class:active={period === 'CUSTOM'}
			onclick={() => setPeriod('CUSTOM')}
		>
			Custom
		</button>
	</div>

	<!-- RIGHT: Resolved Range Label OR Custom Date Range Inputs + Tx Count -->
	<div class="toolbar-right-slot">
		{#if period !== 'CUSTOM'}
			<div class="range-display-indicator">
				<svg class="calendar-subtle-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
					<line x1="16" y1="2" x2="16" y2="6"/>
					<line x1="8" y1="2" x2="8" y2="6"/>
					<line x1="3" y1="10" x2="21" y2="10"/>
				</svg>
				<span class="range-text-val">{resolvedLabel}</span>
				<span class="range-tx-summary">· {transactionCount} {transactionCount === 1 ? 'transaction' : 'transactions'}</span>
			</div>
		{:else}
			<div class="custom-inputs-wrap">
				<div class="custom-inputs-row">
					<div class="date-input-pill">
						<input
							bind:this={startInputEl}
							type="date"
							class="native-date-field"
							bind:value={startVal}
							onchange={handleDateChange}
							aria-label="Start Date"
						/>
						<button
							type="button"
							class="cal-icon-btn"
							onclick={() => openPicker(startInputEl)}
							tabindex="-1"
							aria-label="Pick start date"
						>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
								<line x1="16" y1="2" x2="16" y2="6"/>
								<line x1="8" y1="2" x2="8" y2="6"/>
								<line x1="3" y1="10" x2="21" y2="10"/>
							</svg>
						</button>
					</div>

					<span class="range-arrow-sep">→</span>

					<div class="date-input-pill">
						<input
							bind:this={endInputEl}
							type="date"
							class="native-date-field"
							bind:value={endVal}
							onchange={handleDateChange}
							aria-label="End Date"
						/>
						<button
							type="button"
							class="cal-icon-btn"
							onclick={() => openPicker(endInputEl)}
							tabindex="-1"
							aria-label="Pick end date"
						>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
								<line x1="16" y1="2" x2="16" y2="6"/>
								<line x1="8" y1="2" x2="8" y2="6"/>
								<line x1="3" y1="10" x2="21" y2="10"/>
							</svg>
						</button>
					</div>
				</div>
				<span class="range-tx-summary">· {transactionCount} {transactionCount === 1 ? 'transaction' : 'transactions'}</span>
			</div>
		{/if}
	</div>
</div>

<style>
	.analysis-toolbar-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 24px;
		min-height: 38px;
	}

	/* ─── LEFT: Segmented Control ─── */
	.segmented-control {
		display: inline-flex;
		align-items: center;
		background: var(--color-surface, #ffffff);
		border: 1px solid var(--color-hairline, rgba(20, 48, 46, 0.08));
		border-radius: var(--radius-pill, 9999px);
		padding: 3px;
		box-shadow: 0 1px 3px rgba(20, 48, 46, 0.04);
		height: 38px;
		box-sizing: border-box;
	}

	.seg-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 30px;
		padding: 0 14px;
		border-radius: var(--radius-pill, 9999px);
		border: none;
		outline: none;
		background: transparent;
		color: var(--color-text-subtitle, #5c7a78);
		font-family: inherit;
		font-size: 0.8125rem;
		font-weight: 600;
		cursor: pointer;
		transition: color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
		white-space: nowrap;
	}

	.seg-btn:focus-visible {
		outline: 2px solid var(--color-teal-base, #2ba8a2);
	}

	.seg-btn:hover:not(.active) {
		color: var(--color-text-title, #14302e);
		background: rgba(20, 48, 46, 0.04);
	}

	.seg-btn.active {
		background: var(--color-teal-base, #2ba8a2);
		color: #ffffff;
		font-weight: 700;
		box-shadow: 0 1px 4px rgba(43, 168, 162, 0.28);
	}

	.seg-divider {
		width: 1px;
		height: 14px;
		background: var(--color-hairline, rgba(20, 48, 46, 0.12));
		margin: 0 2px;
		flex-shrink: 0;
	}

	/* ─── RIGHT: Slot ─── */
	.toolbar-right-slot {
		display: flex;
		align-items: center;
		height: 38px;
	}

	/* Preset Active: Lightweight Contextual Indicator */
	.range-display-indicator {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-text-subtitle, #5c7a78);
		padding: 4px 8px;
		user-select: none;
	}

	.calendar-subtle-icon {
		color: var(--color-text-subtitle, #5c7a78);
		opacity: 0.7;
		flex-shrink: 0;
	}

	.range-text-val {
		font-feature-settings: 'tnum';
		letter-spacing: -0.01em;
	}

	.range-tx-summary {
		font-size: 0.8125rem;
		color: var(--color-text-subtitle, #5c7a78);
		opacity: 0.85;
		white-space: nowrap;
		font-feature-settings: 'tnum';
	}

	/* Custom Active: Equal Width Date Inputs */
	.custom-inputs-wrap {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		animation: fadeIn 0.18s ease-out;
	}

	.custom-inputs-row {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateX(4px); }
		to { opacity: 1; transform: translateX(0); }
	}

	.date-input-pill {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: space-between;
		width: 135px;
		height: 38px;
		background: var(--color-surface, #ffffff);
		border: 1px solid var(--color-hairline, rgba(20, 48, 46, 0.12));
		border-radius: var(--radius-pill, 9999px);
		padding: 0 10px 0 12px;
		box-sizing: border-box;
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
	}

	.date-input-pill:hover {
		border-color: rgba(20, 48, 46, 0.22);
	}

	.date-input-pill:focus-within {
		border-color: var(--color-teal-base, #2ba8a2);
		box-shadow: 0 0 0 2px rgba(43, 168, 162, 0.2);
	}

	.native-date-field {
		border: none;
		outline: none;
		background: transparent;
		font-family: inherit;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-text-title, #14302e);
		width: 100%;
		cursor: pointer;
		font-feature-settings: 'tnum';
		padding: 0;
	}

	/* Hide default webkit picker icon while keeping native picker accessible */
	.native-date-field::-webkit-calendar-picker-indicator {
		opacity: 0;
		width: 14px;
		cursor: pointer;
		position: absolute;
		right: 8px;
	}

	.cal-icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		padding: 0;
		color: var(--color-text-subtitle, #5c7a78);
		opacity: 0.75;
		cursor: pointer;
		border-radius: 4px;
		flex-shrink: 0;
		transition: color 0.15s ease, opacity 0.15s ease;
	}

	.cal-icon-btn:hover {
		color: var(--color-teal-base, #2ba8a2);
		opacity: 1;
	}

	.range-arrow-sep {
		font-size: 0.875rem;
		color: var(--color-text-subtitle, #5c7a78);
		opacity: 0.6;
		user-select: none;
		padding: 0 2px;
	}

	@media (max-width: 640px) {
		.analysis-toolbar-row {
			flex-direction: column;
			align-items: flex-start;
			gap: 12px;
			height: auto;
		}

		.toolbar-right-slot {
			width: 100%;
			height: auto;
		}

		.custom-inputs-wrap {
			width: 100%;
			justify-content: flex-start;
		}

		.date-input-pill {
			width: 130px;
		}
	}
</style>



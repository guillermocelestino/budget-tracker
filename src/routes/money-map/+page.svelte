<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { getMonthLabel } from '$lib/shared/utils/format';
	import PageHeader from '$lib/client/components/PageHeader.svelte';
	import PageBackground from '$lib/client/components/PageBackground.svelte';
	import MoneyMap, { type MoneyMapData } from '$lib/client/components/money-map/MoneyMap.svelte';
	import MoneyMapLegend from '$lib/client/components/money-map/MoneyMapLegend.svelte';

	let data = $derived($page.data as App.PageData);

	const selectedMonth = $derived(data.month ?? new Date().toISOString().slice(0, 7));

	function changeMonth(delta: number) {
		const [y, m] = selectedMonth.split('-').map(Number);
		const newDate = new Date(y, m - 1 + delta, 1);
		const yearStr = newDate.getFullYear();
		const monthStr = String(newDate.getMonth() + 1).padStart(2, '0');
		goto(`/money-map?year=${yearStr}&month=${yearStr}-${monthStr}`);
	}
</script>

<svelte:head>
	<title>Money Map — WRECKRD</title>
	<meta name="description" content="Trace where your money came from, where it went, and what is still in motion in an interactive financial flow network." />
</svelte:head>

<PageBackground />

<div class="money-map-page fade-in-up">
	<PageHeader title="WHERE IS MY MONEY GOING?">
		{#snippet badge()}
			<div class="header-badge teal">
				<span class="badge-icon">🗺</span>
				<span class="badge-text">MONEY MAP</span>
			</div>
		{/snippet}
		{#snippet subtitle()}
			<p class="header-desc">
				Trace where your money came from, where it went, and what is still in motion.
			</p>
		{/snippet}

		{#snippet action()}
			<div class="month-selector-pill">
				<button class="month-nav-btn" onclick={() => changeMonth(-1)} aria-label="Previous month">‹</button>
				<span class="month-display-label">{getMonthLabel(selectedMonth)}</span>
				<button class="month-nav-btn" onclick={() => changeMonth(1)} aria-label="Next month">›</button>
			</div>
		{/snippet}
	</PageHeader>

	<!-- Main Interactive Money Map Canvas -->
	<section class="map-section" aria-label="Interactive Financial Ecosystem Map">
		<MoneyMap data={data as MoneyMapData} />
	</section>

	<!-- Bottom Color Legend -->
	<section class="legend-section">
		<MoneyMapLegend />
	</section>
</div>

<style>
	.money-map-page {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		padding-bottom: var(--space-2xl);
	}

	.header-badge.teal {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 3px 10px;
		background: var(--color-teal-bg, rgba(30, 140, 134, 0.12));
		border-radius: var(--radius-pill, 999px);
		width: fit-content;
		margin-bottom: 4px;
	}

	.header-badge.teal .badge-text {
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 800;
		color: var(--color-true-position, #1E8C86);
		letter-spacing: 0.12em;
	}

	.header-desc {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	.month-selector-pill {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 8px;
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-pill);
		box-shadow: var(--shadow-sm);
	}

	.month-nav-btn {
		background: none;
		border: none;
		color: var(--color-text);
		font-size: 16px;
		font-weight: var(--font-weight-bold);
		cursor: pointer;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 150ms ease;
	}

	.month-nav-btn:hover {
		background: var(--color-teal-bg);
		color: var(--color-teal);
	}

	.month-display-label {
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-bold);
		color: var(--color-text);
		padding: 0 6px;
		white-space: nowrap;
	}

	.map-section {
		width: 100%;
	}

	.legend-section {
		margin-top: var(--space-xs);
	}
</style>

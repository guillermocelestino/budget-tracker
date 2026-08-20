<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { getMonthLabel } from '$lib/shared/utils/format';
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

<div class="page-container page-container--workspace">
	<!-- ═══════════════════════════════════════════════════════════════════════════
       MONEY MAP HERO HEADER (Flip7 Golden Template Alignment)
       ═══════════════════════════════════════════════════════════════════════════ -->
	<header class="money-map-hero flip7-card accent-teal">
		<div class="hero-left">
			<div class="hero-badge">
				<span class="badge-icon">🗺</span>
				<span class="badge-text">MONEY MAP</span>
			</div>
			<h1 class="hero-title">WHERE IS MY MONEY GOING?</h1>
			<p class="hero-subtitle">Trace where your money came from, where it went, and what is still in motion.</p>
		</div>
		<div class="hero-actions">
			<div class="month-selector-pill">
				<button class="month-nav-btn" onclick={() => changeMonth(-1)} aria-label="Previous month">‹</button>
				<span class="month-display-label">{getMonthLabel(selectedMonth)}</span>
				<button class="month-nav-btn" onclick={() => changeMonth(1)} aria-label="Next month">›</button>
			</div>
		</div>
	</header>

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
	/* ─── MONEY MAP HERO HEADER (Flip7 Golden Template Alignment) ─── */
	.money-map-hero {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-lg, 16px);
		padding: 18px 24px;
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: 24px;
		box-shadow: var(--shadow-sm);
		margin-bottom: var(--space-md, 12px);
		overflow: visible;
	}

	.hero-left {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.hero-badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 3px 10px;
		background: var(--color-teal-bg, rgba(43, 168, 162, 0.12));
		border-radius: var(--radius-pill, 999px);
		width: fit-content;
		margin-bottom: 2px;
	}

	.badge-icon {
		font-size: 12px;
		line-height: 1;
	}

	.badge-text {
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 800;
		color: var(--color-true-position, var(--color-teal-dark, #1E8C86));
		letter-spacing: 0.12em;
	}

	.hero-title {
		font-family: var(--font-display);
		font-size: clamp(20px, 2.4vw, 26px);
		font-weight: 800;
		color: var(--color-ink);
		margin: 0;
		letter-spacing: -0.02em;
		line-height: 1.15;
	}

	.hero-subtitle {
		font-size: var(--font-size-sm, 14px);
		color: var(--color-text-muted);
		margin: 2px 0 0 0;
	}

	.hero-actions {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-shrink: 0;
	}

	/* ─── Month Selector Control ─── */
	.month-selector-pill {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		min-height: 44px;
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-pill, 999px);
		box-shadow: var(--shadow-sm);
	}

	.month-nav-btn {
		background: none;
		border: none;
		color: var(--color-ink);
		font-size: 18px;
		font-weight: var(--font-weight-bold);
		cursor: pointer;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 150ms ease, color 150ms ease;
		-webkit-tap-highlight-color: transparent;
	}

	.month-nav-btn:hover {
		background: var(--color-teal-bg);
		color: var(--color-teal);
	}

	.month-display-label {
		font-family: var(--font-display);
		font-size: 13px;
		font-weight: 700;
		color: var(--color-ink);
		padding: 0 8px;
		white-space: nowrap;
	}

	.map-section {
		width: 100%;
		margin-top: var(--space-md);
	}

	.legend-section {
		margin-top: var(--space-xs);
	}

	@media (max-width: 640px) {
		.money-map-hero {
			flex-direction: column;
			align-items: flex-start;
			gap: var(--space-md);
			padding: 16px 20px;
		}

		.hero-actions {
			width: 100%;
		}

		.month-selector-pill {
			width: 100%;
			justify-content: space-between;
		}
	}
</style>

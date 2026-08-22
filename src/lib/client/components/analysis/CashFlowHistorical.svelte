<script lang="ts">
	import '$lib/client/utils/chart';
	import { Bar } from 'svelte-chartjs';
	import { formatCurrency } from '$lib/client/utils/format';
	import type { CashFlowData } from '$lib/server/services/analysis/analysisTypes';
	import type { ChartData, ChartOptions } from 'chart.js';

	let { cashFlow }: { cashFlow: CashFlowData } = $props();

	let isDark = $state(false);

	$effect(() => {
		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		isDark = mq.matches;
		const handler = (e: MediaQueryListEvent) => (isDark = e.matches);
		mq.addEventListener('change', handler);
		return () => mq.removeEventListener('change', handler);
	});

	const incomeColor = $derived(isDark ? '#3CC4BD' : '#2BA8A2');
	const outflowColor = $derived(isDark ? '#FF8A6A' : '#EF6C4A');
	const gridColor = $derived(isDark ? 'rgba(255,255,255,0.06)' : 'rgba(20,48,46,0.06)');

	const chartData = $derived<ChartData<'bar'>>({
		labels: cashFlow.historicalLabels,
		datasets: [
			{
				label: 'Money In',
				data: cashFlow.historicalIncome,
				backgroundColor: incomeColor,
				borderRadius: 6,
			},
			{
				label: 'Money Out',
				data: cashFlow.historicalOutflow,
				backgroundColor: outflowColor,
				borderRadius: 6,
			},
		],
	});

	const options = $derived<ChartOptions<'bar'>>({
		responsive: true,
		maintainAspectRatio: false,
		interaction: { mode: 'index', intersect: false },
		plugins: {
			legend: { display: true, position: 'top', align: 'end' },
			tooltip: {
				callbacks: {
					label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
				},
			},
		},
		scales: {
			x: {
				grid: { display: false },
			},
			y: {
				grid: { color: gridColor },
				ticks: {
					callback: (v) => formatCurrency(Number(v)),
				},
			},
		},
	});
</script>

<div class="cash-flow-card">
	<div class="card-header">
		<div>
			<h3 class="card-title">Cash Flow (Money In vs Money Out)</h3>
			<p class="card-subtitle">6-Month historical trend</p>
		</div>

		{#if cashFlow.outflowRatio !== null}
			<div class="ratio-badge">
				<span class="ratio-label">Outflow Ratio</span>
				<span class="ratio-val">{cashFlow.outflowRatio}%</span>
			</div>
		{/if}
	</div>

	{#if cashFlow.outflowRatio !== null}
		<div class="ratio-explainer">
			Money Out represents <strong>{cashFlow.outflowRatio}%</strong> of Money In during this period.
		</div>
	{/if}

	<div class="chart-container">
		<Bar data={chartData} {options} />
	</div>
</div>

<style>
	.cash-flow-card {
		background: var(--color-surface, #ffffff);
		border: 1px solid var(--color-hairline, rgba(20, 48, 46, 0.08));
		border-radius: var(--radius-lg, 16px);
		padding: 20px;
		box-shadow: var(--shadow-card, 0 2px 8px rgba(0, 0, 0, 0.04));
		margin-bottom: 24px;
	}

	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 12px;
	}

	.card-title {
		font-size: 1.125rem;
		font-weight: 800;
		color: var(--color-text-title, #14302e);
		margin: 0;
	}

	.card-subtitle {
		font-size: 0.8125rem;
		color: var(--color-text-subtitle, #5c7a78);
		margin: 2px 0 0 0;
	}

	.ratio-badge {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		background: rgba(20, 48, 46, 0.04);
		padding: 4px 10px;
		border-radius: var(--radius-md, 8px);
	}

	.ratio-label {
		font-size: 0.6875rem;
		font-weight: 700;
		color: var(--color-text-subtitle, #5c7a78);
		text-transform: uppercase;
	}

	.ratio-val {
		font-size: 1rem;
		font-weight: 800;
		color: var(--color-text-title, #14302e);
	}

	.ratio-explainer {
		font-size: 0.8125rem;
		color: var(--color-text-subtitle, #5c7a78);
		margin-bottom: 16px;
	}

	.chart-container {
		height: 260px;
		width: 100%;
		position: relative;
	}
</style>

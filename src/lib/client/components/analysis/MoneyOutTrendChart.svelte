<script lang="ts">
	import '$lib/client/utils/chart';
	import { Line } from 'svelte-chartjs';
	import { formatCurrency } from '$lib/client/utils/format';
	import type { MoneyOutTrendData } from '$lib/server/services/analysis/analysisTypes';
	import type { ChartData, ChartOptions } from 'chart.js';

	let { trend }: { trend: MoneyOutTrendData } = $props();

	let isDark = $state(false);

	$effect(() => {
		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		isDark = mq.matches;
		const handler = (e: MediaQueryListEvent) => (isDark = e.matches);
		mq.addEventListener('change', handler);
		return () => mq.removeEventListener('change', handler);
	});

	const mainColor = $derived(isDark ? '#FF8A6A' : '#EF6C4A');
	const gridColor = $derived(isDark ? 'rgba(255,255,255,0.06)' : 'rgba(20,48,46,0.06)');

	const chartData = $derived<ChartData<'line'>>({
		labels: trend.labels,
		datasets: [
			{
				label: 'Money Out',
				data: trend.currentData,
				borderColor: mainColor,
				backgroundColor: isDark ? 'rgba(255,138,106,0.12)' : 'rgba(239,108,74,0.08)',
				tension: 0.35,
				fill: true,
				pointRadius: trend.labels.length > 30 ? 0 : 3,
				pointHoverRadius: 6,
				borderWidth: 2.5,
			},
		],
	});

	const options = $derived<ChartOptions<'line'>>({
		responsive: true,
		maintainAspectRatio: false,
		interaction: { mode: 'index', intersect: false },
		plugins: {
			legend: { display: false },
			tooltip: {
				callbacks: {
					label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
				},
			},
		},
		scales: {
			x: {
				grid: { display: false },
				ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 },
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


<div class="trend-card">
	<div class="card-header">
		<div>
			<h3 class="card-title">Money Out Over Time</h3>
			<p class="card-subtitle">Granularity: {trend.granularity}</p>
		</div>
	</div>
	<div class="chart-container">
		<Line data={chartData} {options} />
	</div>
</div>

<style>
	.trend-card {
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
		margin-bottom: 16px;
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
		text-transform: capitalize;
	}

	.chart-container {
		height: 280px;
		width: 100%;
		position: relative;
	}
</style>

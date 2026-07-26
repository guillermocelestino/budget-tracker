<script lang="ts">
	import { onMount } from 'svelte';
	import '$lib/utils/chart';
	import { Bar } from 'svelte-chartjs';
	import { formatCurrency } from '$lib/utils/format';

	let {
		labels = [],
		incomeData = [],
		expenseData = [],
		trendIncome,
		trendExpense,
		showTrend = false,
	}: {
		labels: string[];
		incomeData: number[];
		expenseData: number[];
		trendIncome?: number[];
		trendExpense?: number[];
		showTrend?: boolean;
	} = $props();

	let isDark = $state(false);

	onMount(() => {
		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		isDark = mq.matches;
		mq.addEventListener('change', (e) => isDark = e.matches);
		return () => mq.removeEventListener('change', () => {});
	});

	const chartData = $derived({
		labels,
		datasets: [
			{
				label: 'Income',
				data: incomeData,
				backgroundColor: '#10b981',
				borderRadius: 6,
				order: 2,
			},
			{
				label: 'Expenses',
				data: expenseData,
				backgroundColor: '#ef4444',
				borderRadius: 6,
				order: 2,
			},
			...(showTrend && trendIncome ? [{
				label: 'Income Trend',
				data: trendIncome,
				type: 'line' as const,
				borderColor: '#10b981',
				borderDash: [6, 3] as [number, number],
				borderWidth: 2,
				pointRadius: 0,
				pointHitRadius: 0,
				fill: false,
				tension: 0.3,
				order: 1,
			}] : []),
			...(showTrend && trendExpense ? [{
				label: 'Expense Trend',
				data: trendExpense,
				type: 'line' as const,
				borderColor: '#ef4444',
				borderDash: [6, 3] as [number, number],
				borderWidth: 2,
				pointRadius: 0,
				pointHitRadius: 0,
				fill: false,
				tension: 0.3,
				order: 0,
			}] : []),
		],
	});

	const chartOptions = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: {
				position: 'top' as const,
				labels: {
					color: isDark ? '#e5e7eb' : '#374151',
				},
			},
			tooltip: {
				callbacks: {
					label: (ctx: { parsed: { y: number }; dataset: { label: string } }) =>
						`${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
				},
			},
		},
		scales: {
			x: {
				ticks: {
					color: isDark ? '#9ca3af' : '#6b7280',
				},
				grid: {
					color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
				},
			},
			y: {
				beginAtZero: true,
				ticks: {
					color: isDark ? '#9ca3af' : '#6b7280',
					callback: (value: number | string) => formatCurrency(Number(value)),
				},
				grid: {
					color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
				},
			},
		},
	};
</script>

<div class="chart-container">
	{#if labels.length > 0}
		<Bar data={chartData} options={chartOptions} />
	{:else}
		<div class="chart-empty">No data available for this period</div>
	{/if}
</div>

<style>
	.chart-container {
		position: relative;
		height: 300px;
		width: 100%;
	}

	.chart-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--color-text-secondary);
		font-style: italic;
	}
</style>

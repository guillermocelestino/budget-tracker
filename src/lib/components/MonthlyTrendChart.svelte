<script lang="ts">
	import { onMount } from 'svelte';
	import '$lib/utils/chart';
	import { Line } from 'svelte-chartjs';
	import { formatCurrency } from '$lib/utils/format';

	let {
		labels = [],
		incomeData = [],
		expenseData = [],
	}: {
		labels: string[];
		incomeData: number[];
		expenseData: number[];
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
				borderColor: '#10b981',
				backgroundColor: 'rgba(16, 185, 129, 0.1)',
				tension: 0.4,
				fill: true,
				pointRadius: 3,
				borderWidth: 2,
			},
			{
				label: 'Expenses',
				data: expenseData,
				borderColor: '#ef4444',
				backgroundColor: 'rgba(239, 68, 68, 0.1)',
				tension: 0.4,
				fill: true,
				pointRadius: 3,
				borderWidth: 2,
			},
		],
	});

	const chartOptions = $derived({
		responsive: true,
		maintainAspectRatio: false,
		interaction: { intersect: false, mode: 'index' as const },
		plugins: {
			legend: {
				position: 'bottom' as const,
				labels: {
					color: isDark ? '#e5e7eb' : '#374151',
					padding: 20,
					usePointStyle: true,
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
				grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)' },
				ticks: { color: isDark ? '#9ca3af' : '#6b7280' },
			},
			y: {
				grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)' },
				ticks: {
					color: isDark ? '#9ca3af' : '#6b7280',
					callback: (val: number) => `₱${val.toLocaleString()}`,
				},
			},
		},
	});
</script>

<div class="chart-container">
	{#if labels.length > 0}
		<Line data={chartData} options={chartOptions} />
	{:else}
		<div class="empty">No data available</div>
	{/if}
</div>

<style>
	.chart-container {
		position: relative;
		height: 280px;
		width: 100%;
	}

	.empty {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--color-text-secondary);
		font-style: italic;
	}
</style>

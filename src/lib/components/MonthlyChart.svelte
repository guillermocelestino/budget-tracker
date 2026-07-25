<script lang="ts">
	import '$lib/utils/chart';
	import { Bar } from 'svelte-chartjs';
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

	const chartData = $derived({
		labels,
		datasets: [
			{
				label: 'Income',
				data: incomeData,
				backgroundColor: '#10b981',
				borderRadius: 6,
			},
			{
				label: 'Expenses',
				data: expenseData,
				backgroundColor: '#ef4444',
				borderRadius: 6,
			},
		],
	});

	const chartOptions = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: {
				position: 'top' as const,
			},
			tooltip: {
				callbacks: {
					label: (ctx: { parsed: { y: number }; dataset: { label: string } }) =>
						`${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
				},
			},
		},
		scales: {
			y: {
				beginAtZero: true,
				ticks: {
					callback: (value: number | string) => formatCurrency(Number(value)),
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

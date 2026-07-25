<script lang="ts">
	import '$lib/utils/chart';
	import { Doughnut } from 'svelte-chartjs';
	import { formatCurrency } from '$lib/utils/format';

	let {
		labels = [],
		data = [],
		colors = [],
	}: {
		labels: string[];
		data: number[];
		colors: string[];
	} = $props();

	const chartData = $derived({
		labels,
		datasets: [
			{
				data,
				backgroundColor: colors,
				borderWidth: 2,
				borderColor: '#ffffff',
			},
		],
	});

	const chartOptions = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: {
				position: 'right' as const,
			},
			tooltip: {
				callbacks: {
					label: (ctx: { parsed: number; label: string }) => {
						const total = (ctx as unknown as { dataset: { data: number[] }; dataIndex: number }).dataset.data.reduce((a: number, b: number) => a + b, 0);
						const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : '0';
						return `${ctx.label}: ${formatCurrency(ctx.parsed)} (${pct}%)`;
					},
				},
			},
		},
	};
</script>

<div class="chart-container">
	{#if data.length > 0 && data.some(v => v > 0)}
		<Doughnut data={chartData} options={chartOptions} />
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

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

	const incomeBarColor = $derived(isDark ? '#3CC4BD' : '#2BA8A2');
	const expenseBarColor = $derived(isDark ? '#FF8A6A' : '#EF6C4A');
	const tickColor = $derived(isDark ? '#8FB3B0' : '#5C7A78');

	const chartData = $derived({
		labels,
		datasets: [
			{
				label: 'Income',
				data: incomeData,
				backgroundColor: incomeBarColor,
				borderRadius: 8,
				order: 2,
			},
			{
				label: 'Expenses',
				data: expenseData,
				backgroundColor: expenseBarColor,
				borderRadius: 8,
				order: 2,
			},
			...(showTrend && trendIncome ? [{
				label: 'Income Trend',
				data: trendIncome,
				type: 'line' as const,
				borderColor: incomeBarColor,
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
				borderColor: expenseBarColor,
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
		animation: { duration: 1200, easing: 'easeOutQuart' as const },
		plugins: {
			legend: {
				position: 'top' as const,
				labels: {
					color: isDark ? '#EAF7F5' : '#14302E',
					font: { weight: 'bold' as const },
				},
			},
			tooltip: {
				backgroundColor: '#F0F9F8',
				titleColor: '#14302E',
				bodyColor: '#5C7A78',
				borderColor: 'rgba(20,48,46,0.12)',
				borderWidth: 1,
				padding: 12,
				cornerRadius: 12,
				callbacks: {
					label: (ctx: { parsed: { y: number }; dataset: { label: string } }) =>
						`${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
				},
			},
		},
		scales: {
			x: {
				ticks: {
					color: tickColor,
				},
				grid: { display: false },
			},
			y: {
				beginAtZero: true,
				ticks: {
					color: tickColor,
					callback: (value: number | string) => formatCurrency(Number(value)),
				},
				grid: { display: false },
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
		animation: fade-in-up 600ms var(--ease) both;
	}

	.chart-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--color-text-muted);
		font-style: italic;
	}
</style>

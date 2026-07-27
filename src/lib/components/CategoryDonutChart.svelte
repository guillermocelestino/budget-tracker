<script lang="ts">
	import { onMount } from 'svelte';
	import '$lib/utils/chart';
	import { Doughnut } from 'svelte-chartjs';
	import { formatCurrency } from '$lib/utils/format';

	let {
		labels = [],
		data = [],
	}: {
		labels: string[];
		data: number[];
	} = $props();

	let isDark = $state(false);

	onMount(() => {
		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		isDark = mq.matches;
		mq.addEventListener('change', (e) => isDark = e.matches);
		return () => mq.removeEventListener('change', () => {});
	});

	const backgroundColors = [
		'#4f46e5', '#ec4899', '#10b981', '#f59e0b', '#6366f1',
		'#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#ef4444',
	];

	const chartData = $derived({
		labels,
		datasets: [{
			data,
			backgroundColor: backgroundColors.slice(0, Math.max(labels.length, 1)),
			borderWidth: 2,
			borderColor: isDark ? '#1f2937' : '#ffffff',
		}],
	});

	const chartOptions = $derived({
		responsive: true,
		maintainAspectRatio: false,
		cutout: '60%',
		plugins: {
			legend: {
				position: 'right' as const,
				labels: {
					color: isDark ? '#e5e7eb' : '#374151',
					padding: 15,
					usePointStyle: true,
				},
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
	});
</script>

<div class="chart-container">
	{#if data.length > 0 && data.some(v => v > 0)}
		<Doughnut data={chartData} options={chartOptions} />
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

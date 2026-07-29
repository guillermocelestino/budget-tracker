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
		'#2BA8A2', '#FFD23F', '#EF6C4A', '#5DADE2', '#27AE60',
		'#E74C3C', '#3CC4BD', '#FFE47A', '#FF8A6A', '#6FC0F0',
	];

	const total = $derived(data.reduce((a, b) => a + b, 0));

	const chartData = $derived({
		labels,
		datasets: [{
			data,
			backgroundColor: backgroundColors.slice(0, Math.max(labels.length, 1)),
			borderWidth: 2,
			borderColor: isDark ? '#14302E' : '#FFFFFF',
		}],
	});

	const chartOptions = $derived({
		responsive: true,
		maintainAspectRatio: false,
		cutout: '65%',
		plugins: {
			legend: {
				position: 'right' as const,
				labels: {
					color: isDark ? '#EAF7F5' : '#14302E',
					padding: 15,
					usePointStyle: true,
					font: { size: 12, weight: 'bold' as const },
				},
			},
			tooltip: {
				backgroundColor: '#FFF8E7',
				titleColor: '#14302E',
				bodyColor: '#5C7A78',
				borderColor: 'rgba(20,48,46,0.12)',
				borderWidth: 1,
				padding: 12,
				cornerRadius: 12,
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
		<div class="donut-wrapper">
			<Doughnut data={chartData} options={chartOptions} />
			<div class="center-total">
				<span class="center-label">Total</span>
				<span class="center-value">{formatCurrency(total)}</span>
			</div>
		</div>
	{:else}
		<div class="empty">No data available</div>
	{/if}
</div>

<style>
	.chart-container {
		position: relative;
		height: 280px;
		width: 100%;
		animation: fade-in-up 600ms var(--ease) both;
	}

	.donut-wrapper {
		position: relative;
		height: 100%;
		width: 100%;
		filter: drop-shadow(var(--glow-card));
	}

	.donut-wrapper > :global(canvas) {
		height: 100% !important;
		width: 100% !important;
	}

	.center-total {
		position: absolute;
		top: 50%;
		left: 28%;
		transform: translate(-50%, -50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		pointer-events: none;
	}

	.center-label {
		font-size: var(--font-size-xs);
		font-weight: 500;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.center-value {
		font-size: var(--font-size-xl);
		font-weight: 800;
		color: var(--color-ink);
		font-family: var(--font-display);
		font-variant-numeric: tabular-nums;
		letter-spacing: var(--letter-spacing-tight);
	}

	.empty {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--color-text-muted);
		font-style: italic;
	}
</style>

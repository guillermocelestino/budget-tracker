<script lang="ts">
	import { formatSignedCurrency } from '$lib/client/utils/format';
	import type { Snippet } from 'svelte';

	type Trend = { text: string; sentiment?: 'positive' | 'negative' };

	let {
		label,
		value,
		tone = 'auto',
		hero = false,
		icon: _icon,
		active = false,
		dimmed = false,
		href,
		onclick,
		ariaPressed,
		trend,
		sparklineData = [],
		className = ''
	}: {
		label: string;
		value: number;
		tone?: 'in' | 'out' | 'auto';
		hero?: boolean;
		icon?: Snippet;
		active?: boolean;
		dimmed?: boolean;
		href?: string;
		onclick?: () => void;
		ariaPressed?: boolean;
		trend?: Trend;
		sparklineData?: number[];
		className?: string;
	} = $props();

	const isIn = $derived(tone === 'in' || (tone === 'auto' && value >= 0));
	const isOut = $derived(tone === 'out' || (tone === 'auto' && value < 0));

	// Unique ID per instance for SVG gradient
	const instanceId = Math.random().toString(36).substring(2, 7);
	const gradientId = $derived(`spark-grad-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${instanceId}`);

	// Smooth fallback trend data points if sparklineData is missing
	const effectiveSparkline = $derived.by(() => {
		if (sparklineData && sparklineData.length >= 2) {
			return sparklineData;
		}
		if (tone === 'in') {
			return [14, 17, 15, 21, 19, 25, 23, 29, 27, 34];
		} else if (tone === 'out') {
			return [28, 26, 29, 24, 26, 21, 23, 19, 21, 16];
		} else {
			return [16, 19, 17, 23, 22, 28, 26, 32, 30, 38];
		}
	});

	const svgPaths = $derived.by(() => {
		const data = effectiveSparkline;
		const width = 200;
		const height = 48;
		const padding = 6;

		if (!data || data.length < 2) return { linePath: '', areaPath: '' };

		const minVal = Math.min(...data);
		const maxVal = Math.max(...data);
		const range = maxVal - minVal || 1;

		const points = data.map((val, i) => {
			const x = (i / (data.length - 1)) * width;
			const y = height - padding - ((val - minVal) / range) * (height - 2 * padding);
			return { x, y };
		});

		let linePath = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

		for (let i = 0; i < points.length - 1; i++) {
			const curr = points[i];
			const next = points[i + 1];
			const prev = points[i - 1] || curr;
			const afterNext = points[i + 2] || next;
			const smoothing = 0.2;

			const cp1x = curr.x + (next.x - prev.x) * smoothing;
			const cp1y = curr.y + (next.y - prev.y) * smoothing;
			const cp2x = next.x - (afterNext.x - curr.x) * smoothing;
			const cp2y = next.y - (afterNext.y - curr.y) * smoothing;

			linePath += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`;
		}

		const last = points[points.length - 1];
		const first = points[0];
		const areaPath = `${linePath} L ${last.x.toFixed(1)} ${height} L ${first.x.toFixed(1)} ${height} Z`;

		return { linePath, areaPath };
	});
</script>

{#snippet cardInner()}
	<div class="card-header">
		<div class="card-label-group">
			{#if _icon}
				<div class="card-icon" class:icon-in={isIn} class:icon-out={isOut}>{@render _icon()}</div>
			{/if}
			<span class="card-label">{label}</span>
		</div>
		{#if trend}
			<span class="card-trend-pill" class:positive={trend.sentiment === 'positive'} class:negative={trend.sentiment === 'negative'}>
				{trend.text}
			</span>
		{/if}
	</div>

	<div class="card-body-row">
		<span class="card-arrow" class:arrow-in={isIn} class:arrow-out={isOut}>
			{#if tone === 'out'}
				↓
			{:else if tone === 'in'}
				↑
			{:else}
				{value >= 0 ? '↑' : '↓'}
			{/if}
		</span>
		<span class="card-amount" class:hero-amount={hero} class:amount-in={isIn} class:amount-out={isOut}>
			{formatSignedCurrency(value)}
		</span>
	</div>

	<div class="card-sparkline-wrap">
		<svg viewBox="0 0 200 48" preserveAspectRatio="none" aria-hidden="true" class="sparkline-svg">
			<defs>
				<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
					<stop
						offset="0%"
						stop-color={isIn ? '#10b981' : isOut ? '#f43f5e' : '#0d9488'}
						stop-opacity="0.25"
					/>
					<stop
						offset="100%"
						stop-color={isIn ? '#10b981' : isOut ? '#f43f5e' : '#0d9488'}
						stop-opacity="0.0"
					/>
				</linearGradient>
			</defs>
			<path d={svgPaths.areaPath} fill="url(#{gradientId})" />
			<path
				d={svgPaths.linePath}
				fill="none"
				stroke={isIn ? '#10b981' : isOut ? '#f43f5e' : '#0d9488'}
				stroke-width="2.5"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
	</div>
{/snippet}

{#if href}
	<a
		{href}
		class="card image-style-card {className}"
		class:active
		class:dimmed
		class:negative={isOut}
	>
		{@render cardInner()}
	</a>
{:else if onclick}
	<button
		type="button"
		class="card image-style-card {className}"
		class:active
		class:dimmed
		class:negative={isOut}
		onclick={onclick}
		aria-pressed={ariaPressed}
	>
		{@render cardInner()}
	</button>
{:else}
	<div class="card image-style-card {className}" class:active class:dimmed class:negative={isOut}>
		{@render cardInner()}
	</div>
{/if}

<style>
	.card {
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 16px 16px 0 16px;
		background: #ffffff;
		border: 1px solid rgba(226, 232, 240, 0.85);
		border-radius: 16px;
		cursor: pointer;
		font-family: var(--font-body, system-ui, -apple-system, sans-serif);
		text-align: left;
		overflow: hidden;
		min-height: 108px;
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.03), 0 1px 2px -1px rgba(0, 0, 0, 0.02);
		transition: all 200ms ease;
		-webkit-tap-highlight-color: transparent;
		text-decoration: none !important;
		color: inherit;
	}

	:global([data-theme="dark"]) .card {
		background: var(--color-surface, #161a18);
		border-color: rgba(51, 65, 85, 0.7);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
	}

	.card:hover,
	.card:hover * {
		text-decoration: none !important;
	}

	.card:hover {
		border-color: rgba(148, 163, 184, 0.8);
		box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.06);
		transform: translateY(-2px);
	}

	:global([data-theme="dark"]) .card:hover {
		border-color: rgba(255, 255, 255, 0.25);
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
	}

	.card:active {
		transform: translateY(0) scale(0.99);
	}

	.card:focus-visible {
		outline: none;
		box-shadow: var(--focus, 0 0 0 2px #0d9488);
	}

	/* ── Top Header Row ── */
	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		z-index: 1;
		margin-bottom: 8px;
	}

	.card-label-group {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.card-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: #64748b;
	}

	.icon-in {
		color: #16a34a;
	}

	.icon-out {
		color: #dc2626;
	}

	:global([data-theme="dark"]) .icon-in {
		color: #4ade80;
	}

	:global([data-theme="dark"]) .icon-out {
		color: #f87171;
	}

	.card-label {
		font-size: 14px;
		font-weight: 500;
		color: #475569;
		letter-spacing: -0.01em;
	}

	:global([data-theme="dark"]) .card-label {
		color: #94a3b8;
	}

	/* ── Trend Pill ── */
	.card-trend-pill {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		padding: 2px 9px;
		border-radius: 9999px;
		font-size: 12px;
		font-weight: 600;
		white-space: nowrap;
		background: #f1f5f9;
		color: #475569;
	}

	.card-trend-pill.positive {
		background: #dcfce7;
		color: #15803d;
	}

	.card-trend-pill.negative {
		background: #fee2e2;
		color: #b91c1c;
	}

	:global([data-theme="dark"]) .card-trend-pill {
		background: rgba(255, 255, 255, 0.08);
		color: #94a3b8;
	}

	:global([data-theme="dark"]) .card-trend-pill.positive {
		background: rgba(34, 197, 94, 0.18);
		color: #4ade80;
	}

	:global([data-theme="dark"]) .card-trend-pill.negative {
		background: rgba(244, 63, 94, 0.18);
		color: #fb7185;
	}

	/* ── Main Value Row ── */
	.card-body-row {
		display: flex;
		align-items: center;
		gap: 6px;
		z-index: 1;
		margin-bottom: 8px;
	}

	.card-arrow {
		font-size: 20px;
		font-weight: 700;
		line-height: 1;
	}

	.arrow-in {
		color: #16a34a;
	}

	.arrow-out {
		color: #dc2626;
	}

	:global([data-theme="dark"]) .arrow-in {
		color: #4ade80;
	}

	:global([data-theme="dark"]) .arrow-out {
		color: #f87171;
	}

	.card-amount {
		font-family: var(--font-display, system-ui, sans-serif);
		font-size: 22px;
		font-weight: 700;
		line-height: 1.15;
		letter-spacing: -0.025em;
		font-variant-numeric: tabular-nums;
		color: #0f172a;
		white-space: nowrap;
	}

	.hero-amount {
		font-size: 24px;
		font-weight: 800;
	}

	.amount-in {
		color: #14532d;
	}

	.amount-out {
		color: #7f1d1d;
	}

	:global([data-theme="dark"]) .card-amount {
		color: #f8fafc;
	}

	:global([data-theme="dark"]) .amount-in {
		color: #4ade80;
	}

	:global([data-theme="dark"]) .amount-out {
		color: #f87171;
	}

	/* ── Sparkline Wave Container ── */
	.card-sparkline-wrap {
		width: calc(100% + 32px);
		margin-left: -16px;
		margin-right: -16px;
		margin-top: auto;
		height: 44px;
		overflow: hidden;
		pointer-events: none;
		display: block;
	}

	.sparkline-svg {
		width: 100%;
		height: 100%;
		display: block;
	}

	/* ── Active / Dimmed States ── */
	.card.active {
		border-color: #0d9488;
		box-shadow: 0 0 0 2px rgba(13, 148, 136, 0.25), 0 4px 12px -2px rgba(0, 0, 0, 0.08);
	}

	:global([data-theme="dark"]) .card.active {
		border-color: #2ba8a2;
		background: rgba(43, 168, 162, 0.12);
		box-shadow: 0 0 0 2px rgba(43, 168, 162, 0.35), 0 4px 16px rgba(0, 0, 0, 0.4);
	}

	.card.dimmed {
		opacity: 0.55;
	}

	.card.dimmed:hover {
		opacity: 0.85;
	}
</style>


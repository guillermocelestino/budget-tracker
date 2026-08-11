<script lang="ts">
	let {
		x1,
		y1,
		x2,
		y2,
		type = 'expense',
		amount = 0,
		maxAmount = 10000,
		isHighlighted = false,
		isDimmed = false
	}: {
		x1: number;
		y1: number;
		x2: number;
		y2: number;
		type?: 'income' | 'expense' | 'net' | 'lending' | 'recurring';
		amount?: number;
		maxAmount?: number;
		isHighlighted?: boolean;
		isDimmed?: boolean;
	} = $props();

	// Calculate smooth organic Bezier control points
	const dx = $derived(x2 - x1);
	const dy = $derived(y2 - y1);

	// Curved offsets for organic graph aesthetic
	const cx1 = $derived(x1 + dx * 0.45);
	const cy1 = $derived(y1 + dy * 0.1);
	const cx2 = $derived(x1 + dx * 0.55);
	const cy2 = $derived(y2 - dy * 0.1);

	const pathD = $derived(`M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`);

	// Dynamic stroke-width based on amount
	const strokeWidth = $derived(
		Math.min(6, Math.max(2.5, 2.5 + (amount / (maxAmount || 1)) * 3.5))
	);

	function getColor(t: typeof type): string {
		switch (t) {
			case 'income':
				return '#2BA8A2'; // Teal
			case 'expense':
				return '#EF6C4A'; // Coral
			case 'net':
				return '#FFD23F'; // Gold
			case 'lending':
				return '#5DADE2'; // Sky Blue
			case 'recurring':
				return '#3CC4BD'; // Light Teal
			default:
				return '#2BA8A2';
		}
	}

	const strokeColor = $derived(getColor(type));
	const pathId = $derived(`path-${Math.round(x1)}-${Math.round(y1)}-${Math.round(x2)}-${Math.round(y2)}`);
</script>

<g class="money-connection" class:highlighted={isHighlighted} class:dimmed={isDimmed}>
	<!-- Glow backdrop line for highlighted state -->
	{#if isHighlighted}
		<path
			d={pathD}
			fill="none"
			stroke={strokeColor}
			stroke-width={strokeWidth + 4}
			stroke-linecap="round"
			opacity="0.35"
			style="filter: blur(4px);"
		/>
	{/if}

	<!-- Main curved Bezier path -->
	<path
		id={pathId}
		d={pathD}
		fill="none"
		stroke={strokeColor}
		stroke-width={strokeWidth}
		stroke-dasharray="6,4"
		stroke-linecap="round"
		class="flow-path"
	/>

	<!-- Animated money particle along the flow curve -->
	{#if !isDimmed}
		<circle r={isHighlighted ? 4 : 3} fill={strokeColor} class="particle">
			<animateMotion
				path={pathD}
				dur={type === 'income' ? '3.5s' : '4.5s'}
				repeatCount="indefinite"
				rotate="auto"
			/>
		</circle>
	{/if}
</g>

<style>
	.money-connection {
		transition: opacity 200ms ease;
		opacity: 0.65;
	}

	.money-connection.highlighted {
		opacity: 1;
		z-index: 10;
	}

	.money-connection.dimmed {
		opacity: 0.15;
	}

	.flow-path {
		animation: dashFlow 25s linear infinite;
	}

	@keyframes dashFlow {
		to {
			stroke-dashoffset: -200;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.flow-path {
			animation: none;
		}
		.particle {
			display: none;
		}
	}
</style>

<script lang="ts">
	import { formatSignedCurrency } from '$lib/utils/format';

	let {
		label,
		count,
		subtotal,
		sticky = true
	}: {
		label: string;
		count: number;
		subtotal: number;
		sticky?: boolean;
	} = $props();
</script>

<div class="date-header" role="rowheader" class:sticky>
	<span class="date-label">{label}</span>
	<span class="date-dot" aria-hidden="true">·</span>
	<span class="date-count">{count} {count === 1 ? 'Transaction' : 'Transactions'}</span>
	<span class="day-subtotal" class:positive={subtotal >= 0} class:negative={subtotal < 0}>
		{formatSignedCurrency(subtotal)}
	</span>
</div>

<style>
	/* Solid mint date band — the shared list-page grouping header. No dashed
	   edge; the band itself separates days. */
	.date-header {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		background: var(--mint-tint);
		border-bottom: none;
	}

	/* Explicit z-index above rows so no seam bleed shows while scrolling. */
	.date-header.sticky {
		position: sticky;
		top: 0;
		z-index: 4;
	}

	.date-label {
		font-family: var(--font-display);
		font-size: var(--font-size-xs);
		font-weight: 700;
		color: var(--teal-deep);
		text-transform: none;
		letter-spacing: 0.02em;
	}

	.date-dot {
		font-size: 11px;
		color: var(--teal-deep);
		opacity: 0.5;
	}

	.date-count {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--muted);
	}

	.day-subtotal {
		margin-left: auto;
		font-family: var(--font-mono);
		font-size: var(--font-size-base);
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.02em;
		white-space: nowrap;
	}

	.day-subtotal.positive {
		color: var(--teal);
	}

	.day-subtotal.negative {
		color: var(--rose);
	}

	/* Mobile (≤480px): inset rounded band to match the card-ized list */
	@media (max-width: 480px) {
		.date-header {
			border-radius: var(--radius-md);
			margin: 0 var(--space-sm);
			padding: var(--space-xs) var(--space-md);
		}
	}
</style>

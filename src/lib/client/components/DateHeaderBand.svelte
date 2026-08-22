<script lang="ts">
	import { formatSignedCurrency } from '$lib/client/utils/format';

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
		/* One token down from base (16px → 14px): still bold + colored, but
		   secondary to the date label so the group reads date → count → subtotal. */
		font-size: var(--font-size-sm);
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

	/* Mobile (<= 640px): simplified transparent date group header */
	@media (max-width: 640px) {
		.date-header {
			background: transparent !important;
			border: none !important;
			border-radius: 0 !important;
			margin: 0 !important;
			padding: 6px 4px 4px !important;
			box-shadow: none !important;
		}

		.date-label {
			font-size: 12px !important;
			font-weight: 700 !important;
			color: var(--color-text-muted, #64748b) !important;
			text-transform: uppercase !important;
			letter-spacing: 0.5px !important;
		}

		.date-dot,
		.date-count {
			display: none !important;
		}

		.day-subtotal {
			font-size: 12px !important;
			font-weight: 600 !important;
			color: var(--color-text-muted, #64748b) !important;
			margin-left: auto !important;
		}
	}
</style>

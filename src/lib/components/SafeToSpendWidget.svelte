<script lang="ts">
	import { formatCurrency } from '$lib/utils/format';

	let {
		income = 0,
		budgeted = 0,
		spentSoFar = 0,
	}: {
		income?: number;
		budgeted?: number;
		spentSoFar?: number;
	} = $props();

	const available = $derived(income - budgeted - spentSoFar);
	const isPositive = $derived(available >= 0);

	// Spending rate vs remaining days (rough heuristic)
	const pctUsed = $derived(
		income > 0 ? Math.min(100, Math.round(((spentSoFar + budgeted) / income) * 100)) : 0
	);
</script>

<div class="safe-spend-widget">
	<div class="ssw-left">
		<div class="ssw-ribbon"></div>
		<div class="ssw-icon">
			<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="12" r="10"/>
				<path d="M12 6v6l4 2"/>
			</svg>
		</div>
		<div class="ssw-info">
			<span class="ssw-label">Available to Spend</span>
			<span class="ssw-value" class:positive={isPositive} class:negative={!isPositive}>
				{isPositive ? '' : '−'}{formatCurrency(Math.abs(available))}
			</span>
		</div>
	</div>
	<div class="ssw-right">
		<div class="ssw-meter">
			<div class="ssw-track">
				<div
					class="ssw-fill"
					class:fill-ok={pctUsed <= 80}
					class:fill-warn={pctUsed > 80 && pctUsed <= 100}
					class:fill-over={pctUsed > 100}
					style="width: {Math.min(pctUsed, 100)}%"
				></div>
			</div>
			<span class="ssw-pct">{pctUsed}% used</span>
		</div>
	</div>
</div>

<style>
	.safe-spend-widget {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-lg);
		padding: var(--space-md) var(--space-lg);
		background: var(--color-cream);
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-card);
		margin-bottom: var(--space-lg);
		position: relative;
		overflow: hidden;
	}

	.ssw-left {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		min-width: 0;
	}

	.ssw-ribbon {
		position: absolute;
		top: 0;
		left: 0;
		width: 4px;
		height: 100%;
		background: linear-gradient(180deg, var(--color-teal), var(--color-gold));
		border-radius: 0 2px 2px 0;
	}

	.ssw-icon {
		width: 44px;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-teal-bg);
		color: var(--color-teal);
		border-radius: var(--radius-md);
		flex-shrink: 0;
	}

	.ssw-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.ssw-label {
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.ssw-value {
		font-family: var(--font-display);
		font-size: var(--font-size-xl);
		font-weight: var(--font-weight-extrabold);
		font-variant-numeric: tabular-nums;
		color: var(--color-ink);
	}

	.ssw-value.positive {
		color: var(--color-teal);
		text-shadow: 0 0 20px rgba(43, 168, 162, 0.2);
	}

	.ssw-value.negative {
		color: var(--color-coral);
		animation: boom-pulse 2s infinite;
	}

	.ssw-right {
		flex-shrink: 0;
		min-width: 120px;
	}

	.ssw-meter {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
	}

	.ssw-track {
		width: 120px;
		height: 8px;
		background: var(--color-hairline);
		border-radius: var(--radius-pill);
		overflow: hidden;
	}

	.ssw-fill {
		height: 100%;
		border-radius: var(--radius-pill);
		transition: width 600ms var(--ease);
	}

	.fill-ok {
		background: linear-gradient(90deg, var(--color-teal), var(--color-teal-light));
	}

	.fill-warn {
		background: linear-gradient(90deg, var(--color-gold-dark), var(--color-gold));
		box-shadow: var(--glow-gold);
	}

	.fill-over {
		background: linear-gradient(90deg, var(--color-coral-dark), var(--color-coral));
		box-shadow: var(--glow-coral);
		animation: boom-pulse 1.5s infinite;
	}

	.ssw-pct {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--color-text-muted);
		font-variant-numeric: tabular-nums;
	}

	@media (max-width: 640px) {
		.safe-spend-widget {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-sm);
		}

		.ssw-right {
			min-width: unset;
		}

		.ssw-meter {
			align-items: stretch;
		}

		.ssw-track {
			width: 100%;
		}
	}
</style>

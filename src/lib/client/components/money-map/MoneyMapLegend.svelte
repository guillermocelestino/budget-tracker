<script lang="ts">
	// Money Map Legend — Flip7 Node Type Indicators
</script>

<div class="money-map-legend" role="region" aria-label="Map Legend">
	<div class="legend-item coral">
		<span class="icon">🔥</span>
		<span class="label">Money Gone</span>
	</div>
	<div class="legend-item sky">
		<span class="icon">🌊</span>
		<span class="label">Money Away</span>
	</div>
	<div class="legend-item gold">
		<span class="icon">🔒</span>
		<span class="label">Money Committed</span>
	</div>
	<div class="legend-item teal">
		<span class="icon">↩</span>
		<span class="label">Money Returning</span>
	</div>
	<div class="legend-item true-pos">
		<span class="icon">🎯</span>
		<span class="label">True Position</span>
	</div>
</div>

<style>
	.money-map-legend {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-md, 12px);
		padding: 8px 16px;
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-pill, 999px);
		box-shadow: var(--shadow-sm);
		width: fit-content;
		margin: 0 auto;
		user-select: none;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 6px;
		font-family: var(--font-display, sans-serif);
		font-size: var(--font-size-xs, 12px);
		font-weight: 700;
		padding: 3px 10px;
		border-radius: var(--radius-pill, 999px);
	}

	.legend-item.coral { background: rgba(239, 108, 74, 0.12); color: var(--color-money-gone, #EF6C4A); }
	.legend-item.sky { background: rgba(93, 173, 226, 0.12); color: var(--color-money-away, #5DADE2); }
	.legend-item.gold { background: rgba(255, 210, 63, 0.15); color: var(--color-money-committed, #D97706); }
	.legend-item.teal { background: rgba(30, 140, 134, 0.12); color: var(--color-money-returning, #1E8C86); }
	.legend-item.true-pos { background: rgba(30, 140, 134, 0.18); color: var(--color-true-position, #1E8C86); }

	.icon {
		font-size: 13px;
	}

	@media (max-width: 600px) {
		.money-map-legend {
			gap: var(--space-xs, 6px);
			padding: 6px 10px;
			flex-wrap: wrap;
		}

		.legend-item {
			font-size: 11px;
			padding: 2px 8px;
		}
	}
</style>

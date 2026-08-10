<script lang="ts">
	// Money Map Legend — Flip7 Node Type Indicators
</script>

<div class="money-map-legend" role="region" aria-label="Map Legend">
	<div class="legend-item">
		<span class="dot dot-net"></span>
		<span class="label">Net Money</span>
	</div>
	<div class="legend-item">
		<span class="dot dot-income"></span>
		<span class="label">Income</span>
	</div>
	<div class="legend-item">
		<span class="dot dot-expense"></span>
		<span class="label">Expenses</span>
	</div>
	<div class="legend-item">
		<span class="dot dot-lending"></span>
		<span class="label">Lending</span>
	</div>
	<div class="legend-item">
		<span class="dot dot-recurring"></span>
		<span class="label">Recurring</span>
	</div>
</div>

<style>
	.money-map-legend {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-md);
		padding: 10px var(--space-lg);
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-pill);
		box-shadow: var(--shadow-sm);
		width: fit-content;
		margin: 0 auto;
		user-select: none;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		color: var(--color-text);
	}

	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.dot-net {
		background: var(--color-gold);
		box-shadow: 0 0 8px rgba(255, 210, 63, 0.6);
	}

	.dot-income {
		background: var(--color-teal);
		box-shadow: 0 0 8px rgba(43, 168, 162, 0.5);
	}

	.dot-expense {
		background: var(--color-coral);
		box-shadow: 0 0 8px rgba(239, 108, 74, 0.5);
	}

	.dot-lending {
		background: var(--color-sky);
		box-shadow: 0 0 8px rgba(93, 173, 226, 0.5);
	}

	.dot-recurring {
		background: var(--color-teal-light);
		box-shadow: 0 0 8px rgba(60, 196, 189, 0.4);
	}

	@media (max-width: 600px) {
		.money-map-legend {
			gap: var(--space-sm);
			padding: 8px var(--space-md);
			flex-wrap: wrap;
		}

		.legend-item {
			font-size: 11px;
		}
	}
</style>

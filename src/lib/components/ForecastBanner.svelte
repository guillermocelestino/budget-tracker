<script lang="ts">
	import { formatCurrency } from '$lib/utils/format';

	let {
		currentBalance = 0,
		avgDailySpend = 0,
		daysRemaining = 0,
		totalIncome = 0,
	}: {
		currentBalance?: number;
		avgDailySpend?: number;
		daysRemaining?: number;
		totalIncome?: number;
	} = $props();

	const projectedEndBalance = $derived(currentBalance + (totalIncome / (daysRemaining || 1) * 0) - (avgDailySpend * daysRemaining));
	const projectedIncome = $derived(totalIncome > 0 ? totalIncome / (daysRemaining || 1) * daysRemaining : 0);
	const projectedBalance = $derived(currentBalance + projectedIncome - (avgDailySpend * daysRemaining));

	const isProjectedPositive = $derived(projectedBalance >= 0);
	const pctOfMonthElapsed = $derived(Math.round((1 - daysRemaining / 30) * 100));

	function trendIcon(): string {
		if (avgDailySpend <= 0) return '→';
		if (projectedBalance > currentBalance * 0.9) return '▲';
		if (projectedBalance < currentBalance * 0.5) return '▼';
		return '→';
	}

	function trendLabel(): string {
		if (avgDailySpend <= 0) return 'steady';
		if (projectedBalance > currentBalance * 0.9) return 'ahead';
		if (projectedBalance < currentBalance * 0.5) return 'behind';
		return 'on track';
	}
</script>

<div class="forecast-banner" class:positive={isProjectedPositive} class:negative={!isProjectedPositive}>
	<div class="forecast-left">
		<div class="forecast-icon">
			{#if isProjectedPositive}
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
					<path d="M12 20V10"/>
					<path d="M18 20V4"/>
					<path d="M6 20v-4"/>
				</svg>
			{:else}
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="10"/>
					<line x1="12" x2="12" y1="8" y2="12"/>
					<line x1="12" x2="12.01" y1="16" y2="16"/>
				</svg>
			{/if}
		</div>
		<div class="forecast-text">
			<span class="forecast-headline">
				Projected end-of-month: <strong>{formatCurrency(Math.abs(projectedBalance))}</strong>
				<span class="forecast-sign" class:sign-positive={isProjectedPositive} class:sign-negative={!isProjectedPositive}>
					{isProjectedPositive ? 'surplus' : 'deficit'}
				</span>
			</span>
			<span class="forecast-context">
				{pctOfMonthElapsed}% of month elapsed · spending {trendIcon()} {trendLabel()}
			</span>
		</div>
	</div>
	<div class="forecast-right">
		<span class="forecast-chip" class:chip-positive={isProjectedPositive} class:chip-negative={!isProjectedPositive}>
			<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
				<path d="M12 20V10"/>
				<path d="M18 20V4"/>
				<path d="M6 20v-4"/>
			</svg>
			Forecast
		</span>
	</div>
</div>

<style>
	.forecast-banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-md);
		padding: var(--space-sm) var(--space-lg);
		border-radius: var(--radius-xl);
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-left: 4px solid var(--color-sky);
		margin-bottom: var(--space-lg);
		min-height: 52px;
		box-shadow: var(--glow-sky);
	}

	.forecast-banner.negative {
		border-left-color: var(--color-coral);
		box-shadow: var(--glow-coral);
	}

	.forecast-left {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		min-width: 0;
	}

	.forecast-icon {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(93, 173, 226, 0.10);
		color: var(--color-sky);
		border-radius: var(--radius-md);
		flex-shrink: 0;
	}

	.forecast-banner.negative .forecast-icon {
		background: rgba(239, 108, 74, 0.10);
		color: var(--color-coral);
	}

	.forecast-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.forecast-headline {
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-ink);
		line-height: 1.3;
	}

	.forecast-headline strong {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}

	.forecast-sign {
		display: inline-block;
		margin-left: 6px;
		padding: 1px 8px;
		border-radius: var(--radius-pill);
		font-size: 10px;
		font-weight: 700;
		font-family: var(--font-display);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.sign-positive {
		background: var(--color-teal-bg);
		color: var(--color-teal);
	}

	.sign-negative {
		background: rgba(239, 108, 74, 0.10);
		color: var(--color-coral);
	}

	.forecast-context {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	.forecast-right {
		flex-shrink: 0;
	}

	.forecast-chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 4px 12px;
		border-radius: var(--radius-pill);
		font-size: var(--font-size-xs);
		font-weight: 700;
		font-family: var(--font-display);
	}

	.chip-positive {
		background: var(--color-teal-bg);
		color: var(--color-teal);
	}

	.chip-negative {
		background: rgba(239, 108, 74, 0.10);
		color: var(--color-coral);
	}

	@media (max-width: 640px) {
		.forecast-banner {
			flex-direction: column;
			align-items: stretch;
		}

		.forecast-right {
			display: none;
		}
	}
</style>

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

	const projectedBalance = $derived(
		currentBalance + (totalIncome / (daysRemaining || 1)) * daysRemaining - avgDailySpend * daysRemaining
	);

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

	// Confidence chip: surplus / deficit / on track — semantic colors
	const chipState = $derived(
		!isProjectedPositive ? 'deficit' : trendLabel() === 'ahead' ? 'surplus' : 'on track'
	);
	const chipClass = $derived(
		chipState === 'deficit' ? 'chip-deficit' : chipState === 'surplus' ? 'chip-surplus' : 'chip-track'
	);
</script>

<div
	class="forecast-card flip7-card"
	class:accent-sky={isProjectedPositive}
	class:accent-coral={!isProjectedPositive}
>
	<!-- Header: icon + label -->
	<div class="forecast-head">
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
		<span class="forecast-label">Month-End Forecast</span>
	</div>

	<!-- Large projected value — semantic color -->
	<div class="forecast-projected" class:value-negative={!isProjectedPositive}>
		<span class="forecast-sign">{isProjectedPositive ? '' : '−'}</span>
		{formatCurrency(Math.abs(projectedBalance))}
	</div>

	<!-- Trend indicator -->
	<div
		class="forecast-trend"
		class:trend-up={trendIcon() === '▲'}
		class:trend-down={trendIcon() === '▼'}
	>
		<span class="trend-arrow">{trendIcon()}</span>
		<span class="trend-label">{trendLabel()}</span>
		<span class="trend-sep" aria-hidden="true">·</span>
		<span class="trend-meta">{pctOfMonthElapsed}% of month elapsed</span>
	</div>

	<!-- Confidence chip — bottom-right, pushed by margin-top:auto -->
	<span class="forecast-chip {chipClass}">{chipState}</span>
</div>

<style>
	/* ══════════════════════════════════════════════════════
	   FORECAST BANNER — Flip7 Insight Card (tall)
	   Equal height with SafeToSpendWidget via parent grid stretch
	   Semantic left bar (sky = surplus, coral = deficit)
	   ══════════════════════════════════════════════════════ */

	.forecast-card {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: var(--space-sm);
		padding: var(--space-lg);
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-card);
		height: 100%;
		transition: transform 200ms var(--bounce), box-shadow 200ms var(--ease);
	}

	@media (pointer: fine) {
		.forecast-card:hover {
			transform: translateY(-2px);
			box-shadow: var(--glow-card);
		}
	}

	/* Left accent bar via accent modifier — replaces border-left + custom shadow */
	.forecast-card.accent-sky .forecast-accent { background: var(--color-sky); }
	.forecast-card.accent-coral .forecast-accent { background: var(--color-coral); }

	/* Dark mode: .flip7-card::before handles the glow */

	/* ─── Header: icon + label ─── */
	.forecast-head {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
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

	.forecast-card.accent-coral .forecast-icon {
		background: var(--color-coral-bg);
		color: var(--color-coral);
	}

	.forecast-label {
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	/* ─── Large projected value ─── */
	.forecast-projected {
		font-family: var(--font-display);
		font-size: var(--font-size-2xl);
		font-weight: var(--font-weight-extrabold);
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.02em;
		line-height: 1.1;
		color: var(--color-teal);
		margin-top: var(--space-xs);
		white-space: nowrap;
	}

	.forecast-projected.value-negative {
		color: var(--color-coral);
	}

	.forecast-sign {
		font-size: 0.8em;
		font-weight: 700;
		color: inherit;
	}

	/* ─── Trend indicator ─── */
	.forecast-trend {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	.trend-arrow {
		font-size: var(--font-size-xs);
		font-weight: 700;
	}

	.trend-label {
		font-weight: 600;
	}

	.forecast-trend.trend-up { color: var(--color-teal); }
	.forecast-trend.trend-down { color: var(--color-coral); }

	.trend-sep {
		opacity: 0.5;
	}

	.trend-meta {
		color: var(--color-text-muted);
	}

	/* ─── Confidence chip — bottom-right ─── */
	.forecast-chip {
		align-self: flex-end;
		margin-top: auto;
		padding: 4px 14px;
		border-radius: var(--radius-pill);
		font-size: var(--font-size-xs);
		font-weight: 700;
		font-family: var(--font-display);
		text-transform: capitalize;
		letter-spacing: 0.02em;
	}

	.chip-surplus {
		background: var(--color-teal-bg);
		color: var(--color-teal);
	}

	.chip-deficit {
		background: rgba(239, 108, 74, 0.10);
		color: var(--color-coral);
	}

	.chip-track {
		background: var(--color-gold-bg);
		color: var(--color-gold-dark);
	}

	/* ════════════════════════════════════════
	   RESPONSIVE
	   ════════════════════════════════════════ */

	@media (max-width: 480px) {
		.forecast-card {
			padding: var(--space-sm) var(--space-md);
		}

		.forecast-icon {
			width: 32px;
			height: 32px;
		}

		.forecast-projected {
			font-size: var(--font-size-xl);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.forecast-card {
			transition: none;
		}
		.forecast-card:hover {
			transform: none;
		}
	}
</style>

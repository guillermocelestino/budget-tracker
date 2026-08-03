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

<div class="stsw-card flip7-card accent-gold">
  <div class="stsw-content">
    <div class="stsw-header">
      <div class="stsw-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
      </div>
      <div class="stsw-info">
        <span class="stsw-label">Available to Spend</span>
        <span class="stsw-value" class:positive={isPositive} class:negative={!isPositive}>
          {isPositive ? '' : '−'}{formatCurrency(Math.abs(available))}
        </span>
      </div>
    </div>
    <div class="stsw-meter">
      <div class="stsw-track">
        <div
          class="stsw-fill"
          class:fill-ok={pctUsed <= 80}
          class:fill-warn={pctUsed > 80 && pctUsed <= 100}
          class:fill-over={pctUsed > 100}
          style="width: {Math.min(pctUsed, 100)}%"
        ></div>
      </div>
      <span class="stsw-pct">{pctUsed}% used</span>
    </div>

    <a href="/transactions" class="stsw-cta">
      View Budget
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 12h14M12 5l7 7-7 7"/>
      </svg>
    </a>
  </div>
</div>

<style>
	/* ═══════════════════════════════════════════════════════
	   SAFE TO SPEND WIDGET — Flip7 Insight Card
	   Meter below label, fluid width, scales with card
	   ══════════════════════════════════════════════════════ */

	.stsw-card {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: var(--space-sm);
		padding: var(--space-md) var(--space-lg);
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-card);
		position: relative;
		overflow: hidden;
		transition: transform 200ms var(--bounce), box-shadow 200ms var(--ease);
	}

	@media (pointer: fine) {
		.stsw-card:hover {
			transform: translateY(-2px);
			box-shadow: var(--glow-card);
		}
	}

	/* Left accent bar — gold (semantic: available to spend) */
	.stsw-card.accent-gold .stsw-accent {
		background: var(--color-gold);
	}

	.stsw-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-md);
	}

	.stsw-icon {
		width: 44px;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-gold-bg);
		color: var(--color-gold-dark);
		border-radius: var(--radius-md);
		flex-shrink: 0;
	}

	.stsw-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.stsw-label {
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.stsw-value {
		font-family: var(--font-display);
		font-size: var(--font-size-xl);
		font-weight: var(--font-weight-extrabold);
		font-variant-numeric: tabular-nums;
		color: var(--color-ink);
	}

	.stsw-value.positive {
		color: var(--color-teal);
	}

	.stsw-value.negative {
		color: var(--color-coral);
	}

	/* Meter — full width below header, pushed to card bottom (equal height) */
	.stsw-meter {
		display: flex;
		flex-direction: column;
		gap: 4px;
		width: 100%;
		margin-top: auto;
	}

	.stsw-track {
		width: 100%;
		height: 8px;
		background: var(--color-hairline);
		border-radius: var(--radius-pill);
		overflow: hidden;
	}

	.stsw-fill {
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
	}

	.stsw-pct {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--color-text-muted);
		font-variant-numeric: tabular-nums;
	}

	/* ─── CTA — subtle pill link, right-aligned ─── */
	.stsw-cta {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		align-self: flex-end;
		font-size: var(--font-size-xs);
		font-weight: 600;
		color: var(--color-gold-dark);
		text-decoration: none;
		padding: 4px 10px;
		border-radius: var(--radius-pill);
		min-height: 28px;
		transition: background var(--transition-fast);
	}

	.stsw-cta:hover {
		background: var(--color-gold-bg);
	}

	.stsw-cta svg {
		transition: transform var(--transition-fast);
	}

	.stsw-cta:hover svg {
		transform: translateX(3px);
	}

	/* ═══════════════════════════════════════
	   RESPONSIVE
	   ════════════════════════════════════════ */

	@media (max-width: 480px) {
		.stsw-card {
			padding: var(--space-sm) var(--space-md);
		}

		.stsw-icon {
			width: 36px;
			height: 36px;
		}

		.stsw-value {
			font-size: var(--font-size-lg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.stsw-card {
			transition: none;
		}
		.stsw-card:hover {
			transform: none;
		}
		.stsw-fill {
			transition: none;
		}
	}
</style>
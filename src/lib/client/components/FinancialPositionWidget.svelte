<script lang="ts">
  import { formatCurrency } from '$lib/client/utils/format';
  import type { NetWorthSnapshot } from '$lib/types';

  let {
    netWorth,
    lendingSummary,
    borrowedSummary,
  }: {
    netWorth?: NetWorthSnapshot;
    lendingSummary?: {
      totalLent: number;
      totalRecovered: number;
      outstanding: number;
    };
    borrowedSummary?: {
      totalBorrowed: number;
      totalRepaid: number;
      outstanding: number;
    };
  } = $props();

  const nwVal = $derived(netWorth?.net ?? 0);
  const liquidVal = $derived(netWorth?.legs.find((l) => l.key === 'cash')?.amount ?? 0);
  const liabilitiesVal = $derived(netWorth?.legs.find((l) => l.key === 'borrowed')?.amount ?? 0);

  const lentVal = $derived(lendingSummary?.outstanding ?? 0);
  const lentRecovered = $derived(lendingSummary?.totalRecovered ?? 0);

  const oweVal = $derived(borrowedSummary?.outstanding ?? 0);
  const oweRepaid = $derived(borrowedSummary?.totalRepaid ?? 0);
</script>

<div class="fp-card flip7-card accent-sky">
  <div class="fp-header">
    <div class="fp-header-left">
      <div class="fp-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
      </div>
      <h2 class="fp-title">Financial Position</h2>
    </div>
    <a href="/net-worth" class="fp-link">View details</a>
  </div>

  <div class="fp-body">
    <!-- Primary Net Worth Tile -->
    <div class="fp-nw-tile">
      <div class="fp-nw-main">
        <span class="fp-label">Net Worth</span>
        <span class="fp-nw-value" class:negative={nwVal < 0}>
          {nwVal < 0 ? '−' : ''}{formatCurrency(Math.abs(nwVal))}
        </span>
      </div>
      <div class="fp-nw-sub">
        <span class="fp-sub-item">Liquid: <strong class="fp-sub-val">{formatCurrency(liquidVal)}</strong></span>
        {#if liabilitiesVal > 0}
          <span class="fp-sub-sep">•</span>
          <span class="fp-sub-item">Liabilities: <strong class="fp-sub-val neg">{formatCurrency(liabilitiesVal)}</strong></span>
        {/if}
      </div>
    </div>

    <!-- Secondary Lending & Owe Row -->
    <div class="fp-grid-row">
      <a href="/lending" class="fp-chip tone-gold">
        <div class="fp-chip-top">
          <span class="fp-chip-label">Lent Out</span>
          <span class="fp-chip-badge">{lentRecovered > 0 ? `${formatCurrency(lentRecovered)} rec.` : 'Active'}</span>
        </div>
        <span class="fp-chip-val pos">{formatCurrency(lentVal)}</span>
      </a>

      <a href="/borrowed" class="fp-chip tone-coral">
        <div class="fp-chip-top">
          <span class="fp-chip-label">You Owe</span>
          <span class="fp-chip-badge">{oweRepaid > 0 ? `${formatCurrency(oweRepaid)} pd.` : 'Active'}</span>
        </div>
        <span class="fp-chip-val neg">{formatCurrency(oweVal)}</span>
      </a>
    </div>
  </div>
</div>

<style>
  /* ═══════════════════════════════════════════════════════
     FINANCIAL POSITION WIDGET — Flip7 Insight Card
     ══════════════════════════════════════════════════════ */

  .fp-card {
    display: flex;
    flex-direction: column;
    padding: var(--space-lg);
    background: var(--color-surface);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-card);
    height: 100%;
    transition: transform 200ms var(--bounce), box-shadow 200ms var(--ease);
  }

  @media (pointer: fine) {
    .fp-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--glow-card);
    }
  }

  /* Header */
  .fp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-md);
  }

  .fp-header-left {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .fp-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(93, 173, 226, 0.12);
    color: var(--color-sky);
    border-radius: var(--radius-md);
    flex-shrink: 0;
  }

  .fp-title {
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--color-ink);
    margin: 0;
  }

  .fp-link {
    font-family: var(--font-display);
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--color-sky);
    text-decoration: none;
    transition: color 150ms var(--ease);
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }

  .fp-link:hover {
    color: var(--color-teal-dark);
    text-decoration: underline;
  }

  /* Body */
  .fp-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    flex: 1;
    justify-content: space-between;
  }

  /* Net Worth Main Tile */
  .fp-nw-tile {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: var(--space-md);
    background: var(--color-surface-inset);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-lg);
  }

  .fp-nw-main {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-sm);
  }

  .fp-label {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .fp-nw-value {
    font-family: var(--font-display);
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-extrabold);
    font-variant-numeric: tabular-nums;
    color: var(--color-ink);
  }

  .fp-nw-value.negative {
    color: var(--color-coral);
  }

  .fp-nw-sub {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }

  .fp-sub-val {
    font-weight: 600;
    color: var(--color-ink);
  }

  .fp-sub-val.neg {
    color: var(--color-coral);
  }

  .fp-sub-sep {
    opacity: 0.4;
  }

  /* Secondary Chips Row */
  .fp-grid-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-sm);
  }

  .fp-chip {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: var(--space-sm) var(--space-md);
    background: var(--color-surface-inset);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-lg);
    text-decoration: none;
    color: inherit;
    transition: transform 150ms var(--bounce), background 150ms var(--ease);
  }

  .fp-chip:hover {
    background: var(--color-surface-hover, var(--color-teal-bg));
    transform: translateY(-1px);
  }

  .fp-chip-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
  }

  .fp-chip-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .fp-chip-badge {
    font-size: 10px;
    font-weight: 600;
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }

  .fp-chip-val {
    font-family: var(--font-display);
    font-size: var(--font-size-base);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .fp-chip-val.pos {
    color: var(--color-gold-dark);
  }

  .fp-chip-val.neg {
    color: var(--color-coral);
  }

  @media (max-width: 480px) {
    .fp-card {
      padding: var(--space-md);
    }
    .fp-grid-row {
      grid-template-columns: 1fr;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .fp-card, .fp-chip {
      transition: none;
    }
  }
</style>

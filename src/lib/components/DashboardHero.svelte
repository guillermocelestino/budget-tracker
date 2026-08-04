<script lang="ts">
  import { onMount } from 'svelte';
  import { formatCurrency, countUp } from '$lib/utils/format';

  let {
    balance = 0,
    savingsRate = 0,
    lendingSummary,
    incomeChange,
    expenseChange,
  }: {
    balance?: number;
    savingsRate?: number;
    lendingSummary?: { totalLent: number; totalRecovered: number; outstanding: number };
    incomeChange?: number;
    expenseChange?: number;
  } = $props();

  // ─── Animated hero balance ───
  let displayedBalance = $state(0);

  onMount(() => {
    countUp(Math.abs(balance), 900, (v) => (displayedBalance = v));
  });

  const balanceSign = $derived(balance < 0 ? '−' : '');
  const displayBalance = $derived(formatCurrency(Math.abs(displayedBalance)));

  const displaySavingsRate = $derived(
    savingsRate != null ? `${savingsRate.toFixed(1)}%` : '—'
  );

  // ─── Net change deltas ───
  const netChange = $derived((incomeChange ?? 0) + (expenseChange ?? 0));
  const netChangeGood = $derived(netChange >= 0 ? 'good' : 'bad');

  // ─── Lending derived values ───
  const hasLending = $derived(lendingSummary != null);
</script>

<div class="dash-hero flip7-card" class:accent-gold={true}>
  <!-- Brand ribbon (teal→gold) — not semantic, identifies the hero -->
  <div class="hero-ribbon"></div>

  <div class="hero-content">
    <!-- Row 1: Primary balance + Savings + Key Deltas -->
    <div class="hero-main-row">
      <!-- Primary: Net Balance (large, animated) -->
      <div class="hero-primary">
        <span class="hero-label">Net Balance</span>
        <span class="hero-value" class:negative={balance < 0}>
          <span class="hero-currency">{balanceSign}</span>
          {displayBalance}
        </span>
        <span class="hero-savings">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9"/>
            <path d="M8 12h8 M12 8v8"/>
          </svg>
          {displaySavingsRate} saved
        </span>
      </div>

      <!-- Secondary: Key Deltas (Income, Expense, Net) -->
      <div class="hero-deltas">
        <span class="delta-chip" class:good={incomeChange !== undefined && incomeChange >= 0} class:bad={incomeChange !== undefined && incomeChange < 0}>
          <span class="delta-label">Income</span>
          <span class="delta-value">{incomeChange !== undefined ? (incomeChange > 0 ? '+' : '') + incomeChange.toFixed(1) + '%' : '—'}</span>
        </span>
        <span class="delta-chip" class:good={expenseChange !== undefined && expenseChange <= 0} class:bad={expenseChange !== undefined && expenseChange > 0}>
          <span class="delta-label">Expense</span>
          <span class="delta-value">{expenseChange !== undefined ? (expenseChange > 0 ? '+' : '') + expenseChange.toFixed(1) + '%' : '—'}</span>
        </span>
        <span class="delta-chip" class:good={netChangeGood === 'good'} class:bad={netChangeGood === 'bad'}>
          <span class="delta-label">Net</span>
          <span class="delta-value">{netChange > 0 ? '+' : ''}{netChange.toFixed(1)}%</span>
        </span>
      </div>
    </div>

    <!-- Row 2: Lending Footer (compact, single line) -->
    {#if hasLending}
      <div class="hero-lending-footer">
        <span class="hli-item tone-gold">
          <span class="hli-label">Lent</span>
          <span class="hli-value">{formatCurrency(lendingSummary!.totalLent)}</span>
        </span>
        <span class="hli-divider" aria-hidden="true">•</span>
        <span class="hli-item tone-teal">
          <span class="hli-label">Recovered</span>
          <span class="hli-value">{formatCurrency(lendingSummary!.totalRecovered)}</span>
        </span>
        <span class="hli-divider" aria-hidden="true">•</span>
        <span class="hli-item tone-coral">
          <span class="hli-label">Owe</span>
          <span class="hli-value">{formatCurrency(lendingSummary!.outstanding || 0)}</span>
        </span>
      </div>
    {/if}
  </div>
</div>

<style>
  /* ════════════════════════════════════════════════════════
     DASHBOARD HERO — Flip7 Card + Brand Ribbon
     Single card replaces Vault + MobileSummaryRail (desktop)
     ═══════════════════════════════════════════════════════ */

  .dash-hero {
    position: relative;
    display: flex;
    flex-direction: column;
    padding: var(--space-lg) var(--space-xl) var(--space-md);
    border-radius: var(--radius-xl);
    overflow: hidden;
    margin-bottom: var(--space-xl);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    box-shadow: var(--shadow-card);
    transition: box-shadow 200ms var(--bounce), transform 200ms var(--bounce);
  }

  .dash-hero:hover {
    box-shadow: var(--shadow-lg);
    transform: translateY(-2px);
  }

  /* Brand ribbon — teal→gold gradient, not semantic */
  .hero-ribbon {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--color-teal), var(--color-gold));
  }

  /* Gold left accent (net worth semantic) via .flip7-card.accent-gold */
  /* Dark mode: .flip7-card::before handles the glow */

  .hero-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    width: 100%;
  }

  /* ═══ Row 1: Primary Balance | Key Deltas ═══ */
  .hero-main-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--space-xl);
    align-items: start;
  }

  /* Primary Balance — dominant focal point */
  .hero-primary {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    min-width: 0;
  }

  .hero-label {
    font-size: var(--font-size-sm);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--color-text-muted);
  }

  .hero-value {
    font-size: clamp(40px, 7vw, 72px);
    font-weight: 800;
    font-family: var(--font-display);
    letter-spacing: -0.03em;
    line-height: 1;
    color: var(--color-ink);
    font-variant-numeric: tabular-nums;
  }

  .hero-value.negative {
    color: var(--color-coral);
  }

  .hero-currency {
    color: var(--color-gold-dark);
    font-size: 0.7em;
    font-weight: 700;
  }

  .hero-savings {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text-muted);
    width: fit-content;
  }

  .hero-savings svg {
    color: var(--color-gold);
  }

  /* Secondary: Key Deltas — 3 equal-width chips (instrument readouts) */
  .hero-deltas {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-sm);
    align-items: stretch;
  }

  .delta-chip {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 2px;
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-pill);
    background: var(--color-surface-inset);
    border: 1px solid var(--color-hairline);
    font-size: var(--font-size-xs);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    text-align: center;
    min-width: 0;
    transition: all 150ms var(--ease);
  }

  .delta-chip.good {
    background: var(--color-teal-bg);
    border-color: var(--color-teal);
    color: var(--color-teal);
  }

  .delta-chip.bad {
    background: rgba(239, 108, 74, 0.10);
    border-color: var(--color-coral);
    color: var(--color-coral);
  }

  .delta-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    opacity: 0.7;
  }

  .delta-value {
    font-family: var(--font-display);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  /* Footer: Lending (compact, single line) */
  .hero-lending-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
    padding-top: var(--space-xs);
    border-top: 1px solid var(--color-hairline);
    font-size: var(--font-size-sm);
    font-variant-numeric: tabular-nums;
    color: var(--color-text-muted);
  }

  .hli-item {
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
  }

  .hli-label { font-weight: 500; }
  .hli-value { font-weight: 700; }

  .tone-teal .hli-value { color: var(--color-teal); }
  .tone-coral .hli-value { color: var(--color-coral); }
  .tone-gold .hli-value { color: var(--color-gold-dark); }
  .tone-sky .hli-value { color: var(--color-sky); }

  .hli-divider { opacity: 0.4; }

  /* ════════════════════════════════════════
     RESPONSIVE
     ════════════════════════════════════════ */

  @media (max-width: 1024px) {
    .hero-main-row {
      grid-template-columns: 1fr;
      gap: var(--space-lg);
    }

    .hero-deltas {
      justify-content: flex-start;
    }
  }

  @media (max-width: 768px) {
    .dash-hero {
      padding: var(--space-md) var(--space-lg) var(--space-md);
      margin-bottom: var(--space-lg);
    }

    /* Net Balance dominates the hero — one continuous ramp, no size jump */
    .hero-value {
      font-size: clamp(30px, 9.5vw, 48px);
    }

    /* 8pt rhythm: 16px between balance and chips; footer stays snug (metadata) */
    .hero-main-row {
      gap: var(--space-lg);
    }

    .hero-content {
      gap: var(--space-sm);
    }

    /* Savings: quiet supporting row */
    .hero-savings {
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-medium);
      opacity: 0.85;
    }

    /* KPI chips → compact financial status badges (subtle tint, no outline) */
    .hero-deltas {
      gap: var(--space-sm);
    }

    .delta-chip {
      padding: var(--space-xs) var(--space-md);
      border-radius: var(--radius-md);
      border-color: transparent;
      font-size: var(--font-size-xs);
    }

    .delta-chip.good,
    .delta-chip.bad {
      border-color: transparent;
    }

    .delta-label {
      font-size: 0.75em;
      font-weight: var(--font-weight-medium);
      letter-spacing: var(--letter-spacing-wide);
      opacity: 0.6;
    }

    .delta-value {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-extrabold);
    }

    .hero-lending-footer {
      gap: var(--space-sm);
      font-size: var(--font-size-xs);
      border-top: none;
    }
  }

  @media (max-width: 480px) {
    .dash-hero {
      padding: var(--space-md) var(--space-md) var(--space-md);
    }

    .hero-deltas {
      gap: var(--space-xs);
    }

    .delta-chip {
      padding: var(--space-xs) var(--space-sm);
    }

    /* Savings: breathes below the balance */
    .hero-savings {
      margin-top: var(--space-xs);
    }

    /* Lending footer → metadata strip inside the hero, not a separate section */
    .hero-lending-footer {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--space-sm);
      padding-top: 0;
      border-top: none;
    }

    /* Each metric: faint label over strong value */
    .hli-item {
      flex-direction: column;
      align-items: center;
      gap: 2px;
      text-align: center;
    }

    .hli-label {
      font-size: 0.7em;
      font-weight: var(--font-weight-normal);
      text-transform: uppercase;
      letter-spacing: var(--letter-spacing-wide);
      opacity: 0.5;
    }

    /* Stray "•" separators have no place in the grid — hide them */
    .hli-divider {
      display: none;
    }

    /* Values: single line, tabular digits, semantic color — carry the emphasis */
    .hli-value {
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-extrabold);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dash-hero {
      transition: none;
    }
    .dash-hero:hover {
      transform: none;
    }
  }
</style>
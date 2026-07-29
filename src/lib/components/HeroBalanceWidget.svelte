<script lang="ts">
  import { onMount } from 'svelte';
  import { formatCurrency, countUp } from '$lib/utils/format';

  let {
    balance = 0,
    totalIncome = 0,
    totalExpenses = 0,
    savingsRate = 0,
    lendingSummary,
    incomeChange,
    expenseChange,
  }: {
    balance?: number;
    totalIncome?: number;
    totalExpenses?: number;
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
  const displayIncome = $derived(formatCurrency(totalIncome));
  const displayExpenses = $derived(formatCurrency(totalExpenses));

  // ─── Savings rate formatting ───
  const displaySavingsRate = $derived(
    savingsRate != null ? `${savingsRate.toFixed(1)}%` : '—'
  );

  // ─── Lending derived values ───
  const hasLending = $derived(lendingSummary != null);
  const netLending = $derived(
    lendingSummary ? lendingSummary.outstanding : 0
  );
  const displayNetLending = $derived(formatCurrency(Math.abs(netLending)));
  const isLendingPositive = $derived(netLending > 0);

  // ─── Income/Expense ratio ───
  const incomeRatio = $derived(
    totalIncome + totalExpenses > 0
      ? ((totalIncome / (totalIncome + totalExpenses)) * 100).toFixed(0)
      : '—'
  );
  const expenseRatio = $derived(
    totalIncome > 0
      ? ((totalExpenses / totalIncome) * 100).toFixed(0)
      : '—'
  );

  // ─── Trend helpers ───
  function trendArrow(change: number | undefined, invert: boolean): string {
    if (change == null) return '';
    const direction = invert ? -change : change;
    if (direction > 0) return '▲';
    if (direction < 0) return '▼';
    return '→';
  }

  function trendClass(change: number | undefined, invert: boolean): string {
    if (change == null) return '';
    const direction = invert ? -change : change;
    if (direction > 0) return 'trend-up';
    if (direction < 0) return 'trend-down';
    return 'trend-flat';
  }

  function trendLabel(change: number | undefined): string {
    if (change == null) return '';
    return `${change > 0 ? '+' : ''}${change.toFixed(1)}%`;
  }
</script>

<div class="hero-widget">
  <!-- ═══ Section 1: Hero Balance ═══ -->
  <div class="hero-section">
    <div class="hero-glow"></div>
    <span class="hero-label">Total Balance</span>
    <span class="hero-value" class:negative={balance < 0}>
      {balanceSign}{displayBalance}
    </span>
  </div>

  <!-- ═══ Section 2: Cash Flow Metrics ═══ -->
  <div class="metrics-section">
    <!-- Income -->
    <div class="metric-block">
      <div class="metric-icon income-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
          <polyline points="17 6 23 6 23 12"/>
        </svg>
      </div>
      <div class="metric-body">
        <span class="metric-label">Income</span>
        <span class="metric-value">{displayIncome}</span>
        {#if incomeChange != null}
          <span class="metric-trend {trendClass(incomeChange, false)}">
            {trendArrow(incomeChange, false)} {trendLabel(incomeChange)}
          </span>
        {:else}
          <span class="metric-ratio">{incomeRatio}% of total</span>
        {/if}
      </div>
    </div>

    <!-- Divider -->
    <div class="metric-divider"></div>

    <!-- Expenses -->
    <div class="metric-block">
      <div class="metric-icon expense-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 18 14.5 10.5 9.5 15.5 1 6"/>
          <polyline points="7 18 1 18 1 12"/>
        </svg>
      </div>
      <div class="metric-body">
        <span class="metric-label">Expenses</span>
        <span class="metric-value">{displayExpenses}</span>
        {#if expenseChange != null}
          <span class="metric-trend {trendClass(expenseChange, true)}">
            {trendArrow(expenseChange, true)} {trendLabel(expenseChange)}
          </span>
        {:else}
          <span class="metric-ratio">{expenseRatio}% of income</span>
        {/if}
      </div>
    </div>

    <!-- Savings Rate Pill -->
    <div class="metric-savings" class:savings-positive={savingsRate > 0} class:savings-negative={savingsRate <= 0}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="9"/>
        <path d="M8 12h8 M12 8v8"/>
      </svg>
      <span>{displaySavingsRate}</span>
      <span class="savings-label">Saved</span>
    </div>
  </div>

  <!-- ═══ Section 3: Lending (conditional) ═══ -->
  {#if hasLending}
    <div class="lending-section">
      <div class="lending-row">
        <span class="lending-dot" class:positive={isLendingPositive}></span>
        <span class="lending-label">Lending</span>
        <span class="lending-values">
          Lent <strong>{formatCurrency(lendingSummary!.totalLent)}</strong>
          ·
          Recovered <strong>{formatCurrency(lendingSummary!.totalRecovered)}</strong>
          ·
          <span class="lending-outstanding" class:positive={isLendingPositive}>
            {displayNetLending} outstanding
          </span>
        </span>
      </div>
    </div>
  {/if}
</div>

<style>
  /* ════════════════════════════════════════════════
     HERO BALANCE WIDGET — FLIP7
     ════════════════════════════════════════ */

  .hero-widget {
    position: relative;
    background: var(--color-cream);
    border: none;
    border-left: 6px solid var(--color-teal);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-card);
    overflow: hidden;
    margin-bottom: var(--space-lg);
    isolation: isolate;
  }

  /* ─── Section 1: Hero Balance ─── */

  .hero-section {
    position: relative;
    z-index: 1;
    text-align: center;
    padding: var(--space-xl) var(--space-xl) var(--space-md);
  }

  .hero-glow {
    position: absolute;
    top: -100px;
    left: 50%;
    transform: translateX(-50%);
    width: 450px;
    height: 280px;
    border-radius: 50%;
    background: radial-gradient(ellipse, rgba(43, 168, 162, 0.08) 0%, transparent 70%);
    pointer-events: none;
  }

  .hero-label {
    display: block;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.12em;
    margin-bottom: 6px;
  }

  .hero-value {
    display: block;
    font-size: 3rem;
    font-weight: var(--font-weight-bold);
    font-family: var(--font-display);
    letter-spacing: var(--letter-spacing-tight);
    line-height: var(--line-height-tight);
    color: var(--color-ink);
    font-variant-numeric: tabular-nums;
    transition: color 400ms var(--bounce);
  }

  .hero-value.negative {
    color: var(--color-negative);
  }

  /* ─── Section 2: Cash Flow Metrics ─── */

  .metrics-section {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-md);
    padding: 0 var(--space-xl) var(--space-lg);
    position: relative;
    z-index: 1;
  }

  .metric-block {
    display: flex;
    align-items: flex-start;
    gap: var(--space-sm);
    min-width: 140px;
    background: var(--color-surface);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-lg);
    padding: var(--space-sm) var(--space-md);
    position: relative;
  }

  /* Teal left bar for income */
  .metric-block:first-of-type {
    border-left: 4px solid var(--color-teal);
  }

  /* Coral left bar for expense */
  .metric-block:nth-of-type(2) {
    border-left: 4px solid var(--color-coral);
  }

  .metric-icon {
    width: 34px;
    height: 34px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .income-icon {
    background: var(--color-teal-bg);
    color: var(--color-teal);
  }

  .expense-icon {
    background: rgba(239, 108, 74, 0.10);
    color: var(--color-coral);
  }

  .metric-body {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .metric-label {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .metric-value {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
    color: var(--color-ink);
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    letter-spacing: var(--letter-spacing-tight);
    line-height: 1.2;
  }

  .metric-trend {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    margin-top: 2px;
  }

  .metric-trend.trend-up { color: var(--color-teal); }
  .metric-trend.trend-down { color: var(--color-coral); }
  .metric-trend.trend-flat { color: var(--color-text-muted); }

  .metric-ratio {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-muted);
    margin-top: 2px;
  }

  .metric-divider {
    width: 1px;
    height: 48px;
    background: var(--color-hairline);
    flex-shrink: 0;
  }

  .metric-savings {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 6px 16px;
    border-radius: var(--radius-pill);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-bold);
    color: var(--color-text-muted);
    background: var(--color-bg);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    border: 1px solid transparent;
  }

  .metric-savings.savings-positive {
    color: var(--color-gold-dark);
    background: rgba(255, 210, 63, 0.15);
    border-color: var(--color-gold);
    box-shadow: var(--glow-gold);
  }

  .metric-savings.savings-negative {
    color: var(--color-coral);
    background: rgba(239, 108, 74, 0.10);
    border-color: var(--color-coral);
    animation: boom-pulse 2s infinite;
  }

  .savings-label {
    font-weight: var(--font-weight-medium);
    font-size: var(--font-size-xs);
    opacity: 0.8;
  }

  /* ─── Section 3: Lending (conditional) ─── */

  .lending-section {
    position: relative;
    z-index: 1;
    border-top: 1px solid var(--color-hairline);
    background: var(--color-cream);
    padding: var(--space-md) var(--space-xl);
  }

  .lending-row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
    min-height: 44px;
  }

  .lending-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-text-muted);
    flex-shrink: 0;
  }

  .lending-dot.positive {
    background: var(--color-teal);
  }

  .lending-label {
    font-weight: var(--font-weight-semibold);
    color: var(--color-ink);
    text-transform: uppercase;
    font-size: var(--font-size-xs);
    letter-spacing: 0.05em;
  }

  .lending-values {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }

  .lending-values strong {
    color: var(--color-ink);
    font-weight: var(--font-weight-semibold);
    font-variant-numeric: tabular-nums;
  }

  .lending-outstanding {
    font-weight: var(--font-weight-semibold);
    font-variant-numeric: tabular-nums;
  }

  .lending-outstanding.positive {
    color: var(--color-teal);
  }

  /* ═══════════════════════════════════════
     RESPONSIVE BREAKPOINTS
     ═══════════════════════════════════════ */

  @media (max-width: 768px) {
    .hero-widget {
      width: 100%;
      box-sizing: border-box;
      margin-bottom: var(--space-md);
    }

    .hero-section {
      padding: var(--space-lg) var(--space-md) var(--space-sm);
    }

    .hero-glow {
      width: 300px;
      height: 200px;
      top: -60px;
    }

    .hero-value {
      font-size: clamp(28px, 8vw, 48px);
      word-break: break-word;
      overflow-wrap: break-word;
      text-align: center;
      line-height: var(--line-height-tight);
    }

    .metrics-section {
      flex-direction: column;
      align-items: stretch;
      gap: var(--space-md);
      width: 100%;
      padding: 0 var(--space-md) var(--space-md);
    }

    .metric-block {
      width: 100%;
      min-width: unset;
      flex-direction: row;
      align-items: center;
      gap: var(--space-sm);
    }

    .metric-body {
      flex: 1;
      min-width: 0;
    }

    .metric-divider {
      width: 100%;
      height: 1px;
    }

    .metric-savings {
      align-self: flex-start;
    }

    .lending-section {
      padding: var(--space-sm) var(--space-md);
    }

    .lending-row {
      flex-wrap: wrap;
      gap: 6px;
      align-items: flex-start;
    }

    .lending-values {
      font-size: var(--font-size-xs);
    }
  }

  @media (max-width: 480px) {
    .hero-section {
      padding: var(--space-md) var(--space-sm) var(--space-xs);
    }

    .hero-glow {
      width: 240px;
      height: 200px;
      top: -40px;
    }

    .hero-value {
      font-size: clamp(1.25rem, 6vw, 1.75rem);
      overflow-wrap: break-word;
      word-break: break-word;
      hyphens: none;
    }

    .metrics-section {
      padding: 0 var(--space-sm) var(--space-sm);
      gap: var(--space-sm);
    }

    .metric-savings {
      align-self: stretch;
      justify-content: center;
    }

    .lending-section {
      padding: var(--space-sm);
    }

    .lending-row {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-xs);
    }

    .lending-values {
      width: 100%;
    }
  }

  @media (max-width: 375px) {
    .hero-value {
      font-size: clamp(1.1rem, 5vw, 1.4rem);
    }

    .hero-label {
      font-size: 10px;
    }

    .metric-label {
      font-size: 10px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hero-glow {
      display: none;
    }
    .metric-savings.savings-negative {
      animation: none;
    }
  }
</style>

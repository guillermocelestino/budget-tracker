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

  // ─── Trend helpers — good/bad semantics ───
  // The arrow always points the LITERAL direction of change (↑ up, ↓ down).
  // Color communicates good/bad:
  //   income ↑ = good (mint)    | income ↓ = bad (coral)
  //   expense ↑ = bad (coral)   | expense ↓ = good (mint)
  // The `invert` flag flips the polarity for expenses so ↑ always = bad for
  // that type. This prevents arrow/sign contradictions like "↓ +26.9%".

  function trendArrow(change: number | undefined): string {
    if (change == null) return '';
    if (change > 0) return '↑';
    if (change < 0) return '↓';
    return '→';
  }

  function trendGoodBad(change: number | undefined, invert: boolean): string {
    if (change == null) return '';
    // invert=true for expenses: a positive change (more spending) is bad
    const isGood = invert ? change < 0 : change > 0;
    return isGood ? 'trend-good' : 'trend-bad';
  }

  function trendLabel(change: number | undefined): string {
    if (change == null) return '';
    return `${change > 0 ? '+' : ''}${change.toFixed(1)}%`;
  }
</script>

<div class="hero-vault">
  <!-- ═══ Dot-grid texture overlay ═══ -->
  <div class="vault-texture"></div>

  <!-- ═══ Sheen sweep overlay (one-pass on load) ═══ -->
  <div class="vault-sheen"></div>

  <!-- ═══ Dark contrast pool behind the balance number ═══ -->
  <div class="vault-pool"></div>

  <!-- ═══ Gold warm halo around the balance number ═══ -->
  <div class="vault-glow"></div>

  <!-- ═══ Section 1: Hero Balance ═══ -->
  <div class="vault-hero">
    <span class="vault-eyebrow">Total Balance</span>
    <span class="vault-value" class:negative={balance < 0}>
      <span class="vault-currency">{balanceSign}</span>
      {displayBalance}
    </span>
  </div>

  <!-- ═══ Section 2: Cash Flow Metrics ═══ -->
  <div class="vault-metrics">
    <!-- Income -->
    <div class="vault-tile">
      <div class="tile-icon income-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
          <polyline points="17 6 23 6 23 12"/>
        </svg>
      </div>
      <div class="tile-body">
        <span class="tile-label">Income</span>
        <span class="tile-value tile-income-val">{displayIncome}</span>
        {#if incomeChange != null}
          <span class="tile-trend {trendGoodBad(incomeChange, false)}">
            {trendArrow(incomeChange)} {trendLabel(incomeChange)}
          </span>
        {:else}
          <span class="tile-ratio">{incomeRatio}% of total</span>
        {/if}
      </div>
    </div>

    <!-- Expenses -->
    <div class="vault-tile">
      <div class="tile-icon expense-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 18 14.5 10.5 9.5 15.5 1 6"/>
          <polyline points="7 18 1 18 1 12"/>
        </svg>
      </div>
      <div class="tile-body">
        <span class="tile-label">Expenses</span>
        <span class="tile-value tile-expense-val">{displayExpenses}</span>
        {#if expenseChange != null}
          <span class="tile-trend {trendGoodBad(expenseChange, true)}">
            {trendArrow(expenseChange)} {trendLabel(expenseChange)}
          </span>
        {:else}
          <span class="tile-ratio">{expenseRatio}% of income</span>
        {/if}
      </div>
    </div>

    <!-- Savings Rate Gold Pill -->
    <div class="vault-pill" class:pill-positive={savingsRate > 0} class:pill-negative={savingsRate <= 0}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="9"/>
        <path d="M8 12h8 M12 8v8"/>
      </svg>
      <span class="pill-value">{displaySavingsRate}</span>
      <span class="pill-label">Saved</span>
    </div>
  </div>

  <!-- ═══ Section 3: Lending (conditional) ═══ -->
  {#if hasLending}
    <div class="vault-lending">
      <div class="lending-strip">
        <span class="strip-dot" class:strip-positive={isLendingPositive}></span>
        <span class="strip-label">Lending</span>
        <span class="strip-values">
          Lent <strong>{formatCurrency(lendingSummary!.totalLent)}</strong>
          <span class="strip-sep">·</span>
          Recovered <strong>{formatCurrency(lendingSummary!.totalRecovered)}</strong>
          <span class="strip-sep">·</span>
          <span class="strip-outstanding" class:strip-positive={isLendingPositive}>
            {displayNetLending} outstanding
          </span>
        </span>
      </div>
    </div>
  {/if}
</div>

<style>
  /* ═══════════════════════════════════════════════════
     THE VAULT — Teal-gradient hero balance widget
     ═══════════════════════════════════════════════════ */

  .hero-vault {
    position: relative;
    border-radius: var(--radius-xl);
    box-shadow: var(--glow-card), var(--shadow-card);
    overflow: hidden;
    margin-bottom: var(--space-lg);
    isolation: isolate;

    /* LIGHT hero gradient */
    background: linear-gradient(135deg, #2BA8A2 0%, #1E8C86 55%, #14655F 100%);
  }

  [data-theme="dark"] .hero-vault {
    /* DARK hero gradient — deeper, no glare */
    background: linear-gradient(135deg, #1E8C86 0%, #14655F 55%, #0C3F3B 100%);
  }

  /* ── Dot-grid texture ── */
  .vault-texture {
    position: absolute;
    inset: 0;
    background-image: radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px);
    background-size: 24px 24px;
    pointer-events: none;
    z-index: 1;
  }

  /* ── Sheen sweep (one-pass on load) ── */
  .vault-sheen {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 2;
    background: linear-gradient(
      105deg,
      transparent 30%,
      rgba(255,255,255,0.06) 45%,
      rgba(255,255,255,0.06) 55%,
      transparent 70%
    );
    animation: sheen-sweep 1.2s var(--ease) forwards;
  }

  @keyframes sheen-sweep {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }

  /* ── Dark contrast pool behind the balance number ── */
  .vault-pool {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -60%);
    width: 320px;
    height: 220px;
    border-radius: 50%;
    background: radial-gradient(ellipse, rgba(0,0,0,0.20) 0%, rgba(0,0,0,0) 70%);
    pointer-events: none;
    z-index: 1;
  }

  /* ── Gold warm halo around the balance number ── */
  .vault-glow {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -60%);
    width: 300px;
    height: 200px;
    border-radius: 50%;
    background: radial-gradient(ellipse, rgba(255, 210, 63, 0.25) 0%, transparent 65%);
    pointer-events: none;
    z-index: 2;
    transition: opacity 400ms var(--ease);
  }

  .hero-vault:hover .vault-glow {
    opacity: 1.5;
  }

  /* ═══ Section 1: Hero Balance ═══ */

  .vault-hero {
    position: relative;
    z-index: 3;
    text-align: center;
    padding: var(--space-xl) var(--space-xl) var(--space-md);
  }

  .vault-eyebrow {
    display: block;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-bold);
    color: rgba(255,255,255,0.82);
    text-transform: uppercase;
    letter-spacing: 0.18em;
    margin-bottom: 6px;
    position: relative;
    z-index: 3;
  }

  .vault-value {
    display: block;
    font-size: clamp(40px, 7vw, 72px);
    font-weight: 800;
    font-family: var(--font-display);
    letter-spacing: -0.03em;
    line-height: 1;
    color: #FFFFFF;
    font-variant-numeric: tabular-nums;
    position: relative;
    z-index: 3;
    text-shadow: 0 2px 18px rgba(0,0,0,0.25);
  }

  .vault-value.negative {
    color: #FFB3A0;
  }

  .vault-currency {
    color: #FFD23F;
  }

  /* ═══ Section 2: Cash Flow Metrics ═══ */

  .vault-metrics {
    position: relative;
    z-index: 3;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-md);
    padding: 0 var(--space-xl) var(--space-lg);
  }

  .vault-tile {
    display: flex;
    align-items: flex-start;
    gap: var(--space-md);
    min-width: 140px;
    background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.35);
    border-radius: var(--radius-lg);
    padding: var(--space-sm) var(--space-md);
    backdrop-filter: blur(4px);
  }

  [data-theme="dark"] .vault-tile {
    background: rgba(255,255,255,0.08);
    border-color: rgba(255,255,255,0.22);
  }

  .tile-icon {
    width: 30px;
    height: 30px;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .income-icon {
    background: rgba(159,240,214,0.25);
    color: #9FF0D6;
  }

  .expense-icon {
    background: rgba(255,179,160,0.25);
    color: #FFB3A0;
  }

  .tile-body {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .tile-label {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-bold);
    color: #9FF0D6;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .tile-icon.income-icon + .tile-body .tile-label {
    color: #9FF0D6;
  }

  /* Second tile (expenses) label in coral */
  .vault-tile:nth-of-type(2) .tile-label {
    color: #FFB3A0;
  }

  .tile-value {
    font-size: var(--font-size-lg);
    font-weight: 700;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    letter-spacing: var(--letter-spacing-tight);
    line-height: 1.2;
    color: #FFFFFF;
  }

  .tile-trend {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    margin-top: 2px;
  }

  /* Good = mint (income up, expense down) */
  .tile-trend.trend-good { color: #9FF0D6; }
  /* Bad = coral (income down, expense up) */
  .tile-trend.trend-bad { color: #FFB3A0; }
  /* Flat = muted white */
  .tile-trend.trend-flat { color: rgba(255,255,255,0.55); }

  .tile-ratio {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    color: rgba(255,255,255,0.5);
    margin-top: 2px;
  }

  /* ── Savings gold pill ── */
  .vault-pill {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 8px 20px;
    border-radius: var(--radius-pill);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-bold);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    min-height: 40px;
  }

  .vault-pill.pill-positive {
    background: #FFD23F;
    color: #14655F;
    box-shadow: 0 2px 12px rgba(255, 210, 63, 0.30);
  }

  .vault-pill.pill-negative {
    background: rgba(255,217,206,0.20);
    color: #FFD9CE;
    border: 1px solid rgba(255,217,206,0.30);
  }

  .pill-value {
    font-weight: var(--font-weight-extrabold);
    font-size: var(--font-size-base);
    font-family: var(--font-display);
  }

  .pill-label {
    font-weight: var(--font-weight-medium);
    font-size: var(--font-size-xs);
    opacity: 0.85;
  }

  .vault-pill.pill-negative .pill-label {
    opacity: 0.7;
  }

  /* ═══ Section 3: Lending (conditional) ═══ */

  .vault-lending {
    position: relative;
    z-index: 3;
    border-top: 1px solid rgba(255,255,255,0.12);
    background: rgba(0,0,0,0.12);
    padding: var(--space-md) var(--space-xl);
  }

  [data-theme="dark"] .vault-lending {
    background: rgba(0,0,0,0.18);
  }

  .lending-strip {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: var(--font-size-sm);
    color: rgba(255,255,255,0.7);
    min-height: 44px;
    flex-wrap: wrap;
  }

  .strip-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255,255,255,0.5);
    flex-shrink: 0;
  }

  .strip-dot.strip-positive {
    background: #FFD23F;
  }

  .strip-label {
    font-weight: var(--font-weight-semibold);
    color: rgba(255,255,255,0.85);
    text-transform: uppercase;
    font-size: var(--font-size-xs);
    letter-spacing: 0.05em;
  }

  .strip-values {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }

  .strip-values strong {
    color: rgba(255,255,255,0.85);
    font-weight: var(--font-weight-semibold);
    font-variant-numeric: tabular-nums;
  }

  .strip-sep {
    opacity: 0.4;
  }

  .strip-outstanding {
    font-weight: var(--font-weight-semibold);
    font-variant-numeric: tabular-nums;
    color: rgba(255,255,255,0.7);
  }

  .strip-outstanding.strip-positive {
    color: #FFD23F;
  }

  /* ═══════════════════════════════════════
     RESPONSIVE
     ═══════════════════════════════════════ */

  @media (max-width: 768px) {
    .hero-vault {
      width: 100%;
      box-sizing: border-box;
      margin-bottom: var(--space-md);
    }

    .vault-hero {
      padding: var(--space-lg) var(--space-md) var(--space-sm);
    }

    .vault-glow {
      width: 280px;
      height: 200px;
    }

    .vault-value {
      font-size: clamp(28px, 8vw, 48px);
    }

    .vault-metrics {
      flex-direction: column;
      align-items: stretch;
      gap: var(--space-sm);
      width: 100%;
      padding: 0 var(--space-md) var(--space-md);
    }

    .vault-tile {
      width: 100%;
      min-width: unset;
    }

    .vault-pill {
      align-self: flex-start;
    }

    .vault-lending {
      padding: var(--space-sm) var(--space-md);
    }

    .lending-strip {
      gap: 6px;
    }

    .strip-values {
      font-size: var(--font-size-xs);
    }
  }

  @media (max-width: 480px) {
    .vault-hero {
      padding: var(--space-md) var(--space-sm) var(--space-xs);
    }

    .vault-glow {
      width: 200px;
      height: 140px;
    }

    .vault-value {
      font-size: clamp(1.25rem, 6vw, 1.75rem);
    }

    .vault-metrics {
      padding: 0 var(--space-sm) var(--space-sm);
      gap: var(--space-xs);
    }

    .vault-pill {
      align-self: stretch;
      justify-content: center;
    }

    .vault-lending {
      padding: var(--space-sm);
    }

    .lending-strip {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-xs);
    }

    .strip-values {
      width: 100%;
    }
  }

  @media (max-width: 375px) {
    .vault-value {
      font-size: clamp(1.1rem, 5vw, 1.4rem);
    }
    .vault-eyebrow {
      font-size: 10px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .vault-sheen {
      animation: none;
      display: none;
    }
    .vault-glow {
      display: none;
    }
  }

  @media (pointer: fine) {
    .hero-vault {
      transition: transform 300ms var(--ease), box-shadow 300ms var(--ease);
    }
    .hero-vault:hover {
      transform: translateY(-2px);
      box-shadow: var(--glow-card), 0 8px 32px rgba(43, 168, 162, 0.30);
    }
  }
</style>
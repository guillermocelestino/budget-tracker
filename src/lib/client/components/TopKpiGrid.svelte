<script lang="ts">
  import { onMount } from 'svelte';
  import { formatCurrency, countUp } from '$lib/client/utils/format';
  import Sparkline from './Sparkline.svelte';

  let {
    balance = 0,
    savingsRate = 0,
    income = 0,
    incomeChange = 0,
    incomeTrend = [] as number[],
    incomeLabels = [] as string[],
    expenses = 0,
    expenseChange = 0,
    expenseTrend = [] as number[],
    expenseLabels = [] as string[],
    budgeted = 0,
  }: {
    balance?: number;
    savingsRate?: number;
    income?: number;
    incomeChange?: number;
    incomeTrend?: number[];
    incomeLabels?: string[];
    expenses?: number;
    expenseChange?: number;
    expenseTrend?: number[];
    expenseLabels?: string[];
    budgeted?: number;
  } = $props();

  // Animated Net Balance
  let dispBalance = $state(0);
  let dispIncome = $state(0);
  let dispExpenses = $state(0);

  onMount(() => {
    countUp(Math.abs(balance), 800, (v) => (dispBalance = v));
    countUp(income, 600, (v) => (dispIncome = v));
    countUp(expenses, 600, (v) => (dispExpenses = v));
  });

  // Safe to Spend derived logic
  const availableSpend = $derived(income - budgeted - expenses);
  const isSafePositive = $derived(availableSpend >= 0);
  const pctUsed = $derived(
    income > 0 ? Math.min(100, Math.round(((expenses + budgeted) / income) * 100)) : 0
  );

  const balanceSign = $derived(balance < 0 ? '−' : '');
</script>

<div class="top-kpi-grid">
  <!-- CARD 1: NET BALANCE -->
  <div class="kpi-card flip7-card accent-gold">
    <div class="kpi-head">
      <span class="kpi-label">Net Balance</span>
      {#if savingsRate != null}
        <span class="kpi-pill pill-gold">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="9"/>
            <path d="M8 12h8 M12 8v8"/>
          </svg>
          {savingsRate.toFixed(0)}% saved
        </span>
      {/if}
    </div>
    <div class="kpi-body">
      <span class="kpi-value hero-val" class:negative={balance < 0}>
        <span class="kpi-curr">{balanceSign}</span>{formatCurrency(Math.abs(dispBalance))}
      </span>
      <span class="kpi-subtext">Current monthly balance</span>
    </div>
  </div>

  <!-- CARD 2: TOTAL INCOME -->
  <a href="/transactions?type=income" class="kpi-card flip7-card accent-teal">
    <div class="kpi-head">
      <span class="kpi-label">Total Income</span>
      {#if incomeChange !== undefined}
        <span class="kpi-pill" class:pill-good={incomeChange >= 0} class:pill-bad={incomeChange < 0}>
          {incomeChange > 0 ? '↑ +' : incomeChange < 0 ? '↓ ' : '→ '}{incomeChange.toFixed(1)}%
        </span>
      {/if}
    </div>
    <div class="kpi-body">
      <span class="kpi-value text-teal">
        +{formatCurrency(dispIncome)}
      </span>
      {#if incomeTrend.length > 1}
        <div class="kpi-spark">
          <Sparkline labels={incomeLabels} data={incomeTrend} />
        </div>
      {/if}
    </div>
  </a>

  <!-- CARD 3: TOTAL EXPENSES -->
  <a href="/transactions?type=expense" class="kpi-card flip7-card accent-coral">
    <div class="kpi-head">
      <span class="kpi-label">Total Expenses</span>
      {#if expenseChange !== undefined}
        <span class="kpi-pill" class:pill-good={expenseChange <= 0} class:pill-bad={expenseChange > 0}>
          {expenseChange > 0 ? '↑ +' : expenseChange < 0 ? '↓ ' : '→ '}{expenseChange.toFixed(1)}%
        </span>
      {/if}
    </div>
    <div class="kpi-body">
      <span class="kpi-value text-coral">
        −{formatCurrency(dispExpenses)}
      </span>
      {#if expenseTrend.length > 1}
        <div class="kpi-spark">
          <Sparkline labels={expenseLabels} data={expenseTrend} />
        </div>
      {/if}
    </div>
  </a>

  <!-- CARD 4: SAFE TO SPEND -->
  <div class="kpi-card flip7-card accent-gold">
    <div class="kpi-head">
      <span class="kpi-label">Available to Spend</span>
      <span class="kpi-pct-badge">{pctUsed}% used</span>
    </div>
    <div class="kpi-body">
      <span class="kpi-value" class:text-teal={isSafePositive} class:text-coral={!isSafePositive}>
        {isSafePositive ? '' : '−'}{formatCurrency(Math.abs(availableSpend))}
      </span>
      <div class="kpi-meter">
        <div
          class="kpi-meter-fill"
          class:fill-ok={pctUsed <= 80}
          class:fill-warn={pctUsed > 80 && pctUsed <= 100}
          class:fill-over={pctUsed > 100}
          style="width: {Math.min(pctUsed, 100)}%"
        ></div>
      </div>
    </div>
  </div>
</div>

<style>
  /* ═══════════════════════════════════════════════════════
     TOP KPI GRID — Flip7 Above The Fold Cards
     ══════════════════════════════════════════════════════ */

  .top-kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-md);
    margin-bottom: var(--space-xl);
  }

  .kpi-card {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: var(--space-lg);
    background: var(--color-surface);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-card);
    text-decoration: none;
    color: inherit;
    transition: transform 180ms var(--bounce), box-shadow 180ms var(--ease);
    min-height: 140px;
  }

  @media (pointer: fine) {
    .kpi-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--glow-card);
    }
  }

  .kpi-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-xs);
  }

  .kpi-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }

  /* Pill Badges */
  .kpi-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: var(--radius-pill);
    font-size: 10px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .pill-gold {
    background: var(--color-gold-bg);
    color: var(--color-gold-dark);
  }

  .pill-good {
    background: var(--color-teal-bg);
    color: var(--color-teal);
  }

  .pill-bad {
    background: rgba(239, 108, 74, 0.12);
    color: var(--color-coral);
  }

  .kpi-pct-badge {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 600;
    color: var(--color-text-muted);
  }

  .kpi-body {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: var(--space-sm);
  }

  .kpi-value {
    font-family: var(--font-display);
    font-size: var(--font-size-xl);
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
    line-height: 1.1;
    color: var(--color-ink);
  }

  .kpi-value.hero-val {
    font-size: clamp(1.5rem, 2vw, 1.85rem);
  }

  .kpi-value.negative { color: var(--color-coral); }
  .text-teal { color: var(--color-teal); }
  .text-coral { color: var(--color-coral); }

  .kpi-curr {
    color: var(--color-gold-dark);
    font-weight: 700;
    font-size: 0.85em;
  }

  .kpi-subtext {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  /* Sparkline */
  .kpi-spark {
    height: 28px;
    margin-top: 4px;
    width: 100%;
  }

  .kpi-spark :global(.sparkline-container) {
    height: 28px;
  }

  /* Meter Bar for Safe to Spend */
  .kpi-meter {
    width: 100%;
    height: 6px;
    background: var(--color-hairline);
    border-radius: var(--radius-pill);
    overflow: hidden;
    margin-top: 6px;
  }

  .kpi-meter-fill {
    height: 100%;
    border-radius: var(--radius-pill);
    transition: width 500ms var(--ease);
  }

  .fill-ok { background: var(--color-teal); }
  .fill-warn { background: var(--color-gold-dark); }
  .fill-over { background: var(--color-coral); }

  /* ═══════════════════════════════════════════════════════
     RESPONSIVE
     ══════════════════════════════════════════════════════ */

  @media (max-width: 1024px) {
    .top-kpi-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 580px) {
    .top-kpi-grid {
      grid-template-columns: 1fr;
      gap: var(--space-sm);
    }

    .kpi-card {
      padding: var(--space-md);
      min-height: auto;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .kpi-card { transition: none; }
  }
</style>

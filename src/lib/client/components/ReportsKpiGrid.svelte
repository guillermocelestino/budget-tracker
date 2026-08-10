<script lang="ts">
  import { onMount } from 'svelte';
  import { formatCurrency, countUp } from '$lib/client/utils/format';

  let {
    income = 0,
    incomeChange = 0,
    expenses = 0,
    expenseChange = 0,
    netSavings = 0,
    savingsRate = 0,
  }: {
    income?: number;
    incomeChange?: number;
    expenses?: number;
    expenseChange?: number;
    netSavings?: number;
    savingsRate?: number;
  } = $props();

  let dispIncome = $state(0);
  let dispExpenses = $state(0);
  let dispNet = $state(0);

  onMount(() => {
    countUp(income, 700, (v) => (dispIncome = v));
    countUp(expenses, 700, (v) => (dispExpenses = v));
    countUp(Math.abs(netSavings), 700, (v) => (dispNet = v));
  });

  const netSign = $derived(netSavings < 0 ? '−' : '');
  const isNetPositive = $derived(netSavings >= 0);
</script>

<div class="reports-kpi-grid">
  <!-- CARD 1: TOTAL INCOME -->
  <div class="kpi-card flip7-card accent-teal">
    <div class="kpi-head">
      <span class="kpi-label">Total Income</span>
      <span class="kpi-pill" class:pill-good={incomeChange >= 0} class:pill-bad={incomeChange < 0}>
        {incomeChange > 0 ? '↑ +' : incomeChange < 0 ? '↓ ' : '→ '}{incomeChange}%
      </span>
    </div>
    <div class="kpi-body">
      <span class="kpi-value text-teal">
        +{formatCurrency(dispIncome)}
      </span>
      <span class="kpi-subtext">Selected period income</span>
    </div>
  </div>

  <!-- CARD 2: TOTAL EXPENSES -->
  <div class="kpi-card flip7-card accent-coral">
    <div class="kpi-head">
      <span class="kpi-label">Total Expenses</span>
      <span class="kpi-pill" class:pill-good={expenseChange <= 0} class:pill-bad={expenseChange > 0}>
        {expenseChange > 0 ? '↑ +' : expenseChange < 0 ? '↓ ' : '→ '}{expenseChange}%
      </span>
    </div>
    <div class="kpi-body">
      <span class="kpi-value text-coral">
        −{formatCurrency(dispExpenses)}
      </span>
      <span class="kpi-subtext">Selected period expenses</span>
    </div>
  </div>

  <!-- CARD 3: NET SAVINGS -->
  <div class="kpi-card flip7-card accent-gold">
    <div class="kpi-head">
      <span class="kpi-label">Net Savings</span>
      <span class="kpi-pill" class:pill-good={isNetPositive} class:pill-bad={!isNetPositive}>
        {isNetPositive ? 'Surplus' : 'Deficit'}
      </span>
    </div>
    <div class="kpi-body">
      <span class="kpi-value" class:text-teal={isNetPositive} class:text-coral={!isNetPositive}>
        {netSign}{formatCurrency(dispNet)}
      </span>
      <span class="kpi-subtext">Income minus expenses</span>
    </div>
  </div>

  <!-- CARD 4: SAVINGS RATE -->
  <div class="kpi-card flip7-card accent-gold">
    <div class="kpi-head">
      <span class="kpi-label">Savings Rate</span>
      <span class="kpi-pct-badge">{savingsRate}% saved</span>
    </div>
    <div class="kpi-body">
      <span class="kpi-value text-gold-dark">
        {savingsRate.toFixed(0)}%
      </span>
      <div class="kpi-meter">
        <div
          class="kpi-meter-fill"
          style="width: {Math.min(Math.max(savingsRate, 0), 100)}%"
        ></div>
      </div>
    </div>
  </div>
</div>

<style>
  /* ═══════════════════════════════════════════════════════
     REPORTS KPI GRID — Flip7 Above The Fold Summary Cards
     ══════════════════════════════════════════════════════ */

  .reports-kpi-grid {
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
    transition: transform 180ms var(--bounce), box-shadow 180ms var(--ease);
    min-height: 120px;
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
    font-size: clamp(1.4rem, 2vw, 1.75rem);
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
    line-height: 1.1;
    color: var(--color-ink);
  }

  .text-teal { color: var(--color-teal); }
  .text-coral { color: var(--color-coral); }
  .text-gold-dark { color: var(--color-gold-dark); }

  .kpi-subtext {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  /* Meter Bar */
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
    background: var(--color-gold-dark);
    border-radius: var(--radius-pill);
    transition: width 500ms var(--ease);
  }

  /* ═══════════════════════════════════════════════════════
     RESPONSIVE
     ══════════════════════════════════════════════════════ */

  @media (max-width: 1024px) {
    .reports-kpi-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 580px) {
    .reports-kpi-grid {
      grid-template-columns: 1fr;
      gap: var(--space-sm);
    }

    .kpi-card {
      padding: var(--space-md);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .kpi-card { transition: none; }
  }
</style>

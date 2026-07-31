<script lang="ts">
  import { formatCurrency, countUp } from '$lib/utils/format';
  import Sparkline from './Sparkline.svelte';

  let {
    income = 0,
    incomeChange = 0,
    incomeTrend = [] as number[],
    incomeLabels = [] as string[],
    expenses = 0,
    expenseChange = 0,
    expenseTrend = [] as number[],
    expenseLabels = [] as string[],
    lentOutstanding = 0,
    recovered = 0,
    borrowedOutstanding = 0,
    repaid = 0,
  }: {
    income?: number;
    incomeChange?: number;
    incomeTrend?: number[];
    incomeLabels?: string[];
    expenses?: number;
    expenseChange?: number;
    expenseTrend?: number[];
    expenseLabels?: string[];
    lentOutstanding?: number;
    recovered?: number;
    borrowedOutstanding?: number;
    repaid?: number;
  } = $props();

  // ─── Count-up animations ──────────────────────────────────────
  let dispIncome = $state(0);
  let dispExpenses = $state(0);
  let dispLent = $state(0);
  let dispBorrowed = $state(0);

  $effect(() => {
    const c1 = countUp(income, 600, (v) => dispIncome = v);
    const c2 = countUp(expenses, 600, (v) => dispExpenses = v);
    const c3 = countUp(lentOutstanding, 600, (v) => dispLent = v);
    const c4 = countUp(borrowedOutstanding, 600, (v) => dispBorrowed = v);
    return () => { c1(); c2(); c3(); c4(); };
  });


  // ─── Good/bad helpers ────────────────────────────────────────
  function deltaColor(change: number, invert: boolean): string {
    if (change === 0) return 'var(--color-text-muted)';
    // invert=true for expenses: positive change = bad (coral)
    const isGood = invert ? change < 0 : change > 0;
    return isGood ? 'var(--color-positive)' : 'var(--color-negative)';
  }

  function deltaArrow(change: number, invert: boolean): string {
    if (change > 0) return invert ? '↑' : '↑';
    if (change < 0) return invert ? '↓' : '↓';
    return '→';
  }

  function goodBad(change: number, invert: boolean): string {
    if (change === 0) return 'neutral';
    return invert ? (change < 0 ? 'good' : 'bad') : (change > 0 ? 'good' : 'bad');
  }

  const incomeGood = $derived(goodBad(incomeChange, false));
  const expenseGood = $derived(goodBad(expenseChange, true));
</script>

<div class="rail-outer">
  <div
    class="rail-inner"
  >
    <!-- ═══ Card 1: Income ═══ -->
    <a href="/transactions?type=income" class="kpi-card">
      <div class="kpi-accent teal"></div>
      <div class="kpi-body">
        <span class="kpi-label">Income</span>
        <span class="kpi-value">{formatCurrency(dispIncome)}</span>
        {#if incomeChange !== 0}
          <span class="kpi-delta {incomeGood}" style="--delta-color: {deltaColor(incomeChange, false)}">
            <span class="delta-arrow">{deltaArrow(incomeChange, false)}</span>
            {incomeChange > 0 ? '+' : ''}{incomeChange.toFixed(1)}%
          </span>
        {/if}
      </div>
      {#if incomeTrend.length > 1}
        <div class="kpi-spark">
          <Sparkline labels={incomeLabels} data={incomeTrend} />
        </div>
      {/if}
    </a>

    <!-- ═══ Card 2: Expenses ═══ -->
    <a href="/transactions?type=expense" class="kpi-card">
      <div class="kpi-accent coral"></div>
      <div class="kpi-body">
        <span class="kpi-label">Expenses</span>
        <span class="kpi-value">{formatCurrency(dispExpenses)}</span>
        {#if expenseChange !== 0}
          <span class="kpi-delta {expenseGood}" style="--delta-color: {deltaColor(expenseChange, true)}">
            <span class="delta-arrow">{deltaArrow(expenseChange, true)}</span>
            {expenseChange > 0 ? '+' : ''}{expenseChange.toFixed(1)}%
          </span>
        {/if}
      </div>
      {#if expenseTrend.length > 1}
        <div class="kpi-spark">
          <Sparkline labels={expenseLabels} data={expenseTrend} />
        </div>
      {/if}
    </a>

    <!-- ═══ Card 3: Lent Out ═══ -->
    <a href="/lending" class="kpi-card">
      <div class="kpi-accent gold"></div>
      <div class="kpi-body">
        <span class="kpi-label">Lent Out</span>
        <span class="kpi-value">{formatCurrency(dispLent)}</span>
        {#if recovered > 0}
          <span class="kpi-delta good" style="--delta-color: var(--color-positive)">
            <span class="delta-arrow">↑</span>
            {formatCurrency(recovered)} recovered
          </span>
        {/if}
      </div>
    </a>

    <!-- ═══ Card 4: Owe ═══ -->
    <a href="/borrowed" class="kpi-card">
      <div class="kpi-accent sky"></div>
      <div class="kpi-body">
        <span class="kpi-label">Owe</span>
        <span class="kpi-value">{formatCurrency(dispBorrowed)}</span>
        {#if repaid > 0}
          <span class="kpi-delta good" style="--delta-color: var(--color-positive)">
            <span class="delta-arrow">↑</span>
            {formatCurrency(repaid)} repaid
          </span>
        {/if}
      </div>
    </a>
  </div>
</div>

<style>
  /* ─── Rail outer — constrains width, shows at ≤640px ─── */
  .rail-outer {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    margin-bottom: var(--space-lg);
    display: none;
  }

  /* ─── Rail inner — canonical horizontal scroll recipe ─── */
  .rail-inner {
    display: flex;
    flex-wrap: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scroll-snap-type: x proximity;
    gap: var(--space-md);
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
    padding-inline: var(--space-md);
    touch-action: pan-x pan-y;
    scrollbar-width: none;
  }

  .rail-inner::-webkit-scrollbar {
    display: none;
  }

  /* ─── KPI Card ─── */
  .kpi-card {
    flex: 0 0 auto;
    width: min(78vw, 280px);
    min-width: 0;
    scroll-snap-align: start;
    position: relative;
    background: var(--color-surface);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-xl);
    padding: var(--space-md) var(--space-lg);
    padding-left: calc(var(--space-lg) + 12px);
    box-shadow: var(--shadow-card);
    text-decoration: none;
    color: inherit;
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    transition: transform 200ms var(--bounce), box-shadow 200ms var(--ease);
    -webkit-tap-highlight-color: transparent;
    overflow: hidden;
  }

  .kpi-card:active {
    transform: scale(0.97);
  }

  @media (pointer: fine) {
    .kpi-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--glow-card);
    }
  }

  /* ─── Left accent bar ─── */
  .kpi-accent {
    position: absolute;
    left: 0;
    top: 4px;
    bottom: 4px;
    width: 5px;
    border-radius: 0 3px 3px 0;
  }

  .kpi-accent.teal { background: var(--color-teal); }
  .kpi-accent.coral { background: var(--color-coral); }
  .kpi-accent.gold { background: var(--color-gold); }
  .kpi-accent.sky { background: var(--color-sky); }

  /* ─── Card body ─── */
  .kpi-body {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .kpi-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  .kpi-value {
    font-family: var(--font-display);
    font-size: var(--font-size-xl);
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
    line-height: 1.15;
    color: var(--color-ink);
  }

  .kpi-delta {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: var(--font-size-xs);
    font-weight: 700;
    margin-top: 2px;
    font-variant-numeric: tabular-nums;
  }

  .kpi-delta.good { color: var(--color-positive); }
  .kpi-delta.bad { color: var(--color-negative); }
  .kpi-delta.neutral { color: var(--color-text-muted); }

  .delta-arrow {
    font-size: 10px;
  }

  /* ─── Sparkline ─── */
  .kpi-spark {
    height: 32px;
    margin-top: var(--space-xs);
    width: 100%;
  }

  .kpi-spark :global(.sparkline-container) {
    height: 32px;
  }

  @media (max-width: 640px) {
    .rail-outer {
      display: flex;
      flex-direction: column;
    }
  }
</style>

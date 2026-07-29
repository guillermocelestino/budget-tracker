<script lang="ts">
  import { formatCurrency } from '$lib/utils/format';

  let {
    currentMonth = { income: 0, expense: 0, balance: 0 },
    previousMonth = { income: 0, expense: 0, balance: 0 },
    changes = { monthIncomeChange: 0, monthExpenseChange: 0 },
    topExpenseName = '',
    topExpenseAmount = 0,
    topExpensePct = 0,
    timeframe = '1M',
    onTimeframeChange,
  }: {
    currentMonth: { income: number; expense: number; balance: number };
    previousMonth: { income: number; expense: number; balance: number };
    changes: { monthIncomeChange: number; monthExpenseChange: number };
    topExpenseName?: string;
    topExpenseAmount?: number;
    topExpensePct?: number;
    timeframe?: string;
    onTimeframeChange?: (tf: string) => void;
  } = $props();

  const timeframes = ['1W', '1M', '3M', 'YTD', '1Y', 'All'];

  // ─── Derived insights ────────────────────────────────────────────

  const spendingDirection = $derived(changes.monthExpenseChange > 0 ? 'up' : 'down');
  const spendingAbs = $derived(Math.abs(changes.monthExpenseChange));
  const savingsCurrent = $derived(currentMonth.balance);
  const savingsPrev = $derived(previousMonth.balance);
  const savingsDiff = $derived(savingsCurrent - savingsPrev);
  const savingsDirection = $derived(savingsDiff >= 0 ? 'more' : 'less');
  const savingsAbs = $derived(Math.abs(savingsDiff));

  const hasSpendingInsight = $derived(changes.monthExpenseChange !== 0);
  const hasSavingsInsight = $derived(savingsDiff !== 0);
  const hasTopExpense = $derived(topExpenseName && topExpenseAmount > 0);
</script>

<!-- ═══ Timeframe Segmented Pill ═══ -->
<div class="timeframe-bar">
  <div class="timeframe-pill">
    {#each timeframes as tf}
      <button
        class="tf-btn"
        class:active={timeframe === tf}
        onclick={() => onTimeframeChange?.(tf)}
      >
        {tf}
      </button>
    {/each}
    <button class="tf-btn calendar-btn" title="Custom date range">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
        <line x1="16" x2="16" y1="2" y2="6"/>
        <line x1="8" x2="8" y1="2" y2="6"/>
        <line x1="3" x2="21" y1="10" y2="10"/>
      </svg>
    </button>
  </div>
</div>

<!-- ═══ Insight Cards ═══ -->
<div class="insight-grid">
  <!-- Card 1: Spending change -->
  {#if hasSpendingInsight}
    <div class="insight-card" class:negative={changes.monthExpenseChange > 0} class:positive={changes.monthExpenseChange <= 0}>
      <div class="insight-ribbon"></div>
      <div class="insight-icon">
        {#if spendingDirection === 'up'}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>
          </svg>
        {:else}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>
          </svg>
        {/if}
      </div>
      <div class="insight-body">
        <p class="insight-headline">
          Spending is {spendingDirection} {spendingAbs}%
        </p>
        <p class="insight-context">
          vs previous period · {formatCurrency(previousMonth.expense)} → {formatCurrency(currentMonth.expense)}
        </p>
      </div>
    </div>
  {/if}

  <!-- Card 2: Savings change -->
  {#if hasSavingsInsight}
    <div class="insight-card" class:positive={savingsDiff >= 0} class:negative={savingsDiff < 0}>
      <div class="insight-ribbon"></div>
      <div class="insight-icon">
        {#if savingsDiff >= 0}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v1h6V5a3 3 0 0 0-3-3z"/>
            <path d="M5 8h14a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/>
            <path d="M3 12h18v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7z"/>
          </svg>
        {:else}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 4l16 16"/><circle cx="12" cy="12" r="10"/>
          </svg>
        {/if}
      </div>
      <div class="insight-body">
        <p class="insight-headline">
          You saved {formatCurrency(savingsAbs)} {savingsDirection} than last month
        </p>
        <p class="insight-context">
          {formatCurrency(savingsPrev)} → {formatCurrency(savingsCurrent)} net
        </p>
      </div>
    </div>
  {/if}

  <!-- Card 3: Top expense category -->
  {#if hasTopExpense}
    <div class="insight-card">
      <div class="insight-ribbon"></div>
      <div class="insight-icon top">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
          <polyline points="17 6 23 6 23 12"/>
        </svg>
      </div>
      <div class="insight-body">
        <p class="insight-headline">Most spent on {topExpenseName}</p>
        <p class="insight-context">{formatCurrency(topExpenseAmount)} · {topExpensePct.toFixed(1)}% of expenses</p>
      </div>
    </div>
  {/if}
</div>

<style>
  /* ═══════════════════════════════════════════════════════════════════
     TIMEFRAME PILL — Flip7
     ═══════════════════════════════════════════════════════════════════ */

  .timeframe-bar {
    margin-bottom: var(--space-lg);
  }

  .timeframe-pill {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    background: var(--color-bg);
    padding: 4px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--color-border);
  }

  .tf-btn {
    padding: 8px 18px;
    border: none;
    border-radius: var(--radius-pill);
    background: transparent;
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    color: var(--color-text-muted);
    cursor: pointer;
    min-height: 36px;
    transition: all 200ms var(--ease);
    white-space: nowrap;
  }

  .tf-btn:hover:not(.active):not(.calendar-btn) {
    color: var(--color-ink);
    background: var(--color-teal-bg);
  }

  .tf-btn.active {
    background: var(--color-teal);
    color: #fff;
    font-weight: 700;
    box-shadow: var(--glow-card);
  }

  .calendar-btn {
    padding: 8px 10px;
    margin-left: 4px;
    color: var(--color-text-muted);
    display: flex;
    align-items: center;
  }

  .calendar-btn:hover {
    color: var(--color-teal);
  }

  /* ═══════════════════════════════════════════════════════════════════
     INSIGHT CARDS — Flip7 folded-ribbon
     ═══════════════════════════════════════════════════════════════════ */

  .insight-grid {
    display: flex;
    gap: var(--space-md);
    margin-bottom: var(--space-lg);
    flex-wrap: wrap;
  }

  .insight-card {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: var(--space-md);
    flex: 1;
    min-width: 240px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    padding: var(--space-md) var(--space-lg);
    padding-top: calc(var(--space-md) + 3px);
    transition: all 250ms var(--bounce);
    overflow: hidden;
  }

  .insight-card:hover {
    box-shadow: var(--shadow-card);
    transform: translateY(-2px);
  }

  .insight-ribbon {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
  }

  .insight-card.positive .insight-ribbon {
    background: linear-gradient(90deg, var(--color-teal), var(--color-gold));
  }

  .insight-card.negative .insight-ribbon {
    background: linear-gradient(90deg, var(--color-coral), var(--color-gold));
  }

  .insight-card:not(.positive):not(.negative) .insight-ribbon {
    background: linear-gradient(90deg, var(--color-sky), var(--color-teal));
  }

  /* ─── Insight icon ─── */
  .insight-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-lg);
    flex-shrink: 0;
    background: var(--color-teal-bg);
    color: var(--color-teal);
  }

  .insight-card.positive .insight-icon {
    background: var(--color-teal-bg);
    color: var(--color-teal);
  }

  .insight-card.negative .insight-icon {
    background: rgba(239, 108, 74, 0.10);
    color: var(--color-coral);
  }

  .insight-icon.top {
    background: linear-gradient(135deg, var(--color-gold), var(--color-gold-light));
    color: var(--color-ink);
  }

  /* ─── Insight text ─── */
  .insight-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .insight-headline {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    color: var(--color-ink);
    line-height: 1.3;
  }

  .insight-context {
    margin: 0;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    line-height: 1.4;
  }

  /* ─── Responsive ─── */
  @media (max-width: 768px) {
    .insight-card {
      min-width: 100%;
    }

    .timeframe-pill {
      display: flex;
      width: 100%;
    }

    .tf-btn {
      flex: 1;
      padding: 8px 8px;
      font-size: 12px;
      min-width: 0;
      text-align: center;
    }
  }
</style>

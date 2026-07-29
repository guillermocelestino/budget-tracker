<script lang="ts">
  import { formatCurrency } from '$lib/utils/format';
  import type { Transaction } from '$lib/types';

  let {
    transactions = [] as Transaction[],
    activeType = '',
    onCardClick,
  }: {
    transactions: Transaction[];
    activeType?: string;
    onCardClick?: (type: string) => void;
  } = $props();

  // ─── Derived totals from the filtered list ───────────────────────

  const totalIncome = $derived(
    transactions.reduce((sum, t) => (t.type === 'income' ? sum + t.amount : sum), 0)
  );
  const totalExpenses = $derived(
    transactions.reduce((sum, t) => (t.type === 'expense' ? sum + t.amount : sum), 0)
  );
  const netBalance = $derived(totalIncome - totalExpenses);

  // ─── Trend computation (vs the prior transaction period) ─────────

  // For a simple trend, compare the sum of the last 50% of transactions
  // against the first 50%. Gives a directional sense without needing
  // month-over-month data on the filtered list.
  const incomeTrend = $derived.by(() => {
    const incomeTxns = transactions.filter((t) => t.type === 'income');
    if (incomeTxns.length < 2) return null;
    const mid = Math.floor(incomeTxns.length / 2);
    const recent = incomeTxns.slice(0, mid).reduce((s, t) => s + t.amount, 0);
    const prior = incomeTxns.slice(mid).reduce((s, t) => s + t.amount, 0);
    if (prior === 0) return recent > 0 ? 100 : null;
    return Math.round(((recent - prior) / prior) * 100);
  });

  const expenseTrend = $derived.by(() => {
    const expenseTxns = transactions.filter((t) => t.type === 'expense');
    if (expenseTxns.length < 2) return null;
    const mid = Math.floor(expenseTxns.length / 2);
    const recent = expenseTxns.slice(0, mid).reduce((s, t) => s + t.amount, 0);
    const prior = expenseTxns.slice(mid).reduce((s, t) => s + t.amount, 0);
    if (prior === 0) return recent > 0 ? 100 : null;
    return Math.round(((recent - prior) / prior) * 100);
  });

  const netTrend = $derived.by(() => {
    if (transactions.length < 4) return null;
    const mid = Math.floor(transactions.length / 2);
    const recentIncome = transactions.slice(0, mid).filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const recentExpense = transactions.slice(0, mid).filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const priorIncome = transactions.slice(mid).filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const priorExpense = transactions.slice(mid).filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const recent = recentIncome - recentExpense;
    const prior = priorIncome - priorExpense;
    if (prior === 0) return recent > 0 ? 100 : recent < 0 ? -100 : null;
    return Math.round(((recent - prior) / Math.abs(prior)) * 100);
  });

  function trendIcon(trend: number | null): string {
    if (trend === null) return '';
    return trend > 0 ? '↑' : trend < 0 ? '↓' : '→';
  }

  function trendColor(trend: number | null, inverse: boolean = false): string {
    if (trend === null) return '';
    // For expenses, up is bad; for income/balance, up is good
    if (inverse) return trend > 0 ? 'negative' : trend < 0 ? 'positive' : '';
    return trend > 0 ? 'positive' : trend < 0 ? 'negative' : '';
  }

  function handleCardClick(type: string) {
    // If clicking the already-active card, deactivate (clear filter)
    onCardClick?.(activeType === type ? '' : type);
  }
</script>

<div class="summary-cards">
  <!-- ─── Income Card ─── -->
  <button
    class="card"
    class:active={activeType === 'income'}
    class:dimmed={activeType !== '' && activeType !== 'income'}
    onclick={() => handleCardClick('income')}
    aria-pressed={activeType === 'income'}
  >
    <div class="card-accent income-accent"></div>
    <div class="card-icon income-icon">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
        <polyline points="17 6 23 6 23 12"/>
      </svg>
    </div>
    <div class="card-content">
      <span class="card-label">Income</span>
      <span class="card-value">{formatCurrency(totalIncome)}</span>
      <span class="card-trend {trendColor(incomeTrend)}" class:inverse={false}>
        {#if incomeTrend !== null}
          {trendIcon(incomeTrend)} {Math.abs(incomeTrend)}% vs prior
        {:else if totalIncome > 0}
          Current period
        {/if}
      </span>
    </div>
  </button>

  <!-- ─── Expenses Card ─── -->
  <button
    class="card"
    class:active={activeType === 'expense'}
    class:dimmed={activeType !== '' && activeType !== 'expense'}
    onclick={() => handleCardClick('expense')}
    aria-pressed={activeType === 'expense'}
  >
    <div class="card-accent expense-accent"></div>
    <div class="card-icon expense-icon">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="23 18 14.5 10.5 9.5 15.5 1 6"/>
        <polyline points="7 18 1 18 1 12"/>
      </svg>
    </div>
    <div class="card-content">
      <span class="card-label">Expenses</span>
      <span class="card-value">{formatCurrency(totalExpenses)}</span>
      <span class="card-trend {trendColor(expenseTrend, true)}" class:inverse={true}>
        {#if expenseTrend !== null}
          {trendIcon(expenseTrend)} {Math.abs(expenseTrend)}% vs prior
        {:else if totalExpenses > 0}
          Current period
        {/if}
      </span>
    </div>
  </button>

  <!-- ─── Net Balance Card ─── -->
  <button
    class="card hero-card"
    class:active={activeType === 'net'}
    class:dimmed={activeType !== '' && activeType !== 'net'}
    class:negative={netBalance < 0}
    onclick={() => handleCardClick('net')}
    aria-pressed={activeType === 'net'}
  >
    <div class="card-accent net-accent"></div>
    <div class="card-icon net-icon">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="9"/>
        <path d="M8 12h8 M12 8v8"/>
      </svg>
    </div>
    <div class="card-content">
      <span class="card-label">Net Balance</span>
      <span class="card-value hero-value">{formatCurrency(netBalance)}</span>
      <span class="card-trend {trendColor(netTrend)}">
        {#if netTrend !== null}
          {trendIcon(netTrend)} {Math.abs(netTrend)}% vs prior
        {:else if transactions.length > 0}
          Current period
        {:else}
          No transactions
        {/if}
      </span>
    </div>
  </button>
</div>

<style>
  /* ═══════════════════════════════════════════════════════════════════
     TRANSACTION SUMMARY CARDS — Flip7 scoring tiles
     Colored left bars, clickable filter, gold glow on active
     ═══════════════════════════════════════════════════════════════════ */

  .summary-cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-md);
    margin-bottom: var(--space-lg);
  }

  /* ─── Card base ─── */
  .card {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: var(--space-md);
    padding: var(--space-lg);
    background: var(--color-surface);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-xl);
    cursor: pointer;
    font-family: var(--font-body);
    text-align: left;
    overflow: hidden;
    min-height: 120px;
    transition: all 250ms var(--bounce);
    -webkit-tap-highlight-color: transparent;
  }

  .card:hover {
    border-color: var(--color-teal);
    box-shadow: var(--glow-card);
    transform: translateY(-2px);
  }

  .card:active {
    transform: translateY(0) scale(0.98);
  }

  .card:focus-visible {
    outline: 2px solid var(--color-teal);
    outline-offset: 2px;
  }

  /* ─── Left accent bar ─── */
  .card-accent {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    border-radius: 0 2px 2px 0;
    transition: all 250ms var(--bounce);
  }

  .income-accent {
    background: var(--color-teal);
    box-shadow: var(--glow-card);
  }

  .expense-accent {
    background: var(--color-coral);
    box-shadow: var(--glow-coral);
  }

  .net-accent {
    background: var(--color-gold);
    box-shadow: var(--glow-gold);
  }

  /* Hero card negative net = coral bar */
  .hero-card.negative .net-accent {
    background: var(--color-coral);
    box-shadow: var(--glow-coral);
  }

  /* ─── Icon ─── */
  .card-icon {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-lg);
    flex-shrink: 0;
    z-index: 1;
  }

  .income-icon {
    background: var(--color-teal-bg);
    color: var(--color-teal);
  }

  .expense-icon {
    background: rgba(239, 108, 74, 0.10);
    color: var(--color-coral);
  }

  .net-icon {
    background: rgba(255, 210, 63, 0.15);
    color: var(--color-gold-dark);
  }

  .hero-card.negative .net-icon {
    background: rgba(239, 108, 74, 0.10);
    color: var(--color-coral);
  }

  /* ─── Content ─── */
  .card-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    z-index: 1;
    min-width: 0;
  }

  .card-label {
    font-family: var(--font-display);
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: none;
    letter-spacing: 0.02em;
    margin-bottom: 2px;
  }

  .card-value {
    font-size: 22px;
    font-weight: 700;
    color: var(--color-text);
    line-height: 1.2;
    font-family: var(--font-display);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
  }

  .hero-value {
    font-size: 26px;
    font-weight: 800;
  }

  /* ─── Trend chip ─── */
  .card-trend {
    display: inline-block;
    margin-top: 6px;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 10px;
    border-radius: var(--radius-pill);
    width: fit-content;
    background: var(--color-bg);
    color: var(--color-text-muted);
    font-family: var(--font-display);
  }

  .card-trend.positive {
    color: var(--color-teal);
    background: var(--color-teal-bg);
  }

  .card-trend.negative {
    color: var(--color-coral);
    background: rgba(239, 108, 74, 0.10);
  }

  /* ─── Active state (filter matches) — gold accent + glow ─── */
  .card.active {
    border-color: var(--color-gold);
    background: rgba(255, 210, 63, 0.06);
    box-shadow: var(--glow-gold);
    transform: scale(1.02);
  }

  .card.active .card-accent {
    background: var(--color-gold);
    box-shadow: var(--glow-gold);
  }

  .card.active .card-value {
    color: var(--color-ink);
  }

  .card.active .hero-value {
    color: var(--color-ink);
  }

  /* Hero card negative active — gold overrides negative */
  .hero-card.negative.active .card-accent {
    background: var(--color-gold);
    box-shadow: var(--glow-gold);
  }

  .hero-card.negative.active {
    border-color: var(--color-gold);
    background: rgba(255, 210, 63, 0.06);
    box-shadow: var(--glow-gold);
  }

  .hero-card.negative.active .card-value {
    color: var(--color-ink);
  }

  /* ─── Dimmed state (a different card is active) ─── */
  .card.dimmed {
    opacity: 0.45;
    transform: scale(0.98);
  }

  .card.dimmed:hover {
    opacity: 0.7;
    transform: scale(1);
  }

  /* ─── Responsive ─── */
  @media (max-width: 768px) {
    .summary-cards {
      grid-template-columns: 1fr;
      gap: var(--space-sm);
    }

    .card {
      min-height: auto;
      padding: var(--space-md);
      align-items: center;
    }

    .card-value {
      font-size: 20px;
    }

    .hero-value {
      font-size: 22px;
    }
  }

  @media (max-width: 480px) {
    .card-icon {
      width: 40px;
      height: 40px;
    }
  }
</style>

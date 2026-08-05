<script lang="ts">
  import SummaryCard from '$lib/components/SummaryCard.svelte';
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

  // Trend pills are colored by SENTIMENT, not arrow direction — a decrease in
  // expenses is good (teal), a decrease in net balance is bad (rose).
  function trendColor(trend: number | null, inverse: boolean = false): 'positive' | 'negative' | '' {
    if (trend === null) return '';
    if (inverse) return trend > 0 ? 'negative' : trend < 0 ? 'positive' : '';
    return trend > 0 ? 'positive' : trend < 0 ? 'negative' : '';
  }

  function buildTrend(
    trend: number | null,
    inverse: boolean,
    hasData: boolean,
    noDataText = ''
  ): { text: string; sentiment?: 'positive' | 'negative' } | undefined {
    if (trend !== null) {
      return { text: `${trendIcon(trend)} ${Math.abs(trend)}%`, sentiment: trendColor(trend, inverse) || undefined };
    }
    if (hasData) return { text: 'Current period' };
    return noDataText ? { text: noDataText } : undefined;
  }

  function handleCardClick(type: string) {
    // If clicking the already-active card, deactivate (clear filter)
    onCardClick?.(activeType === type ? '' : type);
  }
</script>

{#snippet incomeIcon()}
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
{/snippet}

{#snippet expenseIcon()}
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="23 18 14.5 10.5 9.5 15.5 1 6"/>
    <polyline points="7 18 1 18 1 12"/>
  </svg>
{/snippet}

{#snippet netIcon()}
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="9"/>
    <path d="M8 12h8 M12 8v8"/>
  </svg>
{/snippet}

<div class="summary-cards">
  <SummaryCard
    label="Income"
    value={totalIncome}
    tone="in"
    icon={incomeIcon}
    active={activeType === 'income'}
    dimmed={activeType !== '' && activeType !== 'income'}
    onclick={() => handleCardClick('income')}
    ariaPressed={activeType === 'income'}
    trend={buildTrend(incomeTrend, false, totalIncome > 0)}
  />
  <SummaryCard
    label="Expenses"
    value={totalExpenses}
    tone="out"
    icon={expenseIcon}
    active={activeType === 'expense'}
    dimmed={activeType !== '' && activeType !== 'expense'}
    onclick={() => handleCardClick('expense')}
    ariaPressed={activeType === 'expense'}
    trend={buildTrend(expenseTrend, true, totalExpenses > 0)}
  />
  <SummaryCard
    label="Net Balance"
    value={netBalance}
    tone="auto"
    hero
    className="hero-card"
    icon={netIcon}
    active={activeType === 'net'}
    dimmed={activeType !== '' && activeType !== 'net'}
    onclick={() => handleCardClick('net')}
    ariaPressed={activeType === 'net'}
    trend={buildTrend(netTrend, false, transactions.length > 0, 'No transactions')}
  />
</div>

<style>
  /* ─── Grid + responsive live here; the card internals live in SummaryCard.
     :global() reaches the child component's .card so the rail/hero placement
     rules keep working. ─── */
  .summary-cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-md);
    margin-bottom: var(--space-2xl);
  }

  /* Tablet: 2 columns, Net Balance spans the full row */
  @media (min-width: 769px) and (max-width: 1024px) {
    .summary-cards {
      grid-template-columns: repeat(2, 1fr);
    }

    :global(.summary-cards .card.hero-card) {
      grid-column: 1 / -1;
    }
  }

  /* Mobile: horizontal snap rail (cards no longer stack) */
  @media (max-width: 768px) {
    .summary-cards {
      display: flex;
      flex-wrap: nowrap;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scroll-snap-type: x proximity;
      touch-action: pan-x pan-y;
      gap: var(--space-sm);
      max-width: 100%;
      min-width: 0;
      scrollbar-width: none;
    }

    .summary-cards::-webkit-scrollbar {
      display: none;
    }

    :global(.summary-cards .card) {
      flex: 0 0 auto;
      width: min(72vw, 260px);
      min-height: auto;
      padding: var(--space-md);
      align-items: center;
      scroll-snap-align: start;
    }
  }
</style>

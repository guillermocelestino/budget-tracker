<script lang="ts">
  import { formatCurrency, countUp } from '$lib/client/utils/format';
  import SummaryCard from '$lib/client/components/SummaryCard.svelte';

  let {
    income = 0,
    incomeChange = 0,
    incomeTrend = [] as number[],
    expenses = 0,
    expenseChange = 0,
    expenseTrend = [] as number[],
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
</script>

<div class="rail-outer">
  <div class="rail-inner">
    <!-- ═══ Card 1: Income ═══ -->
    <SummaryCard
      label="Income"
      value={dispIncome}
      tone="in"
      href="/transactions?type=income"
      trend={incomeChange !== 0 ? { text: `${incomeChange > 0 ? '↑ +' : '↓ '}${Math.abs(incomeChange).toFixed(1)}%`, sentiment: incomeChange >= 0 ? 'positive' : 'negative' } : undefined}
      sparklineData={incomeTrend}
    />

    <!-- ═══ Card 2: Expenses ═══ -->
    <SummaryCard
      label="Expenses"
      value={dispExpenses}
      tone="out"
      href="/transactions?type=expense"
      trend={expenseChange !== 0 ? { text: `${expenseChange > 0 ? '↑ +' : '↓ '}${Math.abs(expenseChange).toFixed(1)}%`, sentiment: expenseChange <= 0 ? 'positive' : 'negative' } : undefined}
      sparklineData={expenseTrend}
    />

    <!-- ═══ Card 3: Lent Out ═══ -->
    <SummaryCard
      label="Lent Out"
      value={dispLent}
      tone="out"
      href="/lending"
      trend={recovered > 0 ? { text: `↑ ${formatCurrency(recovered)}`, sentiment: 'positive' } : undefined}
    />

    <!-- ═══ Card 4: Owe ═══ -->
    <SummaryCard
      label="Owe"
      value={dispBorrowed}
      tone="in"
      href="/borrowed"
      trend={repaid > 0 ? { text: `↑ ${formatCurrency(repaid)}`, sentiment: 'positive' } : undefined}
    />
  </div>
</div>

<style>
  /* ─── Rail outer — constrains width, shows at ≤768px ─── */
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

  .rail-inner :global(.card) {
    flex: 0 0 auto;
    width: min(78vw, 260px);
    min-width: 0;
    scroll-snap-align: start;
  }

  @media (max-width: 768px) {
    .rail-outer {
      display: flex;
      flex-direction: column;
    }
  }
</style>

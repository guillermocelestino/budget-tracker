<script lang="ts">
  import { onMount } from 'svelte';
  import { countUp } from '$lib/client/utils/format';
  import SummaryCard from '$lib/client/components/SummaryCard.svelte';

  let {
    balance = 0,
    savingsRate = 0,
    income = 0,
    incomeChange = 0,
    incomeTrend = [] as number[],
    expenses = 0,
    expenseChange = 0,
    expenseTrend = [] as number[],
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

  // Animated Net Balance & Values
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
</script>

<div class="top-kpi-grid">
  <!-- CARD 1: NET BALANCE -->
  <SummaryCard
    label="Net Balance"
    value={balance < 0 ? -dispBalance : dispBalance}
    tone="auto"
    hero
    trend={savingsRate != null ? { text: `↑ ${savingsRate.toFixed(0)}% saved`, sentiment: savingsRate >= 0 ? 'positive' : 'negative' } : undefined}
  />

  <!-- CARD 2: TOTAL INCOME -->
  <SummaryCard
    label="Total Income"
    value={dispIncome}
    tone="in"
    href="/transactions?type=income"
    trend={incomeChange !== undefined ? { text: `${incomeChange >= 0 ? '↑ +' : '↓ '}${Math.abs(incomeChange).toFixed(1)}%`, sentiment: incomeChange >= 0 ? 'positive' : 'negative' } : undefined}
    sparklineData={incomeTrend}
  />

  <!-- CARD 3: TOTAL EXPENSES -->
  <SummaryCard
    label="Total Expenses"
    value={dispExpenses}
    tone="out"
    href="/transactions?type=expense"
    trend={expenseChange !== undefined ? { text: `${expenseChange > 0 ? '↑ +' : '↓ '}${Math.abs(expenseChange).toFixed(1)}%`, sentiment: expenseChange <= 0 ? 'positive' : 'negative' } : undefined}
    sparklineData={expenseTrend}
  />

  <!-- CARD 4: AVAILABLE TO SPEND -->
  <SummaryCard
    label="Available to Spend"
    value={availableSpend}
    tone={isSafePositive ? 'in' : 'out'}
    trend={{ text: `${pctUsed}% used`, sentiment: pctUsed <= 80 ? 'positive' : 'negative' }}
  />
</div>

<style>
  .top-kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-md);
    margin-bottom: var(--space-xl);
  }

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
  }
</style>

<script lang="ts">
  import { page } from '$app/stores';
  import { getMonthLabel } from '$lib/shared/utils/format';
  import PageHeader from '$lib/client/components/PageHeader.svelte';
  import PageBackground from '$lib/client/components/PageBackground.svelte';
  import ReportsKpiGrid from '$lib/client/components/ReportsKpiGrid.svelte';
  import ReportsCategoryGrid from '$lib/client/components/ReportsCategoryGrid.svelte';
  import MonthlyTrendChart from '$lib/client/components/MonthlyTrendChart.svelte';
  import ReportsDataTable from '$lib/client/components/ReportsDataTable.svelte';
  import YearOverYearCard from '$lib/client/components/YearOverYearCard.svelte';
  import EmptyState from '$lib/client/components/EmptyState.svelte';

  let data = $derived($page.data as App.PageData);

  // ─── State ────────────────────────────────────────────────────────
  let selectedTimeframe = $state('1Y');
  const timeframes = ['1M', '3M', 'YTD', '1Y', 'All'];

  // ─── Empty condition flags ────────────────────────────────────────
  const allTimeCount = $derived(data.allTimeCount ?? 0);
  const hasAnyTransactions = $derived(allTimeCount > 0);

  // ─── Monthly data filtering ───────────────────────────────────────
  const allMonthly = $derived(data.monthlyData ?? []);

  const filteredMonthly = $derived.by(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    if (selectedTimeframe === '1M') {
      return allMonthly.filter(m => {
        const [y, mo] = m.month.split('-').map(Number);
        return y === currentYear && mo === currentMonth;
      });
    }
    if (selectedTimeframe === '3M') {
      const cutoff = currentMonth - 3 <= 0
        ? `${currentYear - 1}-${String(currentMonth + 9).padStart(2, '0')}`
        : `${currentYear}-${String(currentMonth - 3).padStart(2, '0')}`;
      return allMonthly.filter(m => m.month >= cutoff);
    }
    if (selectedTimeframe === 'YTD') {
      return allMonthly.filter(m => {
        const [y, mo] = m.month.split('-').map(Number);
        return y < currentYear || (y === currentYear && mo <= currentMonth);
      });
    }
    // '1Y' or 'All'
    return allMonthly;
  });

  const monthlyLabels = $derived(filteredMonthly.map(m => getMonthLabel(m.month)));
  const monthlyIncome = $derived(filteredMonthly.map(m => m.income));
  const monthlyExpense = $derived(filteredMonthly.map(m => m.expense));

  const monthlyRows = $derived(
    filteredMonthly.map(m => ({
      month: m.month,
      income: m.income,
      expense: m.expense,
    }))
  );

  // ─── Empty state flags ───────────────────────────────────────────
  const isRangeEmpty = $derived(filteredMonthly.length === 0 && hasAnyTransactions);
  const isTotalEmpty = $derived(!hasAnyTransactions);

  // ─── Current and previous period summaries ───────────────────────
  const currentSummary = $derived.by(() => {
    const m = filteredMonthly[filteredMonthly.length - 1];
    if (!m) return { income: 0, expense: 0, balance: 0 };
    return { income: m.income, expense: m.expense, balance: m.income - m.expense };
  });

  const previousSummary = $derived.by(() => {
    const m = filteredMonthly[filteredMonthly.length - 2];
    if (!m) return { income: 0, expense: 0, balance: 0 };
    return { income: m.income, expense: m.expense, balance: m.income - m.expense };
  });

  const changes = $derived.by(() => {
    const prev = previousSummary;
    const curr = currentSummary;
    function pct(a: number, b: number) {
      if (b === 0) return a > 0 ? 100 : 0;
      return Math.round(((a - b) / b) * 100);
    }
    return {
      monthIncomeChange: pct(curr.income, prev.income),
      monthExpenseChange: pct(curr.expense, prev.expense),
    };
  });

  // Savings rate calculation
  const savingsRateVal = $derived(
    currentSummary.income > 0
      ? Math.max(0, Math.round(((currentSummary.income - currentSummary.expense) / currentSummary.income) * 100))
      : 0
  );

  // ─── Top expense category ─────────────────────────────────────────
  const topExpense = $derived.by(() => {
    const sorted = [...(data.expenseData ?? [])].sort((a, b) => b.total - a.total);
    return sorted[0] || null;
  });

  const totalExpenseAmount = $derived(
    (data.expenseData ?? []).reduce((s, c) => s + c.total, 0)
  );

  const topExpensePct = $derived(
    topExpense && totalExpenseAmount > 0
      ? (topExpense.total / totalExpenseAmount) * 100
      : 0
  );

  // CSV Export parameters
  const hasExportableData = $derived(allMonthly.length > 0);
  const exportStart = $derived(filteredMonthly[0]?.month ?? '');
  const exportEnd = $derived(filteredMonthly[filteredMonthly.length - 1]?.month ?? '');
</script>

<svelte:head>
  <title>Analysis — Finance Tracker</title>
</svelte:head>

<PageHeader title="WHY IS MY MONEY MOVING THIS WAY?" flush borderless>
  {#snippet subtitle()}
    <div class="analysis-badge-row">
      <span class="analysis-badge">📊 ANALYSIS</span>
      <span class="context-subline">Patterns, trends, and financial behavior hiding behind your numbers.</span>
    </div>
  {/snippet}
  {#snippet action()}
    {#if hasExportableData}
      <a
        href="/api/reports/export?start={exportStart}&end={exportEnd}"
        class="btn-export"
        download
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" x2="12" y1="15" y2="3"/>
        </svg>
        Export CSV
      </a>
    {:else}
      <span class="btn-export btn-export-disabled" title="Nothing to export yet">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" x2="12" y1="15" y2="3"/>
        </svg>
        Export CSV
      </span>
    {/if}
  {/snippet}
</PageHeader>

<PageBackground />

<div class="page-container page-container--wide">

<!-- ═══ Timeframe Pill Control Bar ═══ -->
<div class="timeframe-bar">
  <div class="timeframe-pill">
    {#each timeframes as tf (tf)}
      <button
        class="tf-btn"
        class:active={selectedTimeframe === tf}
        onclick={() => selectedTimeframe = tf}
      >
        {tf}
      </button>
    {/each}
  </div>
</div>

<!-- ═══ Empty State Gates ═══ -->
{#if isTotalEmpty}
  <div class="empty-page-region">
    <EmptyState
      icon="🌱"
      title="Your analysis is waiting"
      description="Log a few transactions and this page turns into your money's story."
      actionLabel="Add a transaction"
      actionHref="/transactions/new"
    />
  </div>
{:else if isRangeEmpty}
  <div class="empty-page-region">
    <EmptyState
      icon="🔭"
      title="Nothing in this window"
      description="There's no activity in the selected period — try a wider range."
      actionLabel="Show all time"
      onAction={() => selectedTimeframe = 'All'}
      secondaryLabel="Add a transaction"
      secondaryHref="/transactions/new"
    />
  </div>
{:else}
  <div class="reports-shell">
    <!-- ════ LAYER 1: ANALYTICAL OVERVIEW ════ -->
    <section class="reports-section">
      <div class="section-label">ANALYTICAL OVERVIEW</div>
      <ReportsKpiGrid
        income={currentSummary.income}
        incomeChange={changes.monthIncomeChange}
        expenses={currentSummary.expense}
        expenseChange={changes.monthExpenseChange}
        netSavings={currentSummary.balance}
        savingsRate={savingsRateVal}
      />
    </section>

    <!-- ════ LAYER 2: PRIMARY TREND ANALYSIS (Cash Flow Line Chart) ════ -->
    <section class="reports-section">
      <div class="section-label">CASH FLOW & OUTFLOW TREND</div>
      <div class="trend-card flip7-card">
        <div class="card-header">
          <h2 class="card-title">Cash Flow & Outflow Trend</h2>
          <span class="card-subtitle">Monthly Income (↩ Money Returning) vs. Expenses (🔥 Money Gone) over time</span>
        </div>
        <div class="card-body">
          <MonthlyTrendChart
            labels={monthlyLabels}
            incomeData={monthlyIncome}
            expenseData={monthlyExpense}
          />
        </div>
      </div>
    </section>

    <!-- ════ LAYER 3: SECONDARY CATEGORY BREAKDOWN (2-Column Desktop Grid) ════ -->
    <section class="reports-section">
      <div class="section-label">CATEGORY CONCENTRATION</div>
      <ReportsCategoryGrid
        expenseCategories={data.expenseData ?? []}
        incomeCategories={data.incomeData ?? []}
        topExpenseName={topExpense?.category_name ?? ''}
        topExpenseAmount={topExpense?.total ?? 0}
        topExpensePct={topExpensePct}
      />
    </section>

    <!-- ════ LAYER 4: YEAR-OVER-YEAR / PERIOD COMPARISON ════ -->
    <section class="reports-section">
      <div class="section-label">PERIOD & YEAR-OVER-YEAR COMPARISON</div>
      <YearOverYearCard
        yoyData={data.yoyData}
        selectedMonth={getMonthLabel(data.month ?? '')}
      />
    </section>

    <!-- ════ LAYER 5: DETAILED MONTHLY BREAKDOWN TABLE ════ -->
    <section class="reports-section">
      <div class="section-label">MONTHLY BREAKDOWN</div>
      <div class="table-card flip7-card">
        <div class="card-header">
          <h2 class="card-title">Monthly Breakdown</h2>
          <span class="card-subtitle">Detailed financial ledger by month</span>
        </div>
        <div class="card-body">
          <ReportsDataTable data={monthlyRows} />
        </div>
      </div>
    </section>
  </div>
{/if}
</div>

<style>
  :global(.page-header) {
    position: relative;
    z-index: 30;
  }

  .analysis-badge-row {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    flex-wrap: wrap;
    margin-top: 2px;
  }

  .analysis-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: var(--radius-pill);
    background: var(--color-teal-bg);
    color: var(--color-true-position, var(--color-teal-dark));
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .context-subline {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    font-size: var(--font-size-xs);
    letter-spacing: 0.02em;
    color: var(--color-text-muted);
  }

  .section-label {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text-muted);
    margin-bottom: var(--space-xs);
  }

  /* ─── Export CSV Button ─── */
  .btn-export {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: var(--radius-pill);
    background: var(--color-teal-bg);
    color: var(--color-teal);
    font-size: var(--font-size-xs);
    font-weight: 700;
    text-decoration: none;
    transition: all 180ms var(--ease);
    border: 1px solid rgba(43, 168, 162, 0.2);
  }

  .btn-export:hover {
    background: var(--color-teal);
    color: #fff;
    box-shadow: var(--glow-card);
  }

  .btn-export-disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: var(--color-surface-inset);
    color: var(--color-text-muted);
    border-color: var(--color-hairline);
  }

  /* ─── Timeframe Control Bar ─── */
  .timeframe-bar {
    margin-bottom: var(--space-xl);
  }

  .timeframe-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--color-surface);
    padding: 4px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--color-hairline);
    box-shadow: var(--shadow-card);
  }

  .tf-btn {
    padding: 6px 16px;
    border: none;
    border-radius: var(--radius-pill);
    background: transparent;
    font-size: var(--font-size-xs);
    font-weight: 600;
    font-family: inherit;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 180ms var(--ease);
  }

  .tf-btn:hover:not(.active) {
    color: var(--color-ink);
    background: var(--color-teal-bg);
  }

  .tf-btn.active {
    background: var(--color-teal);
    color: #fff;
    font-weight: 700;
    box-shadow: var(--glow-card);
  }

  /* ─── Reports Shell ─── */
  .reports-shell {
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
    padding-bottom: var(--space-3xl);
  }

  /* ─── Staggered Entrance Animation ─── */
  .reports-section {
    animation: fadeSlideUp 400ms var(--ease) both;
  }
  .reports-section:nth-child(1) { animation-delay: 0ms; }
  .reports-section:nth-child(2) { animation-delay: 80ms; }
  .reports-section:nth-child(3) { animation-delay: 160ms; }
  .reports-section:nth-child(4) { animation-delay: 240ms; }
  .reports-section:nth-child(5) { animation-delay: 320ms; }

  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* ─── Common Card Container ─── */
  .trend-card, .table-card {
    display: flex;
    flex-direction: column;
    padding: var(--space-lg);
    background: var(--color-surface);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-card);
  }

  .card-header {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: var(--space-md);
  }

  .card-title {
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--color-ink);
    margin: 0;
  }

  .card-subtitle {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  .card-body {
    width: 100%;
  }

  /* ─── Empty State Page Region ─── */
  .empty-page-region {
    padding: var(--space-2xl) 0;
  }

  /* ════════════════════════════════════════
     RESPONSIVE
     ════════════════════════════════════════ */

  @media (max-width: 768px) {
    .timeframe-pill {
      display: flex;
      width: 100%;
    }

    .tf-btn {
      flex: 1;
      text-align: center;
      padding: 6px 8px;
    }
  }

  @media (max-width: 480px) {
    .reports-shell {
      gap: var(--space-md);
    }
    .trend-card, .table-card {
      padding: var(--space-md);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .reports-section {
      animation: none;
    }
  }
</style>


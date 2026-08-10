<script lang="ts">
  import { page } from '$app/stores';
  import { formatCurrency } from '$lib/client/utils/format';
import { getMonthLabel } from '$lib/shared/utils/format';
  import PageHeader from '$lib/client/components/PageHeader.svelte';
  import ReportsHeader from '$lib/client/components/ReportsHeader.svelte';
  import MonthlyTrendChart from '$lib/client/components/MonthlyTrendChart.svelte';
  import ReportsDataTable from '$lib/client/components/ReportsDataTable.svelte';
  import YearOverYearCard from '$lib/client/components/YearOverYearCard.svelte';
  import PageBackground from '$lib/client/components/PageBackground.svelte';
  import EmptyState from '$lib/client/components/EmptyState.svelte';

  let data = $derived($page.data as App.PageData);

  // ─── State ────────────────────────────────────────────────────────

  let selectedTimeframe = $state('1Y');
  let activeTab = $state('cashflow');

  const tabs = [
    { id: 'cashflow', label: 'Cash Flow' },
    { id: 'income', label: 'Income' },
    { id: 'expenses', label: 'Expenses' },
  ];

  // ─── Empty condition flags ────────────────────────────────────────

  const allTimeCount = $derived(data.allTimeCount ?? 0);
  const hasAnyTransactions = $derived(allTimeCount > 0);

  // ─── Monthly data ─────────────────────────────────────────────────

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

  // ─── Range-empty (E2) flag ────────────────────────────────────────

  const isRangeEmpty = $derived(filteredMonthly.length === 0 && hasAnyTransactions);

  // ─── Total-empty (E1) flag ────────────────────────────────────────

  const isTotalEmpty = $derived(!hasAnyTransactions);

  // ─── Current and previous month data for insights ─────────────────

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

  // ─── Top expense insight ──────────────────────────────────────────

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

  // ─── Category breakdown data ──────────────────────────────────────

  const incomeLabels = $derived(
    (data.incomeData ?? []).map(c => c.category_name)
  );
  const incomeValues = $derived(
    (data.incomeData ?? []).map(c => c.total)
  );
  const incomeColors = $derived(
    (data.incomeData ?? []).map(c => c.category_color)
  );

  const expenseLabels = $derived(
    (data.expenseData ?? []).map(c => c.category_name)
  );
  const expenseValues = $derived(
    (data.expenseData ?? []).map(c => c.total)
  );
  const expenseColors = $derived(
    (data.expenseData ?? []).map(c => c.category_color)
  );

  // ─── SVG donut arc data ──────────────────────────────────────────

  type ArcData = { pct: number; offset: number; color: string; label: string };

  const incomeArcs = $derived.by<ArcData[]>(() => {
    const vals = incomeValues;
    const colors = incomeColors;
    const labels = incomeLabels;
    const total = vals.reduce((a, b) => a + b, 0);
    if (total <= 0) return [];
    let cumulative = 0;
    return vals.map((v, i) => {
      const pct = v / total;
      const offset = cumulative;
      cumulative += pct * 251.2;
      return { pct, offset, color: colors[i] || '#6366f1', label: labels[i] || '' };
    });
  });

  const expenseArcs = $derived.by<ArcData[]>(() => {
    const vals = expenseValues;
    const colors = expenseColors;
    const labels = expenseLabels;
    const total = vals.reduce((a, b) => a + b, 0);
    if (total <= 0) return [];
    let cumulative = 0;
    return vals.map((v, i) => {
      const pct = v / total;
      const offset = cumulative;
      cumulative += pct * 251.2;
      return { pct, offset, color: colors[i] || '#6366f1', label: labels[i] || '' };
    });
  });

  // ─── Summary bar data ─────────────────────────────────────────────

  const totalIncome = $derived(filteredMonthly.reduce((s, m) => s + m.income, 0));
  const totalExpenses = $derived(filteredMonthly.reduce((s, m) => s + m.expense, 0));
  const netTotal = $derived(totalIncome - totalExpenses);

  // ─── Timeframe change handler ─────────────────────────────────────

  function onTimeframeChange(tf: string) {
    selectedTimeframe = tf;
  }

  // ─── Export guard ─────────────────────────────────────────────────

  const hasExportableData = $derived(filteredMonthly.length > 0);
  const exportStart = $derived(filteredMonthly[0]?.month ?? '');
  const exportEnd = $derived(filteredMonthly[filteredMonthly.length - 1]?.month ?? '');
</script>

<svelte:head>
  <title>Reports — Finance Tracker</title>
</svelte:head>

<PageHeader title="Reports">
  {#snippet action()}
    {#if hasExportableData}
      <a
        href="/api/reports/export?start={exportStart}&end={exportEnd}"
        class="btn-export"
        download
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
        <span class="export-hint">nothing to export yet</span>
      </span>
    {/if}
  {/snippet}
</PageHeader>

<PageBackground />

<!-- ═══ Reports header (timeframe pills + insight cards) ═══ -->

<!-- E4: when comparison is uncomputable, ReportsHeader handles inline degradation
     (insight cards hide when hasSpendingInsight/hasSavingsInsight are false) -->
<ReportsHeader
  currentMonth={currentSummary}
  previousMonth={previousSummary}
  changes={changes}
  topExpenseName={topExpense?.category_name ?? ''}
  topExpenseAmount={topExpense?.total ?? 0}
  topExpensePct={topExpensePct}
  timeframe={selectedTimeframe}
  onTimeframeChange={onTimeframeChange}
/>

<!-- ══════════════════════════════════════════════════════════════════
     E1: TOTAL-EMPTY — page-level, replaces everything below header
     ══════════════════════════════════════════════════════════════════ -->
{#if isTotalEmpty}
  <div class="empty-page-region">
    <EmptyState
      icon="🌱"
      title="Your reports are waiting"
      description="Log a few transactions and this page turns into your money's story."
      actionLabel="Add a transaction"
      actionHref="/transactions/new"
    />
  </div>

<!-- ══════════════════════════════════════════════════════════════════
     E2: RANGE-EMPTY — page-level, timeframe pills still work
     ══════════════════════════════════════════════════════════════════ -->
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

<!-- ══════════════════════════════════════════════════════════════════
     DATA EXISTS — normal render
     ══════════════════════════════════════════════════════════════════ -->
{:else}

  <!-- ═══ Tabs ═══ -->
  <div class="tabs-bar">
    <div class="tabs-pill">
      {#each tabs as tab (tab)}
        <button
          class="tab-btn"
          class:active={activeTab === tab.id}
          onclick={() => activeTab = tab.id}
        >
          {tab.label}
        </button>
      {/each}
    </div>
  </div>

  <!-- ════════════════════════════════════════════════════════════════
       CASH FLOW TAB
       ════════════════════════════════════════════════════════════════ -->
  {#if activeTab === 'cashflow'}
    <div class="view-panel">
      <!-- Summary bar -->
      <div class="summary-strip">
        <div class="strip-item">
          <span class="strip-value">{formatCurrency(totalIncome)}</span>
          <span class="strip-label">Total Income</span>
        </div>
        <div class="strip-divider"></div>
        <div class="strip-item">
          <span class="strip-value expense">{formatCurrency(totalExpenses)}</span>
          <span class="strip-label">Total Expenses</span>
        </div>
        <div class="strip-divider"></div>
        <div class="strip-item">
          <span class="strip-value" class:positive={netTotal >= 0} class:negative={netTotal < 0}>
            {formatCurrency(netTotal)}
          </span>
          <span class="strip-label">Net</span>
        </div>
      </div>

      <!-- Chart (never renders canvas when empty — MonthlyTrendChart handles "No trend data yet") -->
      <div class="section-card">
        <div class="section-card-header">
          <h3 class="section-card-title">Monthly Trend</h3>
        </div>
        <MonthlyTrendChart
          labels={monthlyLabels}
          incomeData={monthlyIncome}
          expenseData={monthlyExpense}
        />
      </div>

      <!-- Data table (ReportsDataTable handles empty rows internally) -->
      <div class="section-card">
        <div class="section-card-header">
          <h3 class="section-card-title">Monthly Breakdown</h3>
        </div>
        <ReportsDataTable data={monthlyRows} />
      </div>

      <!-- Year-over-Year card (E4: graceful degradation when no prior period) -->
      <YearOverYearCard
        yoyData={data.yoyData}
        selectedMonth={getMonthLabel(data.month ?? '')}
      />
    </div>

  <!-- ════════════════════════════════════════════════════════════════
       INCOME TAB
       ════════════════════════════════════════════════════════════════ -->
  {:else if activeTab === 'income'}
    <div class="view-panel">
      {#if (data.incomeData ?? []).length > 0}
        <div class="split-view">
          <div class="split-chart">
            <div class="section-card">
              <h3 class="section-card-title">Income Breakdown</h3>
              <div class="donut-container">
                <svg width="180" height="180" viewBox="0 0 180 180">
                  {#if incomeArcs.length > 0}
                    {#each incomeArcs as arc, i (i)}
                      <circle
                        cx="90" cy="90" r="40"
                        fill="none"
                        stroke={arc.color}
                        stroke-width="28"
                        stroke-dasharray="{arc.pct * 251.2} {251.2 - arc.pct * 251.2}"
                        stroke-dashoffset={-arc.offset}
                        transform="rotate(-90 90 90)"
                        stroke-linecap="round"
                      />
                    {/each}
                  {/if}
                  <text x="90" y="86" text-anchor="middle" fill="currentColor" font-size="16" font-weight="700" dy="0">
                    {formatCurrency(incomeValues.reduce((a, b) => a + b, 0))}
                  </text>
                  <text x="90" y="106" text-anchor="middle" fill="var(--color-text-secondary)" font-size="11" font-weight="500">
                    total
                  </text>
                </svg>
              </div>
              <!-- E5: single-category quiet note -->
              {#if (data.incomeData ?? []).length <= 1}
                <p class="single-cat-note">🌱 Only one category so far — add more over time</p>
              {/if}
            </div>
          </div>
          <div class="split-table">
            <div class="section-card">
              <h3 class="section-card-title">Categories</h3>
              <div class="breakdown-list">
                {#each (data.incomeData ?? []) as cat (cat.category_id)}
                  <div class="breakdown-row">
                    <span class="breakdown-dot" style="background: {cat.category_color}"></span>
                    <span class="breakdown-name">{cat.category_name}</span>
                    <span class="breakdown-amount">{formatCurrency(cat.total)}</span>
                    <span class="breakdown-pct">
                      {(() => {
                        const tot = incomeValues.reduce((a, b) => a + b, 0);
                        return tot > 0 ? ((cat.total / tot) * 100).toFixed(1) : '0.0';
                      })()}%
                    </span>
                  </div>
                {/each}
              </div>
            </div>
          </div>
        </div>
      {:else}
        <!-- E3: TYPE-EMPTY for income tab -->
        <EmptyState
          icon="💰"
          title="No income this period"
          description="You logged expenses but no income here yet."
          actionLabel="Log income"
          actionHref="/transactions/new"
          secondaryLabel="View the Expenses tab"
          secondaryHref=""
        />
      {/if}
    </div>

  <!-- ════════════════════════════════════════════════════════════════
       EXPENSES TAB
       ════════════════════════════════════════════════════════════════ -->
  {:else if activeTab === 'expenses'}
    <div class="view-panel">
      {#if (data.expenseData ?? []).length > 0}
        <div class="split-view">
          <div class="split-chart">
            <div class="section-card">
              <h3 class="section-card-title">Expense Breakdown</h3>
              <div class="donut-container">
                <svg width="180" height="180" viewBox="0 0 180 180">
                  {#if expenseArcs.length > 0}
                    {#each expenseArcs as arc, i (i)}
                      <circle
                        cx="90" cy="90" r="40"
                        fill="none"
                        stroke={arc.color}
                        stroke-width="28"
                        stroke-dasharray="{arc.pct * 251.2} {251.2 - arc.pct * 251.2}"
                        stroke-dashoffset={-arc.offset}
                        transform="rotate(-90 90 90)"
                        stroke-linecap="round"
                      />
                    {/each}
                  {/if}
                  <text x="90" y="86" text-anchor="middle" fill="currentColor" font-size="16" font-weight="700" dy="0">
                    {formatCurrency(expenseValues.reduce((a, b) => a + b, 0))}
                  </text>
                  <text x="90" y="106" text-anchor="middle" fill="var(--color-text-secondary)" font-size="11" font-weight="500">
                    total
                  </text>
                </svg>
              </div>
              <!-- E5: single-category quiet note -->
              {#if (data.expenseData ?? []).length <= 1}
                <p class="single-cat-note">🌱 Only one category so far — add more over time</p>
              {/if}
            </div>
          </div>
          <div class="split-table">
            <div class="section-card">
              <h3 class="section-card-title">Categories</h3>
              <div class="breakdown-list">
                {#each (data.expenseData ?? []) as cat (cat.category_id)}
                  <div class="breakdown-row">
                    <span class="breakdown-dot" style="background: {cat.category_color}"></span>
                    <span class="breakdown-name">{cat.category_name}</span>
                    <span class="breakdown-amount expense">{formatCurrency(cat.total)}</span>
                    <span class="breakdown-pct">
                      {(() => {
                        const tot = expenseValues.reduce((a, b) => a + b, 0);
                        return tot > 0 ? ((cat.total / tot) * 100).toFixed(1) : '0.0';
                      })()}%
                    </span>
                  </div>
                {/each}
              </div>
            </div>
          </div>
        </div>
      {:else}
        <!-- E3: TYPE-EMPTY for expenses tab -->
        <EmptyState
          icon="🍽️"
          title="No expenses this period"
          description="You logged income but no expenses here yet."
          actionLabel="Log an expense"
          actionHref="/transactions/new"
          secondaryLabel="View the Income tab"
          secondaryHref=""
        />
      {/if}
    </div>
  {/if}
{/if}

<style>
  /* ═══════════════════════════════════════════════════════════════════
     REPORTS PAGE
     ═══════════════════════════════════════════════════════════════════ */

  /* ─── Export button ─── */
  .btn-export {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: var(--space-sm) var(--space-md);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    min-height: 40px;
    transition: all var(--transition-fast);
    white-space: nowrap;
    position: relative;
  }

  .btn-export:hover {
    background: var(--color-primary-light);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .btn-export-disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  .export-hint {
    font-size: 10px;
    color: var(--color-text-muted);
    position: absolute;
    bottom: -16px;
    left: 50%;
    transform: translateX(-50%);
    white-space: nowrap;
    font-weight: 400;
  }

  /* ─── Empty page region (E1/E2) ─── */
  .empty-page-region {
    margin-top: var(--space-lg);
  }

  /* ─── Tabs bar ─── */
  .tabs-bar {
    margin-bottom: var(--space-lg);
  }

  .tabs-pill {
    display: inline-flex;
    gap: 2px;
    background: var(--color-bg);
    padding: 4px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
  }

  .tab-btn {
    padding: var(--space-sm) var(--space-lg);
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    font-size: var(--font-size-sm);
    font-weight: 600;
    font-family: inherit;
    color: var(--color-text-secondary);
    cursor: pointer;
    min-height: 40px;
    transition: all 120ms ease;
  }

  .tab-btn.active {
    background: var(--color-primary);
    color: white;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
  }

  .tab-btn:not(.active):hover {
    background: var(--color-surface);
    color: var(--color-text);
  }

  /* ─── View panel ─── */
  .view-panel {
    animation: fadeSlideIn 300ms ease-out;
  }

  @keyframes fadeSlideIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* ─── Summary strip ─── */
  .summary-strip {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    padding: var(--space-md) var(--space-lg);
    margin-bottom: var(--space-lg);
  }

  .strip-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .strip-value {
    font-size: var(--font-size-base);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--color-text);
  }

  .strip-value.expense { color: var(--color-expense); }
  .strip-value.positive { color: var(--color-income); }
  .strip-value.negative { color: var(--color-expense); }

  .strip-label {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    font-weight: 500;
  }

  .strip-divider {
    width: 1px;
    height: 32px;
    background: var(--color-border);
    flex-shrink: 0;
  }

  /* ─── Section cards ─── */
  .section-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    padding: var(--space-lg);
    margin-bottom: var(--space-lg);
    box-shadow: var(--shadow-sm);
  }

  .section-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-md);
  }

  .section-card-title {
    margin: 0;
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--color-text);
  }

  /* ─── Split view (chart + table side by side) ─── */
  .split-view {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-lg);
    align-items: start;
  }

  .split-chart .section-card {
    margin-bottom: 0;
  }

  .split-table .section-card {
    margin-bottom: 0;
  }

  /* ─── Donut ─── */
  .donut-container {
    display: flex;
    justify-content: center;
    padding: var(--space-lg) 0;
  }

  .donut-container svg {
    color: var(--color-text);
  }

  /* ─── Single category note (E5) ─── */
  .single-cat-note {
    text-align: center;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    margin: var(--space-xs) 0 var(--space-sm);
    font-style: italic;
  }

  /* ─── Category breakdown list ─── */
  .breakdown-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .breakdown-row {
    display: grid;
    grid-template-columns: 14px 1fr auto auto;
    gap: var(--space-sm);
    align-items: center;
    padding: var(--space-sm) var(--space-sm);
    border-radius: var(--radius-sm);
    transition: background 120ms ease;
  }

  .breakdown-row:hover {
    background: rgba(99, 102, 241, 0.03);
  }

  .breakdown-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .breakdown-name {
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--color-text);
  }

  .breakdown-amount {
    font-size: var(--font-size-sm);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    text-align: right;
    color: var(--color-income);
  }

  .breakdown-amount.expense {
    color: var(--color-expense);
  }

  .breakdown-pct {
    font-size: var(--font-size-xs);
    font-weight: 500;
    color: var(--color-text-secondary);
    text-align: right;
    min-width: 48px;
  }

  /* ─── Responsive ─── */
  @media (max-width: 768px) {
    .split-view {
      grid-template-columns: 1fr;
    }

    .summary-strip {
      gap: var(--space-sm);
      padding: var(--space-md);
    }

    .strip-divider {
      display: none;
    }

    .strip-item {
      flex: 1;
      min-width: 0;
    }

    .tabs-pill {
      width: 100%;
    }

    .tab-btn {
      flex: 1;
      text-align: center;
      padding: var(--space-sm) var(--space-md);
    }

    .export-hint {
      display: none;
    }
  }

  @media (max-width: 480px) {
    .strip-value {
      font-size: var(--font-size-sm);
    }
  }
</style>

<script lang="ts">
  import { formatCurrency } from '$lib/utils/format';

  interface MonthlyRow {
    month: string;
    income: number;
    expense: number;
  }

  let {
    data = [] as MonthlyRow[],
  }: {
    data: MonthlyRow[];
  } = $props();

  // ─── Derived totals ──────────────────────────────────────────────

  const totalIncome = $derived(data.reduce((s, r) => s + r.income, 0));
  const totalExpense = $derived(data.reduce((s, r) => s + r.expense, 0));
  const totalNet = $derived(totalIncome - totalExpense);

  function monthLabel(monthStr: string): string {
    const d = new Date(monthStr + '-01');
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  function netColor(net: number): string {
    if (net > 0) return 'positive';
    if (net < 0) return 'negative';
    return '';
  }

  function netIcon(net: number): string {
    if (net > 0) return '↑';
    if (net < 0) return '↓';
    return '—';
  }
</script>

<div class="table-scroll-wrapper">
  <table class="data-table">
    <thead>
      <tr class="header-row">
        <th>Month</th>
        <th class="num">Income</th>
        <th class="num">Expenses</th>
        <th class="num">Net</th>
        <th class="num"></th>
      </tr>
    </thead>
    <tbody>
      {#each data as row (row.month)}
        <tr class:over-budget={row.expense > row.income}>
          <td class="label-cell">{monthLabel(row.month)}</td>
          <td class="num income">{formatCurrency(row.income)}</td>
          <td class="num expense">{formatCurrency(row.expense)}</td>
          <td class="num {netColor(row.income - row.expense)}">
            {formatCurrency(row.income - row.expense)}
          </td>
          <td class="num trend-indicator">
            <span class="net-arrow" class:positive={row.income - row.expense >= 0} class:negative={row.income - row.expense < 0}>
              {netIcon(row.income - row.expense)}
            </span>
          </td>
        </tr>
      {/each}
    </tbody>
    {#if data.length > 0}
      <tfoot>
        <tr>
          <td class="label-cell total-label">Total</td>
          <td class="num income total-value">{formatCurrency(totalIncome)}</td>
          <td class="num expense total-value">{formatCurrency(totalExpense)}</td>
          <td class="num {netColor(totalNet)} total-value">{formatCurrency(totalNet)}</td>
          <td class="num"></td>
        </tr>
      </tfoot>
    {/if}
  </table>

  {#if data.length === 0}
    <div class="empty-state">
      <p>No data for this period</p>
    </div>
  {/if}
</div>

<style>
  .table-scroll-wrapper {
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }

  /* ─── Header ─── */
  .header-row th {
    padding: 12px 16px;
    text-align: left;
    font-weight: 600;
    color: var(--color-ink);
    font-size: 12px;
    text-transform: lowercase;
    letter-spacing: 0.02em;
    background: var(--color-cream);
    border-bottom: 3px dashed var(--color-teal);
    white-space: nowrap;
  }

  .data-table thead th.num {
    text-align: right;
  }

  /* ─── Body ─── */
  .data-table tbody td {
    padding: 10px 16px;
    border-bottom: 1px solid var(--color-hairline);
    transition: background 120ms ease;
    white-space: nowrap;
    position: relative;
  }

  .data-table tbody tr:hover td {
    background: var(--color-teal-bg);
  }

  .data-table tbody tr:hover td:first-child {
    box-shadow: inset 3px 0 0 0 var(--color-teal);
  }

  .data-table tbody tr:last-child td {
    border-bottom: 1px solid var(--color-hairline);
  }

  .data-table tbody tr.over-budget td {
    background: rgba(239, 108, 74, 0.04);
  }

  .data-table tbody tr.over-budget:hover td {
    background: rgba(239, 108, 74, 0.08);
  }

  .data-table tbody tr.over-budget td:first-child {
    box-shadow: inset 3px 0 0 0 var(--color-coral);
  }

  .label-cell {
    font-weight: 500;
    color: var(--color-ink);
  }

  .num {
    text-align: right;
    font-weight: 600;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }

  .income {
    color: var(--color-teal);
  }

  .expense {
    color: var(--color-coral);
  }

  .positive {
    color: var(--color-teal);
  }

  .negative {
    color: var(--color-coral);
  }

  /* ─── Trend indicator arrow ─── */
  .trend-indicator {
    width: 32px;
    padding-left: 4px !important;
  }

  .net-arrow {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    font-size: 12px;
    font-weight: 700;
  }

  .net-arrow.positive {
    background: var(--color-teal-bg);
    color: var(--color-teal);
  }

  .net-arrow.negative {
    background: rgba(239, 108, 74, 0.10);
    color: var(--color-coral);
  }

  /* ─── Footer (total row) ─── */
  .data-table tfoot td {
    padding: 12px 16px;
    border-top: 2px solid var(--color-hairline);
    font-weight: 700;
    background: var(--color-cream);
    white-space: nowrap;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }

  .total-label {
    font-size: 13px;
    color: var(--color-ink);
    font-family: var(--font-body);
  }

  .total-value {
    font-size: 14px;
  }

  /* ─── Empty state ─── */
  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-xl);
    color: var(--color-text-muted);
    font-style: italic;
    font-size: var(--font-size-sm);
  }

  .empty-state p {
    margin: 0;
  }

  /* ─── Responsive ─── */
  @media (max-width: 640px) {
    .table-scroll-wrapper {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    .data-table thead th,
    .data-table tbody td,
    .data-table tfoot td {
      padding: 10px 8px;
      font-size: 12px;
      white-space: normal;
      word-break: break-word;
      overflow-wrap: break-word;
    }

    .trend-indicator,
    .data-table thead th:last-child {
      display: none;
    }

    .data-table thead th:nth-child(3),
    .data-table tbody td:nth-child(3),
    .data-table tfoot td:nth-child(3) {
      display: none;
    }
  }
</style>

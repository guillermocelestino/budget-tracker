<script lang="ts">
  import { formatCurrency } from '$lib/client/utils/format';

  let {
    expenseCategories = [],
    incomeCategories = [],
    topExpenseName = '',
    topExpenseAmount = 0,
    topExpensePct = 0,
  }: {
    expenseCategories: Array<{ category_id?: number; category_name: string; category_color?: string; total: number }>;
    incomeCategories: Array<{ category_id?: number; category_name: string; category_color?: string; total: number }>;
    topExpenseName?: string;
    topExpenseAmount?: number;
    topExpensePct?: number;
  } = $props();

  // Helper to compute SVG arcs for a category array
  function computeArcs(cats: Array<{ category_name: string; category_color?: string; total: number }>) {
    const total = cats.reduce((sum, c) => sum + c.total, 0);
    if (total <= 0) return { total: 0, arcs: [] };

    let currentOffset = 0;
    const arcs = cats.map((c) => {
      const pct = c.total / total;
      const arc = {
        pct,
        offset: currentOffset * 251.2,
        color: c.category_color || '#2BA8A2',
        label: c.category_name,
        total: c.total,
      };
      currentOffset += pct;
      return arc;
    });

    return { total, arcs };
  }

  const expData = $derived(computeArcs(expenseCategories));
  const incData = $derived(computeArcs(incomeCategories));
</script>

<div class="reports-cat-grid">
  <!-- LEFT: EXPENSE BREAKDOWN -->
  <div class="cat-card flip7-card accent-coral">
    <div class="card-head">
      <div class="head-title-row">
        <div class="head-icon coral-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v8M8 12h8"/>
          </svg>
        </div>
        <div class="head-text">
          <h3 class="card-title">Expense Breakdown</h3>
          <span class="card-subtitle">Spending by Category</span>
        </div>
      </div>

      {#if topExpenseName && topExpenseAmount > 0}
        <div class="top-spotlight">
          <span class="spotlight-tag">Top Category</span>
          <span class="spotlight-val">
            <strong>{topExpenseName}</strong> · {formatCurrency(topExpenseAmount)} ({topExpensePct.toFixed(0)}%)
          </span>
        </div>
      {/if}
    </div>

    {#if expData.arcs.length > 0}
      <div class="cat-body">
        <div class="donut-wrapper">
          <svg width="170" height="170" viewBox="0 0 180 180" class="donut-svg">
            {#each expData.arcs as arc, i (i)}
              <circle
                cx="90" cy="90" r="40"
                fill="none"
                stroke={arc.color}
                stroke-width="26"
                stroke-dasharray="{arc.pct * 251.2} {251.2 - arc.pct * 251.2}"
                stroke-dashoffset={-arc.offset}
                transform="rotate(-90 90 90)"
                stroke-linecap="round"
              />
            {/each}
            <text x="90" y="84" text-anchor="middle" fill="var(--color-ink)" font-size="15" font-weight="800" font-family="var(--font-display)">
              {formatCurrency(expData.total)}
            </text>
            <text x="90" y="104" text-anchor="middle" fill="var(--color-text-muted)" font-size="11" font-weight="600">
              Total Spent
            </text>
          </svg>
        </div>

        <div class="cat-list">
          {#each expData.arcs as cat (cat.label)}
            <div class="cat-row">
              <span class="cat-dot" style="background: {cat.color}"></span>
              <span class="cat-name">{cat.label}</span>
              <div class="cat-bar-track">
                <div class="cat-bar-fill" style="width: {cat.pct * 100}%; background: {cat.color}"></div>
              </div>
              <span class="cat-amount">{formatCurrency(cat.total)}</span>
              <span class="cat-pct">{(cat.pct * 100).toFixed(1)}%</span>
            </div>
          {/each}
        </div>
      </div>
    {:else}
      <div class="cat-empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="9"/>
          <path d="M7 12h10"/>
        </svg>
        <span>No expenses recorded in this period</span>
      </div>
    {/if}
  </div>

  <!-- RIGHT: INCOME BREAKDOWN -->
  <div class="cat-card flip7-card accent-teal">
    <div class="card-head">
      <div class="head-title-row">
        <div class="head-icon teal-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v12M8 12h8"/>
          </svg>
        </div>
        <div class="head-text">
          <h3 class="card-title">Income Breakdown</h3>
          <span class="card-subtitle">Income Sources</span>
        </div>
      </div>
    </div>

    {#if incData.arcs.length > 0}
      <div class="cat-body">
        <div class="donut-wrapper">
          <svg width="170" height="170" viewBox="0 0 180 180" class="donut-svg">
            {#each incData.arcs as arc, i (i)}
              <circle
                cx="90" cy="90" r="40"
                fill="none"
                stroke={arc.color}
                stroke-width="26"
                stroke-dasharray="{arc.pct * 251.2} {251.2 - arc.pct * 251.2}"
                stroke-dashoffset={-arc.offset}
                transform="rotate(-90 90 90)"
                stroke-linecap="round"
              />
            {/each}
            <text x="90" y="84" text-anchor="middle" fill="var(--color-ink)" font-size="15" font-weight="800" font-family="var(--font-display)">
              {formatCurrency(incData.total)}
            </text>
            <text x="90" y="104" text-anchor="middle" fill="var(--color-text-muted)" font-size="11" font-weight="600">
              Total Earned
            </text>
          </svg>
        </div>

        <div class="cat-list">
          {#each incData.arcs as cat (cat.label)}
            <div class="cat-row">
              <span class="cat-dot" style="background: {cat.color}"></span>
              <span class="cat-name">{cat.label}</span>
              <div class="cat-bar-track">
                <div class="cat-bar-fill" style="width: {cat.pct * 100}%; background: {cat.color}"></div>
              </div>
              <span class="cat-amount">{formatCurrency(cat.total)}</span>
              <span class="cat-pct">{(cat.pct * 100).toFixed(1)}%</span>
            </div>
          {/each}
        </div>
      </div>
    {:else}
      <div class="cat-empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="9"/>
          <path d="M7 12h10"/>
        </svg>
        <span>No income recorded in this period</span>
      </div>
    {/if}
  </div>
</div>

<style>
  /* ═══════════════════════════════════════════════════════
     REPORTS CATEGORY GRID — Desktop 2-Column Side-by-Side
     ══════════════════════════════════════════════════════ */

  .reports-cat-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-md);
    align-items: stretch;
  }

  .cat-card {
    display: flex;
    flex-direction: column;
    padding: var(--space-lg);
    background: var(--color-surface);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-card);
    transition: transform 180ms var(--bounce), box-shadow 180ms var(--ease);
  }

  @media (pointer: fine) {
    .cat-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--glow-card);
    }
  }

  /* Card Head */
  .card-head {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    margin-bottom: var(--space-md);
  }

  .head-title-row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .head-icon {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .coral-icon {
    background: rgba(239, 108, 74, 0.12);
    color: var(--color-coral);
  }

  .teal-icon {
    background: var(--color-teal-bg);
    color: var(--color-teal);
  }

  .head-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
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

  /* Spotlight Banner */
  .top-spotlight {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: 6px 12px;
    background: var(--color-surface-inset);
    border-radius: var(--radius-md);
    border: 1px solid var(--color-hairline);
    margin-top: 4px;
    font-size: var(--font-size-xs);
  }

  .spotlight-tag {
    font-weight: 700;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-coral);
  }

  .spotlight-val {
    color: var(--color-ink);
  }

  /* Cat Body */
  .cat-body {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
    flex: 1;
  }

  .donut-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 170px;
  }

  .donut-svg {
    max-width: 170px;
    height: auto;
  }

  /* Category List */
  .cat-list {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 220px;
    overflow-y: auto;
  }

  .cat-row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: 4px 0;
    font-size: var(--font-size-xs);
    border-bottom: 1px solid var(--color-hairline);
  }

  .cat-row:last-child {
    border-bottom: none;
  }

  .cat-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .cat-name {
    font-weight: 600;
    color: var(--color-ink);
    width: 100px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cat-bar-track {
    flex: 1;
    height: 6px;
    background: var(--color-hairline);
    border-radius: var(--radius-pill);
    overflow: hidden;
  }

  .cat-bar-fill {
    height: 100%;
    border-radius: var(--radius-pill);
    transition: width 400ms var(--ease);
  }

  .cat-amount {
    font-family: var(--font-mono);
    font-weight: 700;
    color: var(--color-ink);
    font-variant-numeric: tabular-nums;
    min-width: 70px;
    text-align: right;
  }

  .cat-pct {
    font-family: var(--font-mono);
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
    min-width: 42px;
    text-align: right;
  }

  /* Empty State */
  .cat-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-xl);
    gap: var(--space-sm);
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
    flex: 1;
  }

  /* ═══════════════════════════════════════════════════════
     RESPONSIVE
     ══════════════════════════════════════════════════════ */

  @media (max-width: 1024px) {
    .reports-cat-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 480px) {
    .cat-card {
      padding: var(--space-md);
    }
    .cat-name {
      width: 75px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .cat-card { transition: none; }
  }
</style>

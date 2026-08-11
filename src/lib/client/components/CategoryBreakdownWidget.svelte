<script lang="ts">
  import '$lib/client/utils/chart';
  import { Doughnut } from 'svelte-chartjs';
  import { formatCurrency } from '$lib/client/utils/format';
  import type { ChartData, ChartOptions } from 'chart.js';

  let {
    categories = [],
  }: {
    categories: Array<{ name: string; total: number; color: string }>;
  } = $props();

  // ─── Dark mode ────────────────────────────────────────────────

  let isDark = $state(false);

  $effect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    isDark = mq.matches;
    const handler = (e: MediaQueryListEvent) => (isDark = e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  });

  // ─── Derived: total, sorted, grouped ─────────────────────────

  const totalSpent = $derived(categories.reduce((sum, c) => sum + c.total, 0));

  const sorted = $derived([...categories].sort((a, b) => b.total - a.total));

  const displayCategories = $derived(
    (() => {
      if (totalSpent === 0) return [];

      const withPct = sorted.map((c) => ({
        ...c,
        percentage: (c.total / totalSpent) * 100,
      }));

      if (withPct.length <= 5) return withPct;

      const top5 = withPct.slice(0, 5);
      const others = withPct.slice(5);
      const otherTotal = others.reduce((s, c) => s + c.total, 0);
      if (otherTotal <= 0) return top5;

      return [
        ...top5,
        {
          name: 'Other',
          total: otherTotal,
          color: '#9ca3af',
          percentage: (otherTotal / totalSpent) * 100,
        },
      ];
    })()
  );

  // ─── Chart data ─────────────────────────────────────────────

  const chartData = $derived<ChartData<'doughnut'>>({
    labels: displayCategories.map((c) => c.name),
    datasets: [
      {
        data: displayCategories.map((c) => c.total),
        backgroundColor: displayCategories.map((c) => c.color),
        borderWidth: 0,
        hoverBorderWidth: 3,
        hoverBorderColor: isDark ? '#1f2937' : '#ffffff',
        spacing: 2,
      },
    ],
  });

  const chartOptions = $derived<ChartOptions<'doughnut'>>({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '74%',
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
    },
    animation: {
      animateRotate: true,
      duration: 800,
      easing: 'easeOutQuart',
    },
  });

  // ─── Category-bar max-width helper ─────────────────────────

  const maxBarWidth = $derived(
    displayCategories.length > 0
      ? Math.max(...displayCategories.map((c) => c.percentage))
      : 100
  );

  // ─── Rank label helper ─────────────────────────────────────

  const rankEmoji = (i: number): string => {
    if (i === 0) return '🥇';
    if (i === 1) return '🥈';
    if (i === 2) return '🥉';
    return '';
  };

  const rankClass = (i: number): string => {
    if (i === 0) return 'rank-gold';
    if (i === 1) return 'rank-silver';
    if (i === 2) return 'rank-coral';
    return '';
  };
</script>

<div class="cb-shell">
  {#if categories.length === 0 || totalSpent === 0}
    <div class="cb-empty">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="9"/>
        <path d="M7 8h10M7 12h6M7 16h4"/>
      </svg>
      <span>No spending data this month</span>
    </div>
  {:else}
    <div class="cb-grid">
      <!-- ═══ Donut section ═══ -->
      <div class="donut-section">
        <div class="donut-wrapper">
          <Doughnut data={chartData} options={chartOptions} />
          <div class="donut-center">
            <span class="center-amount">{formatCurrency(totalSpent)}</span>
            <span class="center-label">Total Spent</span>
          </div>
        </div>
      </div>

      <!-- ═══ Ranked list section (THE PODIUM) ═══ -->
      <div class="list-section">
        <div class="list-header">
          <span class="lh-rank"></span>
          <span class="lh-name">Category</span>
          <span class="lh-amount">Amount</span>
          <span class="lh-pct">%</span>
        </div>
        <div class="category-list">
          {#each displayCategories as cat, i (cat.name)}
            <div class="category-row {rankClass(i)}">
              <span class="cat-rank">{rankEmoji(i)}</span>
              <span class="cat-dot" style="background: {i >= 3 ? cat.color : 'transparent'}"></span>
              <span class="cat-name">{cat.name}</span>
              <div class="cat-bar">
                <div
                  class="cat-bar-fill"
                  style="width: {(cat.percentage / maxBarWidth) * 100}%"
                ></div>
              </div>
              <span class="cat-amount">{formatCurrency(cat.total)}</span>
              <span class="cat-pct">{cat.percentage.toFixed(1)}%</span>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* ═══════════════════════════════════════════════
     CATEGORY BREAKDOWN WIDGET — FLIP7 PODIUM
     ═══════════════════════════════════════════════ */

  .cb-shell {
    position: relative;
  }

  /* ─── Empty state ─── */

  .cb-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    padding: var(--space-xl);
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
    min-height: 200px;
  }

  /* ─── Grid: donut on top, ranked list below (tall card) ─── */

  .cb-grid {
    display: grid;
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
    gap: var(--space-md);
    align-items: start;
  }

  /* ─── Donut section — centered, larger ─── */

  .donut-section {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 220px;
  }

  .donut-wrapper {
    position: relative;
    width: 100%;
    max-width: 280px;
    min-width: 0;
    aspect-ratio: 1;
  }

  .donut-wrapper > :global(canvas) {
    width: 100% !important;
    height: 100% !important;
  }

  .donut-center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    pointer-events: none;
  }

  .center-amount {
    display: block;
    font-size: 1.35rem;
    font-weight: var(--font-weight-extrabold);
    font-family: var(--font-display);
    color: var(--color-ink);
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
  }

  .center-label {
    display: block;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-top: 2px;
    font-weight: var(--font-weight-medium);
  }

  /* ─── List header — sentence case ─── */

  .list-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: 0 0 var(--space-xs);
    font-size: var(--font-size-xs);
    font-weight: 500;
    color: var(--color-text-muted);
    letter-spacing: 0.03em;
    border-bottom: 1px solid var(--color-hairline);
  }

  .lh-rank {
    width: 28px;
    flex-shrink: 0;
    text-align: center;
  }

  .lh-name {
    flex: 1;
  }

  .lh-amount {
    min-width: 80px;
    text-align: right;
  }

  .lh-pct {
    min-width: 44px;
    text-align: right;
  }

  /* ─── Scrollable list ─── */

  .category-list {
    max-height: 320px;
    overflow-y: auto;
    padding-right: 4px;
  }

  .category-list {
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }

  .category-list::-webkit-scrollbar {
    width: 3px;
  }

  .category-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .category-list::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 2px;
  }

  .category-list::-webkit-scrollbar-thumb:hover {
    background: var(--color-text-muted);
  }

  /* ─── Category row ─── */

  .category-row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) 0;
    border-bottom: 1px solid var(--color-hairline);
    transition: background 120ms ease;
  }

  .category-row:last-child {
    border-bottom: none;
  }

  .category-row:hover {
    background: var(--color-teal-bg);
    margin: 0 -6px;
    padding: var(--space-sm) 6px;
    border-radius: var(--radius-md);
  }

  /* ─── Tiered rank treatments ─── */

  .category-row.rank-gold {
    background: rgba(255, 210, 63, 0.06);
    border-left: 3px solid var(--color-gold);
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    box-shadow: var(--glow-gold);
    margin-bottom: 2px;
  }

  .category-row.rank-silver {
    border-left: 3px solid #c0c0c0;
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  }

  .category-row.rank-coral {
    border-left: 3px solid var(--color-coral);
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  }

  .cat-rank {
    width: 28px;
    flex-shrink: 0;
    text-align: center;
    font-size: var(--font-size-lg);
    line-height: 1;
  }

  .cat-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .cat-name {
    flex: 1;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--color-ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .category-row.rank-gold .cat-name {
    font-weight: var(--font-weight-bold);
  }

  .cat-bar {
    flex: 0 0 80px;
    height: 8px;
    background: var(--color-hairline);
    border-radius: var(--radius-pill);
    overflow: hidden;
  }

  .cat-bar-fill {
    height: 100%;
    border-radius: var(--radius-pill);
    transition: width 600ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .category-row.rank-gold .cat-bar-fill {
    background: var(--color-gold);
  }

  .category-row.rank-silver .cat-bar-fill {
    background: #c0c0c0;
  }

  .category-row.rank-coral .cat-bar-fill {
    background: var(--color-coral);
  }

  .category-row:not(.rank-gold):not(.rank-silver):not(.rank-coral) .cat-bar-fill {
    background: var(--color-teal);
  }

  .cat-amount {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-ink);
    font-variant-numeric: tabular-nums;
    min-width: 80px;
    text-align: right;
  }

  .category-row.rank-gold .cat-amount {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-bold);
    font-family: var(--font-display);
  }

  .cat-pct {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    font-weight: var(--font-weight-medium);
    min-width: 44px;
    text-align: right;
  }

  /* ═══════════════════════════════════════════════
     RESPONSIVE
     ═══════════════════════════════════════════════ */

  @media (max-width: 768px) {
    .cb-grid {
      gap: var(--space-md);
    }

    .donut-wrapper {
      max-width: 180px;
    }

    .category-list {
      -webkit-overflow-scrolling: touch;
    }

    .cat-bar {
      flex: 0 0 60px;
    }

    .cat-amount {
      min-width: 70px;
      font-size: var(--font-size-xs);
    }

    .list-header {
      display: none;
    }

    .category-list {
      max-height: 260px;
    }
  }

  @media (max-width: 480px) {
    .category-row {
      padding: var(--space-xs) 0;
      gap: 6px;
    }

    .cat-name {
      font-size: 12px;
    }

    .cat-amount {
      font-size: 11px;
      min-width: 60px;
    }

    .cat-pct {
      font-size: 10px;
      min-width: 36px;
    }

    .cat-dot {
      width: 8px;
      height: 8px;
    }

    .cat-rank {
      font-size: var(--font-size-base);
      width: 24px;
    }

    .center-amount {
      font-size: 1.1rem;
    }

    .category-row.rank-gold .cat-amount {
      font-size: var(--font-size-sm);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .cat-bar-fill {
      transition: none;
    }
  }
</style>

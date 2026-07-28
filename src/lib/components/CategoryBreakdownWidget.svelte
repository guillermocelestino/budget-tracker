<script lang="ts">
  import '$lib/utils/chart';
  import { Doughnut } from 'svelte-chartjs';
  import { formatCurrency } from '$lib/utils/format';
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
    cutout: '75%',
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

      <!-- ═══ Ranked list section ═══ -->
      <div class="list-section">
        <div class="list-header">
          <span class="lh-dot"></span>
          <span class="lh-name">Category</span>
          <span class="lh-amount">Amount</span>
          <span class="lh-pct">%</span>
        </div>
        <div class="category-list">
          {#each displayCategories as cat (cat.name)}
            <div class="category-row">
              <span class="cat-dot" style="background: {cat.color}"></span>
              <span class="cat-name">{cat.name}</span>
              <div class="cat-bar">
                <div
                  class="cat-bar-fill"
                  style="width: {(cat.percentage / maxBarWidth) * 100}%; background: {cat.color}"
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
     CATEGORY BREAKDOWN WIDGET
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
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    min-height: 200px;
  }

  /* ─── Grid: donut | list ─── */

  .cb-grid {
    display: grid;
    grid-template-columns: 220px 1fr;
    gap: var(--space-xl);
    align-items: start;
  }

  /* ─── Donut section ─── */

  .donut-section {
    display: flex;
    justify-content: center;
  }

  .donut-wrapper {
    position: relative;
    width: 100%;
    max-width: 220px;
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
    font-weight: 800;
    color: var(--color-text);
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
  }

  .center-label {
    display: block;
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-top: 2px;
    font-weight: 500;
  }

  /* ─── List header ─── */

  .list-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: 0 0 var(--space-xs);
    font-size: var(--font-size-xs);
    font-weight: 500;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid var(--color-border);
  }

  .lh-dot {
    width: 10px;
    flex-shrink: 0;
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
    background: var(--color-text-secondary);
  }

  /* ─── Category row ─── */

  .category-row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) 0;
    border-bottom: 1px solid var(--color-border);
    transition: background 120ms ease;
  }

  .category-row:last-child {
    border-bottom: none;
  }

  .category-row:hover {
    background: var(--color-bg);
    margin: 0 -6px;
    padding: var(--space-sm) 6px;
    border-radius: var(--radius-sm);
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
    font-weight: 500;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cat-bar {
    flex: 0 0 80px;
    height: 6px;
    background: var(--color-border);
    border-radius: 3px;
    overflow: hidden;
  }

  .cat-bar-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 600ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .cat-amount {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text);
    font-variant-numeric: tabular-nums;
    min-width: 80px;
    text-align: right;
  }

  .cat-pct {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    font-weight: 500;
    min-width: 44px;
    text-align: right;
  }

  /* ═══════════════════════════════════════════════
     RESPONSIVE
     ═══════════════════════════════════════════════ */

  @media (max-width: 768px) {
    .cb-grid {
      grid-template-columns: 1fr;
      gap: var(--space-md);
    }

    .donut-section {
      max-width: 200px;
      margin: 0 auto;
      height: 220px;
      display: flex;
      align-items: center;
    }

    .donut-wrapper {
      max-width: 180px;
      position: relative;
    }

    .category-list {
      -webkit-overflow-scrolling: touch;
    }

    .donut-wrapper {
      max-width: 180px;
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
  }

  @media (prefers-reduced-motion: reduce) {
    .cat-bar-fill {
      transition: none;
    }
  }

	/* ═══ FORCED MOBILE OVERRIDES ═══ */
	@media (max-width: 768px) {
		.cb-grid {
			display: grid !important;
			grid-template-columns: 1fr !important;
			gap: 16px !important;
		}

		.donut-section {
			height: 220px !important;
			max-height: 220px !important;
			width: 100% !important;
		}

		.donut-wrapper {
			max-width: 180px !important;
			height: 180px !important;
		}
	}
</style>

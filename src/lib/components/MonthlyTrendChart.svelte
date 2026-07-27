<script lang="ts">
  import { onMount } from 'svelte';
  import '$lib/utils/chart';
  import { Line } from 'svelte-chartjs';
  import { formatCurrency } from '$lib/utils/format';
  import type { ChartData, ChartOptions, TooltipModel } from 'chart.js';

  let {
    labels = [],
    incomeData = [],
    expenseData = [],
  }: {
    labels: string[];
    incomeData: number[];
    expenseData: number[];
  } = $props();

  let canvasEl = $state<HTMLCanvasElement | null>(null);
  let isDark = $state(false);

  // ─── External tooltip state ───────────────────────────────────────

  let tooltip = $state<{
    visible: boolean;
    x: number;
    y: number;
    label: string;
    income: number;
    expense: number;
  }>({
    visible: false,
    x: 0,
    y: 0,
    label: '',
    income: 0,
    expense: 0,
  });

  let tooltipEl = $state<HTMLDivElement | null>(null);

  onMount(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    isDark = mq.matches;
    const handler = (e: MediaQueryListEvent) => (isDark = e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  });

  // ─── Gradient fills ──────────────────────────────────────────────

  function buildGradients(): { incomeFill: CanvasGradient | string; expenseFill: CanvasGradient | string } {
    if (!canvasEl) return {
      incomeFill: isDark ? 'rgba(52, 211, 153, 0.2)' : 'rgba(16, 185, 129, 0.2)',
      expenseFill: isDark ? 'rgba(248, 113, 113, 0.12)' : 'rgba(239, 68, 68, 0.1)',
    };

    const ctx = canvasEl.getContext('2d');
    if (!ctx) return {
      incomeFill: 'rgba(16, 185, 129, 0.2)',
      expenseFill: 'rgba(239, 68, 68, 0.1)',
    };

    const h = canvasEl.clientHeight || 300;

    const incomeGrad = ctx.createLinearGradient(0, 0, 0, h);
    incomeGrad.addColorStop(0, isDark ? 'rgba(52, 211, 153, 0.28)' : 'rgba(16, 185, 129, 0.22)');
    incomeGrad.addColorStop(1, isDark ? 'rgba(52, 211, 153, 0)' : 'rgba(16, 185, 129, 0)');

    const expenseGrad = ctx.createLinearGradient(0, 0, 0, h);
    expenseGrad.addColorStop(0, isDark ? 'rgba(248, 113, 113, 0.18)' : 'rgba(239, 68, 68, 0.12)');
    expenseGrad.addColorStop(1, isDark ? 'rgba(248, 113, 113, 0)' : 'rgba(239, 68, 68, 0)');

    return { incomeFill: incomeGrad, expenseFill: expenseGrad };
  }

  const { incomeFill, expenseFill } = $derived(buildGradients());

  // ─── Derived colors ──────────────────────────────────────────────

  const incomeColor = $derived(isDark ? '#34d399' : '#10b981');
  const expenseColor = $derived(isDark ? '#f87171' : '#ef4444');
  const tickColor = $derived(isDark ? '#9ca3af' : '#6b7280');

  // ─── Chart data ──────────────────────────────────────────────────

  const chartData = $derived<ChartData<'line'>>({
    labels,
    datasets: [
      {
        label: 'Income',
        data: incomeData,
        borderColor: incomeColor,
        backgroundColor: incomeFill,
        tension: 0.4,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: incomeColor,
        pointHoverBorderColor: isDark ? '#111827' : '#ffffff',
        pointHoverBorderWidth: 2.5,
        borderWidth: 2.5,
      },
      {
        label: 'Expenses',
        data: expenseData,
        borderColor: expenseColor,
        backgroundColor: expenseFill,
        tension: 0.4,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: expenseColor,
        pointHoverBorderColor: isDark ? '#111827' : '#ffffff',
        pointHoverBorderWidth: 2.5,
        borderWidth: 2.5,
      },
    ],
  });

  // ─── Chart options — premium Copilot-style ───────────────────────

  const chartOptions = $derived<ChartOptions<'line'>>({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600, easing: 'easeOutQuart' },
    interaction: {
      intersect: false,
      mode: 'index',
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: isDark ? '#1f2937' : '#ffffff',
        titleColor: isDark ? '#f9fafb' : '#1a1a2e',
        bodyColor: isDark ? '#d1d5db' : '#4b5563',
        borderColor: isDark ? '#374151' : '#e5e7eb',
        borderWidth: 1,
        padding: 14,
        cornerRadius: 12,
        displayColors: true,
        boxPadding: 6,
        titleFont: { weight: 'bold', size: 13 },
        bodyFont: { weight: 'bold', size: 12 },
        caretPadding: 8,
        callbacks: {
          title: (items) => items[0]?.label || '',
          label: (ctx) => {
            const prefix = ctx.dataset.label === 'Income' ? '+' : '−';
            return ` ${ctx.dataset.label}: ${prefix}${formatCurrency(ctx.parsed.y ?? 0)}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: tickColor,
          font: { size: 11 },
          padding: 8,
          maxTicksLimit: 8,
        },
      },
      y: {
        position: 'right',
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: tickColor,
          font: { size: 10 },
          padding: 4,
          callback: (value) => {
            const v = Number(value);
            if (v >= 1000) return `₱${(v / 1000).toFixed(0)}k`;
            return `₱${v}`;
          },
        },
        beginAtZero: true,
      },
    },
    elements: {
      line: {
        borderJoinStyle: 'round',
        borderCapStyle: 'round',
      },
      point: {
        hoverBorderWidth: 3,
      },
    },
  });
</script>

<div class="chart-outer">
  {#if labels.length > 0}
    <!-- Invisible canvas for gradient context (Chart.js needs a real canvas) -->
    <canvas bind:this={canvasEl} class="chart-source"></canvas>

    <!-- The chart -->
    <div class="chart-container">
      <Line data={chartData} options={chartOptions} />
    </div>

    <!-- Custom HTML legend -->
    <div class="chart-legend">
      <span class="legend-item">
        <span class="legend-line" style="background: {incomeColor}"></span>
        Income
      </span>
      <span class="legend-item">
        <span class="legend-line" style="background: {expenseColor}"></span>
        Expenses
      </span>
    </div>
  {:else}
    <div class="empty-state">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 3v18h18"/><path d="M7 16l6-9 5 10"/>
      </svg>
      <span>No trend data yet</span>
    </div>
  {/if}
</div>

<style>
  .chart-outer {
    position: relative;
    width: 100%;
    height: 340px;
    display: flex;
    flex-direction: column;
  }

  .chart-source {
    position: absolute;
    opacity: 0;
    pointer-events: none;
    width: 100%;
    height: 100%;
  }

  .chart-container {
    position: relative;
    height: 290px;
    width: 100%;
  }

  .chart-container > :global(canvas) {
    height: 100% !important;
  }

  /* ─── Legend ─── */
  .chart-legend {
    display: flex;
    justify-content: center;
    gap: var(--space-xl);
    margin-top: var(--space-sm);
    padding-top: var(--space-sm);
    border-top: 1px solid var(--color-border);
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-xs);
    font-weight: 500;
    color: var(--color-text-secondary);
    letter-spacing: 0.02em;
  }

  .legend-line {
    width: 20px;
    height: 3px;
    border-radius: 2px;
  }

  /* ─── Empty state ─── */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: var(--space-sm);
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }

  @media (max-width: 640px) {
    .chart-outer {
      height: 280px;
    }
    .chart-container {
      height: 230px;
    }
  }
</style>

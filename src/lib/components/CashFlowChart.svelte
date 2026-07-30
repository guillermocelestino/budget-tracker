<script lang="ts">
  import '$lib/utils/chart';
  import { Line } from 'svelte-chartjs';
  import { formatCurrency } from '$lib/utils/format';
  import type { ChartData, ChartOptions } from 'chart.js';

  let {
    labels = [],
    incomeData = [],
    expenseData = [],
  }: {
    labels: string[];
    incomeData: number[];
    expenseData: number[];
  } = $props();

  // ─── Canvas for gradient generation ───
  let canvasEl = $state<HTMLCanvasElement | null>(null);

  // ─── Dark mode ───
  let isDark = $state(false);

  $effect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    isDark = mq.matches;
    const handler = (e: MediaQueryListEvent) => (isDark = e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  });

  // ─── Gradient fills (rebuilt when canvas or dark mode changes) ───
  let incomeFill = $state<string | CanvasGradient>(
    'rgba(43, 168, 162, 0.2)'
  );
  let expenseFill = $state<string | CanvasGradient>(
    'rgba(239, 108, 74, 0.12)'
  );

  $effect(() => {
    // Access dependencies so $effect tracks them
    const el = canvasEl;
    const dark = isDark;

    if (el) {
      const ctx = el.getContext('2d');
      if (ctx) {
        const h = Math.max(el.clientHeight, 300);

        const ig = ctx.createLinearGradient(0, 0, 0, h);
        ig.addColorStop(0, dark ? 'rgba(60, 196, 189, 0.25)' : 'rgba(43, 168, 162, 0.20)');
        ig.addColorStop(1, dark ? 'rgba(60, 196, 189, 0)' : 'rgba(43, 168, 162, 0)');

        const eg = ctx.createLinearGradient(0, 0, 0, h);
        eg.addColorStop(0, dark ? 'rgba(255, 138, 106, 0.18)' : 'rgba(239, 108, 74, 0.12)');
        eg.addColorStop(1, dark ? 'rgba(255, 138, 106, 0)' : 'rgba(239, 108, 74, 0)');

        incomeFill = ig;
        expenseFill = eg;
        return;
      }
    }

    // Fallback
    incomeFill = dark ? 'rgba(60, 196, 189, 0.2)' : 'rgba(43, 168, 162, 0.2)';
    expenseFill = dark ? 'rgba(255, 138, 106, 0.12)' : 'rgba(239, 108, 74, 0.12)';
  });

  // ─── Derived colors — Flip7 palette ───
  const incomeColor = $derived(isDark ? '#3CC4BD' : '#2BA8A2'); // teal
  const expenseColor = $derived(isDark ? '#FF8A6A' : '#EF6C4A'); // coral
  const tickColor = $derived(isDark ? '#8FB3B0' : '#5C7A78');
  const gridColor = $derived(isDark ? 'rgba(234,247,245,0.04)' : 'rgba(20,48,46,0.04)');

  // ─── Chart data ───
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
        pointHoverBorderColor: isDark ? '#0C1F1E' : '#ffffff',
        pointHoverBorderWidth: 3,
        borderWidth: 2.5,
        order: 2,
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
        pointHoverBorderColor: isDark ? '#0C1F1E' : '#ffffff',
        pointHoverBorderWidth: 3,
        borderWidth: 2.5,
        order: 2,
      },
    ],
  });

  // ─── Chart options ───
  const chartOptions = $derived<ChartOptions<'line'>>({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 1200, easing: 'easeOutQuart' },
    interaction: {
      intersect: false,
      mode: 'index',
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: false,
        external: (context) => {
          const tooltipEl = document.getElementById('cashflow-tooltip');
          if (!tooltipEl) return;

          const tooltipModel = context.tooltip;
          if (tooltipModel.opacity === 0) {
            tooltipEl.style.opacity = '0';
            tooltipEl.style.pointerEvents = 'none';
            return;
          }

          const dps = tooltipModel.dataPoints;
          if (!dps.length) return;

          // Build content
          const monthLabel = dps[0].label;
          const incomeVal = dps.find((d: { dataset: { label: string } }) => d.dataset.label === 'Income');
          const expenseVal = dps.find((d: { dataset: { label: string } }) => d.dataset.label === 'Expenses');

          const inc = incomeVal ? (incomeVal.parsed as { y: number }).y : 0;
          const exp = expenseVal ? (expenseVal.parsed as { y: number }).y : 0;
          const net = inc - exp;

          tooltipEl.innerHTML = `
            <div class="tt-label">${monthLabel}</div>
            <div class="tt-divider"></div>
            <div class="tt-row">
              <span class="tt-dot" style="background:${incomeColor}"></span>
              <span>Income</span>
              <span class="tt-amount income">+${formatCurrency(inc)}</span>
            </div>
            <div class="tt-row">
              <span class="tt-dot" style="background:${expenseColor}"></span>
              <span>Expenses</span>
              <span class="tt-amount expense">−${formatCurrency(exp)}</span>
            </div>
            <div class="tt-divider"></div>
            <div class="tt-row net">
              <span>Net</span>
              <span class="tt-amount" class:positive={net >= 0} class:negative={net < 0}>
                ${net >= 0 ? '+' : '−'}${formatCurrency(Math.abs(net))}
              </span>
            </div>
          `;

          // Position above the caret, centered horizontally
          const chartRect = context.chart.canvas.getBoundingClientRect();
          const containerRect = tooltipEl.parentElement!.getBoundingClientRect();
          const tooltipW = tooltipEl.offsetWidth || 180;

          let left = tooltipModel.caretX - tooltipW / 2;
          // Keep within container bounds
          left = Math.max(8, Math.min(left, containerRect.width - tooltipW - 8));

          const top = tooltipModel.caretY - 12;

          tooltipEl.style.left = `${left}px`;
          tooltipEl.style.top = `${top < 0 ? tooltipModel.caretY + 16 : top}px`;
          tooltipEl.style.opacity = '1';
          tooltipEl.style.pointerEvents = 'none';
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: tickColor,
          font: { size: 11, family: 'inherit' },
          padding: 8,
          maxTicksLimit: 6,
        },
      },
      y: {
        display: false,
        grid: { display: false },
        border: { display: false },
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

<div class="cf-outer">
  {#if labels.length > 0}
    <!-- Hidden canvas for gradient context -->
    <canvas bind:this={canvasEl} class="cf-source"></canvas>

    <!-- Custom HTML Legend -->
    <div class="cf-legend">
      <span class="cf-legend-item">
        <span class="cf-legend-line" style="background: {incomeColor}"></span>
        Income
        <span class="cf-legend-badge income-badge">
          {formatCurrency(incomeData.reduce((a, b) => a + b, 0) / (incomeData.filter(v => v > 0).length || 1))}
        </span>
      </span>
      <span class="cf-legend-item">
        <span class="cf-legend-line" style="background: {expenseColor}"></span>
        Expenses
        <span class="cf-legend-badge expense-badge">
          {formatCurrency(expenseData.reduce((a, b) => a + b, 0) / (expenseData.filter(v => v > 0).length || 1))}
        </span>
      </span>
    </div>

    <!-- Chart + Tooltip container -->
    <div class="cf-chart-wrap">
      <div class="cf-chart">
        <Line data={chartData} options={chartOptions} />
      </div>
      <div id="cashflow-tooltip" class="cf-tooltip"></div>
    </div>
  {:else}
    <div class="cf-empty">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 3v18h18"/><path d="M7 16l6-9 5 10"/>
      </svg>
      <span>No cash flow data yet</span>
    </div>
  {/if}
</div>

<style>
  /* ════════════════════════════════════════
     CASH FLOW CHART — FLIP7
     ════════════════════════════════════════ */

  .cf-outer {
    position: relative;
    width: 100%;
    height: 340px;
    display: flex;
    flex-direction: column;
  }

  .cf-source {
    position: absolute;
    opacity: 0;
    pointer-events: none;
    width: 100%;
    height: 100%;
  }

  /* ─── Custom Legend ─── */

  .cf-legend {
    display: flex;
    justify-content: center;
    gap: var(--space-xl);
    padding: 0 var(--space-md) var(--space-sm);
  }

  .cf-legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-xs);
    font-weight: 500;
    color: var(--color-text-muted);
    letter-spacing: 0.02em;
  }

  .cf-legend-line {
    width: 24px;
    height: 3px;
    border-radius: 2px;
  }

  .cf-legend-badge {
    font-size: var(--font-size-xs);
    font-weight: 600;
    padding: 1px 8px;
    border-radius: var(--radius-sm);
    font-variant-numeric: tabular-nums;
  }

  .income-badge {
    color: var(--color-teal);
    background: var(--color-teal-bg);
  }

  .expense-badge {
    color: var(--color-coral);
    background: rgba(239, 108, 74, 0.10);
  }

  /* ─── Chart Area ─── */

  .cf-chart-wrap {
    position: relative;
    flex: 1;
    min-height: 0;
    min-width: 0;
  }

  .cf-chart {
    height: 100%;
    width: 100%;
  }

  .cf-chart > :global(canvas) {
    height: 100% !important;
    width: 100% !important;
  }

  /* ─── Custom Tooltip — Cream "Scoring Chip" ─── */

  .cf-tooltip {
    position: absolute;
    opacity: 0;
    background: var(--color-cream);
    color: var(--color-ink);
    padding: 12px 16px;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card), 0 8px 32px rgba(43, 168, 162, 0.12);
    pointer-events: none;
    z-index: 10;
    min-width: 160px;
    transition: opacity 120ms ease;
    border: 1px solid var(--color-hairline);
    font-family: var(--font-body);
  }

  [data-theme="dark"] .cf-tooltip {
    background: #0E2725;
    box-shadow: var(--shadow-card), 0 8px 32px rgba(60, 196, 189, 0.12);
  }

  :global(.tt-label) {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-ink);
    margin-bottom: 4px;
  }

  [data-theme="dark"] :global(.tt-label) {
    color: var(--color-ink);
  }

  :global(.tt-divider) {
    height: 1px;
    background: var(--color-hairline);
    margin: 6px 0;
  }

  :global(.tt-row) {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    padding: 2px 0;
  }

  :global(.tt-row.net) {
    font-weight: 600;
    color: var(--color-ink);
  }

  :global(.tt-dot) {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  :global(.tt-amount) {
    margin-left: auto;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    font-family: var(--font-mono);
  }

  :global(.tt-amount.income) {
    color: var(--color-teal);
  }

  :global(.tt-amount.expense) {
    color: var(--color-coral);
  }

  :global(.tt-amount.positive) {
    color: var(--color-teal);
  }

  :global(.tt-amount.negative) {
    color: var(--color-coral);
  }

  /* ─── Empty State ─── */

  .cf-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: var(--space-sm);
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }

  /* ════════════════════════════════════════
     RESPONSIVE
     ════════════════════════════════════════ */

  @media (max-width: 768px) {
    .cf-outer {
      height: 280px;
    }
    .cf-legend-badge {
      display: none;
    }
    .cf-legend {
      padding: 0 var(--space-sm) var(--space-xs);
      gap: var(--space-md);
    }
  }

  @media (max-width: 480px) {
    .cf-outer {
      height: 240px;
    }
    .cf-legend-item {
      font-size: 10px;
    }
  }

		/* ═══ FORCED MOBILE OVERRIDES ═══ */
		@media (max-width: 768px) {
			.cf-outer {
				height: 250px !important;
				max-height: 250px !important;
			}

			.cf-chart {
				height: 200px !important;
				min-height: 200px !important;
			}
		}
</style>

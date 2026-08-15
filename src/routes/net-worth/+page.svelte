<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import '$lib/client/utils/chart';
  import { Line } from 'svelte-chartjs';
  import { formatCurrency } from '$lib/client/utils/format';
  import type { ChartOptions } from 'chart.js';
  import PageBackground from '$lib/client/components/PageBackground.svelte';
  import NetWorthHero from '$lib/client/components/NetWorthHero.svelte';
  import type { NetWorthSnapshot } from '$lib/types';

  let data = $derived($page.data as App.PageData);
  let snapshot: NetWorthSnapshot = $derived(data.netWorth!);

  // ─── Timeframe pills ───
  type Timeframe = '3M' | '6M' | '1Y' | 'ALL';
  let activeTimeframe = $state<Timeframe>('1Y');
  const timeframeOptions: Timeframe[] = ['3M', '6M', '1Y', 'ALL'];

  // ─── Filtered cash trend by timeframe ───
  const filteredTrend = $derived.by(() => {
    const all = snapshot.cashTrend;
    if (all.length === 0) return all;
    if (activeTimeframe === 'ALL') return all;
    const monthsMap: Partial<Record<Timeframe, number>> = { '3M': 3, '6M': 6, '1Y': 12 };
    const count = monthsMap[activeTimeframe] ?? 12;
    return all.slice(-count);
  });

  // ─── Dark mode for chart ───
  let isDark = $state(false);
  $effect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    isDark = mq.matches;
    const handler = (e: MediaQueryListEvent) => (isDark = e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  });

  // ─── Canvas for gradient ───
  let canvasEl = $state<HTMLCanvasElement | null>(null);
  let areaGradient = $state<string | CanvasGradient>('rgba(43,168,162,0.15)');

  $effect(() => {
    const el = canvasEl;
    if (el) {
      const ctx = el.getContext('2d');
      if (ctx) {
        const h = Math.max(el.clientHeight, 300);
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, isDark ? 'rgba(60,196,189,0.25)' : 'rgba(43,168,162,0.20)');
        g.addColorStop(1, 'rgba(43,168,162,0)');
        areaGradient = g;
        return;
      }
    }
    areaGradient = isDark ? 'rgba(60,196,189,0.15)' : 'rgba(43,168,162,0.15)';
  });

  // ─── Chart colors ───
  const tealColor = $derived(isDark ? '#3CC4BD' : '#2BA8A2');
  const tickColor = $derived(isDark ? '#8FB3B0' : '#5C7A78');
  const gridColor = $derived(isDark ? 'rgba(234,247,245,0.04)' : 'rgba(20,48,46,0.04)');

  // ─── Chart data: cash band ───
  const chartLabels = $derived(filteredTrend.map(p => {
    const [y, m] = p.month.split('-');
    const d = new Date(parseInt(y), parseInt(m) - 1);
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  }));

  const chartData = $derived.by(() => {
    const cashData = filteredTrend.map(p => p.cash);
    
    return {
      labels: chartLabels,
      datasets: [
        {
          label: 'Cash',
          data: cashData,
          borderColor: tealColor,
          backgroundColor: areaGradient,
          fill: true,
          tension: 0.3,
          pointRadius: cashData.length <= 6 ? 3 : 0,
          pointHitRadius: 6,
          pointBackgroundColor: tealColor,
          borderWidth: 2,
        },
      ]
    };
  });

  const chartOptions = $derived<ChartOptions<'line'>>({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? '#1A2928' : '#FFFFFF',
        titleColor: isDark ? '#EAF7F5' : '#14302E',
        bodyColor: isDark ? '#8FB3B0' : '#5C7A78',
        borderColor: isDark ? 'rgba(60,196,189,0.3)' : 'rgba(43,168,162,0.2)',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: (ctx) => `Cash: ${formatCurrency(ctx.parsed.y)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: tickColor, font: { size: 10, family: "'Nunito Sans', sans-serif" }, maxTicksLimit: 8 },
      },
      y: {
        grid: { color: gridColor },
        ticks: {
          color: tickColor,
          font: { size: 10, family: "'JetBrains Mono', monospace" },
          callback: (val) => formatCurrency(val as number),
        },
        beginAtZero: false,
      },
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
  });

  // ─── Drill-down handlers ───
  function drillTo(key: string) {
    if (key === 'cash') goto('/transactions');
    else if (key === 'lent') goto('/lending');
    else if (key === 'borrowed') goto('/borrowed');
  }

  // ─── Empty state ───
  const isEmpty = $derived(snapshot.legs.every(l => l.amount === 0) && snapshot.cashTrend.length === 0);
</script>

<svelte:head>
  <title>True Position — GET WRECK</title>
</svelte:head>

<PageBackground />

<!-- ═══════════════════════════════════════════════════════════════════════════
     TRUE POSITION HERO & BREAKDOWN
     ═══════════════════════════════════════════════════════════════════════════ -->
<div class="true-position-container">
  <header class="true-position-hero">
    <div class="hero-left">
      <div class="hero-badge teal">
        <span class="target-icon">🎯</span>
        <span class="badge-text">TRUE POSITION</span>
      </div>
      <h1 class="hero-title">WHAT DO I ACTUALLY HAVE?</h1>
      <p class="hero-subtitle">Bank balance isn't the whole story.</p>
      <p class="hero-equation">Available Cash + Money Away − Money Committed = True Position</p>
    </div>
    <div class="hero-right">
      <span class="hero-val-label">TRUE POSITION</span>
      <span class="hero-val-amount teal">{formatCurrency(snapshot.net)}</span>
    </div>
  </header>

  <!-- ═══ 3-Leg Position Breakdown ═══ -->
  <div class="position-breakdown-grid">
    <div class="leg-card">
      <span class="leg-tag">AVAILABLE CASH</span>
      <span class="leg-val">{formatCurrency(snapshot.cash)}</span>
      <span class="leg-desc">Liquid cash in register</span>
    </div>
    <div class="leg-operator">+</div>
    <div class="leg-card">
      <span class="leg-tag sky">MONEY AWAY</span>
      <span class="leg-val">{formatCurrency(snapshot.lentToday)}</span>
      <span class="leg-desc">Lent out (outside)</span>
    </div>
    <div class="leg-operator">−</div>
    <div class="leg-card">
      <span class="leg-tag gold">MONEY COMMITTED</span>
      <span class="leg-val">{formatCurrency(snapshot.borrowedToday)}</span>
      <span class="leg-desc">Borrowed & debt obligations</span>
    </div>
    <div class="leg-operator">=</div>
    <div class="leg-card hero-leg">
      <span class="leg-tag teal">TRUE POSITION</span>
      <span class="leg-val teal">{formatCurrency(snapshot.net)}</span>
      <span class="leg-desc">Your real financial standing</span>
    </div>
  </div>

  <!-- ═══ Bank Balance ≠ Real Position Callout ═══ -->
  <div class="position-insight-callout">
    <div class="callout-icon">💡</div>
    <div class="callout-content">
      <h3 class="callout-title">BANK BALANCE ≠ REAL POSITION</h3>
      <p class="callout-body">Cash you can see is only part of the picture. Money you've sent away and obligations you've already committed still affect where you actually stand.</p>
    </div>
  </div>
</div>

<!-- ═══ Empty state ═══ -->
{#if isEmpty}
  <div class="empty-state">
    <div class="empty-icon">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
        <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
      </svg>
    </div>
    <h3 class="empty-title">Your net-worth story starts at ₱0</h3>
    <p class="empty-sub">Log a transaction or a debt to begin the climb 🌱</p>
    <a href="/transactions/new" class="empty-cta">Get Started</a>
  </div>
{:else}
  <!-- ═══ Hero + tipping bar ═══ -->
  <div class="hero-section">
    <NetWorthHero {snapshot} variant="full" />
  </div>

  <!-- ═══ Composition journey (stacked area chart) ═══ -->
  {#if snapshot.cashTrend.length > 0}
    <div class="chart-section">
      <div class="chart-header">
        <span class="chart-emoji-box">📈</span>
        <span class="chart-title">YOUR CASH JOURNEY</span>
        <div class="timeframe-pills">
          {#each timeframeOptions as tf (tf)}
            <button
              class="pill"
              class:pill-active={activeTimeframe === tf}
              onclick={() => activeTimeframe = tf}
            >{tf}</button>
          {/each}
        </div>
      </div>

      <div class="chart-card">
        <div class="chart-container">
          <canvas bind:this={canvasEl} style="display:none;"></canvas>
          <Line data={chartData} options={chartOptions} />
        </div>
        <!-- Honesty caption -->
        <p class="chart-caption">{snapshot.caption}</p>
      </div>
    </div>
  {/if}

  <!-- ═══ Composition podium — already rendered by NetWorthHero ═══ -->

  <!-- ═══ Narrative delta + projection chips ═══ -->
  <div class="insight-section">
    <!-- Narrative delta -->
    {#if snapshot.biggestMover}
      <p class="insight-line">
        Your net worth is <strong class="net-figure">{formatCurrency(snapshot.net)}</strong> —
        {snapshot.biggestMover.amount >= 0 ? 'up' : 'down'}
        <strong class="delta-figure" style="color: {snapshot.biggestMover.amount >= 0 ? 'var(--color-teal)' : 'var(--color-coral)'}">
          {formatCurrency(Math.abs(snapshot.biggestMover.amount))}
        </strong>
        this period, mostly from <em>{snapshot.biggestMover.label}</em>.
      </p>
    {/if}

    <!-- Projection chip -->
    {#if snapshot.projection}
      <div class="projection-chip">
        <span class="proj-icon">🔮</span>
        <span class="proj-text">{snapshot.projection.text}</span>
      </div>
    {/if}
  </div>

  <!-- ═══ Drill-down links ═══ -->
  <div class="drill-section">
    <span class="drill-title">SOURCE</span>
    <div class="drill-row">
      {#each snapshot.legs as leg (leg.key)}
        <button class="drill-btn" style="--btn-color: var(--color-{leg.tone})" onclick={() => drillTo(leg.key)}>
          <span class="drill-dot" style="background: var(--color-{leg.tone})"></span>
          <span class="drill-label">{leg.label}</span>
          <span class="drill-amount">{leg.liability ? '−' : ''}{formatCurrency(leg.amount)}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  /* ─── TRUE POSITION HERO & BREAKDOWN ─── */
  .true-position-container {
    display: flex;
    flex-direction: column;
    gap: var(--space-md, 12px);
    margin-bottom: var(--space-xl, 24px);
  }

  .true-position-hero {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-lg, 16px);
    padding: 22px 28px;
    background: var(--color-surface);
    border: 1px solid var(--color-hairline);
    border-radius: 24px;
    box-shadow: var(--shadow-sm);
  }

  .hero-left {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .hero-badge.teal {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    background: var(--color-teal-bg, rgba(30, 140, 134, 0.12));
    border-radius: var(--radius-pill, 999px);
    width: fit-content;
    margin-bottom: 2px;
  }

  .hero-badge.teal .badge-text {
    font-family: var(--font-display);
    font-size: 11px;
    font-weight: 800;
    color: var(--color-true-position, #1E8C86);
    letter-spacing: 0.12em;
  }

  .hero-title {
    font-family: var(--font-display);
    font-size: clamp(20px, 2.4vw, 26px);
    font-weight: 800;
    color: var(--color-ink);
    margin: 0;
    letter-spacing: -0.02em;
    line-height: 1.15;
  }

  .hero-subtitle {
    font-size: var(--font-size-sm, 14px);
    color: var(--color-text-muted);
    margin: 2px 0 0 0;
  }

  .hero-equation {
    font-family: var(--font-mono, monospace);
    font-size: 12px;
    color: var(--color-true-position, #1E8C86);
    font-weight: 600;
    margin: 6px 0 0 0;
    opacity: 0.9;
  }

  .hero-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    justify-content: center;
  }

  .hero-val-label {
    font-size: 11px;
    font-weight: 800;
    color: var(--color-text-muted);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .hero-val-amount.teal {
    font-family: var(--font-display);
    font-size: clamp(24px, 3vw, 36px);
    font-weight: 900;
    color: var(--color-true-position, #1E8C86);
    line-height: 1.1;
  }

  /* 3-Leg Position Breakdown */
  .position-breakdown-grid {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
  }

  .leg-card {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 14px 16px;
    background: var(--color-surface);
    border: 1px solid var(--color-hairline);
    border-radius: 18px;
    box-shadow: var(--shadow-sm);
  }

  .leg-card.hero-leg {
    border-color: var(--color-true-position, #1E8C86);
    background: var(--color-surface);
  }

  .leg-tag {
    font-size: 11px;
    font-weight: 800;
    color: var(--color-text-muted);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 4px;
  }

  .leg-tag.sky {
    color: var(--color-money-away, #5DADE2);
  }

  .leg-tag.gold {
    color: var(--color-money-committed, #D97706);
  }

  .leg-tag.teal {
    color: var(--color-true-position, #1E8C86);
  }

  .leg-val {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 800;
    color: var(--color-ink);
  }

  .leg-val.teal {
    color: var(--color-true-position, #1E8C86);
  }

  .leg-desc {
    font-size: 11px;
    color: var(--color-text-muted);
    margin-top: 2px;
  }

  .leg-operator {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 800;
    color: var(--color-text-muted);
    padding: 0 4px;
  }

  /* Insight callout */
  .position-insight-callout {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 16px 20px;
    background: var(--color-surface);
    border: 1px solid var(--color-hairline);
    border-left: 4px solid var(--color-true-position, #1E8C86);
    border-radius: 16px;
    box-shadow: var(--shadow-sm);
  }

  .callout-icon {
    font-size: 20px;
    line-height: 1;
    margin-top: 2px;
  }

  .callout-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .callout-title {
    font-family: var(--font-display);
    font-size: 13px;
    font-weight: 800;
    color: var(--color-ink);
    letter-spacing: 0.05em;
    margin: 0;
  }

  .callout-body {
    font-size: 13px;
    color: var(--color-text-muted);
    margin: 0;
    line-height: 1.45;
  }

  @media (max-width: 768px) {
    .true-position-hero {
      flex-direction: column;
      align-items: flex-start;
      padding: 16px;
    }

    .hero-right {
      align-items: flex-start;
      margin-top: 8px;
    }

    .position-breakdown-grid {
      flex-direction: column;
      align-items: stretch;
    }

    .leg-operator {
      text-align: center;
      padding: 2px 0;
    }
  }

  .header-sub {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
    font-weight: 400;
    font-family: var(--font-body);
  }

  /* ── Hero section ── */
  .hero-section {
    background: var(--color-surface);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-xl);
    padding: var(--space-xl);
    box-shadow: var(--shadow-card);
    margin-bottom: var(--space-lg);
  }

  /* ── Chart section ── */
  .chart-section {
    margin-bottom: var(--space-lg);
  }

  .chart-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin-bottom: var(--space-md);
    flex-wrap: wrap;
  }

  .chart-emoji-box {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-teal-bg);
    border-radius: var(--radius-sm);
    font-size: 16px;
    flex-shrink: 0;
  }

  .chart-title {
    font-family: var(--font-display);
    font-size: var(--font-size-sm);
    font-weight: 700;
    color: var(--color-ink);
    letter-spacing: 0.03em;
    flex: 1;
  }

  .timeframe-pills {
    display: flex;
    gap: 4px;
    background: var(--color-bg);
    padding: 3px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-hairline);
  }

  .pill {
    padding: 4px 12px;
    border: none;
    background: transparent;
    border-radius: var(--radius-sm);
    cursor: pointer;
    color: var(--color-text-muted);
    font-size: var(--font-size-xs);
    font-weight: 600;
    font-family: var(--font-body);
    transition: all var(--transition-fast);
    min-height: 30px;
  }

  .pill-active {
    background: var(--color-teal-bg);
    color: var(--color-teal);
  }

  .pill:hover:not(.pill-active) {
    background: var(--color-surface);
    color: var(--color-ink);
  }

  .chart-card {
    background: var(--color-surface);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-xl);
    padding: var(--space-lg);
    box-shadow: var(--shadow-card);
  }

  .chart-container {
    height: 300px;
    min-width: 0;
  }

  .chart-caption {
    margin: var(--space-md) 0 0;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    font-style: italic;
    line-height: 1.5;
    padding-top: var(--space-md);
    border-top: 1px dashed var(--color-hairline);
  }

  /* ── Insight section ── */
  .insight-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    margin-bottom: var(--space-lg);
  }

  .insight-line {
    background: var(--color-teal-bg);
    border-radius: var(--radius-lg);
    padding: var(--space-md) var(--space-lg);
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    color: var(--color-text);
    line-height: 1.6;
    margin: 0;
  }

  .net-figure {
    font-family: var(--font-mono);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .delta-figure {
    font-family: var(--font-mono);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .projection-chip {
    display: flex;
    align-items: flex-start;
    gap: var(--space-sm);
    padding: var(--space-md);
    background: rgba(93, 173, 226, 0.08);
    border: 1px solid rgba(93, 173, 226, 0.2);
    border-radius: var(--radius-lg);
    color: var(--color-sky);
  }

  .proj-icon {
    font-size: 16px;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .proj-text {
    font-size: var(--font-size-xs);
    line-height: 1.5;
    color: var(--color-text-muted);
  }

  /* ── Drill-down ── */
  .drill-section {
    background: var(--color-surface);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-xl);
    padding: var(--space-lg);
    box-shadow: var(--shadow-card);
  }

  .drill-title {
    display: block;
    font-family: var(--font-display);
    font-size: 10px;
    font-weight: 700;
    color: var(--color-text-muted);
    letter-spacing: 0.06em;
    margin-bottom: var(--space-sm);
    text-transform: uppercase;
  }

  .drill-row {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .drill-btn {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    background: transparent;
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-md);
    cursor: pointer;
    font-family: inherit;
    transition: all 120ms var(--ease);
    width: 100%;
    text-align: left;
    color: var(--color-text);
    min-height: 44px;
  }

  .drill-btn:hover {
    background: var(--color-teal-bg);
    border-color: var(--color-teal);
    transform: translateX(4px);
  }

  .drill-dot {
    width: 10px;
    height: 10px;
    border-radius: var(--radius-full);
    flex-shrink: 0;
  }

  .drill-label {
    flex: 1;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text);
  }

  .drill-amount {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--color-text);
  }

  .drill-btn svg {
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  .drill-btn:hover svg {
    color: var(--color-teal);
  }

  /* ── Empty state ── */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-3xl) var(--space-md);
    text-align: center;
    background: var(--color-surface);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-card);
  }

  .empty-icon {
    width: 72px;
    height: 72px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-teal-bg);
    color: var(--color-teal);
    border-radius: var(--radius-lg);
    margin-bottom: var(--space-md);
  }

  .empty-title {
    font-family: var(--font-display);
    font-size: var(--font-size-base);
    font-weight: 700;
    color: var(--color-ink);
    margin: 0 0 4px;
  }

  .empty-sub {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
    margin: 0 0 var(--space-lg);
  }

  .empty-cta {
    padding: var(--space-sm) var(--space-xl);
    background: var(--color-gold);
    color: var(--color-ink);
    border-radius: var(--radius-pill);
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--font-size-sm);
    text-decoration: none;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    transition: all 200ms var(--bounce);
    box-shadow: var(--glow-gold);
  }

  .empty-cta:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 24px rgba(255, 210, 63, 0.55);
  }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .hero-section { padding: var(--space-md); }
    .chart-container { height: 220px; }
    .chart-card { padding: var(--space-md); }
  }

  @media (max-width: 480px) {
    .hero-section { padding: var(--space-sm); }
    .chart-container { height: 180px; }
    .chart-header { flex-direction: column; align-items: flex-start; }
    .timeframe-pills { width: 100%; }
    .pill { flex: 1; text-align: center; }
  }

  @media (prefers-reduced-motion: reduce) {
    .drill-btn { transition: none; }
    .drill-btn:hover { transform: none; }
  }
</style>
<script lang="ts">
  import { formatCurrency, countUp } from '$lib/utils/format';
  import Sparkline from './Sparkline.svelte';

  let {
    income = 0,
    incomeChange = 0,
    incomeTrend = [] as number[],
    incomeLabels = [] as string[],
    expenses = 0,
    expenseChange = 0,
    expenseTrend = [] as number[],
    expenseLabels = [] as string[],
    lentOutstanding = 0,
    recovered = 0,
    borrowedOutstanding = 0,
    repaid = 0,
  }: {
    income?: number;
    incomeChange?: number;
    incomeTrend?: number[];
    incomeLabels?: string[];
    expenses?: number;
    expenseChange?: number;
    expenseTrend?: number[];
    expenseLabels?: string[];
    lentOutstanding?: number;
    recovered?: number;
    borrowedOutstanding?: number;
    repaid?: number;
  } = $props();

  // ─── Count-up animations ──────────────────────────────────────
  let dispIncome = $state(0);
  let dispExpenses = $state(0);
  let dispLent = $state(0);
  let dispBorrowed = $state(0);

  $effect(() => {
    const c1 = countUp(income, 600, (v) => dispIncome = v);
    const c2 = countUp(expenses, 600, (v) => dispExpenses = v);
    const c3 = countUp(lentOutstanding, 600, (v) => dispLent = v);
    const c4 = countUp(borrowedOutstanding, 600, (v) => dispBorrowed = v);
    return () => { c1(); c2(); c3(); c4(); };
  });

  // ─── Good/bad helpers ────────────────────────────────────────
  function deltaColor(change: number, invert: boolean): string {
    if (change === 0) return 'var(--color-text-muted)';
    const isGood = invert ? change < 0 : change > 0;
    return isGood ? 'var(--color-positive)' : 'var(--color-negative)';
  }

  function deltaArrow(change: number, invert: boolean): string {
    if (change > 0) return '↑';
    if (change < 0) return '↓';
    return '→';
  }

  function goodBad(change: number, invert: boolean): string {
    if (change === 0) return 'neutral';
    return invert ? (change < 0 ? 'good' : 'bad') : (change > 0 ? 'good' : 'bad');
  }

  const incomeGood = $derived(goodBad(incomeChange, false));
  const expenseGood = $derived(goodBad(expenseChange, true));

  // KPI card data with tier (primary/compact)
  const kpiCards = $derived([
    {
      label: 'Income',
      value: dispIncome,
      change: incomeChange,
      goodBad: incomeGood,
      tone: 'teal',
      trend: incomeTrend,
      labels: incomeLabels,
      href: '/transactions?type=income',
      tier: 'primary' as const,
    },
    {
      label: 'Expenses',
      value: dispExpenses,
      change: expenseChange,
      goodBad: expenseGood,
      tone: 'coral',
      trend: expenseTrend,
      labels: expenseLabels,
      href: '/transactions?type=expense',
      tier: 'primary' as const,
    },
    {
      label: 'Lent Out',
      value: dispLent,
      change: recovered,
      goodBad: recovered > 0 ? 'good' : 'neutral',
      tone: 'gold',
      trend: [],
      labels: [],
      href: '/lending',
      subLabel: recovered > 0 ? `${formatCurrency(recovered)} recovered` : null,
      tier: 'compact' as const,
    },
    {
      label: 'Owe',
      value: dispBorrowed,
      change: repaid,
      goodBad: repaid > 0 ? 'good' : 'neutral',
      tone: 'sky',
      trend: [],
      labels: [],
      href: '/borrowed',
      subLabel: repaid > 0 ? `${formatCurrency(repaid)} repaid` : null,
      tier: 'compact' as const,
    },
  ]);
</script>

<div class="kpi-rail">
  <div class="rail-inner">
    {#each kpiCards as card (card.label)}
      <a href={card.href} class="kpi-card flip7-card" class:primary={card.tier === 'primary'} class:compact={card.tier === 'compact'} class:accent-teal={card.tone === 'teal'} class:accent-coral={card.tone === 'coral'} class:accent-gold={card.tone === 'gold'} class:accent-sky={card.tone === 'sky'}>
        <div class="kpi-accent"></div>
        <div class="kpi-body">
          <span class="kpi-label">{card.label}</span>
          <span class="kpi-value" class:positive={card.tone === 'teal'} class:negative={card.tone === 'coral' || card.tone === 'sky'}>
            {card.tone === 'coral' || card.tone === 'sky' ? '−' : '+'}{formatCurrency(card.value)}
          </span>
          {#if card.change !== 0 && card.change != null}
            <span class="kpi-delta {card.goodBad}" style="--delta-color: var(--color-{card.goodBad === 'good' ? 'positive' : 'negative'})">
              <span class="delta-arrow">{deltaArrow(card.change, card.tone === 'coral' || card.tone === 'sky')}</span>
              {card.change > 0 ? '+' : ''}{card.change.toFixed(1)}%
            </span>
          {:else if card.subLabel}
            <span class="kpi-delta good" style="--delta-color: var(--color-positive)">
              <span class="delta-arrow">↑</span>
              {card.subLabel}
            </span>
          {/if}
        </div>
        {#if card.tier === 'primary' && card.trend.length > 1}
          <div class="kpi-spark">
            <Sparkline labels={card.labels} data={card.trend} />
          </div>
        {/if}
      </a>
    {/each}
  </div>
</div>

<style>
  /* ═══════════════════════════════════════════════════════
     KPI RAIL — Flip7 Cards
     Desktop: 4-col grid | Tablet: 2-col grid | Mobile: scroll rail
     Replaces MobileSummaryRail — now visible on all viewports
     ═══════════════════════════════════════════════════════ */

  .kpi-rail {
    width: 100%;
    margin-bottom: var(--space-xl);
  }

  /* ─── Rail inner — responsive grid → scroll rail ─── */
  .rail-inner {
    display: grid;
    grid-template-columns: repeat(4, minmax(180px, 1fr));
    gap: var(--space-md);
    width: 100%;
  }

  /* ─── KPI Card — Flip7 Card Base ─── */
  .kpi-card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    padding: var(--space-md) var(--space-lg);
    padding-left: calc(var(--space-lg) + 12px);
    background: var(--color-surface);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-card);
    text-decoration: none;
    color: inherit;
    transition: transform 200ms var(--bounce), box-shadow 200ms var(--ease);
    -webkit-tap-highlight-color: transparent;
    overflow: hidden;
  }

  .kpi-card.primary {
    padding: var(--space-md) var(--space-lg);
    padding-left: calc(var(--space-lg) + 12px);
  }

  .kpi-card.compact {
    padding: var(--space-sm) var(--space-md);
    padding-left: calc(var(--space-md) + 10px);
    min-width: 140px;
  }

  .kpi-card:active {
    transform: scale(0.97);
  }

  @media (pointer: fine) {
    .kpi-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--glow-card);
    }
  }

  /* ─── Left accent bar (semantic) ─── */
  .kpi-accent {
    position: absolute;
    left: 0;
    top: 4px;
    bottom: 4px;
    width: 5px;
    border-radius: 0 3px 3px 0;
  }

  .accent-teal .kpi-accent { background: var(--color-teal); }
  .accent-coral .kpi-accent { background: var(--color-coral); }
  .accent-gold .kpi-accent { background: var(--color-gold); }
  .accent-sky .kpi-accent { background: var(--color-sky); }

  /* Dark mode: .flip7-card::before handles the glow */

  /* ─── Card body ─── */
  .kpi-body {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding-left: var(--space-sm);
  }

  .kpi-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  .kpi-value {
    font-family: var(--font-display);
    font-size: var(--font-size-xl);
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
    line-height: 1.15;
    color: var(--color-ink);
  }

  .kpi-card.compact .kpi-value {
    font-size: var(--font-size-lg);
  }

  .kpi-value.positive { color: var(--color-teal); }
  .kpi-value.negative { color: var(--color-coral); }

  .kpi-delta {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: var(--font-size-xs);
    font-weight: 700;
    margin-top: 2px;
    font-variant-numeric: tabular-nums;
  }

  .kpi-delta.good { color: var(--color-positive); }
  .kpi-delta.bad { color: var(--color-negative); }
  .kpi-delta.neutral { color: var(--color-text-muted); }

  .delta-arrow {
    font-size: 10px;
  }

  /* ─── Sparkline ─── */
  .kpi-spark {
    height: 32px;
    margin-top: var(--space-xs);
    width: 100%;
  }

  .kpi-spark :global(.sparkline-container) {
    height: 32px;
  }

  .kpi-card.compact .kpi-spark {
    display: none;
  }

  /* ═══════════════════════════════════════
     RESPONSIVE
     ═══════════════════════════════════════ */

  /* Desktop: 4-col grid */
  @media (min-width: 1025px) {
    .rail-inner {
      display: grid;
      grid-template-columns: repeat(4, minmax(180px, 1fr));
      gap: var(--space-md);
      width: 100%;
    }
  }

  /* Tablet: 2-col grid */
  @media (max-width: 1024px) and (min-width: 769px) {
    .rail-inner {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: var(--space-md);
      width: 100%;
    }
  }

  /* Mobile: horizontal scroll rail */
  @media (max-width: 768px) {
    .rail-inner {
      display: flex;
      flex-wrap: nowrap;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scroll-snap-type: x proximity;
      gap: var(--space-md);
      padding-inline: var(--space-md);
      touch-action: pan-x pan-y;
      scrollbar-width: none;
    }

    .rail-inner::-webkit-scrollbar {
      display: none;
    }

    .kpi-card {
      flex: 0 0 auto;
      width: min(78vw, 280px);
      min-width: 0;
      scroll-snap-align: start;
    }

    .kpi-card.primary {
      scroll-snap-align: start;
    }
  }

  @media (max-width: 480px) {
    .kpi-card {
      padding: var(--space-sm) var(--space-md);
      padding-left: calc(var(--space-md) + 10px);
    }

    .kpi-value {
      font-size: var(--font-size-lg);
    }

    .kpi-spark {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .kpi-card {
      transition: none;
    }
    .kpi-card:hover {
      transform: none;
    }
  }
</style>
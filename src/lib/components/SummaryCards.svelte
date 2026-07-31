<script lang="ts">
  import { formatCurrency, countUp } from '$lib/utils/format';
  import { onMount } from 'svelte';

  let {
    totalIncome = 0,
    totalExpenses = 0,
    balance = 0,
    savingsRate = 0,
  }: {
    totalIncome?: number;
    totalExpenses?: number;
    balance?: number;
    savingsRate?: number;
  } = $props();

  // Animated display values
  let displayedIncome = $state(0);
  let displayedExpenses = $state(0);
  let displayedBalance = $state(0);
  let displayedSavingsRate = $state(0);

  onMount(() => {
    countUp(totalIncome, 800, (v) => (displayedIncome = v));
    countUp(totalExpenses, 800, (v) => (displayedExpenses = v));
    countUp(balance, 800, (v) => (displayedBalance = v));
    countUp(savingsRate, 1200, (v) => (displayedSavingsRate = v));
  });

  const displayIncome = $derived(formatCurrency(displayedIncome));
  const displayExpenses = $derived(formatCurrency(displayedExpenses));
  const balanceSign = $derived(displayedBalance < 0 ? '−' : '');
  const displayBalance = $derived(formatCurrency(Math.abs(displayedBalance)));
  const displaySavings = $derived(`${displayedSavingsRate.toFixed(1)}%`);

  // Derived trend chips
  const incomePct = $derived(
    totalIncome + totalExpenses > 0
      ? `${((totalIncome / (totalIncome + totalExpenses)) * 100).toFixed(0)}% of inflow`
      : ''
  );
  const expensePct = $derived(
    totalIncome > 0 ?
      `${((totalExpenses / totalIncome) * 100).toFixed(0)}% vs income`
      : '—'
  );

  // Savings arc dasharray
  const savingsArc = $derived(
    `${Math.min(Math.abs(displayedSavingsRate), 100) * 1.13} 400`
  );
</script>

<div class="summary-row">
  <!-- INCOME CARD — teal accent -->
  <article class="card accent-teal flip7-card">
    <div class="card-icon-ring income-ring">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    </div>
    <div class="card-body">
      <span class="label">Income</span>
      <span class="amount">{displayIncome}</span>
      <span class="trend income-trend">{incomePct}</span>
    </div>
  </article>

  <!-- EXPENSE CARD — coral accent -->
  <article class="card accent-coral flip7-card">
    <div class="card-icon-ring expense-ring">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="23 18 14.5 10.5 9.5 15.5 1 6" />
        <polyline points="7 18 1 18 1 12" />
      </svg>
    </div>
    <div class="card-body">
      <span class="label">Expenses</span>
      <span class="amount">{displayExpenses}</span>
      <span class="trend expense-chip">+{expensePct}</span>
    </div>
  </article>

  <!-- BALANCE CARD (HERO — Copilot-style big number) — gold accent -->
  <article class="card hero flip7-card" class:negative={displayedBalance < 0}>
    <div class="hero-glow"></div>
    <div class="flip7-watermark" aria-hidden="true">
      <svg width="120" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="2"/>
        <circle cx="12" cy="12" r="2.5"/>
        <path d="M6 12h.01M18 12h.01"/>
      </svg>
    </div>
    <div class="hero-body">
      <span class="label">Balance</span>
      <span class="hero-value">{balanceSign}{displayBalance}</span>
    </div>
    <div class="hero-ring" class:negative={displayedBalance < 0}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12h8 M12 8v8" />
      </svg>
    </div>
  </article>

  <!-- SAVINGS CARD — sky accent -->
  <article class="card accent-sky flip7-card" class:negative={displayedSavingsRate < 0}>
    <div class="savings-donut">
      <svg viewBox="0 0 44 44" width="44" height="44">
        <circle cx="22" cy="22" r="18" fill="none" stroke="var(--color-border)" stroke-width="4" />
        <circle
          cx="22" cy="22" r="18"
          fill="none"
          stroke="currentColor"
          stroke-width="4"
          stroke-linecap="round"
          stroke-dasharray={savingsArc}
          transform="rotate({-90} {22} {22})"
          class="savings-arc"
        />
      </svg>
    </div>
    <div class="card-body">
      <span class="label">Savings</span>
      <span class="amount">{displaySavings}</span>
    </div>
  </article>
</div>

<style>
  /* —— Layout —— */
  .summary-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1.4fr 1fr;
    gap: var(--space-md);
    margin-bottom: var(--space-lg);
  }

  /* —— Card base —— */
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-left: 5px solid var(--color-teal);
    border-radius: var(--radius-xl);
    padding: var(--space-lg);
    overflow: hidden;
    transition: background 200ms ease, border-color 200ms ease, transform 180ms ease;
  }

  .card:hover {
    border-color: var(--color-text-muted);
    transform: translateY(-1px);
  }

  .card.accent-teal {
    border-left-color: var(--color-teal);
  }

  .card.accent-coral {
    border-left-color: var(--color-coral);
  }

  .card.accent-sky {
    border-left-color: var(--color-sky);
  }

  /* ── Dark signature: the Flip7 ::before accent replaces the light border-left ── */
  [data-theme="dark"] .card {
    border-left-width: 0;
  }

  [data-theme="dark"] .card.accent-teal.flip7-card::before {
    background: var(--color-teal);
    box-shadow: var(--glow-card);
  }

  [data-theme="dark"] .card.accent-coral.flip7-card::before {
    background: var(--color-coral);
    box-shadow: var(--glow-coral);
  }

  [data-theme="dark"] .card.accent-sky.flip7-card::before {
    background: var(--color-sky);
    box-shadow: var(--glow-sky);
  }

  [data-theme="dark"] .card.hero.flip7-card::before {
    background: var(--color-gold);
    box-shadow: var(--glow-gold);
  }

  /* —— Icon ring — small muted ring, not large filled block —— */
  .card-icon-ring {
    width: 38px;
    height: 38px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .income-ring {
    background: var(--color-teal-bg);
    color: var(--color-teal);
  }

  .expense-ring {
    background: rgba(239, 108, 74, 0.10);
    color: var(--color-coral);
  }

  /* —— Typography —— */
  .card-body {
    display: flex;
    flex-direction: column;
    z-index: 1;
  }

  .label {
    font-size: var(--font-size-xs);
    font-weight: 500;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 4px;
  }

  .amount {
    font-size: var(--font-size-xl);
    font-weight: 700;
    color: var(--color-ink);
    line-height: 1.15;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.025em;
  }

  /* Trend chips */
  .trend {
    margin-top: 6px;
    font-size: var(--font-size-xs);
    font-weight: 500;
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    width: fit-content;
  }

  .income-trend {
    color: var(--color-teal);
    background: var(--color-teal-bg);
  }

  .expense-chip {
    color: var(--color-coral);
    background: rgba(239, 108, 74, 0.10);
  }

  /* —— Hero (balance) card —— */
  .hero {
    background: linear-gradient(160deg, var(--color-surface) 0%, var(--color-teal-bg) 100%);
    border-left-color: var(--color-gold);
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  .hero.negative {
    background: linear-gradient(160deg, var(--color-surface) 0%, rgba(239, 108, 74, 0.08) 100%);
    border-left-color: var(--color-coral);
  }

  .hero-glow {
    position: absolute;
    top: -60px;
    right: -60px;
    width: 180px;
    height: 180px;
    border-radius: 50%;
    background: radial-gradient(circle, var(--color-teal-bg) 0%, transparent 70%);
    opacity: 0.4;
    pointer-events: none;
  }

  .hero.negative .hero-glow {
    background: radial-gradient(circle, rgba(239, 108, 74, 0.08) 0%, transparent 70%);
  }

  .hero-value {
    font-size: var(--font-size-3xl);
    font-weight: 800;
    color: var(--color-ink);
    letter-spacing: -0.04em;
    font-variant-numeric: tabular-nums;
  }

  .hero.negative .hero-value {
    color: var(--color-coral);
  }

  .hero-body {
    position: relative;
    z-index: 1;
  }

  .hero-ring {
    width: 44px;
    height: 44px;
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-gold-dark);
    background: rgba(255, 210, 63, 0.15);
    flex-shrink: 0;
    z-index: 1;
  }

  .hero-ring.negative {
    color: var(--color-coral);
    background: rgba(239, 108, 74, 0.10);
  }

  /* —— Savings donut ring —— */
  .savings-donut {
    position: relative;
    width: 44px;
    height: 44px;
    flex-shrink: 0;
  }

  .savings-arc {
    color: var(--color-teal);
    transition: stroke-dasharray 800ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .card.negative .savings-arc {
    color: var(--color-coral);
  }

  /* —— Responsive —— */
  @media (max-width: 1024px) {
    .summary-row { grid-template-columns: 1fr 1fr; }
    .hero { grid-column: span 2; }
  }

  @media (max-width: 640px) {
    .summary-row { grid-template-columns: 1fr; gap: var(--space-sm); }
    .hero { grid-column: span 1; flex-direction: column; align-items: flex-start; gap: var(--space-sm); }
    .hero-ring { position: absolute; top: var(--space-md); right: var(--space-md); }
    .hero-glow { display: none; }
    .card { flex-direction: row; align-items: center; gap: var(--space-md); padding: var(--space-md); }
    .card-body { flex: 1; }
  }
</style>

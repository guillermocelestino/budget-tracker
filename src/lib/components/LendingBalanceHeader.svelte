<script lang="ts">
  import { formatCurrency, countUp } from '$lib/utils/format';
  import { onMount } from 'svelte';

  let {
    totalOwedToMe = 0,
    totalIOwe = 0,
  }: {
    totalOwedToMe?: number;
    totalIOwe?: number;
  } = $props();

  const netBalance = $derived(totalOwedToMe - totalIOwe);
  const isNetCreditor = $derived(netBalance > 0);
  const isNetDebtor = $derived(netBalance < 0);
  const isSettled = $derived(netBalance === 0);

  // Animated display
  let displayedNet = $state(0);
  onMount(() => countUp(Math.abs(netBalance), 700, (v) => (displayedNet = v)));

  const displayNet = $derived(formatCurrency(displayedNet));

  const labelText = $derived(
    isSettled ? 'All settled up'
      : isNetCreditor ? 'You are owed money'
      : 'You owe money'
  );

  const subText = $derived(
    isSettled ? 'No outstanding balances'
      : isNetCreditor
        ? `${formatCurrency(totalOwedToMe)} owed to you · You owe ${formatCurrency(totalIOwe)}`
        : `You owe ${formatCurrency(totalIOwe)} · Owed to you ${formatCurrency(totalOwedToMe)}`
  );
</script>

<div class="balance-hero" class:creditor={isNetCreditor} class:debtor={isNetDebtor} class:settled={isSettled}>
  <div class="hero-glow"></div>

  <!-- Label row -->
  <div class="hero-label-row">
    <span class="hero-label">{labelText}</span>
  </div>

  <!-- Big number + direction icon -->
  <div class="hero-value-row">
    <span class="hero-value">
      {isNetDebtor ? '−' : isNetCreditor ? '+' : ''}{displayNet}
    </span>
    <span class="hero-icon">
      {#if isNetCreditor}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
        </svg>
      {:else if isNetDebtor}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 18 14.5 10.5 9.5 15.5 1 6"/><polyline points="7 18 1 18 1 12"/>
        </svg>
      {:else}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      {/if}
    </span>
  </div>

  <!-- Sub line -->
  <p class="hero-sub">{subText}</p>

  <!-- Two-column breakdown: owed / owe -->
  <div class="breakdown-row">
    <div class="breakdown-side">
      <span class="breakdown-value owed">{formatCurrency(totalOwedToMe)}</span>
      <span class="breakdown-label">Owed to you</span>
    </div>
    <div class="breakdown-bar"></div>
    <div class="breakdown-side">
      <span class="breakdown-value owe">{formatCurrency(totalIOwe)}</span>
      <span class="breakdown-label">You owe</span>
    </div>
  </div>
</div>

<style>
  .balance-hero {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-xl) var(--space-lg) var(--space-lg);
    border-radius: var(--radius-xl);
    overflow: hidden;
    margin-bottom: var(--space-lg);
    text-align: center;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    box-shadow: var(--shadow-sm);
    transition: box-shadow 200ms ease, border-color 200ms ease;
  }

  .balance-hero:hover {
    box-shadow: var(--shadow-md);
  }

  /* Subtle top highlight for depth */
  .balance-hero::after {
    content: '';
    position: absolute;
    top: 0;
    left: 10%;
    right: 10%;
    height: 1px;
    border-radius: 1px;
    opacity: 0.4;
  }

  /* Net creditor: soft green gradient, green border, green top line */
  .balance-hero.creditor {
    background: linear-gradient(170deg, var(--color-surface) 0%, color-mix(in srgb, var(--color-income-light) 40%, var(--color-surface)) 100%);
    border-color: rgba(16, 185, 129, 0.25);
    box-shadow: 0 4px 16px rgba(16, 185, 129, 0.06);
  }

  .balance-hero.creditor::after {
    background: linear-gradient(90deg, transparent, var(--color-income), transparent);
  }

  /* Net debtor: soft rose gradient, rose border, rose top line */
  .balance-hero.debtor {
    background: linear-gradient(170deg, var(--color-surface) 0%, color-mix(in srgb, var(--color-expense-light) 40%, var(--color-surface)) 100%);
    border-color: rgba(239, 68, 68, 0.2);
    box-shadow: 0 4px 16px rgba(239, 68, 68, 0.06);
  }

  .balance-hero.debtor::after {
    background: linear-gradient(90deg, transparent, var(--color-expense), transparent);
  }

  /* Settled: clean neutral, no glow */
  .balance-hero.settled {
    background: var(--color-surface);
    border-color: var(--color-border);
    box-shadow: var(--shadow-sm);
  }

  .balance-hero.settled::after {
    display: none;
  }

  /* Radial glow spot behind number — softer, larger */
  .hero-glow {
    position: absolute;
    top: -60px;
    left: 50%;
    transform: translateX(-50%);
    width: 300px;
    height: 200px;
    border-radius: 50%;
    pointer-events: none;
    opacity: 0.15;
    filter: blur(12px);
  }
  .creditor .hero-glow { background: radial-gradient(ellipse, var(--color-income) 0%, transparent 70%); }
  .debtor  .hero-glow { background: radial-gradient(ellipse, var(--color-expense) 0%, transparent 70%); }
  .settled .hero-glow { display: none; }

  /* Label */
  .hero-label-row { z-index: 1; }
  .hero-label {
    font-size: var(--font-size-sm);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--color-text-secondary);
  }

  /* Big number */
  .hero-value-row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin: var(--space-sm) 0 var(--space-xs);
    z-index: 1;
  }

  .hero-value {
    font-size: var(--font-size-3xl);
    font-weight: 800;
    letter-spacing: -0.04em;
    font-variant-numeric: tabular-nums;
    color: var(--color-text);
  }

  .creditor .hero-value { color: var(--color-income); }
  .debtor  .hero-value { color: var(--color-expense); }
  .settled .hero-value { color: var(--color-text-secondary); }

  /* Direction icon */
  .hero-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
  }

  .creditor .hero-icon { color: var(--color-income); background: rgba(16, 185, 129, 0.12); }
  .debtor  .hero-icon { color: var(--color-expense); background: rgba(239, 68, 68, 0.12); }
  .settled .hero-icon { color: var(--color-text-secondary); background: var(--color-bg); }

  /* Sub line */
  .hero-sub {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    margin: 0 0 var(--space-md);
    z-index: 1;
  }

  /* Breakdown row */
  .breakdown-row {
    display: flex;
    align-items: center;
    width: 100%;
    max-width: 360px;
    background: var(--color-bg);
    border-radius: var(--radius-md);
    padding: var(--space-md) var(--space-lg);
    z-index: 1;
  }

  .breakdown-side {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .breakdown-bar {
    width: 1px;
    height: 32px;
    background: var(--color-border);
  }

  .breakdown-value {
    font-size: var(--font-size-lg);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--color-text);
  }

  .breakdown-row .breakdown-value.owed { color: var(--color-income); }
  .breakdown-row .breakdown-value.owe { color: var(--color-expense); }

  .breakdown-label {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    font-weight: 500;
  }

  @media (max-width: 480px) {
    .hero-value { font-size: var(--font-size-2xl); }
    .breakdown-row { padding: var(--space-sm) var(--space-md); }
  }
</style>
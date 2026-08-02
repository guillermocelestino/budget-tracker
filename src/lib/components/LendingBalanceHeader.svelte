<script lang="ts">
  import { formatCurrency, countUp } from '$lib/utils/format';
  import { onMount } from 'svelte';

  let {
    totalOwedToMe = 0,
    totalIOwe = 0,
    direction = 'lent'
  }: {
    totalOwedToMe?: number;
    totalIOwe?: number;
    direction?: 'lent' | 'borrowed';
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

  const directionAccent = $derived(direction === 'lent' ? 'teal' : 'coral');
  const directionLabel = $derived(direction === 'lent' ? 'Owed to you' : 'You owe');
  const directionSubLabel = $derived(direction === 'lent' ? 'You owe' : 'Owed to you');
</script>

<div class="balance-hero" class:creditor={isNetCreditor} class:debtor={isNetDebtor} class:settled={isSettled} class:lent={direction === 'lent'} class:borrowed={direction === 'borrowed'}>
  <div class="hero-ribbon" class:lent={direction === 'lent'} class:borrowed={direction === 'borrowed'}></div>

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

  <!-- Two-column breakdown: owed / owe (desktop) -->
  <div class="breakdown-row">
    <div class="breakdown-side teal-bar">
      <span class="breakdown-value owed">{formatCurrency(totalOwedToMe)}</span>
      <span class="breakdown-label">{directionLabel}</span>
    </div>
    <div class="breakdown-divider"></div>
    <div class="breakdown-side coral-bar">
      <span class="breakdown-value owe">{formatCurrency(totalIOwe)}</span>
      <span class="breakdown-label">{directionSubLabel}</span>
    </div>
  </div>

  <!-- Compact inline breakdown (mobile) — one quiet line under the amount -->
  <div class="hero-breakdown-line">
    <span class="hbl-item">
      <span class="hbl-label">{directionLabel}</span>
      <span class="hbl-value owed">{formatCurrency(totalOwedToMe)}</span>
    </span>
    <span class="hbl-divider" aria-hidden="true">·</span>
    <span class="hbl-item">
      <span class="hbl-label">{directionSubLabel}</span>
      <span class="hbl-value owe">{formatCurrency(totalIOwe)}</span>
    </span>
  </div>
</div>

<style>
  .balance-hero {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-xl) var(--space-lg) var(--space-lg);
    padding-top: calc(var(--space-xl) + 3px);
    border-radius: var(--radius-xl);
    overflow: hidden;
    margin-bottom: var(--space-lg);
    text-align: center;
    border: 1px solid var(--color-border);
    background: var(--color-cream);
    box-shadow: var(--shadow-card);
    transition: box-shadow 200ms var(--bounce);
  }

  .balance-hero:hover {
    box-shadow: var(--shadow-lg);
    transform: translateY(-2px);
  }

  .hero-ribbon {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--color-teal), var(--color-gold));
  }

  /* Net creditor: teal-tinged hero strip */
  .balance-hero.creditor {
    background: linear-gradient(170deg, var(--color-cream) 0%, var(--color-teal-bg) 100%);
    border-color: rgba(43, 168, 162, 0.20);
  }

  /* Net debtor: coral-tinged */
  .balance-hero.debtor {
    background: linear-gradient(170deg, var(--color-cream) 0%, rgba(239, 108, 74, 0.06) 100%);
    border-color: rgba(239, 108, 74, 0.15);
  }

  /* Settled: clean */
  .balance-hero.settled {
    background: var(--color-cream);
  }

  /* Label */
  .hero-label-row { z-index: 1; }
  .hero-label {
    font-size: var(--font-size-sm);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--color-text-muted);
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
    color: var(--color-ink);
  }

  .creditor .hero-value { color: var(--color-teal); }
  .debtor  .hero-value { color: var(--color-coral); }
  .settled .hero-value { color: var(--color-text-muted); }

  /* Direction icon */
  .hero-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
  }

  .creditor .hero-icon { color: var(--color-teal); background: var(--color-teal-bg); }
  .debtor  .hero-icon { color: var(--color-coral); background: rgba(239, 108, 74, 0.10); }
  .settled .hero-icon { color: var(--color-text-muted); background: var(--color-hairline); }

  /* Sub line */
  .hero-sub {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    margin: 0 0 var(--space-md);
    z-index: 1;
  }

  /* Breakdown row */
  .breakdown-row {
    display: flex;
    align-items: center;
    width: 100%;
    max-width: 360px;
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    padding: var(--space-md) var(--space-lg);
    z-index: 1;
    border: 1px solid var(--color-border);
  }

  .breakdown-side {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    position: relative;
    padding: var(--space-xs) 0;
  }

  .breakdown-side.teal-bar {
    border-left: 3px solid var(--color-teal);
    border-radius: 2px 0 0 2px;
    padding-left: var(--space-sm);
  }

  .breakdown-side.coral-bar {
    border-left: 3px solid var(--color-coral);
    padding-left: var(--space-sm);
  }

  .breakdown-divider {
    width: 1px;
    height: 32px;
    background: var(--color-hairline);
    margin: 0 var(--space-md);
  }

  .breakdown-value {
    font-size: var(--font-size-lg);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--color-ink);
  }

  .breakdown-row .breakdown-value.owed { color: var(--color-teal); }
  .breakdown-row .breakdown-value.owe { color: var(--color-coral); }

  .breakdown-label {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    font-weight: 500;
  }

  /* Compact inline breakdown (mobile) — desktop keeps the two-column card */
  .hero-breakdown-line {
    display: none;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-top: var(--space-xs);
    font-size: var(--font-size-sm);
    font-variant-numeric: tabular-nums;
    z-index: 1;
    color: var(--color-text-muted);
  }

  .hbl-item {
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
  }

  .hbl-value {
    font-weight: 700;
  }

  .hbl-value.owed { color: var(--color-teal); }
  .hbl-value.owe { color: var(--color-coral); }

  .hbl-divider {
    opacity: 0.6;
  }

  /* ─── Mobile compaction (≤768px) — ~30% shorter, amount stays dominant ─── */
  @media (max-width: 768px) {
    .balance-hero {
      padding: 18px var(--space-lg) 14px;
      padding-top: 21px;
      margin-bottom: var(--space-md);
    }

    .hero-value {
      font-size: var(--font-size-2xl);
    }

    .hero-icon {
      width: 32px;
      height: 32px;
    }

    .hero-value-row {
      margin: var(--space-xs) 0;
    }

    .hero-sub,
    .breakdown-row {
      display: none;
    }

    .hero-breakdown-line {
      display: flex;
    }
  }

  @media (max-width: 480px) {
    .hero-value { font-size: var(--font-size-2xl); }
    .breakdown-row { padding: var(--space-sm) var(--space-md); }
  }
</style>

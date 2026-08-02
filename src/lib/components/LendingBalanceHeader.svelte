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

  const directionLabel = $derived(direction === 'lent' ? 'Owed to you' : 'You owe');
  const directionSubLabel = $derived(direction === 'lent' ? 'You owe' : 'Owed to you');
</script>

<div class="balance-hero flip7-card" class:creditor={isNetCreditor} class:debtor={isNetDebtor} class:settled={isSettled}>
  <!-- Top ribbon: brand signature, not semantic status -->
  <div class="hero-ribbon"></div>

  <div class="hero-content">
    <!-- Row 1: Label + Big animated value + Direction icon -->
    <div class="hero-main-row">
      <div class="hero-label-group">
        <span class="hero-label">{labelText}</span>
      </div>
      <div class="hero-value-group">
        <span class="hero-value">
          {isNetDebtor ? '−' : isNetCreditor ? '+' : ''}{displayNet}
        </span>
        <span class="hero-icon">
          {#if isNetCreditor}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
              <polyline points="17 6 23 6 23 12"/>
            </svg>
          {:else if isNetDebtor}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 18 14.5 10.5 9.5 15.5 1 6"/>
              <polyline points="7 18 1 18 1 12"/>
            </svg>
          {:else}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          {/if}
        </span>
      </div>
    </div>

    <!-- Row 2: Lightweight inline breakdown — no card, no divider -->
    <div class="hero-breakdown">
      <span class="hbl-item">
        <span class="hbl-label">{directionLabel}</span>
        <span class="hbl-value owed">{formatCurrency(totalOwedToMe)}</span>
      </span>
      <span class="hbl-divider" aria-hidden="true">•</span>
      <span class="hbl-item">
        <span class="hbl-label">{directionSubLabel}</span>
        <span class="hbl-value owe">{formatCurrency(totalIOwe)}</span>
      </span>
    </div>
  </div>
</div>

<style>
  /* ─── Base: White Flip7 Card Surface ───
     Inherits: surface, border, radius-xl, shadow-card, hover lift, dark mode
     via .flip7-card from variables.css ─── */
  .balance-hero {
    position: relative;
    display: flex;
    flex-direction: column;
    padding: var(--space-lg) var(--space-xl) var(--space-md);
    border-radius: var(--radius-xl);
    overflow: hidden;
    margin-bottom: var(--space-lg);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    box-shadow: var(--shadow-card);
    transition: box-shadow 200ms var(--bounce), transform 200ms var(--bounce);
  }

  .balance-hero:hover {
    box-shadow: var(--shadow-lg);
    transform: translateY(-2px);
  }

  /* ─── Top Ribbon: Brand Signature (teal→gold) ─── */
  .hero-ribbon {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--color-teal), var(--color-gold));
  }

  /* ─── Content Layout ─── */
  .hero-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    width: 100%;
  }

  /* Row 1: Label | Value + Icon */
  .hero-main-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-md);
    flex-wrap: wrap;
  }

  .hero-label-group {
    flex: 1;
    min-width: 120px;
    text-align: left;
  }

  .hero-label {
    font-size: var(--font-size-sm);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--color-text-muted);
  }

  .hero-value-group {
    display: flex;
    align-items: baseline;
    gap: var(--space-sm);
    flex-shrink: 0;
  }

  /* Big animated number — primary focal point */
  .hero-value {
    font-size: var(--font-size-3xl);
    font-weight: 800;
    letter-spacing: -0.04em;
    font-variant-numeric: tabular-nums;
    font-family: var(--font-display);
    line-height: 1.1;
  }

  /* Semantic value colors (content only, not backgrounds) */
  .creditor .hero-value { color: var(--color-teal); }
  .debtor  .hero-value { color: var(--color-coral); }
  .settled .hero-value { color: var(--color-text-muted); }

  /* Direction icon — preserved at 40×40px */
  .hero-icon {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .creditor .hero-icon  { background: var(--color-teal-bg);  color: var(--color-teal); }
  .debtor  .hero-icon  { background: var(--color-coral-bg); color: var(--color-coral); }
  .settled .hero-icon  { background: var(--color-hairline); color: var(--color-text-muted); }

  /* ─── Row 2: Lightweight Inline Breakdown ───
     No card, no border, no padding block — just typography + spacing ─── */
  .hero-breakdown {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
    font-size: var(--font-size-sm);
    font-variant-numeric: tabular-nums;
    color: var(--color-text-muted);
  }

  .hbl-item {
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
  }

  .hbl-label {
    font-weight: 500;
  }

  .hbl-value {
    font-weight: 700;
  }

  .hbl-value.owed { color: var(--color-teal); }
  .hbl-value.owe  { color: var(--color-coral); }

  .hbl-divider {
    opacity: 0.4;
  }

  /* ─── Mobile (≤768px): Centered Stack, Compact ─── */
  @media (max-width: 768px) {
    .balance-hero {
      padding: var(--space-md) var(--space-lg) var(--space-sm);
      margin-bottom: var(--space-md);
    }

    .hero-main-row {
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: var(--space-xs);
    }

    .hero-label-group {
      text-align: center;
      width: 100%;
      min-width: 0;
    }

    .hero-value {
      font-size: var(--font-size-2xl);
    }

    .hero-icon {
      width: 36px;
      height: 36px;
    }

    .hero-breakdown {
      gap: var(--space-xs);
      font-size: var(--font-size-xs);
    }
  }

  @media (max-width: 480px) {
    .balance-hero {
      padding: var(--space-md) var(--space-md) var(--space-sm);
    }

    .hero-value {
      font-size: var(--font-size-xl);
    }

    .hero-icon {
      width: 32px;
      height: 32px;
    }

    .hero-breakdown {
      font-size: 10px;
    }
  }

  /* ─── Reduced Motion ─── */
  @media (prefers-reduced-motion: reduce) {
    .balance-hero {
      transition: none;
    }
    .balance-hero:hover {
      transform: none;
    }
  }
</style>
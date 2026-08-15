<script lang="ts">
  import { formatCurrency } from '$lib/client/utils/format';

  let {
    items = [],
    viewAllHref = '/recurring',
  }: {
    items: Array<{
      id: number;
      description: string;
      amount: number;
      next_run: string;
      frequency: string;
      type: string;
      category_name?: string;
      category_color?: string;
      label?: string;
    }>;
    viewAllHref?: string;
  } = $props();

  const hasItems = $derived(items.length > 0);
</script>

<div class="ur-shell flip7-card">
  <!-- Header -->
  <div class="ur-header">
    <div class="ur-header-left">
      <div class="ur-header-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      </div>
      <h2 class="ur-title">Upcoming Recurring</h2>
    </div>
    <a href={viewAllHref} class="ur-view-all">
      View All
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 12h14M12 5l7 7-7 7"/>
      </svg>
    </a>
  </div>

  <!-- List -->
  {#if hasItems}
    <div class="ur-list">
      {#each items as rec (rec.id)}
        <div class="ur-row">
          <div
            class="ur-icon"
            style="background: {rec.category_color || '#2BA8A2'}18; color: {rec.category_color || '#2BA8A2'}"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div class="ur-info">
            <span class="ur-name">{rec.description}</span>
            <span class="ur-meta">{rec.frequency} · {rec.category_name || 'General'}</span>
          </div>
          <div class="ur-right">
            <span class="ur-amount" class:income={rec.type === 'income'} class:expense={rec.type !== 'income'}>
              {rec.type === 'income' ? '+' : '−'}{formatCurrency(rec.amount)}
            </span>
            <span class="ur-date">{rec.label || rec.next_run}</span>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="ur-empty">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M8 12h8 M12 8v8"/>
      </svg>
      <span>No upcoming recurring bills</span>
    </div>
  {/if}
</div>

<style>
  /* ═══════════════════════════════════════════════
     UPCOMING RECURRING WIDGET — FLIP7
     ═══════════════════════════════════════════════ */

  .ur-shell {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    overflow: hidden;
    box-shadow: var(--shadow-card);
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .ur-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-lg) var(--space-lg) var(--space-md);
    border-bottom: 1px solid var(--color-hairline);
  }

  .ur-header-left {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .ur-header-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-gold-bg);
    color: var(--color-gold-dark);
    border-radius: var(--radius-md);
  }

  .ur-title {
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--color-ink);
    margin: 0;
  }

  .ur-view-all {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-gold-dark);
    text-decoration: none;
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    transition: all var(--transition-fast);
    position: relative;
    min-height: 44px;
  }

  .ur-view-all:hover {
    background: var(--color-gold-bg);
  }

  .ur-view-all svg {
    transition: transform var(--transition-fast);
  }

  .ur-view-all:hover svg {
    transform: translateX(3px);
  }

  .ur-list {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .ur-row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-md) var(--space-lg);
    border-bottom: 1px solid var(--color-hairline);
    transition: background 120ms ease;
  }

  .ur-row:last-child {
    border-bottom: none;
  }

  .ur-row:hover {
    background: var(--color-teal-bg);
  }

  .ur-icon {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .ur-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .ur-name {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ur-meta {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ur-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    flex-shrink: 0;
  }

  .ur-amount {
    font-size: var(--font-size-sm);
    font-weight: 700;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }

  .ur-amount.income { color: var(--color-teal); }
  .ur-amount.expense { color: var(--color-coral); }

  .ur-date {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 600;
    color: var(--color-text-muted);
    background: var(--color-surface-inset);
    padding: 2px 8px;
    border-radius: var(--radius-pill);
    white-space: nowrap;
  }

  .ur-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-2xl) var(--space-lg);
    gap: var(--space-sm);
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
    flex: 1;
  }

  @media (max-width: 480px) {
    .ur-row {
      padding: var(--space-xs) var(--space-md);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ur-row { transition: none; }
  }
</style>

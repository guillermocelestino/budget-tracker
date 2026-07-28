<script lang="ts">
  import { formatCurrency } from '$lib/utils/format';

  let {
    transactions = [],
    viewAllHref = '/transactions',
  }: {
    transactions: Array<{
      id: number;
      description: string;
      amount: number;
      date: string;
      type: string;
      category_name?: string;
      category_color?: string;
    }>;
    viewAllHref?: string;
  } = $props();

  const hasTransactions = $derived(transactions.length > 0);

  const enriched = $derived(
    transactions.map((t) => ({
      ...t,
      initials: t.description ? t.description.charAt(0).toUpperCase() : '?',
      relativeDate: formatRelative(t.date),
      isIncome: t.type === 'income',
      categoryColor: t.category_color || '#6b7280',
    }))
  );

  function formatRelative(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    // Normalize to date-only comparison
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.floor(
      (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(date);
  }
</script>

<div class="ra-shell">
  <!-- ═══ Header ═══ -->
  <div class="ra-header">
    <div class="ra-header-left">
      <div class="ra-header-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2v20M6 4h7a4 4 0 0 1 0 8H6"/>
          <line x1="4" x2="18" y1="12" y2="12"/>
          <line x1="4" x2="18" y1="16" y2="16"/>
        </svg>
      </div>
      <h2 class="ra-title">Recent Activity</h2>
    </div>
    {#if hasTransactions}
      <a href={viewAllHref} class="ra-view-all">
        View All
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </a>
    {/if}
  </div>

  <!-- ═══ Feed rows ═══ -->
  {#if hasTransactions}
    <div class="ra-feed">
      {#each enriched as tx (tx.id)}
        <div class="ra-row">
          <!-- Avatar circle -->
          <div class="ra-avatar" style="background: {tx.isIncome ? 'var(--color-income-light)' : 'var(--color-bg)'}">
            <span class="ra-initials" class:income={tx.isIncome}>{tx.initials}</span>
          </div>

          <!-- Middle: description + category -->
          <div class="ra-info">
            <span class="ra-description">{tx.description || 'Transaction'}</span>
            {#if tx.category_name}
              <span class="ra-category">{tx.category_name}</span>
            {/if}
          </div>

          <!-- Right: amount + date -->
          <div class="ra-right">
            <span class="ra-amount" class:income={tx.isIncome} class:expense={!tx.isIncome}>
              {tx.isIncome ? '+' : '−'}{formatCurrency(tx.amount)}
            </span>
            <span class="ra-date">{tx.relativeDate}</span>
          </div>
        </div>
      {/each}
    </div>

  {:else}
    <!-- ═══ Empty state ═══ -->
    <div class="ra-empty">
      <div class="ra-empty-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
          <line x1="12" x2="12" y1="22.08" y2="12"/>
        </svg>
      </div>
      <div class="ra-empty-text">
        <span class="ra-empty-title">Ready for your first transaction</span>
        <span class="ra-empty-sub">Your recent activity will appear here as you track income and expenses.</span>
      </div>
      <a href="/transactions/new" class="ra-empty-cta">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" x2="12" y1="5" y2="19"/>
          <line x1="5" x2="19" y1="12" y2="12"/>
        </svg>
        Add Transaction
      </a>
    </div>
  {/if}
</div>

<style>
  /* ═══════════════════════════════════════════════
     RECENT ACTIVITY WIDGET
     ═══════════════════════════════════════════════ */

  .ra-shell {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    overflow: hidden;
    box-shadow: var(--shadow-sm);
  }

  /* ─── Header ─── */

  .ra-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-lg) var(--space-lg) var(--space-md);
    border-bottom: 1px solid var(--color-border);
  }

  .ra-header-left {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .ra-header-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--color-primary-light) 0%, rgba(99, 102, 241, 0.1) 100%);
    color: var(--color-primary);
    border-radius: var(--radius-md);
  }

  .ra-title {
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--color-text);
    margin: 0;
  }

  .ra-view-all {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--color-primary);
    text-decoration: none;
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    transition: all var(--transition-fast);
  }

  .ra-view-all:hover {
    background: var(--color-primary-light);
  }

  .ra-view-all svg {
    transition: transform var(--transition-fast);
  }

  .ra-view-all:hover svg {
    transform: translateX(3px);
  }

  /* ─── Feed rows ─── */

  .ra-feed {
    display: flex;
    flex-direction: column;
  }

  .ra-row {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md) var(--space-lg);
    border-bottom: 1px solid var(--color-border);
    transition: background 120ms ease;
    min-height: 68px;
  }

  .ra-row:last-child {
    border-bottom: none;
  }

  .ra-row:hover {
    background: rgba(99, 102, 241, 0.03);
  }

  /* ─── Avatar ─── */

  .ra-avatar {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: var(--color-bg);
  }

  .ra-initials {
    font-size: var(--font-size-sm);
    font-weight: 700;
    color: var(--color-text-secondary);
  }

  .ra-initials.income {
    color: var(--color-income);
  }

  /* ─── Info column ─── */

  .ra-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .ra-description {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ra-category {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ─── Right column: amount + date ─── */

  .ra-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 1px;
    flex-shrink: 0;
  }

  .ra-amount {
    font-size: var(--font-size-sm);
    font-weight: 700;
    color: var(--color-text);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
  }

  .ra-amount.income {
    color: var(--color-income);
  }

  .ra-amount.expense {
    color: var(--color-text);
  }

  .ra-date {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    font-weight: 500;
  }

  /* ─── Empty state ─── */

  .ra-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-2xl) var(--space-lg);
    text-align: center;
    gap: var(--space-md);
  }

  .ra-empty-icon {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--color-primary-light) 0%, rgba(99, 102, 241, 0.1) 100%);
    color: var(--color-primary);
    border-radius: var(--radius-lg);
    margin-bottom: var(--space-xs);
  }

  .ra-empty-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .ra-empty-title {
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--color-text);
  }

  .ra-empty-sub {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    max-width: 280px;
    line-height: 1.4;
  }

  .ra-empty-cta {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: var(--space-sm) var(--space-lg);
    background: var(--color-primary);
    color: white;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: 600;
    text-decoration: none;
    min-height: 40px;
    transition: all var(--transition-fast);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);
    margin-top: var(--space-xs);
  }

  .ra-empty-cta:hover {
    background: var(--color-primary-hover);
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(99, 102, 241, 0.35);
  }

  /* ═══════════════════════════════════════════════
     RESPONSIVE
     ═══════════════════════════════════════════════ */

  @media (max-width: 480px) {
    .ra-row {
      padding: var(--space-sm) var(--space-md);
      min-height: 60px;
    }

    .ra-avatar {
      width: 34px;
      height: 34px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ra-row { transition: none; }
    .ra-empty-cta { transition: none; }
  }
</style>

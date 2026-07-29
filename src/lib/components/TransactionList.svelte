<script lang="ts">
  import { formatCurrency } from '$lib/utils/format';
  import type { Transaction } from '$lib/types';

  let {
    transactions = [],
    onDelete,
    onEdit,
    showActions = true,
    loading = false,
  }: {
    transactions: Transaction[];
    onDelete?: (id: number) => void;
    onEdit?: (id: number) => void;
    showActions?: boolean;
    loading?: boolean;
  } = $props();

  let editingId = $state<number | null>(null);
  let swipedRowId = $state<number | null>(null);
  let swipeOffset = $state(0);
  let swipeStartX = $state(0);
  let isSwiping = $state(false);

  function handleSwipeStart(e: TouchEvent, txnId: number) {
    if (swipedRowId !== txnId && swipedRowId !== null) {
      swipedRowId = null;
      swipeOffset = 0;
    }
    swipeStartX = e.touches[0].clientX;
    isSwiping = true;
  }

  function handleSwipeMove(e: TouchEvent, txnId: number) {
    if (!isSwiping) return;
    const currentX = e.touches[0].clientX;
    const diff = swipeStartX - currentX;
    if (diff > 0) {
      swipeOffset = Math.min(diff, 120);
      swipedRowId = txnId;
    } else {
      swipeOffset = 0;
    }
  }

  function handleSwipeEnd(e: TouchEvent) {
    isSwiping = false;
    if (swipeOffset > 80) {
      // Delete threshold reached
      if (swipedRowId !== null && onDelete) {
        onDelete(swipedRowId);
      }
    }
    swipedRowId = null;
    swipeOffset = 0;
  }

  // Touch device check
  const isTouchDevice = typeof window !== 'undefined' && ('ontouch' in window || (navigator.maxTouchPoints > 0));


  type DateGroup = { date: string; label: string; items: Transaction[] };

  const groups = $derived.by(() => {
    const map = new Map<string, Transaction[]>();
    for (const txn of transactions) {
      const key = txn.date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(txn);
    }
    const sorted = [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));

    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

    return sorted.map(([date, items]) => {
      let label: string;
      if (date === today) label = 'Today';
      else if (date === yesterday) label = 'Yesterday';
      else {
        label = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        });
      }
      return { date, label, items };
    });
  });

  // ─── Refund detection (description-based, no schema change) ───
  function isRefund(txn: Transaction): boolean {
    return txn.description.startsWith('[REFUND]');
  }

  function cleanDescription(desc: string): string {
    return desc.replace(/^\[REFUND\]\s*/, '');
  }

  function toggleEdit(id: number) {
    if (!showActions) return;
    editingId = editingId === id ? null : id;
  }

  /*
   * ── INLINE EDIT STRATEGY (Monarch-style) ──
   *
   * Tapping a row toggles an inline edit panel. In a fuller implementation,
   * an `$effect` would attach a document click listener when `editingId !== null`
   * to close the panel if the user clicks outside any `[data-txn-id]` element:
   *
   *   $effect(() => {
   *     if (editingId !== null) {
   *       const onClickOutside = (e: MouseEvent) => {
   *         const target = e.target as HTMLElement;
   *         if (!target.closest('[data-txn-id]')) editingId = null;
   *       };
   *       document.addEventListener('click', onClickOutside);
   *       return () => document.removeEventListener('click', onClickOutside);
   *     }
   *   });
   *
   * The inline panel itself would evolve into a mini TransactionForm
   * (pre-populated with the row's data, using the same server action as
   * /transactions/[id]/edit). Today the panel links to the full edit page.
   */
</script>

<!-- ── SNIPPETS ── -->
{#snippet dateHeader(group: DateGroup)}
  <div class="date-header" role="rowheader">
    <span class="date-label">{group.label}</span>
    <span class="date-count">{group.items.length}</span>
  </div>
{/snippet}

{#snippet transactionRow(txn: Transaction)}
  {@const isIncome = txn.type === 'income'}
  {@const isExpanded = editingId === txn.id}

  <!-- Main row -->
  <div
    class="txn-row"
    class:txn-income={isIncome}
    class:txn-expense={!isIncome}
    class:editing={isExpanded}
    class:swiped={swipedRowId === txn.id}
    data-txn-id={txn.id}
    role="button"
    tabindex="0"
    style={swipedRowId === txn.id ? `transform: translateX(-${swipeOffset}px);` : ''}
    ontouchstart={isTouchDevice ? (e) => handleSwipeStart(e, txn.id) : undefined}
    ontouchmove={(e) => handleSwipeMove(e, txn.id)}
    ontouchend={handleSwipeEnd}
    aria-label="{isIncome ? 'Income' : 'Expense'}: {txn.description}, {formatCurrency(txn.amount)}"
    aria-expanded={isExpanded}
    onclick={() => toggleEdit(txn.id)}
    onkeydown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleEdit(txn.id); }
      if (e.key === 'Escape') editingId = null;
    }}
  >
    <!-- Direction dot -->
    <div class="txn-dot" class:dot-income={isIncome} class:dot-expense={!isIncome}>
      {#if isIncome}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
      {:else}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 18 14.5 10.5 9.5 15.5 1 6"/><polyline points="7 18 1 18 1 12"/></svg>
      {/if}
    </div>

    <!-- Left: description + category pill -->
    <div class="txn-info">
      <span class="txn-desc">
            {#if isRefund(txn)}
              <span class="refund-chip">↩ Refund</span>
            {/if}
            {cleanDescription(txn.description)}
          </span>
      <span
        class="cat-pill"
        style="background:{(txn.category_color || '#6366f1')}18; color:{txn.category_color || '#6366f1'}"
      >
        {txn.category_name || 'Uncategorized'}
      </span>
    </div>

    <!-- Right: amount -->
    <div class="txn-amount-col">
      <span class="txn-amount" class:amount-income={isIncome} class:amount-expense={!isIncome}>
        {isIncome ? '+' : '−'}{formatCurrency(txn.amount)}
      </span>
    </div>

    <!-- Hover-only edit / delete icons -->
    {#if showActions && !isExpanded}
      <div class="hover-actions">
        <button
          class="hover-btn"
          title="Edit"
          onclick={(e) => { e.stopPropagation(); onEdit?.(txn.id); }}
          type="button"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
        </button>
        <button
          class="hover-btn hover-delete"
          title="Delete"
          onclick={(e) => { e.stopPropagation(); onDelete?.(txn.id); }}
          type="button"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    {/if}
  </div>

  <!-- Inline edit panel (shown below the row) -->
  {#if isExpanded}
    <div class="edit-panel" data-txn-id={txn.id}>
      <div class="edit-meta">
        <span class="edit-date">{txn.date}</span>
        <span class="edit-type-badge" class:badge-income={isIncome} class:badge-expense={!isIncome}>
          {isIncome ? 'Income' : 'Expense'}
        </span>
        <span class="edit-cat-name">{txn.category_name}</span>
      </div>
      <div class="edit-buttons">
        <a
          href="/transactions/{txn.id}/edit"
          class="edit-btn edit-btn-primary"
          onclick={(e) => e.stopPropagation()}
        > Edit </a>
        <button
          class="edit-btn edit-btn-danger"
          onclick={(e) => { e.stopPropagation(); onDelete?.(txn.id); editingId = null; }}
        > Delete </button>
      </div>
    </div>
  {/if}
{/snippet}

<!-- ── RENDER ── -->
<div class="txn-list">
  {#if loading}
    <div class="shimmer-list" aria-busy="true" aria-label="Loading transactions">
      {#each Array(5) as _}
        <div class="shimmer-row">
          <div class="shimmer-dot skeleton" style="width:32px;height:32px"></div>
          <div class="shimmer-info">
            <div class="skeleton" style="width:60%;height:14px;margin-bottom:6px"></div>
            <div class="skeleton" style="width:35%;height:10px"></div>
          </div>
          <div class="shimmer-amount">
            <div class="skeleton" style="width:70px;height:14px"></div>
          </div>
        </div>
      {/each}
    </div>
  {:else if groups.length === 0}
    <div class="empty-state">
      <div class="empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" x2="12" y1="12" y2="18"/><line x1="9" x2="15" y1="15" y2="15"/>
        </svg>
      </div>
      <p class="empty-title">No transactions yet</p>
      <p class="empty-sub">Add your first transaction to start tracking</p>
      <a href="/transactions/new" class="empty-action">Add Transaction</a>
    </div>
  {:else}
    <div class="grouped-list">
      {#each groups as group (group.date)}
        {@render dateHeader(group)}
        {#each group.items as txn (txn.id)}
          {@render transactionRow(txn)}
        {/each}
      {/each}
    </div>
  {/if}
</div>

<style>
  /* ── Container ── */
  .txn-list { width: 100%; }

  .grouped-list {
    background: var(--color-surface);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-xl);
    overflow: hidden;
  }

  /* ── Date Header (Flip7: sentence-case, teal tint) ── */
  .date-header {
    display: flex;
    align-items: baseline;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    background: var(--color-teal-bg);
    border-bottom: 1px dashed var(--color-hairline);
    position: sticky;
    top: 0;
    z-index: 2;
  }

  .date-label {
    font-family: var(--font-display);
    font-size: var(--font-size-xs);
    font-weight: 700;
    color: var(--color-teal);
    text-transform: none;
    letter-spacing: 0.02em;
  }

  .date-count {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-teal);
    opacity: 0.6;
  }

  /* ── Row with left accent bar ── */
  .txn-row {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: 12px var(--space-md);
    border-bottom: 1px dashed var(--color-hairline);
    background: var(--color-surface);
    cursor: pointer;
    font-family: var(--font-body);
    min-height: 56px;
    transition: background 200ms var(--ease);
    overflow: hidden;
  }

  /* Left accent bar pseudo-element (slides in on hover) */
  .txn-row::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 0;
    border-radius: 0 2px 2px 0;
    transition: width 200ms var(--ease);
    pointer-events: none;
  }

  .txn-income::before { background: var(--color-teal); }
  .txn-expense::before { background: var(--color-coral); }

  /* Hover: teal wash + left bar slide-in */
  .txn-row:hover {
    background: var(--color-teal-bg);
  }

  .txn-row:hover::before {
    width: 4px;
  }

  /* Editing state */
  .txn-row.editing {
    background: var(--color-teal-bg);
    border-bottom: none;
  }

  .txn-row.editing::before {
    width: 4px;
  }

  /* Swipe-to-delete affordance */
  .txn-row.swiped {
    border-color: var(--color-coral-light);
    background: rgba(239, 108, 74, 0.06);
  }

  .txn-row:focus-visible {
    outline: 2px solid var(--color-teal);
    outline-offset: -2px;
  }

  .txn-row:last-child { border-bottom: none; }

  /* Shimmer loading rows */
  .shimmer-list {
    background: var(--color-surface);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-xl);
    overflow: hidden;
  }

  .shimmer-row {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: 12px var(--space-md);
    border-bottom: 1px dashed var(--color-hairline);
    min-height: 56px;
  }

  .shimmer-row:last-child {
    border-bottom: none;
  }

  .shimmer-info {
    flex: 1;
    min-width: 0;
  }

  .shimmer-amount {
    flex-shrink: 0;
    min-width: 70px;
  }

  .skeleton-icon {
    flex-shrink: 0;
    border-radius: var(--radius-md);
  }

  /* ── Direction dot (icon) ── */
  .txn-dot {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .dot-income { background: var(--color-teal-bg); color: var(--color-teal); }
  .dot-expense { background: rgba(239, 108, 74, 0.10); color: var(--color-coral); }

  /* ── Info block: description + category pill ── */
  .txn-info {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .txn-desc {
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--font-body);
  }

  .cat-pill {
    padding: 2px 10px;
    border-radius: var(--radius-pill);
    font-size: var(--font-size-xs);
    font-weight: 600;
    white-space: nowrap;
    letter-spacing: 0.02em;
    flex-shrink: 0;
    font-family: var(--font-display);
  }

  /* ── Amount column: mono, right-aligned, colored by sign ── */
  .txn-amount-col {
    flex-shrink: 0;
    text-align: right;
    min-width: 100px;
  }

  .txn-amount {
    font-size: var(--font-size-sm);
    font-weight: 700;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
  }

  .amount-income { color: var(--color-teal); }
  .amount-expense { color: var(--color-coral); }

  /* ── Hover-reveal action buttons ── */
  .hover-actions {
    display: flex;
    gap: 2px;
    opacity: 0;
    transform: translateX(4px);
    transition: opacity 150ms var(--ease), transform 150ms var(--ease);
    pointer-events: none;
  }

  .txn-row:hover .hover-actions {
    opacity: 1;
    transform: translateX(0);
    pointer-events: auto;
  }

  .hover-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: background 120ms var(--ease), color 120ms var(--ease);
  }

  .hover-btn:hover { background: var(--color-teal-bg); color: var(--color-teal); }
  .hover-delete:hover { background: rgba(239, 108, 74, 0.10); color: var(--color-coral); }

  /* ── Inline edit panel (Flip7) ── */
  .edit-panel {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px var(--space-md) 12px;
    background: var(--color-teal-bg);
    border-bottom: 1px dashed var(--color-hairline);
    border-left: 4px solid var(--color-teal);
    gap: var(--space-md);
  }

  .edit-meta {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  .edit-date {
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  .edit-type-badge {
    padding: 2px 10px;
    border-radius: var(--radius-pill);
    font-family: var(--font-display);
    font-size: var(--font-size-xs);
    font-weight: 600;
  }

  .badge-income { background: var(--color-teal-bg); color: var(--color-teal); }
  .badge-expense { background: rgba(239, 108, 74, 0.10); color: var(--color-coral); }

  .edit-cat-name {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    font-family: var(--font-body);
  }

  .edit-buttons {
    display: flex;
    gap: var(--space-sm);
    flex-shrink: 0;
  }

  .edit-btn {
    padding: 6px 16px;
    border-radius: var(--radius-pill);
    font-family: var(--font-display);
    font-size: var(--font-size-xs);
    font-weight: 700;
    min-height: 34px;
    cursor: pointer;
    border: none;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 150ms var(--ease);
  }

  .edit-btn-primary {
    background: var(--color-teal);
    color: white;
    box-shadow: var(--glow-card);
  }
  .edit-btn-primary:hover { background: var(--color-teal-dark); text-decoration: none; }

  .edit-btn-danger {
    background: transparent;
    color: var(--color-coral);
    border: 1px solid var(--color-hairline);
  }
  .edit-btn-danger:hover {
    background: rgba(239, 108, 74, 0.10);
    border-color: var(--color-coral);
  }

  /* ── Empty state ── */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-2xl) var(--space-md);
    text-align: center;
    background: var(--color-surface);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-xl);
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
    color: var(--color-text);
    margin: 0 0 4px;
  }

  .empty-sub {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
    margin: 0 0 var(--space-md);
  }

  .empty-action {
    padding: var(--space-sm) var(--space-xl);
    background: var(--color-teal);
    color: white;
    border-radius: var(--radius-pill);
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--font-size-sm);
    text-decoration: none;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    transition: all 200ms var(--ease);
    box-shadow: var(--glow-card);
  }

  .empty-action:hover { background: var(--color-teal-dark); text-decoration: none; }

  @media (prefers-reduced-motion: reduce) {
    .txn-row {
      transition: none;
    }
    .txn-row::before {
      transition: none;
    }
  }

  /* ── Mobile (< 640px) ── */
  @media (max-width: 640px) {
    .cat-pill { display: none; }
    .hover-actions { display: none; }
  }

  /* ── Card layout (≤ 480px): cream surface + left bar + dashed dividers ── */
  .refund-chip {
    margin-right: 6px;
    padding: 1px 8px;
    background: rgba(93, 173, 226, 0.12);
    color: var(--color-sky);
    border-radius: var(--radius-pill);
    font-family: var(--font-display);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.03em;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    white-space: nowrap;
    vertical-align: middle;
    border: 1px solid rgba(93, 173, 226, 0.2);
  }

  @media (max-width: 480px) {
    .txn-row {
      flex-wrap: wrap;
      padding: 10px var(--space-md);
      min-height: 60px;
      gap: var(--space-xs);
      background: var(--color-cream);
      border: 1px dashed var(--color-hairline);
      border-left: 4px solid transparent;
      border-radius: var(--radius-lg);
      margin: 0 var(--space-sm) 6px;
    }

    .txn-row::before {
      display: none;
    }

    .txn-income {
      border-left-color: var(--color-teal);
    }

    .txn-expense {
      border-left-color: var(--color-coral);
    }

    .txn-row:last-child {
      margin-bottom: 0;
    }

    .txn-row.editing {
      border-bottom: 1px dashed var(--color-hairline);
    }

    .grouped-list {
      background: transparent;
      border: none;
      overflow: visible;
    }

    .date-header {
      border-radius: var(--radius-md);
      margin: 0 var(--space-sm);
      padding: var(--space-xs) var(--space-md);
    }

    .txn-dot {
      width: 28px;
      height: 28px;
      margin-right: var(--space-xs);
    }

    .txn-info {
      flex: 1 1 calc(100% - 44px);
      order: 1;
    }

    .txn-amount-col {
      order: 2;
      min-width: auto;
      margin-left: auto;
    }

    .edit-panel {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-sm);
      margin: 0 var(--space-sm);
      border-radius: 0 0 var(--radius-md) var(--radius-md);
    }
    .edit-buttons { width: 100%; }
    .edit-btn { flex: 1; justify-content: center; }

    .shimmer-list {
      background: transparent;
      border: none;
    }
    .shimmer-row {
      background: var(--color-cream);
      border: 1px dashed var(--color-hairline);
      border-radius: var(--radius-lg);
      margin: 0 var(--space-sm) 6px;
    }
  }
</style>
<script lang="ts">
  import { formatCurrency } from '$lib/utils/format';
  import type { Transaction } from '$lib/types';

  let {
    transactions = [],
    onDelete,
    onEdit,
    showActions = true,
  }: {
    transactions: Transaction[];
    onDelete?: (id: number) => void;
    onEdit?: (id: number) => void;
    showActions?: boolean;
  } = $props();

  let editingId = $state<number | null>(null);

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
    class:editing={isExpanded}
    data-txn-id={txn.id}
    role="button"
    tabindex="0"
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
      <span class="txn-desc">{txn.description}</span>
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
  {#if groups.length === 0}
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
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    overflow: hidden;
  }

  /* ── Date Header (Monarch-style: sticky, uppercase, muted) ── */
  .date-header {
    display: flex;
    align-items: baseline;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    background: var(--color-bg);
    border-bottom: 1px solid var(--color-border);
    position: sticky;
    top: 0;
    z-index: 2;
  }

  .date-label {
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .date-count {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    opacity: 0.5;
  }

  /* ── Row ── */
  .txn-row {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: 12px var(--space-md);
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface);
    cursor: pointer;
    font-family: inherit;
    min-height: 56px;
    transition: background 150ms ease;
  }

  .txn-row:last-child { border-bottom: none; }

  /* Hover: subtle slate shift */
  .txn-row:hover { background: rgba(99, 102, 241, 0.04); }

  .txn-row:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
  }

  /* Editing state: left border highlight + tinted background */
  .txn-row.editing {
    background: rgba(99, 102, 241, 0.06);
    border-left: 3px solid var(--color-primary);
    border-bottom: none;
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

  .dot-income { background: var(--color-income-light); color: var(--color-income); }
  .dot-expense { background: var(--color-expense-light); color: var(--color-expense); }

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
  }

  .cat-pill {
    padding: 2px 8px;
    border-radius: var(--radius-full);
    font-size: var(--font-size-xs);
    font-weight: 600;
    white-space: nowrap;
    letter-spacing: 0.01em;
    flex-shrink: 0;
  }

  /* ── Amount column ── */
  .txn-amount-col {
    flex-shrink: 0;
    text-align: right;
    min-width: 100px;
  }

  .txn-amount {
    font-size: var(--font-size-sm);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .amount-income { color: var(--color-income); }
  .amount-expense { color: var(--color-text); }

  /* ── Hover-reveal action buttons ── */
  .hover-actions {
    display: flex;
    gap: 2px;
    opacity: 0;
    transform: translateX(4px);
    transition: opacity 150ms ease, transform 150ms ease;
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
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: background 120ms ease, color 120ms ease;
  }

  .hover-btn:hover { background: var(--color-bg); color: var(--color-text); }
  .hover-delete:hover { background: var(--color-expense-light); color: var(--color-expense); }

  /* ── Inline edit panel ── */
  .edit-panel {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px var(--space-md) 12px;
    background: rgba(99, 102, 241, 0.04);
    border-bottom: 1px solid var(--color-border);
    border-left: 3px solid var(--color-primary);
    gap: var(--space-md);
  }

  .edit-meta {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  .edit-date {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
  }

  .edit-type-badge {
    padding: 1px 8px;
    border-radius: var(--radius-full);
    font-size: var(--font-size-xs);
    font-weight: 600;
  }

  .badge-income { background: var(--color-income-light); color: var(--color-income); }
  .badge-expense { background: var(--color-expense-light); color: var(--color-expense); }

  .edit-cat-name {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
  }

  .edit-buttons {
    display: flex;
    gap: var(--space-sm);
    flex-shrink: 0;
  }

  .edit-btn {
    padding: 6px 14px;
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
    font-weight: 600;
    min-height: 34px;
    cursor: pointer;
    border: none;
    font-family: inherit;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .edit-btn-primary { background: var(--color-primary); color: white; }
  .edit-btn-primary:hover { background: var(--color-primary-hover); text-decoration: none; }

  .edit-btn-danger {
    background: transparent;
    color: var(--color-expense);
    border: 1px solid var(--color-border);
  }
  .edit-btn-danger:hover {
    background: var(--color-expense-light);
    border-color: var(--color-expense);
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
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
  }

  .empty-icon {
    width: 72px;
    height: 72px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--color-primary-light), rgba(99, 102, 241, 0.1));
    color: var(--color-primary);
    border-radius: var(--radius-lg);
    margin-bottom: var(--space-md);
  }

  .empty-title {
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--color-text);
    margin: 0 0 4px;
  }

  .empty-sub {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    margin: 0 0 var(--space-md);
  }

  .empty-action {
    padding: var(--space-sm) var(--space-lg);
    background: var(--color-primary);
    color: white;
    border-radius: var(--radius-md);
    font-weight: 600;
    font-size: var(--font-size-sm);
    text-decoration: none;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    transition: background var(--transition-fast);
  }

  .empty-action:hover { background: var(--color-primary-hover); text-decoration: none; }

  /* ── Mobile ── */
  @media (max-width: 640px) {
    .cat-pill { display: none; }
    .hover-actions { display: none; }
  }

  @media (max-width: 480px) {
    .txn-row {
      flex-wrap: wrap;
      padding: 10px var(--space-md);
      min-height: 60px;
      gap: var(--space-xs);
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

    .date-header { padding: var(--space-sm) var(--space-md); }
    .edit-panel { flex-direction: column; align-items: flex-start; gap: var(--space-sm); }
    .edit-buttons { width: 100%; }
    .edit-btn { flex: 1; justify-content: center; }
  }
</style>
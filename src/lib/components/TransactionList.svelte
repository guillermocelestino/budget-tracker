<script lang="ts">
  import { formatCurrency, formatDate, getToday } from '$lib/utils/format';
  import type { Transaction } from '$lib/types';

  let {
    transactions = [],
    onDelete,
    onEdit,
    showActions = true,
    loading = false,
    // New props for bank register pattern
    runningBalanceStart = 0,
    allTransactionsForBalance = [],
    showRunningBalance = true,
    showClearedColumn = false,
    categories = [],
    showFlatView = false,
    onViewChange,
  }: {
    transactions: Transaction[];
    onDelete?: (id: number) => void;
    onEdit?: (id: number) => void;
    showActions?: boolean;
    loading?: boolean;
    runningBalanceStart?: number;
    allTransactionsForBalance?: Transaction[];
    showRunningBalance?: boolean;
    showClearedColumn?: boolean;
    categories?: { id: number; name: string; color: string; type: string }[];
    showFlatView?: boolean;
    onViewChange?: (flat: boolean) => void;
  } = $props();

  let editingId = $state<number | null>(null);
  let swipedRowId = $state<number | null>(null);
  let swipeOffset = $state(0);
  let swipeStartX = $state(0);
  let isSwiping = $state(false);
  let inlineEditingId = $state<number | null>(null);
  let inlineEditField = $state<'amount' | 'category' | null>(null);
  let inlineEditValue = $state('');

  let clearedStatesLocal = $state<Map<number, boolean>>(new Map());

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
      if (swipedRowId !== null && onDelete) {
        onDelete(swipedRowId);
      }
    }
    swipedRowId = null;
    swipeOffset = 0;
  }

  const isTouchDevice = typeof window !== 'undefined' && ('ontouch' in window || (navigator.maxTouchPoints > 0));

  type TxnWithBalance = Transaction & { runningBalance: number; daySubtotal: number; isDayFirst: boolean; isDayLast: boolean };

  const transactionsWithBalance = $derived.by(() => {
    const source = (allTransactionsForBalance && allTransactionsForBalance.length > 0)
      ? allTransactionsForBalance
      : transactions;

    const sorted = [...source].sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return a.id - b.id;
    });

    let balance = runningBalanceStart;
    const result: TxnWithBalance[] = [];

    const dayTotals = new Map<string, number>();
    for (const txn of sorted) {
      const signed = txn.type === 'income' ? txn.amount : -txn.amount;
      dayTotals.set(txn.date, (dayTotals.get(txn.date) ?? 0) + signed);
    }

    for (let i = 0; i < sorted.length; i++) {
      const txn = sorted[i];
      const signed = txn.type === 'income' ? txn.amount : -txn.amount;
      balance += signed;

      const isFirst = i === 0 || sorted[i - 1].date !== txn.date;
      const isLast = i === sorted.length - 1 || sorted[i + 1].date !== txn.date;

      result.push({
        ...txn,
        runningBalance: balance,
        daySubtotal: dayTotals.get(txn.date) ?? 0,
        isDayFirst: isFirst,
        isDayLast: isLast,
      });
    }

    const balanceMap = new Map<number, { runningBalance: number; daySubtotal: number; isDayFirst: boolean; isDayLast: boolean }>();
    for (const txn of result) {
      balanceMap.set(txn.id, {
        runningBalance: txn.runningBalance,
        daySubtotal: txn.daySubtotal,
        isDayFirst: txn.isDayFirst,
        isDayLast: txn.isDayLast,
      });
    }

    return transactions.map(txn => ({
      ...txn,
      ...balanceMap.get(txn.id)!,
    }));
  });

  type DateGroup = { date: string; label: string; items: (Transaction & { runningBalance: number; daySubtotal: number; isDayFirst: boolean; isDayLast: boolean })[]; subtotal: number; subtotalColor: string };

  const groups = $derived.by(() => {
    const map = new Map<string, (Transaction & { runningBalance: number; daySubtotal: number; isDayFirst: boolean; isDayLast: boolean })[]>();
    for (const txn of transactionsWithBalance) {
      const key = txn.date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(txn);
    }
    const sorted = [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));

    const today = getToday();
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
      const subtotal = items.reduce((sum, t) => sum + signedAmount(t), 0);
      return { date, label, items, subtotal, subtotalColor: subtotal >= 0 ? 'var(--color-teal)' : 'var(--color-coral)' };
    });
  });

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

  function startInlineEdit(txnId: number, field: 'amount' | 'category', e: Event) {
    e.stopPropagation();
    inlineEditingId = txnId;
    inlineEditField = field;
    const txn = transactionsWithBalance.find(t => t.id === txnId);
    if (txn) {
      inlineEditValue = field === 'amount' ? String(txn.amount) : String(txn.category_id);
    }
  }

  async function saveInlineEdit(txnId: number) {
    if (!inlineEditField || !inlineEditValue.trim()) {
      cancelInlineEdit();
      return;
    }

    const txn = transactionsWithBalance.find(t => t.id === txnId);
    if (!txn) return;

    try {
      const data: Record<string, unknown> = { id: txnId };
      if (inlineEditField === 'amount') {
        const amount = parseFloat(inlineEditValue.replace(/,/g, ''));
        if (isNaN(amount) || amount <= 0) { alert('Invalid amount'); return; }
        data.amount = amount;
      } else if (inlineEditField === 'category') {
        const categoryId = parseInt(inlineEditValue);
        if (isNaN(categoryId)) { alert('Invalid category'); return; }
        data.category_id = categoryId;
        data.type = txn.type;
        data.description = txn.description;
        data.date = txn.date;
        data.amount = txn.amount;
      }

      const response = await fetch(`/api/transactions/${txnId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update');
      }

      cancelInlineEdit();
    } catch (err) {
      console.error('Inline edit failed:', err);
      alert('Failed to update: ' + (err as Error).message);
    }
  }

  function cancelInlineEdit() {
    inlineEditingId = null;
    inlineEditField = null;
    inlineEditValue = '';
  }

  function handleInlineKeydown(e: KeyboardEvent, txnId: number) {
    if (e.key === 'Enter') { e.preventDefault(); saveInlineEdit(txnId); }
    else if (e.key === 'Escape') { cancelInlineEdit(); }
  }

  function toggleCleared(txnId: number, e: Event) {
    e.stopPropagation();
    const newState = !clearedStatesLocal.get(txnId);
    clearedStatesLocal = new Map(clearedStatesLocal).set(txnId, newState);
    try {
      const stored = new Map(JSON.parse(localStorage.getItem('txn_cleared_states') || '[]'));
      stored.set(txnId, newState);
      localStorage.setItem('txn_cleared_states', JSON.stringify([...stored]));
    } catch {}
  }

  // On mount, load cleared states from localStorage
  $effect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = JSON.parse(localStorage.getItem('txn_cleared_states') || '[]');
        clearedStatesLocal = new Map(stored);
      } catch {}
    }
  });

  // Action: auto-focus element on mount
  function autofocus(node: HTMLInputElement | HTMLSelectElement) {
    node.focus();
    if ('select' in node) node.select();
  }

  function formatRunningBalance(balance: number): string {
    const formatted = formatCurrency(Math.abs(balance));
    return balance >= 0 ? `+${formatted}` : `−${formatted}`;
  }

  function runningBalanceColor(balance: number): string {
    return balance >= 0 ? 'var(--color-teal)' : 'var(--color-coral)';
  }

  function signedAmount(txn: Transaction): number {
    return txn.type === 'income' ? txn.amount : -txn.amount;
  }

  function categoryInitial(txn: Transaction): string {
    return (txn.category_name || '?').charAt(0).toUpperCase();
  }
</script>



<!-- ── SNIPPETS ── -->
{#snippet dateHeader(group: DateGroup)}
  <div class="date-header" role="rowheader">
    <span class="date-label">{group.label}</span>
    <span class="date-count">{group.items.length} items</span>
    <span
      class="day-subtotal"
      style="color: {group.subtotalColor}"
    >
      {group.subtotal >= 0 ? '+' : ''}{formatCurrency(group.subtotal)}
    </span>
  </div>
{/snippet}

{#snippet bankRow(txn: Transaction & { runningBalance: number; daySubtotal: number; isDayFirst: boolean; isDayLast: boolean })}
  {@const isIncome = txn.type === 'income'}
  {@const isExpanded = editingId === txn.id}
  {@const isCleared = showClearedColumn && clearedStatesLocal.get(txn.id)}
  {@const isInlineEditing = inlineEditingId === txn.id}

  <div
    class="txn-row"
    class:txn-income={isIncome}
    class:txn-expense={!isIncome}
    class:editing={isExpanded}
    class:swiped={swipedRowId === txn.id}
    class:cleared={isCleared}
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
    <!-- Category color stripe + initial circle -->
    <div class="cat-stripe" style="background: {txn.category_color || '#2BA8A2'}"></div>
    <div class="cat-circle" style="background: {txn.category_color || '#2BA8A2'}20; color: {txn.category_color || '#2BA8A2'}">
      {categoryInitial(txn)}
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
        style="background:{(txn.category_color || '#2BA8A2')}18; color:{txn.category_color || '#2BA8A2'}"
      >
        {txn.category_name || 'Uncategorized'}
      </span>
    </div>

    <!-- Running balance column -->
    {#if showRunningBalance}
      <div class="balance-col">
        <span class="balance-label">bal</span>
        <span class="balance-value" style="color: {runningBalanceColor(txn.runningBalance)}; font-variant-numeric: tabular-nums;">
          {formatRunningBalance(txn.runningBalance)}
        </span>
      </div>
    {/if}

    <!-- Amount column -->
    <div class="txn-amount-col">
      <span class="txn-amount" class:amount-income={isIncome} class:amount-expense={!isIncome}>
        {isIncome ? '+' : '−'}{formatCurrency(txn.amount)}
      </span>
    </div>

    <!-- Cleared toggle -->
    {#if showClearedColumn}
      <div class="cleared-col">
        <button
          class="cleared-toggle"
          class:cleared={isCleared}
          onclick={(e) => toggleCleared(txn.id, e)}
          title={isCleared ? 'Reconciled' : 'Uncleared'}
          type="button"
        >
          {#if isCleared}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
          {:else}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>
          {/if}
        </button>
      </div>
    {/if}

    <!-- Hover-only edit / delete icons -->
    {#if showActions && !isExpanded && !isInlineEditing}
      <div class="hover-actions">
        <button
          class="hover-btn"
          title="Edit amount"
          onclick={(e) => { e.stopPropagation(); onEdit?.(txn.id); }}
          type="button"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
        </button>
        <button
          class="hover-btn hover-delete"
          title="Delete"
          onclick={(e) => { e.stopPropagation(); onDelete?.(txn.id); }}
          type="button"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    {/if}
  </div>

  <!-- Inline edit panel (shown below the row) -->
  {#if isExpanded}
    <div class="edit-panel" data-txn-id={txn.id}>
      <div class="edit-meta">
        <span class="edit-date">{formatDate(txn.date)}</span>
        <span class="edit-type-badge" class:badge-income={isIncome} class:badge-expense={!isIncome}>
          {isIncome ? 'Income' : 'Expense'}
        </span>
      </div>
      <div class="edit-inline-row">
        <div class="edit-inline-field">
          <label class="edit-inline-label">Amount</label>
          {#if inlineEditingId === txn.id && inlineEditField === 'amount'}
            <input
              class="edit-inline-input"
              type="text"
              inputmode="decimal"
              bind:value={inlineEditValue}
              onkeydown={(e) => handleInlineKeydown(e, txn.id)}
              onblur={() => saveInlineEdit(txn.id)}
              use:autofocus
            />
          {:else}
            <button class="edit-inline-value" onclick={(e) => startInlineEdit(txn.id, 'amount', e)}>
              {formatCurrency(txn.amount)}
            </button>
          {/if}
        </div>
        <div class="edit-inline-field">
          <label class="edit-inline-label">Category</label>
          {#if inlineEditingId === txn.id && inlineEditField === 'category'}
            <select
              class="edit-inline-input"
              bind:value={inlineEditValue}
              onchange={() => saveInlineEdit(txn.id)}
              onkeydown={(e) => handleInlineKeydown(e, txn.id)}
            >
              {#each categories as cat}
                <option value={cat.id}>{cat.name}</option>
              {/each}
            </select>
          {:else}
            <button class="edit-inline-value" onclick={(e) => startInlineEdit(txn.id, 'category', e)}>
              {txn.category_name || 'Uncategorized'}
            </button>
          {/if}
        </div>
      </div>
      <div class="edit-buttons">
        <a href="/transactions/{txn.id}/edit" class="edit-btn edit-btn-primary" onclick={(e) => e.stopPropagation()}>Full Edit</a>
        <button class="edit-btn edit-btn-danger" onclick={(e) => { e.stopPropagation(); onDelete?.(txn.id); editingId = null; }}>Delete</button>
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
  {:else if transactionsWithBalance.length === 0}
    <div class="empty-state">
      <div class="empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" x2="12" y1="12" y2="18"/><line x1="9" x2="15" y1="15" y2="15"/></svg>
      </div>
      <p class="empty-title">No transactions yet</p>
      <p class="empty-sub">Add your first transaction to start tracking</p>
      <a href="/transactions/new" class="empty-action">Add Transaction</a>
    </div>
  {:else if showFlatView}
    <!-- Flat register view -->
    <div class="flat-register">
      {#each transactionsWithBalance as txn (txn.id)}
        {@render bankRow(txn)}
      {/each}
    </div>
  {:else}
    <!-- Grouped register view (default) -->
    <div class="grouped-list">
      {#each groups as group (group.date)}
        {@render dateHeader(group)}
        {#each group.items as txn (txn.id)}
          {@render bankRow(txn)}
        {/each}
      {/each}
    </div>
  {/if}
</div>

<style>
  /* ── Container ── */
  .txn-list { width: 100%; }



  .grouped-list, .flat-register {
    background: var(--color-surface);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-xl);
    overflow: hidden;
  }

  /* ── Date Header (Flip7: sentence-case, teal tint, per-day subtotal) ── */
  .date-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    background: var(--color-teal-bg);
    border-bottom: 1px dashed var(--color-hairline);
    position: sticky;
    top: 0;
    z-index: 3;
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

  .day-subtotal {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
  }

  /* ── Row with left accent bar ── */
  .txn-row {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: 10px var(--space-md);
    border-bottom: 1px dashed var(--color-hairline);
    background: var(--color-surface);
    cursor: pointer;
    font-family: var(--font-body);
    min-height: 52px;
    transition: background 200ms var(--ease);
    overflow: hidden;
    padding-left: calc(var(--space-md) + 4px);
  }

  /* Left accent bar pseudo-element */
  .txn-row::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 0;
    border-radius: 0 2px 2px 0;
    transition: width 120ms var(--ease);
    pointer-events: none;
  }

  .txn-income::before { background: var(--color-teal); }
  .txn-expense::before { background: var(--color-coral); }

  .txn-row:hover {
    background: var(--color-teal-bg);
  }

  .txn-row:hover::before {
    width: 4px;
  }

  .txn-row.editing {
    background: var(--color-teal-bg);
    border-bottom: none;
  }

  .txn-row.editing::before {
    width: 4px;
  }

  .txn-row.swiped {
    border-color: var(--color-coral-light);
    background: rgba(239, 108, 74, 0.06);
  }

  .txn-row.cleared {
    opacity: 0.85;
  }

  .txn-row:focus-visible {
    outline: 2px solid var(--color-teal);
    outline-offset: -2px;
  }

  .txn-row:last-child { border-bottom: none; }

  /* ── Category stripe + circle ── */
  .cat-stripe {
    position: absolute;
    left: 0;
    top: 4px;
    bottom: 4px;
    width: 3px;
    border-radius: 0 2px 2px 0;
    opacity: 0.7;
  }

  .cat-circle {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-family: var(--font-display);
    font-size: 11px;
    font-weight: 800;
    margin-right: var(--space-xs);
  }

  /* ── Shimmer loading rows ── */
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
    min-height: 52px;
  }

  .shimmer-row:last-child { border-bottom: none; }

  .shimmer-info { flex: 1; min-width: 0; }
  .shimmer-amount { flex-shrink: 0; min-width: 70px; }

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

  /* ── Running balance column ── */
  .balance-col {
    flex-shrink: 0;
    text-align: right;
    min-width: 90px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 1px;
  }

  .balance-label {
    font-size: 9px;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    opacity: 0.6;
  }

  .balance-value {
    font-size: 11px;
    font-weight: 600;
    font-family: var(--font-mono);
    letter-spacing: -0.02em;
  }

  /* ── Amount column: mono, right-aligned, colored by sign ── */
  .txn-amount-col {
    flex-shrink: 0;
    text-align: right;
    min-width: 90px;
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

  /* ── Cleared column ── */
  .cleared-col {
    flex-shrink: 0;
    width: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .cleared-toggle {
    width: 24px;
    height: 24px;
    border-radius: var(--radius-full);
    border: 1px solid var(--color-hairline);
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
    font-size: 10px;
  }

  .cleared-toggle.cleared {
    background: var(--color-teal-bg);
    border-color: var(--color-teal);
    color: var(--color-teal);
  }

  .cleared-toggle:hover {
    border-color: var(--color-teal);
    background: var(--color-teal-bg);
  }

  /* ── Hover-reveal action buttons ── */
  .hover-actions {
    display: flex;
    gap: 2px;
    opacity: 0;
    transform: translateX(4px);
    transition: opacity 120ms var(--ease), transform 120ms var(--ease);
    pointer-events: none;
    flex-shrink: 0;
  }

  .txn-row:hover .hover-actions {
    opacity: 1;
    transform: translateX(0);
    pointer-events: auto;
  }

  .hover-btn {
    width: 30px;
    height: 30px;
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
    flex-direction: column;
    gap: var(--space-sm);
    padding: 10px var(--space-md) 12px;
    padding-left: calc(var(--space-md) + 4px);
    background: var(--color-teal-bg);
    border-bottom: 1px dashed var(--color-hairline);
    border-left: 4px solid var(--color-teal);
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

  .edit-inline-row {
    display: flex;
    gap: var(--space-md);
    flex-wrap: wrap;
  }

  .edit-inline-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 120px;
  }

  .edit-inline-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .edit-inline-value {
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
    background: var(--color-cream);
    color: var(--color-ink);
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    text-align: left;
    transition: all var(--transition-fast);
    min-height: 34px;
  }

  .edit-inline-value:hover {
    border-color: var(--color-teal);
    box-shadow: var(--focus);
  }

  .edit-inline-input {
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-teal);
    background: var(--color-cream);
    color: var(--color-ink);
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    font-weight: 600;
    box-shadow: var(--focus);
    min-height: 34px;
    width: 100%;
  }

  .edit-inline-input:focus {
    outline: none;
  }

  .edit-buttons {
    display: flex;
    gap: var(--space-sm);
    margin-top: var(--space-xs);
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
    .txn-row { transition: none; }
    .txn-row::before { transition: none; }
  }

  /* ── Mobile (< 640px) ── */
  @media (max-width: 640px) {
    .cat-pill { display: none; }
    .hover-actions { display: none; }
    .cat-stripe { display: none; }
  }

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
      padding-left: calc(var(--space-md) + 4px);
      min-height: 56px;
      gap: var(--space-xs);
      background: var(--color-cream);
      border: 1px dashed var(--color-hairline);
      border-left: 4px solid transparent;
      border-radius: var(--radius-lg);
      margin: 0 var(--space-sm) 6px;
    }

    .txn-row::before { display: none; }

    .txn-income { border-left-color: var(--color-teal); }
    .txn-expense { border-left-color: var(--color-coral); }

    .txn-row:last-child { margin-bottom: 0; }
    .txn-row.editing { border-bottom: 1px dashed var(--color-hairline); }

    .grouped-list, .flat-register {
      background: transparent;
      border: none;
      overflow: visible;
    }

    .date-header {
      border-radius: var(--radius-md);
      margin: 0 var(--space-sm);
      padding: var(--space-xs) var(--space-md);
    }

    .cat-circle { width: 24px; height: 24px; font-size: 10px; }

    .txn-info { flex: 1 1 calc(100% - 44px); order: 1; }
    .txn-amount-col { order: 2; min-width: auto; margin-left: auto; }

    .balance-col {
      order: 3;
      width: 100%;
      flex-direction: row;
      justify-content: flex-end;
      align-items: center;
      gap: 4px;
      margin-top: 2px;
      padding-top: 4px;
      border-top: 1px dashed var(--color-hairline);
      min-width: auto;
    }

    .balance-label { font-size: 8px; }
    .balance-value { font-size: 10px; }

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
<script lang="ts">
  import { formatCurrency, formatDate, formatSignedCurrency } from '$lib/client/utils/format';
import { formatDateShort, dateToString, getToday } from '$lib/shared/utils/format';
  import RowActionsMenu from '$lib/client/components/RowActionsMenu.svelte';
  import RowHoverActions from '$lib/client/components/RowHoverActions.svelte';
  import DateHeaderBand from '$lib/client/components/DateHeaderBand.svelte';
  import { getCategoryHue, getCategoryText, getCategoryTint } from '$lib/shared/utils/categoryColors';
  import { themeState } from '$lib/client/stores/preferences.svelte';
  import type { Transaction } from '$lib/types';

  let {
    transactions = [],
    onDelete,
    onEdit,
    onDuplicate,
    onMakeRecurring,
    showActions = true,
    loading = false,
    // New props for bank register pattern
    runningBalanceStart = 0,
    allTransactionsForBalance = [],
    showRunningBalance = true,
    categories = [],
    showFlatView = false,
    selectionMode = false,
    selectedIds = new Set() as Set<number>,
    onToggleSelection,
    emptyState,
  }: {
    transactions: Transaction[];
    onDelete?: (id: number) => void;
    onEdit?: (id: number) => void;
    onDuplicate?: (id: number) => void;
    onMakeRecurring?: (txn: Transaction) => void;
    showActions?: boolean;
    loading?: boolean;
    runningBalanceStart?: number;
    allTransactionsForBalance?: Transaction[];
    showRunningBalance?: boolean;
    categories?: { id: number; name: string; color: string; type: string }[];
    showFlatView?: boolean;
    selectionMode?: boolean;
    selectedIds?: Set<number>;
    onToggleSelection?: (id: number) => void;
    emptyState?: import('svelte').Snippet;
  } = $props();

  let editingId = $state<number | null>(null);
  let swipedRowId = $state<number | null>(null);
  let swipeOffset = $state(0);
  let swipeStartX = $state(0);
  let isSwiping = $state(false);
  let inlineEditingId = $state<number | null>(null);
  let inlineEditField = $state<'amount' | 'category' | null>(null);
  let inlineEditValue = $state('');
  let menuTxn = $state<Transaction | null>(null);
  let menuAnchor = $state<HTMLElement | null>(null); // kebab el → anchors desktop popover

  // Cleanup: when selection mode becomes active, drop any in-progress edit/swipe
  // state. Internal reset only — never touched again throughout the mode.
  $effect(() => {
    if (!selectionMode) return;
    editingId = null;
    inlineEditingId = null;
    inlineEditField = null;
    inlineEditValue = '';
    swipedRowId = null;
    swipeOffset = 0;
    isSwiping = false;
  });

  function handleSwipeStart(e: TouchEvent, txnId: number) {
    if (selectionMode) return;
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

  function handleSwipeEnd(_e: TouchEvent) {
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

  // Postgres returns `date` columns as Date objects; normalize to 'YYYY-MM-DD'
  // strings so sorting, day-group keys, and API payloads stay string-based.
  const transactionsWithBalance = $derived.by(() => {
    const rawSource = (allTransactionsForBalance && allTransactionsForBalance.length > 0)
      ? allTransactionsForBalance
      : transactions;
    const source = rawSource.map((t) => ({ ...t, date: dateToString(t.date) ?? t.date }));

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

    // Keep the prop's display order (newest first) but attach balance fields and
    // normalize dates to strings so grouping keys never see a Postgres Date.
    return transactions.map(txn => ({
      ...txn,
      date: dateToString(txn.date) ?? txn.date,
      ...balanceMap.get(txn.id)!,
    }));
  });

  type DateGroup = { date: string; label: string; items: (Transaction & { runningBalance: number; daySubtotal: number; isDayFirst: boolean; isDayLast: boolean })[]; subtotal: number };

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
      return { date, label, items, subtotal };
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
    if (selectionMode) return;
    editingId = editingId === id ? null : id;
  }

  function startInlineEdit(txnId: number, field: 'amount' | 'category', e: Event) {
    if (selectionMode) return;
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
        data.date = dateToString(txn.date) ?? txn.date;
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
    if (selectionMode) return;
    if (e.key === 'Enter') { e.preventDefault(); saveInlineEdit(txnId); }
    else if (e.key === 'Escape') { cancelInlineEdit(); }
  }

  // Action: auto-focus element on mount
  function autofocus(node: HTMLInputElement | HTMLSelectElement) {
    node.focus();
    if ('select' in node) node.select();
  }

  function formatRunningBalance(balance: number): string {
    return formatSignedCurrency(balance);
  }

  function runningBalanceColor(balance: number): string {
    return balance >= 0 ? 'var(--teal)' : 'var(--rose)';
  }

  function signedAmount(txn: Transaction): number {
    return txn.type === 'income' ? txn.amount : -txn.amount;
  }

  // Map a category name to an icon key via keyword match (case-insensitive).
  function categoryIconKey(name?: string): string {
    const n = (name || '').toLowerCase();
    if (/salary|payroll|wage/.test(n)) return 'salary';
    if (/freelance|contract|gig|side/.test(n)) return 'freelance';
    if (/invest|dividend|stock|crypto|interest/.test(n)) return 'investment';
    if (/income|refund|deposit|revenue/.test(n)) return 'income';
    if (/food|grocer|restaurant|dining|cafe|coffee|meal/.test(n)) return 'food';
    if (/transport|travel|fuel|gas|car|uber|taxi|transit|flight/.test(n)) return 'transport';
    if (/shop|cloth|retail|store|amazon|purchase/.test(n)) return 'shopping';
    if (/entertain|movie|game|music|stream|fun|hobby/.test(n)) return 'entertainment';
    if (/bill|utilit|rent|mortgage|electric|water|internet|phone|subscription/.test(n)) return 'bills';
    if (/health|medical|doctor|pharma|fitness|gym|insurance/.test(n)) return 'health';
    if (/educat|school|tuition|course|book|learn/.test(n)) return 'education';
    return 'default';
  }
</script>



<!-- ── SNIPPETS ── -->
{#snippet catIcon(key: string)}
  {#if key === 'salary'}
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
  {:else if key === 'freelance'}
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
  {:else if key === 'investment'}
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
  {:else if key === 'income'}
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
  {:else if key === 'food'}
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h0a2 2 0 0 0 2-2V2M5 2v20M13 2v20c3 0 6-1 6-8V2c-3 0-6 3-6 8z"/></svg>
  {:else if key === 'transport'}
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17H3V6a1 1 0 0 1 1-1h11v12M14 17h5v-5l-3-5H14M7 17h5"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="17.5" cy="17.5" r="1.5"/></svg>
  {:else if key === 'shopping'}
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
  {:else if key === 'entertainment'}
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
  {:else if key === 'bills'}
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>
  {:else if key === 'health'}
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>
  {:else if key === 'education'}
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1 2 3 6 3s6-2 6-3v-5"/></svg>
  {:else}
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>
  {/if}
{/snippet}

{#snippet dateHeader(group: DateGroup)}
  <DateHeaderBand label={group.label} count={group.items.length} subtotal={group.subtotal} />
{/snippet}

{#snippet editIcon()}
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
{/snippet}

{#snippet dupIcon()}
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
{/snippet}

{#snippet trashIcon()}
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
{/snippet}

{#snippet bankRow(txn: Transaction & { runningBalance: number; daySubtotal: number; isDayFirst: boolean; isDayLast: boolean })}
  {@const isIncome = txn.type === 'income'}
  {@const isExpanded = editingId === txn.id}
  {@const isInlineEditing = inlineEditingId === txn.id}
  {@const hue = getCategoryHue(txn.category_name, txn.category_color)}
  {@const tint = getCategoryTint(txn.category_name, hue, themeState.isDark)}
  {@const fg = getCategoryText(txn.category_name, hue, themeState.isDark)}

  <div
    class="txn-row"
    class:txn-income={isIncome}
    class:txn-expense={!isIncome}
    class:editing={isExpanded}
    class:swiped={swipedRowId === txn.id}
    class:selected={selectionMode && selectedIds.has(txn.id)}
    data-txn-id={txn.id}
    data-hover-row
    role="button"
    tabindex="0"
    style={swipedRowId === txn.id ? `transform: translateX(-${swipeOffset}px);` : ''}
    ontouchstart={isTouchDevice ? (e) => handleSwipeStart(e, txn.id) : undefined}
    ontouchmove={(e) => handleSwipeMove(e, txn.id)}
    ontouchend={handleSwipeEnd}
    aria-label="{isIncome ? 'Income' : 'Expense'}: {txn.description}, {formatCurrency(txn.amount)}"
    aria-expanded={isExpanded}
    onclick={() => (selectionMode ? onToggleSelection?.(txn.id) : toggleEdit(txn.id))}
    onkeydown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (selectionMode) onToggleSelection?.(txn.id);
        else toggleEdit(txn.id);
      }
      if (e.key === 'Escape') editingId = null;
    }}
  >
    <!-- Selection checkbox (selection mode only) -->
    {#if selectionMode}
      <div class="sel-check">
        <input
          type="checkbox"
          checked={selectedIds.has(txn.id)}
          onchange={() => onToggleSelection?.(txn.id)}
          onclick={(e) => e.stopPropagation()}
          aria-label="Select {cleanDescription(txn.description)}"
        />
      </div>
    {/if}
    <!-- Category color stripe + initial circle -->
    <div class="cat-stripe" style="background: {fg}"></div>
    <div class="cat-circle" style="background: {tint}; color: {fg}">
      {@render catIcon(categoryIconKey(txn.category_name))}
    </div>

    <!-- Left: description + category pill -->
    <div class="txn-info">
      <span class="txn-desc">
        {#if isRefund(txn)}
          <span class="refund-chip">↩ Refund</span>
        {/if}
        {cleanDescription(txn.description)}
      </span>
      <span class="cat-pill" style="background: {tint}; color: {fg}">
        {txn.category_name || 'Uncategorized'}
      </span>
      {#if txn.source_of_funds}
        <span class="txn-source">from {txn.source_of_funds}</span>
      {/if}
    </div>

    <!-- Per-row date column (flat view only; grouped view uses headers) -->
    {#if showFlatView}
      <div class="txn-date-col">
        <span class="txn-date-label">{formatDateShort(txn.date)}</span>
      </div>
    {/if}

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

    <!-- Hover quick actions + always-visible kebab (delete lives only in ⋯).
         <1200px: kebab is its own grid column; hover cluster is a void overlay
         ending before the BAL column. >=1200px: both live in a reserved
         actions column. Never both at once. -->
    {#if showActions && !isExpanded && !isInlineEditing && !selectionMode}
      <div class="row-actions-col">
        <div class="hover-slot">
          <RowHoverActions
            actions={[
              { id: 'edit', label: 'Edit amount', icon: editIcon, onClick: () => onEdit?.(txn.id) },
              { id: 'duplicate', label: 'Duplicate', icon: dupIcon, onClick: () => onDuplicate?.(txn.id) },
              // Quick-delete: last in the cluster, danger-tone, same confirm
              // modal as the kebab (never a silent delete). Conditional so no
              // dead button when the host page supplies no delete handler.
              ...(onDelete
                ? [{ id: 'delete', label: 'Delete', icon: trashIcon, tone: 'danger' as const, onClick: () => onDelete?.(txn.id) }]
                : [])
            ]}
          />
        </div>
        <button
          class="row-menu-btn"
          aria-label="Actions for {cleanDescription(txn.description)}"
          onclick={(e) => { e.stopPropagation(); menuAnchor = e.currentTarget as HTMLElement; menuTxn = txn; }}
          type="button"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="1"/>
            <circle cx="19" cy="12" r="1"/>
            <circle cx="5" cy="12" r="1"/>
          </svg>
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
        {#if txn.source_of_funds}
          <span class="edit-source">Source of Funds: {txn.source_of_funds}</span>
        {/if}
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
              {#each categories as cat (cat.id)}
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
        {#if onDuplicate}
          <button class="edit-btn edit-btn-ghost" onclick={(e) => { e.stopPropagation(); onDuplicate?.(txn.id); }} type="button">Duplicate</button>
        {/if}
        <button class="edit-btn edit-btn-danger" onclick={(e) => { e.stopPropagation(); onDelete?.(txn.id); editingId = null; }}>Delete</button>
      </div>
    </div>
  {/if}
{/snippet}

<!-- ── RENDER ── -->
<div class="txn-list">
  {#if loading}
    <div class="shimmer-list" aria-busy="true" aria-label="Loading transactions">
      {#each Array(5) as _, i (i)}
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
    {#if emptyState}
      {@render emptyState()}
    {:else}
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" x2="12" y1="12" y2="18"/><line x1="9" x2="15" y1="15" y2="15"/></svg>
        </div>
        <p class="empty-title">No transactions yet</p>
        <p class="empty-sub">Add your first transaction to start tracking</p>
        <a href="/transactions/new" class="empty-action">Add Transaction</a>
      </div>
    {/if}
  {:else if showFlatView}
    <!-- Flat register view -->
    <div class="flat-register" class:selecting={selectionMode}>
      <div class="flat-header" role="rowheader">
        {#if selectionMode}
          <!-- Empty spacer so the header tracks the row's checkbox column. The
               Select All checkbox lives in the bulk action bar, not here. -->
          <span class="fh-sel" aria-hidden="true"></span>
        {/if}
        <span class="fh-circle" aria-hidden="true"></span>
        <span class="fh-desc">Description</span>
        <span class="fh-date">Date</span>
        {#if showRunningBalance}
          <span class="fh-balance">Balance</span>
        {/if}
        <span class="fh-amount">Amount</span>
        <span class="fh-actions" aria-hidden="true"></span>
      </div>
      {#each transactionsWithBalance as txn (txn.id)}
        {@render bankRow(txn)}
      {/each}
    </div>
  {:else}
    <!-- Grouped register view (default) -->
    <div class="grouped-list" class:selecting={selectionMode}>
      {#each groups as group (group.date)}
        {@render dateHeader(group)}
        {#each group.items as txn (txn.id)}
          {@render bankRow(txn)}
        {/each}
      {/each}
    </div>
  {/if}
</div>

{#if menuTxn}
  <RowActionsMenu
    title={menuTxn.description || 'Transaction'}
    amount={menuTxn.type === 'income' ? `+${formatCurrency(menuTxn.amount)}` : `-${formatCurrency(menuTxn.amount)}`}
    tone={menuTxn.type === 'income' ? 'income' : 'expense'}
    anchor={menuAnchor}
    onClose={() => (menuTxn = null)}
    onEdit={() => { const id = menuTxn!.id; menuTxn = null; onEdit?.(id); }}
    onDuplicate={() => { const id = menuTxn!.id; menuTxn = null; onDuplicate?.(id); }}
    onMakeRecurring={() => { const txn = menuTxn!; menuTxn = null; onMakeRecurring?.(txn); }}
    onDelete={() => { const id = menuTxn!.id; menuTxn = null; onDelete?.(id); }}
  />
{/if}

<style>
  /* ── Container ── */
  .txn-list { width: 100%; }



  .grouped-list, .flat-register {
    background: var(--color-surface);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-xl);
    overflow: hidden;
  }

  /* ── Flat view column header (sticky, solid mint band) ── */
  .flat-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-xs) var(--space-lg);
    padding-left: calc(var(--space-md) + 4px);
    background: var(--mint-tint);
    border-bottom: 1px solid var(--color-hairline);
    position: sticky;
    top: 0;
    z-index: 2;
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-muted);
  }

  .fh-circle {
    width: 28px;
    height: 28px;
    margin-right: var(--space-xs);
    flex-shrink: 0;
  }

  .fh-desc { flex: 1; min-width: 0; }
  .fh-date { min-width: 76px; text-align: left; flex-shrink: 0; }
  .fh-balance { min-width: 90px; text-align: right; flex-shrink: 0; }
  .fh-amount { min-width: 90px; text-align: right; flex-shrink: 0; }

  /* Desktop (≥769px): comfortable minimum header height. min-height (not
     fixed height) so the header can still grow if content wraps. */
  @media (min-width: 769px) {
    .flat-header {
      min-height: 42px;
    }
  }

  /* ══ Flat view shared column grid (desktop ≥641px) ═══════════════════
     The flat header and every flat row share ONE grid template so all
     values align perfectly beneath their headers. Columns are fixed-width
     (content-independent) for strict financial-table alignment. The trailing
     column is the kebab (<1200px) or a reserved actions column (≥1200px).
     Mobile (≤640px) keeps the existing card layout — this grid does not
     apply. */
  @media (min-width: 641px) {
    .flat-register .flat-header,
    .flat-register .txn-row {
      display: grid;
      grid-template-columns:
        28px            /* category circle  */
        minmax(0, 1fr)  /* description      */
        84px            /* date             */
        96px            /* balance          */
        108px           /* amount           */
        44px;           /* kebab column     */
      align-items: center;
      column-gap: var(--space-sm);
    }

    /* Selection mode: prepend a 28px checkbox track to the shared grid so
       every row (and the header's empty .fh-sel spacer) aligns as a column. */
    .flat-register.selecting .flat-header,
    .flat-register.selecting .txn-row {
      grid-template-columns:
        28px            /* selection       */
        28px            /* category circle  */
        minmax(0, 1fr)  /* description      */
        84px            /* date             */
        96px            /* balance          */
        108px           /* amount           */
        44px;           /* kebab column     */
    }

    /* ≥1200px: the trailing column becomes a reserved actions column holding
       the hover cluster + kebab together (money never shifts). */
    @media (min-width: 1200px) {
      .flat-register .flat-header,
      .flat-register .txn-row {
        grid-template-columns:
          28px            /* category circle  */
          minmax(0, 1fr)  /* description      */
          84px            /* date             */
          96px            /* balance          */
          108px           /* amount           */
          204px;          /* reserved actions */
      }

      .flat-register.selecting .flat-header,
      .flat-register.selecting .txn-row {
        grid-template-columns:
          28px            /* selection       */
          28px            /* category circle  */
          minmax(0, 1fr)  /* description      */
          84px            /* date             */
          96px            /* balance          */
          108px           /* amount           */
          204px;          /* reserved actions */
      }
    }

    /* Header cells: reset flex sizing, let the grid tracks drive width */
    .flat-register .flat-header .fh-sel,
    .flat-register .flat-header .fh-circle,
    .flat-register .flat-header .fh-desc,
    .flat-register .flat-header .fh-date,
    .flat-register .flat-header .fh-balance,
    .flat-register .flat-header .fh-amount,
    .flat-register .flat-header .fh-actions {
      min-width: 0;
      width: auto;
      margin: 0;
    }

    /* Neutralize the circle's flex margin so it sits flush in its track */
    .flat-register .txn-row .cat-circle { margin-right: 0; }

    /* Column alignment — dates left, money right, status centered */
    .flat-register .fh-date,
    .flat-register .txn-date-col { text-align: left; justify-self: stretch; }
    .flat-register .fh-balance,
    .flat-register .balance-col { justify-self: stretch; }
    .flat-register .fh-amount,
    .flat-register .txn-amount-col { justify-self: stretch; }

    .flat-register .txn-date-col,
    .flat-register .balance-col,
    .flat-register .txn-amount-col { min-width: 0; }

    /* Hover cluster — void overlay anchored right-aligned in the empty middle
       region, ending BEFORE the BAL column so money stays readable. The
       grouped (flex) row and the flat register use different column widths. */
    .txn-row .hover-slot {
      right: calc(44px + 90px + 2 * var(--space-sm));
    }

    .flat-register .txn-row .hover-slot {
      right: calc(44px + 108px + 96px + 3 * var(--space-sm));
    }

    /* ≥1200px: reserved actions column — cluster + kebab sit in-flow together */
    @media (min-width: 1200px) {
      .flat-register .txn-row .row-actions-col {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 4px;
      }

      .flat-register .txn-row .hover-slot {
        position: static;
        transform: none;
      }
    }
  }

  /* ══ Grouped view column grid (desktop ≥641px) ══════════════════════
     Grouped rows share a grid so the hover cluster can be anchored to the
     description (main) column — its containing block is exactly that grid
     area, so it structurally cannot reach BAL/amount/kebab at any width.
     Mobile (≤640px) keeps the existing flex card layout. */
  @media (min-width: 641px) {
    .grouped-list .txn-row {
      display: grid;
      grid-template-columns:
        28px            /* category circle  */
        minmax(0, 1fr)  /* description      */
        auto            /* balance          */
        auto            /* amount           */
        auto;           /* kebab            */
      align-items: center;
      column-gap: var(--space-sm);
    }

    /* Selection mode: prepend a 28px checkbox track so every row's columns
       stay aligned (the flat register does the same via .selecting). */
    .grouped-list.selecting .txn-row {
      grid-template-columns:
        28px            /* selection        */
        28px            /* category circle  */
        minmax(0, 1fr)  /* description      */
        auto            /* balance          */
        auto            /* amount           */
        auto;           /* kebab            */
    }

    .grouped-list .txn-row .cat-circle { margin-right: 0; }
    .grouped-list .txn-row .txn-info { position: relative; }

    /* Hover cluster — absolutely positioned so it never affects layout, but
       given grid lines 2→3 so its containing block is exactly the main
       column's area. right:8px keeps it clear of the BAL column. */
    .grouped-list .txn-row .hover-slot {
      grid-column: 2 / 3;
      grid-row: 1 / 2;
      right: 8px;
    }

    /* <1200px backdrop: solid row-hover tint behind the glyphs with a
       left-fading edge. Rides the cluster's own opacity reveal — no second
       hover implementation. */
    .grouped-list .txn-row .hover-slot :global(.hover-actions) {
      background: linear-gradient(to right, transparent, var(--row-hover-bg) 20px);
      border-radius: var(--radius-lg);
      padding: 2px 6px 2px 24px;
    }
  }

  /* ≥1200px: reserved-actions column (same mechanism as the flat register) —
     the last track widens and the cluster + kebab sit in-flow together, so
     the money columns never shift. */
  @media (min-width: 1200px) {
    .grouped-list .txn-row {
      grid-template-columns:
        28px            /* category circle  */
        minmax(0, 1fr)  /* description      */
        auto            /* balance          */
        auto            /* amount           */
        232px;          /* reserved actions */
    }

    .grouped-list.selecting .txn-row {
      grid-template-columns:
        28px            /* selection        */
        28px            /* category circle  */
        minmax(0, 1fr)  /* description      */
        auto            /* balance          */
        auto            /* amount           */
        232px;          /* reserved actions */
    }

    .grouped-list .txn-row .row-actions-col {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 4px;
    }

    .grouped-list .txn-row .hover-slot {
      position: static;
      transform: none;
      right: auto;
      grid-column: auto;
      grid-row: auto;
    }

    .grouped-list .txn-row .hover-slot :global(.hover-actions) {
      background: none;
      padding: 0;
      border-radius: 0;
    }
  }

  /* Grouped rows: row hover uses the same solid tint as the cluster backdrop
     so the revealed cluster blends seamlessly into the row. */
  .grouped-list .txn-row:hover {
    background: var(--row-hover-bg);
  }

  /* ── Row with left accent bar ── */
  .txn-row {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-lg);
    border-bottom: 1px solid var(--color-hairline);
    background: var(--color-surface);
    cursor: pointer;
    font-family: var(--font-body);
    min-height: 56px;
    transition: background 180ms var(--ease);
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

  .txn-income::before { background: var(--teal); }
  .txn-expense::before { background: var(--rose); }

  .txn-row:hover {
    background: var(--color-teal-bg);
  }

  .txn-row:hover::before {
    width: 4px;
  }

  .txn-row.editing {
    background: var(--color-teal-bg);
    border-bottom: none;
    box-shadow: inset 0 0 0 2px var(--color-teal);
  }

  .txn-row.editing::before {
    width: 4px;
  }

  .txn-row.swiped {
    border-color: var(--color-coral-light);
    background: rgba(239, 108, 74, 0.06);
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

  /* ── Selection checkbox cell (selection mode only) ── */
  .sel-check {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    width: 28px;
    flex-shrink: 0;
  }

  .sel-check input[type='checkbox'] {
    width: 18px;
    height: 18px;
    margin: 0;
    accent-color: var(--color-teal);
    cursor: pointer;
    flex-shrink: 0;
  }

  /* Selected row — reuse the Flip7 teal treatment used for inline editing */
  .txn-row.selected {
    background: var(--color-teal-bg);
    box-shadow: inset 0 0 0 1px var(--color-teal);
  }

  .txn-row.selected::before {
    width: 4px;
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
    padding: 12px var(--space-lg);
    border-bottom: 1px solid var(--color-hairline);
    min-height: 56px;
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

  /* ── Source of Funds provenance (subtle secondary metadata) ── */
  .txn-source {
    font-size: 10px;
    font-weight: 500;
    color: var(--color-text-muted);
    opacity: 0.75;
    font-family: var(--font-body);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 140px;
    min-width: 0;
    flex-shrink: 1;
  }

  @media (max-width: 640px) {
    .txn-source { max-width: 100px; }
  }

  /* ── Per-row date column (flat view) ── */
  .txn-date-col {
    flex-shrink: 0;
    min-width: 76px;
    text-align: right;
  }

  .txn-date-label {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 500;
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
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
    font-weight: 500;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    opacity: 0.5;
  }

  .balance-value {
    font-size: 13px;
    font-weight: 600;
    font-family: var(--font-mono);
    letter-spacing: -0.02em;
    opacity: 1;
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

  .amount-income { color: var(--teal); }
  .amount-expense { color: var(--rose); }

  /* ── Hover cluster + kebab slot ──
     .row-actions-col is transparent to layout (<1200px): its children join the
     row's grid/flex directly. The hover cluster is a void overlay that never
     covers BAL/amount; the kebab occupies its own trailing column. ≥1200px the
     wrapper becomes a flex cell inside the reserved actions column. */
  .row-actions-col { display: contents; }

  .hover-slot {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 3;
  }

  /* Kebab — always visible, quiet at rest */
  .row-menu-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    margin-right: -6px;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: background 180ms var(--ease), color 180ms var(--ease);
  }

  .row-menu-btn:hover,
  .row-menu-btn:focus-visible {
    background: var(--mint-tint);
    color: var(--teal-deep);
  }

  .row-menu-btn:active {
    background: var(--color-teal-bg);
    color: var(--color-teal);
  }

  /* ── Inline edit panel (Flip7) ── */
  .edit-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    padding: 10px var(--space-md) 12px;
    padding-left: calc(var(--space-md) + 4px);
    background: var(--color-teal-bg);
    border-bottom: 1px solid var(--color-hairline);
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

  .badge-income { background: var(--mint-tint); color: var(--teal-deep); }
  .badge-expense { background: var(--rose-soft); color: var(--rose); }

  .edit-source {
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--color-text-muted);
    font-family: var(--font-display);
  }

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

  .edit-btn-ghost {
    background: transparent;
    color: var(--color-teal);
    border: 1px solid var(--color-hairline);
  }
  .edit-btn-ghost:hover {
    background: var(--color-teal-bg);
    border-color: var(--color-teal);
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
    .hover-slot { display: none; }
    .cat-stripe { display: none; }
    .flat-header { display: none; }
    .txn-date-col { display: none; }
    .sel-check { width: 44px; height: 44px; }
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
      padding: 5px var(--space-md);
      padding-left: calc(var(--space-md) + 4px);
      min-height: 44px;
      gap: 2px;
      background: var(--color-surface);
      border: 1px solid var(--color-hairline);
      border-left: 4px solid transparent;
      border-radius: var(--radius-lg);
      margin: 0 var(--space-sm) 6px;
    }

    .txn-row::before { display: none; }

    .txn-income { border-left-color: var(--color-teal); }
    .txn-expense { border-left-color: var(--color-coral); }

    .txn-row:last-child { margin-bottom: 0; }
    .txn-row.editing { border-bottom: 1px solid var(--color-hairline); }

    .grouped-list, .flat-register {
      background: transparent;
      border: none;
      overflow: visible;
    }

    .cat-circle { width: 24px; height: 24px; font-size: 10px; }

    .txn-info { flex: 1 1 auto; min-width: 0; order: 1; }
    .txn-amount-col { order: 2; min-width: auto; margin-left: auto; flex-shrink: 0; }
    .row-menu-btn { order: 2; margin-left: var(--space-xs); margin-right: 0; }

    .balance-col {
      order: 3;
      width: 100%;
      flex-direction: row;
      justify-content: flex-end;
      align-items: center;
      gap: 4px;
      margin-top: 0;
      padding-top: 2px;
      border-top: 1px solid var(--color-hairline);
      min-width: auto;
    }

    .balance-label { font-size: 8px; }
    .balance-value { font-size: 12px; }

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
      border: 1px solid var(--color-hairline);
      border-radius: var(--radius-lg);
      margin: 0 var(--space-sm) 6px;
    }
  }
</style>
<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { enhance } from '$app/forms';
  import PageHeader from '$lib/client/components/PageHeader.svelte';
  import CategoryList from '$lib/client/components/CategoryList.svelte';
  import type { EnrichedCategory } from '$lib/client/components/CategoryList.svelte';
  import CategoryModal from '$lib/client/components/CategoryModal.svelte';
  import ModalDialog from '$lib/client/components/ModalDialog.svelte';
  import PageBackground from '$lib/client/components/PageBackground.svelte';
  import MonthPicker from '$lib/client/components/MonthPicker.svelte';
  import SearchFilterPill from '$lib/client/components/SearchFilterPill.svelte';
  import ViewToggle from '$lib/client/components/ViewToggle.svelte';
  import { showSuccess, showError } from '$lib/client/stores/toast.svelte';
  import { formatCurrency } from '$lib/client/utils/format';
import { getCurrentMonth } from '$lib/shared/utils/format';

  let data = $derived($page.data as App.PageData);

  // ─── Month selector ───
  let selectedMonth = $state(data.selectedMonth ?? getCurrentMonth());

  // Open the Add Category panel when arriving via the global FAB (?add=1).
  // Declared before the month-sync effect so the param is stripped first.
  $effect(() => {
    const params = new URLSearchParams($page.url.searchParams);
    if (params.get('add') === '1') {
      params.delete('add');
      const qs = params.toString();
      history.replaceState(history.state, '', `${$page.url.pathname}${qs ? '?' + qs : ''}`);
      openAdd();
    }
  });

  $effect(() => {
    const params = new URLSearchParams($page.url.searchParams);
    const current = params.get('month') || getCurrentMonth();
    if (selectedMonth !== current) {
      params.set('month', selectedMonth);
      goto(`/categories?${params.toString()}`, { keepFocus: true, noScroll: true });
    }
  });

  function handleMonthChange(month: string) {
    selectedMonth = month;
  }

  const categories = $derived(data.categories ?? []);
  const spendingMap = $derived(data.spending ?? ({} as Record<number, number>));
  const incomeMap = $derived(data.income ?? ({} as Record<number, number>));
  const txnCounts = $derived(data.txnCounts ?? ({} as Record<number, number>));
  const recurringCounts = $derived(data.recurringCounts ?? ({} as Record<number, number>));
  const lastUsedMap = $derived(data.lastUsed ?? ({} as Record<number, string>));

  // Enrich categories with budgeted/spent/earned + management usage data
  const enriched = $derived<EnrichedCategory[]>(
    categories.map(cat => ({
      ...cat,
      budgeted: cat.budget_limit ?? 0,
      spent: spendingMap[cat.id] || 0,
      earned: incomeMap[cat.id] || 0,
      txnCount: txnCounts[cat.id] || 0,
      recurringCount: recurringCounts[cat.id] || 0,
      lastUsed: lastUsedMap[cat.id] || null,
    }))
  );

  // ─── Search + type filter + view mode ───
  let searchInput = $state('');
  let searchTerm = $state('');
  let typeFilter = $state<'all' | 'income' | 'expense'>('all');
  let filtersOpen = $state(false);
  let compactView = $state(false);

  // Board state: which column is active on mobile (segmented switcher) and
  // which type a per-column "+ Add" CTA preselects in the CategoryModal.
  let activeType = $state<'expense' | 'income'>('expense');
  let addType = $state<'income' | 'expense'>('expense');

  // Debounced search term (same 250ms idle pattern as the list pages).
  // Reads searchInput synchronously so the effect re-runs per keystroke;
  // the cleanup cancels the pending timer, giving the 250ms idle debounce.
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const input = searchInput;
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchTerm = input;
    }, 250);
    return () => { if (searchTimer) clearTimeout(searchTimer); };
  });

  const visibleCategories = $derived.by<EnrichedCategory[]>(() => {
    const term = searchTerm.trim().toLowerCase();
    return enriched.filter((c) => {
      if (typeFilter !== 'all' && c.type !== typeFilter) return false;
      if (term && !c.name.toLowerCase().includes(term)) return false;
      return true;
    });
  });

  // Slide-over state
  let showPanel = $state(false);
  let editingCategory = $state<EnrichedCategory | null>(null);
  let deleteTarget = $state<EnrichedCategory | null>(null);

  // Monthly summary — ONE source for the stats strip AND the group headers
  // (both derive from `categories` + `spendingMap`, so they can never drift).
  const incomeCats = $derived(categories.filter(c => c.type === 'income'));
  const expenseCats = $derived(categories.filter(c => c.type === 'expense'));
  const totalBudgeted = $derived(
    expenseCats.reduce((sum, c) => sum + (c.budget_limit ?? 0), 0)
  );
  const totalSpent = $derived(
    expenseCats.reduce((sum, c) => sum + (spendingMap[c.id] || 0), 0)
  );
  const totalRemaining = $derived(totalBudgeted - totalSpent);
  const overBudgetCount = $derived(
    expenseCats.filter(c => c.budget_limit && (spendingMap[c.id] || 0) > c.budget_limit).length
  );

  function openAdd(type: 'income' | 'expense' = 'expense') {
    editingCategory = null;
    addType = type;
    showPanel = true;
  }

  function openEdit(cat: EnrichedCategory) {
    editingCategory = cat;
        showPanel = true;
  }

  function closePanel() {
    showPanel = false;
    editingCategory = null;
      }
</script>

<svelte:head>
  <title>Categories — Finance Tracker</title>
</svelte:head>

<PageBackground />

<div class="page-container page-container--workspace">
	<PageHeader title="Categories" flush borderless />

<!-- ═══ Category stats + monthly summary bar (one source: `categories`/maps) ═══ -->
{#if categories.length > 0}
  <div class="summary-bar">
    <div class="summary-stat">
      <span class="summary-value">{categories.length}</span>
      <span class="summary-label">Categories</span>
    </div>
    <div class="summary-divider"></div>
    <div class="summary-stat">
      <span class="summary-value">{expenseCats.length}</span>
      <span class="summary-label">Expense</span>
    </div>
    <div class="summary-divider"></div>
    <div class="summary-stat">
      <span class="summary-value">{incomeCats.length}</span>
      <span class="summary-label">Income</span>
    </div>
    <div class="summary-divider"></div>
    <div class="summary-stat">
      <span class="summary-value">{formatCurrency(totalBudgeted)}</span>
      <span class="summary-label">Budgeted</span>
    </div>
    <div class="summary-divider"></div>
    <div class="summary-stat">
      <span class="summary-value">{formatCurrency(totalSpent)}</span>
      <span class="summary-label">Spent</span>
    </div>
    <div class="summary-divider"></div>
    <div class="summary-stat">
      <span class="summary-value" class:positive={totalRemaining >= 0} class:negative={totalRemaining < 0}>
        {formatCurrency(totalRemaining)}
      </span>
      <span class="summary-label">Available</span>
    </div>
    {#if overBudgetCount > 0}
      <div class="summary-divider"></div>
      <div class="summary-stat warn">
        <span class="summary-value warn">{overBudgetCount}</span>
        <span class="summary-label">Over budget</span>
      </div>
    {/if}
  </div>
{/if}

<!-- ═══ Toolbar: month picker + search/filter pill + view mode ═══ -->
<div class="cats-toolbar">
  <MonthPicker {selectedMonth} onChange={handleMonthChange} />
  <SearchFilterPill
    bind:value={searchInput}
    bind:open={filtersOpen}
    placeholder="Search categories…"
    ariaLabel="Search categories"
    filterAriaLabel="Filter categories"
    activeFilterCount={typeFilter !== 'all' ? 1 : 0}
  >
    {#snippet panel(mode, close)}
      {#if mode === 'popover'}
        <div class="filter-chips">
          <button class="filter-chip" class:active={typeFilter === 'all'} onclick={() => { typeFilter = 'all'; close(); }}>All</button>
          <button class="filter-chip" class:active={typeFilter === 'income'} onclick={() => { typeFilter = 'income'; close(); }}>Income</button>
          <button class="filter-chip" class:active={typeFilter === 'expense'} onclick={() => { typeFilter = 'expense'; close(); }}>Expense</button>
        </div>
      {/if}
    {/snippet}
  </SearchFilterPill>
  <ViewToggle
    options={[
      { value: 'card', icon: 'grid', label: 'Cards', ariaLabel: 'Card view' },
      { value: 'compact', icon: 'table', label: 'Compact', ariaLabel: 'Compact view' },
    ]}
    value={compactView ? 'compact' : 'card'}
    onSelect={(v) => (compactView = v === 'compact')}
    ariaLabel="Category list view"
    slidingThumb
    stretch
  />
</div>

<!-- ═══ Mobile board switcher — Expense | Income (desktop shows both columns) ═══ -->
<div class="board-switcher">
  <div class="segmented-control" role="radiogroup" aria-label="Select category type">
    <button
      type="button"
      class="seg-btn seg-expense"
      class:active={activeType === 'expense'}
      role="radio"
      aria-checked={activeType === 'expense'}
      onclick={() => (activeType = 'expense')}
    >
      <span class="seg-label">💸 Expense</span>
      <span class="seg-badge badge-expense">{expenseCats.length}</span>
    </button>
    <button
      type="button"
      class="seg-btn seg-income"
      class:active={activeType === 'income'}
      role="radio"
      aria-checked={activeType === 'income'}
      onclick={() => (activeType = 'income')}
    >
      <span class="seg-label">💰 Income</span>
      <span class="seg-badge badge-income">{incomeCats.length}</span>
    </button>
  </div>
</div>

<!-- ═══ Category board ═══ -->
<CategoryList
  categories={visibleCategories}
  totalCount={categories.length}
  typeCounts={{ expense: expenseCats.length, income: incomeCats.length }}
  activeType={activeType}
  compact={compactView}
  onAdd={(type) => openAdd(type)}
  onEdit={openEdit}
  onDelete={(cat) => deleteTarget = cat}
/>

<!-- ═══ Category Management Modal ═══ -->
<CategoryModal
  open={showPanel}
  category={editingCategory ?? undefined}
  action={editingCategory ? '?/update' : '?/create'}
  defaultType={addType}
  onClose={closePanel}
  onSuccess={closePanel}
/>

<!-- ═══ Delete confirmation — usage-aware (Archive is a separate future feature) ═══ -->
{#if deleteTarget}
  {@const inUse = deleteTarget.txnCount > 0 || deleteTarget.recurringCount > 0}
  <ModalDialog open={deleteTarget !== null} onclose={() => deleteTarget = null} title="Delete Category">
    <div class="modal-content">
      <div class="modal-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" x2="12" y1="9" y2="13"/>
          <line x1="12" x2="12.01" y1="17" y2="17"/>
        </svg>
      </div>
      <p>Delete "{deleteTarget.name}"?</p>
      <p class="usage-text">{deleteTarget.txnCount || 0} transactions · {deleteTarget.recurringCount || 0} recurring schedules</p>
      {#if inUse}
        <p class="warning-text">This category is in use, so it can't be deleted. Retiring a used category will move to Archive, which keeps all history intact.</p>
      {/if}
    </div>
    <form method="POST" action="?/delete" use:enhance={() => {
      return async ({ result, update }) => {
        if (result.type === 'success') {
          deleteTarget = null;
          showSuccess('Category deleted successfully');
        } else if (result.type === 'failure') {
          showError((result.data as { error?: string })?.error || 'Failed to delete category');
        }
        await update();
      };
    }}>
      <input type="hidden" name="id" value={deleteTarget.id} />
      <div class="modal-actions">
        <button type="submit" class="btn btn-danger" disabled={inUse}>Delete</button>
        <button type="button" class="btn btn-secondary" onclick={() => deleteTarget = null}>Cancel</button>
      </div>
    </form>
  </ModalDialog>
{/if}

<!-- ═══ Sticky right-side floating Add FAB (desktop) — lending/transactions pattern;
     mobile keeps the SpeedDial (?add=1) path ═══ -->
<button
  type="button"
  class="desktop-fab-add flip7-card accent-gold"
  onclick={() => openAdd()}
  aria-label="Add category"
  title="Add category"
>
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
  <span class="fab-tooltip" role="tooltip">Add category</span>
</button>
</div>

<style>
  /* ─── Toolbar: month picker + search+filter pill + view toggle ─── */
  .cats-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--space-md);
    margin-bottom: var(--space-lg);
  }

  .cats-toolbar :global(.month-picker) {
    flex-shrink: 0;
  }

  .cats-toolbar :global(.search-filter-pill) {
    flex: 1 1 auto;
    max-width: 420px;
  }

  .filter-chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
    padding: var(--space-sm);
  }

  .filter-chip {
    padding: var(--space-xs) var(--space-md);
    border: 1px solid var(--color-hairline);
    background: var(--color-cream);
    border-radius: var(--radius-pill);
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--color-text);
    cursor: pointer;
    transition: all 200ms var(--bounce);
    -webkit-tap-highlight-color: transparent;
    min-height: 44px;
  }

  .filter-chip:hover {
    border-color: var(--color-teal);
    background: var(--color-teal-bg);
  }

  .filter-chip.active {
    background: var(--mint-tint);
    border-color: var(--mint-tint);
    color: var(--teal-deep);
    font-weight: 600;
  }

  /* ─── Delete modal usage text + disabled Delete ─── */
  .usage-text {
    margin: var(--space-sm) 0 0 !important;
    color: var(--color-text-secondary) !important;
    font-size: var(--font-size-sm);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
    box-shadow: none !important;
  }

  /* ─── Monthly summary bar ─── */
  .summary-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    padding: var(--space-md) var(--space-lg);
    margin-bottom: var(--space-lg);
    animation: fadeSlideIn 0.4s ease-out;
  }

  .summary-stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .summary-stat.warn {
    color: var(--color-expense);
  }

  .summary-value {
    font-size: var(--font-size-base);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--color-text);
  }

  .summary-value.positive {
    color: var(--teal);
  }

  .summary-value.negative {
    color: var(--color-expense);
  }

  .summary-value.warn {
    color: var(--color-expense);
  }

  .summary-label {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    font-weight: 500;
  }

  .summary-divider {
    width: 1px;
    height: 32px;
    background: var(--color-border);
    flex-shrink: 0;
  }

  /* ─── Delete modal ─── */
  .modal-content {
    text-align: center;
  }

  .modal-icon {
    width: 64px;
    height: 64px;
    margin: 0 auto var(--space-md);
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--color-expense-light) 0%, rgba(239, 68, 68, 0.1) 100%);
    color: var(--color-expense);
    border-radius: var(--radius-lg);
  }

  .modal-content p {
    margin: 0;
    color: var(--color-text);
  }

  .warning-text {
    margin-top: var(--space-sm) !important;
    color: var(--color-text-secondary) !important;
    font-size: var(--font-size-sm);
  }

  .modal-actions {
    display: flex;
    gap: var(--space-sm);
    margin-top: var(--space-lg);
  }

  .btn {
    flex: 1;
    padding: var(--space-sm) var(--space-lg);
    border-radius: var(--radius-md);
    font-size: var(--font-size-base);
    font-weight: 600;
    cursor: pointer;
    border: none;
    min-height: 44px;
    transition: all var(--transition-fast);
  }

  .btn-danger {
    background: var(--color-expense);
    color: white;
  }

  .btn-danger:hover {
    background: var(--color-danger-hover);
  }

  .btn-secondary {
    background: var(--color-bg);
    color: var(--color-text);
    border: 1px solid var(--color-border);
  }

  .btn-secondary:hover {
    background: var(--color-border);
  }

  /* ─── Animations ─── */
  @keyframes slideInRight {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes fadeSlideIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* ─── Mobile board switcher — Expense | Income segmented control ───
     Pattern from CommittedMoneyWorkspace (Borrowed/Recurring switcher),
     tinted with the app's expense/income colors and 44px touch targets. */
  .board-switcher {
    display: none;
    margin-bottom: var(--space-lg);
  }

  .segmented-control {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    background: var(--color-surface-inset);
    padding: 4px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--color-hairline);
  }

  .seg-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 44px;
    border-radius: var(--radius-pill);
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    font-family: var(--font-display);
    font-size: var(--font-size-sm);
    font-weight: 700;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: all 180ms ease;
    -webkit-tap-highlight-color: transparent;
  }

  .seg-btn:hover {
    color: var(--color-ink);
    background: var(--color-surface);
  }

  .seg-btn.active {
    background: var(--color-surface);
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.04);
  }

  .seg-expense.active {
    color: var(--color-coral);
  }

  .seg-income.active {
    color: var(--color-teal);
  }

  .seg-label {
    white-space: nowrap;
  }

  .seg-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 2px 8px;
    border-radius: var(--radius-pill);
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    font-weight: 700;
  }

  .seg-badge.badge-expense {
    background: var(--color-coral-bg);
    color: var(--color-coral);
  }

  .seg-badge.badge-income {
    background: var(--color-teal-bg);
    color: var(--color-teal);
  }

  /* ─── Sticky right-side floating Add FAB (desktop) ───
     Same pattern as the lending/transactions desktop FAB; gold keeps the
     Add Category primary-CTA identity the old header button had. */
  .desktop-fab-add {
    position: fixed;
    right: 16px;
    top: 50%;
    transform: translateY(-50%);
    z-index: var(--z-sidebar, 90);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    border-radius: var(--radius-pill);
    background: var(--color-gold, #FFD23F);
    color: var(--color-ink, #14302E);
    border: 1px solid rgba(255, 255, 255, 0.4);
    box-shadow: 0 4px 20px rgba(255, 210, 63, 0.45), 0 2px 8px rgba(20, 48, 46, 0.12);
    cursor: pointer;
    outline: none;
    transition: transform 200ms var(--ease), box-shadow 200ms var(--ease), background 200ms var(--ease);
    -webkit-tap-highlight-color: transparent;
  }

  .desktop-fab-add:hover {
    background: #FFDC6B;
    box-shadow: 0 8px 28px rgba(255, 210, 63, 0.6), 0 4px 12px rgba(20, 48, 46, 0.16);
    transform: translateY(-50%) scale(1.08);
  }

  .desktop-fab-add:active {
    transform: translateY(-50%) scale(0.95);
    box-shadow: 0 2px 10px rgba(255, 210, 63, 0.35);
  }

  .desktop-fab-add:focus-visible {
    outline: 3px solid var(--color-teal, #2BA8A2);
    outline-offset: 3px;
  }

  .fab-tooltip {
    position: absolute;
    right: calc(100% + 12px);
    top: 50%;
    transform: translateY(-50%) translateX(6px);
    background: var(--color-ink, #14302E);
    color: var(--color-ink-inverse, #ffffff);
    font-family: var(--font-body);
    font-size: var(--font-size-xs, 0.75rem);
    font-weight: 600;
    padding: 6px 12px;
    border-radius: var(--radius-md, 8px);
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    visibility: hidden;
    transition: opacity 180ms var(--ease), transform 180ms var(--ease), visibility 180ms var(--ease);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
  }

  .desktop-fab-add:hover .fab-tooltip,
  .desktop-fab-add:focus-visible .fab-tooltip {
    opacity: 1;
    visibility: visible;
    transform: translateY(-50%) translateX(0);
  }

  @media (prefers-reduced-motion: reduce) {
    .desktop-fab-add,
    .fab-tooltip {
      transition: none;
    }
    .desktop-fab-add:hover {
      transform: translateY(-50%);
    }
  }

  @media (max-width: 768px) {
    .desktop-fab-add {
      display: none !important;
    }

    .board-switcher {
      display: flex;
    }

    /* The segmented switcher replaces the type filter on mobile, so the
       Filter trigger collapses the pill down to search-only. */
    .cats-toolbar :global(.pill-filter),
    .cats-toolbar :global(.search-divider) {
      display: none;
    }
  }

  /* ─── Mobile: bottom sheet ─── */
  @media (max-width: 640px) {
    .slide-over {
      width: 100vw;
      animation: slideUp 250ms cubic-bezier(0.22, 1, 0.36, 1);
      border-left: none;
      border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    }

    @keyframes slideUp {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }

    .summary-bar {
      flex-wrap: wrap;
      gap: var(--space-sm);
      padding: var(--space-md);
    }

    .summary-divider {
      display: none;
    }

    .summary-stat {
      flex: 1;
      min-width: 80px;
    }

    .cats-toolbar {
      flex-direction: column;
      align-items: stretch;
      gap: var(--space-sm);
    }

    /* Keep the month pill content-sized instead of stretching full width */
    .cats-toolbar :global(.month-picker) {
      align-self: center;
    }

    .cats-toolbar :global(.search-filter-pill) {
      max-width: none;
    }
  }
</style>

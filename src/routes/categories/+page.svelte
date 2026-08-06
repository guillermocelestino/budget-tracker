<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { enhance } from '$app/forms';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Button from '$lib/components/Button.svelte';
  import CategoryList from '$lib/components/CategoryList.svelte';
  import type { EnrichedCategory } from '$lib/components/CategoryList.svelte';
  import CategoryForm from '$lib/components/CategoryForm.svelte';
  import ModalDialog from '$lib/components/ModalDialog.svelte';
  import PageBackground from '$lib/components/PageBackground.svelte';
  import MonthPicker from '$lib/components/MonthPicker.svelte';
  import SlideOver from '$lib/components/SlideOver.svelte';
  import SearchFilterPill from '$lib/components/SearchFilterPill.svelte';
  import ViewToggle from '$lib/components/ViewToggle.svelte';
  import { showSuccess, showError } from '$lib/stores/toast.svelte';
  import { formatCurrency, getCurrentMonth } from '$lib/utils/format';

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

  // Debounced search term (same 250ms idle pattern as the list pages)
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      if (searchTerm !== searchInput) searchTerm = searchInput;
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

  function openAdd() {
    editingCategory = null;
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

<PageHeader title="Categories" flush borderless>
  {#snippet action()}
    <Button variant="primary" onclick={openAdd}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" x2="12" y1="5" y2="19"/>
        <line x1="5" x2="19" y1="12" y2="12"/>
      </svg>
      Add Category
    </Button>
  {/snippet}
</PageHeader>

<!-- ═══ Month picker ═══ -->
<div class="month-bar">
  <MonthPicker {selectedMonth} onChange={handleMonthChange} />
</div>

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

<!-- ═══ Toolbar: search+filter pill (left) + view mode (right) ═══ -->
<div class="cats-toolbar">
  <SearchFilterPill
    bind:value={searchInput}
    bind:open={filtersOpen}
    placeholder="Search categories…"
    ariaLabel="Search categories"
    filterAriaLabel="Filter categories"
    activeFilterCount={typeFilter !== 'all' ? 1 : 0}
  >
    {#snippet panel(_mode, close)}
      <div class="filter-chips">
        <button class="filter-chip" class:active={typeFilter === 'all'} onclick={() => { typeFilter = 'all'; close(); }}>All</button>
        <button class="filter-chip" class:active={typeFilter === 'income'} onclick={() => { typeFilter = 'income'; close(); }}>Income</button>
        <button class="filter-chip" class:active={typeFilter === 'expense'} onclick={() => { typeFilter = 'expense'; close(); }}>Expense</button>
      </div>
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

<!-- ═══ Category list ═══ -->
<CategoryList
  categories={visibleCategories}
  totalCount={categories.length}
  compact={compactView}
  onAdd={openAdd}
  onEdit={openEdit}
  onDelete={(cat) => deleteTarget = cat}
/>

<!-- ═══ Slide-over panel for add/edit ═══ -->
<SlideOver
  isOpen={showPanel}
  title={editingCategory ? 'Edit Category' : 'Add Category'}
  onClose={closePanel}
>
  <CategoryForm
      category={editingCategory ?? undefined}
      action={editingCategory ? '?/update' : '?/create'}
      onCancel={closePanel}
      onSuccess={closePanel}
    />
</SlideOver>

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

<style>
  /* ─── Month bar ─── */
  .month-bar {
    display: flex;
    align-items: center;
    margin-bottom: var(--space-lg);
  }

  /* ─── Toolbar: search+filter pill (left) + view toggle (right) ─── */
  .cats-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    margin-bottom: var(--space-lg);
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

    .cats-toolbar :global(.search-filter-pill) {
      max-width: none;
    }
  }
</style>

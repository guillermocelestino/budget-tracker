<script lang="ts">
  import { page } from '$app/stores';
  import { enhance } from '$app/forms';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import CategoryList from '$lib/components/CategoryList.svelte';
  import type { EnrichedCategory } from '$lib/components/CategoryList.svelte';
  import CategoryForm from '$lib/components/CategoryForm.svelte';
  import ModalDialog from '$lib/components/ModalDialog.svelte';
  import PageBackground from '$lib/components/PageBackground.svelte';
  import { showSuccess, showError } from '$lib/stores/toast.svelte';
  import { formatCurrency } from '$lib/utils/format';

  let data = $derived($page.data as App.PageData);

  const categories = $derived(data.categories ?? []);
  const spendingMap = $derived(data.spending ?? ({} as Record<number, number>));
  const incomeMap = $derived(data.income ?? ({} as Record<number, number>));

  // Enrich categories with budgeted/spent/earned
  const enriched = $derived<EnrichedCategory[]>(
    categories.map(cat => ({
      ...cat,
      budgeted: cat.budget_limit ?? 0,
      spent: spendingMap[cat.id] || 0,
      earned: incomeMap[cat.id] || 0,
    }))
  );

  // Slide-over state
  let showPanel = $state(false);
  let editingCategory = $state<EnrichedCategory | null>(null);
  let deleteId = $state<number | null>(null);
  let panelError = $state('');

  // Monthly summary
  const expenseCats = $derived(categories.filter(c => c.type === 'expense'));
  const totalBudgeted = $derived(
    expenseCats.reduce((sum, c) => sum + (c.budget_limit ?? 0), 0)
  );
  const totalSpent = $derived(
    categories.reduce((sum, c) => sum + (spendingMap[c.id] || 0), 0)
  );
  const totalRemaining = $derived(totalBudgeted - totalSpent);
  const overBudgetCount = $derived(
    expenseCats.filter(c => c.budget_limit && (spendingMap[c.id] || 0) > c.budget_limit).length
  );

  function openAdd() {
    editingCategory = null;
    panelError = '';
    showPanel = true;
  }

  function openEdit(cat: EnrichedCategory) {
    editingCategory = cat;
    panelError = '';
    showPanel = true;
  }

  function closePanel() {
    showPanel = false;
    editingCategory = null;
    panelError = '';
  }
</script>

<svelte:head>
  <title>Categories — Finance Tracker</title>
</svelte:head>

<PageBackground />

<PageHeader title="Categories">
  {#snippet action()}
    <button class="btn-add" onclick={openAdd}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" x2="12" y1="5" y2="19"/>
        <line x1="5" x2="19" y1="12" y2="12"/>
      </svg>
      Add Category
    </button>
  {/snippet}
</PageHeader>

<!-- ═══ Monthly summary bar ═══ -->
{#if expenseCats.length > 0}
  <div class="summary-bar">
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

<!-- ═══ Category list ═══ -->
<CategoryList
  categories={enriched}
  onEdit={openEdit}
  onDelete={(id) => deleteId = id}
/>

<!-- ═══ Slide-over panel for add/edit ═══ -->
{#if showPanel}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="slide-over-backdrop" onclick={closePanel} role="presentation"></div>
  <div class="slide-over" class:open={showPanel}>
    <div class="slide-over-header">
      <h3>
        {#if editingCategory}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
          </svg>
          Edit Category
        {:else}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" x2="12" y1="5" y2="19"/>
            <line x1="5" x2="19" y1="12" y2="12"/>
          </svg>
          Add Category
        {/if}
      </h3>
      <button class="slide-over-close" onclick={closePanel} aria-label="Close">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" x2="6" y1="6" y2="18"/>
          <line x1="6" x2="18" y1="6" y2="18"/>
        </svg>
      </button>
    </div>
    <div class="slide-over-body">
      <CategoryForm
        category={editingCategory ?? undefined}
        action={editingCategory ? '?/update' : '?/create'}
        onCancel={closePanel}
        onSuccess={closePanel}
      />
    </div>
  </div>
{/if}

<!-- ═══ Delete confirmation ═══ -->
{#if deleteId !== null}
  <ModalDialog open={deleteId !== null} onclose={() => deleteId = null} title="Delete Category">
    <div class="modal-content">
      <div class="modal-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" x2="12" y1="9" y2="13"/>
          <line x1="12" x2="12.01" y1="17" y2="17"/>
        </svg>
      </div>
      <p>Are you sure you want to delete this category?</p>
      <p class="warning-text">Categories with transactions cannot be deleted.</p>
    </div>
    <form method="POST" action="?/delete" use:enhance={() => {
      return async ({ result, update }) => {
        if (result.type === 'success') {
          deleteId = null;
          showSuccess('Category deleted successfully');
        } else if (result.type === 'failure') {
          showError((result.data as { error?: string })?.error || 'Failed to delete category');
        }
        await update();
      };
    }}>
      <input type="hidden" name="id" value={deleteId} />
      <div class="modal-actions">
        <button type="submit" class="btn btn-danger">Delete</button>
        <button type="button" class="btn btn-secondary" onclick={() => deleteId = null}>Cancel</button>
      </div>
    </form>
  </ModalDialog>
{/if}

<style>
  /* ─── Add button ─── */
  .btn-add {
    display: inline-flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-sm) var(--space-md);
    background: linear-gradient(135deg, var(--color-primary) 0%, #8b5cf6 100%);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    min-height: 44px;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
    transition: all var(--transition-fast);
  }

  .btn-add:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
  }

  .header-subtitle {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
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
    color: var(--color-income);
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

  /* ─── Slide-over panel ─── */
  .slide-over-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
    z-index: 98;
    animation: fadeIn 200ms ease;
  }

  .slide-over {
    position: fixed;
    top: 0;
    right: 0;
    width: 480px;
    max-width: 100vw;
    height: 100vh;
    height: 100dvh;
    background: var(--color-surface);
    border-left: 1px solid var(--color-border);
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.1);
    z-index: var(--z-modal);
    display: flex;
    flex-direction: column;
    animation: slideInRight 250ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  [data-theme="dark"] .slide-over {
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.3);
  }

  .slide-over-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-lg) var(--space-xl);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .slide-over-header h3 {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--color-text);
  }

  .slide-over-header h3 svg {
    color: var(--color-primary);
  }

  .slide-over-close {
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px;
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
  }

  .slide-over-close:hover {
    background: var(--color-bg);
    color: var(--color-text);
  }

  .slide-over-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-lg) var(--space-xl);
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
  }
</style>

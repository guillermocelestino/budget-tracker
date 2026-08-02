<script lang="ts">
  import { page } from '$app/stores';
  import { enhance } from '$app/forms';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import SlideOver from '$lib/components/SlideOver.svelte';
  import LendingForm from '$lib/components/LendingForm.svelte';
  import ModalDialog from '$lib/components/ModalDialog.svelte';
  import PageBackground from '$lib/components/PageBackground.svelte';
  import LendingBalanceHeader from '$lib/components/LendingBalanceHeader.svelte';
  import ActiveIouList from '$lib/components/ActiveIouList.svelte';
  import Button from '$lib/components/Button.svelte';
  import OverflowMenu from '$lib/components/OverflowMenu.svelte';
  import ViewToggle from '$lib/components/ViewToggle.svelte';
  import ListToolbar from '$lib/components/ListToolbar.svelte';
  import SearchFilterPill from '$lib/components/SearchFilterPill.svelte';
  import LendingFilters from '$lib/components/LendingFilters.svelte';
  import LendingImport from '$lib/components/LendingImport.svelte';
  import { showSuccess, showError } from '$lib/stores/toast.svelte';
  import { downloadCsv, lendingsToCSV } from '$lib/utils/csv';
  import type { Lending } from '$lib/types';

  let data = $derived($page.data as App.PageData);

  let showPanel = $state(false);
  let editingLending = $state<Lending | null>(null);
  let activeTab = $state<'all' | 'active' | 'paid'>('active');
  let viewMode = $state<'card' | 'table'>('card');
  let markPaidId = $state<number | null>(null);
  let recordAsIncome = $state(true);
  let deleteId = $state<number | null>(null);
  let importSlideOpen = $state(false);
  let searchInput = $state('');
  let filtersOpen = $state(false);

  // Debounced search term — the SearchFilterPill binds the raw input; we
  // push it into `searchTerm` after a 250ms idle window (same as the old
  // LendingSearch debounce, so search behavior is unchanged).
  let searchTerm = $state('');
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      if (searchTerm !== searchInput) searchTerm = searchInput;
    }, 250);
    return () => {
      if (searchTimer) clearTimeout(searchTimer);
    };
  });

  const activeLendings = $derived(data.activeLendings ?? []);
  const paidLendings = $derived(data.paidLendings ?? []);
  const totals = $derived(data.totals ?? { totalLent: 0, totalRecovered: 0, outstanding: 0 });
  const existingPeople = $derived(
    Array.from(new Set([...activeLendings, ...paidLendings].map(l => l.borrower_name)))
  );

  // Status is the only filter; 'active' is the default view, so the Filter
  // badge lights up only when the user changes away from the default.
  const activeFilterCount = $derived(activeTab !== 'active' ? 1 : 0);

  // Stage 1 — tab selection (status filter, untouched by search).
  const tabLendings: Lending[] = $derived(
    activeTab === 'all'
      ? [...activeLendings, ...paidLendings]
      : activeTab === 'active'
        ? activeLendings
        : paidLendings
  );

  // Stage 2 — client-side search narrowing against borrower_name + notes.
  // The hero (totals) reads from `data.totals`, NOT showLendings, so search
  // can never change the headline balance — it only narrows the visible list.
  const showLendings: Lending[] = $derived.by(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return tabLendings;
    return tabLendings.filter(
      (l) =>
        l.borrower_name.toLowerCase().includes(term) ||
        (l.notes ?? '').toLowerCase().includes(term)
    );
  });

  function openAdd() {
    editingLending = null;
    showPanel = true;
  }

  // Open the New Lending panel when arriving via the global FAB (?add=1)
  $effect(() => {
    const params = new URLSearchParams($page.url.searchParams);
    if (params.get('add') === '1') {
      params.delete('add');
      const qs = params.toString();
      history.replaceState(history.state, '', `${$page.url.pathname}${qs ? '?' + qs : ''}`);
      openAdd();
    }
  });

  function openEdit(lending: Lending) {
    editingLending = lending;
    showPanel = true;
  }

  function closePanel() {
    showPanel = false;
    editingLending = null;
  }

  function handleExportCsv() {
    const csv = lendingsToCSV(showLendings, 'lent');
    downloadCsv(csv, `lending-${new Date().toISOString().split('T')[0]}.csv`);
  }
</script>

<svelte:head>
  <title>Lending — Finance Tracker</title>
</svelte:head>

<PageHeader title="Lending" flush>
  {#snippet subtitle()}
    <span class="context-subline">{activeLendings.length} active · {paidLendings.length} paid</span>
  {/snippet}
  {#snippet action()}
    <div class="header-actions">
      <span class="desktop-only">
        <OverflowMenu
          onImportCsv={() => (importSlideOpen = true)}
          onExportCsv={handleExportCsv}
        />
        <Button variant="primary" onclick={openAdd}>
          <span class="btn-lead" aria-hidden="true">+</span>
          New Lending
        </Button>
      </span>
      <span class="mobile-only">
        <OverflowMenu
          onImportCsv={() => (importSlideOpen = true)}
          onExportCsv={handleExportCsv}
        />
      </span>
    </div>
  {/snippet}
</PageHeader>

<PageBackground />

<LendingBalanceHeader
  totalOwedToMe={totals.outstanding}
  totalIOwe={0}
/>

<!-- ═══ Slide-over for Add / Edit ═══ -->
<SlideOver
  isOpen={showPanel}
  title={editingLending ? 'Edit Lending' : 'New Lending'}
  onClose={closePanel}
>
  {#snippet children()}
    <LendingForm
      lendingRecord={editingLending ?? undefined}
      onCancel={closePanel}
      onSuccess={closePanel}
    />
  {/snippet}
</SlideOver>

<!-- ═══ CSV Import wizard ═══ -->
<LendingImport
  open={importSlideOpen}
  onClose={() => (importSlideOpen = false)}
  existingPeople={existingPeople}
  noun="Lendings"
  title="Import Lendings"
/>

<!-- ═══ ListToolbar: unified Search|Filter pill (left), view mode (right) ═══ -->
<ListToolbar>
  {#snippet filters()}
    <SearchFilterPill
      bind:value={searchInput}
      bind:open={filtersOpen}
      activeFilterCount={activeFilterCount}
      placeholder="Search borrower, lender, notes…"
      ariaLabel="Search lendings"
      filterAriaLabel="Filter lendings"
    >
      {#snippet panel(mode, close)}
        <LendingFilters
          status={activeTab}
          onStatusChange={(s) => (activeTab = s)}
          counts={{
            all: activeLendings.length + paidLendings.length,
            active: activeLendings.length,
            paid: paidLendings.length,
          }}
          {mode}
          onApply={close}
        />
      {/snippet}
    </SearchFilterPill>
  {/snippet}
  {#snippet views()}
    <ViewToggle
      options={[
        { value: 'card', icon: 'grid', ariaLabel: 'Card view' },
        { value: 'table', icon: 'table', ariaLabel: 'Table view' },
      ]}
      value={viewMode}
      onSelect={(v) => (viewMode = v as 'card' | 'table')}
      iconOnly
      ariaLabel="Lending list view"
      slidingThumb
    />
  {/snippet}
</ListToolbar>

<ActiveIouList
  ious={showLendings}
  onPay={(id) => markPaidId = id}
  onEdit={(id) => { const l = showLendings.find(l => l.id === id); if (l) openEdit(l); }}
  onDelete={(id) => deleteId = id}
  viewMode={viewMode}
/>

<!-- ═══ Mark as Paid Modal ═══ -->
{#if markPaidId !== null}
  <ModalDialog open={markPaidId !== null} onclose={() => { markPaidId = null; recordAsIncome = true; }} title="Record Repayment">
    <div class="modal-icon-wrap">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    </div>
    <p class="modal-desc">Would you like to record this repayment as income?</p>
    <form method="POST" action="?/markPaid" use:enhance={() => {
      return async ({ result, update }: { result: { type: string; data?: { error?: string } }; update: () => Promise<void> }) => {
        await update();
        if (result.type === 'success') {
          markPaidId = null;
          showSuccess('Marked as paid successfully');
        } else {
          showError((result.data as { error?: string } | undefined)?.error || 'Failed to update');
        }
      };
    }}>
      <input type="hidden" name="id" value={markPaidId} />
      <div class="radio-group">
        <label class="radio-option">
          <input type="radio" name="record_as_income" value="true" bind:group={recordAsIncome} />
          <span class="radio-label">Yes, record as income transaction</span>
          <span class="radio-desc">Creates an income entry in Transactions</span>
        </label>
        <label class="radio-option">
          <input type="radio" name="record_as_income" value="false" bind:group={recordAsIncome} />
          <span class="radio-label">No, just mark as paid</span>
          <span class="radio-desc">No transaction created</span>
        </label>
      </div>
      <div class="modal-actions">
        <button type="submit" class="btn btn-primary">Confirm</button>
        <button type="button" class="btn btn-secondary" onclick={() => { markPaidId = null; recordAsIncome = true; }}>Cancel</button>
      </div>
    </form>
  </ModalDialog>
{/if}

<!-- ═══ Delete Confirmation ═══ -->
{#if deleteId !== null}
  <ModalDialog open={deleteId !== null} onclose={() => deleteId = null} title="Delete Lending">
    <div class="modal-icon-wrap danger">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      </svg>
    </div>
    <p>Are you sure you want to delete this lending record?</p>
    <form method="POST" action="?/delete" use:enhance={() => {
      return async ({ result, update }: { result: { type: string; data?: { error?: string } }; update: () => Promise<void> }) => {
        await update();
        if (result.type === 'success') {
          deleteId = null;
          showSuccess('Lending deleted');
        } else {
          showError((result.data as { error?: string } | undefined)?.error || 'Failed to delete');
        }
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
  /* Raise the header's stacking context so the OverflowMenu dropdown
     (trapped inside the header's backdrop-filter context) paints above
     the content that follows it. Matches /transactions. */
  :global(.page-header) {
    position: relative;
    z-index: 30;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
    min-width: 0;
  }

  .btn-lead {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    font-weight: var(--font-weight-extrabold);
  }

  /* ─── Context subline (header) ─── */
  .context-subline {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    font-size: var(--font-size-xs);
    letter-spacing: 0.02em;
  }

  /* ─── Mobile / Desktop visibility (matches /transactions) ─── */
  .desktop-only {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .mobile-only {
    display: none;
  }

  .modal-icon-wrap {
    width: 64px;
    height: 64px;
    margin: 0 auto var(--space-md);
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--color-income-light) 0%, rgba(16, 185, 129, 0.1) 100%);
    color: var(--color-income);
    border-radius: var(--radius-lg);
  }

  .modal-icon-wrap.danger {
    background: linear-gradient(135deg, var(--color-expense-light) 0%, rgba(239, 68, 68, 0.1) 100%);
    color: var(--color-expense);
  }

  .modal-desc {
    text-align: center;
    margin-bottom: var(--space-md);
  }

  .radio-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    margin: var(--space-md) 0;
  }

  .radio-option {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .radio-option:has(input:checked) {
    border-color: var(--color-primary);
    background: var(--color-primary-light);
  }

  .radio-option input {
    accent-color: var(--color-primary);
  }

  .radio-label {
    font-weight: 600;
    font-size: var(--font-size-sm);
  }

  .radio-desc {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
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

  .btn-primary {
    background: var(--color-primary);
    color: white;
  }

  .btn-primary:hover {
    background: var(--color-primary-hover);
  }

  .btn-secondary {
    background: var(--color-bg);
    color: var(--color-text);
    border: 1px solid var(--color-border);
  }

  .btn-secondary:hover {
    background: var(--color-border);
  }

  .btn-danger {
    background: var(--color-expense);
    color: white;
  }

  .btn-danger:hover {
    background: var(--color-danger-hover);
  }

  @keyframes fadeSlideIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media (max-width: 768px) {
    .desktop-only {
      display: none !important;
    }

    .mobile-only {
      display: flex;
      align-items: center;
    }
  }
</style>

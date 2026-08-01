<script lang="ts">
  import { page } from '$app/stores';
  import { enhance } from '$app/forms';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import SlideOver from '$lib/components/SlideOver.svelte';
  import LendingForm from '$lib/components/LendingForm.svelte';
  import ModalDialog from '$lib/components/ModalDialog.svelte';
  import PageBackground from '$lib/components/PageBackground.svelte';
  import LendingBalanceHeader from '$lib/components/LendingBalanceHeader.svelte';
  import LendingSummaryCards from '$lib/components/LendingSummaryCards.svelte';
  import ActiveIouList from '$lib/components/ActiveIouList.svelte';
  import Button from '$lib/components/Button.svelte';
  import MoreMenu from '$lib/components/MoreMenu.svelte';
  import ViewToggle from '$lib/components/ViewToggle.svelte';
  import LendingImport from '$lib/components/LendingImport.svelte';
  import { showSuccess, showError } from '$lib/stores/toast.svelte';
  import type { Lending } from '$lib/types';

  let data = $derived($page.data as App.PageData);

  let showPanel = $state(false);
  let editingLending = $state<Lending | null>(null);
  let activeTab = $state<'active' | 'paid'>('active');
  let viewMode = $state<'card' | 'table'>('card');
  let markPaidId = $state<number | null>(null);
  let recordAsTransaction = $state(true);
  let deleteId = $state<number | null>(null);
  let importSlideOpen = $state(false);

  const activeLendings = $derived(data.activeLendings ?? []);
  const paidLendings = $derived(data.paidLendings ?? []);
  const totals = $derived(data.totals ?? { totalLent: 0, totalRecovered: 0, outstanding: 0 });
  const existingPeople = $derived(
    Array.from(new Set([...activeLendings, ...paidLendings].map(l => l.borrower_name)))
  );

  const showLendings: Lending[] = $derived(activeTab === 'active' ? activeLendings : paidLendings);

  function openAdd() {
    editingLending = null;
    showPanel = true;
  }

  // Open the New Borrowing panel when arriving via the global FAB (?add=1)
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
</script>

<svelte:head>
  <title>Borrowed — Finance Tracker</title>
</svelte:head>

<PageHeader title="Borrowed" flush>
  {#snippet subtitle()}
    <span class="context-subline">{activeLendings.length} active · {paidLendings.length} repaid</span>
  {/snippet}
  {#snippet action()}
    <div class="header-actions">
      <span class="desktop-only">
        <Button variant="primary" onclick={openAdd}>
          <span class="btn-lead" aria-hidden="true">+</span>
          New Borrowing
        </Button>
        <Button variant="ghost" onclick={() => (importSlideOpen = true)} ariaLabel="Import CSV" title="Import CSV">
          <svg class="btn-lead" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Import
        </Button>
      </span>
      <span class="mobile-only">
        <MoreMenu
          items={[{ label: 'Import CSV', icon: 'import', onClick: () => (importSlideOpen = true) }]}
        />
      </span>
    </div>
  {/snippet}
</PageHeader>

<PageBackground />

<LendingBalanceHeader
  totalOwedToMe={0}
  totalIOwe={totals.outstanding}
  direction="borrowed"
/>

<LendingSummaryCards
  totalLent={totals.totalLent}
  totalRecovered={totals.totalRecovered}
  outstanding={totals.outstanding}
  direction="borrowed"
/>

<!-- ═══ Slide-over for Add / Edit ═══ -->
<SlideOver
  isOpen={showPanel}
  title={editingLending ? 'Edit Borrowing' : 'New Borrowing'}
  onClose={closePanel}
>
  {#snippet children()}
    <LendingForm
      lendingRecord={editingLending ?? undefined}
      onCancel={closePanel}
      onSuccess={closePanel}
      direction="borrowed"
    />
  {/snippet}
</SlideOver>

<!-- ═══ CSV Import wizard ═══ -->
<LendingImport
  open={importSlideOpen}
  onClose={() => (importSlideOpen = false)}
  existingPeople={existingPeople}
  direction="borrowed"
  noun="Borrowings"
  title="Import Borrowings"
  sampleHref="/borrowed-sample.csv"
  sampleFilename="borrowed-sample.csv"
/>

<!-- ═══ Unified toolbar: status tab left, view toggle right ═══ -->
<div class="toolbar">
  <ViewToggle
    options={[
      { value: 'active', label: 'Active', count: activeLendings.length },
      { value: 'paid', label: 'Repaid', count: paidLendings.length },
    ]}
    value={activeTab}
    onSelect={(v) => (activeTab = v as 'active' | 'paid')}
    ariaLabel="Borrowing status filter"
  />
  <ViewToggle
    options={[
      { value: 'card', icon: 'grid', ariaLabel: 'Card view' },
      { value: 'table', icon: 'table', ariaLabel: 'Table view' },
    ]}
    value={viewMode}
    onSelect={(v) => (viewMode = v as 'card' | 'table')}
    iconOnly
    ariaLabel="Borrowing list view"
  />
</div>

<ActiveIouList
  ious={showLendings}
  onPay={(id) => markPaidId = id}
  onEdit={(id) => { const l = showLendings.find(l => l.id === id); if (l) openEdit(l); }}
  onDelete={(id) => deleteId = id}
  direction="borrowed"
  viewMode={viewMode}
/>

<!-- ═══ Mark as Paid Modal ═══ -->
{#if markPaidId !== null}
  <ModalDialog open={markPaidId !== null} onclose={() => { markPaidId = null; recordAsTransaction = true; }} title="Record Repayment">
    <div class="modal-icon-wrap">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    </div>
    <p class="modal-desc">Would you like to record this repayment as an expense?</p>
    <form method="POST" action="?/markPaid" use:enhance={() => {
      return async ({ result, update }: { result: { type: string; data?: { error?: string } }; update: () => Promise<void> }) => {
        await update();
        if (result.type === 'success') {
          markPaidId = null;
          showSuccess('Marked as repaid successfully');
        } else {
          showError((result.data as { error?: string } | undefined)?.error || 'Failed to update');
        }
      };
    }}>
      <input type="hidden" name="id" value={markPaidId} />
      <div class="radio-group">
        <label class="radio-option">
          <input type="radio" name="record_as_transaction" value="true" bind:group={recordAsTransaction} />
          <span class="radio-label">Yes, record as expense transaction</span>
          <span class="radio-desc">Creates an expense entry in Transactions (repaying debt = money out)</span>
        </label>
        <label class="radio-option">
          <input type="radio" name="record_as_transaction" value="false" bind:group={recordAsTransaction} />
          <span class="radio-label">No, just mark as repaid</span>
          <span class="radio-desc">No transaction created</span>
        </label>
      </div>
      <div class="modal-actions">
        <button type="submit" class="btn btn-primary">Confirm</button>
        <button type="button" class="btn btn-secondary" onclick={() => { markPaidId = null; recordAsTransaction = true; }}>Cancel</button>
      </div>
    </form>
  </ModalDialog>
{/if}

<!-- ═══ Delete Confirmation ═══ -->
{#if deleteId !== null}
  <ModalDialog open={deleteId !== null} onclose={() => deleteId = null} title="Delete Borrowing">
    <div class="modal-icon-wrap danger">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      </svg>
    </div>
    <p>Are you sure you want to delete this borrowing record?</p>
    <form method="POST" action="?/delete" use:enhance={() => {
      return async ({ result, update }: { result: { type: string; data?: { error?: string } }; update: () => Promise<void> }) => {
        await update();
        if (result.type === 'success') {
          deleteId = null;
          showSuccess('Borrowing deleted');
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

  /* ─── Unified toolbar: status tab left, view toggle right ─── */
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    margin-bottom: var(--space-lg);
  }

  /* ─── Mobile / Desktop visibility (matches /transactions + /lending) ─── */
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
    background: var(--color-income-light);
    color: var(--color-income);
    border-radius: var(--radius-lg);
  }

  .modal-icon-wrap.danger {
    background: var(--color-expense-light);
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
    border-color: var(--color-teal);
    background: var(--color-teal-bg);
  }

  .radio-option input {
    accent-color: var(--color-teal);
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
    background: linear-gradient(135deg, var(--color-gold) 0%, var(--color-gold-dark) 100%);
    color: var(--color-on-gold);
    box-shadow: var(--glow-gold);
  }

  .btn-primary:hover {
    background: var(--color-gold-dark);
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
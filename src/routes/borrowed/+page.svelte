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

  const activeLendings = $derived(data.activeLendings ?? []);
  const paidLendings = $derived(data.paidLendings ?? []);
  const totals = $derived(data.totals ?? { totalLent: 0, totalRecovered: 0, outstanding: 0 });

  const showLendings: Lending[] = $derived(activeTab === 'active' ? activeLendings : paidLendings);

  function openAdd() {
    editingLending = null;
    showPanel = true;
  }

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

<PageHeader title="Borrowed">
  {#snippet action()}
    <button class="btn-add" onclick={openAdd}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" x2="12" y1="5" y2="19"/>
        <line x1="5" x2="19" y1="12" y2="12"/>
      </svg>
      New Borrowing
    </button>
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

<!-- ═══ Tabs + View Toggle ═══ -->
<div class="tabs-row">
  <div class="tabs">
    <button class="tab" class:active={activeTab === 'active'} onclick={() => activeTab = 'active'}>
      Active ({activeLendings.length})
    </button>
    <button class="tab" class:active={activeTab === 'paid'} onclick={() => activeTab = 'paid'}>
      Repaid ({paidLendings.length})
    </button>
  </div>
  <div class="view-toggle">
    <button class="toggle-btn" class:active={viewMode === 'card'} onclick={() => viewMode = 'card'} title="Card View">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    </button>
    <button class="toggle-btn" class:active={viewMode === 'table'} onclick={() => viewMode = 'table'} title="Table View">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <line x1="3" y1="9" x2="21" y2="9"/>
        <line x1="3" y1="15" x2="21" y2="15"/>
        <line x1="9" y1="3" x2="9" y2="21"/>
        <line x1="15" y1="3" x2="15" y2="21"/>
      </svg>
    </button>
  </div>
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
  .btn-add {
    display: inline-flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-sm) var(--space-md);
    background: linear-gradient(135deg, var(--color-coral) 0%, #ef6c4a 100%);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    min-height: 44px;
    box-shadow: 0 4px 12px rgba(239, 108, 74, 0.3);
    transition: all var(--transition-fast);
  }

  .btn-add:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(239, 108, 74, 0.4);
  }

  .tabs-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-lg);
  }

  .tabs {
    display: flex;
    gap: var(--space-sm);
    background: var(--color-bg);
    padding: 4px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
    width: fit-content;
  }

  .tab {
    padding: var(--space-sm) var(--space-lg);
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: var(--font-size-sm);
    font-weight: 600;
    font-family: inherit;
    background: transparent;
    color: var(--color-text-secondary);
    transition: all var(--transition-fast);
    min-height: 40px;
  }

  .tab.active {
    background: var(--color-coral);
    color: white;
    box-shadow: 0 2px 8px rgba(239, 108, 74, 0.3);
  }

  .tab:not(.active):hover {
    background: var(--color-surface);
    color: var(--color-text);
  }

  .view-toggle {
    display: flex;
    gap: 2px;
    background: var(--color-bg);
    padding: 4px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 12px;
    border: none;
    background: transparent;
    border-radius: var(--radius-sm);
    cursor: pointer;
    color: var(--color-text-secondary);
    transition: all var(--transition-fast);
    min-height: 36px;
  }

  .toggle-btn.active {
    background: var(--color-coral);
    color: white;
    box-shadow: 0 2px 8px rgba(239, 108, 74, 0.3);
  }

  .toggle-btn:hover:not(.active) {
    background: var(--color-surface);
    color: var(--color-text);
  }

  .empty-state {
    text-align: center;
    padding: var(--space-2xl);
    background: var(--color-surface);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-xl);
    animation: fadeSlideIn 0.5s ease-out;
  }

  .empty-illustration {
    width: 80px;
    height: 80px;
    margin: 0 auto var(--space-md);
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(239, 108, 74, 0.15) 0%, rgba(239, 108, 74, 0.1) 100%);
    color: var(--color-coral);
    border-radius: var(--radius-lg);
  }

  .empty-state h3 {
    margin: 0 0 var(--space-xs);
    font-size: var(--font-size-lg);
  }

  .empty-state p {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    margin: 0 0 var(--space-lg);
  }

  .btn-gradient {
    display: inline-flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-sm) var(--space-lg);
    background: linear-gradient(135deg, var(--color-coral) 0%, #ef6c4a 100%);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    min-height: 44px;
    box-shadow: 0 4px 12px rgba(239, 108, 74, 0.3);
    transition: all var(--transition-fast);
  }

  .btn-gradient:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(239, 108, 74, 0.4);
  }

  .table-section {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    padding: var(--space-lg);
    animation: fadeSlideIn 0.4s ease-out;
  }

  .btn-add-new {
    display: inline-flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-sm) var(--space-md);
    background: linear-gradient(135deg, var(--color-coral) 0%, #ef6c4a 100%);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    min-height: 40px;
    box-shadow: 0 4px 12px rgba(239, 108, 74, 0.3);
    transition: all var(--transition-fast);
    margin-bottom: var(--space-md);
  }

  .btn-add-new:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(239, 108, 74, 0.4);
  }

  .table-container {
    overflow-x: auto;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--font-size-sm);
  }

  .data-table th {
    text-align: left;
    padding: var(--space-sm) var(--space-md);
    color: var(--color-text-secondary);
    font-weight: 600;
    border-bottom: 2px solid var(--color-border);
    white-space: nowrap;
  }

  .data-table td {
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid var(--color-border);
    vertical-align: middle;
  }

  .data-table tr:hover {
    background: var(--color-bg);
  }

  .text-right { text-align: right; }
  .text-center { text-align: center; }

  .borrower-cell {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-weight: 600;
  }

  .borrower-avatar {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(239, 108, 74, 0.15) 0%, rgba(239, 108, 74, 0.2) 100%);
    color: var(--color-coral);
    border-radius: var(--radius-md);
    font-weight: 700;
    font-size: var(--font-size-sm);
    flex-shrink: 0;
  }

  .amount-cell {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .badge {
    padding: 3px 12px;
    border-radius: 999px;
    font-size: var(--font-size-sm);
    font-weight: 600;
  }

  .badge.active {
    background: linear-gradient(135deg, #fef3c7, #fde68a);
    color: #92400e;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .badge.paid {
    background: linear-gradient(135deg, #d1fae5, #a7f3d0);
    color: #065f46;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .action-btns {
    display: flex;
    gap: var(--space-xs);
    justify-content: center;
  }

  .action-btn {
    padding: 4px 10px;
    border: none;
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
    min-height: 32px;
  }

  .action-btn.edit {
    background: var(--color-primary-light);
    color: var(--color-primary);
  }

  .action-btn.edit:hover {
    background: var(--color-primary);
    color: white;
  }

  .action-btn.delete {
    background: var(--color-expense-light);
    color: var(--color-expense);
  }

  .action-btn.delete:hover {
    background: var(--color-expense);
    color: white;
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
    border-color: var(--color-coral);
    background: rgba(239, 108, 74, 0.10);
  }

  .radio-option input {
    accent-color: var(--color-coral);
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
    background: var(--color-coral);
    color: white;
  }

  .btn-primary:hover {
    background: #ef6c4a;
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
    .tabs-row { flex-direction: column; align-items: stretch; gap: var(--space-sm); }
    .view-toggle { width: fit-content; }
    .data-table { display: block; overflow-x: auto; }
  }
</style>
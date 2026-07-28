<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { enhance } from '$app/forms';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import PageBackground from '$lib/components/PageBackground.svelte';
  import TransactionSummary from '$lib/components/TransactionSummary.svelte';
  import TransactionFilters from '$lib/components/TransactionFilters.svelte';
  import TransactionList from '$lib/components/TransactionList.svelte';
  import ExportDropdown from '$lib/components/ExportDropdown.svelte';
  import ModalDialog from '$lib/components/ModalDialog.svelte';
  import { showSuccess, showError } from '$lib/stores/toast.svelte';
  import { generateTransactionPdf } from '$lib/utils/pdf';

  let data = $derived($page.data as App.PageData);
  let deleteId = $state<number | null>(null);

  // ═════════════════════════════════════════════════════════════════
  // FILTER STATE — initialized from URL, synced back via $effect
  // ═════════════════════════════════════════════════════════════════

  let filters = $state({
    date: $page.url.searchParams.get('date') || '',
    category: $page.url.searchParams.get('category') || '',
    type: $page.url.searchParams.get('type') || '',
    customFrom: $page.url.searchParams.get('from') || '',
    customTo: $page.url.searchParams.get('to') || '',
  });

  // ─── Sync filters → URL (auto-navigates, triggers server load) ──

  $effect(() => {
    const params = new URLSearchParams();

    // Map our filter format to the server-expected URL params
    if (filters.type) params.set('type', filters.type);

    if (filters.category) {
      const cat = (data.categories ?? []).find((c) => c.name === filters.category);
      if (cat) params.set('category_id', String(cat.id));
    }

    if (filters.date) {
      const range = dateRangeFromFilter(filters.date, filters.customFrom, filters.customTo);
      if (range.from) params.set('date_from', range.from);
      if (range.to) params.set('date_to', range.to);
    }

    const newQs = params.toString();
    const currentQs = $page.url.search.replace(/^\?/, '');

    if (newQs !== currentQs) {
      goto(`/transactions${newQs ? '?' + newQs : ''}`, {
        keepFocus: true,
        noScroll: true,
      });
    }
  });

  // ─── Helpers —─────────────────────────────────────────────────────

  function dateRangeFromFilter(
    filter: string,
    customFrom?: string,
    customTo?: string
  ): { from: string; to: string } {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');

    switch (filter) {
      case 'this-week': {
        const day = now.getDay();
        const mon = new Date(now);
        mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
        const sun = new Date(mon);
        sun.setDate(mon.getDate() + 6);
        return {
          from: mon.toISOString().slice(0, 10),
          to: sun.toISOString().slice(0, 10),
        };
      }
      case 'this-month':
        return { from: `${y}-${m}-01`, to: `${y}-${m}-${d}` };
      case 'last-3-months': {
        const d3 = new Date(now);
        d3.setMonth(now.getMonth() - 3);
        return { from: d3.toISOString().slice(0, 10), to: `${y}-${m}-${d}` };
      }
      case 'custom':
        return { from: customFrom || '', to: customTo || '' };
      default:
        return { from: '', to: '' };
    }
  }

  // ─── Event handlers ───────────────────────────────────────────────

  function handleFilterChange(newFilters: {
    date: string;
    category: string;
    type: string;
    customFrom?: string;
    customTo?: string;
  }) {
    filters = {
      date: newFilters.date,
      category: newFilters.category,
      type: newFilters.type,
      customFrom: newFilters.customFrom || '',
      customTo: newFilters.customTo || '',
    };
  }

  function handleCardClick(type: string) {
    filters = { ...filters, type };
  }

  function goToPage(p: number) {
    const params = new URLSearchParams($page.url.searchParams);
    params.set('page', String(p));
    goto(`/transactions?${params.toString()}`, { keepFocus: true, noScroll: true });
  }

  // ─── Active type for summary cards ────────────────────────────────

  const activeType = $derived(filters.type);

  // ─── Transaction count info ───────────────────────────────────────

  const totalCount = $derived(data.total ?? 0);
  const showingCount = $derived(data.transactions?.length ?? 0);

  const filterSummary = $derived(
    [filters.type, filters.category, filters.date].filter(Boolean).join(', ')
  );

  async function handleExport(format: 'csv' | 'pdf') {
    const params = $page.url.searchParams.toString();

    if (format === 'csv') {
      window.location.href = `/api/transactions/export${params ? '?' + params : ''}`;
      return;
    }

    console.log('[Export] PDF requested');

    const pdfParams = new URLSearchParams(params);
    pdfParams.set('format', 'json');
    pdfParams.set('exportType', 'all');

    try {
      const response = await fetch(`/api/transactions/export?${pdfParams.toString()}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const json = await response.json();
      console.log('[Export] Data fetched:', json.summary, `(${json.transactions?.length || 0} transactions)`);

      if (!json.transactions || json.transactions.length === 0) {
        console.warn('[Export] No transactions to export');
        return;
      }

      const filterInfo: { type?: string; category?: string; dateFrom?: string; dateTo?: string } = {};
      if (filters.type) filterInfo.type = filters.type;
      if (filters.category) filterInfo.category = filters.category;
      if (filters.date) {
        const range = dateRangeFromFilter(filters.date, filters.customFrom, filters.customTo);
        if (range.from) filterInfo.dateFrom = range.from;
        if (range.to) filterInfo.dateTo = range.to;
      }

      const doc = await generateTransactionPdf(json.transactions, filterInfo, json.summary);
      doc.save(`transactions-${new Date().toISOString().split('T')[0]}.pdf`);
      console.log('[Export] PDF saved');
    } catch (error) {
      console.error('[Export] PDF generation failed:', error);
      showError('Failed to generate PDF');
    }
  }
</script>

<svelte:head>
  <title>Transactions — Finance Tracker</title>
</svelte:head>

<PageBackground />

<PageHeader title="Transactions">
  {#snippet action()}
    <a href="/transactions/new" class="btn-add">+ Add Transaction</a>
  {/snippet}
</PageHeader>

<!-- ═══ Filter pills ═══ -->
<TransactionFilters
  categories={data.categories ?? []}
  activeFilters={{
    date: filters.date,
    category: filters.category,
    type: filters.type,
  }}
  onFilterChange={handleFilterChange}
/>

<!-- ═══ Interactive summary cards ═══ -->
<TransactionSummary
  transactions={data.transactions ?? []}
  {activeType}
  onCardClick={handleCardClick}
/>

<!-- ═══ Result count + export ═══ -->
<div class="result-meta">
  <span class="result-count">
    showing {showingCount}{showingCount !== totalCount ? ` of ${totalCount}` : ''} transactions
  </span>
  <ExportDropdown
    totalFilteredCount={showingCount}
    filterSummary={filterSummary}
    onExport={handleExport}
  />
</div>

<!-- ═══ Transaction list ═══ -->
<TransactionList
  transactions={data.transactions ?? []}
  onEdit={(id) => goto(`/transactions/${id}/edit`)}
  onDelete={(id) => (deleteId = id)}
/>

<!-- ═══ Pagination ═══ -->
{#if (data.totalPages ?? 0) > 1}
  <div class="pagination">
    <button
      class="page-btn"
      disabled={data.page === 1}
      onclick={() => goToPage((data.page ?? 1) - 1)}
    >← Prev</button>
    <span class="page-info">Page {data.page} of {data.totalPages}</span>
    <button
      class="page-btn"
      disabled={data.page === data.totalPages}
      onclick={() => goToPage((data.page ?? 1) + 1)}
    >Next →</button>
  </div>
{/if}

<!-- ═══ Delete confirmation modal ═══ -->
{#if deleteId !== null}
  <ModalDialog open={deleteId !== null} onclose={() => (deleteId = null)} title="Delete Transaction">
    <p>Are you sure you want to delete this transaction? This action cannot be undone.</p>
    <form
      method="POST"
      action="?/delete"
      use:enhance={() => {
        return async ({
          result,
          update,
        }: {
          result: { type: string; data?: { error?: string } };
          update: () => Promise<void>;
        }) => {
          if (result.type === 'success') {
            deleteId = null;
            showSuccess('Transaction deleted successfully');
          } else if (result.type === 'failure') {
            showError(result.data?.error || 'Failed to delete transaction');
          }
          await update();
        };
      }}
    >
      <input type="hidden" name="id" value={deleteId} />
      <div class="modal-actions">
        <button type="submit" class="btn btn-danger">Delete</button>
        <button type="button" class="btn btn-secondary" onclick={() => (deleteId = null)}>Cancel</button>
      </div>
    </form>
  </ModalDialog>
{/if}

<style>
  /* ─── Add button ─── */
  .btn-add {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: var(--space-sm) var(--space-md);
    background: linear-gradient(135deg, var(--color-primary) 0%, #8b5cf6 100%);
    color: white;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: 600;
    text-decoration: none;
    min-height: 44px;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
    transition: all var(--transition-fast);
  }

  .btn-add:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
    text-decoration: none;
    color: white;
  }

  /* ─── Result count ─── */
  .result-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-md);
  }

  .result-count {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    font-weight: 500;
  }

  .btn-export {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: var(--space-sm) var(--space-md);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    min-height: 40px;
    transition: all var(--transition-fast);
    white-space: nowrap;
  }

  .btn-export:hover {
    background: var(--color-primary-light);
    border-color: var(--color-primary);
    color: var(--color-primary);
    text-decoration: none;
  }

  /* ─── Pagination ─── */
  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-md);
    margin-top: var(--space-lg);
  }

  .page-btn {
    padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    cursor: pointer;
    font-size: var(--font-size-sm);
    font-family: inherit;
    font-weight: 600;
    min-height: 44px;
    min-width: 80px;
    transition: all var(--transition-fast);
  }

  .page-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .page-btn:hover:not(:disabled) {
    background: var(--color-primary-light);
    border-color: var(--color-primary);
  }

  .page-info {
    font-size: var(--font-size-sm);
    font-weight: 600;
    padding: var(--space-xs) var(--space-md);
    background: var(--color-primary-light);
    color: var(--color-primary);
    border-radius: var(--radius-sm);
  }

  /* ─── Modal actions ─── */
  .modal-actions {
    display: flex;
    gap: var(--space-sm);
    margin-top: var(--space-md);
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

  /* ─── Responsive ─── */
  @media (max-width: 768px) {
    .pagination {
      flex-direction: column;
      gap: var(--space-sm);
    }

    .page-btn {
      width: 100%;
    }
  }
</style>

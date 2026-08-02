<script lang="ts">
  import { untrack } from 'svelte';
  import { page } from '$app/stores';
  import { goto, invalidateAll } from '$app/navigation';
  import { enhance } from '$app/forms';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import PageBackground from '$lib/components/PageBackground.svelte';
  import Button from '$lib/components/Button.svelte';
  import ConfettiBurst from '$lib/components/ConfettiBurst.svelte';
  import TransactionSummary from '$lib/components/TransactionSummary.svelte';
  import TransactionFilters from '$lib/components/TransactionFilters.svelte';
  import TransactionList from '$lib/components/TransactionList.svelte';
  import OverflowMenu from '$lib/components/OverflowMenu.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import SearchFilterPill from '$lib/components/SearchFilterPill.svelte';
  import ViewToggle from '$lib/components/ViewToggle.svelte';
  import ModalDialog from '$lib/components/ModalDialog.svelte';
  import SlideOver from '$lib/components/SlideOver.svelte';
  import ImportDropZone from '$lib/components/ImportDropZone.svelte';
  import ImportMapping from '$lib/components/ImportMapping.svelte';
  import ImportPreview from '$lib/components/ImportPreview.svelte';
  import { showSuccess, showError } from '$lib/stores/toast.svelte';
  import { generateTransactionPdf } from '$lib/utils/pdf';
  import { getCurrentMonth } from '$lib/utils/format';
  import {
    parseCSV,
    autoMap,
    buildMappedRows,
    validateAllRows,
    type ImportMappingConfig,
    type MappedTransaction,
  } from '$lib/utils/importValidation';

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
    search: $page.url.searchParams.get('search') || '',
  });

  // ─── Search input (debounced) + URL-synced ──────────────────────────

  let searchInput = $state(filters.search);
  let filtersOpen = $state(false);

  // ─── Filter control: SearchFilterPill owns the popover (desktop) and
  // the FiltersSheet bottom sheet (mobile) via its `open` binding. ──────

  // Sync the input from the URL on navigation (back/forward).
  // untrack the searchInput read so this effect depends only on the URL —
  // otherwise it re-runs on every keystroke and resets the input before the
  // debounced URL update lands, wiping what the user just typed.
  $effect(() => {
    const urlSearch = $page.url.searchParams.get('search') ?? '';
    untrack(() => {
      if (urlSearch !== searchInput) searchInput = urlSearch;
    });
  });

  // Debounce writing the typed value into the filter state
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const value = searchInput;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (filters.search !== value) filters.search = value;
    }, 300);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
    };
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

    if (filters.search) params.set('search', filters.search);

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
    const currentMonthStr = getCurrentMonth();
    const [y, m] = currentMonthStr.split('-').map(Number);
    const now = new Date();
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
        return { from: `${y}-${String(m).padStart(2, '0')}-01`, to: `${y}-${String(m).padStart(2, '0')}-${d}` };
      case 'today': {
        const today = `${y}-${String(m).padStart(2, '0')}-${d}`;
        return { from: today, to: today };
      }
      case 'this-year':
        return { from: `${y}-01-01`, to: `${y}-12-31` };
      case 'last-3-months': {
        const d3 = new Date(now);
        d3.setMonth(now.getMonth() - 3);
        return { from: d3.toISOString().slice(0, 10), to: `${y}-${String(m).padStart(2, '0')}-${d}` };
      }
      case 'custom':
        return { from: customFrom || '', to: customTo || '' };
      default:
        return { from: '', to: '' };
    }
  }

  // ═════════════════════════════════════════════════════════════════
  // IMPORT CSV STATE — SlideOver with wizard steps
  // ═════════════════════════════════════════════════════════════════

  let importSlideOpen = $state(false);
  let importStep = $state<'upload' | 'mapping' | 'preview' | 'done'>('upload');
  let importColumns = $state<string[]>([]);
  let importRawRows = $state<string[][]>([]);
  let importMapping = $state<Record<string, string>>({});
  let importConfig = $state<ImportMappingConfig>({
    dateFormat: 'YYYY-MM-DD',
    typeRule: 'sign',
  });
  let importMappedRows = $state<MappedTransaction[]>([]);
  let importValidation = $state({
    validRows: [] as MappedTransaction[],
    invalidRows: [] as { row: MappedTransaction; errors: string[]; warnings: string[] }[],
    unknownCategories: [] as string[],
  });
  let importResult = $state<{ imported?: number; total?: number; skippedDuplicates?: number; skippedInvalid?: number } | null>(null);
  let importError = $state('');
  let importSubmitting = $state(false);

  // ─── Handle file upload ───

  function handleFileUpload(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.headers.length < 2) {
        importError = 'CSV must have at least a header row and one data row';
        return;
      }
      importColumns = parsed.headers;
      importRawRows = parsed.rows;
      importMapping = autoMap(parsed.headers);
      importError = '';
      importStep = 'mapping';
      importSlideOpen = true;
    };
    reader.readAsText(file);
  }

  // ─── Handle mapping change ───

  function handleMappingChange(col: string, field: string) {
    importMapping = { ...importMapping, [col]: field };
  }

  // ─── Handle config change ───

  function handleConfigChange(key: keyof ImportMappingConfig, value: string) {
    importConfig = { ...importConfig, [key]: value };
  }

  // ─── Go to preview ───

  function goToPreview() {
    const categories = data.categories ?? [];
    // If no categories loaded, surface a clear state instead of silently
    // marking every row "Unknown category" against an empty allow-list.
    if (categories.length === 0) {
      importError = 'No categories loaded — add categories in /categories before importing, or reload the page.';
      return;
    }
    const built = buildMappedRows(importRawRows, importColumns, importMapping, importConfig);
    importValidation = validateAllRows(built, categories, importConfig);
    importMappedRows = built;
    importStep = 'preview';
  }

  // ─── Handle import form enhance ───

  function handleImportEnhance() {
    return async ({ result, update }: { result: { type: string; data?: Record<string, unknown> }; update: () => Promise<void> }) => {
      await update();
      if (result.type === 'success') {
        const d = result.data || {};
        importResult = {
          imported: d.imported as number,
          total: d.total as number,
          skippedDuplicates: d.skippedDuplicates as number,
          skippedInvalid: d.skippedInvalid as number,
        };
        importStep = 'done';
        importSubmitting = false;
        const count = d.imported as number || 0;
        if (count > 0) {
          showSuccess(`Imported ${count} transactions` + (d.skippedDuplicates ? ` · skipped ${d.skippedDuplicates} duplicates` : ''));
        } else {
          showError('No new transactions imported');
        }
      } else if (result.type === 'failure') {
        importSubmitting = false;
        const d = result.data as { error?: string; details?: string[]; skippedDuplicates?: number; skippedInvalid?: unknown[] } | undefined;
        importError = d?.error || 'Import failed';
        if (d?.details) {
          importError += ': ' + d.details.slice(0, 3).join('; ');
        }
      }
    };
  }

  // ─── Handle filter change ───

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
      search: filters.search,
    };
  }

  function handleCardClick(type: string) {
    filters = { ...filters, type };
  }

  function clearAllFilters() {
    filters = { date: '', category: '', type: '', customFrom: '', customTo: '', search: '' };
    searchInput = '';
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

  const activeFilterCount = $derived([filters.type, filters.category, filters.date].filter(Boolean).length);
  const hasActiveFilters = $derived(filters.type || filters.category || filters.date || filters.search);

  // ─── Context subline: month label + total filtered count ──────────

  const contextSubline = $derived.by(() => {
    const monthLabel = (() => {
      if (!filters.date || filters.date === 'this-month') {
        const [y, m] = getCurrentMonth().split('-').map(Number);
        return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1));
      }
      const range = dateRangeFromFilter(filters.date, filters.customFrom, filters.customTo);
      if (range.from) {
        const [y, m] = range.from.split('-').map(Number);
        const label = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1));
        if (range.to && range.from.slice(0, 7) === range.to.slice(0, 7)) return label;
        return `From ${label}`;
      }
      return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date());
    })();
    return `${monthLabel} · ${totalCount} transaction${totalCount !== 1 ? 's' : ''}`;
  });

  // ─── Lifted view toggle state ─────────────────────────────────────

  let showFlatView = $state(false);

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

  // ─── Duplicate a transaction ─────────────────────────────────────

  async function handleDuplicate(id: number) {
    const src =
      (data.allForBalance ?? []).find((t) => t.id === id) ??
      (data.transactions ?? []).find((t) => t.id === id);
    if (!src) return;

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: src.type,
          amount: src.amount,
          description: src.description,
          date: src.date,
          category_id: src.category_id,
        }),
      });
      if (!res.ok) throw new Error(((await res.json()).error) || 'Duplicate failed');
      showSuccess('Transaction duplicated');
      // Re-run the page's load in place so the new row appears immediately.
      // A `goto` to the identical URL is a no-op (SvelteKit won't re-fetch);
      // invalidateAll re-fetches while preserving the current filters.
      await invalidateAll();
    } catch (e) {
      showError((e as Error).message || 'Failed to duplicate transaction');
    }
  }
</script>

<svelte:head>
  <title>Transactions — Finance Tracker</title>
</svelte:head>

<PageBackground />

<PageHeader title="Transactions" flush>
  {#snippet subtitle()}
    <span class="context-subline">{contextSubline}</span>
  {/snippet}
  {#snippet action()}
    <span class="header-actions desktop-only">
      <OverflowMenu
        onImportCsv={() => (importSlideOpen = true)}
        onExportCsv={() => handleExport('csv')}
        onExportPdf={() => handleExport('pdf')}
      />
      <Button variant="primary" href="/transactions/new">
        <span class="btn-lead" aria-hidden="true">+</span>
        Add Transaction
      </Button>
    </span>
    <!-- Mobile: the SpeedDial FAB in the bottom nav is the Add CTA; the
         header keeps only the Import/Export overflow, always in thumb-reach. -->
    <span class="header-actions mobile-only">
      <OverflowMenu
        onImportCsv={() => (importSlideOpen = true)}
        onExportCsv={() => handleExport('csv')}
        onExportPdf={() => handleExport('pdf')}
      />
    </span>
  {/snippet}
</PageHeader>

<!-- ═══ Interactive summary cards ═══ -->
<TransactionSummary
  transactions={[...(data.allForBalance ?? [])].reverse()}
  {activeType}
  onCardClick={handleCardClick}
/>

<!-- ═══ Toolbar: unified search+filter pill (left) + view preference (right) ═══ -->
<div class="txn-toolbar">
  <div class="toolbar-left">
    <SearchFilterPill
      bind:value={searchInput}
      bind:open={filtersOpen}
      {activeFilterCount}
      placeholder="Search transactions"
      ariaLabel="Search transactions"
      filterAriaLabel="Filter transactions"
    >
      {#snippet panel(_mode, close)}
        <TransactionFilters
          mode="sheet"
          categories={data.categories ?? []}
          activeFilters={{
            date: filters.date,
            category: filters.category,
            type: filters.type,
          }}
          onFilterChange={handleFilterChange}
          onApply={close}
        />
      {/snippet}
    </SearchFilterPill>
  </div>
  <div class="toolbar-right">
    <ViewToggle {showFlatView} onChange={(flat) => showFlatView = flat} stretch />
  </div>
</div>

<!-- ═══ Transaction list (Bank Register) ═══ -->
<TransactionList
  transactions={data.transactions ?? []}
  allTransactionsForBalance={data.allForBalance ?? []}
  categories={data.categories ?? []}
  showRunningBalance={true}
  {showFlatView}
  onEdit={(id) => goto(`/transactions/${id}/edit`)}
  onDelete={(id) => (deleteId = id)}
  onDuplicate={handleDuplicate}
>
  {#snippet emptyState()}
    {#if hasActiveFilters}
      <EmptyState
        icon="🔍"
        title="No results"
        description="No transactions match your search or filters."
        actionLabel="Clear All Filters"
        onAction={clearAllFilters}
      />
    {:else}
      <EmptyState
        icon="💰"
        title="No transactions yet"
        description="Start by adding your first transaction or importing a CSV."
        actionLabel="Add Transaction"
        actionHref="/transactions/new"
        secondaryLabel="Import CSV"
        onSecondaryAction={() => (importSlideOpen = true)}
      />
    {/if}
  {/snippet}
</TransactionList>

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

<!-- ═══ Mobile filters bottom sheet ═══
     Rendered by SearchFilterPill (mobile) — no page-level sheet. -->

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
        <Button variant="danger" type="submit">Delete</Button>
        <Button variant="ghost" type="button" onclick={() => (deleteId = null)}>Cancel</Button>
      </div>
    </form>
  </ModalDialog>
{/if}

<!-- ═══ Import CSV SlideOver ═══ -->
{#if importSlideOpen}
<SlideOver isOpen={importSlideOpen} onClose={() => (importSlideOpen = false)} title="Import CSV">
	{#snippet children()}
		{#if importStep === 'upload'}
			<ImportDropZone
				onFiles={handleFileUpload}
				onDownloadSample={() => window.open('/sample-transactions.csv', '_blank')}
			/>
			{#if importError}
				<div class="import-error">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/>
					</svg>
					{importError}
				</div>
			{/if}
		{/if}

		{#if importStep === 'mapping'}
			<div class="step-indicator">
				<span class="step-dot active"></span>
				<span class="step-dot active"></span>
				<span class="step-dot"></span>
				<span class="step-label">Step 2 of 3 — Map your columns</span>
			</div>
			<ImportMapping
				columns={importColumns}
				mapping={importMapping}
				onChange={handleMappingChange}
				config={importConfig}
				onConfigChange={handleConfigChange}
			/>
			{#if importError}
				<div class="import-error">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/>
					</svg>
					{importError}
				</div>
			{/if}
			<div class="step-actions">
				<Button
					variant="primary"
					onclick={goToPreview}
					disabled={!Object.values(importMapping).includes('amount') || !Object.values(importMapping).includes('date')}
					type="button"
				>
					Preview Transactions →
				</Button>
				<Button variant="ghost" onclick={() => (importStep = 'upload')} type="button">← Back</Button>
			</div>
		{/if}

		{#if importStep === 'preview'}
			<div class="step-indicator">
				<span class="step-dot active"></span>
				<span class="step-dot active"></span>
				<span class="step-dot active"></span>
				<span class="step-label">Step 3 of 3 — Review & Confirm</span>
			</div>
			<form method="POST" action="?/import" use:enhance={handleImportEnhance}>
				<input type="hidden" name="rows" value={JSON.stringify(importValidation.validRows)} />
				<input type="hidden" name="config" value={JSON.stringify(importConfig)} />
				<ImportPreview
					rows={importMappedRows}
					validation={importValidation}
					onConfirm={() => { importSubmitting = true; }}
					onCancel={() => (importStep = 'mapping')}
				/>
			</form>
			{#if importError}
				<div class="import-error">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/>
					</svg>
					{importError}
				</div>
			{/if}
		{/if}

		{#if importStep === 'done' && importResult}
			<div class="import-done">
				<ConfettiBurst active={(importResult.imported ?? 0) > 0} />
				<div class="done-icon">
					<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
						<polyline points="22 4 12 14.01 9 11.01"/>
					</svg>
				</div>
				<h2 class="done-title">Import Complete</h2>
				<p class="done-desc">
					Successfully imported <strong>{importResult.imported}</strong> of <strong>{importResult.total}</strong> transactions
					{#if importResult.skippedDuplicates && importResult.skippedDuplicates > 0}
						· skipped <strong>{importResult.skippedDuplicates}</strong> duplicates
					{/if}
					{#if importResult.skippedInvalid && importResult.skippedInvalid > 0}
						· skipped <strong>{importResult.skippedInvalid}</strong> invalid
					{/if}
				</p>
				<div class="done-actions">
					<Button variant="primary" onclick={() => { importSlideOpen = false; importStep = 'upload'; importError = ''; importResult = null; }} type="button">
						Done
					</Button>
					<Button variant="ghost" onclick={() => { importStep = 'upload'; importError = ''; importResult = null; }} type="button">
						Import Another File
					</Button>
							</div>
				</div>
			{/if}
	{/snippet}
</SlideOver>
{/if}

<style>
  /* ─── 8-point section rhythm: Header → Toolbar ─── */
  /* Raise the header's stacking context so the OverflowMenu dropdown
     (trapped inside the header's backdrop-filter context) paints above
     the toolbar and summary cards that follow it in the DOM.
     The header→content gap is owned by PageHeader's scoped margin; we
     normalize it per breakpoint lower down. */
  :global(.page-header) {
    position: relative;
    z-index: 30;
  }

  /* ─── Primary button lead glyph ─── */
  .btn-lead {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    font-weight: var(--font-weight-extrabold);
  }

  /* ─── Context subline ─── */
  .context-subline {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    font-size: var(--font-size-xs);
    letter-spacing: 0.02em;
  }

  /* ─── Toolbar ─── */
  /* Working controls for the list: sits below the KPI cards and hugs the
     register beneath it (tight bottom gap) so it reads as one unit.
     The grid mirrors .summary-cards' template at every breakpoint so the
     search pill (toolbar-left) is exactly as wide as the first KPI card,
     while the view toggle (toolbar-right) floats to the right edge of the
     register — no max-width cap, no dead whitespace. */
  .txn-toolbar {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-md);
    align-items: center;
    margin-bottom: var(--space-md);
  }

  .toolbar-left {
    grid-column: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  /* Header actions: overflow + add transaction, right side of header */
  .header-actions {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  /* ─── Search + Filter pill (`.search-filter-pill`) now lives in the
     shared SearchFilterPill component; this page only sizes its host
     column. ─── */

  .toolbar-right {
    grid-column: 3;
    justify-self: end;
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  /* ─── Mobile / Desktop visibility ─── */
  .desktop-only {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .mobile-only {
    display: none;
  }

  /* Mirror the summary-cards grid at the tablet breakpoint: 2 columns,
     toolbar-right pinned to the right edge of the second. */
  @media (min-width: 769px) and (max-width: 1024px) {
    .txn-toolbar {
      grid-template-columns: repeat(2, 1fr);
    }

    .toolbar-right {
      grid-column: 2;
    }
  }

  @media (max-width: 768px) {
    .desktop-only {
      display: none !important;
    }

    .mobile-only {
      display: flex;
      align-items: center;
    }

    /* One 44px search+filter pill; the view toggle follows on a slim row.
       The toggle row sits flush against the register below so it reads as
       the list's own header control. */
    .txn-toolbar {
      grid-template-columns: 1fr;
      gap: var(--space-sm);
      margin-bottom: var(--space-xs);
    }

    .toolbar-left {
      grid-column: 1;
      width: 100%;
    }

    .toolbar-right {
      grid-column: 1;
      justify-self: stretch;
      justify-content: flex-start;
    }
  }

  /* ≤480px: the transaction rows become inset cards (8px gutters). Pull the
     summary rail and toolbar in to share the same starting column, so
     summary → search → list all read on one vertical rhythm. */
  @media (max-width: 480px) {
    :global(.search-filter-pill) {
      margin: 0 var(--space-sm);
    }

    .toolbar-right {
      margin: 0 var(--space-sm);
    }

    :global(main.main-content .summary-cards) {
      margin: 0 var(--space-sm) var(--space-md);
    }
  }

  /* ─── Mobile header compression (page-scoped; PageHeader untouched) ───
     PageHeader's scoped rule owns the shared header look; these overrides
     only tighten this page's header on small screens so the register starts
     higher. Selectors are anchored to `main.main-content` (0-2-1) so they
     beat the component's scoped rule (0-2-0) regardless of style-injection
     order. The context subline moves inline with the title (compact app-bar
     read) and truncates on narrow screens. */
  @media (max-width: 768px) {
    :global(main.main-content .page-header) {
      padding: 6px 12px;
      margin-bottom: var(--space-sm);
    }

    :global(main.main-content .page-header .page-title-group) {
      flex-direction: row;
      align-items: baseline;
      gap: 6px;
      flex: 1;
      min-width: 0;
    }

    :global(main.main-content .page-header .page-title) {
      flex-shrink: 0;
    }

    :global(main.main-content .page-header .page-subtitle) {
      font-size: var(--font-size-xs);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }
  }

  /* ─── Compact summary strip (mobile only; TransactionSummary untouched) ───
     Same `main.main-content` anchoring as the header override so these win
     against TransactionSummary's scoped rules regardless of injection order. */
  @media (max-width: 768px) {
    :global(main.main-content .summary-cards) {
      margin-bottom: var(--space-md);
    }

    :global(main.main-content .summary-cards .card) {
      padding: var(--space-sm) var(--space-md);
    }

    :global(main.main-content .summary-cards .card-icon) {
      width: 24px;
      height: 24px;
    }

    :global(main.main-content .summary-cards .card-value) {
      font-size: 18px;
    }

    :global(main.main-content .summary-cards .hero-value) {
      font-size: 20px;
    }

    :global(main.main-content .summary-cards .card-trend) {
      font-size: 9px;
      padding: 0 6px;
      margin-top: 1px;
    }
  }

  /* ─── Pagination ─── */
  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-md);
    margin-top: var(--space-xl);
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

  .modal-actions :global(.btn) {
    flex: 1;
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

  /* ─── Import SlideOver styles ─── */
  .step-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: var(--space-md);
  }

  .step-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-hairline);
  }

  .step-dot.active {
    background: var(--color-teal);
    box-shadow: var(--glow-card);
  }

  .step-label {
    margin-left: auto;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }

  .step-actions {
    display: flex;
    gap: var(--space-sm);
    margin-top: var(--space-lg);
  }

  .import-error {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin-top: var(--space-md);
    padding: var(--space-sm) var(--space-md);
    background: rgba(239, 108, 74, 0.08);
    border: 1px solid rgba(239, 108, 74, 0.2);
    border-radius: var(--radius-md);
    color: var(--color-coral);
    font-size: var(--font-size-sm);
    font-weight: 500;
  }

  .import-done {
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-3xl) var(--space-xl);
    text-align: center;
    background: var(--color-surface);
    border: 1px solid var(--color-hairline);
    border-left: 4px solid var(--color-teal);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-card);
    animation: bounce-in 500ms var(--bounce) both;
  }

  .done-icon {
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-teal-bg);
    color: var(--color-teal);
    border-radius: var(--radius-lg);
    margin-bottom: var(--space-lg);
    box-shadow: var(--glow-card);
    animation: glow-pulse 2s ease-in-out infinite;
  }

  .done-title {
    font-family: var(--font-display);
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-extrabold);
    color: var(--color-ink);
    margin: 0 0 var(--space-sm);
  }

  .done-desc {
    font-size: var(--font-size-base);
    color: var(--color-text-muted);
    margin: 0 0 var(--space-lg);
  }

  .done-desc strong {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    color: var(--color-ink);
  }

  .done-actions {
    display: flex;
    gap: var(--space-md);
  }

  .done-actions :global(.btn) {
    flex: 1;
  }

  @media (max-width: 640px) {
    .done-actions {
      flex-direction: column;
      width: 100%;
    }

    .step-actions {
      flex-direction: column;
    }
  }
</style>

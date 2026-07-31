<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { enhance } from '$app/forms';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import PageBackground from '$lib/components/PageBackground.svelte';
  import Button from '$lib/components/Button.svelte';
  import TransactionSummary from '$lib/components/TransactionSummary.svelte';
  import TransactionFilters from '$lib/components/TransactionFilters.svelte';
  import TransactionList from '$lib/components/TransactionList.svelte';
  import ExportDropdown from '$lib/components/ExportDropdown.svelte';
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

  // Confetti pieces for the earned success moment — fired only when N>0 rows
  // were actually inserted. Deterministic layout, brand palette, CSS keyframes.
  const CONFETTI_COLORS = ['var(--color-teal)', 'var(--color-gold)', 'var(--color-coral)', 'var(--color-sky)'];
  const confettiPieces = $derived(
    importResult && (importResult.imported ?? 0) > 0
      ? Array.from({ length: 28 }, (_, i) => ({
          left: (i * 37 + 13) % 100,
          delay: (i % 10) * 0.06,
          duration: 0.9 + (i % 5) * 0.18,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          size: 6 + (i % 4) * 3,
          rot: (i % 360) * 2,
        }))
      : []
  );

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
    <div class="header-actions">
      <Button variant="primary" href="/transactions/new">
        <span class="btn-lead" aria-hidden="true">+</span>
        Add Transaction
      </Button>
      <Button variant="ghost" onclick={() => (importSlideOpen = true)}>
        <svg class="btn-lead" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Import CSV
      </Button>
    </div>
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

<!-- ═══ Transaction list (Bank Register) ═══ -->
<TransactionList
  transactions={data.transactions ?? []}
  allTransactionsForBalance={data.allForBalance ?? []}
  categories={data.categories ?? []}
  showRunningBalance={true}
  showClearedColumn={true}
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
				<button
					class="btn-next"
					onclick={goToPreview}
					disabled={!Object.values(importMapping).includes('amount') || !Object.values(importMapping).includes('date')}
					type="button"
				>
					Preview Transactions →
				</button>
				<button class="btn-back" onclick={() => (importStep = 'upload')} type="button">← Back</button>
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
				{#if confettiPieces.length > 0}
					<div class="confetti" aria-hidden="true">
						{#each confettiPieces as piece, i}
							<span
								class="confetti-piece"
								style="left: {piece.left}%; width: {piece.size}px; height: {piece.size}px; background: {piece.color}; animation-delay: {piece.delay}s; animation-duration: {piece.duration}s; transform: rotate({piece.rot}deg);"
							></span>
						{/each}
					</div>
				{/if}
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
					<button class="btn-primary" onclick={() => { importSlideOpen = false; importStep = 'upload'; importError = ''; importResult = null; }} type="button">
						Done
					</button>
					<button class="btn-secondary" onclick={() => { importStep = 'upload'; importError = ''; importResult = null; }} type="button">
						Import Another File
					</button>
							</div>
				</div>
			{/if}
	{/snippet}
</SlideOver>
{/if}

<style>
  /* ─── Header button pair (primary + ghost via Button component) ─── */
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

  .btn-next {
    flex: 1;
    padding: var(--space-sm) var(--space-lg);
    background: linear-gradient(135deg, var(--color-gold), var(--color-gold-light));
    color: var(--color-ink);
    border: none;
    border-radius: var(--radius-pill);
    font-family: var(--font-display);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-bold);
    cursor: pointer;
    min-height: 48px;
    box-shadow: var(--glow-gold);
    transition: all 200ms var(--bounce);
  }

  .btn-next:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 24px rgba(255, 210, 63, 0.55);
  }

  .btn-next:active:not(:disabled) {
    transform: scale(0.97);
  }

  .btn-next:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
  }

  .btn-back {
    padding: var(--space-sm) var(--space-xl);
    background: var(--color-bg);
    color: var(--color-text-muted);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-pill);
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    min-height: 48px;
    transition: all 150ms var(--ease);
  }

  .btn-back:hover {
    background: var(--color-teal-bg);
    border-color: var(--color-teal);
    color: var(--color-teal);
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

  .confetti {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
    border-radius: inherit;
  }

  .confetti-piece {
    position: absolute;
    top: -12px;
    border-radius: 2px;
    opacity: 0;
    animation: confetti-fall 1.2s var(--ease) forwards;
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

  .btn-primary {
    display: inline-flex;
    align-items: center;
    padding: var(--space-sm) var(--space-xl);
    background: linear-gradient(135deg, var(--color-gold), var(--color-gold-light));
    color: var(--color-ink);
    border: none;
    border-radius: var(--radius-pill);
    font-family: var(--font-display);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-bold);
    cursor: pointer;
    text-decoration: none;
    min-height: 48px;
    box-shadow: var(--glow-gold);
    transition: all 200ms var(--bounce);
  }

  .btn-primary:hover {
    transform: translateY(-1px);
    text-decoration: none;
    color: var(--color-ink);
  }

  .btn-secondary {
    padding: var(--space-sm) var(--space-xl);
    background: var(--color-bg);
    color: var(--color-text-muted);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-pill);
    font-family: var(--font-body);
    font-size: var(--font-size-base);
    font-weight: 600;
    cursor: pointer;
    min-height: 48px;
    transition: all 150ms var(--ease);
  }

  .btn-secondary:hover {
    background: var(--color-teal-bg);
    border-color: var(--color-teal);
    color: var(--color-teal);
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

<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/stores';
	import { goto, invalidateAll } from '$app/navigation';
	import { enhance } from '$app/forms';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import PageBackground from '$lib/components/PageBackground.svelte';
	import Button from '$lib/components/Button.svelte';
	import TransactionSummary from '$lib/components/TransactionSummary.svelte';
	import TransactionFilters from '$lib/components/TransactionFilters.svelte';
	import TransactionList from '$lib/components/TransactionList.svelte';
	import OverflowMenu from '$lib/components/OverflowMenu.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import SearchFilterPill from '$lib/components/SearchFilterPill.svelte';
	import ViewToggle from '$lib/components/ViewToggle.svelte';
	import ModalDialog from '$lib/components/ModalDialog.svelte';
	import ImportWizard from '$lib/components/ImportWizard.svelte';
	import { showSuccess, showError } from '$lib/stores/toast.svelte';
	import { generateTransactionPdf } from '$lib/utils/pdf';
	import { getCurrentMonth } from '$lib/utils/format';
	import {
		buildMappedRows,
		validateAllRows,
		type ImportMappingConfig,
		type MappedTransaction,
		type ImportPreviewColumn,
		type ImportValidationResult,
		DEFAULT_IMPORT_FIELDS,
	} from '$lib/utils/importValidation';
	import type { Category } from '$lib/types';

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

	// ─── Restore category filter from a `category_id` deep-link (refresh,
	// back/forward, or shared URL) once categories are available. Declared
	// BEFORE the filter-sync effect so the filter is restored before the
	// query-string comparison runs. `lastHydratedCatId` guards against
	// re-hydrating a category the user just cleared. ─────────────────

	let lastHydratedCatId = '';
	$effect(() => {
		const urlCatId = $page.url.searchParams.get('category_id') || '';
		if (!urlCatId) {
			lastHydratedCatId = '';
			return;
		}
		if (urlCatId === lastHydratedCatId) return;
		const cat = (data.categories ?? []).find((c) => String(c.id) === urlCatId);
		if (cat) {
			filters.category = cat.name;
			lastHydratedCatId = urlCatId;
		}
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

		// Compare only the filter part of the URL. Ignore `page` so pagination
		// navigations (goToPage) are not overwritten back to page 1; genuine
		// filter changes still drop `page`, resetting to page 1 as intended.
		const currentFilterQs = (() => {
			const p = new URLSearchParams($page.url.searchParams);
			p.delete('page');
			return p.toString();
		})();

		if (newQs !== currentFilterQs) {
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

	// ─── Transaction type for summary cards ────────────────────────────

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
			await invalidateAll();
		} catch (e) {
			showError((e as Error).message || 'Failed to duplicate transaction');
		}
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

	// ─── Pagination: keep the viewport in place across navigations ───
	// `noScroll: true` stops SvelteKit resetting to the top, but the browser
	// still re-clamps scroll while the new page renders (height changes on the
	// last page, scroll anchoring) and SvelteKit re-asserts whatever position
	// the browser ends up with. Measuring the pager's rect *after* the render
	// races with that, so instead we capture the exact scrollY *before*
	// navigating, await the navigation to fully commit, then re-apply that
	// position once layout has settled. rAF runs before paint, so the clamped
	// intermediate position is never shown, and `behavior: 'auto'` overrides
	// the global `scroll-behavior: smooth` so the restore is an instant snap.
	async function goToPage(p: number) {
		const y = window.scrollY;
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', String(p));
		try {
			await goto(`/transactions?${params.toString()}`, { keepFocus: true, noScroll: true });
		} catch {
			return; // superseded by a newer navigation — leave scroll alone
		}
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				window.scrollTo({ top: y, behavior: 'auto' });
			});
		});
	}

	// ─── Import Wizard props ──────────────────────────────────────────
	// Preview columns for ImportPreview
	const previewColumns = $derived<ImportPreviewColumn[]>([
		{ header: 'Status', key: '_status', kind: 'status' },
		{ header: 'Date', key: 'date', kind: 'date' },
		{ header: 'Description', key: 'description', kind: 'text', cls: 'cell-desc' },
		{ header: 'Category', key: 'category_name', kind: 'text', cls: 'cell-cat' },
		{ header: 'Type', key: 'type', kind: 'type' },
		{ header: 'Amount', key: 'amount', kind: 'amount', align: 'right' },
	]);

	// ImportWizard build/validate functions
	function buildRows(rawRows: string[][], headers: string[], mapping: Record<string, string>, config: ImportMappingConfig) {
		return buildMappedRows(rawRows, headers, mapping, config);
	}

	function validateRows(rows: MappedTransaction[], deps: Record<string, unknown>, config: ImportMappingConfig) {
		return validateAllRows(rows, deps.categories as Category[], config);
	}

	// Import wizard deps
	const importDeps = $derived({ categories: data.categories ?? [] });

	let importWizardOpen = $state(false);

	// ─── Pagination helpers ─────────────────────────────────────────────

	const pageItems = $derived((currentPage: number, totalPages: number): (number | '…')[] => {
		const pages: (number | '…')[] = [];
		const show = 3; // show current ± 2
		const start = Math.max(1, currentPage - show);
		const end = Math.min(totalPages, currentPage + show);

		if (start > 1) {
			pages.push(1);
			if (start > 2) pages.push('…');
		}

		for (let i = start; i <= end; i++) {
			pages.push(i);
		}

		if (end < totalPages) {
			if (end < totalPages - 1) pages.push('…');
			pages.push(totalPages);
		}

		return pages;
	});

	const countLabel = $derived(() => {
		const page = data.page ?? 1;
		const limit = data.limit ?? 20;
		const total = data.total ?? 0;
		const start = (page - 1) * limit + 1;
		const end = Math.min(page * limit, total);
		if (total === 0) return 'No transactions';
		return `Showing ${start}–${end} of ${total}`;
	});
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
				onImportCsv={() => (importWizardOpen = true)}
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
				onImportCsv={() => (importWizardOpen = true)}
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
				secondaryLabel="Import"
				onSecondaryAction={() => (importWizardOpen = true)}
			/>
		{/if}
	{/snippet}
</TransactionList>

<!-- ═══ Pagination (ledger pager) ═══ -->
{#if (data.totalPages ?? 0) > 1}
	<nav class="pager" aria-label="Pagination">
		<button
			class="pager-btn"
			disabled={(data.page ?? 1) === 1}
			onclick={() => goToPage((data.page ?? 1) - 1)}
			aria-label="Previous page"
		>
			<svg class="pager-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
			<span class="pager-word">Prev</span>
		</button>

		<ol class="pager-pages">
			{#each pageItems(data.page ?? 1, data.totalPages ?? 1) as item, i (i)}
				{#if item === '…'}
					<li class="pager-gap" aria-hidden="true">…</li>
				{:else}
					<li>
						<button
							class="pager-num"
							class:current={item === (data.page ?? 1)}
							onclick={() => goToPage(item)}
							aria-label={`Page ${item}`}
							aria-current={item === (data.page ?? 1) ? 'page' : undefined}
						>{item}</button>
					</li>
				{/if}
			{/each}
		</ol>

		<button
			class="pager-btn"
			disabled={(data.page ?? 1) === (data.totalPages ?? 1)}
			onclick={() => goToPage((data.page ?? 1) + 1)}
			aria-label="Next page"
		>
			<span class="pager-word">Next</span>
			<svg class="pager-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
		</button>
	</nav>
	<p class="pager-count">{countLabel}</p>
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

<!-- ═══ Import Wizard Modal ═══ -->
<ImportWizard
	open={importWizardOpen}
	onClose={() => (importWizardOpen = false)}
	fields={DEFAULT_IMPORT_FIELDS}
	columns={previewColumns}
	buildRows={buildRows as unknown as (rawRows: string[][], headers: string[], mapping: Record<string, string>, config: ImportMappingConfig) => Record<string, unknown>[]}
	validateRows={validateRows as unknown as (rows: Record<string, unknown>[], deps: Record<string, unknown>, config: ImportMappingConfig) => ImportValidationResult<Record<string, unknown>>}
	deps={importDeps}
	title="Import Transactions"
	noun="transactions"
	sampleHref="/sample-transactions.csv"
	sampleFilename="sample-transactions.csv"
	templateHref="/templates/transactions.xlsx"
	templateFilename="transactions-import-template.xlsx"
/>

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

	/* ─── Pagination (ledger pager) ───
	   Number track in the ledger mono face; the current page is a solid teal
	   pill with a gold "you are here" tick — the same teal/gold pairing as the
	   document header band. */
	.pager {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		margin-top: var(--space-xl);
		flex-wrap: wrap;
	}

	.pager-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 44px;
		padding: 0 var(--space-md);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		color: var(--color-text-muted);
		font-family: var(--font-body);
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-semibold);
		cursor: pointer;
		transition: border-color var(--transition-fast), background var(--transition-fast), color var(--transition-fast), box-shadow var(--transition-fast), transform var(--transition-fast);
	}

	.pager-btn:hover:not(:disabled) {
		color: var(--color-teal);
		border-color: var(--color-teal);
		background: var(--color-teal-bg);
		box-shadow: var(--glow-card);
	}

	.pager-btn:active:not(:disabled) {
		transform: translateY(1px);
	}

	.pager-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.pager-btn:focus-visible {
		outline: 2px solid var(--color-teal);
		outline-offset: 2px;
	}

	.pager-icon {
		flex-shrink: 0;
	}

	.pager-pages {
		display: flex;
		align-items: center;
		gap: 4px;
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.pager-pages li {
		display: inline-flex;
	}

	.pager-num {
		min-width: 40px;
		height: 44px;
		padding: 0 6px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-text-muted);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-semibold);
		cursor: pointer;
		transition: border-color var(--transition-fast), background var(--transition-fast), color var(--transition-fast), box-shadow var(--transition-fast);
		position: relative;
	}

	.pager-num:hover:not(.current) {
		color: var(--color-teal);
		background: var(--color-teal-bg);
		border-color: var(--color-hairline);
	}

	.pager-num:focus-visible {
		outline: 2px solid var(--color-teal);
		outline-offset: 2px;
	}

	.pager-num.current {
		background: var(--color-teal);
		border-color: var(--color-teal);
		color: var(--color-ink-inverse);
		box-shadow: var(--glow-card);
	}

	.pager-num.current::after {
		content: '';
		position: absolute;
		left: 50%;
		bottom: 3px;
		transform: translateX(-50%);
		width: 14px;
		height: 3px;
		border-radius: var(--radius-pill);
		background: var(--color-gold);
	}

	.pager-gap {
		padding: 0 4px;
		color: var(--color-text-muted);
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
		user-select: none;
	}

	.pager-count {
		margin: var(--space-sm) 0 0;
		text-align: center;
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		letter-spacing: 0.02em;
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
		.pager {
			gap: var(--space-xs);
		}

		.pager-btn {
			min-width: 44px;
			justify-content: center;
			padding: 0 var(--space-sm);
		}

		.pager-word {
			display: none;
		}

		.pager-pages {
			flex-wrap: wrap;
			justify-content: center;
		}

		.pager-num {
			min-width: 36px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.pager-btn,
		.pager-num {
			transition: none;
		}

		.pager-btn:active:not(:disabled) {
			transform: none;
		}
	}
</style>
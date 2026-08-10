<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/stores';
	import { goto, invalidateAll } from '$app/navigation';
	import { enhance } from '$app/forms';
	import PageHeader from '$lib/client/components/PageHeader.svelte';
	import PageBackground from '$lib/client/components/PageBackground.svelte';
	import Button from '$lib/client/components/Button.svelte';
	import TransactionSummary from '$lib/client/components/TransactionSummary.svelte';
	import TransactionFilterPanel from '$lib/client/components/TransactionFilterPanel.svelte';
	import TransactionFilterToolbar from '$lib/client/components/TransactionFilterToolbar.svelte';
	import TransactionList from '$lib/client/components/TransactionList.svelte';
	import OverflowMenu from '$lib/client/components/OverflowMenu.svelte';
	import EmptyState from '$lib/client/components/EmptyState.svelte';
	import SearchFilterPill from '$lib/client/components/SearchFilterPill.svelte';
	import ViewToggle from '$lib/client/components/ViewToggle.svelte';
	import CountChip from '$lib/client/components/CountChip.svelte';
	import ModalDialog from '$lib/client/components/ModalDialog.svelte';
	import SlideOver from '$lib/client/components/SlideOver.svelte';
	import TransactionForm from '$lib/client/components/TransactionForm.svelte';
	import RecurringForm from '$lib/client/components/RecurringForm.svelte';
	import ImportWizard from '$lib/client/components/ImportWizard.svelte';
	import { showSuccess, showError } from '$lib/client/stores/toast.svelte';
	import { generateTransactionPdf } from '$lib/client/utils/pdf';
	import { formatCurrency, formatDate } from '$lib/client/utils/format';
import { getCurrentMonth, getToday } from '$lib/shared/utils/format';
	import { calculateNextRun } from '$lib/shared/utils/recurring';
	import {
		buildMappedRows,
		validateAllRows,
		type ImportMappingConfig,
		type MappedTransaction,
		type ImportPreviewColumn,
		type ImportValidationResult,
		DEFAULT_IMPORT_FIELDS,
	} from '$lib/shared/utils/importValidation';
	import type { Category, Transaction, RecurringFormInitial } from '$lib/types';

	let data = $derived($page.data as App.PageData);
	let deleteTarget = $state<number | number[] | null>(null);

	// Bulk selection (Selection Mode) — entered via the header overflow menu.
	// Selection is always page-scoped; clearing happens on page/filter change.
	let selectionMode = $state(false);
	let selectedIds = $state(new Set<number>());

	// Transaction Add/Edit SlideOver Drawer state
	let isFormOpen = $state(false);
	let editingTransaction = $state<Transaction | null>(null);

	const spendingMap = $derived.by(() => {
		const map: Record<number, number> = {};
		const txns = data.allForBalance ?? data.transactions ?? [];
		for (const t of txns) {
			if (!map[t.category_id]) map[t.category_id] = 0;
			map[t.category_id] += Number(t.amount);
		}
		return map;
	});

	const categoryTxnCounts = $derived.by(() => {
		const map: Record<number, number> = {};
		const txns = data.allForBalance ?? data.transactions ?? [];
		for (const t of txns) {
			if (!map[t.category_id]) map[t.category_id] = 0;
			map[t.category_id] += 1;
		}
		return map;
	});

	function openAddForm() {
		editingTransaction = null;
		isFormOpen = true;
	}

	function openEditForm(txn: Transaction) {
		editingTransaction = txn;
		isFormOpen = true;
	}

	function closeForm() {
		isFormOpen = false;
		editingTransaction = null;
	}

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
	// Mobile only: SearchFilterPill owns the FiltersSheet bottom sheet via its
	// `open` binding; the sheet's panel is TransactionFilterPanel (an in-sheet
	// accordion, matching the borrowed/lending sheet). Desktop uses the
	// unified TransactionFilterToolbar dock (self-contained). ──
	let mobileFiltersOpen = $state(false);

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

	async function handleExport(format: 'csv' | 'pdf', ids?: number[]) {
		const params = new URLSearchParams($page.url.searchParams);
		if (ids && ids.length > 0) params.set('ids', ids.join(','));

		if (format === 'csv') {
			window.location.href = `/api/transactions/export?${params.toString()}`;
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

	// ─── Create recurring schedule from a transaction ────────────────────
	// Kebab item "Create recurring schedule" opens the shared RecurringForm
	// pre-filled from this transaction. The original transaction is untouched —
	// we only INSERT a new recurring_transactions row. See
	// plans/make-transaction-recurring.md for the full semantics.

	let makeRecurringTxn = $state<Transaction | null>(null);
	let formDirty = $state(false);
	let discardOpen = $state(false);

	// Pre-fill seed: type/amount/description/category from the transaction;
	// monthly by default. start_date = max(today, txn.date) so the scheduler
	// never backfills an old schedule (old transactions clamp to today).
	const makeRecurringInitial = $derived.by<RecurringFormInitial | null>(() => {
		const txn = makeRecurringTxn;
		if (!txn) return null;
		const today = getToday();
		return {
			type: txn.type,
			amount: Math.abs(txn.amount),
			description: txn.description,
			category_id: txn.category_id,
			frequency: 'monthly',
			interval: 1,
			start_date: txn.date > today ? txn.date : today,
			end_date: '',
			active: true,
		};
	});

	// The scheduler's first generated transaction = start_date + 1 interval.
	const makeRecurringNextRun = $derived(
		makeRecurringInitial
			? calculateNextRun(
					makeRecurringInitial.start_date,
					makeRecurringInitial.frequency,
					makeRecurringInitial.interval,
					null,
					null,
					null,
					makeRecurringInitial.start_date
				)
			: ''
	);

	function openMakeRecurring(txn: Transaction) {
		makeRecurringTxn = txn;
		formDirty = false;
		discardOpen = false;
	}

	// ESC / backdrop / ✕ / Cancel all route here; confirm only when dirty.
	function closeMakeRecurring() {
		if (discardOpen) return; // already confirming — let the dialog handle Escape
		if (formDirty) discardOpen = true;
		else makeRecurringTxn = null;
	}

	function confirmDiscard() {
		discardOpen = false;
		makeRecurringTxn = null;
	}

	function onRecurringFormSuccess() {
		makeRecurringTxn = null;
		formDirty = false;
	}

	// Fetch-mode submit → POST /api/recurring (same body the /recurring page sends).
	async function handleRecurringSubmit(formData: FormData): Promise<boolean> {
		try {
			const body: Record<string, unknown> = {
				type: formData.get('type'),
				amount: parseFloat(formData.get('amount') as string),
				description: formData.get('description'),
				category_id: parseInt(formData.get('category_id') as string),
				frequency: formData.get('frequency'),
				interval: parseInt(formData.get('interval') as string) || 1,
				day_of_week: null,
				day_of_month: null,
				month_of_year: null,
				start_date: formData.get('start_date'),
				end_date: formData.get('end_date') || null,
				active: formData.get('active') === 'on',
			};
			const res = await fetch('/api/recurring', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});
			const result = await res.json();
			if (result.success) return true;
			showError(result.error || 'Failed to create schedule');
			return false;
		} catch {
			showError('Failed to create schedule');
			return false;
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

	const countLabel = $derived.by(() => {
		const page = data.page ?? 1;
		const limit = data.limit ?? 20;
		const total = data.total ?? 0;
		const start = (page - 1) * limit + 1;
		const end = Math.min(page * limit, total);
		if (total === 0) return 'No transactions';
		return `Showing ${start}–${end} of ${total}`;
	});

	// ─── Selection Mode: deriveds + handlers ───────────────────────────

	const pageIds = $derived((data.transactions ?? []).map((t) => t.id));
	const selectedOnPage = $derived(pageIds.filter((id) => selectedIds.has(id)).length);
	const allSelected = $derived(pageIds.length > 0 && selectedOnPage === pageIds.length);
	const someSelected = $derived(selectedOnPage > 0 && !allSelected);
	const selectedCount = $derived(selectedIds.size);

	function toggleSelection(id: number) {
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedIds = next;
	}

	// Select All is strictly page-scoped: toggles every row on the current page.
	function toggleAll() {
		if (allSelected) {
			selectedIds = new Set([...selectedIds].filter((id) => !pageIds.includes(id)));
		} else {
			selectedIds = new Set([...selectedIds, ...pageIds]);
		}
	}

	function exitSelectionMode() {
		selectionMode = false;
		selectedIds = new Set();
	}

	// Svelte action: drive a native checkbox's `indeterminate` from a boolean
	// (☐ none / ⊟ some / ☑ all).
	function setIndeterminate(node: HTMLInputElement, indeterminate: boolean) {
		node.indeterminate = indeterminate;
		return {
			update(indeterminate: boolean) {
				node.indeterminate = indeterminate;
			},
		};
	}

	// Clear the page-scoped selection whenever the result set changes
	// (pagination/filters), but leave Selection Mode active until the user
	// cancels or completes a bulk action.
	let lastFilterKey = '';
	$effect(() => {
		const key = $page.url.searchParams.toString();
		untrack(() => {
			if (lastFilterKey !== '' && key !== lastFilterKey) {
				selectedIds = new Set();
			}
			lastFilterKey = key;
		});
	});
</script>

<svelte:head>
	<title>Transactions — Finance Tracker</title>
</svelte:head>

<PageBackground />

<PageHeader title="Transactions" flush borderless>
	{#snippet badge()}
		<CountChip count={totalCount} />
	{/snippet}
	{#snippet subtitle()}
		<span class="context-subline">{contextSubline}</span>
	{/snippet}
	{#snippet action()}
		<span class="header-actions desktop-only">
			<Button variant="primary" href="/transactions/new" onclick={(e) => { e.preventDefault(); openAddForm(); }}>
				<span class="btn-lead" aria-hidden="true">+</span>
				Add Transaction
			</Button>
			<OverflowMenu
				onImportCsv={() => (importWizardOpen = true)}
				onExportCsv={() => handleExport('csv')}
				onExportPdf={() => handleExport('pdf')}
				onSelect={() => { selectionMode = true; selectedIds = new Set(); }}
			/>
		</span>
		<!-- Mobile: the SpeedDial FAB in the bottom nav is the Add CTA; the
		     header keeps only the Import/Export overflow, always in thumb-reach. -->
		<span class="header-actions mobile-only">
			<OverflowMenu
				onImportCsv={() => (importWizardOpen = true)}
				onExportCsv={() => handleExport('csv')}
				onExportPdf={() => handleExport('pdf')}
				onSelect={() => { selectionMode = true; selectedIds = new Set(); }}
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

<!-- ═══ Toolbar ═══
     Desktop: one unified "filter dock" (embedded search + Date/Category/Type
     segments + Clear All, each segment opening a shared menu as a clamped
     popover) + view toggle. Mobile: unified search/filter pill → FiltersSheet
     whose panel is the compact 3-chip dropdowns, so desktop and mobile share
     one option source. Both toolbars are rendered and toggled via CSS —
     hydration-safe (no SSR/client mismatch). -->
<div class="txn-toolbar">
	<div class="toolbar-left">
		<div class="toolbar-desktop">
			<TransactionFilterToolbar
				bind:value={searchInput}
				categories={data.categories ?? []}
				activeFilters={{
					date: filters.date,
					category: filters.category,
					type: filters.type,
					customFrom: filters.customFrom,
					customTo: filters.customTo,
				}}
				onFilterChange={handleFilterChange}
				onClearAll={clearAllFilters}
				placeholder="Search transactions"
				ariaLabel="Search transactions"
			/>
		</div>
		<div class="toolbar-mobile">
			<SearchFilterPill
				bind:value={searchInput}
				bind:open={mobileFiltersOpen}
				{activeFilterCount}
				placeholder="Search transactions"
				ariaLabel="Search transactions"
				filterAriaLabel="Filter transactions"
			>
				{#snippet panel(_mode, _close)}
					<TransactionFilterPanel
						categories={data.categories ?? []}
						activeFilters={{
							date: filters.date,
							category: filters.category,
							type: filters.type,
							customFrom: filters.customFrom,
							customTo: filters.customTo,
						}}
						onFilterChange={handleFilterChange}
						onClearAll={clearAllFilters}
					/>
				{/snippet}
			</SearchFilterPill>
		</div>
	</div>
	<div class="toolbar-right">
		<ViewToggle {showFlatView} onChange={(flat) => showFlatView = flat} stretch />
	</div>
</div>

<!-- ═══ Bulk selection action bar (Selection Mode only) ═══ -->
{#if selectionMode && pageIds.length > 0}
	<div class="bulk-bar" role="toolbar" aria-label="Selected transactions">
		<div class="bulk-left">
			<input
				type="checkbox"
				checked={allSelected}
				use:setIndeterminate={someSelected}
				onchange={toggleAll}
				aria-label="Select all transactions on this page"
			/>
			<span class="bulk-count">{selectedCount} selected</span>
		</div>
		<div class="bulk-actions">
			<Button variant="ghost" size="sm" disabled={selectedCount === 0} onclick={() => handleExport('csv', [...selectedIds])}>Export CSV</Button>
			<Button variant="ghost" size="sm" disabled={selectedCount === 0} onclick={() => handleExport('pdf', [...selectedIds])}>Export PDF</Button>
			<Button variant="danger" size="sm" disabled={selectedCount === 0} onclick={() => (deleteTarget = [...selectedIds])}>Delete Selected</Button>
			<Button variant="ghost" size="sm" onclick={exitSelectionMode}>Cancel</Button>
		</div>
	</div>
{/if}

<!-- ═══ Transaction list (Bank Register) ═══ -->
<TransactionList
	transactions={data.transactions ?? []}
	allTransactionsForBalance={data.allForBalance ?? []}
	categories={data.categories ?? []}
	showRunningBalance={true}
	{showFlatView}
	{selectionMode}
	{selectedIds}
	onToggleSelection={toggleSelection}
	onEdit={(id) => {
		const found = (data.transactions ?? []).find(t => t.id === id);
		if (found) {
			openEditForm(found);
		} else {
			goto(`/transactions/${id}/edit`);
		}
	}}
	onDelete={(id) => (deleteTarget = id)}
	onDuplicate={handleDuplicate}
	onMakeRecurring={openMakeRecurring}
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
				onAction={openAddForm}
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

<!-- ═══ Delete confirmation modal (single or bulk) ═══ -->
{#if deleteTarget !== null}
	{@const isBulk = Array.isArray(deleteTarget) && deleteTarget.length > 1}
	{@const deleteCount = Array.isArray(deleteTarget) ? deleteTarget.length : 1}
	<ModalDialog open={deleteTarget !== null} onclose={() => (deleteTarget = null)} title={isBulk ? 'Delete Transactions' : 'Delete Transaction'}>
		<p>
			Are you sure you want to delete {deleteCount} transaction{deleteCount !== 1 ? 's' : ''}?
			This action cannot be undone.
		</p>
		<form
			method="POST"
			action="?/delete"
			use:enhance={() => {
				return async ({
					result,
					update,
				}: {
					result: { type: string; data?: { error?: string; deleted?: number } };
					update: () => Promise<void>;
				}) => {
					if (result.type === 'success') {
						const deleted = result.data?.deleted ?? deleteCount;
						exitSelectionMode();
						deleteTarget = null;
						showSuccess(`${deleted} transaction${deleted !== 1 ? 's' : ''} deleted`);
					} else if (result.type === 'failure') {
						showError(result.data?.error || 'Failed to delete transaction');
					}
					await update();
				};
			}}
		>
			<input
				type="hidden"
				name="id"
				value={Array.isArray(deleteTarget) ? deleteTarget.join(',') : String(deleteTarget)}
			/>
			<div class="modal-actions">
				<Button variant="danger" type="submit">Delete</Button>
				<Button variant="ghost" type="button" onclick={() => (deleteTarget = null)}>Cancel</Button>
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

<!-- ═══ Add / Edit Transaction SlideOver ═══ -->
{#if isFormOpen}
	<SlideOver isOpen={isFormOpen} title={editingTransaction ? "Edit Transaction" : "Add Transaction"} onClose={closeForm}>
		<TransactionForm
			categories={data.categories ?? []}
			transaction={editingTransaction ?? undefined}
			action={editingTransaction ? `?/update` : `?/create`}
			spendingMap={spendingMap}
			categoryTxnCounts={categoryTxnCounts}
			onCancel={closeForm}
			onSuccess={() => {
				closeForm();
				invalidateAll();
			}}
		/>
	</SlideOver>
{/if}

<!-- ═══ Create Recurring Schedule slide-over ═══ -->
{#if makeRecurringTxn}
	<SlideOver isOpen={true} title="Create Recurring Schedule" onClose={closeMakeRecurring}>
		<p class="rr-subtitle">Future transactions will be created automatically using these settings.</p>

		<!-- Source transaction card -->
		<div class="source-card">
			<span class="source-label">Source transaction</span>
			<div class="source-line1">
				<span class="source-desc">{makeRecurringTxn.description}</span>
				<span class="source-type source-type-{makeRecurringTxn.type}">{makeRecurringTxn.type}</span>
			</div>
			<span class="source-meta">{formatCurrency(Math.abs(makeRecurringTxn.amount))} · {formatDate(makeRecurringTxn.date)}</span>
			<span class="source-lock">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
				The original transaction won't be modified.
			</span>
		</div>

		<!-- Next scheduled transaction card (the scheduler's computed next_run) -->
		<div class="next-run-card">
			<svg class="next-run-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
			<div class="next-run-body">
				<span class="next-run-label">Next scheduled transaction</span>
				<span class="next-run-date">{formatDate(makeRecurringNextRun)}</span>
			</div>
		</div>

		<p class="rr-helper">This creates a recurring schedule based on this transaction. The original transaction won't be modified.</p>

		<RecurringForm
			categories={data.categories ?? []}
			initial={makeRecurringInitial ?? undefined}
			onSubmit={handleRecurringSubmit}
			onSuccess={onRecurringFormSuccess}
			onCancel={closeMakeRecurring}
			bind:dirty={formDirty}
			submitLabel="Create Recurring Schedule"
			successToast={{
				message: 'Recurring schedule created. Future transactions will be generated automatically.',
				action: { label: 'Open Recurring', href: '/recurring' },
			}}
		/>
	</SlideOver>
{/if}

<!-- ═══ Discard recurring schedule confirmation (dirty close) ═══ -->
{#if discardOpen}
	<ModalDialog open={discardOpen} onclose={() => (discardOpen = false)} title="Discard recurring schedule?">
		<p>Your changes haven't been saved.</p>
		<div class="modal-actions">
			<Button variant="ghost" type="button" onclick={() => (discardOpen = false)}>Keep editing</Button>
			<Button variant="danger" type="button" onclick={confirmDiscard}>Discard</Button>
		</div>
	</ModalDialog>
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
		color: var(--muted);
	}

	/* ─── Toolbar ─── */
	/* Working controls for the list: sits below the KPI cards and hugs the
	   register beneath it (tight bottom gap) so it reads as one unit.
	   Desktop: the unified filter dock fills the left, view toggle on the
	   right. The dock wraps onto its own row on tablet rather than overflow —
	   no horizontal scroll ever. Both .toolbar-desktop and .toolbar-mobile are
	   rendered and toggled via CSS (hydration-safe breakpoint; see the toolbar
	   markup). IMPORTANT: no transform/filter on these wrappers — the dock's
	   menus are position:fixed and must stay anchored to the viewport. */
	.txn-toolbar {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		margin-bottom: var(--space-md);
	}

	.toolbar-left {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.toolbar-desktop {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-sm);
		flex: 1;
		min-width: 0;
	}

	.toolbar-mobile {
		display: none;
	}

	/* Header actions: overflow + add transaction, right side of header */
	.header-actions {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.toolbar-right {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: var(--space-md);
	}

	/* Mobile filter sheet panel: TransactionFilterPanel is a self-contained
	   in-sheet accordion (Date/Category/Type sections + Clear All). It owns its
	   layout — no page-level overrides needed. The FiltersSheet body provides
	   the horizontal padding and scrolls when a section is expanded. */

	/* ─── Bulk selection action bar (Selection Mode only) ─── */
	.bulk-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		margin-bottom: var(--space-md);
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-sm);
		animation: bulkIn 200ms var(--ease) both;
	}

	.bulk-left {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		min-height: 44px;
	}

	.bulk-left input[type='checkbox'] {
		width: 18px;
		height: 18px;
		margin: 0;
		accent-color: var(--color-teal);
		cursor: pointer;
	}

	.bulk-count {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-semibold);
		color: var(--color-teal);
		letter-spacing: 0.02em;
	}

	.bulk-actions {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		flex-wrap: wrap;
	}

	/* Keep the compact sm buttons at the 44px interactive minimum */
	.bulk-bar :global(.btn) {
		min-height: 44px;
	}

	@keyframes bulkIn {
		from {
			opacity: 0;
			transform: translateY(-6px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (max-width: 768px) {
		.bulk-bar {
			align-items: stretch;
			flex-direction: column;
			gap: var(--space-sm);
		}

		/* Stack the actions as an even 2×2 grid beneath the status row, with a
		   solid hairline seam separating "N selected" from the actions. */
		.bulk-actions {
			display: grid;
			grid-template-columns: repeat(2, 1fr);
			gap: var(--space-xs);
			width: 100%;
			border-top: 1px solid var(--color-hairline);
			padding-top: var(--space-sm);
		}

		.bulk-actions :global(.btn) {
			width: 100%;
		}
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

	@media (max-width: 768px) {
		.desktop-only {
			display: none !important;
		}

		.mobile-only {
			display: flex;
			align-items: center;
		}

		/* Desktop toolbar (filter dock) is hidden; the toolbar stacks into two
		   full-width rows — the unified search/filter pill first, the view
		   toggle (a stretched 50/50 segmented control) below it — matching the
		   borrowed/lending toolbar rhythm. */
		.toolbar-desktop {
			display: none;
		}

		.toolbar-mobile {
			display: block;
			width: 100%;
		}

		.txn-toolbar {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-sm);
			margin-bottom: var(--space-xs);
		}

		.toolbar-left {
			flex-direction: column;
			align-items: stretch;
			width: 100%;
		}

		.toolbar-right {
			justify-content: flex-start;
			width: 100%;
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
		background: var(--teal-deep);
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

	/* ─── Create Recurring Schedule slide-over content ─── */
	.rr-subtitle {
		font-size: var(--font-size-sm);
		color: var(--muted);
		margin: 0 0 var(--space-md);
		line-height: 1.5;
	}

	.source-card {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: var(--space-md);
		margin-bottom: var(--space-md);
		background: var(--color-bg);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-lg);
	}

	.source-label {
		font-family: var(--font-display);
		font-size: var(--font-size-xs);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-muted);
	}

	.source-line1 {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		min-width: 0;
	}

	.source-desc {
		font-family: var(--font-display);
		font-size: var(--font-size-base);
		font-weight: 700;
		color: var(--color-ink);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.source-type {
		flex-shrink: 0;
		padding: 2px 10px;
		border-radius: var(--radius-pill);
		font-family: var(--font-display);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.source-type-income {
		background: var(--color-teal-bg);
		color: var(--color-teal);
	}

	.source-type-expense {
		background: var(--color-coral-bg);
		color: var(--color-coral);
	}

	.source-meta {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	.source-lock {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 6px;
		padding-top: 6px;
		border-top: 1px solid var(--color-hairline);
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	.source-lock svg {
		flex-shrink: 0;
	}

	.next-run-card {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-md);
		margin-bottom: var(--space-md);
		background: var(--color-teal-bg);
		border: 1px solid var(--color-teal);
		border-radius: var(--radius-lg);
	}

	.next-run-icon {
		flex-shrink: 0;
		color: var(--color-teal);
	}

	.next-run-body {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.next-run-label {
		font-size: var(--font-size-xs);
		font-weight: 500;
		color: var(--color-text-muted);
	}

	.next-run-date {
		font-family: var(--font-display);
		font-size: var(--font-size-base);
		font-weight: 700;
		color: var(--color-ink);
	}

	.rr-helper {
		font-size: var(--font-size-sm);
		color: var(--muted);
		margin: 0 0 var(--space-md);
		line-height: 1.5;
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
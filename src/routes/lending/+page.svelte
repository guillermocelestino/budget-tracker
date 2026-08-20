<script lang="ts">
	import { untrack } from 'svelte';
	import { page, navigating } from '$app/stores';
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import SlideOver from '$lib/client/components/SlideOver.svelte';
	import PageBackground from '$lib/client/components/PageBackground.svelte';
	import SendMoneyAwayModal from '$lib/client/components/SendMoneyAwayModal.svelte';
	import ModalDialog from '$lib/client/components/ModalDialog.svelte';
	import ActiveIouList from '$lib/client/components/ActiveIouList.svelte';
	import RecordPaymentModal from '$lib/client/components/RecordPaymentModal.svelte';
	import PaymentHistoryPanel from '$lib/client/components/PaymentHistoryPanel.svelte';
	import EditPaymentModal from '$lib/client/components/EditPaymentModal.svelte';
	import DeletePaymentConfirmModal from '$lib/client/components/DeletePaymentConfirmModal.svelte';
	import Button from '$lib/client/components/Button.svelte';
	import OverflowMenu from '$lib/client/components/OverflowMenu.svelte';
	import ViewToggle from '$lib/client/components/ViewToggle.svelte';
	import ListToolbar from '$lib/client/components/ListToolbar.svelte';
	import EmptyState from '$lib/client/components/EmptyState.svelte';
	import SearchFilterPill from '$lib/client/components/SearchFilterPill.svelte';
	import LendingFilterToolbar from '$lib/client/components/LendingFilterToolbar.svelte';
	import LendingFilters from '$lib/client/components/LendingFilters.svelte';
	import ImportWizard from '$lib/client/components/ImportWizard.svelte';
	import MobileMoneyPunchOverlay, { type PunchType } from '$lib/client/components/dashboard/MobileMoneyPunchOverlay.svelte';
	import { showSuccess, showError } from '$lib/client/stores/toast.svelte';
	import { downloadCsv, lendingsToCSV } from '$lib/client/utils/csv';
	import { generateLendingPdf } from '$lib/client/utils/pdf';
	import { formatCurrency } from '$lib/client/utils/format';
	import { getCurrentMonth } from '$lib/shared/utils/format';
	import { LENDING_IMPORT_FIELDS, buildMappedLendingRows, validateAllLendingRows, type MappedLendingRow } from '$lib/shared/utils/lendingImport';
	import type { ImportPreviewColumn, ImportMappingConfig, ImportValidationResult } from '$lib/shared/utils/importValidation';
	import type { PageData } from './$types';
	import type { Lending, LendingPayment, LendingWithPayments } from '$lib/types';

	let { data }: { data: PageData } = $props();

	let showPanel = $state(false);
	let editingLending = $state<Lending | null>(null);
	let viewMode = $state<'card' | 'table'>('table');
	let recordPaymentLending = $state<LendingWithPayments | null>(null);
	let deleteTarget = $state<number | number[] | null>(null);
	let historyLending = $state<LendingWithPayments | null>(null);
	let historyPayments = $state<LendingPayment[]>([]);
	let historyOpen = $state(false);
	let editPaymentLending = $state<LendingWithPayments | null>(null);
	let editPayment = $state<LendingPayment | null>(null);
	let deletePayment = $state<LendingPayment | null>(null);
	let filtersOpen = $state(false);
	let importWizardOpen = $state(false);
	let punchData = $state<{ type: PunchType; amount: number } | null>(null);

	// Bulk selection (Selection Mode) — entered via the header overflow menu.
	// Selection is always page-scoped; clearing happens on page/filter change.
	let selectionMode = $state(false);
	let selectedIds = $state(new Set<number>());

	const pageIds = $derived((data.lendings ?? []).map((l) => l.id));
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

	function setIndeterminate(node: HTMLInputElement, indeterminate: boolean) {
		node.indeterminate = indeterminate;
		return {
			update(indeterminate: boolean) {
				node.indeterminate = indeterminate;
			},
		};
	}

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

	// ─── FILTER & URL STATE ───
	const urlFrom = $page.url.searchParams.get('from') || $page.url.searchParams.get('date_from') || '';
	const urlTo = $page.url.searchParams.get('to') || $page.url.searchParams.get('date_to') || '';
	const rawUrlDate = $page.url.searchParams.get('date') || '';
	const urlDate = rawUrlDate || (urlFrom || urlTo ? 'custom' : '');
	const urlStatus = ($page.url.searchParams.get('status') as 'all' | 'active' | 'paid') || 'active';

	let activeTab = $state<'all' | 'active' | 'paid'>(urlStatus);
	let dateFilters = $state({
		date: urlDate,
		customFrom: urlFrom,
		customTo: urlTo
	});

	let searchInput = $state($page.url.searchParams.get('search') || '');
	let searchTerm = $state($page.url.searchParams.get('search') || '');

	// Sync search input from URL on navigation
	$effect(() => {
		const urlSearch = $page.url.searchParams.get('search') ?? '';
		untrack(() => {
			if (searchTerm === searchInput && urlSearch !== searchInput) {
				searchInput = urlSearch;
			}
		});
	});

	// Debounce writing typed search input to searchTerm
	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		const value = searchInput;
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			if (searchTerm !== value) searchTerm = value;
		}, 250);
		return () => {
			if (searchTimer) clearTimeout(searchTimer);
		};
	});

	const isSearching = $derived(searchInput !== searchTerm || !!$navigating);
	const hasActiveFilters = $derived(
		Boolean(searchInput || activeTab !== 'active' || dateFilters.date)
	);

	// Sync filter state -> URL (drops page to reset to page 1)
	$effect(() => {
		const params = new URLSearchParams();

		if (activeTab !== 'active') {
			params.set('status', activeTab);
		}

		if (dateFilters.date) {
			if (dateFilters.date === 'custom') {
				if (dateFilters.customFrom) params.set('from', dateFilters.customFrom);
				if (dateFilters.customTo) params.set('to', dateFilters.customTo);
			} else {
				const range = dateRangeFromFilter(dateFilters.date, dateFilters.customFrom, dateFilters.customTo);
				if (range.from) params.set('from', range.from);
				if (range.to) params.set('to', range.to);
			}
		}

		if (searchTerm) params.set('search', searchTerm);

		const rawLimit = $page.url.searchParams.get('limit') ?? $page.url.searchParams.get('pageSize');
		if (rawLimit && rawLimit !== '20') {
			params.set('limit', rawLimit);
		}

		const newQs = params.toString();
		const currentFilterQs = (() => {
			const p = new URLSearchParams($page.url.searchParams);
			p.delete('page');
			return p.toString();
		})();

		if (newQs !== currentFilterQs) {
			goto(`/lending${newQs ? '?' + newQs : ''}`, {
				keepFocus: true,
				noScroll: true,
			});
		}
	});

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

	async function goToPage(p: number) {
		const y = window.scrollY;
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', String(p));
		try {
			await goto(`/lending?${params.toString()}`, { keepFocus: true, noScroll: true });
		} catch {
			return;
		}
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				window.scrollTo({ top: y, behavior: 'auto' });
			});
		});
	}

	function handleLimitChange(newLimitStr: string) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', '1');
		if (newLimitStr === 'all') {
			params.set('limit', 'all');
		} else if (newLimitStr !== '20') {
			params.set('limit', newLimitStr);
		} else {
			params.delete('limit');
			params.delete('pageSize');
		}
		goto(`/lending?${params.toString()}`, { keepFocus: true, noScroll: true });
	}

	const showLendings: LendingWithPayments[] = $derived(data.lendings ?? []);
	const totals = $derived(data.totals ?? { totalLent: 0, totalRecovered: 0, outstanding: 0 });
	const counts = $derived(data.counts ?? { all: 0, active: 0, paid: 0 });
	const existingPeople = $derived(
		Array.from(new Set(showLendings.map(l => l.borrower_name)))
	);

	const activeFilterCount = $derived(
		(activeTab !== 'active' ? 1 : 0) + (dateFilters.date ? 1 : 0)
	);

	const pageItems = $derived((currentPage: number, totalPages: number): (number | '…')[] => {
		const pages: (number | '…')[] = [];
		const show = 3;
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
		if (data.dateError) {
			return data.dateError;
		}
		const page = data.page ?? 1;
		const limitVal = data.limit ?? 20;
		const total = data.total ?? 0;
		if (total === 0) return 'No lendings';
		if (limitVal === 0) {
			return `Showing all ${total} record${total !== 1 ? 's' : ''}`;
		}
		const start = (page - 1) * limitVal + 1;
		const end = Math.min(page * limitVal, total);
		return `Showing ${start}–${end} of ${total} record${total !== 1 ? 's' : ''}`;
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

	function handleLendingSuccess(payload: { amount: number }) {
		// Trigger MobileMoneyPunchOverlay (full-screen particle animation)
		punchData = { type: 'lent', amount: payload.amount };
		closePanel();
	}

	function handleExportCsv() {
		const csv = lendingsToCSV(showLendings, 'lent');
		downloadCsv(csv, `lending-${new Date().toISOString().split('T')[0]}.csv`);
	}

	async function handleExportPdf() {
		if (showLendings.length === 0) {
			showError('No lendings to export');
			return;
		}
		try {
			const doc = await generateLendingPdf(showLendings);
			doc.save(`lending-${new Date().toISOString().split('T')[0]}.pdf`);
		} catch (e) {
			console.error('[Export] PDF generation failed:', e);
			showError('Failed to generate PDF');
		}
	}

	async function handleDuplicate(id: number) {
		const src = showLendings.find((l) => l.id === id);
		if (!src) return;
		try {
			const res = await fetch('/api/lendings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					borrower_name: src.borrower_name,
					amount: src.amount,
					interest_rate: src.interest_rate,
					date_lent: src.date_lent,
					due_date: src.due_date,
					notes: src.notes,
					direction: src.direction,
					status: src.status,
				}),
			});
			if (!res.ok) throw new Error(((await res.json()).error) || 'Duplicate failed');
			showSuccess('Lending duplicated');
			await invalidateAll();
		} catch (e) {
			showError((e as Error).message || 'Failed to duplicate lending');
		}
	}

	// ─── Import Wizard props ──────────────────────────────────────────
	const previewColumns = $derived<ImportPreviewColumn[]>([
		{ header: 'Validity', key: '_status', kind: 'status' },
		{ header: 'Person', key: 'person_name', kind: 'text', cls: 'cell-desc' },
		{ header: 'Amount', key: 'amount', kind: 'amount', align: 'right' },
		{ header: 'Date Lent', key: 'date_lent', kind: 'date' },
		{ header: 'Due Date', key: 'due_date', kind: 'date' },
		{ header: 'Status', key: 'status', kind: 'badge' },
		{ header: 'Amount Recovered', key: 'recovered_amount', kind: 'amount', align: 'right' },
	]);

	function buildRows(rawRows: string[][], headers: string[], mapping: Record<string, string>, config: ImportMappingConfig) {
		return buildMappedLendingRows(rawRows, headers, mapping, config);
	}

	function validateRows(rows: MappedLendingRow[], deps: Record<string, unknown>, config: ImportMappingConfig): ImportValidationResult<MappedLendingRow> {
		const result = validateAllLendingRows(rows, deps.existingPeople as string[], config);
		return {
			validRows: result.validRows,
			invalidRows: result.invalidRows,
			unknownCategories: [],
			newNames: result.newPeople,
		};
	}

	const importDeps = $derived({ existingPeople });
</script>

<svelte:head>
	<title>Money Away — WRECKRD</title>
</svelte:head>

<PageBackground />

<!-- ═══════════════════════════════════════════════════════════════════════════
     MONEY AWAY DESKTOP COMPOSITION — Flip7 Visual Language
     ═══════════════════════════════════════════════════════════════════════════ -->
<div class="page-container page-container--workspace">
	<header class="money-away-hero flip7-card accent-sky">
		<div class="hero-left">
			<div class="hero-badge sky">
				<span class="wave-icon">🌊</span>
				<span class="badge-text">MONEY AWAY</span>
			</div>
			<h1 class="hero-title">WHERE IS MY MONEY, AND WHEN IS IT COMING BACK?</h1>
			<p class="hero-subtitle">Money Away hasn't disappeared — it's just outside your possession right now.</p>
		</div>
		<div class="hero-actions">
			<OverflowMenu
				onImportCsv={() => (importWizardOpen = true)}
				onExportCsv={handleExportCsv}
				onExportPdf={handleExportPdf}
				onSelect={() => { selectionMode = true; selectedIds = new Set(); }}
			/>
		</div>
	</header>

	<!-- ═══ Money Away 3-Metric KPI Summary Strip ═══ -->
	<div class="money-away-kpis">
		<div class="kpi-card flip7-card accent-sky">
			<span class="kpi-label">Currently Away</span>
			<span class="kpi-value sky">{formatCurrency(totals.outstanding)}</span>
		</div>
		<div class="kpi-card flip7-card accent-teal">
			<span class="kpi-label">Recovered</span>
			<span class="kpi-value">{formatCurrency(totals.totalRecovered)}</span>
		</div>
		<div class="kpi-card flip7-card accent-gold">
			<span class="kpi-label">Total Ever Lent</span>
			<span class="kpi-value">{formatCurrency(totals.totalLent)}</span>
		</div>
	</div>
<!-- ═══ Send Money Away Modal ═══ -->
<SendMoneyAwayModal
	open={showPanel}
	onClose={closePanel}
	onSuccess={handleLendingSuccess}
	lendingRecord={editingLending ?? undefined}
/>

<!-- ═══ Import Wizard Modal ═══ -->
<ImportWizard
	open={importWizardOpen}
	onClose={() => (importWizardOpen = false)}
	fields={LENDING_IMPORT_FIELDS}
	columns={previewColumns}
	buildRows={buildRows}
	validateRows={validateRows as unknown as (rows: Record<string, unknown>[], deps: Record<string, unknown>, config: ImportMappingConfig) => ImportValidationResult<Record<string, unknown>>}
	deps={importDeps}
	title="Import Lendings"
	noun="lendings"
	sampleHref="/lending-sample.csv"
	sampleFilename="lending-sample.csv"
	templateHref="/templates/lending.xlsx"
	templateFilename="lending-import-template.xlsx"
	direction="lent"
/>

<!-- ═══ Table Card Container (Integrates Toolbar as Table Header) ═══ -->
<div class="table-card-wrapper flip7-card accent-teal">
	{#if isSearching}
		<div class="table-loading-bar" role="progressbar" aria-label="Loading data">
			<div class="loading-bar-fill"></div>
		</div>
	{/if}
	<!-- ═══ ListToolbar: unified Search|Filter pill (left), view mode (right) ═══ -->
	<ListToolbar>
		{#snippet filters()}
			<div class="toolbar-desktop">
				<LendingFilterToolbar
					bind:value={searchInput}
					loading={isSearching}
					activeFilters={{
						status: activeTab,
						date: dateFilters.date,
						customFrom: dateFilters.customFrom,
						customTo: dateFilters.customTo,
					}}
					{counts}
					paidLabel="Paid"
					onFilterChange={(f) => {
						activeTab = f.status;
						dateFilters = { date: f.date, customFrom: f.customFrom ?? '', customTo: f.customTo ?? '' };
					}}
					onClearAll={() => {
						searchInput = '';
						activeTab = 'active';
						dateFilters = { date: '', customFrom: '', customTo: '' };
					}}
					placeholder="Search borrower, lender, notes…"
					ariaLabel="Search lendings"
				/>
			</div>
			<div class="toolbar-mobile">
				<SearchFilterPill
					bind:value={searchInput}
					loading={isSearching}
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
							date={dateFilters.date}
							customFrom={dateFilters.customFrom}
							customTo={dateFilters.customTo}
							onFilterChange={(f) => {
								activeTab = f.status;
								dateFilters = { date: f.date, customFrom: f.customFrom ?? '', customTo: f.customTo ?? '' };
							}}
							counts={counts}
							{mode}
							onApply={close}
						/>
					{/snippet}
				</SearchFilterPill>
			</div>
		{/snippet}
		{#snippet views()}
			<ViewToggle
				options={[
					{ value: 'card', icon: 'grid', label: 'Grouped', ariaLabel: 'Card view' },
					{ value: 'table', icon: 'table', label: 'Table', ariaLabel: 'Table view' },
				]}
				value={viewMode}
				onSelect={(v) => (viewMode = v as 'card' | 'table')}
				ariaLabel="Lending list view"
				slidingThumb
				stretch
			/>
		{/snippet}
	</ListToolbar>

	<!-- ═══ Invalid date range alert ═══ -->
	{#if data.dateError}
		<div class="date-error-banner flip7-card accent-coral" role="alert">
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
			<span>{data.dateError}</span>
		</div>
	{/if}

	<!-- ═══ Bulk selection action bar (Selection Mode only) ═══ -->
	{#if selectionMode && pageIds.length > 0}
		<div class="bulk-bar flip7-card accent-gold" role="toolbar" aria-label="Selected lendings">
			<div class="bulk-left">
				<input
					type="checkbox"
					checked={allSelected}
					use:setIndeterminate={someSelected}
					onchange={toggleAll}
					aria-label="Select all lendings on this page"
				/>
				<span class="bulk-count">{selectedCount} selected</span>
			</div>
			<div class="bulk-actions">
				<Button variant="danger" size="sm" disabled={selectedCount === 0} onclick={() => (deleteTarget = [...selectedIds])}>Delete Selected</Button>
				<Button variant="ghost" size="sm" onclick={exitSelectionMode}>Cancel</Button>
			</div>
		</div>
	{/if}

	<ActiveIouList
		ious={showLendings}
		showProjectedInterest
		onPay={(id) => { const l = showLendings.find(l => l.id === id); if (l) recordPaymentLending = l; }}
		onViewHistory={async (id) => {
			const l = showLendings.find(l => l.id === id);
			if (!l) return;
			const res = await fetch(`/api/lendings/${id}/payments`);
			if (res.ok) {
				historyPayments = await res.json();
				historyLending = l;
				historyOpen = true;
			}
		}}
		onEdit={(id) => {
			const l = showLendings.find(l => l.id === id);
			if (l) {
				openEdit(l);
			}
		}}
		onDelete={(id) => deleteTarget = id}
		onDuplicate={handleDuplicate}
		viewMode={viewMode}
		selectionMode={selectionMode}
		selectedIds={selectedIds}
		onToggleSelection={toggleSelection}
	>
		{#snippet emptyState()}
			{#if hasActiveFilters}
				<EmptyState
					icon="🔍"
					title="No results"
					description="No lending records match your search or filters."
					actionLabel="Clear All Filters"
					onAction={() => {
						searchInput = '';
						activeTab = 'active';
						dateFilters = { date: '', customFrom: '', customTo: '' };
					}}
				/>
			{:else}
				<EmptyState
					icon="🤝"
					title="No lending records yet"
					description="Keep track of money you've lent to friends, family, or clients."
					actionLabel="Record Money Lent"
					onAction={openAdd}
				/>
			{/if}
		{/snippet}
	</ActiveIouList>

	<!-- ═══ Pagination (ledger pager) ═══ -->
	{#if (data.total ?? 0) > 0 || data.dateError}
		<div class="pager-container">
			{#if (data.totalPages ?? 0) > 1 && (data.limit ?? 20) !== 0}
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
			{/if}
			<div class="pager-footer">
				<span class="pager-count">{countLabel}</span>
				<div class="rows-per-page">
					<label for="rows-select">Rows per page:</label>
					<select
						id="rows-select"
						class="rows-select"
						value={data.limit === 0 ? 'all' : String(data.limit ?? 20)}
						onchange={(e) => handleLimitChange(e.currentTarget.value)}
						aria-label="Rows per page"
					>
						<option value="20">20</option>
						<option value="50">50</option>
						<option value="100">100</option>
						<option value="200">200</option>
						<option value="500">500</option>
						<option value="all">All</option>
					</select>
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- ═══ Record Payment Modal ═══ -->
{#if recordPaymentLending}
	<RecordPaymentModal
		lending={recordPaymentLending}
		direction="lent"
		onclose={() => recordPaymentLending = null}
	/>
{/if}

<!-- ═══ Payment History SlideOver ═══ -->
{#if historyOpen && historyLending}
	<SlideOver
		isOpen={historyOpen}
		title="Payment History"
		onClose={() => { historyOpen = false; historyLending = null; historyPayments = []; }}
	>
		<PaymentHistoryPanel
			lending={historyLending}
			payments={historyPayments}
			direction="lent"
			onRecordPayment={() => { historyOpen = false; recordPaymentLending = historyLending; }}
			onEditPayment={(paymentId) => {
				const p = historyPayments.find(p => p.id === paymentId);
				if (p && historyLending) {
					historyOpen = false;
					editPaymentLending = historyLending;
					editPayment = p;
				}
			}}
			onDeletePayment={(paymentId) => {
				const p = historyPayments.find(p => p.id === paymentId);
				if (p) {
					historyOpen = false;
					deletePayment = p;
				}
			}}
		/>
	</SlideOver>
{/if}

<!-- ═══ Edit Payment Modal ═══ -->
{#if editPaymentLending && editPayment}
	<EditPaymentModal
		lending={editPaymentLending}
		payment={editPayment}
		direction="lent"
		onclose={() => { editPaymentLending = null; editPayment = null; }}
	/>
{/if}

<!-- ═══ Delete Payment Confirmation ═══ -->
{#if deletePayment}
	<DeletePaymentConfirmModal
		payment={deletePayment}
		onclose={() => deletePayment = null}
	/>
{/if}

<!-- ═══ Delete Confirmation ═══ -->
{#if deleteTarget !== null}
	{@const isBulk = Array.isArray(deleteTarget)}
	{@const deleteCount = Array.isArray(deleteTarget) ? deleteTarget.length : 1}
	{@const deleteIdsStr = Array.isArray(deleteTarget) ? deleteTarget.join(',') : String(deleteTarget)}
	<ModalDialog open={deleteTarget !== null} onclose={() => deleteTarget = null} title={isBulk ? 'Delete Lendings' : 'Delete Lending'}>
		<div class="modal-icon-wrap danger">
			<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="3 6 5 6 21 6"/>
				<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
			</svg>
		</div>
		<p>
			Are you sure you want to delete {isBulk ? `${deleteCount} lending records` : 'this lending record'}?
			This action cannot be undone.
		</p>
		<form method="POST" action={isBulk ? '?/deleteBulk' : '?/delete'} use:enhance={() => {
			return async ({ result, update }: { result: { type: string; data?: { error?: string; deleted?: number } }; update: () => Promise<void> }) => {
				await update();
				if (result.type === 'success') {
					if (isBulk) exitSelectionMode();
					deleteTarget = null;
					showSuccess(isBulk ? `${result.data?.deleted ?? deleteCount} lendings deleted` : 'Lending deleted');
				} else {
					showError((result.data as { error?: string } | undefined)?.error || 'Failed to delete');
				}
			};
		}}>
			<input type="hidden" name="id" value={deleteIdsStr} />
			<div class="modal-actions">
				<Button variant="danger" type="submit">Delete</Button>
				<Button variant="ghost" type="button" onclick={() => deleteTarget = null}>Cancel</Button>
			</div>
		</form>
	</ModalDialog>
{/if}

<!-- ═══ Money Punch Overlay (after create/edit) ═══ -->
{#if punchData}
	<MobileMoneyPunchOverlay
		type={punchData.type}
		amount={punchData.amount}
		onComplete={() => (punchData = null)}
	/>
{/if}

<!-- Sticky Right-Side Floating Action Button (Desktop) - matches SpeedDial style -->
<button
	type="button"
	class="desktop-fab-add flip7-card accent-sky"
	onclick={openAdd}
	aria-label="Send money away"
	title="Send money away"
>
	<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
		<line x1="12" y1="5" x2="12" y2="19"/>
		<line x1="5" y1="12" x2="19" y2="12"/>
	</svg>
	<span class="fab-tooltip" role="tooltip">Send money away</span>
</button>
</div>

<style>
	/* ─── Sticky Right-Side Floating Action Button (Desktop) ─── */
	.desktop-fab-add {
		position: fixed;
		right: 16px;
		top: 50%;
		transform: translateY(-50%);
		z-index: var(--z-sidebar, 90);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 56px;
		height: 56px;
		border-radius: var(--radius-full, 9999px);
		background: var(--color-money-away, #5DADE2);
		color: var(--color-ink-inverse, #ffffff);
		border: 1px solid rgba(255, 255, 255, 0.4);
		box-shadow: 0 4px 20px rgba(93, 173, 226, 0.45), 0 2px 8px rgba(20, 48, 46, 0.12);
		cursor: pointer;
		outline: none;
		transition: transform 200ms var(--ease), box-shadow 200ms var(--ease), background 200ms var(--ease);
		-webkit-tap-highlight-color: transparent;
	}

	.desktop-fab-add:hover {
		background: #7FC0EB;
		box-shadow: 0 8px 28px rgba(93, 173, 226, 0.60), 0 4px 12px rgba(20, 48, 46, 0.16);
		transform: translateY(-50%) scale(1.08);
	}

	.desktop-fab-add:active {
		transform: translateY(-50%) scale(0.95);
		box-shadow: 0 2px 10px rgba(93, 173, 226, 0.35);
	}

	.desktop-fab-add:focus-visible {
		outline: 3px solid var(--color-teal, #2BA8A2);
		outline-offset: 3px;
	}

	.fab-tooltip {
		position: absolute;
		right: calc(100% + 12px);
		top: 50%;
		transform: translateY(-50%) translateX(6px);
		background: var(--color-ink, #14302E);
		color: var(--color-ink-inverse, #ffffff);
		font-family: var(--font-body);
		font-size: var(--font-size-xs, 0.75rem);
		font-weight: 600;
		padding: 6px 12px;
		border-radius: var(--radius-md, 8px);
		white-space: nowrap;
		pointer-events: none;
		opacity: 0;
		visibility: hidden;
		transition: opacity 180ms var(--ease), transform 180ms var(--ease), visibility 180ms var(--ease);
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
	}

	.desktop-fab-add:hover .fab-tooltip,
	.desktop-fab-add:focus-visible .fab-tooltip {
		opacity: 1;
		visibility: visible;
		transform: translateY(-50%) translateX(0);
	}

	@media (prefers-reduced-motion: reduce) {
		.desktop-fab-add,
		.fab-tooltip {
			transition: none;
		}
		.desktop-fab-add:hover {
			transform: translateY(-50%);
		}
	}

	@media (max-width: 768px) {
		.desktop-fab-add {
			display: none !important;
		}
	}

	/* ─── MONEY AWAY HERO & KPIS ─── */
	.money-away-container {
		display: flex;
		flex-direction: column;
		gap: var(--space-md, 12px);
		margin-bottom: var(--space-md, 12px);
	}

	.money-away-hero {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-lg, 16px);
		padding: 18px 24px;
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: 24px;
		box-shadow: var(--shadow-sm);
		margin-bottom: var(--space-md, 12px);
		overflow: visible;
	}

	.hero-left {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.hero-badge.sky {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 3px 10px;
		background: rgba(93, 173, 226, 0.12);
		border-radius: var(--radius-pill, 999px);
		width: fit-content;
		margin-bottom: 2px;
	}

	.hero-badge.sky .badge-text {
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 800;
		color: var(--color-money-away, #5DADE2);
		letter-spacing: 0.12em;
	}

	.hero-title {
		font-family: var(--font-display);
		font-size: clamp(20px, 2.4vw, 26px);
		font-weight: 800;
		color: var(--color-ink);
		margin: 0;
		letter-spacing: -0.02em;
		line-height: 1.15;
	}

	.hero-subtitle {
		font-size: var(--font-size-sm, 14px);
		color: var(--color-text-muted);
		margin: 2px 0 0 0;
	}

	.hero-actions {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-shrink: 0;
	}

	.btn-send-money-away {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 10px 20px;
		min-height: 44px;
		background: var(--color-money-away, #5DADE2);
		color: #ffffff;
		border: none;
		border-radius: 22px;
		font-family: var(--font-display);
		font-size: 14px;
		font-weight: 700;
		cursor: pointer;
		box-shadow: 0 4px 16px rgba(93, 173, 226, 0.35);
		transition: transform 140ms ease, background 140ms ease;
		-webkit-tap-highlight-color: transparent;
	}

	.btn-send-money-away:hover {
		background: #489ad3;
		transform: translateY(-1px);
	}

	.btn-send-money-away:active {
		transform: scale(0.97);
	}

	.money-away-kpis {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--space-md, 12px);
	}

	.kpi-card {
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: 14px 18px;
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: 18px;
		box-shadow: var(--shadow-sm);
		min-height: 96px;
	}

	.kpi-label {
		font-size: 11px;
		font-weight: 700;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		margin-bottom: 4px;
	}

	.kpi-value {
		font-family: var(--font-display);
		font-size: 20px;
		font-weight: 800;
		color: var(--color-ink);
	}

	.kpi-value.sky {
		color: var(--color-money-away, #5DADE2);
	}

	@media (max-width: 768px) {
		.money-away-hero {
			flex-direction: column;
			align-items: flex-start;
			padding: 16px;
		}

		.hero-actions {
			width: 100%;
			justify-content: space-between;
		}

		.money-away-kpis {
			grid-template-columns: repeat(3, 1fr);
			overflow-x: auto;
		}
	}

	/* ─── Table Card Container ─── */
	.table-card-wrapper {
		position: relative;
		background: var(--color-surface, #ffffff);
		border: 1px solid var(--color-hairline, rgba(226, 232, 240, 0.85));
		border-radius: var(--radius-xl, 16px);
		overflow: hidden;
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.03), 0 1px 2px -1px rgba(0, 0, 0, 0.02);
		margin-top: var(--space-xl);
	}

	[data-theme="dark"] .table-card-wrapper {
		background: var(--color-surface, #0f172a);
		border-color: rgba(51, 65, 85, 0.7);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
	}

	.table-loading-bar {
		position: relative;
		height: 3px;
		width: 100%;
		background: var(--color-teal-bg, rgba(13, 148, 136, 0.15));
		overflow: hidden;
	}

	.loading-bar-fill {
		position: absolute;
		top: 0;
		left: 0;
		height: 100%;
		width: 40%;
		background: var(--color-teal, #0d9488);
		border-radius: var(--radius-pill, 9999px);
		animation: loadingBarProgress 1s infinite ease-in-out;
	}

	@keyframes loadingBarProgress {
		0% { left: -40%; width: 40%; }
		50% { width: 60%; }
		100% { left: 100%; width: 40%; }
	}

	.table-card-wrapper :global(.list-toolbar) {
		margin: 0;
		padding: var(--space-md) var(--space-lg);
		border-bottom: 1px solid var(--color-hairline, rgba(226, 232, 240, 0.85));
		background: var(--color-surface, #ffffff);
	}

	[data-theme="dark"] .table-card-wrapper :global(.list-toolbar) {
		background: var(--color-surface, #0f172a);
		border-bottom-color: rgba(51, 65, 85, 0.7);
	}

	.table-card-wrapper .bulk-bar {
		margin: 0;
		padding: var(--space-sm) var(--space-lg);
		border-top: none;
		border-left: none;
		border-right: none;
		border-bottom: 1px solid var(--color-hairline, rgba(226, 232, 240, 0.85));
		border-radius: 0;
		box-shadow: none;
		background: var(--color-surface, #ffffff);
	}

	[data-theme="dark"] .table-card-wrapper .bulk-bar {
		background: var(--color-surface, #0f172a);
		border-bottom-color: rgba(51, 65, 85, 0.7);
	}

	.table-card-wrapper :global(.iou-register),
	.table-card-wrapper :global(.iou-container) {
		border: none !important;
		border-radius: 0 !important;
		box-shadow: none !important;
	}

	.table-card-wrapper .pager-container {
		margin-top: 0;
		border-top: 1px solid var(--color-hairline, rgba(226, 232, 240, 0.85));
		padding: var(--space-md) var(--space-lg);
		background: var(--color-surface, #ffffff);
	}

	[data-theme="dark"] .table-card-wrapper .pager-container {
		background: var(--color-surface, #0f172a);
		border-top-color: rgba(51, 65, 85, 0.7);
	}

	/* ─── Bulk selection action bar (Selection Mode only) ─── */
	.bulk-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		margin-top: var(--space-md);
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

		.bulk-actions {
			display: grid;
			grid-template-columns: repeat(2, 1fr);
			gap: var(--space-xs);
			width: 100%;
		}
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
		color: var(--muted);
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

	.modal-actions {
		display: flex;
		gap: var(--space-sm);
		margin-top: var(--space-lg);
	}

	.modal-actions :global(.btn) {
		flex: 1;
	}

	@keyframes fadeSlideIn {
		from { opacity: 0; transform: translateY(10px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.toolbar-desktop {
		display: flex;
		align-items: center;
		flex: 1;
		min-width: 0;
	}

	.toolbar-mobile {
		display: none;
		flex: 1;
		min-width: 0;
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

	/* ─── Mobile toolbar rhythm — match /transactions (≤767px) ───
	   The toolbar is one compact band: unified Search|Filter pill, then the
	   single ViewToggle left-anchored below it, directly above the list. */
	@media (max-width: 767px) {
		.toolbar-desktop {
			display: none;
		}

		.toolbar-mobile {
			display: flex;
		}

		:global(main.main-content .list-toolbar) {
			margin-top: var(--space-md);
		}

		:global(main.main-content .list-toolbar .toolbar-views) {
			justify-content: flex-start;
		}
	}

	/* ─── Pager & Date Error Styles ─── */
	.pager-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-md);
		margin-top: var(--space-xl);
	}

	.pager {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		margin-top: 0;
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

	.pager-footer {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-md);
		flex-wrap: wrap;
	}

	.rows-per-page {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-family: var(--font-mono);
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	.rows-select {
		padding: 4px 8px;
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font-family: var(--font-mono);
		font-size: var(--font-size-xs);
		cursor: pointer;
	}

	.rows-select:focus-visible {
		outline: 2px solid var(--color-teal);
	}

	.pager-count {
		margin: 0;
		text-align: center;
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		letter-spacing: 0.02em;
	}

	.date-error-banner {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		margin-bottom: var(--space-md);
		border: 1px solid var(--color-coral);
		border-radius: var(--radius-lg);
		background: var(--color-coral-bg);
		color: var(--color-coral);
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-semibold);
	}
</style>
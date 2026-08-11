<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/stores';
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import PageHeader from '$lib/client/components/PageHeader.svelte';
	import SlideOver from '$lib/client/components/SlideOver.svelte';
	import PageBackground from '$lib/client/components/PageBackground.svelte';
	import LendingForm from '$lib/client/components/LendingForm.svelte';
	import ModalDialog from '$lib/client/components/ModalDialog.svelte';
	import LendingBalanceHeader from '$lib/client/components/LendingBalanceHeader.svelte';
	import LendingSummaryCards from '$lib/client/components/LendingSummaryCards.svelte';
	import ActiveIouList from '$lib/client/components/ActiveIouList.svelte';
	import RecordPaymentModal from '$lib/client/components/RecordPaymentModal.svelte';
	import PaymentHistoryPanel from '$lib/client/components/PaymentHistoryPanel.svelte';
	import EditPaymentModal from '$lib/client/components/EditPaymentModal.svelte';
	import DeletePaymentConfirmModal from '$lib/client/components/DeletePaymentConfirmModal.svelte';
	import Button from '$lib/client/components/Button.svelte';
	import OverflowMenu from '$lib/client/components/OverflowMenu.svelte';
	import ViewToggle from '$lib/client/components/ViewToggle.svelte';
	import ListToolbar from '$lib/client/components/ListToolbar.svelte';
	import SearchFilterPill from '$lib/client/components/SearchFilterPill.svelte';
	import LendingFilterToolbar from '$lib/client/components/LendingFilterToolbar.svelte';
	import LendingFilters from '$lib/client/components/LendingFilters.svelte';
	import CountChip from '$lib/client/components/CountChip.svelte';
	import ImportWizard from '$lib/client/components/ImportWizard.svelte';
	import { showSuccess, showError } from '$lib/client/stores/toast.svelte';
	import { downloadCsv, lendingsToCSV } from '$lib/client/utils/csv';
	import { generateBorrowedPdf } from '$lib/client/utils/pdf';
	import { getCurrentMonth } from '$lib/shared/utils/format';
	import { LENDING_IMPORT_FIELDS, buildMappedLendingRows, validateAllLendingRows, type MappedLendingRow } from '$lib/shared/utils/lendingImport';
	import type { ImportPreviewColumn, ImportMappingConfig, ImportValidationResult } from '$lib/shared/utils/importValidation';
	import type { PageData } from './$types';
	import type { Lending, LendingPayment, LendingWithPayments } from '$lib/types';

	let { data }: { data: PageData } = $props();

	let showPanel = $state(false);
	let editingLending = $state<Lending | null>(null);
	let viewMode = $state<'card' | 'table'>('card');
	let recordPaymentLending = $state<LendingWithPayments | null>(null);
	let deleteId = $state<number | null>(null);
	let historyLending = $state<LendingWithPayments | null>(null);
	let historyPayments = $state<LendingPayment[]>([]);
	let historyOpen = $state(false);
	let editPaymentLending = $state<LendingWithPayments | null>(null);
	let editPayment = $state<LendingPayment | null>(null);
	let deletePayment = $state<LendingPayment | null>(null);
	let editingLendingHasPayments = $state(false);
	let filtersOpen = $state(false);
	let importWizardOpen = $state(false);

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
			if (urlSearch !== searchInput) searchInput = urlSearch;
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
			goto(`/borrowed${newQs ? '?' + newQs : ''}`, {
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
			await goto(`/borrowed?${params.toString()}`, { keepFocus: true, noScroll: true });
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
		goto(`/borrowed?${params.toString()}`, { keepFocus: true, noScroll: true });
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
		if (total === 0) return 'No borrowings';
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

	function handleExportCsv() {
		const csv = lendingsToCSV(showLendings, 'borrowed');
		downloadCsv(csv, `borrowed-${new Date().toISOString().split('T')[0]}.csv`);
	}

	async function handleExportPdf() {
		if (showLendings.length === 0) {
			showError('No borrowings to export');
			return;
		}
		try {
			const doc = await generateBorrowedPdf(showLendings);
			doc.save(`borrowed-${new Date().toISOString().split('T')[0]}.pdf`);
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
			showSuccess('Borrowing duplicated');
			await invalidateAll();
		} catch (e) {
			showError((e as Error).message || 'Failed to duplicate borrowing');
		}
	}

	// ─── Import Wizard props ──────────────────────────────────────────
	const previewColumns = $derived<ImportPreviewColumn[]>([
		{ header: 'Validity', key: '_status', kind: 'status' },
		{ header: 'Lender', key: 'person_name', kind: 'text', cls: 'cell-desc' },
		{ header: 'Amount', key: 'amount', kind: 'amount', align: 'right' },
		{ header: 'Date Borrowed', key: 'date_lent', kind: 'date' },
		{ header: 'Due Date', key: 'due_date', kind: 'date' },
		{ header: 'Status', key: 'status', kind: 'badge' },
		{ header: 'Amount Repaid', key: 'recovered_amount', kind: 'amount', align: 'right' },
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
	<title>Borrowed — Finance Tracker</title>
</svelte:head>

<PageHeader title="Borrowed" flush borderless>
	{#snippet badge()}
		<CountChip count={data.total ?? 0} />
	{/snippet}
	{#snippet subtitle()}
		<span class="context-subline">{counts.active} active · {counts.paid} repaid</span>
	{/snippet}
	{#snippet action()}
		<div class="header-actions">
			<span class="desktop-only">
				<Button variant="primary" onclick={openAdd}>
					<span class="btn-lead" aria-hidden="true">+</span>
					New Borrowing
				</Button>
				<OverflowMenu
					onImportCsv={() => (importWizardOpen = true)}
					onExportCsv={handleExportCsv}
					onExportPdf={handleExportPdf}
				/>
			</span>
			<span class="mobile-only">
				<OverflowMenu
					onImportCsv={() => (importWizardOpen = true)}
					onExportCsv={handleExportCsv}
					onExportPdf={handleExportPdf}
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
	<LendingForm
			lendingRecord={editingLending ?? undefined}
			onCancel={closePanel}
			onSuccess={closePanel}
			hasPayments={editingLendingHasPayments}
			direction="borrowed"
		/>
</SlideOver>

<!-- ═══ Import Wizard Modal ═══ -->
<ImportWizard
	open={importWizardOpen}
	onClose={() => (importWizardOpen = false)}
	fields={LENDING_IMPORT_FIELDS}
	columns={previewColumns}
	buildRows={buildRows}
	validateRows={validateRows as unknown as (rows: Record<string, unknown>[], deps: Record<string, unknown>, config: ImportMappingConfig) => ImportValidationResult<Record<string, unknown>>}
	deps={importDeps}
	title="Import Borrowings"
	noun="borrowings"
	sampleHref="/borrowed-sample.csv"
	sampleFilename="borrowed-sample.csv"
	templateHref="/templates/borrowed.xlsx"
	templateFilename="borrowed-import-template.xlsx"
	direction="borrowed"
/>

<!-- ═══ ListToolbar: unified Search|Filter pill (left), view mode (right) ═══ -->
<ListToolbar>
	{#snippet filters()}
		<div class="toolbar-desktop">
			<LendingFilterToolbar
				bind:value={searchInput}
				activeFilters={{
					status: activeTab,
					date: dateFilters.date,
					customFrom: dateFilters.customFrom,
					customTo: dateFilters.customTo,
				}}
				{counts}
				paidLabel="Repaid"
				onFilterChange={(f) => {
					activeTab = f.status;
					dateFilters = { date: f.date, customFrom: f.customFrom, customTo: f.customTo };
				}}
				onClearAll={() => {
					searchInput = '';
					activeTab = 'active';
					dateFilters = { date: '', customFrom: '', customTo: '' };
				}}
				placeholder="Search borrower, lender, notes…"
				ariaLabel="Search borrowings"
			/>
		</div>
		<div class="toolbar-mobile">
			<SearchFilterPill
				bind:value={searchInput}
				bind:open={filtersOpen}
				activeFilterCount={activeFilterCount}
				placeholder="Search borrower, lender, notes…"
				ariaLabel="Search borrowings"
				filterAriaLabel="Filter borrowings"
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
							dateFilters = { date: f.date, customFrom: f.customFrom, customTo: f.customTo };
						}}
						counts={counts}
						paidLabel="Repaid"
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
			ariaLabel="Borrowing list view"
			slidingThumb
			stretch
		/>
	{/snippet}
</ListToolbar>

<!-- ═══ Invalid date range alert ═══ -->
{#if data.dateError}
	<div class="date-error-banner" role="alert">
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
		<span>{data.dateError}</span>
	</div>
{/if}

<ActiveIouList
	ious={showLendings}
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
			editingLendingHasPayments = l.resolved_total > 0;
			openEdit(l);
		}
	}}
	onDelete={(id) => deleteId = id}
	onDuplicate={handleDuplicate}
	direction="borrowed"
	viewMode={viewMode}
/>

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

<!-- ═══ Record Payment Modal ═══ -->
{#if recordPaymentLending}
	<RecordPaymentModal
		lending={recordPaymentLending}
		direction="borrowed"
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
			direction="borrowed"
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
		direction="borrowed"
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
				<Button variant="danger" type="submit">Delete</Button>
				<Button variant="ghost" type="button" onclick={() => deleteId = null}>Cancel</Button>
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
		color: var(--muted);
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

	.modal-actions {
		display: flex;
		gap: var(--space-sm);
		margin-top: var(--space-lg);
	}

	.modal-actions :global(.btn) {
		flex: 1;
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
	   One compact band: unified Search|Filter pill, then the single ViewToggle
	   left-anchored below it, directly above the list. */
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
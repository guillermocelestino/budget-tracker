<script lang="ts">
	import { untrack } from 'svelte';
	import { page, navigating } from '$app/stores';
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import PageBackground from '$lib/client/components/PageBackground.svelte';
	import Button from '$lib/client/components/Button.svelte';
	import OverflowMenu from '$lib/client/components/OverflowMenu.svelte';
	import SearchFilterPill from '$lib/client/components/SearchFilterPill.svelte';
	import FilterFooter from '$lib/client/components/FilterFooter.svelte';
	import ModalDialog from '$lib/client/components/ModalDialog.svelte';
	import EmptyState from '$lib/client/components/EmptyState.svelte';
	import ActiveIouList from '$lib/client/components/ActiveIouList.svelte';
	import RecurringList from '$lib/client/components/RecurringList.svelte';
	import MoneyCommittedModal from '$lib/client/components/MoneyCommittedModal.svelte';
	import BorrowedMoneyModal from '$lib/client/components/BorrowedMoneyModal.svelte';
	import RecurringForm from '$lib/client/components/RecurringForm.svelte';
	import RecordPaymentModal from '$lib/client/components/RecordPaymentModal.svelte';
	import PaymentHistoryPanel from '$lib/client/components/PaymentHistoryPanel.svelte';
	import EditPaymentModal from '$lib/client/components/EditPaymentModal.svelte';
	import DeletePaymentConfirmModal from '$lib/client/components/DeletePaymentConfirmModal.svelte';
	import ImportWizard from '$lib/client/components/ImportWizard.svelte';
	import LendingFilters from '$lib/client/components/LendingFilters.svelte';
	import MobileMoneyPunchOverlay, { type PunchType } from '$lib/client/components/dashboard/MobileMoneyPunchOverlay.svelte';
	import { showSuccess, showError } from '$lib/client/stores/toast.svelte';
	import { downloadCsv, lendingsToCSV, transactionsToCSV } from '$lib/client/utils/csv';
	import { generateBorrowedPdf } from '$lib/client/utils/pdf';
	import { getCurrentMonth } from '$lib/shared/utils/format';
	import {
		LENDING_IMPORT_FIELDS,
		buildMappedLendingRows,
		validateAllLendingRows,
		type MappedLendingRow
	} from '$lib/shared/utils/lendingImport';
	import type {
		ImportPreviewColumn,
		ImportMappingConfig
	} from '$lib/shared/utils/importValidation';
	import type { Category, Lending, LendingPayment, LendingWithPayments, RecurringTransaction } from '$lib/types';

	type WorkspacePageData = {
		view?: 'borrowed' | 'recurring';
		lendings?: LendingWithPayments[];
		recurring?: RecurringTransaction[];
		borrowedCounts?: { all: number; active: number; paid: number };
		counts?: { all: number; active: number; paid: number };
		activeCount?: number;
		moneyCommittedStats?: { debtOwed: number; borrowedActiveCount: number };
		total?: number;
		page?: number;
		totalPages?: number;
		limit?: number;
		categories?: Category[];
		dateError?: string | null;
	};

	let {
		data,
		initialView = 'borrowed'
	}: {
		data: WorkspacePageData;
		initialView?: 'borrowed' | 'recurring';
	} = $props();

	// ─── ACTIVE VIEW ───
	const urlView = $derived($page.url.searchParams.get('view'));
	const activeView = $derived<'borrowed' | 'recurring'>(
		urlView === 'recurring' ? 'recurring' : urlView === 'borrowed' ? 'borrowed' : initialView
	);

	const borrowedActiveCount = $derived(
		data.borrowedCounts?.active ?? data.counts?.active ?? data.moneyCommittedStats?.borrowedActiveCount ?? 0
	);
	const recurringActiveCount = $derived(data.activeCount ?? 0);

	function switchView(targetView: 'borrowed' | 'recurring') {
		if (targetView === activeView) return;
		const params = new URLSearchParams($page.url.searchParams);
		params.set('view', targetView);
		params.set('page', '1');

		if (targetView === 'borrowed') {
			params.delete('type');
			params.delete('frequency');
			params.delete('category');
			params.delete('category_id');
		} else {
			params.delete('from');
			params.delete('to');
			params.delete('date_from');
			params.delete('date_to');
			params.delete('date');
		}

		selectionMode = false;
		selectedIds = new Set();

		const canonicalPath = $page.url.pathname.startsWith('/borrowed') ? '/borrowed' : '/recurring';
		goto(`${canonicalPath}?${params.toString()}`, { keepFocus: true, noScroll: true });
	}

	// ─── SEARCH & FILTER STATE ───
	let searchInput = $state($page.url.searchParams.get('search') || '');
	let searchTerm = $state($page.url.searchParams.get('search') || '');

	// Synchronize search input from URL changes
	$effect(() => {
		const urlSearch = $page.url.searchParams.get('search') ?? '';
		untrack(() => {
			if (searchTerm === searchInput && urlSearch !== searchInput) {
				searchInput = urlSearch;
			}
		});
	});

	// Debounce search input typing
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

	// Borrowed filter state
	const urlFrom = $page.url.searchParams.get('from') || $page.url.searchParams.get('date_from') || '';
	const urlTo = $page.url.searchParams.get('to') || $page.url.searchParams.get('date_to') || '';
	const rawUrlDate = $page.url.searchParams.get('date') || '';
	const urlDate = rawUrlDate || (urlFrom || urlTo ? 'custom' : '');
	const urlStatus = ($page.url.searchParams.get('status') as 'all' | 'active' | 'paid') || 'active';

	let borrowedStatus = $state<'all' | 'active' | 'paid'>(urlStatus);
	let borrowedDateFilters = $state({
		date: urlDate,
		customFrom: urlFrom,
		customTo: urlTo
	});

	// Recurring filter state
	let recurringFilters = $state({
		type: $page.url.searchParams.get('type') || '',
		frequency: $page.url.searchParams.get('frequency') || '',
		status: $page.url.searchParams.get('status') || '',
		category: $page.url.searchParams.get('category') || $page.url.searchParams.get('category_id') || ''
	});

	let filtersOpen = $state(false);
	let punchData = $state<{ type: PunchType; amount: number } | null>(null);

	// Sync filter modifications to URL
	$effect(() => {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('view', activeView);

		if (searchTerm) {
			params.set('search', searchTerm);
		} else {
			params.delete('search');
		}

		if (activeView === 'borrowed') {
			if (borrowedStatus !== 'active') {
				params.set('status', borrowedStatus);
			} else {
				params.delete('status');
			}

			if (borrowedDateFilters.date) {
				if (borrowedDateFilters.date === 'custom') {
					if (borrowedDateFilters.customFrom) params.set('from', borrowedDateFilters.customFrom);
					if (borrowedDateFilters.customTo) params.set('to', borrowedDateFilters.customTo);
				} else {
					const range = dateRangeFromFilter(
						borrowedDateFilters.date,
						borrowedDateFilters.customFrom,
						borrowedDateFilters.customTo
					);
					if (range.from) params.set('from', range.from);
					if (range.to) params.set('to', range.to);
				}
			} else {
				params.delete('from');
				params.delete('to');
				params.delete('date_from');
				params.delete('date_to');
				params.delete('date');
			}
		} else {
			// Recurring
			if (recurringFilters.status) params.set('status', recurringFilters.status);
			else params.delete('status');

			if (recurringFilters.type) params.set('type', recurringFilters.type);
			else params.delete('type');

			if (recurringFilters.frequency) params.set('frequency', recurringFilters.frequency);
			else params.delete('frequency');

			if (recurringFilters.category) params.set('category', recurringFilters.category);
			else params.delete('category');
		}

		const newQs = params.toString();
		const currentQs = new URLSearchParams($page.url.searchParams).toString();

		if (newQs !== currentQs) {
			const canonicalPath = $page.url.pathname.startsWith('/borrowed') ? '/borrowed' : '/recurring';
			goto(`${canonicalPath}?${newQs}`, { keepFocus: true, noScroll: true });
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
					to: sun.toISOString().slice(0, 10)
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

	// ─── BULK SELECTION MODE ───
	let selectionMode = $state(false);
	let selectedIds = $state(new Set<number>());

	const currentItems = $derived(
		activeView === 'borrowed'
			? (data.lendings ?? [])
			: (data.recurring ?? [])
	);
	const pageIds = $derived(currentItems.map((item) => item.id));
	const selectedOnPage = $derived(pageIds.filter((id: number) => selectedIds.has(id)).length);
const allSelected = $derived(pageIds.length > 0 && selectedOnPage === pageIds.length);
const someSelected = $derived(selectedOnPage > 0 && !allSelected);
const selectedCount = $derived(selectedIds.size);

function setIndeterminate(node: HTMLInputElement, indeterminate: boolean) {
	node.indeterminate = indeterminate;
	return {
		update(indeterminate: boolean) {
			node.indeterminate = indeterminate;
		}
	};
}

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

	// Reset bulk selection on page/view/filter change
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

	// ─── PAGINATION HANDLERS ───
	async function goToPage(p: number) {
		const y = window.scrollY;
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', String(p));
		const canonicalPath = $page.url.pathname.startsWith('/borrowed') ? '/borrowed' : '/recurring';
		try {
			await goto(`${canonicalPath}?${params.toString()}`, { keepFocus: true, noScroll: true });
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
		const canonicalPath = $page.url.pathname.startsWith('/borrowed') ? '/borrowed' : '/recurring';
		goto(`${canonicalPath}?${params.toString()}`, { keepFocus: true, noScroll: true });
	}

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
		if (data.dateError) return data.dateError;
		const total = data.total ?? 0;
		if (total === 0) return '0 items';
		const page = data.page ?? 1;
		const limit = data.limit ?? 20;
		if (limit === 0 || limit >= total) return `Showing 1–${total} of ${total}`;
		const start = (page - 1) * limit + 1;
		const end = Math.min(page * limit, total);
		return `Showing ${start}–${end} of ${total}`;
	});

// ─── MODAL STATES & HANDLERS ───
// Borrowed Modals
let showBorrowedModal = $state(false);
let editingLending = $state<Lending | null>(null);
let recordPaymentLending = $state<LendingWithPayments | null>(null);
let historyLending = $state<LendingWithPayments | null>(null);
let historyPayments = $state<LendingPayment[]>([]);
let historyOpen = $state(false);
let editPaymentLending = $state<LendingWithPayments | null>(null);
let editPayment = $state<LendingPayment | null>(null);
let deletePayment = $state<LendingPayment | null>(null);
let importWizardOpen = $state(false);

// Recurring Modals
let showAddRecurringModal = $state(false);
let editingRecurring = $state<RecurringTransaction | null>(null);

// Delete Modal (shared target)
let deleteTarget = $state<number | number[] | null>(null);

// Trigger + Add CTA based on active view
function handlePrimaryAdd() {
	if (activeView === 'borrowed') {
		editingLending = null;
		showBorrowedModal = true;
	} else {
		showAddRecurringModal = true;
	}
}

// Borrowed Actions
function handlePayBorrowed(id: number) {
	const target = (data.lendings ?? []).find((l) => l.id === id);
	if (target) recordPaymentLending = target;
}

function handleEditBorrowed(id: number) {
	const target = (data.lendings ?? []).find((l) => l.id === id);
	if (target) {
		editingLending = target;
		showBorrowedModal = true;
	}
}

	function handleDeleteBorrowed(id: number) {
		deleteTarget = id;
	}

	async function handleDuplicateBorrowed(id: number) {
		const src = (data.lendings ?? []).find((l) => l.id === id);
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
					status: src.status
				})
			});
			if (!res.ok) throw new Error((await res.json()).error || 'Duplicate failed');
			showSuccess('Borrowing duplicated');
			await invalidateAll();
		} catch (_e) {
			showError('Failed to duplicate borrowing');
		}
	}

	async function handleViewHistoryBorrowed(id: number) {
		const target = (data.lendings ?? []).find((l) => l.id === id);
		if (!target) return;
		historyLending = target;
		try {
			const res = await fetch(`/api/lendings/${id}/payments`);
			if (res.ok) historyPayments = await res.json();
			else historyPayments = target.payments ?? [];
		} catch {
			historyPayments = target.payments ?? [];
		}
		historyOpen = true;
	}

// Recurring Actions
function handleEditRecurring(item: RecurringTransaction) {
	editingRecurring = item;
}

	function handleDeleteRecurring(id: number) {
		deleteTarget = id;
	}

	async function handleDuplicateRecurring(id: number) {
		try {
			const res = await fetch(`/api/recurring/${id}/duplicate`, { method: 'POST' });
			if (!res.ok) throw new Error('Failed to duplicate recurring schedule');
			showSuccess('Recurring schedule duplicated');
			await invalidateAll();
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function handleRunNowRecurring(id: number) {
		try {
			const res = await fetch(`/api/recurring/${id}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'runNow' })
			});
			if (!res.ok) {
				const errData = await res.json().catch(() => ({}));
				throw new Error(errData.error || 'Failed to execute recurring schedule');
			}
			const data = await res.json();
			if (data.amount && data.amount > 0) {
				punchData = { type: 'recurring', amount: data.amount };
			}
			showSuccess('Recurring transaction executed');
			await invalidateAll();
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function handlePauseRecurring(id: number) {
		try {
			const res = await fetch(`/api/recurring/${id}/toggle`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ active: false })
			});
			if (!res.ok) throw new Error('Failed to pause recurring schedule');
			showSuccess('Recurring schedule paused');
			await invalidateAll();
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function handleResumeRecurring(id: number) {
		try {
			const res = await fetch(`/api/recurring/${id}/toggle`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ active: true })
			});
			if (!res.ok) throw new Error('Failed to resume recurring schedule');
			showSuccess('Recurring schedule activated');
			await invalidateAll();
		} catch (e) {
			showError((e as Error).message);
		}
	}

	// CSV / PDF Exports
	function handleExportCsv() {
		if (activeView === 'borrowed') {
			const csv = lendingsToCSV(data.lendings ?? [], 'borrowed');
			downloadCsv(csv, `borrowed-${new Date().toISOString().split('T')[0]}.csv`);
		} else {
			const csv = transactionsToCSV((data.recurring as unknown as Parameters<typeof transactionsToCSV>[0]) ?? []);
			downloadCsv(csv, `recurring-${new Date().toISOString().split('T')[0]}.csv`);
		}
	}

	async function handleExportPdf() {
		if (activeView === 'borrowed') {
			try {
				const doc = await generateBorrowedPdf(data.lendings ?? []);
				doc.save(`borrowed-${new Date().toISOString().split('T')[0]}.pdf`);
			} catch (_e) {
				showError('Failed to generate PDF');
			}
		}
	}

	// Borrowed Import Wizard
	const existingPeople = $derived(
		Array.from(new Set((data.lendings ?? []).map((l) => l.borrower_name)))
	);
	const previewColumns = $derived<ImportPreviewColumn[]>([
		{ header: 'Validity', key: '_status', kind: 'status' },
		{ header: 'Lender', key: 'person_name', kind: 'text', cls: 'cell-desc' },
		{ header: 'Amount', key: 'amount', kind: 'amount', align: 'right' },
		{ header: 'Date Borrowed', key: 'date_lent', kind: 'date' },
		{ header: 'Due Date', key: 'due_date', kind: 'date' },
		{ header: 'Status', key: 'status', kind: 'badge' },
		{ header: 'Amount Repaid', key: 'recovered_amount', kind: 'amount', align: 'right' }
	]);

	function buildRows(rawRows: string[][], headers: string[], mapping: Record<string, string>, config: ImportMappingConfig) {
		return buildMappedLendingRows(rawRows, headers, mapping, config);
	}

	function validateRows(rows: Record<string, unknown>[], deps: Record<string, unknown>, config: ImportMappingConfig) {
		const result = validateAllLendingRows(rows as unknown as MappedLendingRow[], deps.existingPeople as string[], config);
		return result;
	}

	const importDeps = $derived({ existingPeople });
</script>

<svelte:head>
	<title>Committed Money — GET WRECK</title>
</svelte:head>

<PageBackground />

<!-- ═══════════════════════════════════════════════════════════════════════════
     COMMITTED MONEY UNIFIED WORKSPACE (DESKTOP UX)
     ═══════════════════════════════════════════════════════════════════════════ -->
<div class="page-container page-container--workspace">
	<div class="committed-workspace">
		<!-- ─── Page Header ─── -->
		<header class="workspace-header flip7-card accent-gold">
			<div class="header-main">
				<div class="title-group">
					<h1 class="page-title">COMMITTED MONEY</h1>
					<p class="page-subtitle">Money you've borrowed or committed to future payments.</p>
				</div>
				<div class="header-actions">
					<OverflowMenu
						onImportCsv={activeView === 'borrowed' ? () => (importWizardOpen = true) : undefined}
						onExportCsv={handleExportCsv}
						onExportPdf={activeView === 'borrowed' ? handleExportPdf : undefined}
						onSelect={() => { selectionMode = true; selectedIds = new Set(); }}
					/>
				</div>
			</div>

			<!-- ─── View Switcher Segmented Control + Domain-Specific Add CTA ─── -->
			<div class="switcher-wrapper">
				<div class="segmented-control" role="radiogroup" aria-label="Select Committed Money View">
					<button
						type="button"
						class="seg-btn"
						class:active={activeView === 'borrowed'}
						role="radio"
						aria-checked={activeView === 'borrowed'}
						onclick={() => switchView('borrowed')}
					>
						<span class="seg-label">🤝 BORROWED</span>
						<span class="seg-badge">{borrowedActiveCount}</span>
					</button>
					<button
						type="button"
						class="seg-btn"
						class:active={activeView === 'recurring'}
						role="radio"
						aria-checked={activeView === 'recurring'}
						onclick={() => switchView('recurring')}
					>
						<span class="seg-label">🔁 RECURRING</span>
						<span class="seg-badge">{recurringActiveCount}</span>
					</button>
				</div>
				<button
					type="button"
					class="header-add-cta"
					onclick={handlePrimaryAdd}
					aria-label={activeView === 'borrowed' ? 'Add Borrowed' : 'Add Recurring'}
				>
					{activeView === 'borrowed' ? '+ Add Borrowed' : '+ Add Recurring'}
				</button>
			</div>
		</header>

		<!-- ─── Table Card Container (Toolbar + Active Table + Pager) ─── -->
		<div class="table-card-wrapper flip7-card accent-teal">
		{#if isSearching}
			<div class="table-loading-bar" role="progressbar" aria-label="Loading data">
				<div class="loading-bar-fill"></div>
			</div>
		{/if}

		<!-- ─── Adaptive Toolbar ─── -->
		<div class="table-toolbar">
			<SearchFilterPill
				bind:value={searchInput}
				loading={isSearching}
				placeholder={activeView === 'borrowed' ? 'Search borrowed loans...' : 'Search recurring commitments...'}
				bind:open={filtersOpen}
			>
				{#snippet panel(_mode: 'popover' | 'sheet', closePanel: () => void)}
					{#if activeView === 'borrowed'}
						<div class="filter-panel">
							<LendingFilters
								status={borrowedStatus}
								counts={data.borrowedCounts ?? data.counts}
								onStatusChange={(st) => (borrowedStatus = st)}
								onFilterChange={(df) => {
									borrowedStatus = df.status;
									borrowedDateFilters = { date: df.date, customFrom: df.customFrom, customTo: df.customTo };
								}}
								onApply={() => closePanel()}
							/>
						</div>
					{:else}
						<div class="filter-panel recurring-filter-panel">
							<div class="filter-group">
								<label for="rec-status-filter" class="filter-label">Status</label>
								<select id="rec-status-filter" class="filter-select" bind:value={recurringFilters.status}>
									<option value="">All Statuses</option>
									<option value="active">Active</option>
									<option value="paused">Paused</option>
								</select>
							</div>
							<div class="filter-group">
								<label for="rec-type-filter" class="filter-label">Type</label>
								<select id="rec-type-filter" class="filter-select" bind:value={recurringFilters.type}>
									<option value="">All Types</option>
									<option value="expense">Expense</option>
									<option value="income">Income</option>
								</select>
							</div>
							<div class="filter-group">
								<label for="rec-freq-filter" class="filter-label">Frequency</label>
								<select id="rec-freq-filter" class="filter-select" bind:value={recurringFilters.frequency}>
									<option value="">All Frequencies</option>
									<option value="daily">Daily</option>
									<option value="weekly">Weekly</option>
									<option value="monthly">Monthly</option>
									<option value="yearly">Yearly</option>
								</select>
							</div>
							{#if data.categories && data.categories.length > 0}
								<div class="filter-group">
									<label for="rec-cat-filter" class="filter-label">Category</label>
									<select id="rec-cat-filter" class="filter-select" bind:value={recurringFilters.category}>
										<option value="">All Categories</option>
										{#each data.categories as cat (cat.id)}
											<option value={String(cat.id)}>{cat.name}</option>
										{/each}
									</select>
								</div>
							{/if}
							<FilterFooter
								onApply={() => closePanel()}
							/>
						</div>
					{/if}
				{/snippet}
			</SearchFilterPill>
		</div>

		<!-- ─── Selection Mode Bulk Bar ─── -->
		{#if selectionMode && pageIds.length > 0}
			<div
				class="bulk-bar flip7-card accent-gold"
				role="toolbar"
				aria-label={activeView === 'borrowed' ? 'Selected borrowings' : 'Selected recurring transactions'}
			>
				<div class="bulk-left">
					<input
						type="checkbox"
						checked={allSelected}
						use:setIndeterminate={someSelected}
						onchange={toggleAll}
						aria-label="Select all items on this page"
					/>
					<span class="bulk-count">{selectedCount} selected</span>
				</div>
				<div class="bulk-actions">
					<Button variant="danger" size="sm" disabled={selectedCount === 0} onclick={() => (deleteTarget = Array.from(selectedIds))}>Delete Selected</Button>
					<Button variant="ghost" size="sm" onclick={exitSelectionMode}>Cancel</Button>
				</div>
			</div>
		{/if}

		<!-- ─── Active Table View ─── -->
		<div class="table-content-area">
			{#if activeView === 'borrowed'}
				{#if (data.lendings ?? []).length === 0}
					<EmptyState
						title="No borrowed money records"
						description="You don't have any money borrowed from lenders matching current filters."
						actionLabel="+ Add Borrowed"
						onAction={handlePrimaryAdd}
					/>
				{:else}
					<ActiveIouList
						ious={data.lendings ?? []}
						direction="borrowed"
						viewMode="table"
						{selectionMode}
						{selectedIds}
						onToggleSelection={toggleSelection}
						onPay={handlePayBorrowed}
						onEdit={handleEditBorrowed}
						onDelete={handleDeleteBorrowed}
						onDuplicate={handleDuplicateBorrowed}
						onViewHistory={handleViewHistoryBorrowed}
					/>
				{/if}
			{:else}
				{#if (data.recurring ?? []).length === 0}
					<EmptyState
						title="No recurring commitments"
						description="You haven't scheduled any recurring financial commitments yet."
						actionLabel="+ Add Recurring"
						onAction={handlePrimaryAdd}
					/>
				{:else}
					<RecurringList
						recurring={data.recurring ?? []}
						{selectionMode}
						{selectedIds}
						onToggleSelection={toggleSelection}
						onEdit={handleEditRecurring}
						onDelete={handleDeleteRecurring}
						onDuplicate={handleDuplicateRecurring}
						onRunNow={handleRunNowRecurring}
						onPause={handlePauseRecurring}
						onResume={handleResumeRecurring}
					/>
				{/if}
			{/if}
		</div>

		<!-- ─── Pagination Footer ─── -->
		{#if (data.totalPages ?? 0) > 0}
			<div class="table-pager">
				{#if (data.totalPages ?? 0) > 1}
					<nav class="pager-nav" aria-label="Pagination Navigation">
						<button
							class="pager-btn"
							disabled={(data.page ?? 1) <= 1}
							onclick={() => goToPage((data.page ?? 1) - 1)}
							aria-label="Previous page"
						>
							‹
						</button>
						{#each pageItems(data.page ?? 1, data.totalPages ?? 1) as p, i (i)}
							{#if p === '…'}
								<span class="pager-ellipsis">…</span>
							{:else}
								<button
									class="pager-btn"
									class:active={p === data.page}
									onclick={() => goToPage(p as number)}
								>
									{p}
								</button>
							{/if}
						{/each}
						<button
							class="pager-btn"
							disabled={(data.page ?? 1) >= (data.totalPages ?? 1)}
							onclick={() => goToPage((data.page ?? 1) + 1)}
							aria-label="Next page"
						>
							›
						</button>
					</nav>
				{/if}

				<div class="pager-footer">
					<span class="pager-count">{countLabel}</span>
					<div class="rows-per-page">
						<label for="workspace-rows-select">Rows per page:</label>
						<select
							id="workspace-rows-select"
							class="rows-select"
							value={data.limit === 0 ? 'all' : String(data.limit ?? 20)}
							onchange={(e) => handleLimitChange(e.currentTarget.value)}
						>
							<option value="20">20</option>
							<option value="50">50</option>
							<option value="100">100</option>
							<option value="200">200</option>
							<option value="500">500</option>
						</select>
					</div>
				</div>
			</div>
		{/if}
	</div>

	</div>
</div>

<!-- ═══════════════════════════════════════════════════════════════════════════
     MODAL DIALOGS (REUSED INFRASTRUCTURE)
     ═══════════════════════════════════════════════════════════════════════════ -->

<!-- Borrowed Create/Edit Modal (dedicated domain modal) -->
<BorrowedMoneyModal
	open={showBorrowedModal}
	lendingRecord={editingLending ?? undefined}
	onClose={() => (showBorrowedModal = false)}
	onSuccess={(payload) => {
		if (!editingLending && payload && payload.amount > 0) {
			punchData = { type: 'borrowed', amount: payload.amount };
		}
		showBorrowedModal = false;
		invalidateAll();
	}}
/>

<!-- Record Payment Modal -->
{#if recordPaymentLending}
	<RecordPaymentModal
		lending={recordPaymentLending}
		direction="borrowed"
		onclose={() => (recordPaymentLending = null)}
		onSuccess={(payload) => {
			if (payload && payload.amount > 0) {
				punchData = { type: 'repaid', amount: payload.amount };
			}
		}}
	/>
{/if}

{#if punchData}
	<MobileMoneyPunchOverlay
		type={punchData.type}
		amount={punchData.amount}
		onComplete={() => (punchData = null)}
	/>
{/if}

<!-- Payment History Panel -->
{#if historyOpen && historyLending}
	<ModalDialog
		open={historyOpen}
		title="Payment History"
		subtitle={historyLending.borrower_name}
		onclose={() => {
			historyOpen = false;
			historyLending = null;
			historyPayments = [];
		}}
	>
		<PaymentHistoryPanel
			lending={historyLending}
			payments={historyPayments}
			direction="borrowed"
			onRecordPayment={() => {
				if (historyLending) {
					historyOpen = false;
					recordPaymentLending = historyLending;
				}
			}}
			onEditPayment={(paymentId) => {
				if (historyLending) {
					const p = historyPayments.find((x) => x.id === paymentId);
					if (p) {
						historyOpen = false;
						editPayment = p;
						editPaymentLending = historyLending;
					}
				}
			}}
			onDeletePayment={(paymentId) => {
				const p = historyPayments.find((x) => x.id === paymentId);
				if (p) {
					historyOpen = false;
					deletePayment = p;
				}
			}}
		/>
	</ModalDialog>
{/if}

<!-- Edit Payment Modal -->
{#if editPayment && editPaymentLending}
	<EditPaymentModal
		payment={editPayment}
		lending={editPaymentLending}
		direction="borrowed"
		onclose={() => {
			editPayment = null;
			editPaymentLending = null;
		}}
	/>
{/if}

<!-- Delete Payment Confirm Modal -->
{#if deletePayment}
	<DeletePaymentConfirmModal
		payment={deletePayment}
		direction="borrowed"
		onclose={() => (deletePayment = null)}
	/>
{/if}

<!-- Borrowed Import Wizard -->
{#if importWizardOpen}
	<ImportWizard
		open={importWizardOpen}
		title="Import Borrowings"
		sampleHref="/borrowed-sample.csv"
		sampleFilename="borrowed-sample.csv"
		fields={LENDING_IMPORT_FIELDS}
		columns={previewColumns}
		buildRows={buildRows}
		validateRows={validateRows as unknown as (rows: Record<string, unknown>[], deps: Record<string, unknown>, config: ImportMappingConfig) => import('$lib/shared/utils/importValidation').ImportValidationResult<Record<string, unknown>>}
		deps={importDeps}
		direction="borrowed"
		onClose={() => (importWizardOpen = false)}
	/>
{/if}

<!-- Recurring Create Modal (dedicated domain modal) -->
<MoneyCommittedModal
	open={showAddRecurringModal}
	categories={data.categories ?? []}
	onClose={() => (showAddRecurringModal = false)}
	onSuccess={(payload) => {
		if (payload && payload.amount > 0) {
			punchData = { type: 'recurring', amount: payload.amount };
		}
		showAddRecurringModal = false;
		invalidateAll();
	}}
/>

<!-- Recurring Edit Modal (dedicated domain modal) -->
{#if editingRecurring}
	<ModalDialog
		open={true}
		title="Edit Recurring Transaction"
		subtitle="Modify the recurring template"
		size="wide"
		onclose={() => (editingRecurring = null)}
	>
		<RecurringForm
			categories={data.categories ?? []}
			recurring={editingRecurring}
			action={`/recurring/${editingRecurring.id}?/update`}
			onSuccess={() => {
				editingRecurring = null;
				invalidateAll();
			}}
			onCancel={() => (editingRecurring = null)}
		/>
	</ModalDialog>
{/if}

<!-- Delete Modal (Shared) -->
{#if deleteTarget !== null}
	{@const isBulk = Array.isArray(deleteTarget)}
	{@const deleteCount = Array.isArray(deleteTarget) ? deleteTarget.length : 1}
	{@const deleteIdsStr = Array.isArray(deleteTarget) ? deleteTarget.join(',') : String(deleteTarget)}
	<ModalDialog
		open={deleteTarget !== null}
		title={
			activeView === 'borrowed'
				? isBulk
					? 'Delete Borrowings'
					: 'Delete Borrowing'
				: isBulk
				? 'Delete Recurring Transactions'
				: 'Delete Recurring Transaction'
		}
		onclose={() => (deleteTarget = null)}
	>
		<p>
			Are you sure you want to delete {isBulk
				? `${deleteCount} items`
				: activeView === 'borrowed'
				? 'this borrowing record'
				: 'this recurring transaction'}? This action cannot be undone.
		</p>
		{#if isBulk}
			<form
				method="POST"
				action={activeView === 'borrowed' ? '/borrowed?/deleteBulk' : '/recurring?/deleteBulk'}
				use:enhance={() => {
					return async ({ result }) => {
						if (result.type === 'success') {
							showSuccess(`Deleted ${deleteCount} items.`);
							deleteTarget = null;
							exitSelectionMode();
							await invalidateAll();
						} else {
							showError('Failed to delete items.');
						}
					};
				}}
			>
				<input type="hidden" name="id" value={deleteIdsStr} />
				<div class="modal-actions">
					<Button variant="ghost" onclick={() => (deleteTarget = null)}>Cancel</Button>
					<Button variant="danger" type="submit">Delete</Button>
				</div>
			</form>
		{:else}
			<form
				method="POST"
				action={activeView === 'borrowed' ? '/borrowed?/delete' : '/api/recurring/delete'}
				use:enhance={() => {
					return async ({ result }) => {
						if (result.type === 'success' || result.type === 'redirect') {
							showSuccess('Deleted successfully.');
							deleteTarget = null;
							await invalidateAll();
						} else {
							showError('Failed to delete item.');
						}
					};
				}}
			>
				<input type="hidden" name="id" value={deleteTarget} />
				<div class="modal-actions">
					<Button variant="ghost" onclick={() => (deleteTarget = null)}>Cancel</Button>
					<Button variant="danger" type="submit">Delete</Button>
				</div>
			</form>
		{/if}
	</ModalDialog>
{/if}

	<style>
		/* ─── Domain-Specific Add CTA (Header) ─── */
		.header-add-cta {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			height: 40px;
			padding: 0 20px;
			border-radius: var(--radius-pill, 9999px);
			background: var(--color-money-committed, #D97706);
			color: #000000;
			border: 1px solid rgba(255, 255, 255, 0.4);
			font-family: var(--font-display);
			font-size: 13px;
			font-weight: 800;
			letter-spacing: 0.04em;
			cursor: pointer;
			box-shadow: 0 4px 20px rgba(217, 119, 6, 0.45), 0 2px 8px rgba(20, 48, 46, 0.12);
			transition: transform 200ms var(--ease), box-shadow 200ms var(--ease), background 200ms var(--ease);
			-webkit-tap-highlight-color: transparent;
			white-space: nowrap;
		}

		.header-add-cta:hover {
			background: #F59E0B;
			box-shadow: 0 8px 28px rgba(217, 119, 6, 0.60), 0 4px 12px rgba(20, 48, 46, 0.16);
			transform: translateY(-1px);
		}

		.header-add-cta:active {
			transform: translateY(0) scale(0.97);
			box-shadow: 0 2px 10px rgba(217, 119, 6, 0.35);
		}

		.header-add-cta:focus-visible {
			outline: 3px solid var(--color-teal, #2BA8A2);
			outline-offset: 3px;
		}

		@media (prefers-reduced-motion: reduce) {
			.header-add-cta {
				transition: none;
			}
			.header-add-cta:hover {
				transform: none;
			}
		}


	/* ═══════════════════════════════════════════════════════════════════════════
     COMMITTED MONEY WORKSPACE STYLES (Flip7 Design System)
     ═══════════════════════════════════════════════════════════════════════════ */
	.committed-workspace {
		/* Page width is now handled by .page-container--workspace wrapper.
		   This component just provides internal spacing. */
		padding: var(--space-xl) var(--space-md);
	}

	.workspace-header {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		margin-bottom: var(--space-xl);
		padding: 18px 24px;
		overflow: visible;
	}

	.header-main {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-md);
	}

	.page-title {
		font-family: var(--font-display);
		font-size: 28px;
		font-weight: 800;
		color: var(--color-ink, #0f172a);
		letter-spacing: -0.02em;
		margin: 0;
	}

	.page-subtitle {
		font-size: 14px;
		color: var(--color-text-muted, #64748b);
		margin-top: 4px;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	/* ─── Segmented Control ─── */
	.switcher-wrapper {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-md);
		flex-wrap: wrap;
	}

	.segmented-control {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		background: var(--color-surface-inset, #f1f5f9);
		padding: 4px;
		border-radius: var(--radius-pill, 9999px);
		border: 1px solid var(--color-hairline, rgba(226, 232, 240, 0.85));
	}

	.seg-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 18px;
		height: 40px;
		border-radius: var(--radius-pill, 9999px);
		border: none;
		background: transparent;
		color: var(--color-text-muted, #64748b);
		font-family: var(--font-display);
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.04em;
		cursor: pointer;
		transition: all 180ms ease;
	}

	.seg-btn:hover {
		color: var(--color-ink, #0f172a);
		background: rgba(255, 255, 255, 0.6);
	}

	.seg-btn.active {
		background: var(--color-surface, #ffffff);
		color: var(--color-teal-dark, #0d9488);
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.04);
	}

	.seg-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 2px 8px;
		border-radius: 12px;
		background: var(--color-teal-bg, #ccfbf1);
		color: var(--color-teal-dark, #0d9488);
		font-size: 12px;
		font-weight: 800;
	}

	/* ─── Table Card Wrapper ─── */
	.table-card-wrapper {
		position: relative;
		background: var(--color-surface, #ffffff);
		border: 1px solid var(--color-hairline, rgba(226, 232, 240, 0.85));
		border-radius: var(--radius-xl, 16px);
		overflow: hidden;
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.03), 0 1px 2px -1px rgba(0, 0, 0, 0.02);
	}

	/* Remove border radius from inner tables to match lending page */
	.table-card-wrapper :global(.iou-register),
	.table-card-wrapper :global(.iou-container),
	.table-card-wrapper :global(.recurring-table) {
		border: none !important;
		border-radius: 0 !important;
		box-shadow: none !important;
	}

	.table-loading-bar {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 3px;
		background: var(--color-teal-bg, #ccfbf1);
		overflow: hidden;
		z-index: 10;
	}

	.loading-bar-fill {
		height: 100%;
		width: 40%;
		background: var(--color-teal, #149b91);
		animation: loadingPulse 1s infinite linear;
	}

	@keyframes loadingPulse {
		0% { transform: translateX(-100%); }
		100% { transform: translateX(300%); }
	}

	.table-toolbar {
		padding: var(--space-md);
		border-bottom: 1px solid var(--color-hairline, rgba(226, 232, 240, 0.85));
		background: var(--color-surface-inset, #fafafa);
		position: relative;
	}

	.filter-panel {
		padding: var(--space-md);
		background: var(--color-surface, #ffffff);
		border: 1px solid var(--color-hairline, rgba(226, 232, 240, 0.85));
		border-radius: var(--radius-md, 8px);
	}

	.recurring-filter-panel {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: var(--space-md);
	}

	/* The shared FilterFooter is a direct grid child; without full-row span it
	   would be confined to one ~160px column next to the selects. */
	.recurring-filter-panel :global(.filter-footer) {
		grid-column: 1 / -1;
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.filter-label {
		font-size: 12px;
		font-weight: 700;
		color: var(--color-text-muted, #64748b);
	}

	.filter-select {
		padding: 8px 12px;
		border-radius: var(--radius-md, 8px);
		border: 1px solid var(--color-hairline, #cbd5e1);
		background: var(--color-surface, #ffffff);
		font-size: 14px;
		color: var(--color-ink, #0f172a);
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

	/* Flatten the bar into the table card — same treatment as the lending/transactions pages */
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

	.table-content-area {
		min-height: 200px;
	}

	/* Pagination Footer */
	.table-pager {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-md);
		border-top: 1px solid var(--color-hairline, rgba(226, 232, 240, 0.85));
		background: var(--color-surface-inset, #fafafa);
		font-size: 13px;
	}

	.pager-nav {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.pager-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 32px;
		height: 32px;
		padding: 0 6px;
		border-radius: var(--radius-md, 6px);
		border: 1px solid var(--color-hairline, #cbd5e1);
		background: var(--color-surface, #ffffff);
		color: var(--color-ink, #0f172a);
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
	}

	.pager-btn.active {
		background: var(--color-teal-dark, #0d9488);
		color: #ffffff;
		border-color: var(--color-teal-dark, #0d9488);
	}

	.pager-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.pager-footer {
		display: flex;
		align-items: center;
		gap: var(--space-lg);
	}

	.pager-count {
		color: var(--color-text-muted, #64748b);
	}

	.rows-per-page {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--color-text-muted, #64748b);
	}

	.rows-select {
		padding: 4px 8px;
		border-radius: var(--radius-md, 6px);
		border: 1px solid var(--color-hairline, #cbd5e1);
		background: var(--color-surface, #ffffff);
		font-size: 13px;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-sm);
		margin-top: var(--space-lg);
	}

	@media (max-width: 768px) {
		.header-main {
			flex-direction: column;
			align-items: flex-start;
		}

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

		.table-pager {
			flex-direction: column;
			gap: var(--space-md);
			align-items: center;
		}

		.pager-footer {
			width: 100%;
			justify-content: space-between;
		}
	}

	/* ─── Dark Mode Overrides for Flip7 Cards ─── */
	[data-theme="dark"] .workspace-header.flip7-card.accent-gold {
		background: var(--color-surface);
		border-color: var(--color-hairline);
	}

	[data-theme="dark"] .table-card-wrapper {
		background: var(--color-surface);
		border-color: var(--color-hairline);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
	}
	</style>

<script lang="ts">
	import { untrack } from 'svelte';
	import { page, navigating } from '$app/stores';
	import { goto, invalidateAll } from '$app/navigation';
	import { enhance } from '$app/forms';
	import PageBackground from '$lib/client/components/PageBackground.svelte';
	import Button from '$lib/client/components/Button.svelte';
	import TransactionFilterPanel from '$lib/client/components/TransactionFilterPanel.svelte';
	import TransactionFilterToolbar from '$lib/client/components/TransactionFilterToolbar.svelte';
	import TransactionList from '$lib/client/components/TransactionList.svelte';
	import OverflowMenu from '$lib/client/components/OverflowMenu.svelte';
	import EmptyState from '$lib/client/components/EmptyState.svelte';
	import SearchFilterPill from '$lib/client/components/SearchFilterPill.svelte';
	import ViewToggle from '$lib/client/components/ViewToggle.svelte';
	import ModalDialog from '$lib/client/components/ModalDialog.svelte';
	import SlideOver from '$lib/client/components/SlideOver.svelte';
	import RecordMoneyModal from '$lib/client/components/RecordMoneyModal.svelte';
	import TransactionImpactFlash from '$lib/client/components/TransactionImpactFlash.svelte';
import MobileMoneyPunchOverlay, { type PunchType } from '$lib/client/components/dashboard/MobileMoneyPunchOverlay.svelte';
	import ImportWizard from '$lib/client/components/ImportWizard.svelte';
	import RecurringForm from '$lib/client/components/RecurringForm.svelte';
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
	import type { Category, Transaction, RecurringFormInitial, TransactionType } from '$lib/types';

	let data = $derived($page.data as App.PageData);
	let deleteTarget = $state<number | number[] | null>(null);

	let selectionMode = $state(false);
	let selectedIds = $state(new Set<number>());

	let isFormOpen = $state(false);
	let editingTransaction = $state<Transaction | null>(null);
	let impactData = $state<{ type: TransactionType; amount: number; categoryName: string } | null>(null);
let punchData = $state<{ type: PunchType; amount: number } | null>(null);

	function openAddForm() {
		editingTransaction = null;
		isFormOpen = true;
	}

	// Open the New Transaction panel when arriving via the global FAB (?add=1)
	$effect(() => {
		const params = new URLSearchParams($page.url.searchParams);
		if (params.get('add') === '1') {
			params.delete('add');
			const qs = params.toString();
			history.replaceState(history.state, '', `${$page.url.pathname}${qs ? '?' + qs : ''}`);
			openAddForm();
		}
	});

	function openEditForm(txn: Transaction) {
		editingTransaction = txn;
		isFormOpen = true;
	}

	function closeForm() {
		isFormOpen = false;
		editingTransaction = null;
	}

	const urlFrom = $page.url.searchParams.get('from') || $page.url.searchParams.get('date_from') || '';
	const urlTo = $page.url.searchParams.get('to') || $page.url.searchParams.get('date_to') || '';
	const rawUrlDate = $page.url.searchParams.get('date') || '';
	const urlDate = rawUrlDate || (urlFrom || urlTo ? 'custom' : '');

	let filters = $state({
		date: urlDate,
		category: $page.url.searchParams.get('category') || '',
		type: $page.url.searchParams.get('type') || '',
		customFrom: urlFrom,
		customTo: urlTo,
		search: $page.url.searchParams.get('search') || '',
	});

	let searchInput = $state($page.url.searchParams.get('search') || '');
	let mobileFiltersOpen = $state(false);

	$effect(() => {
		const urlSearch = $page.url.searchParams.get('search') ?? '';
		untrack(() => {
			if (filters.search === searchInput && urlSearch !== searchInput) {
				searchInput = urlSearch;
			}
		});
	});

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

	const isSearching = $derived(searchInput !== (filters.search || '') || !!$navigating);

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

	$effect(() => {
		const params = new URLSearchParams();
		if (filters.type) params.set('type', filters.type);
		if (filters.category) {
			const cat = (data.categories ?? []).find((c) => c.name === filters.category);
			if (cat) params.set('category_id', String(cat.id));
		}
		if (filters.date) {
			if (filters.date === 'custom') {
				if (filters.customFrom) params.set('from', filters.customFrom);
				if (filters.customTo) params.set('to', filters.customTo);
			} else {
				const range = dateRangeFromFilter(filters.date, filters.customFrom, filters.customTo);
				if (range.from) params.set('date_from', range.from);
				if (range.to) params.set('date_to', range.to);
			}
		}
		if (filters.search) params.set('search', filters.search);
		const rawLimit = $page.url.searchParams.get('limit') ?? $page.url.searchParams.get('pageSize');
		if (rawLimit) params.set('limit', rawLimit);
		const newQs = params.toString();
		const currentFilterQs = (() => {
			const p = new URLSearchParams($page.url.searchParams);
			p.delete('page');
			return p.toString();
		})();
		if (newQs !== currentFilterQs) {
			goto(`/transactions${newQs ? '?' + newQs : ''}`, { keepFocus: true, noScroll: true });
		}
	});

	function dateRangeFromFilter(filter: string, customFrom?: string, customTo?: string): { from: string; to: string } {
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
				return { from: mon.toISOString().slice(0, 10), to: sun.toISOString().slice(0, 10) };
			}
			case 'this-month': return { from: `${y}-${String(m).padStart(2, '0')}-01`, to: `${y}-${String(m).padStart(2, '0')}-${d}` };
			case 'today': {
				const today = `${y}-${String(m).padStart(2, '0')}-${d}`;
				return { from: today, to: today };
			}
			case 'this-year': return { from: `${y}-01-01`, to: `${y}-12-31` };
			case 'last-3-months': {
				const d3 = new Date(now);
				d3.setMonth(now.getMonth() - 3);
				return { from: d3.toISOString().slice(0, 10), to: `${y}-${String(m).padStart(2, '0')}-${d}` };
			}
			case 'custom': return { from: customFrom || '', to: customTo || '' };
			default: return { from: '', to: '' };
		}
	}

	const activeFilterCount = $derived([filters.type, filters.category, filters.date].filter(Boolean).length);
	const hasActiveFilters = $derived(filters.type || filters.category || filters.date || filters.search);

	const activeFilterChips = $derived.by(() => {
		const chips: { key: string; label: string; remove: () => void }[] = [];
		if (filters.type) {
			const typeLabel = filters.type === 'income' ? 'Income' : filters.type === 'expense' ? 'Expenses' : filters.type;
			chips.push({ key: 'type', label: typeLabel, remove: () => { filters.type = ''; } });
		}
		if (filters.category) {
			chips.push({ key: 'category', label: filters.category, remove: () => { filters.category = ''; } });
		}
		if (filters.date) {
			let dateLabel = filters.date;
			if (filters.date === 'this-month') dateLabel = 'This Month';
			else if (filters.date === 'this-week') dateLabel = 'This Week';
			else if (filters.date === 'today') dateLabel = 'Today';
			else if (filters.date === 'this-year') dateLabel = 'This Year';
			else if (filters.date === 'last-3-months') dateLabel = 'Last 3 Months';
			else if (filters.date === 'custom') dateLabel = filters.customFrom && filters.customTo ? `${filters.customFrom} - ${filters.customTo}` : 'Custom Date';
			chips.push({ key: 'date', label: dateLabel, remove: () => { filters.date = ''; filters.customFrom = ''; filters.customTo = ''; } });
		}
		return chips;
	});


	let showFlatView = $state(true);
	let mobileShowFlatView = $state(false);

	async function handleExport(format: 'csv' | 'pdf', ids?: number[]) {
		const params = new URLSearchParams($page.url.searchParams);
		if (ids && ids.length > 0) params.set('ids', ids.join(','));
		if (format === 'csv') {
			window.location.href = `/api/transactions/export?${params.toString()}`;
			return;
		}
		const pdfParams = new URLSearchParams(params);
		pdfParams.set('format', 'json');
		pdfParams.set('exportType', 'all');
		try {
			const response = await fetch(`/api/transactions/export?${pdfParams.toString()}`);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const json = await response.json();
			if (!json.transactions || json.transactions.length === 0) return;
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
		} catch {
			showError('Failed to generate PDF');
		}
	}

	async function handleDuplicate(id: number) {
		const src = (data.allForBalance ?? []).find((t) => t.id === id) ?? (data.transactions ?? []).find((t) => t.id === id);
		if (!src) return;
		try {
			const res = await fetch('/api/transactions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: src.type, amount: src.amount, description: src.description, date: src.date, category_id: src.category_id }),
			});
			if (!res.ok) throw new Error(((await res.json()).error) || 'Duplicate failed');
			showSuccess('Transaction duplicated');
			await invalidateAll();
		} catch (e) {
			showError((e as Error).message || 'Failed to duplicate transaction');
		}
	}

	let makeRecurringTxn = $state<Transaction | null>(null);
	let formDirty = $state(false);
	let discardOpen = $state(false);

	const makeRecurringInitial = $derived.by<RecurringFormInitial | null>(() => {
		const txn = makeRecurringTxn;
		if (!txn) return null;
		const today = getToday();
		return { type: txn.type, amount: Math.abs(txn.amount), description: txn.description, category_id: txn.category_id, frequency: 'monthly', interval: 1, start_date: txn.date > today ? txn.date : today, end_date: '', active: true };
	});

	const makeRecurringNextRun = $derived(makeRecurringInitial ? calculateNextRun(makeRecurringInitial.start_date, makeRecurringInitial.frequency, makeRecurringInitial.interval, null, null, null, makeRecurringInitial.start_date) : '');

	function openMakeRecurring(txn: Transaction) {
		makeRecurringTxn = txn;
		formDirty = false;
		discardOpen = false;
	}

	function closeMakeRecurring() {
		if (discardOpen) return;
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

	async function handleRecurringSubmit(formData: FormData): Promise<boolean> {
		try {
			const body: Record<string, unknown> = {
				type: formData.get('type'),
				amount: parseFloat(formData.get('amount') as string),
				description: formData.get('description'),
				category_id: parseInt(formData.get('category_id') as string),
				frequency: formData.get('frequency'),
				interval: parseInt(formData.get('interval') as string) || 1,
				day_of_week: null, day_of_month: null, month_of_year: null,
				start_date: formData.get('start_date'),
				end_date: formData.get('end_date') || null,
				active: formData.get('active') === 'on',
			};
			const res = await fetch('/api/recurring', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
			const result = await res.json();
			if (result.success) return true;
			showError(result.error || 'Failed to create schedule');
			return false;
		} catch {
			showError('Failed to create schedule');
			return false;
		}
	}

	function handleFilterChange(newFilters: { date: string, category: string, type: string, customFrom?: string, customTo?: string }) {
		filters = { date: newFilters.date, category: newFilters.category, type: newFilters.type, customFrom: newFilters.customFrom || '', customTo: newFilters.customTo || '', search: filters.search };
	}

	function clearAllFilters() {
		filters = { date: '', category: '', type: '', customFrom: '', customTo: '', search: '' };
		searchInput = '';
	}

	async function goToPage(p: number) {
		const y = window.scrollY;
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', String(p));
		try {
			await goto(`/transactions?${params.toString()}`, { keepFocus: true, noScroll: true });
		} catch { return; }
		requestAnimationFrame(() => {
			requestAnimationFrame(() => { window.scrollTo({ top: y, behavior: 'auto' }); });
		});
	}

	const previewColumns = $derived<ImportPreviewColumn[]>([
		{ header: 'Status', key: '_status', kind: 'status' },
		{ header: 'Date', key: 'date', kind: 'date' },
		{ header: 'Description', key: 'description', kind: 'text', cls: 'cell-desc' },
		{ header: 'Category', key: 'category_name', kind: 'text', cls: 'cell-cat' },
		{ header: 'Type', key: 'type', kind: 'type' },
		{ header: 'Amount', key: 'amount', kind: 'amount', align: 'right' },
		{ header: 'Source', key: 'source_of_funds', kind: 'text' },
	]);

	function buildRows(rawRows: string[][], headers: string[], mapping: Record<string, string>, config: ImportMappingConfig) { return buildMappedRows(rawRows, headers, mapping, config); }
	function validateRows(rows: MappedTransaction[], deps: Record<string, unknown>, config: ImportMappingConfig) { return validateAllRows(rows, deps.categories as Category[], config); }
	const importDeps = $derived({ categories: data.categories ?? [] });
	let importWizardOpen = $state(false);

	const pageItems = $derived((currentPage: number, totalPages: number): (number | '…')[] => {
		const pages: (number | '…')[] = [];
		const show = 3;
		const start = Math.max(1, currentPage - show);
		const end = Math.min(totalPages, currentPage + show);
		if (start > 1) { pages.push(1); if (start > 2) pages.push('…'); }
		for (let i = start; i <= end; i++) pages.push(i);
		if (end < totalPages) { if (end < totalPages - 1) pages.push('…'); pages.push(totalPages); }
		return pages;
	});

	function handleLimitChange(newLimitStr: string) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', '1');
		if (newLimitStr === 'all') params.set('limit', 'all');
		else if (newLimitStr !== '20') params.set('limit', newLimitStr);
		else { params.delete('limit'); params.delete('pageSize'); }
		goto(`/transactions?${params.toString()}`, { keepFocus: true, noScroll: true });
	}

	const countLabel = $derived.by(() => {
		if (data.dateError) return data.dateError;
		const page = data.page ?? 1;
		const limitVal = data.limit ?? 20;
		const total = data.total ?? 0;
		if (total === 0) return 'No transactions';
		if (limitVal === 0) return `Showing all ${total} transaction${total !== 1 ? 's' : ''}`;
		const start = (page - 1) * limitVal + 1;
		const end = Math.min(page * limitVal, total);
		return `Showing ${start}–${end} of ${total} transaction${total !== 1 ? 's' : ''}`;
	});

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

	function toggleAll() {
		if (allSelected) selectedIds = new Set([...selectedIds].filter((id) => !pageIds.includes(id)));
		else selectedIds = new Set([...selectedIds, ...pageIds]);
	}

	function exitSelectionMode() {
		selectionMode = false;
		selectedIds = new Set();
	}

	function setIndeterminate(node: HTMLInputElement, indeterminate: boolean) {
		node.indeterminate = indeterminate;
		return { update(indeterminate: boolean) { node.indeterminate = indeterminate; } };
	}

	let lastFilterKey = '';
	$effect(() => {
		const key = $page.url.searchParams.toString();
		untrack(() => {
			if (lastFilterKey !== '' && key !== lastFilterKey) selectedIds = new Set();
			lastFilterKey = key;
		});
	});

	function computeTrendDelta(current: number, prev: number | undefined | null) {
		// TODO: Render neutral '–' when prev-period comparison data is unavailable
		if (prev === undefined || prev === null) {
			return { text: '–', isIncrease: false, isDecrease: false };
		}
		if (prev === 0) {
			if (current === 0) return { text: '–', isIncrease: false, isDecrease: false };
			return { text: `↑ ₱${Math.round(current).toLocaleString()}`, isIncrease: true, isDecrease: false };
		}
		const diff = current - prev;
		if (Math.abs(diff) < 0.01) {
			return { text: '–', isIncrease: false, isDecrease: false };
		}
		const pct = Math.round((diff / prev) * 100);
		if (pct === 0) return { text: '–', isIncrease: false, isDecrease: false };
		if (pct > 0) {
			return { text: `↑ ${pct}%`, isIncrease: true, isDecrease: false };
		}
		return { text: `↓ ${Math.abs(pct)}%`, isIncrease: false, isDecrease: true };
	}

	const deltaToday = $derived(computeTrendDelta(
		data.moneyGoneStats?.wreckedToday ?? 0,
		data.moneyGoneStats?.wreckedYesterday
	));

	const deltaMonth = $derived(computeTrendDelta(
		data.moneyGoneStats?.wreckedThisMonth ?? 0,
		data.moneyGoneStats?.wreckedSamePointPrevMonth
	));

	const deltaVelocity = $derived(computeTrendDelta(
		data.moneyGoneStats?.outflowVelocity ?? 0,
		data.moneyGoneStats?.prevMonthVelocity
	));
</script>

<svelte:head>
	<title>Money Gone — WRECKRD</title>
</svelte:head>

<PageBackground />

<!-- ═══════════════════════════════════════════════════════════════════════════
     MONEY GONE DESKTOP COMPOSITION — Flip7 Visual Language
     ═══════════════════════════════════════════════════════════════════════════ -->
<div class="page-container page-container--workspace">
	<div class="desktop-transactions">
		<header class="money-gone-hero flip7-card accent-coral">
		<div class="hero-left">
			<div class="hero-badge">
				<span class="fire-icon">🔥</span>
				<span class="badge-text">MONEY GONE</span>
			</div>
			<h1 class="hero-title">WHERE IS MY MONEY GOING?</h1>
			<p class="hero-subtitle">Every peso here already left — irreversible, consumed, accounted for. Seriously, where?</p>
		</div>
		<div class="hero-actions">
			<OverflowMenu
				onImportCsv={() => (importWizardOpen = true)}
				onExportCsv={() => handleExport('csv')}
				onExportPdf={() => handleExport('pdf')}
				onSelect={() => { selectionMode = true; selectedIds = new Set(); }}
			/>
		</div>
	</header>

	<!-- ═══ Money Gone 4-Metric KPI Summary Strip ═══ -->
	<div class="money-gone-kpis">
		<div class="kpi-card flip7-card accent-coral">
			<div class="kpi-card-header">
				<span class="kpi-icon-chip coral" aria-hidden="true">
					<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<line x1="12" y1="5" x2="12" y2="19"/>
						<polyline points="19 12 12 19 5 12"/>
					</svg>
				</span>
				<span class="kpi-label">Wrecked Today</span>
			</div>
			<div class="kpi-value-row">
				<span class="kpi-value coral">{formatCurrency(data.moneyGoneStats?.wreckedToday ?? 0)}</span>
				<span class="kpi-delta" class:spending-up={deltaToday.isIncrease} class:spending-down={deltaToday.isDecrease}>
					{deltaToday.text}
				</span>
			</div>
		</div>
		<div class="kpi-card flip7-card accent-teal">
			<div class="kpi-card-header">
				<span class="kpi-icon-chip teal" aria-hidden="true">
					<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<path d="M12 2c0 5-4 7-4 11 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-4-6-4-11z"/>
						<path d="M12 13c-1.1 0-2 .9-2 2 0 1.66 1.34 3 3 3s3-1.34 3-3c0-1.1-.9-2-2-2z"/>
					</svg>
				</span>
				<span class="kpi-label">Wrecked This Month</span>
			</div>
			<div class="kpi-value-row">
				<span class="kpi-value">{formatCurrency(data.moneyGoneStats?.wreckedThisMonth ?? 0)}</span>
				<span class="kpi-delta" class:spending-up={deltaMonth.isIncrease} class:spending-down={deltaMonth.isDecrease}>
					{deltaMonth.text}
				</span>
			</div>
		</div>
		<div class="kpi-card flip7-card accent-gold">
			<div class="kpi-card-header">
				<span class="kpi-icon-chip gold" aria-hidden="true">
					<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<path d="M12 14l3-3"/>
						<path d="M3.34 19a10 10 0 1 1 17.32 0"/>
					</svg>
				</span>
				<span class="kpi-label">Outflow Velocity</span>
			</div>
			<div class="kpi-value-row">
				<span class="kpi-value">{formatCurrency(data.moneyGoneStats?.outflowVelocity ?? 0)} <span class="kpi-unit">/ day</span></span>
				<span class="kpi-delta" class:spending-up={deltaVelocity.isIncrease} class:spending-down={deltaVelocity.isDecrease}>
					{deltaVelocity.text}
				</span>
			</div>
		</div>
		<div class="kpi-card flip7-card accent-sky">
			<div class="kpi-card-header">
				<span class="kpi-icon-chip sky" aria-hidden="true">
					<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
						<line x1="7" y1="7" x2="7.01" y2="7"/>
					</svg>
				</span>
				<span class="kpi-label">Largest Outflow</span>
			</div>
			<span class="kpi-value">
				{data.moneyGoneStats?.largestOutflow ? formatCurrency(data.moneyGoneStats.largestOutflow.amount) : '₱0'}
			</span>
			{#if data.moneyGoneStats?.largestOutflow}
				<span class="kpi-subtext">
					{data.moneyGoneStats.largestOutflow.description || data.moneyGoneStats.largestOutflow.category_name || ''}
				</span>
			{/if}
		</div>
	</div>

	<div class="table-card-wrapper flip7-card accent-teal">
		{#if isSearching}
			<div class="table-loading-bar" role="progressbar" aria-label="Loading data">
				<div class="loading-bar-fill"></div>
			</div>
		{/if}
		<div class="txn-toolbar flip7-toolbar">
			<div class="toolbar-left">
				<div class="toolbar-desktop">
					<TransactionFilterToolbar
						bind:value={searchInput}
						loading={isSearching}
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
			</div>
			<div class="toolbar-right">
				<ViewToggle {showFlatView} onChange={(flat) => showFlatView = flat} stretch />
			</div>
		</div>

		{#if data.dateError}
			<div class="date-error-banner flip7-card accent-coral" role="alert">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
				<span>{data.dateError}</span>
			</div>
		{/if}

		{#if selectionMode && pageIds.length > 0}
			<div class="bulk-bar flip7-card accent-gold" role="toolbar" aria-label="Selected transactions">
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
				if (found) openEditForm(found); else goto(`/transactions/${id}/edit`);
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

	<!-- Sticky Right-Side Floating Action Button (Desktop) - matches SpeedDial style -->
	<button
		type="button"
		class="desktop-fab-add flip7-card accent-coral"
		onclick={openAddForm}
		aria-label="Add transaction"
		title="Add transaction"
	>
		<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
			<line x1="12" y1="5" x2="12" y2="19"/>
			<line x1="5" y1="12" x2="19" y2="12"/>
		</svg>
		<span class="fab-tooltip" role="tooltip">Add transaction</span>
	</button>
</div>
</div>

<!-- ═══════════════════════════════════════════════════════════════════════════
     DEDICATED MOBILE COMPOSITION (viewports <= 768px)
     ═══════════════════════════════════════════════════════════════════════════ -->
<div class="mobile-transactions">
	<header class="mobile-app-header">
		<div class="mobile-header-main">
			<div class="mobile-title-wrap">
				<div class="hero-badge">
					<span class="fire-icon">🔥</span>
					<span class="badge-text">MONEY GONE</span>
				</div>
				<h1 class="mobile-page-title">WHERE IS MY MONEY GOING?</h1>
				<span class="context-subline">Every peso here already left — irreversible, consumed, accounted for. Seriously, where?</span>
			</div>
			<div class="mobile-header-actions">
				<OverflowMenu
					onImportCsv={() => (importWizardOpen = true)}
					onExportCsv={() => handleExport('csv')}
					onExportPdf={() => handleExport('pdf')}
					onSelect={() => { selectionMode = true; selectedIds = new Set(); }}
				/>
			</div>
		</div>
	</header>

	<div class="mobile-shell">
		<section class="mobile-section">
			<div class="money-gone-kpis mobile-kpis">
				<div class="kpi-card">
					<div class="kpi-card-header">
						<span class="kpi-icon-chip coral" aria-hidden="true">
							<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
								<line x1="12" y1="5" x2="12" y2="19"/>
								<polyline points="19 12 12 19 5 12"/>
							</svg>
						</span>
						<span class="kpi-label">Wrecked Today</span>
					</div>
					<div class="kpi-value-row">
						<span class="kpi-value coral">{formatCurrency(data.moneyGoneStats?.wreckedToday ?? 0)}</span>
						<span class="kpi-delta" class:spending-up={deltaToday.isIncrease} class:spending-down={deltaToday.isDecrease}>
							{deltaToday.text}
						</span>
					</div>
				</div>
				<div class="kpi-card">
					<div class="kpi-card-header">
						<span class="kpi-icon-chip teal" aria-hidden="true">
							<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
								<path d="M12 2c0 5-4 7-4 11 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-4-6-4-11z"/>
								<path d="M12 13c-1.1 0-2 .9-2 2 0 1.66 1.34 3 3 3s3-1.34 3-3c0-1.1-.9-2-2-2z"/>
							</svg>
						</span>
						<span class="kpi-label">Wrecked Month</span>
					</div>
					<div class="kpi-value-row">
						<span class="kpi-value">{formatCurrency(data.moneyGoneStats?.wreckedThisMonth ?? 0)}</span>
						<span class="kpi-delta" class:spending-up={deltaMonth.isIncrease} class:spending-down={deltaMonth.isDecrease}>
							{deltaMonth.text}
						</span>
					</div>
				</div>
				<div class="kpi-card">
					<div class="kpi-card-header">
						<span class="kpi-icon-chip gold" aria-hidden="true">
							<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
								<path d="M12 14l3-3"/>
								<path d="M3.34 19a10 10 0 1 1 17.32 0"/>
							</svg>
						</span>
						<span class="kpi-label">Velocity</span>
					</div>
					<div class="kpi-value-row">
						<span class="kpi-value">{formatCurrency(data.moneyGoneStats?.outflowVelocity ?? 0)} <span class="kpi-unit">/day</span></span>
						<span class="kpi-delta" class:spending-up={deltaVelocity.isIncrease} class:spending-down={deltaVelocity.isDecrease}>
							{deltaVelocity.text}
						</span>
					</div>
				</div>
				<div class="kpi-card">
					<div class="kpi-card-header">
						<span class="kpi-icon-chip sky" aria-hidden="true">
							<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
								<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
								<line x1="7" y1="7" x2="7.01" y2="7"/>
							</svg>
						</span>
						<span class="kpi-label">Largest</span>
					</div>
					<span class="kpi-value">
						{data.moneyGoneStats?.largestOutflow ? formatCurrency(data.moneyGoneStats.largestOutflow.amount) : '₱0'}
					</span>
				</div>
			</div>
		</section>

		<section class="mobile-section">
			<SearchFilterPill
				bind:value={searchInput}
				loading={isSearching}
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

			{#if activeFilterChips.length > 0}
				<div class="active-filter-chips">
					{#each activeFilterChips as chip (chip.key)}
						<button type="button" class="filter-chip" onclick={chip.remove} aria-label={`Remove filter ${chip.label}`}>
							<span>{chip.label}</span>
							<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
								<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
							</svg>
						</button>
					{/each}
					<button type="button" class="filter-chip-clear" onclick={clearAllFilters}>Clear all</button>
				</div>
			{/if}
		</section>


		{#if data.dateError}
			<div class="date-error-banner" role="alert">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
				<span>{data.dateError}</span>
			</div>
		{/if}

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

		<section class="mobile-section">
			<TransactionList
				transactions={data.transactions ?? []}
				allTransactionsForBalance={data.allForBalance ?? []}
				categories={data.categories ?? []}
				showRunningBalance={true}
				showFlatView={mobileShowFlatView}
				{selectionMode}
				{selectedIds}
				onToggleSelection={toggleSelection}
				onEdit={(id) => {
					const found = (data.transactions ?? []).find(t => t.id === id);
					if (found) openEditForm(found); else goto(`/transactions/${id}/edit`);
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
		</section>

		{#if (data.total ?? 0) > 0 || data.dateError}
			<section class="mobile-section mobile-pager-wrap">
				{#if (data.totalPages ?? 0) > 1 && (data.limit ?? 20) !== 0}
					<nav class="mobile-pager" aria-label="Mobile pagination">
						<button
							type="button"
							class="mobile-pager-btn"
							disabled={(data.page ?? 1) === 1}
							onclick={() => goToPage((data.page ?? 1) - 1)}
							aria-label="Previous page"
						>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
							<span>Prev</span>
						</button>
						<span class="mobile-pager-status">Page {data.page ?? 1} of {data.totalPages ?? 1}</span>
						<button
							type="button"
							class="mobile-pager-btn"
							disabled={(data.page ?? 1) === (data.totalPages ?? 1)}
							onclick={() => goToPage((data.page ?? 1) + 1)}
							aria-label="Next page"
						>
							<span>Next</span>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
						</button>
					</nav>
				{/if}
				<span class="mobile-pager-count">{countLabel}</span>
			</section>
		{/if}
	</div>
</div>

<!-- ═══ Modals & SlideOvers ═══ -->
{#if deleteTarget !== null}
	{@const isBulk = Array.isArray(deleteTarget) && deleteTarget.length > 1}
	{@const deleteCount = Array.isArray(deleteTarget) ? deleteTarget.length : 1}
	<ModalDialog open={deleteTarget !== null} onclose={() => (deleteTarget = null)} title={isBulk ? 'Delete Transactions' : 'Delete Transaction'}>
		<p>Are you sure you want to delete {deleteCount} transaction{deleteCount !== 1 ? 's' : ''}? This action cannot be undone.</p>
		<form
			method="POST"
			action="?/delete"
			use:enhance={() => {
				return async ({ result, update }: { result: { type: string; data?: { error?: string; deleted?: number } }; update: () => Promise<void> }) => {
					if (result.type === 'success') {
						const deleted = result.data?.deleted ?? deleteCount;
						exitSelectionMode();
						deleteTarget = null;
						showSuccess(`${deleted} transaction${deleted !== 1 ? 's' : ''} deleted`);
					} else if (result.type === 'failure') showError(result.data?.error || 'Failed to delete transaction');
					await update();
				};
			}}
		>
			<input type="hidden" name="id" value={Array.isArray(deleteTarget) ? deleteTarget.join(',') : String(deleteTarget)} />
			<div class="modal-actions">
				<Button variant="danger" type="submit">Delete</Button>
				<Button variant="ghost" type="button" onclick={() => (deleteTarget = null)}>Cancel</Button>
			</div>
		</form>
	</ModalDialog>
{/if}

<ImportWizard
	open={importWizardOpen}
	onClose={() => (importWizardOpen = false)}
	fields={DEFAULT_IMPORT_FIELDS}
	columns={previewColumns}
	buildRows={buildRows}
	validateRows={validateRows as unknown as (rows: Record<string, unknown>[], deps: Record<string, unknown>, config: ImportMappingConfig) => ImportValidationResult<Record<string, unknown>>}
	deps={importDeps}
	title="Import Transactions"
	noun="transactions"
	sampleHref="/sample-transactions.csv"
	sampleFilename="sample-transactions.csv"
	templateHref="/templates/transactions.xlsx"
	templateFilename="transactions-import-template.xlsx"
/>

<!-- ═══ Record Money Modal (Add / Edit) ═══ -->
<RecordMoneyModal
	open={isFormOpen}
	categories={data.categories ?? []}
	transaction={editingTransaction ?? undefined}
	action={editingTransaction ? `?/update` : `?/create`}
	onClose={closeForm}
	onSuccess={(payload) => {
		if (payload && payload.amount > 0) {
			impactData = payload;
			// Also trigger MobileMoneyPunchOverlay (full-screen particle animation)
			const punchType: PunchType = payload.type === 'income' ? 'income' : 'spent';
			punchData = { type: punchType, amount: payload.amount };
			// Wait for Impact Flash animation to complete (2s, reduced: 1.2s) before closing & refreshing
			setTimeout(() => {
				closeForm();
				invalidateAll();
			}, 2100);
		} else {
			closeForm();
			invalidateAll();
		}
	}}
/>

{#if impactData}
	<TransactionImpactFlash
		type={impactData.type}
		amount={impactData.amount}
		categoryName={impactData.categoryName}
		onComplete={() => (impactData = null)}
	/>
{/if}

{#if punchData}
	<MobileMoneyPunchOverlay
		type={punchData.type}
		amount={punchData.amount}
		onComplete={() => (punchData = null)}
	/>
{/if}

{#if makeRecurringTxn}
	<SlideOver isOpen={true} title="Create Recurring Schedule" onClose={closeMakeRecurring}>
		<p class="rr-subtitle">Future transactions will be created automatically using these settings.</p>
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
		<div class="next-run-card">
			<svg class="next-run-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
			<div class="next-run-body">
				<span class="next-run-label">Next scheduled transaction</span>
				<span class="next-run-date">{formatDate(makeRecurringNextRun)}</span>
			</div>
		</div>
		<RecurringForm
			categories={data.categories ?? []}
			initial={makeRecurringInitial ?? undefined}
			onSubmit={handleRecurringSubmit}
			onSuccess={onRecurringFormSuccess}
			onCancel={closeMakeRecurring}
			bind:dirty={formDirty}
			submitLabel="Create Recurring Schedule"
			successToast={{ message: 'Recurring schedule created.', action: { label: 'Open Recurring', href: '/recurring' } }}
		/>
	</SlideOver>
{/if}

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
	/* ─── Elevate Desktop Header Stacking Context ─── */
	/* PageHeader has backdrop-filter which creates a stacking context.
	   z-index: 30 ensures the OverflowMenu dropdown (top: 100%) paints ABOVE
	   TransactionSummary cards and toolbar that follow in DOM order. */
	:global(.desktop-transactions .page-header) {
		position: relative;
		z-index: 30;
	}

	/* ─── Desktop vs. Mobile Composition Scoping ─── */
	.desktop-transactions {
		display: block;
	}

	.mobile-transactions {
		display: none;
	}

	/* ─── MONEY GONE HERO & KPIS ─── */
	.money-gone-hero {
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

	.hero-badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 3px 10px;
		background: var(--color-coral-bg, rgba(239, 108, 74, 0.12));
		border-radius: var(--radius-pill, 999px);
		width: fit-content;
		margin-bottom: 2px;
	}

	.badge-text {
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 800;
		color: var(--color-money-gone, #EF6C4A);
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

	.btn-record-expense {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 10px 20px;
		min-height: 44px;
		background: var(--color-money-gone, #EF6C4A);
		color: #ffffff;
		border: none;
		border-radius: 22px;
		font-family: var(--font-display);
		font-size: 14px;
		font-weight: 700;
		cursor: pointer;
		box-shadow: 0 4px 16px rgba(239, 108, 74, 0.35);
		transition: transform 140ms ease, background 140ms ease;
		-webkit-tap-highlight-color: transparent;
	}

	.btn-record-expense:hover {
		background: var(--color-coral-dark, #D45233);
		transform: translateY(-1px);
	}

	.btn-record-expense:active {
		transform: scale(0.97);
	}

	/* KPI summary strip */
	.money-gone-kpis {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: var(--space-md, 12px);
		margin-bottom: var(--space-md, 12px);
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
	}

	.kpi-card-header {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 4px;
	}

	.kpi-icon-chip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.kpi-icon-chip.coral {
		background: var(--color-coral-bg, rgba(239, 108, 74, 0.15));
		color: var(--color-coral, #EF6C4A);
	}

	.kpi-icon-chip.teal {
		background: var(--color-teal-bg, rgba(20, 184, 166, 0.15));
		color: var(--color-teal, #14B8A6);
	}

	.kpi-icon-chip.gold {
		background: var(--color-gold-bg, rgba(234, 179, 8, 0.15));
		color: var(--color-gold, #EAB308);
	}

	.kpi-icon-chip.sky {
		background: var(--color-sky-bg, rgba(56, 189, 248, 0.15));
		color: var(--color-sky, #38BDF8);
	}

	.kpi-label {
		font-size: 11px;
		font-weight: 700;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.kpi-value-row {
		display: flex;
		align-items: baseline;
		gap: 6px;
		flex-wrap: wrap;
	}

	.kpi-delta {
		font-size: 11px;
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.kpi-delta.spending-up {
		color: var(--color-coral, #EF6C4A);
	}

	.kpi-delta.spending-down {
		color: var(--color-positive, #27AE60);
	}

	.kpi-value {
		font-family: var(--font-display);
		font-size: 20px;
		font-weight: 800;
		color: var(--color-ink);
	}

	.kpi-value.coral {
		color: var(--color-money-gone, #EF6C4A);
	}

	.kpi-unit {
		font-size: 12px;
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.kpi-subtext {
		font-size: 11px;
		font-weight: 600;
		color: var(--color-text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		margin-top: 2px;
	}

	/* ─── Table Card Container (Integrates Toolbar as Table Header) ─── */
	.table-card-wrapper {
		position: relative;
		background: var(--color-surface, #ffffff);
		border: 1px solid var(--color-hairline, rgba(226, 232, 240, 0.85));
		border-radius: var(--radius-xl, 16px);
		overflow: hidden;
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.03), 0 1px 2px -1px rgba(0, 0, 0, 0.02);
	}

	/* Flip7 visual language integration */
	.table-card-wrapper.flip7-card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		overflow: hidden;
	}

	[data-theme="dark"] .table-card-wrapper.flip7-card {
		border-radius: var(--radius-2xl);
		border-color: var(--color-hairline);
	}

	[data-theme="dark"] .table-card-wrapper.flip7-card:hover {
		transform: translateY(-2px);
		box-shadow: var(--glow-card), 0 8px 32px rgba(60, 196, 189, 0.22);
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

	/* ─── Desktop Toolbar (Single Row Layout: Left Filters | Right ViewToggle) ─── */
	.txn-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-md);
		padding: var(--space-md) var(--space-lg);
		border-bottom: 1px solid var(--color-hairline, rgba(226, 232, 240, 0.85));
		background: var(--color-surface, #ffffff);
		margin-bottom: 0;
	}

	:global(.table-card-wrapper .flat-register),
	:global(.table-card-wrapper .grouped-list) {
		border: none !important;
		border-radius: 0 !important;
		box-shadow: none !important;
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

	.toolbar-right {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: var(--space-md);
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

	/* ─── Desktop Pagination (Single Row Pager Track + Footer) ─── */
	.table-card-wrapper .pager-container {
		margin-top: 0;
		border-top: 1px solid var(--color-hairline, rgba(226, 232, 240, 0.85));
		padding: var(--space-md) var(--space-lg);
		background: var(--color-surface, #ffffff);
	}

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
		background: var(--color-teal-dark);
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
		background: var(--color-money-gone, #EF6C4A);
		color: var(--color-ink-inverse, #ffffff);
		border: 1px solid rgba(255, 255, 255, 0.4);
		box-shadow: 0 4px 20px rgba(239, 108, 74, 0.45), 0 2px 8px rgba(20, 48, 46, 0.12);
		cursor: pointer;
		outline: none;
		transition: transform 200ms var(--ease), box-shadow 200ms var(--ease), background 200ms var(--ease);
		-webkit-tap-highlight-color: transparent;
	}

	.desktop-fab-add:hover {
		background: #F0795A;
		box-shadow: 0 8px 28px rgba(239, 108, 74, 0.60), 0 4px 12px rgba(20, 48, 46, 0.16);
		transform: translateY(-50%) scale(1.08);
	}

	.desktop-fab-add:active {
		transform: translateY(-50%) scale(0.95);
		box-shadow: 0 2px 10px rgba(239, 108, 74, 0.35);
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
		.desktop-transactions {
			display: none !important;
		}

		.mobile-transactions {
			display: flex;
			flex-direction: column;
			gap: var(--space-md);
			padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px) + 24px);
		}

		.mobile-app-header {
			position: sticky;
			top: 0;
			z-index: 20;
			background: var(--color-bg);
			backdrop-filter: blur(12px);
			-webkit-backdrop-filter: blur(12px);
			padding: var(--space-xs) 0 var(--space-sm);
			border-bottom: 1px solid var(--color-hairline);
			margin-bottom: var(--space-xs);
			overflow: visible;
		}

		.mobile-header-main {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: var(--space-sm);
		}

		.mobile-title-wrap {
			display: flex;
			flex-direction: column;
			gap: 2px;
			min-width: 0;
		}

		.mobile-page-title {
			font-family: var(--font-display);
			font-size: var(--font-size-lg);
			font-weight: var(--font-weight-extrabold);
			color: var(--color-ink);
			margin: 0;
			letter-spacing: var(--letter-spacing-heading);
			line-height: 1.2;
		}

		.mobile-header-actions {
			display: flex;
			align-items: center;
			gap: var(--space-xs);
		}

		.mobile-shell {
			display: flex;
			flex-direction: column;
			gap: var(--space-md);
		}

		.mobile-section {
			display: flex;
			flex-direction: column;
			gap: var(--space-xs);
		}

		.active-filter-chips {
			display: flex;
			align-items: center;
			overflow-x: auto;
			-webkit-overflow-scrolling: touch;
			gap: var(--space-xs);
			margin-top: 4px;
			padding-bottom: 2px;
			scrollbar-width: none;
		}

		.active-filter-chips::-webkit-scrollbar {
			display: none;
		}

		.filter-chip {
			display: inline-flex;
			align-items: center;
			gap: 4px;
			padding: 4px 10px;
			min-height: 36px;
			border-radius: var(--radius-pill);
			background: var(--color-teal-bg);
			color: var(--color-teal);
			border: 1px solid var(--color-hairline);
			font-size: var(--font-size-xs);
			font-weight: 600;
			cursor: pointer;
			white-space: nowrap;
			flex-shrink: 0;
			transition: all var(--transition-fast);
		}

		.filter-chip:active {
			transform: scale(0.94);
		}

		.filter-chip-clear {
			background: none;
			border: none;
			color: var(--color-text-muted);
			font-size: var(--font-size-xs);
			font-weight: 600;
			cursor: pointer;
			padding: 4px 8px;
			min-height: 36px;
			white-space: nowrap;
			flex-shrink: 0;
		}

		.mobile-pager-wrap {
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: var(--space-sm);
			margin-top: var(--space-md);
		}

		.mobile-pager {
			display: flex;
			align-items: center;
			justify-content: space-between;
			width: 100%;
			gap: var(--space-sm);
			background: var(--color-surface);
			border: 1px solid var(--color-hairline);
			border-radius: var(--radius-pill);
			padding: 4px 6px;
			box-shadow: var(--shadow-card);
		}

		.mobile-pager-btn {
			display: inline-flex;
			align-items: center;
			gap: 4px;
			min-height: 44px;
			padding: 0 var(--space-md);
			border-radius: var(--radius-pill);
			border: none;
			background: transparent;
			color: var(--color-ink);
			font-size: var(--font-size-sm);
			font-weight: 600;
			cursor: pointer;
			transition: all var(--transition-fast);
		}

		.mobile-pager-btn:active:not(:disabled) {
			transform: scale(0.94);
			color: var(--color-teal);
			background: var(--color-teal-bg);
		}

		.mobile-pager-btn:disabled {
			opacity: 0.35;
			cursor: not-allowed;
		}

		.mobile-pager-status {
			font-family: var(--font-mono);
			font-size: var(--font-size-xs);
			font-weight: 600;
			color: var(--color-text-muted);
			font-variant-numeric: tabular-nums;
		}

		.mobile-pager-count {
			font-family: var(--font-mono);
			font-size: var(--font-size-xs);
			color: var(--color-text-muted);
			font-variant-numeric: tabular-nums;
		}
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

	.modal-actions {
		display: flex;
		gap: var(--space-sm);
		margin-top: var(--space-md);
	}

	.modal-actions :global(.btn) {
		flex: 1;
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
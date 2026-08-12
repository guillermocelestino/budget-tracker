<script lang="ts">
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { goto, invalidateAll } from '$app/navigation';
	import PageHeader from '$lib/client/components/PageHeader.svelte';
	import PageBackground from '$lib/client/components/PageBackground.svelte';
	import RecurringForm from '$lib/client/components/RecurringForm.svelte';
	import RecurringList from '$lib/client/components/RecurringList.svelte';
	import OverflowMenu from '$lib/client/components/OverflowMenu.svelte';
	import SearchFilterPill from '$lib/client/components/SearchFilterPill.svelte';
	import FilterFooter from '$lib/client/components/FilterFooter.svelte';
	import ModalDialog from '$lib/client/components/ModalDialog.svelte';
	import Button from '$lib/client/components/Button.svelte';
	import CountChip from '$lib/client/components/CountChip.svelte';
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { showSuccess, showError } from '$lib/client/stores/toast.svelte';
	import type { RecurringTransaction } from '$lib/types';

	let data = $derived($page.data as App.PageData);
	let activeCount = $derived(data.activeCount ?? 0);
	let deleteTarget = $state<number | number[] | null>(null);
	let showAddPanel = $state(false);
	let editingRecurring = $state<RecurringTransaction | null>(null);
	let panelEl = $state<HTMLDivElement | null>(null);
	let addBtnEl = $state<HTMLElement | null>(null);
	let filtersOpen = $state(false);

	// Open the Add Recurring panel when arriving via the global FAB (?add=1)
	$effect(() => {
		const params = new URLSearchParams($page.url.searchParams);
		if (params.get('add') === '1') {
			params.delete('add');
			const qs = params.toString();
			history.replaceState(history.state, '', `${$page.url.pathname}${qs ? '?' + qs : ''}`);
			openAdd();
		}
	});

	// Bulk selection (Selection Mode) — entered via the header overflow menu.
	// Selection is always page-scoped; clearing happens on page/filter change.
	let selectionMode = $state(false);
	let selectedIds = $state(new Set<number>());

	const pageIds = $derived((data.recurring ?? []).map((r) => r.id));
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

	// Filter state - initialized from URL, synced back via $effect
	let filters = $state({
		search: $page.url.searchParams.get('search') || '',
		type: $page.url.searchParams.get('type') || '',
		frequency: $page.url.searchParams.get('frequency') || '',
		status: $page.url.searchParams.get('status') || '',
		category: $page.url.searchParams.get('category') || '',
	});

	let searchInput = $state(filters.search);

	// Sync the input from the URL on navigation
	$effect(() => {
		const urlSearch = $page.url.searchParams.get('search') ?? '';
		if (urlSearch !== searchInput) searchInput = urlSearch;
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

	// Restore category filter from URL
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

	// Sync filters → URL
	$effect(() => {
		const params = new URLSearchParams();

		if (filters.type) params.set('type', filters.type);
		if (filters.frequency) params.set('frequency', filters.frequency);
		if (filters.status) params.set('status', filters.status);

		if (filters.category) {
			const cat = (data.categories ?? []).find((c) => c.name === filters.category);
			if (cat) params.set('category_id', String(cat.id));
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
			goto(`/recurring${newQs ? '?' + newQs : ''}`, {
				keepFocus: true,
				noScroll: true,
			});
		}
	});

	async function goToPage(p: number) {
		const y = window.scrollY;
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', String(p));
		try {
			await goto(`/recurring?${params.toString()}`, { keepFocus: true, noScroll: true });
		} catch { return; }
		requestAnimationFrame(() => {
			requestAnimationFrame(() => { window.scrollTo({ top: y, behavior: 'auto' }); });
		});
	}

	function handleLimitChange(newLimitStr: string) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', '1');
		if (newLimitStr === 'all') params.set('limit', 'all');
		else if (newLimitStr !== '20') params.set('limit', newLimitStr);
		else { params.delete('limit'); params.delete('pageSize'); }
		goto(`/recurring?${params.toString()}`, { keepFocus: true, noScroll: true });
	}

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

	const countLabel = $derived.by(() => {
		const page = data.page ?? 1;
		const limitVal = data.limit ?? 20;
		const total = data.total ?? 0;
		if (total === 0) return 'No recurring transactions';
		if (limitVal === 0) return `Showing all ${total} recurring transaction${total !== 1 ? 's' : ''}`;
		const start = (page - 1) * limitVal + 1;
		const end = Math.min(page * limitVal, total);
		return `Showing ${start}–${end} of ${total} recurring transaction${total !== 1 ? 's' : ''}`;
	});

	// Filter summary for badge — counts APPLIED panel filters only. Search is a
	// separate concern (its own pill), so a pure search never lights the funnel
	// chip, and Reset (which never touches search) clears the chip fully.
	const activeFilterCount = $derived.by(() => {
		let count = 0;
		if (filters.type) count++;
		if (filters.frequency) count++;
		if (filters.status) count++;
		if (filters.category) count++;
		return count;
	});

	// ─── Filter panel staging ───
	// Panel edits land in `stagedFilters`; Apply commits them to `filters`
	// (which syncs to the URL and reloads the list). Search stays separate.
	let stagedFilters = $state({ type: '', frequency: '', status: '', category: '' });

	// On open, seed the staged copy from the applied filter state.
	$effect(() => {
		if (filtersOpen) {
			stagedFilters.type = filters.type;
			stagedFilters.frequency = filters.frequency;
			stagedFilters.status = filters.status;
			stagedFilters.category = filters.category;
		}
	});

	const canApply = $derived(
		stagedFilters.type !== filters.type ||
		stagedFilters.frequency !== filters.frequency ||
		stagedFilters.status !== filters.status ||
		stagedFilters.category !== filters.category
	);

	const canClear = $derived(
		filters.type !== '' ||
			filters.frequency !== '' ||
			filters.status !== '' ||
			filters.category !== '' ||
			stagedFilters.type !== '' ||
			stagedFilters.frequency !== '' ||
			stagedFilters.status !== '' ||
			stagedFilters.category !== ''
	);

	function applyFilters() {
		filters.type = stagedFilters.type;
		filters.frequency = stagedFilters.frequency;
		filters.status = stagedFilters.status;
		filters.category = stagedFilters.category;
	}

	function resetFilters() {
		stagedFilters.type = '';
		stagedFilters.frequency = '';
		stagedFilters.status = '';
		stagedFilters.category = '';
		filters.type = '';
		filters.frequency = '';
		filters.status = '';
		filters.category = '';
	}

	function openAdd() {
		editingRecurring = null;
		showAddPanel = true;
	}

	function openEdit(recurring: RecurringTransaction) {
		editingRecurring = recurring;
		showAddPanel = true;
	}

	function closePanel() {
		showAddPanel = false;
		editingRecurring = null;
	}

	// Accessible dialog: move focus in, trap Tab, close on Escape, restore focus on close.
	$effect(() => {
		if (!showAddPanel || !browser) return;
		const trigger =
			document.activeElement instanceof HTMLElement ? document.activeElement : addBtnEl;
		document.body.style.overflow = 'hidden';
		requestAnimationFrame(() => {
			panelEl?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus();
		});
		const onKeydown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				closePanel();
				return;
			}
			if (e.key === 'Tab' && panelEl) {
				const focusables = Array.from(
					panelEl.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
				);
				if (focusables.length === 0) return;
				const first = focusables[0];
				const last = focusables[focusables.length - 1];
				if (e.shiftKey && document.activeElement === first) {
					e.preventDefault();
					last.focus();
				} else if (!e.shiftKey && document.activeElement === last) {
					e.preventDefault();
					first.focus();
				}
			}
		};
		document.addEventListener('keydown', onKeydown);
		return () => {
			document.removeEventListener('keydown', onKeydown);
			document.body.style.overflow = '';
			trigger?.focus();
		};
	});

	async function handleDelete(id: number | number[]) {
		const ids = Array.isArray(id) ? id : [id];
		try {
			const res = await fetch(`/api/recurring/${ids[0]}`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
			});
			const result = await res.json();
			if (result.success) {
				showSuccess(`Deleted ${result.deleted} recurring transaction${result.deleted > 1 ? 's' : ''}`);
				await invalidateAll();
			} else {
				showError(result.error || 'Failed to delete');
			}
		} catch {
			showError('Failed to delete');
		}
		deleteTarget = null;
	}

	async function handleRunNow(id: number) {
		try {
			const res = await fetch(`/api/recurring/${id}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'runNow' }),
			});
			const result = await res.json();
			if (result.success) {
				showSuccess('Transaction generated successfully');
				await invalidateAll();
			} else {
				showError(result.error || 'Failed to run');
			}
		} catch {
			showError('Failed to run');
		}
	}

	async function handlePause(id: number) {
		try {
			const res = await fetch(`/api/recurring/${id}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'pause' }),
			});
			const result = await res.json();
			if (result.success) {
				showSuccess('Recurring transaction paused');
				await invalidateAll();
			} else {
				showError(result.error || 'Failed to pause');
			}
		} catch {
			showError('Failed to pause');
		}
	}

	async function handleResume(id: number) {
		try {
			const res = await fetch(`/api/recurring/${id}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'resume' }),
			});
			const result = await res.json();
			if (result.success) {
				showSuccess('Recurring transaction resumed');
				await invalidateAll();
			} else {
				showError(result.error || 'Failed to resume');
			}
		} catch {
			showError('Failed to resume');
		}
	}

	async function handleDuplicate(id: number) {
		try {
			const res = await fetch(`/api/recurring/${id}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'duplicate' }),
			});
			const result = await res.json();
			if (result.success) {
				showSuccess('Recurring transaction duplicated');
				await invalidateAll();
			} else {
				showError(result.error || 'Failed to duplicate');
			}
		} catch {
			showError('Failed to duplicate');
		}
	}

	function onFormSuccess() {
		closePanel();
		invalidateAll();
	}

	// Slide panel form submission via fetch to the API
	// (avoids needing SvelteKit form actions on the main listing page)
	async function handleFormSubmit(formData: FormData): Promise<boolean> {
		try {
			const id = formData.get('id');
			const isEdit = id && id !== '';
			const url = isEdit ? `/api/recurring/${id}` : '/api/recurring';
			const method = isEdit ? 'PUT' : 'POST';

			// Build JSON body from form data
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

			const res = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});
			const result = await res.json();

			if (result.success) {
				await invalidateAll();
				return true;
			} else {
				showError(result.error || 'Failed to save');
				return false;
			}
		} catch {
			showError('Failed to save');
			return false;
		}
	}

	function buildFilterQs(): string {
		const params = new URLSearchParams();
		if (filters.type) params.set('type', filters.type);
		if (filters.frequency) params.set('frequency', filters.frequency);
		if (filters.status) params.set('status', filters.status);
		if (filters.category) {
			const cat = (data.categories ?? []).find((c) => c.name === filters.category);
			if (cat) params.set('category_id', String(cat.id));
		}
		if (filters.search) params.set('search', filters.search);
		const qs = params.toString();
		return qs ? '&' + qs : '';
	}

	async function handleExportCsv() {
		try {
			const res = await fetch(`/api/recurring/export${buildFilterQs()}`);
			if (!res.ok) throw new Error('Export failed');
			const csv = await res.text();
			const blob = new Blob([csv], { type: 'text/csv' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `recurring-${new Date().toISOString().split('T')[0]}.csv`;
			a.click();
			URL.revokeObjectURL(url);
			showSuccess('CSV exported successfully');
		} catch {
			showError('Failed to export CSV');
		}
	}

</script>

<svelte:head>
	<title>Recurring Transactions — Finance Tracker</title>
</svelte:head>

<PageHeader title="Recurring Transactions" borderless>
	{#snippet badge()}
		<CountChip count={activeCount} suffix="active" />
	{/snippet}
	{#snippet action()}
		<div class="header-actions">
			<Button variant="primary" bind:el={addBtnEl} onclick={openAdd}>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
					<line x1="12" y1="5" x2="12" y2="19"/>
					<line x1="5" y1="12" x2="19" y2="12"/>
				</svg>
				Add Recurring
			</Button>
			<OverflowMenu
				selectLabel="Select Recurring"
				onExportCsv={handleExportCsv}
				onSelect={() => { selectionMode = true; selectedIds = new Set(); }}
			/>
		</div>
	{/snippet}
</PageHeader>

<PageBackground />

<!-- Search & Filter Pill -->
<SearchFilterPill
	bind:value={searchInput}
	placeholder="Search recurring transactions..."
	bind:open={filtersOpen}
	activeFilterCount={activeFilterCount}
>
	{#snippet panel(mode, close)}
		<div class="filter-sheet-content">
			<div class="filter-section">
				<h3 class="filter-section-title">Type</h3>
				<div class="filter-chips">
					<button class="filter-chip" class:active={stagedFilters.type === 'income'} onclick={() => stagedFilters.type = stagedFilters.type === 'income' ? '' : 'income'}>
						💰 Income
					</button>
					<button class="filter-chip" class:active={stagedFilters.type === 'expense'} onclick={() => stagedFilters.type = stagedFilters.type === 'expense' ? '' : 'expense'}>
						💸 Expense
					</button>
				</div>
			</div>

			<div class="filter-section">
				<h3 class="filter-section-title">Frequency</h3>
				<div class="filter-chips">
					<button class="filter-chip" class:active={stagedFilters.frequency === 'daily'} onclick={() => stagedFilters.frequency = stagedFilters.frequency === 'daily' ? '' : 'daily'}>
						📅 Daily
					</button>
					<button class="filter-chip" class:active={stagedFilters.frequency === 'weekly'} onclick={() => stagedFilters.frequency = stagedFilters.frequency === 'weekly' ? '' : 'weekly'}>
						📅 Weekly
					</button>
					<button class="filter-chip" class:active={stagedFilters.frequency === 'monthly'} onclick={() => stagedFilters.frequency = stagedFilters.frequency === 'monthly' ? '' : 'monthly'}>
						📅 Monthly
					</button>
					<button class="filter-chip" class:active={stagedFilters.frequency === 'yearly'} onclick={() => stagedFilters.frequency = stagedFilters.frequency === 'yearly' ? '' : 'yearly'}>
						📅 Yearly
					</button>
				</div>
			</div>

			<div class="filter-section">
				<h3 class="filter-section-title">Status</h3>
				<div class="filter-chips">
					<button class="filter-chip" class:active={stagedFilters.status === 'active'} onclick={() => stagedFilters.status = stagedFilters.status === 'active' ? '' : 'active'}>
						✅ Active
					</button>
					<button class="filter-chip" class:active={stagedFilters.status === 'paused'} onclick={() => stagedFilters.status = stagedFilters.status === 'paused' ? '' : 'paused'}>
						⏸️ Paused
					</button>
				</div>
			</div>

			<div class="filter-section">
				<h3 class="filter-section-title">Category</h3>
				<div class="filter-category-select">
					<select
						value={stagedFilters.category}
						onchange={(e) => stagedFilters.category = (e.target as HTMLSelectElement).value}
					>
						<option value="">All Categories</option>
						{#each data.categories as cat (cat.id)}
							<option value={cat.name}>{cat.icon} {cat.name}</option>
						{/each}
					</select>
				</div>
			</div>
		</div>
		<FilterFooter
			canApply={canApply}
			canClear={canClear}
			onApply={() => { applyFilters(); close(); }}
			onClear={resetFilters}
			{mode}
		/>
	{/snippet}
</SearchFilterPill>

<!-- ═══ Bulk selection action bar (Selection Mode only) ═══ -->
{#if selectionMode && pageIds.length > 0}
	<div class="bulk-bar" role="toolbar" aria-label="Selected recurring transactions">
		<div class="bulk-left">
			<input
				type="checkbox"
				checked={allSelected}
				use:setIndeterminate={someSelected}
				onchange={toggleAll}
				aria-label="Select all recurring transactions on this page"
			/>
			<span class="bulk-count">{selectedCount} selected</span>
		</div>
		<div class="bulk-actions">
			<Button variant="danger" size="sm" disabled={selectedCount === 0} onclick={() => (deleteTarget = [...selectedIds])}>Delete Selected</Button>
			<Button variant="ghost" size="sm" onclick={exitSelectionMode}>Cancel</Button>
		</div>
	</div>
{/if}

<!-- Recurring List -->
<div class="recurring-page-content">
	<RecurringList
		recurring={data.recurring ?? []}
		onDelete={(id) => deleteTarget = id}
		onEdit={openEdit}
		onDuplicate={handleDuplicate}
		onRunNow={handleRunNow}
		onPause={handlePause}
		onResume={handleResume}
		loading={false}
		selectionMode={selectionMode}
		selectedIds={selectedIds}
		onToggleSelection={toggleSelection}
	>
		{#snippet emptyState()}
			<div class="rr-empty">
				<div class="rr-empty-icon">
					<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
						<path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>
					</svg>
				</div>
				<p class="rr-empty-title">No recurring transactions yet</p>
				<p class="rr-empty-sub">Add your first recurring transaction to automate your finances</p>
				<button class="rr-empty-btn" onclick={openAdd} type="button">Add Recurring Transaction</button>
			</div>
		{/snippet}
	</RecurringList>

	<!-- Pagination -->
	{#if (data.total ?? 0) > 0}
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

<!-- Add/Edit Panel -->
{#if showAddPanel}
	<button class="panel-overlay" onclick={closePanel} aria-label="Close panel"></button>
	<div class="slide-panel" bind:this={panelEl} role="dialog" aria-modal="true" aria-labelledby="panel-title">
		<div class="panel-header">
			<h2 id="panel-title" class="panel-title">{editingRecurring ? 'Edit Recurring Transaction' : 'Add Recurring Transaction'}</h2>
			<button class="panel-close" onclick={closePanel} aria-label="Close">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
			</button>
		</div>
		<div class="panel-content">
		{#key editingRecurring?.id ?? 'new'}
			<RecurringForm
				categories={data.categories ?? []}
				recurring={editingRecurring ?? undefined}
				onSubmit={handleFormSubmit}
				onSuccess={onFormSuccess}
			/>
		{/key}
		</div>
	</div>
{/if}

<!-- Delete Modal -->
{#if deleteTarget !== null}
	{@const isBulk = Array.isArray(deleteTarget)}
	{@const deleteCount = Array.isArray(deleteTarget) ? deleteTarget.length : 1}
	{@const deleteIdsStr = Array.isArray(deleteTarget) ? deleteTarget.join(',') : String(deleteTarget)}
	<ModalDialog
		open={deleteTarget !== null}
		title={isBulk ? 'Delete Recurring Transactions' : 'Delete Recurring Transaction'}
		onclose={() => deleteTarget = null}
	>
		<p>
			Are you sure you want to delete {isBulk ? `${deleteCount} recurring transactions` : 'this recurring transaction'}?
			This action cannot be undone.
		</p>
		{#if isBulk}
			<form
				method="POST"
				action="?/deleteBulk"
				use:enhance={() => {
					return async ({ result, update }: { result: { type: string; data?: { error?: string; deleted?: number } }; update: () => Promise<void> }) => {
						await update();
						if (result.type === 'success') {
							exitSelectionMode();
							deleteTarget = null;
							showSuccess(`${result.data?.deleted ?? deleteCount} recurring transaction${(result.data?.deleted ?? deleteCount) > 1 ? 's' : ''} deleted`);
						} else {
							showError((result.data as { error?: string } | undefined)?.error || 'Failed to delete');
						}
					};
				}}
			>
				<input type="hidden" name="id" value={deleteIdsStr} />
				<div class="modal-actions">
					<Button variant="ghost" type="button" onclick={() => deleteTarget = null}>Cancel</Button>
					<Button variant="danger" type="submit">Delete</Button>
				</div>
			</form>
		{:else}
			<div class="modal-actions">
				<Button variant="ghost" type="button" onclick={() => deleteTarget = null}>Cancel</Button>
				<Button variant="danger" onclick={() => { handleDelete(deleteTarget as number); deleteTarget = null; }}>Delete</Button>
			</div>
		{/if}
	</ModalDialog>
{/if}

<style>
	/* Raise the header's stacking context so the OverflowMenu dropdown
	   (trapped inside the header's backdrop-filter context) paints above
	   the content that follows it. Matches /transactions & /lending. */
	:global(.page-header) {
		position: relative;
		z-index: 30;
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

	/* ── Search filter pill positioning ── */
	:global(.search-filter-pill) {
		margin-top: var(--space-md);
		margin-bottom: var(--space-md);
	}

	/* Search + Filter — soft teal focus ring, never a hard outline (Section 5(6)) */
	:global(.search-filter-pill.search-filter-pill:focus-within) {
		border-color: var(--line);
		box-shadow: 0 0 0 2px rgba(79, 157, 136, 0.35), 0 4px 16px rgba(79, 157, 136, 0.12);
	}

	:global(.search-filter-btn.search-filter-btn:focus-visible) {
		outline: none;
		box-shadow: 0 0 0 2px rgba(79, 157, 136, 0.35);
	}

	.rr-empty-btn:focus-visible {
		outline: 2px solid var(--teal-deep);
		outline-offset: 2px;
	}

	.modal-actions {
		display: flex;
		gap: var(--space-sm);
		margin-top: var(--space-md);
	}

	.modal-actions :global(.btn) {
		flex: 1;
	}

	/* ── Empty state — mint circle icon + mint pill create button ── */
	.rr-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--space-2xl) var(--space-lg);
		text-align: center;
		background: var(--color-surface);
		border: 1px solid var(--line);
		border-radius: 22px;
		box-shadow: 0 8px 28px rgba(79, 157, 136, 0.10);
		gap: 8px;
	}

	.rr-empty-icon {
		width: 88px;
		height: 88px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: var(--mint-tint);
		color: var(--teal-deep);
		margin-bottom: 4px;
	}

	.rr-empty-title {
		font-family: var(--font-display);
		font-size: var(--font-size-lg);
		font-weight: 700;
		color: var(--ink);
		margin: 0;
	}

	.rr-empty-sub {
		font-size: var(--font-size-sm);
		color: var(--muted);
		margin: 0 0 4px;
		max-width: 300px;
		line-height: 1.5;
	}

	/* Teal CTA — a gold header Add coexists on this page, so the empty-state
	   CTA stays teal (rule: gold only when it is the sole create affordance). */
	.rr-empty-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 44px;
		padding: 0 var(--space-xl);
		border: none;
		border-radius: var(--radius-pill);
		background: var(--teal);
		color: var(--color-surface);
		font-family: var(--font-display);
		font-size: var(--font-size-sm);
		font-weight: 600;
		cursor: pointer;
		transition: background 140ms ease-out, box-shadow 140ms ease-out;
		-webkit-tap-highlight-color: transparent;
	}

	.rr-empty-btn:hover {
		background: var(--teal-deep);
		box-shadow: 0 4px 16px rgba(79, 157, 136, 0.22);
	}

	/* ── Header actions ── */
	.header-actions {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	/* ── Page content ── */
	.recurring-page-content {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
	}

	/* ─── Pagination (Pager Container & Footer) ─── */
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

	/* ── Slide panel ── */
	.panel-overlay {
		position: fixed;
		inset: 0;
		background: rgba(20, 48, 46, 0.40);
		backdrop-filter: blur(4px);
		-webkit-backdrop-filter: blur(4px);
		z-index: 95;
		animation: overlayIn 200ms ease;
		border: none;
		padding: 0;
		cursor: pointer;
	}

	.slide-panel {
		position: fixed;
		top: 0;
		right: 0;
		width: 100%;
		max-width: 520px;
		height: 100vh;
		height: 100dvh;
		background: var(--color-surface);
		border-left: 1px solid var(--color-hairline);
		box-shadow: var(--shadow-lg);
		z-index: 96;
		display: flex;
		flex-direction: column;
		animation: slideIn 300ms var(--bounce);
		overflow: hidden;
	}

	@keyframes slideIn {
		from { transform: translateX(100%); }
		to { transform: translateX(0); }
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-md) var(--space-lg);
		border-bottom: 1px solid var(--color-hairline);
		flex-shrink: 0;
	}

	.panel-title {
		font-family: var(--font-display);
		font-size: var(--font-size-lg);
		font-weight: 700;
		color: var(--color-text);
		margin: 0;
	}

	.panel-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border: none;
		background: transparent;
		color: var(--color-text-muted);
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: all 150ms var(--ease);
		-webkit-tap-highlight-color: transparent;
	}

	.panel-close:hover {
		background: var(--color-bg);
		color: var(--color-teal);
	}

	.panel-content {
		flex: 1;
		overflow-y: auto;
		padding: var(--space-lg);
	}

	/* ── Filter sheet ──
	   No internal max-height/scroll here: the popover/sheet host scrolls the
	   panel so the shared sticky footer stays pinned to the bottom. */
	.filter-sheet-content {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		padding: var(--space-md);
	}

	.filter-section-title {
		font-family: var(--font-display);
		font-size: var(--font-size-sm);
		font-weight: 700;
		color: var(--color-text);
		margin: 0 0 var(--space-sm);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.filter-chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
	}

	.filter-chip {
		padding: var(--space-xs) var(--space-md);
		border: 1px solid var(--color-hairline);
		background: var(--color-cream);
		border-radius: var(--radius-pill);
		font-family: var(--font-body);
		font-size: var(--font-size-sm);
		font-weight: 500;
		color: var(--color-text);
		cursor: pointer;
		transition: all 200ms var(--bounce);
		-webkit-tap-highlight-color: transparent;
	}

	.filter-chip:hover {
		border-color: var(--color-teal);
		background: var(--color-teal-bg);
	}

	.filter-chip.active {
		background: var(--color-teal);
		border-color: var(--color-teal);
		color: white;
		box-shadow: var(--glow-card);
	}

	.filter-category-select select {
		width: 100%;
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-md);
		font-size: var(--font-size-base);
		font-family: var(--font-body);
		background: var(--color-cream);
		color: var(--color-text);
		min-height: 44px;
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 12px center;
		padding-right: 40px;
		cursor: pointer;
	}

	.filter-category-select select:focus {
		outline: none;
		border-color: var(--color-teal);
		box-shadow: var(--focus);
	}

	/* ── Mobile ── */
	@media (max-width: 768px) {
		:global(.header-actions .btn-primary) {
			display: none !important;
		}
	}

	@media (max-width: 480px) {
		.header-actions {
			flex-direction: column;
			width: 100%;
		}

		:global(.header-actions .btn) {
			width: 100%;
		}

		.slide-panel {
			max-width: 100%;
		}

		.panel-content {
			padding: var(--space-md);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		*, *::before, *::after {
			transition: none !important;
			animation: none !important;
		}
	}
</style>
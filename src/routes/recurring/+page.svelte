<script lang="ts">
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { goto, invalidateAll } from '$app/navigation';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import PageBackground from '$lib/components/PageBackground.svelte';
	import RecurringForm from '$lib/components/RecurringForm.svelte';
	import RecurringList from '$lib/components/RecurringList.svelte';
	import OverflowMenu from '$lib/components/OverflowMenu.svelte';
	import SearchFilterPill from '$lib/components/SearchFilterPill.svelte';
	import FilterFooter from '$lib/components/FilterFooter.svelte';
	import ModalDialog from '$lib/components/ModalDialog.svelte';
	import Button from '$lib/components/Button.svelte';
	import CountChip from '$lib/components/CountChip.svelte';
	import { showSuccess, showError } from '$lib/stores/toast.svelte';
	import type { RecurringTransaction } from '$lib/types';

	let data = $derived($page.data as App.PageData);
	let activeCount = $derived(data.activeCount ?? 0);
	let deleteTarget = $state<number | number[] | null>(null);
	let showAddPanel = $state(false);
	let editingRecurring = $state<RecurringTransaction | null>(null);
	let panelEl = $state<HTMLDivElement | null>(null);
	let addBtnEl = $state<HTMLElement | null>(null);
	let filtersOpen = $state(false);

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
			<OverflowMenu onExportCsv={handleExportCsv} />
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
	{#if (data.totalPages ?? 0) > 1}
		<nav class="pagination" aria-label="Pagination">
			<button
				class="page-btn"
				disabled={(data.page ?? 1) === 1}
				onclick={() => goto(`/recurring?page=${(data.page ?? 1) - 1}${buildFilterQs()}`)}
				aria-label="Previous page"
			>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
			</button>
			<span class="page-info" aria-live="polite">
				Page {data.page ?? 1} of {data.totalPages ?? 0} ({data.total} items)
			</span>
			<button
				class="page-btn"
				disabled={(data.page ?? 1) === (data.totalPages ?? 0)}
				onclick={() => goto(`/recurring?page=${(data.page ?? 1) + 1}${buildFilterQs()}`)}
				aria-label="Next page"
			>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
			</button>
		</nav>
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
		<RecurringForm
			categories={data.categories ?? []}
			recurring={editingRecurring ?? undefined}
			onSubmit={handleFormSubmit}
			onSuccess={onFormSuccess}
		/>
		</div>
	</div>
{/if}

<!-- Delete Modal -->
<ModalDialog
	open={deleteTarget !== null}
	title="Delete Recurring Transaction"
	onclose={() => deleteTarget = null}
>
	<p>Are you sure you want to delete this recurring transaction? This action cannot be undone.</p>
	<div class="modal-actions">
		<Button variant="ghost" type="button" onclick={() => deleteTarget = null}>Cancel</Button>
		<Button variant="danger" onclick={() => { handleDelete(deleteTarget!); deleteTarget = null; }}>Delete</Button>
	</div>
</ModalDialog>

<style>
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

	/* ── Pagination ── */
	.pagination {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-md);
		margin-top: var(--space-lg);
		padding-top: var(--space-lg);
		border-top: 1px solid var(--color-hairline);
	}

	.page-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border: 1px solid var(--color-hairline);
		background: var(--color-surface);
		border-radius: var(--radius-md);
		color: var(--color-text);
		cursor: pointer;
		transition: all 150ms var(--ease);
		-webkit-tap-highlight-color: transparent;
	}

	.page-btn:hover:not(:disabled) {
		background: var(--color-teal-bg);
		border-color: var(--color-teal);
		color: var(--color-teal);
	}

	.page-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.page-info {
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
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
	@media (max-width: 480px) {
		.header-actions {
			flex-direction: column;
			width: 100%;
		}

		.header-actions .btn {
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
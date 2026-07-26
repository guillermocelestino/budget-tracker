<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import TransactionList from '$lib/components/TransactionList.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import ModalDialog from '$lib/components/ModalDialog.svelte';
import PageBackground from '$lib/components/PageBackground.svelte';
	import { showSuccess, showError } from '$lib/stores/toast.svelte';

	let data = $derived($page.data as App.PageData);
	let deleteId = $state<number | null>(null);

	let typeFilter = $state($page.url.searchParams.get('type') || '');
	let categoryFilter = $state($page.url.searchParams.get('category_id') || '');
	let dateFromFilter = $state($page.url.searchParams.get('date_from') || '');
	let dateToFilter = $state($page.url.searchParams.get('date_to') || '');

	let showFilters = $state(true);

	const activeFilterCount = $derived(
		[typeFilter, categoryFilter, dateFromFilter, dateToFilter].filter(Boolean).length
	);

	function applyFilters() {
		const params = new URLSearchParams();
		if (typeFilter) params.set('type', typeFilter);
		if (categoryFilter) params.set('category_id', categoryFilter);
		if (dateFromFilter) params.set('date_from', dateFromFilter);
		if (dateToFilter) params.set('date_to', dateToFilter);
		params.set('page', '1');
		goto(`/transactions?${params.toString()}`);
	}

	function clearFilters() {
		typeFilter = '';
		categoryFilter = '';
		dateFromFilter = '';
		dateToFilter = '';
		goto('/transactions');
	}

	function goToPage(p: number) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', String(p));
		goto(`/transactions?${params.toString()}`);
	}
</script>

<svelte:head>
	<title>Transactions — Budget Tracker</title>
</svelte:head>

<PageBackground />

<PageHeader title="Transactions">
	{#snippet action()}
		<a href="/transactions/new" class="btn-primary-sm">+ Add Transaction</a>
	{/snippet}
</PageHeader>

<button class="filter-toggle" onclick={() => showFilters = !showFilters}>
	<span class="filter-toggle-label">
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
		</svg>
		Filters
	</span>
	{#if activeFilterCount > 0}
		<span class="filter-badge">{activeFilterCount}</span>
	{/if}
	<span class="filter-arrow" class:open={showFilters}>
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<polyline points="6 9 12 15 18 9"/>
		</svg>
	</span>
</button>

{#if showFilters}
	<div class="filter-panel">
		<select bind:value={typeFilter}>
			<option value="">All Types</option>
			<option value="income">Income</option>
			<option value="expense">Expense</option>
		</select>

		<select bind:value={categoryFilter}>
			<option value="">All Categories</option>
			{#each data.categories ?? [] as cat (cat.id)}
				<option value={cat.id}>{cat.icon} {cat.name}</option>
			{/each}
		</select>

		<input type="date" bind:value={dateFromFilter} placeholder="From" />
		<input type="date" bind:value={dateToFilter} placeholder="To" />

		<div class="filter-actions">
			<button class="btn-filter" onclick={applyFilters}>Apply</button>
			<button class="btn-clear" onclick={clearFilters}>Clear</button>
		</div>
	</div>
{/if}

<TransactionList
	transactions={data.transactions ?? []}
	onDelete={(id) => deleteId = id}
/>

{#if (data.totalPages ?? 0) > 1}
	<div class="pagination">
		<button class="page-btn" disabled={data.page === 1} onclick={() => goToPage(data.page! - 1)}>← Prev</button>
		<span class="page-info">Page {data.page} of {data.totalPages}</span>
		<button class="page-btn" disabled={data.page === data.totalPages} onclick={() => goToPage(data.page! + 1)}>Next →</button>
	</div>
{/if}

{#if deleteId !== null}
	<ModalDialog open={deleteId !== null} onclose={() => deleteId = null} title="Delete Transaction">
		<p>Are you sure you want to delete this transaction? This action cannot be undone.</p>
		<form method="POST" action="?/delete" use:enhance={() => {
			return async ({ result, update }: { result: { type: string; data?: { error?: string } }; update: () => Promise<void> }) => {
				if (result.type === 'success') {
					deleteId = null;
					showSuccess('Transaction deleted successfully');
				} else if (result.type === 'failure') {
					showError(result.data?.error || 'Failed to delete transaction');
				}
				await update();
			};
		}}>
			<input type="hidden" name="id" value={deleteId} />
			<div class="modal-actions">
				<button type="submit" class="btn-danger">Delete</button>
				<button type="button" class="btn-cancel" onclick={() => deleteId = null}>Cancel</button>
			</div>
		</form>
	</ModalDialog>
{/if}

<style>
	.filter-toggle {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		padding: var(--space-sm) var(--space-md);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		cursor: pointer;
		font-size: var(--font-size-sm);
		font-family: inherit;
		font-weight: 600;
		color: var(--color-text);
		min-height: 44px;
		margin-bottom: var(--space-sm);
		transition: background var(--transition-fast);
	}

	.filter-toggle:hover {
		background: var(--color-primary-light);
	}

	.filter-toggle-label {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
	}

	.filter-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 22px;
		height: 22px;
		padding: 0 6px;
		background: var(--color-primary);
		color: white;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 700;
		line-height: 1;
	}

	.filter-arrow {
		font-size: 0.7rem;
		color: var(--color-text-secondary);
		transition: transform var(--transition-fast);
	}

	.filter-panel {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
		margin-bottom: var(--space-md);
		padding: var(--space-md);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		align-items: center;
	}

	.filter-panel select,
	.filter-panel input {
		padding: var(--space-xs) var(--space-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		font-size: var(--font-size-sm);
		font-family: inherit;
		background: var(--color-bg);
		color: var(--color-text);
		min-height: 44px;
		flex: 1;
		min-width: 140px;
	}

	.filter-panel select:focus,
	.filter-panel input:focus {
		outline: none;
		border-color: var(--color-primary);
	}

	.filter-actions {
		display: flex;
		gap: var(--space-sm);
	}

	.btn-filter,
	.btn-clear {
		padding: var(--space-xs) var(--space-md);
		border-radius: var(--radius-sm);
		font-size: var(--font-size-sm);
		font-weight: 600;
		cursor: pointer;
		border: 1px solid var(--color-border);
		min-height: 44px;
	}

	.btn-filter {
		background: var(--color-primary);
		color: white;
		border-color: var(--color-primary);
	}

	.btn-filter:hover {
		background: var(--color-primary-hover);
	}

	.btn-clear {
		background: var(--color-bg);
		color: var(--color-text);
	}

	.btn-clear:hover {
		background: var(--color-border);
	}

	.btn-primary-sm {
		display: inline-block;
		padding: var(--space-sm) var(--space-md);
		background: var(--color-primary);
		color: white;
		border-radius: var(--radius-md);
		font-size: var(--font-size-sm);
		font-weight: 600;
		text-decoration: none;
		min-height: 44px;
		line-height: 44px;
	}

	.pagination {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-md);
		margin-top: var(--space-lg);
	}

	.page-btn {
		padding: 10px var(--space-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		cursor: pointer;
		font-size: var(--font-size-sm);
		min-height: 44px;
		min-width: 80px;
		transition: background var(--transition-fast), border-color var(--transition-fast);
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

	.modal-actions {
		display: flex;
		gap: var(--space-sm);
		margin-top: var(--space-md);
	}

	.btn-danger {
		padding: 12px var(--space-lg);
		background: var(--color-expense);
		color: white;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
		font-weight: 600;
		flex: 1;
	}

	.btn-danger:hover {
		background: var(--color-danger-hover);
	}

	.btn-cancel {
		padding: 12px var(--space-lg);
		background: var(--color-bg);
		color: var(--color-text);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		cursor: pointer;
		font-weight: 600;
		flex: 1;
	}

	.btn-cancel:hover {
		background: var(--color-border);
	}

	@media (max-width: 768px) {
		.filter-panel {
			flex-direction: column;
			align-items: stretch;
		}

		.filter-panel select,
		.filter-panel input {
			width: 100%;
			min-width: 0;
		}

		.filter-actions {
			flex-direction: column;
		}

		.filter-actions .btn-filter,
		.filter-actions .btn-clear {
			width: 100%;
		}

		.pagination {
			flex-direction: column;
			gap: var(--space-sm);
		}

		.page-btn {
			width: 100%;
		}
	}
</style>

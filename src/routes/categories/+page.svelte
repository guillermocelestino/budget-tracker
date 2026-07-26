<script lang="ts">
	import { page } from '$app/stores';
	import { enhance } from '$app/forms';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import CategoryList from '$lib/components/CategoryList.svelte';
	import CategoryForm from '$lib/components/CategoryForm.svelte';
	import ModalDialog from '$lib/components/ModalDialog.svelte';
	import { showSuccess, showError } from '$lib/stores/toast.svelte';
	import { formatCurrency } from '$lib/utils/format';
	import type { Category } from '$lib/types';
	import PageBackground from '$lib/components/PageBackground.svelte';

	let data = $derived($page.data as App.PageData);

	let showForm = $state(false);
	let viewMode = $state<'card' | 'table'>('card');
	let editingCategory = $state<Category | null>(null);
	let deleteId = $state<number | null>(null);

	let formError = $state('');

	const categories = $derived(data.categories ?? []);

	function openAdd() {
		editingCategory = null;
		formError = '';
		showForm = true;
		if (typeof window !== 'undefined' && window.innerWidth >= 768) {
			window.scrollTo({ top: 0, behavior: 'smooth' });
		}
	}

	function openEdit(cat: Category) {
		editingCategory = cat;
		formError = '';
		showForm = true;
		if (typeof window !== 'undefined' && window.innerWidth >= 768) {
			window.scrollTo({ top: 0, behavior: 'smooth' });
		}
	}

	function closeForm() {
		showForm = false;
		editingCategory = null;
		formError = '';
	}
</script>

<svelte:head>
	<title>Categories — Budget Tracker</title>
</svelte:head>

<PageBackground />

<PageHeader title="Categories">
	{#snippet action()}
		<button class="btn-primary-sm" onclick={openAdd}>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
				<line x1="12" x2="12" y1="5" y2="19"/>
				<line x1="5" x2="19" y1="12" y2="12"/>
			</svg>
			Add Category
		</button>
	{/snippet}
</PageHeader>

{#if showForm}
	<div class="form-panel">
		<div class="form-panel-header">
			<h3>
				{#if editingCategory}
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
					</svg>
					Edit Category
				{:else}
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="12" x2="12" y1="5" y2="19"/>
						<line x1="5" x2="19" y1="12" y2="12"/>
					</svg>
					Add Category
				{/if}
			</h3>
			<button class="btn-close" onclick={closeForm} aria-label="Close">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="18" x2="6" y1="6" y2="18"/>
					<line x1="6" x2="18" y1="6" y2="18"/>
				</svg>
			</button>
		</div>
		{#if formError}
			<div class="form-error">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="10"/>
					<line x1="12" x2="12" y1="8" y2="12"/>
					<line x1="12" x2="12.01" y1="16" y2="16"/>
				</svg>
				{formError}
			</div>
		{/if}
		<CategoryForm
			category={editingCategory ?? undefined}
			action={editingCategory ? '?/update' : '?/create'}
			onCancel={closeForm}
			onSuccess={closeForm}
		/>
	</div>
{/if}

<!-- View Toggle -->
<div class="view-toggle-row">
	<div class="view-toggle">
		<button class="toggle-btn" class:active={viewMode === 'card'} onclick={() => viewMode = 'card'} title="Card View">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<rect x="3" y="3" width="7" height="7" rx="1"/>
				<rect x="14" y="3" width="7" height="7" rx="1"/>
				<rect x="3" y="14" width="7" height="7" rx="1"/>
				<rect x="14" y="14" width="7" height="7" rx="1"/>
			</svg>
		</button>
		<button class="toggle-btn" class:active={viewMode === 'table'} onclick={() => viewMode = 'table'} title="Table View">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<rect x="3" y="3" width="18" height="18" rx="2"/>
				<line x1="3" y1="9" x2="21" y2="9"/>
				<line x1="3" y1="15" x2="21" y2="15"/>
				<line x1="9" y1="3" x2="9" y2="21"/>
				<line x1="15" y1="3" x2="15" y2="21"/>
			</svg>
		</button>
	</div>
</div>

{#if viewMode === 'card'}
	<CategoryList
		categories={categories}
		spending={data.spending ?? {}}
		income={data.income ?? {}}
		onEdit={openEdit}
		onDelete={(id) => deleteId = id}
	/>
{:else}
	<div class="cat-table-section">
		<table class="cat-table">
			<thead>
				<tr>
					<th>Category</th>
					<th>Type</th>
					<th>Spent</th>
					<th>Budget</th>
					<th class="actions-col">Actions</th>
				</tr>
			</thead>
			<tbody>
				{#each categories as cat (cat.id)}
					<tr>
						<td>
							<span class="cat-icon-sm" style="background: {cat.color}15; color: {cat.color}">{cat.icon}</span>
							<span class="cat-name-cell">{cat.name}</span>
						</td>
						<td>
							<span class="type-badge-sm" class:income={cat.type === 'income'} class:expense={cat.type === 'expense'}>
								{cat.type === 'income' ? '💰 Income' : '💸 Expense'}
							</span>
						</td>
						<td class="amount-cell">{formatCurrency((data.spending ?? {})[cat.id] || 0)}</td>
						<td>
							{cat.budget_limit ? formatCurrency(cat.budget_limit) : '—'}
						</td>
						<td class="actions-cell">
							<button class="btn-action" onclick={() => openEdit(cat)} title="Edit">✏️</button>
							<button class="btn-action" onclick={() => deleteId = cat.id} title="Delete">🗑️</button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

{#if deleteId !== null}
	<ModalDialog open={deleteId !== null} onclose={() => deleteId = null} title="Delete Category">
		<div class="modal-content">
			<div class="modal-icon">
				<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
					<line x1="12" x2="12" y1="9" y2="13"/>
					<line x1="12" x2="12.01" y1="17" y2="17"/>
				</svg>
			</div>
			<p>Are you sure you want to delete this category?</p>
			<p class="warning">Categories with transactions cannot be deleted.</p>
		</div>
		<form method="POST" action="?/delete" use:enhance={() => {
			return async ({ result, update }: { result: { type: string; data?: { error?: string } }; update: () => Promise<void> }) => {
				if (result.type === 'success') {
					deleteId = null;
					showSuccess('Category deleted successfully');
				} else if (result.type === 'failure') {
					showError(result.data?.error || 'Failed to delete category');
				}
				await update();
			};
		}}>
			<input type="hidden" name="id" value={deleteId} />
			<div class="modal-actions">
				<button type="submit" class="btn-danger">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="3 6 5 6 21 6"/>
						<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
					</svg>
					Delete
				</button>
				<button type="button" class="btn-cancel" onclick={() => deleteId = null}>Cancel</button>
			</div>
		</form>
	</ModalDialog>
{/if}

<style>
	.btn-primary-sm {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		padding: var(--space-sm) var(--space-md);
		background: linear-gradient(135deg, var(--color-primary) 0%, #8b5cf6 100%);
		color: white;
		border: none;
		border-radius: var(--radius-md);
		font-size: var(--font-size-sm);
		font-weight: 600;
		cursor: pointer;
		min-height: 44px;
		box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
		transition: all var(--transition-fast);
	}

	.btn-primary-sm:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
	}

	/* View Toggle */
	.view-toggle-row {
		display: flex;
		justify-content: flex-end;
		margin-bottom: var(--space-md);
	}

	.view-toggle {
		display: flex;
		gap: 2px;
		background: var(--color-bg);
		padding: 4px;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
	}

	.toggle-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 8px 12px;
		border: none;
		background: transparent;
		border-radius: var(--radius-sm);
		cursor: pointer;
		color: var(--color-text-secondary);
		transition: all var(--transition-fast);
		min-height: 36px;
	}

	.toggle-btn.active {
		background: var(--color-primary);
		color: white;
		box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
	}

	.toggle-btn:hover:not(.active) {
		background: var(--color-surface);
		color: var(--color-text);
	}

	/* Table View */
	.cat-table-section {
		background: rgba(255, 255, 255, 0.85);
		backdrop-filter: blur(20px);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		padding: var(--space-lg);
		animation: fadeSlideIn 0.4s ease-out;
	}

	@keyframes fadeSlideIn {
		from { opacity: 0; transform: translateY(10px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.cat-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--font-size-sm);
	}

	.cat-table th {
		text-align: left;
		padding: var(--space-sm) var(--space-md);
		color: var(--color-text-secondary);
		font-weight: 600;
		border-bottom: 2px solid var(--color-border);
		background: var(--color-bg);
	}

	.cat-table th.actions-col {
		text-align: center;
		width: 90px;
	}

	.cat-table td {
		padding: var(--space-sm) var(--space-md);
		border-bottom: 1px solid var(--color-border);
		vertical-align: middle;
	}

	.cat-table tr:hover td {
		background: var(--color-primary-light);
	}

	.cat-icon-sm {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: var(--radius-md);
		font-size: 1rem;
		margin-right: var(--space-sm);
		vertical-align: middle;
	}

	.cat-name-cell {
		font-weight: 600;
		vertical-align: middle;
	}

	.type-badge-sm {
		display: inline-block;
		padding: 2px 8px;
		border-radius: 999px;
		font-size: var(--font-size-xs);
		font-weight: 600;
	}

	.type-badge-sm.income {
		background: rgba(16, 185, 129, 0.1);
		color: var(--color-income);
	}

	.type-badge-sm.expense {
		background: rgba(239, 68, 68, 0.1);
		color: var(--color-expense);
	}

	.amount-cell {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.actions-cell {
		text-align: center;
		white-space: nowrap;
	}

	.btn-action {
		background: none;
		border: none;
		cursor: pointer;
		padding: 6px;
		border-radius: var(--radius-sm);
		font-size: 1rem;
		min-width: 32px;
		min-height: 32px;
		transition: background var(--transition-fast);
	}

	.btn-action:hover {
		background: var(--color-bg);
	}

	/* Modal */
	.form-panel {
		max-width: 500px;
		margin-left: auto;
		margin-right: auto;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		padding: var(--space-lg);
		margin-bottom: var(--space-lg);
		box-shadow: var(--shadow-md);
		animation: slideIn 200ms ease-out;
	}

	@keyframes slideIn {
		from { opacity: 0; transform: translateY(-10px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.form-panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--space-md);
		padding-bottom: var(--space-md);
		border-bottom: 1px solid var(--color-border);
	}

	.form-panel-header h3 {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		margin: 0;
		font-size: var(--font-size-lg);
		font-weight: 600;
		color: var(--color-text);
	}

	.form-panel-header h3 svg {
		color: var(--color-primary);
	}

	.btn-close {
		background: none;
		border: none;
		cursor: pointer;
		padding: 8px;
		border-radius: var(--radius-md);
		color: var(--color-text-secondary);
		transition: all var(--transition-fast);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.btn-close:hover {
		background: var(--color-bg);
		color: var(--color-text);
	}

	.form-error {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		color: var(--color-expense);
		font-size: var(--font-size-sm);
		margin-bottom: var(--space-md);
		padding: var(--space-sm) var(--space-md);
		background: var(--color-expense-light);
		border-radius: var(--radius-md);
	}

	.modal-content {
		text-align: center;
	}

	.modal-icon {
		width: 64px;
		height: 64px;
		margin: 0 auto var(--space-md);
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, var(--color-expense-light) 0%, rgba(239, 68, 68, 0.1) 100%);
		color: var(--color-expense);
		border-radius: var(--radius-lg);
	}

	.modal-content p {
		margin: 0;
		color: var(--color-text);
	}

	.modal-content .warning {
		margin-top: var(--space-sm);
		color: var(--color-text-secondary);
		font-size: var(--font-size-sm);
	}

	.modal-actions {
		display: flex;
		gap: var(--space-sm);
		margin-top: var(--space-lg);
	}

	.btn-danger {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-xs);
		flex: 1;
		padding: var(--space-sm) var(--space-lg);
		background: var(--color-expense);
		color: white;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
		font-weight: 600;
		min-height: 44px;
		transition: all var(--transition-fast);
	}

	.btn-danger:hover {
		background: var(--color-danger-hover);
	}

	.btn-cancel {
		flex: 1;
		padding: var(--space-sm) var(--space-lg);
		background: var(--color-bg);
		color: var(--color-text);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		cursor: pointer;
		font-weight: 600;
		min-height: 44px;
		transition: all var(--transition-fast);
	}

	.btn-cancel:hover {
		background: var(--color-border);
	}
</style>

<script lang="ts">
	import { page } from '$app/stores';
	import { enhance } from '$app/forms';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import CategoryList from '$lib/components/CategoryList.svelte';
	import CategoryForm from '$lib/components/CategoryForm.svelte';
	import ModalDialog from '$lib/components/ModalDialog.svelte';
	import { showSuccess, showError } from '$lib/stores/toast.svelte';
	import type { Category } from '$lib/types';

	let data = $derived($page.data as App.PageData);

	let showForm = $state(false);
	let editingCategory = $state<Category | null>(null);
	let deleteId = $state<number | null>(null);

	let formError = $state('');

	function openAdd() {
		editingCategory = null;
		formError = '';
		showForm = true;
	}

	function openEdit(cat: Category) {
		editingCategory = cat;
		formError = '';
		showForm = true;
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

<PageHeader title="Categories">
	{#snippet action()}
		<button class="btn-primary-sm" onclick={openAdd}>+ Add Category</button>
	{/snippet}
</PageHeader>

{#if showForm}
	<div class="form-panel">
		<h3>{editingCategory ? 'Edit Category' : 'Add Category'}</h3>
		{#if formError}
			<p class="form-error">{formError}</p>
		{/if}
		<CategoryForm
			category={editingCategory ?? undefined}
			action={editingCategory ? '?/update' : '?/create'}
			onCancel={closeForm}
			onSuccess={closeForm}
		/>
	</div>
{/if}

<CategoryList
	categories={data.categories ?? []}
	spending={data.spending ?? {}}
	onEdit={openEdit}
	onDelete={(id) => deleteId = id}
/>

{#if deleteId !== null}
	<ModalDialog open={deleteId !== null} onclose={() => deleteId = null} title="Delete Category">
		<p>Are you sure you want to delete this category?</p>
		<p class="warning">Categories with transactions cannot be deleted.</p>
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
				<button type="submit" class="btn-danger">Delete</button>
				<button type="button" class="btn-cancel" onclick={() => deleteId = null}>Cancel</button>
			</div>
		</form>
	</ModalDialog>
{/if}

<style>
	.form-panel {
		max-width: 500px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--space-lg);
		margin-bottom: var(--space-lg);
		box-shadow: var(--shadow-sm);
	}

	.form-panel h3 {
		margin-bottom: var(--space-md);
		font-size: var(--font-size-lg);
	}

	.form-error {
		color: var(--color-expense);
		font-size: var(--font-size-sm);
		margin-bottom: var(--space-sm);
	}

	.btn-primary-sm {
		display: inline-block;
		padding: var(--space-sm) var(--space-md);
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: var(--radius-md);
		font-size: var(--font-size-sm);
		font-weight: 600;
		cursor: pointer;
	}

	.modal-actions {
		display: flex;
		gap: var(--space-sm);
		margin-top: var(--space-md);
	}

	.btn-danger {
		padding: var(--space-sm) var(--space-lg);
		background: var(--color-expense);
		color: white;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
		font-weight: 600;
	}

	.btn-cancel {
		padding: var(--space-sm) var(--space-lg);
		background: var(--color-bg);
		color: var(--color-text);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		cursor: pointer;
		font-weight: 600;
	}

	.warning {
		color: var(--color-text-secondary);
		font-size: var(--font-size-sm);
		margin-top: var(--space-xs);
	}
</style>

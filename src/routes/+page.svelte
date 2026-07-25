<script lang="ts">
	import { page } from '$app/stores';
	import SummaryCards from '$lib/components/SummaryCards.svelte';
	import TransactionList from '$lib/components/TransactionList.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import ModalDialog from '$lib/components/ModalDialog.svelte';
	import { enhance } from '$app/forms';
	import { showSuccess, showError } from '$lib/stores/toast.svelte';

	let deleteId = $state<number | null>(null);
	let data = $derived($page.data as App.PageData);
</script>

<svelte:head>
	<title>Dashboard — Budget Tracker</title>
</svelte:head>

<PageHeader title="Dashboard" />

<SummaryCards
	totalIncome={data.summary?.totalIncome ?? 0}
	totalExpenses={data.summary?.totalExpenses ?? 0}
	balance={data.summary?.balance ?? 0}
/>

{#if (data.recentTransactions?.length ?? 0) > 0}
	<section class="section">
		<div class="section-header">
			<h2 class="section-title">Recent Transactions</h2>
			<a href="/transactions" class="view-all">View all →</a>
		</div>
		<TransactionList
			transactions={data.recentTransactions ?? []}
			onDelete={(id) => deleteId = id}
		/>
	</section>
{:else}
	<section class="empty-section">
		<p>No transactions yet.</p>
		<a href="/transactions/new" class="btn-primary-link">Add your first transaction</a>
	</section>
{/if}

{#if deleteId !== null}
	<ModalDialog open={deleteId !== null} onclose={() => deleteId = null} title="Delete Transaction">
		<p>Are you sure you want to delete this transaction?</p>
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
	.section {
		margin-top: var(--space-lg);
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--space-md);
	}

	.section-title {
		font-size: var(--font-size-lg);
		color: var(--color-text);
	}

	.view-all {
		font-size: var(--font-size-sm);
		font-weight: 600;
	}

	.empty-section {
		text-align: center;
		padding: var(--space-2xl);
		color: var(--color-text-secondary);
	}

	.empty-section p {
		margin-bottom: var(--space-md);
	}

	.btn-primary-link {
		display: inline-block;
		padding: var(--space-sm) var(--space-lg);
		background: var(--color-primary);
		color: white;
		border-radius: var(--radius-md);
		font-weight: 600;
		text-decoration: none;
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

	.btn-danger:hover {
		background: var(--color-danger-hover);
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

	@media (max-width: 640px) {
		.section-header {
			flex-direction: column;
			align-items: flex-start;
			gap: var(--space-sm);
		}

		.btn-primary-link,
		.btn-danger,
		.btn-cancel {
			width: 100%;
			text-align: center;
		}

		.modal-actions {
			flex-direction: column;
		}
	}
</style>

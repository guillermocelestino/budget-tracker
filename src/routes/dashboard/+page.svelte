<script lang="ts">
	import { page } from '$app/stores';
	import SummaryCards from '$lib/components/SummaryCards.svelte';
	import TransactionList from '$lib/components/TransactionList.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import ModalDialog from '$lib/components/ModalDialog.svelte';
import PageBackground from '$lib/components/PageBackground.svelte';
	import { enhance } from '$app/forms';
	import { showSuccess, showError } from '$lib/stores/toast.svelte';

	let deleteId = $state<number | null>(null);
	let data = $derived($page.data as App.PageData);
</script>

<svelte:head>
	<title>Dashboard — Budget Tracker</title>
</svelte:head>

<PageHeader title="Dashboard">
	{#snippet subtitle()}
		<span class="header-subtitle">Track your financial overview</span>
	{/snippet}
</PageHeader>

<PageBackground />

<SummaryCards
	totalIncome={data.summary?.totalIncome ?? 0}
	totalExpenses={data.summary?.totalExpenses ?? 0}
	balance={data.summary?.balance ?? 0}
/>

{#if (data.recentTransactions?.length ?? 0) > 0}
	<section class="section">
		<div class="section-header">
			<div class="section-title-group">
				<div class="section-icon">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
					</svg>
				</div>
				<h2 class="section-title">Recent Transactions</h2>
			</div>
			<a href="/transactions" class="view-all">
				View all
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M5 12h14M12 5l7 7-7 7"/>
				</svg>
			</a>
		</div>
		<TransactionList
			transactions={data.recentTransactions ?? []}
			onDelete={(id) => deleteId = id}
			showActions={true}
		/>
	</section>
{:else}
	<section class="empty-section">
		<div class="empty-illustration">
			<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
				<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
				<polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
				<line x1="12" x2="12" y1="22.08" y2="12"/>
			</svg>
		</div>
		<h2>Start tracking your finances</h2>
		<p>Add your first transaction to begin monitoring your spending and income.</p>
		<a href="/transactions/new" class="btn-primary-link">
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
				<line x1="12" x2="12" y1="5" y2="19"/>
				<line x1="5" x2="19" y1="12" y2="12"/>
			</svg>
			Add your first transaction
		</a>
	</section>
{/if}

{#if deleteId !== null}
	<ModalDialog open={deleteId !== null} onclose={() => deleteId = null} title="Delete Transaction">
		<div class="modal-content">
			<div class="modal-icon">
				<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
					<line x1="12" x2="12" y1="9" y2="13"/>
					<line x1="12" x2="12.01" y1="17" y2="17"/>
				</svg>
			</div>
			<p>Are you sure you want to delete this transaction?</p>
			<p class="warning">This action cannot be undone.</p>
		</div>
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
	.header-subtitle {
		font-size: var(--font-size-sm);
		color: var(--color-text-secondary);
		font-weight: 400;
	}

	.section {
		margin-top: var(--space-lg);
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--space-md);
	}

	.section-title-group {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.section-icon {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, var(--color-primary-light) 0%, rgba(99, 102, 241, 0.1) 100%);
		color: var(--color-primary);
		border-radius: var(--radius-md);
	}

	.section-title {
		font-size: var(--font-size-lg);
		color: var(--color-text);
		font-weight: 600;
		margin: 0;
	}

	.view-all {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-primary);
		text-decoration: none;
		padding: 8px 12px;
		border-radius: var(--radius-md);
		transition: all var(--transition-fast);
	}

	.view-all:hover {
		background: var(--color-primary-light);
		text-decoration: none;
	}

	.view-all svg {
		transition: transform var(--transition-fast);
	}

	.view-all:hover svg {
		transform: translateX(3px);
	}

	.empty-section {
		text-align: center;
		padding: var(--space-2xl);
		color: var(--color-text-secondary);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-sm);
		max-width: 480px;
		margin-left: auto;
		margin-right: auto;
		margin-top: var(--space-lg);
	}

	.empty-illustration {
		width: 100px;
		height: 100px;
		margin: 0 auto var(--space-lg);
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, var(--color-primary-light) 0%, rgba(99, 102, 241, 0.1) 100%);
		color: var(--color-primary);
		border-radius: var(--radius-xl);
	}

	.empty-section h2 {
		font-size: var(--font-size-xl);
		color: var(--color-text);
		margin-bottom: var(--space-xs);
	}

	.empty-section p {
		margin-bottom: var(--space-lg);
		font-size: var(--font-size-base);
	}

	.btn-primary-link {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-xs);
		padding: var(--space-sm) var(--space-lg);
		background: var(--color-primary);
		color: white;
		border-radius: var(--radius-md);
		font-weight: 600;
		text-decoration: none;
		min-height: 48px;
		transition: all var(--transition-fast);
		box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
	}

	.btn-primary-link:hover {
		background: var(--color-primary-hover);
		transform: translateY(-2px);
		box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
		text-decoration: none;
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

	@media (max-width: 768px) {
		.section-header {
			flex-direction: column;
			align-items: flex-start;
			gap: var(--space-sm);
		}

		.view-all {
			align-self: flex-end;
		}

		.empty-section {
			margin: var(--space-lg) 0;
		}

		.btn-primary-link,
		.btn-danger,
		.btn-cancel {
			width: 100%;
		}

		.modal-actions {
			flex-direction: column;
		}
	}
</style>
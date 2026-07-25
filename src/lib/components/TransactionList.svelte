<script lang="ts">
	import { formatCurrency, formatDate } from '$lib/utils/format';
	import type { Transaction } from '$lib/types';

	let {
		transactions = [],
		onDelete,
		showActions = true,
	}: {
		transactions: Transaction[];
		onDelete?: (id: number) => void;
		showActions?: boolean;
	} = $props();

	let sortField = $state<'date' | 'amount'>('date');
	let sortOrder = $state<'asc' | 'desc'>('desc');

	const sorted = $derived(
		[...transactions].sort((a, b) => {
			const dir = sortOrder === 'asc' ? 1 : -1;
			if (sortField === 'amount') return (a.amount - b.amount) * dir;
			return a.date.localeCompare(b.date) * dir;
		})
	);

	function toggleSort(field: 'date' | 'amount') {
		if (sortField === field) {
			sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
		} else {
			sortField = field;
			sortOrder = 'desc';
		}
	}
</script>

<div class="txn-list">
	<div class="table-wrapper">
		<table class="transaction-table">
			<thead>
				<tr>
					<th class="sortable" onclick={() => toggleSort('date')}>
						Date {sortField === 'date' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
					</th>
					<th>Description</th>
					<th>Category</th>
					<th class="sortable" onclick={() => toggleSort('amount')}>
						Amount {sortField === 'amount' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
					</th>
					{#if showActions}
						<th class="actions-col">Actions</th>
					{/if}
				</tr>
			</thead>
			<tbody>
				{#if sorted.length === 0}
					<tr>
						<td colspan={showActions ? 5 : 4} class="empty-state">
							No transactions yet
						</td>
					</tr>
				{:else}
					{#each sorted as txn (txn.id)}
						<tr>
							<td class="date-cell">{formatDate(txn.date)}</td>
							<td class="desc-cell">{txn.description}</td>
							<td>
								<span class="category-badge" style="background: {txn.category_color || '#6366f1'}20; color: {txn.category_color || '#6366f1'}">
									{txn.category_name || 'Uncategorized'}
								</span>
							</td>
							<td class="amount-cell" class:income={txn.type === 'income'} class:expense={txn.type === 'expense'}>
								{txn.type === 'income' ? '+' : '-'}{formatCurrency(txn.amount)}
							</td>
							{#if showActions}
								<td class="actions-cell">
									<a href="/transactions/{txn.id}/edit" class="btn-action" title="Edit">✏️</a>
									<button class="btn-action" onclick={() => onDelete?.(txn.id)} title="Delete">🗑️</button>
								</td>
							{/if}
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>

	<div class="txn-cards">
		{#if sorted.length === 0}
			<div class="card-empty">No transactions yet</div>
		{:else}
			{#each sorted as txn (txn.id)}
				<div class="txn-card">
					<div class="card-row top">
						<span class="card-date">{formatDate(txn.date)}</span>
						<span class="card-amount" class:income={txn.type === 'income'} class:expense={txn.type === 'expense'}>
							{txn.type === 'income' ? '+' : '-'}{formatCurrency(txn.amount)}
						</span>
					</div>
					<div class="card-desc">{txn.description}</div>
					<div class="card-row bottom">
						<span class="category-badge" style="background: {txn.category_color || '#6366f1'}20; color: {txn.category_color || '#6366f1'}">
							{txn.category_name || 'Uncategorized'}
						</span>
						{#if showActions}
							<div class="card-actions">
								<a href="/transactions/{txn.id}/edit" class="btn-action" title="Edit">✏️</a>
								<button class="btn-action" onclick={() => onDelete?.(txn.id)} title="Delete">🗑️</button>
							</div>
						{/if}
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.txn-list {
		width: 100%;
	}

	.table-wrapper {
		overflow-x: auto;
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-border);
		box-shadow: var(--shadow-sm);
	}

	.transaction-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--font-size-sm);
	}

	th {
		text-align: left;
		padding: var(--space-sm) var(--space-md);
		color: var(--color-text-secondary);
		font-weight: 600;
		border-bottom: 2px solid var(--color-border);
		background: var(--color-bg);
		white-space: nowrap;
	}

	th.sortable {
		cursor: pointer;
		user-select: none;
	}

	th.sortable:hover {
		color: var(--color-primary);
	}

	td {
		padding: var(--space-sm) var(--space-md);
		border-bottom: 1px solid var(--color-border);
		vertical-align: middle;
	}

	tr:last-child td {
		border-bottom: none;
	}

	tr:hover td {
		background: var(--color-primary-light);
	}

	.date-cell {
		white-space: nowrap;
		color: var(--color-text-secondary);
	}

	.desc-cell {
		font-weight: 500;
		color: var(--color-text);
	}

	.category-badge {
		display: inline-block;
		padding: 3px 10px;
		border-radius: 999px;
		font-size: var(--font-size-sm);
		font-weight: 500;
	}

	.amount-cell {
		text-align: right;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.amount-cell.income {
		color: var(--color-income);
	}

	.amount-cell.expense {
		color: var(--color-expense);
	}

	.actions-col {
		width: 90px;
		text-align: center;
	}

	.actions-cell {
		text-align: center;
		white-space: nowrap;
	}

	.btn-action {
		background: none;
		border: none;
		cursor: pointer;
		padding: 10px 10px;
		border-radius: var(--radius-sm);
		font-size: 1.1rem;
		min-width: 44px;
		min-height: 44px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition: background var(--transition-fast);
		text-decoration: none;
	}

	.btn-action:hover {
		background: var(--color-bg);
	}

	.empty-state {
		text-align: center;
		color: var(--color-text-secondary);
		padding: var(--space-2xl) var(--space-md);
		font-style: italic;
	}

	.txn-cards {
		display: none;
	}

	.card-empty {
		text-align: center;
		color: var(--color-text-secondary);
		padding: var(--space-xl) var(--space-md);
		font-style: italic;
	}

	@media (max-width: 640px) {
		.transaction-table th:nth-child(2),
		.transaction-table td:nth-child(2) {
			display: none;
		}
	}

	@media (max-width: 480px) {
		.table-wrapper {
			display: none;
		}

		.txn-cards {
			display: flex;
			flex-direction: column;
			gap: var(--space-sm);
		}

		.txn-card {
			background: var(--color-surface);
			border: 1px solid var(--color-border);
			border-radius: var(--radius-lg);
			padding: var(--space-md);
			border-left: 4px solid var(--color-primary);
			box-shadow: var(--shadow-sm);
		}

		.txn-card.income {
			border-left-color: var(--color-income);
		}

		.txn-card.expense {
			border-left-color: var(--color-expense);
		}

		.card-row {
			display: flex;
			justify-content: space-between;
			align-items: center;
		}

		.card-row.top {
			margin-bottom: var(--space-xs);
		}

		.card-date {
			font-size: var(--font-size-sm);
			color: var(--color-text-secondary);
		}

		.card-amount {
			font-size: var(--font-size-lg);
			font-weight: 700;
		}

		.card-amount.income {
			color: var(--color-income);
		}

		.card-amount.expense {
			color: var(--color-expense);
		}

		.card-desc {
			font-size: var(--font-size-base);
			color: var(--color-text);
			margin-bottom: var(--space-sm);
			font-weight: 500;
		}

		.card-row.bottom {
			margin-top: var(--space-xs);
		}

		.card-actions {
			display: flex;
			gap: 2px;
		}

		.card-actions .btn-action {
			padding: 8px 10px;
		}
	}
</style>

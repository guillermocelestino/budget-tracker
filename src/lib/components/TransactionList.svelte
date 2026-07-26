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
					<th class="sortable" tabindex="0" role="columnheader" onclick={() => toggleSort('date')} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('date'); } }}>
						<span class="th-content">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
								<line x1="16" x2="16" y1="2" y2="6"/>
								<line x1="8" x2="8" y1="2" y2="6"/>
								<line x1="3" x2="21" y1="10" y2="10"/>
							</svg>
							Date
						</span>
						{#if sortField === 'date'}
							<span class="sort-indicator">{sortOrder === 'asc' ? '↑' : '↓'}</span>
						{/if}
					</th>
					<th>Description</th>
					<th>Category</th>
					<th class="sortable" tabindex="0" role="columnheader" onclick={() => toggleSort('amount')} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('amount'); } }}>
						<span class="th-content">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<line x1="12" x2="12" y1="2" y2="22"/>
								<path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
							</svg>
							Amount
						</span>
						{#if sortField === 'amount'}
							<span class="sort-indicator">{sortOrder === 'asc' ? '↑' : '↓'}</span>
						{/if}
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
							<div class="empty-content">
								<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
									<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
									<polyline points="14 2 14 8 20 8"/>
									<line x1="12" x2="12" y1="18" y2="12"/>
									<line x1="9" x2="15" y1="15" y2="15"/>
								</svg>
								<p>No transactions yet</p>
								<span>Add your first transaction to get started</span>
							</div>
						</td>
					</tr>
				{:else}
					{#each sorted as txn (txn.id)}
						<tr class:income={txn.type === 'income'} class:expense={txn.type === 'expense'}>
							<td class="date-cell">{formatDate(txn.date)}</td>
							<td class="desc-cell">{txn.description}</td>
							<td>
								<span class="category-badge" style="background: {txn.category_color || '#6366f1'}15; color: {txn.category_color || '#6366f1'}">
									{txn.category_name || 'Uncategorized'}
								</span>
							</td>
							<td class="amount-cell" class:income={txn.type === 'income'} class:expense={txn.type === 'expense'}>
								{txn.type === 'income' ? '+' : '-'}{formatCurrency(txn.amount)}
							</td>
							{#if showActions}
								<td class="actions-cell">
									<a href="/transactions/{txn.id}/edit" class="btn-action edit" aria-label="Edit transaction" title="Edit">
										<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
										</svg>
									</a>
									<button class="btn-action delete" onclick={() => onDelete?.(txn.id)} aria-label="Delete transaction" title="Delete">
										<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<polyline points="3 6 5 6 21 6"/>
											<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
											<line x1="10" x2="10" y1="11" y2="17"/>
											<line x1="14" x2="14" y1="11" y2="17"/>
										</svg>
									</button>
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
			<div class="card-empty">
				<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
					<polyline points="14 2 14 8 20 8"/>
					<line x1="12" x2="12" y1="18" y2="12"/>
					<line x1="9" x2="15" y1="15" y2="15"/>
				</svg>
				<p>No transactions yet</p>
				<span>Add your first transaction to get started</span>
			</div>
		{:else}
			{#each sorted as txn (txn.id)}
				<div class="txn-card" class:income={txn.type === 'income'} class:expense={txn.type === 'expense'}>
					<div class="card-accent"></div>
					<div class="card-content">
						<div class="card-row top">
							<span class="card-date">{formatDate(txn.date)}</span>
							<span class="card-amount" class:income={txn.type === 'income'} class:expense={txn.type === 'expense'}>
								{txn.type === 'income' ? '+' : '-'}{formatCurrency(txn.amount)}
							</span>
						</div>
						<div class="card-desc">{txn.description}</div>
						<div class="card-row bottom">
							<span class="category-badge" style="background: {txn.category_color || '#6366f1'}15; color: {txn.category_color || '#6366f1'}">
								{txn.category_name || 'Uncategorized'}
							</span>
							{#if showActions}
								<div class="card-actions">
									<a href="/transactions/{txn.id}/edit" class="btn-action-sm edit" aria-label="Edit">
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
										</svg>
									</a>
									<button class="btn-action-sm delete" onclick={() => onDelete?.(txn.id)} aria-label="Delete">
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<polyline points="3 6 5 6 21 6"/>
											<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
										</svg>
									</button>
								</div>
							{/if}
						</div>
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
		border-radius: var(--radius-xl);
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
		padding: var(--space-md) var(--space-md);
		color: var(--color-text-secondary);
		font-weight: 600;
		border-bottom: 2px solid var(--color-border);
		background: var(--color-bg);
		white-space: nowrap;
	}

	.th-content {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.sort-indicator {
		color: var(--color-primary);
		font-weight: 700;
	}

	th.sortable {
		cursor: pointer;
		user-select: none;
		transition: color var(--transition-fast);
	}

	th.sortable:hover,
	th.sortable:focus-visible {
		color: var(--color-primary);
		outline: none;
	}

	th.sortable:focus-visible {
		box-shadow: inset 0 0 0 2px var(--color-primary);
		border-radius: var(--radius-sm);
	}

	td {
		padding: var(--space-md);
		border-bottom: 1px solid var(--color-border);
		vertical-align: middle;
	}

	tr:last-child td {
		border-bottom: none;
	}

	tr:hover td {
		background: rgba(99, 102, 241, 0.04);
	}

	tr.income td:first-child {
		border-left: 3px solid var(--color-income);
	}

	tr.expense td:first-child {
		border-left: 3px solid var(--color-expense);
	}

	.date-cell {
		white-space: nowrap;
		color: var(--color-text-secondary);
		font-size: var(--font-size-sm);
	}

	.desc-cell {
		font-weight: 500;
		color: var(--color-text);
	}

	.category-badge {
		display: inline-block;
		padding: 4px 12px;
		border-radius: 999px;
		font-size: var(--font-size-sm);
		font-weight: 500;
	}

	.amount-cell {
		text-align: right;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		font-size: var(--font-size-base);
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
		padding: 8px;
		border-radius: var(--radius-md);
		min-width: 36px;
		min-height: 36px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition: all var(--transition-fast);
		color: var(--color-text-secondary);
	}

	.btn-action.edit:hover {
		background: rgba(99, 102, 241, 0.1);
		color: var(--color-primary);
	}

	.btn-action.delete:hover {
		background: rgba(239, 68, 68, 0.1);
		color: var(--color-expense);
	}

	.empty-state {
		text-align: center;
		padding: var(--space-2xl) var(--space-md);
	}

	.empty-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-sm);
		color: var(--color-text-secondary);
	}

	.empty-content p {
		font-weight: 600;
		color: var(--color-text);
		margin: var(--space-sm) 0 0;
	}

	.empty-content span {
		font-size: var(--font-size-sm);
	}

	/* Card View */
	.txn-cards {
		display: none;
	}

	.card-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		text-align: center;
		color: var(--color-text-secondary);
		padding: var(--space-2xl) var(--space-md);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
	}

	.card-empty p {
		font-weight: 600;
		color: var(--color-text);
		margin: var(--space-sm) 0 0;
	}

	.card-empty span {
		font-size: var(--font-size-sm);
	}

	.txn-card {
		position: relative;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		overflow: hidden;
		box-shadow: var(--shadow-sm);
		transition: all var(--transition-fast);
	}

	.txn-card:hover {
		transform: translateY(-2px);
		box-shadow: var(--shadow-md);
	}

	.card-accent {
		position: absolute;
		top: 0;
		left: 0;
		width: 4px;
		height: 100%;
	}

	.txn-card.income .card-accent {
		background: linear-gradient(180deg, var(--color-income) 0%, rgba(16, 185, 129, 0.5) 100%);
	}

	.txn-card.expense .card-accent {
		background: linear-gradient(180deg, var(--color-expense) 0%, rgba(239, 68, 68, 0.5) 100%);
	}

	.card-content {
		padding: var(--space-md) var(--space-md) var(--space-md) calc(var(--space-md) + 4px);
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
		gap: 4px;
	}

	.btn-action-sm {
		background: none;
		border: none;
		cursor: pointer;
		padding: 6px;
		border-radius: var(--radius-sm);
		min-width: 32px;
		min-height: 32px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition: all var(--transition-fast);
		color: var(--color-text-secondary);
	}

	.btn-action-sm.edit:hover {
		background: rgba(99, 102, 241, 0.1);
		color: var(--color-primary);
	}

	.btn-action-sm.delete:hover {
		background: rgba(239, 68, 68, 0.1);
		color: var(--color-expense);
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
	}
</style>
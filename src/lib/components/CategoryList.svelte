<script lang="ts">
	import { formatCurrency } from '$lib/utils/format';
	import type { Category } from '$lib/types';

	let {
		categories = [],
		spending = {} as Record<number, number>,
		onEdit,
		onDelete,
	}: {
		categories: Category[];
		spending?: Record<number, number>;
		onEdit?: (cat: Category) => void;
		onDelete?: (id: number) => void;
	} = $props();

	function budgetProgress(cat: Category): number {
		if (!cat.budget_limit) return 0;
		const spent = spending[cat.id] || 0;
		return Math.min(100, (spent / cat.budget_limit) * 100);
	}

	function budgetStatus(cat: Category): 'ok' | 'warning' | 'exceeded' {
		if (!cat.budget_limit) return 'ok';
		const spent = spending[cat.id] || 0;
		const pct = spent / cat.budget_limit;
		if (pct >= 1) return 'exceeded';
		if (pct >= 0.75) return 'warning';
		return 'ok';
	}
</script>

<div class="category-grid">
	{#each categories as cat (cat.id)}
		<div class="category-card">
			<div class="card-header">
				<span class="cat-icon" style="background: {cat.color}20">{cat.icon}</span>
				<div class="cat-info">
					<span class="cat-name">{cat.name}</span>
					<span class="cat-budget">
						{cat.budget_limit ? formatCurrency(cat.budget_limit) + ' budget' : 'No budget'}
					</span>
				</div>
				<div class="cat-actions">
					<button class="btn-icon" onclick={() => onEdit?.(cat)} title="Edit">✏️</button>
					<button class="btn-icon" onclick={() => onDelete?.(cat.id)} title="Delete">🗑️</button>
				</div>
			</div>
			{#if cat.budget_limit}
				<div class="budget-bar">
					<div
						class="budget-fill"
						class:ok={budgetStatus(cat) === 'ok'}
						class:warning={budgetStatus(cat) === 'warning'}
						class:exceeded={budgetStatus(cat) === 'exceeded'}
						style="width: {budgetProgress(cat)}%"
					></div>
				</div>
				<div class="budget-text">
					<span>{formatCurrency(spending[cat.id] || 0)} spent</span>
					<span class="budget-pct">{Math.round(budgetProgress(cat))}%</span>
				</div>
			{/if}
		</div>
	{/each}
</div>

{#if categories.length === 0}
	<p class="empty">No categories yet. Create one to get started!</p>
{/if}

<style>
	.category-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: var(--space-md);
	}

	.category-card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--space-md);
		box-shadow: var(--shadow-sm);
	}

	.card-header {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.cat-icon {
		font-size: 1.5rem;
		width: 44px;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-md);
	}

	.cat-info {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.cat-name {
		font-weight: 600;
		color: var(--color-text);
	}

	.cat-budget {
		font-size: var(--font-size-sm);
		color: var(--color-text-secondary);
	}

	.cat-actions {
		display: flex;
		gap: 2px;
	}

	.btn-icon {
		background: none;
		border: none;
		cursor: pointer;
		padding: 10px 12px;
		border-radius: var(--radius-sm);
		font-size: 1.1rem;
		min-width: 44px;
		min-height: 44px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition: background var(--transition-fast);
	}

	.btn-icon:hover {
		background: var(--color-bg);
	}

	.budget-bar {
		margin-top: var(--space-sm);
		height: 8px;
		background: var(--color-bg);
		border-radius: 999px;
		overflow: hidden;
	}

	.budget-fill {
		height: 100%;
		border-radius: 999px;
		transition: width var(--transition-normal);
	}

	.budget-fill.ok {
		background: var(--color-income);
	}

	.budget-fill.warning {
		background: #f59e0b;
	}

	.budget-fill.exceeded {
		background: var(--color-expense);
	}

	.budget-text {
		display: flex;
		justify-content: space-between;
		margin-top: 4px;
		font-size: var(--font-size-sm);
		color: var(--color-text-secondary);
	}

	.budget-pct {
		font-weight: 600;
	}

	.empty {
		text-align: center;
		color: var(--color-text-secondary);
		padding: var(--space-2xl);
	}
</style>

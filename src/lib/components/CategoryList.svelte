<script lang="ts">
	import { formatCurrency } from '$lib/utils/format';
	import type { Category } from '$lib/types';

	let {
		categories = [],
		spending = {} as Record<number, number>,
		income = {} as Record<number, number>,
		onEdit,
		onDelete,
	}: {
		categories: Category[];
		spending?: Record<number, number>;
		income?: Record<number, number>;
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
				<div class="cat-icon" style="background: {cat.color}15; color: {cat.color}">
					{cat.icon}
				</div>
				<div class="cat-info">
					<span class="cat-name">{cat.name}</span>
					<span class="type-badge" class:income={cat.type === 'income'} class:expense={cat.type === 'expense'}>{cat.type === 'income' ? '💰 Income' : '💸 Expense'}</span>
					<span class="cat-budget">
						{cat.budget_limit ? formatCurrency(cat.budget_limit) + ' budget' : 'No budget set'}
					</span>
				</div>
				<div class="cat-actions">
					<button class="btn-icon" onclick={() => onEdit?.(cat)} title="Edit category">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
						</svg>
					</button>
					<button class="btn-icon delete" onclick={() => onDelete?.(cat.id)} title="Delete category">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="3 6 5 6 21 6"/>
							<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
							<line x1="10" x2="10" y1="11" y2="17"/>
							<line x1="14" x2="14" y1="11" y2="17"/>
						</svg>
					</button>
				</div>
			</div>
			<div class="budget-section">
				<div class="budget-text">
					<span class="amount-display">
						<span class="amount-value earned">{formatCurrency(income[cat.id] || 0)}</span>
						<span class="amount-label">earned</span>
					</span>
					<span class="amount-display">
						<span class="amount-value spent">{formatCurrency(spending[cat.id] || 0)}</span>
						<span class="amount-label">spent</span>
					</span>
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
						<span></span>
						<span class="budget-pct" class:warning={budgetStatus(cat) === 'warning'} class:exceeded={budgetStatus(cat) === 'exceeded'}>
							{Math.round(budgetProgress(cat))}%
						</span>
					</div>
				{/if}
			</div>
		</div>
	{/each}
</div>

{#if categories.length === 0}
	<div class="empty-state">
		<div class="empty-icon">
			<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
				<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
				<line x1="7" x2="7.01" y1="7" y2="7"/>
			</svg>
		</div>
		<p>No categories yet</p>
		<span>Create your first category to organize transactions</span>
	</div>
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
		border-radius: var(--radius-xl);
		padding: var(--space-md);
		box-shadow: var(--shadow-sm);
		transition: transform 150ms ease, box-shadow 150ms ease;
	}

	.category-card:hover {
		transform: translateY(-2px);
		box-shadow: var(--shadow-md);
	}

	.card-header {
		display: flex;
		align-items: center;
		gap: var(--space-md);
	}

	.cat-icon {
		font-size: 1.5rem;
		width: 48px;
		height: 48px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-lg);
		flex-shrink: 0;
	}

	.cat-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.cat-name {
		font-weight: 600;
		color: var(--color-text);
		font-size: var(--font-size-base);
	}

	.cat-budget {
		font-size: var(--font-size-sm);
		color: var(--color-text-secondary);
	}

	.cat-actions {
		display: flex;
		gap: 4px;
	}

	.btn-icon {
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

	.btn-icon:hover {
		background: rgba(99, 102, 241, 0.1);
		color: var(--color-primary);
	}

	.btn-icon.delete:hover {
		background: rgba(239, 68, 68, 0.1);
		color: var(--color-expense);
	}

	.budget-section {
		margin-top: var(--space-md);
		padding-top: var(--space-md);
		border-top: 1px solid var(--color-border);
	}

	.budget-text {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.budget-text + .budget-text {
		margin-top: var(--space-xs);
	}

	.amount-display {
		display: flex;
		align-items: baseline;
		gap: 4px;
	}

	.amount-value {
		font-size: var(--font-size-base);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.amount-value.earned {
		color: var(--color-income);
	}

	.amount-value.spent {
		color: var(--color-expense);
	}

	.amount-label {
		font-size: var(--font-size-sm);
		color: var(--color-text-secondary);
	}

	.budget-bar {
		height: 8px;
		background: var(--color-bg);
		border-radius: 999px;
		overflow: hidden;
		margin-top: var(--space-sm);
	}

	.budget-fill {
		height: 100%;
		border-radius: 999px;
		transition: width 500ms cubic-bezier(0.4, 0, 0.2, 1), background-color 300ms ease;
	}

	.budget-fill.ok {
		background: linear-gradient(90deg, var(--color-income) 0%, #34d399 100%);
	}

	.budget-fill.warning {
		background: linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%);
	}

	.budget-fill.exceeded {
		background: linear-gradient(90deg, var(--color-expense) 0%, #f87171 100%);
	}

	.budget-pct {
		font-size: var(--font-size-sm);
		font-weight: 700;
		color: var(--color-income);
		padding: 2px 8px;
		background: rgba(16, 185, 129, 0.1);
		border-radius: 999px;
	}

	.budget-pct.warning {
		color: #f59e0b;
		background: rgba(245, 158, 11, 0.1);
	}

	.budget-pct.exceeded {
		color: var(--color-expense);
		background: rgba(239, 68, 68, 0.1);
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		text-align: center;
		padding: var(--space-2xl) var(--space-md);
		background: var(--color-surface);
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-xl);
	}

	.empty-icon {
		width: 80px;
		height: 80px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, var(--color-primary-light) 0%, rgba(99, 102, 241, 0.1) 100%);
		color: var(--color-primary);
		border-radius: var(--radius-lg);
		margin-bottom: var(--space-sm);
	}

	.empty-state p {
		font-weight: 600;
		color: var(--color-text);
		font-size: var(--font-size-lg);
		margin: 0;
	}

	.empty-state span {
		font-size: var(--font-size-sm);
		color: var(--color-text-secondary);
		max-width: 280px;
	}

	@media (max-width: 480px) {
		.category-grid {
			grid-template-columns: 1fr;
		}

		.cat-actions {
			flex-direction: column;
		}
	}
</style>

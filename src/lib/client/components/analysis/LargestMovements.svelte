<script lang="ts">
	import { formatCurrency } from '$lib/client/utils/format';
	import type { LargestMovementsData } from '$lib/server/services/analysis/analysisTypes';

	let { movements }: { movements: LargestMovementsData } = $props();
</script>

<div class="movements-card">
	<div class="card-header">
		<h3 class="card-title">Top Financial Activity</h3>
		<p class="card-subtitle">Key transactions and categories for the selected period</p>
	</div>

	<div class="movements-grid">
		<!-- Largest Outflows -->
		<div class="m-column">
			<h4 class="col-title">💸 Largest Outflows</h4>
			{#if movements.largestOutflows.length === 0}
				<p class="empty-text">No outflows recorded.</p>
			{:else}
				<div class="m-list">
					{#each movements.largestOutflows as tx (tx.id)}
						<div class="m-item">
							<div class="m-main">
								<span class="m-desc">{tx.description}</span>
								<span class="m-cat" style="color: {tx.categoryColor};">{tx.categoryName} • {tx.date}</span>
							</div>
							<span class="m-amt">{formatCurrency(tx.amount)}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Top Spending Categories -->
		<div class="m-column">
			<h4 class="col-title">📊 Top Spending Categories</h4>
			{#if movements.topCategories.length === 0}
				<p class="empty-text">No category spending recorded.</p>
			{:else}
				<div class="m-list">
					{#each movements.topCategories as cat (cat.id)}
						<div class="m-item">
							<div class="m-main">
								<span class="m-desc">{cat.name}</span>
								<span class="m-cat">{cat.percentage}% of Money Out</span>
							</div>
							<span class="m-amt">{formatCurrency(cat.amount)}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.movements-card {
		background: var(--color-surface, #ffffff);
		border: 1px solid var(--color-hairline, rgba(20, 48, 46, 0.08));
		border-radius: var(--radius-lg, 16px);
		padding: 20px;
		box-shadow: var(--shadow-card, 0 2px 8px rgba(0, 0, 0, 0.04));
		margin-bottom: 24px;
	}

	.card-header {
		margin-bottom: 16px;
	}

	.card-title {
		font-size: 1.125rem;
		font-weight: 800;
		color: var(--color-text-title, #14302e);
		margin: 0;
	}

	.card-subtitle {
		font-size: 0.8125rem;
		color: var(--color-text-subtitle, #5c7a78);
		margin: 2px 0 0 0;
	}

	.movements-grid {
		display: grid;
		grid-template-columns: repeat(1, 1fr);
		gap: 16px;
	}

	@media (min-width: 768px) {
		.movements-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	.m-column {
		background: rgba(20, 48, 46, 0.02);
		border: 1px solid var(--color-hairline, rgba(20, 48, 46, 0.06));
		border-radius: var(--radius-md, 12px);
		padding: 14px;
	}

	.col-title {
		font-size: 0.875rem;
		font-weight: 800;
		color: var(--color-text-title, #14302e);
		margin: 0 0 12px 0;
	}

	.empty-text {
		font-size: 0.775rem;
		color: var(--color-text-subtitle, #5c7a78);
		margin: 0;
	}

	.m-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.m-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--color-hairline, rgba(20, 48, 46, 0.05));
	}

	.m-item:last-child {
		border-bottom: none;
		padding-bottom: 0;
	}

	.m-main {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.m-desc {
		font-size: 0.8125rem;
		font-weight: 700;
		color: var(--color-text-title, #14302e);
	}

	.m-cat {
		font-size: 0.725rem;
		color: var(--color-text-subtitle, #5c7a78);
	}

	.m-amt {
		font-size: 0.875rem;
		font-weight: 800;
		color: var(--color-text-title, #14302e);
	}
</style>


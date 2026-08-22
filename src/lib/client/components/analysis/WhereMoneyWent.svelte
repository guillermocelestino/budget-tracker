<script lang="ts">
	import { formatCurrency } from '$lib/client/utils/format';
	import type { CategoryAnalysisItem } from '$lib/server/services/analysis/analysisTypes';

	let { categories = [] }: { categories: CategoryAnalysisItem[] } = $props();
</script>

<div class="where-money-went-card">
	<div class="card-header">
		<div>
			<h3 class="card-title">Where The Money Went</h3>
			<p class="card-subtitle">Category breakdown for selected timeframe</p>
		</div>
	</div>

	{#if categories.length === 0}
		<div class="empty-text">No category spending recorded for this timeframe.</div>
	{:else}
		<div class="category-list">
			{#each categories as cat (cat.id)}
				<div class="category-row">
					<div class="cat-icon-wrap" style="background-color: {cat.color}20; color: {cat.color};">
						<span>{cat.icon || '📁'}</span>
					</div>

					<div class="cat-info">
						<div class="cat-name-line">
							<span class="cat-name">{cat.name}</span>
							<span class="cat-amount">{formatCurrency(cat.amount)}</span>
						</div>

						<div class="cat-progress-bg">
							<div class="cat-progress-fill" style="width: {cat.percentage}%; background-color: {cat.color};"></div>
						</div>

						<div class="cat-meta-line">
							<span class="cat-meta">{cat.percentage}% of Money Out • {cat.txCount} tx{cat.txCount === 1 ? '' : 's'}</span>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.where-money-went-card {
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

	.empty-text {
		font-size: 0.875rem;
		color: var(--color-text-subtitle, #5c7a78);
		padding: 20px 0;
		text-align: center;
	}

	.category-list {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.category-row {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.cat-icon-wrap {
		width: 40px;
		height: 40px;
		border-radius: var(--radius-md, 12px);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.2rem;
		flex-shrink: 0;
	}

	.cat-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.cat-name-line {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.cat-name {
		font-size: 0.9375rem;
		font-weight: 700;
		color: var(--color-text-title, #14302e);
	}

	.cat-amount {
		font-size: 0.9375rem;
		font-weight: 800;
		color: var(--color-text-title, #14302e);
	}

	.cat-progress-bg {
		height: 6px;
		width: 100%;
		background: rgba(20, 48, 46, 0.06);
		border-radius: 9999px;
		overflow: hidden;
	}

	.cat-progress-fill {
		height: 100%;
		border-radius: 9999px;
		transition: width 0.3s ease;
	}

	.cat-meta-line {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 0.75rem;
	}

	.cat-meta {
		color: var(--color-text-subtitle, #5c7a78);
	}
</style>


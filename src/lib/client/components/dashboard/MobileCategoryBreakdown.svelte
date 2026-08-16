<script lang="ts">
	import { formatCurrency } from '$lib/client/utils/format';

	export interface CategoryItem {
		category_id: number;
		category_name: string;
		category_color: string | null;
		total: number;
	}

	let {
		categories = []
	}: {
		categories?: CategoryItem[];
	} = $props();

	const sortedCategories = $derived.by(() => {
		return [...categories].sort((a, b) => b.total - a.total);
	});

	const maxTotal = $derived.by(() => {
		if (sortedCategories.length === 0) return 1;
		return Math.max(...sortedCategories.map(c => c.total), 1);
	});

	function getCategoryEmoji(name: string): string {
		const lower = name.toLowerCase();
		if (lower.includes('food') || lower.includes('dining') || lower.includes('grocer')) return '🍔';
		if (lower.includes('shop') || lower.includes('store') || lower.includes('clot')) return '🛍️';
		if (lower.includes('bill') || lower.includes('rent') || lower.includes('util') || lower.includes('elect')) return '🏠';
		if (lower.includes('trans') || lower.includes('gas') || lower.includes('ride') || lower.includes('car')) return '🚗';
		if (lower.includes('enter') || lower.includes('game') || lower.includes('movie') || lower.includes('netf')) return '🎬';
		if (lower.includes('health') || lower.includes('med') || lower.includes('doctor')) return '💊';
		if (lower.includes('tech') || lower.includes('sub') || lower.includes('soft')) return '💻';
		return '💸';
	}
</script>

<div class="category-breakdown-card">
	<div class="card-header">
		<span class="card-tag">WHERE DID IT GO?</span>
	</div>

	{#if sortedCategories.length > 0}
		<div class="category-list">
			{#each sortedCategories as cat (cat.category_id)}
				{@const pct = Math.min(100, Math.round((cat.total / maxTotal) * 100))}
				<div class="category-row">
					<div class="category-info-row">
						<div class="category-label-group">
							<span class="cat-emoji">{getCategoryEmoji(cat.category_name)}</span>
							<span class="cat-name">{cat.category_name}</span>
						</div>
						<span class="cat-amount">{formatCurrency(cat.total)}</span>
					</div>

					<div class="bar-track">
						<div
							class="bar-fill"
							style:width="{pct}%"
							style:background={cat.category_color || 'var(--color-coral, #EF6C4A)'}
						></div>
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="empty-state">
			<span class="empty-icon">🍃</span>
			<span class="empty-text">No category expenses logged for this month.</span>
		</div>
	{/if}
</div>

<style>
	.category-breakdown-card {
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-2xl, 20px);
		padding: 16px 18px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		box-shadow: var(--shadow-sm);
	}

	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.card-tag {
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-text-muted);
	}

	.category-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.category-row {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.category-info-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.category-label-group {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.cat-emoji {
		font-size: 15px;
	}

	.cat-name {
		font-size: 13px;
		font-weight: 600;
		color: var(--color-ink);
	}

	.cat-amount {
		font-family: var(--font-display);
		font-size: 13px;
		font-weight: 800;
		color: var(--color-ink);
	}

	.bar-track {
		height: 6px;
		background: var(--color-hairline);
		border-radius: var(--radius-pill, 999px);
		overflow: hidden;
	}

	.bar-fill {
		height: 100%;
		border-radius: var(--radius-pill, 999px);
		transition: width 300ms ease;
	}

	.empty-state {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 0;
	}

	.empty-icon {
		font-size: 16px;
	}

	.empty-text {
		font-size: 12px;
		font-weight: 600;
		color: var(--color-text-muted);
	}
</style>

<script lang="ts">
	import { formatCurrency } from '$lib/client/utils/format';
	import { getMonthLabel, getCurrentMonth } from '$lib/shared/utils/format';

	export interface CategoryItem {
		category_id: number;
		category_name: string;
		category_color: string | null;
		total: number;
	}

	let {
		categoryExpenses = [],
		monthStr = ''
	}: {
		categoryExpenses?: CategoryItem[];
		monthStr?: string;
	} = $props();

	const activeMonth = $derived(monthStr || getCurrentMonth());
	const calendarMonth = getCurrentMonth();
	const isThisMonth = $derived(activeMonth === calendarMonth);

	const rightTag = $derived(
		isThisMonth ? 'this month' : getMonthLabel(activeMonth).toLowerCase()
	);

	const sortedCategories = $derived.by(() => {
		return [...categoryExpenses]
			.filter(c => c.total > 0)
			.sort((a, b) => b.total - a.total);
	});

	const maxCategoryTotal = $derived.by(() => {
		if (sortedCategories.length === 0) return 1;
		return Math.max(...sortedCategories.map(c => c.total), 1);
	});

	function getCategoryEmoji(name: string): string {
		const lower = name.toLowerCase();
		if (lower.includes('food') || lower.includes('dining') || lower.includes('grocer') || lower.includes('snack') || lower.includes('eat')) return '🍔';
		if (lower.includes('shop') || lower.includes('store') || lower.includes('clot') || lower.includes('buy') || lower.includes('retail')) return '🛒';
		if (lower.includes('bill') || lower.includes('rent') || lower.includes('util') || lower.includes('elect') || lower.includes('water') || lower.includes('power')) return '🏠';
		if (lower.includes('fun') || lower.includes('enter') || lower.includes('game') || lower.includes('movie') || lower.includes('play') || lower.includes('party')) return '🎉';
		if (lower.includes('sub') || lower.includes('tech') || lower.includes('soft') || lower.includes('app') || lower.includes('cloud')) return '🔄';
		if (lower.includes('trans') || lower.includes('gas') || lower.includes('ride') || lower.includes('car') || lower.includes('commute') || lower.includes('fuel')) return '🚗';
		if (lower.includes('health') || lower.includes('med') || lower.includes('doctor') || lower.includes('fit') || lower.includes('gym')) return '💊';
		return '💸';
	}
</script>

<div class="where-it-went-card">
	<div class="card-header">
		<h2 class="card-title">↗ WHERE IT WENT</h2>
		<span class="card-month-tag" class:is-this-month={isThisMonth}>
			{rightTag}
		</span>
	</div>

	{#if sortedCategories.length > 0}
		<div class="category-list">
			{#each sortedCategories as cat (cat.category_id)}
				{@const pct = Math.min(100, Math.round((cat.total / maxCategoryTotal) * 100))}
				{@const color = cat.category_color || 'var(--color-money-gone, #EF6C4A)'}
				<div class="category-row">
					<div class="category-info-row">
						<div class="category-label-group">
							<span class="cat-emoji" aria-hidden="true">{getCategoryEmoji(cat.category_name)}</span>
							<span class="cat-name">{cat.category_name}</span>
						</div>
						<span class="cat-amount">{formatCurrency(cat.total)}</span>
					</div>

					<div class="bar-track">
						<div
							class="bar-fill"
							style:width="{pct}%"
							style:background={color}
							style:box-shadow="0 0 8px {color}44"
						></div>
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="empty-state">
			<span class="empty-icon" aria-hidden="true">🌱</span>
			<div class="empty-text-wrap">
				<span class="empty-title">Nothing spent yet</span>
				<span class="empty-sub">No category expenses recorded for this period.</span>
			</div>
		</div>
	{/if}
</div>

<style>
	.where-it-went-card {
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-2xl, 20px);
		padding: 16px 20px;
		display: flex;
		flex-direction: column;
		gap: 14px;
		box-shadow: var(--shadow-sm);
	}

	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.card-title {
		font-family: var(--font-display);
		font-size: 13px;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-ink);
		margin: 0;
	}

	.card-month-tag {
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
		text-transform: lowercase;
	}

	.card-month-tag.is-this-month {
		color: var(--color-teal, #2BA8A2);
	}

	.category-list {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.category-row {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.category-info-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.category-label-group {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}

	.cat-emoji {
		font-size: 15px;
		line-height: 1;
		flex-shrink: 0;
	}

	.cat-name {
		font-size: 13px;
		font-weight: 700;
		color: var(--color-ink);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.cat-amount {
		font-family: var(--font-mono);
		font-size: 13px;
		font-weight: 800;
		color: var(--color-ink);
		white-space: nowrap;
	}

	.bar-track {
		height: 8px;
		background: var(--color-surface-inset, rgba(0, 0, 0, 0.05));
		border-radius: var(--radius-pill, 999px);
		overflow: hidden;
	}

	.bar-fill {
		height: 100%;
		border-radius: var(--radius-pill, 999px);
		transition: width 350ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	/* ─── Empty State ─── */
	.empty-state {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		background: var(--color-surface-inset, rgba(0, 0, 0, 0.03));
		border-radius: var(--radius-xl, 14px);
		border: 1px dashed var(--color-hairline);
	}

	.empty-icon {
		font-size: 22px;
	}

	.empty-text-wrap {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.empty-title {
		font-family: var(--font-display);
		font-size: 13px;
		font-weight: 800;
		color: var(--color-ink);
	}

	.empty-sub {
		font-size: 11px;
		font-weight: 500;
		color: var(--color-text-muted);
	}
</style>

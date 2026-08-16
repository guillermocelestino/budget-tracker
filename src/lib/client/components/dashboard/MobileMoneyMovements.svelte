<script lang="ts">
	import { formatCurrency } from '$lib/client/utils/format';
	import { formatDateShort, formatDateInput, getToday, parseDate } from '$lib/shared/utils/format';
	import type { Transaction } from '$lib/types';

	let {
		transactions = []
	}: {
		transactions?: Transaction[];
	} = $props();

	const count = $derived(transactions.length);

	function getMovementEmoji(item: Transaction): string {
		const name = `${item.category_name || ''} ${item.description || ''}`.toLowerCase();
		if (name.includes('sub') || name.includes('netf') || name.includes('spoti') || name.includes('recur') || name.includes('cloud')) return '🔄';
		if (name.includes('food') || name.includes('dining') || name.includes('grocer') || name.includes('snack') || name.includes('eat') || name.includes('coffee')) return '🍔';
		if (name.includes('shop') || name.includes('store') || name.includes('clot') || name.includes('buy') || name.includes('retail') || name.includes('mall')) return '🛒';
		if (name.includes('bill') || name.includes('rent') || name.includes('util') || name.includes('elect') || name.includes('water') || name.includes('power')) return '🏠';
		if (name.includes('trans') || name.includes('gas') || name.includes('ride') || name.includes('car') || name.includes('fuel') || name.includes('taxi')) return '🚗';
		if (name.includes('lend') || name.includes('loan') || name.includes('borrow') || name.includes('repay')) return '🤝';
		if (name.includes('health') || name.includes('med') || name.includes('doctor') || name.includes('fit') || name.includes('gym')) return '💊';
		if (name.includes('fun') || name.includes('enter') || name.includes('game') || name.includes('movie') || name.includes('play')) return '🎬';
		return item.type === 'expense' ? '💸' : '💰';
	}

	function getRelativeDateLabel(dateVal: string | Date): string {
		const today = getToday();
		const dStr = typeof dateVal === 'string' ? dateVal.split('T')[0] : formatDateInput(dateVal);
		if (dStr === today) return 'Today';

		const now = new Date();
		const yesterdayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
		const yesterdayStr = formatDateInput(yesterdayDate);
		if (dStr === yesterdayStr) return 'Yesterday';

		try {
			const target = parseDate(dateVal);
			const diffMs = now.getTime() - target.getTime();
			const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
			if (diffDays > 1 && diffDays <= 7) {
				return `${diffDays} days ago`;
			}
		} catch {
			// fallback to standard short date
		}

		return formatDateShort(dateVal);
	}
</script>

<div class="movements-section">
	<div class="movements-header">
		<h2 class="movements-title">LATEST MONEY OUT</h2>
		<a href="/transactions" class="movements-count-link" aria-label="See all movements">
			{count} total ›
		</a>
	</div>

	<div class="activity-table-card">
		{#if transactions.length === 0}
			<div class="empty-movements">
				<span>No money movements recorded yet.</span>
			</div>
		{:else}
			<div class="activity-table">
				{#each transactions as item (item.id)}
					{@const relDate = getRelativeDateLabel(item.date)}
					{@const catName = item.category_name || 'Uncategorized'}
					{@const hasDesc = Boolean(item.description && item.description.trim())}
					{@const hasDiffDesc = hasDesc && item.description.trim().toLowerCase() !== catName.toLowerCase()}
					{@const primaryTitle = hasDesc ? item.description.trim() : catName}
					{@const secondaryMeta = hasDiffDesc ? `${catName} · ${relDate}` : relDate}
					{@const catColor = item.category_color || 'var(--color-money-gone, #EF6C4A)'}

					<div class="activity-row">
						<!-- Column 1: Icon Tile -->
						<div
							class="icon-tile"
							style="--tile-color: {catColor};"
						>
							<span class="icon-emoji" aria-hidden="true">{getMovementEmoji(item)}</span>
						</div>

						<!-- Column 2: Description & Subtitle -->
						<div class="row-details">
							<span class="movement-desc">{primaryTitle}</span>
							<span class="row-subtitle">{secondaryMeta}</span>
						</div>

						<!-- Column 3: Amount -->
						<div class="row-amount-wrap">
							<span class="row-amount" class:expense={item.type === 'expense'}>
								{item.type === 'expense' ? '−' : '+'}{formatCurrency(item.amount)}
							</span>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.movements-section {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.movements-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 4px;
	}

	.movements-title {
		font-family: var(--font-display);
		font-size: 13px;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-ink);
		margin: 0;
	}

	.movements-count-link {
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.04em;
		color: var(--color-teal, #2BA8A2);
		text-decoration: none;
		transition: opacity 120ms ease;
	}

	.movements-count-link:hover {
		opacity: 0.85;
	}

	/* ─── Activity Table Card ─── */
	.activity-table-card {
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-2xl, 20px);
		box-shadow: var(--shadow-sm);
		overflow: hidden;
	}

	.activity-table {
		display: flex;
		flex-direction: column;
	}

	.activity-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		border-bottom: 1px solid var(--color-hairline);
		transition: background 140ms ease;
	}

	.activity-row:last-child {
		border-bottom: none;
	}

	.activity-row:active {
		background: var(--color-surface-inset, rgba(0, 0, 0, 0.03));
	}

	/* ─── Column 1: Icon Tile ─── */
	.icon-tile {
		width: 38px;
		height: 38px;
		border-radius: 12px;
		background: color-mix(in srgb, var(--tile-color) 16%, transparent);
		border: 1px solid color-mix(in srgb, var(--tile-color) 25%, transparent);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.icon-emoji {
		font-size: 17px;
		line-height: 1;
	}

	/* ─── Column 2: Details ─── */
	.row-details {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
		min-width: 0;
	}

	.movement-desc {
		font-size: 13px;
		font-weight: 700;
		color: var(--color-ink);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.row-subtitle {
		font-size: 11px;
		font-weight: 500;
		color: var(--color-text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* ─── Column 3: Amount ─── */
	.row-amount-wrap {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		flex-shrink: 0;
	}

	.row-amount {
		font-family: var(--font-mono);
		font-size: 13px;
		font-weight: 800;
		color: var(--color-teal, #2BA8A2);
		white-space: nowrap;
	}

	.row-amount.expense {
		color: var(--color-money-gone, #EF6C4A);
	}

	/* ─── Empty State ─── */
	.empty-movements {
		padding: 20px 16px;
		text-align: center;
		font-size: 12px;
		font-weight: 600;
		color: var(--color-text-muted);
	}
</style>

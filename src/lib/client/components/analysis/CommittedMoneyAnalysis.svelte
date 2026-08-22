<script lang="ts">
	import { formatCurrency } from '$lib/client/utils/format';
	import type { CommittedMoneyData } from '$lib/server/services/analysis/analysisTypes';

	let { committed }: { committed: CommittedMoneyData } = $props();
</script>

<div class="committed-card">
	<div class="card-header">
		<div>
			<h3 class="card-title">Committed Money</h3>
			<p class="card-subtitle">How much of your money is already spoken for?</p>
		</div>
		<span class="pct-badge">{committed.committedPctOfMoneyOut}% of Money Out</span>
	</div>

	<div class="committed-grid">
		<!-- Recurring Monthly -->
		<div class="c-tile">
			<span class="c-label">Monthly Recurring</span>
			<span class="c-val">{formatCurrency(committed.recurringTotal)}</span>
			<span class="c-sub">active recurring subscriptions & bills</span>
		</div>

		<!-- Upcoming (30 Days) -->
		<div class="c-tile">
			<span class="c-label">Upcoming (30 Days)</span>
			<span class="c-val">{formatCurrency(committed.upcomingRecurringTotal)}</span>
			<span class="c-sub">due in the next 30 days</span>
		</div>

		<!-- Debt Owed -->
		<div class="c-tile">
			<span class="c-label">Borrowed / Debt Owed</span>
			<span class="c-val">{formatCurrency(committed.borrowedCommittedTotal)}</span>
			<span class="c-sub">active borrowed debt balance</span>
		</div>
	</div>

	{#if committed.recurringCategories.length > 0}
		<div class="rec-cats-box">
			<h4 class="box-title">Recurring Categories</h4>
			<div class="rec-chips">
				{#each committed.recurringCategories as cat (cat.name)}
					<div class="rec-chip">
						<span class="rec-name">{cat.name}</span>
						<span class="rec-amt">{formatCurrency(cat.amount)}/mo</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.committed-card {
		background: var(--color-surface, #ffffff);
		border: 1px solid var(--color-hairline, rgba(20, 48, 46, 0.08));
		border-radius: var(--radius-lg, 16px);
		padding: 20px;
		box-shadow: var(--shadow-card, 0 2px 8px rgba(0, 0, 0, 0.04));
		margin-bottom: 24px;
	}

	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
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

	.pct-badge {
		font-size: 0.75rem;
		font-weight: 700;
		background: rgba(245, 158, 11, 0.12);
		color: #d97706;
		padding: 4px 10px;
		border-radius: var(--radius-pill, 9999px);
	}

	.committed-grid {
		display: grid;
		grid-template-columns: repeat(1, 1fr);
		gap: 12px;
		margin-bottom: 16px;
	}

	@media (min-width: 640px) {
		.committed-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	.c-tile {
		background: rgba(20, 48, 46, 0.02);
		border: 1px solid var(--color-hairline, rgba(20, 48, 46, 0.06));
		border-radius: var(--radius-md, 12px);
		padding: 12px 14px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.c-label {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--color-text-subtitle, #5c7a78);
		text-transform: uppercase;
	}

	.c-val {
		font-size: 1.25rem;
		font-weight: 800;
		color: var(--color-text-title, #14302e);
	}

	.c-sub {
		font-size: 0.75rem;
		color: var(--color-text-subtitle, #5c7a78);
	}

	.rec-cats-box {
		background: rgba(20, 48, 46, 0.02);
		border-radius: var(--radius-md, 12px);
		padding: 12px 14px;
	}

	.box-title {
		font-size: 0.8125rem;
		font-weight: 700;
		color: var(--color-text-title, #14302e);
		margin: 0 0 8px 0;
	}

	.rec-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.rec-chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		background: #ffffff;
		border: 1px solid var(--color-hairline, rgba(20, 48, 46, 0.08));
		border-radius: var(--radius-pill, 9999px);
		font-size: 0.75rem;
	}

	.rec-name { font-weight: 600; color: var(--color-text-title, #14302e); }
	.rec-amt { font-weight: 700; color: var(--color-text-subtitle, #5c7a78); }
</style>

<script lang="ts">
	import { formatCurrency } from '$lib/client/utils/format';
	import type { SpendingBehaviorData } from '$lib/server/services/analysis/analysisTypes';

	let { behavior }: { behavior: SpendingBehaviorData } = $props();
</script>

<div class="behavior-card">
	<div class="card-header">
		<h3 class="card-title">Spending Behavior & Habits</h3>
		<p class="card-subtitle">Behavioral patterns derived from your financial activity</p>
	</div>

	<div class="behavior-grid">
		<!-- Avg Transaction Size -->
		<div class="b-tile">
			<span class="b-label">Avg Transaction Size</span>
			<span class="b-val">{formatCurrency(behavior.avgTxSize)}</span>
			<span class="b-sub">per outflow transaction</span>
		</div>

		<!-- Transaction Frequency -->
		<div class="b-tile">
			<span class="b-label">Transaction Frequency</span>
			<span class="b-val">{behavior.txFrequencyPerDay} / day</span>
			<span class="b-sub">average transactions</span>
		</div>

		<!-- Most Active Spending Day -->
		<div class="b-tile">
			<span class="b-label">Most Active Day</span>
			<span class="b-val">{behavior.mostActiveDayOfWeek || 'N/A'}</span>
			<span class="b-sub">highest transaction volume</span>
		</div>

		<!-- Highest Spending Weekday -->
		<div class="b-tile">
			<span class="b-label">Peak Spending Weekday</span>
			<span class="b-val">{behavior.highestSpendingWeekday || 'N/A'}</span>
			<span class="b-sub">highest average amount</span>
		</div>
	</div>
</div>

<style>
	.behavior-card {
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

	.behavior-grid {
		display: grid;
		grid-template-columns: repeat(1, 1fr);
		gap: 12px;
	}

	@media (min-width: 640px) {
		.behavior-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (min-width: 1024px) {
		.behavior-grid {
			grid-template-columns: repeat(4, 1fr);
		}
	}

	.b-tile {
		background: rgba(20, 48, 46, 0.02);
		border: 1px solid var(--color-hairline, rgba(20, 48, 46, 0.06));
		border-radius: var(--radius-md, 12px);
		padding: 12px 14px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.b-label {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--color-text-subtitle, #5c7a78);
		text-transform: uppercase;
	}

	.b-val {
		font-size: 1.25rem;
		font-weight: 800;
		color: var(--color-text-title, #14302e);
	}

	.b-sub {
		font-size: 0.75rem;
		color: var(--color-text-subtitle, #5c7a78);
	}
</style>


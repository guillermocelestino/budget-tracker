<script lang="ts">
	import { formatCurrency } from '$lib/client/utils/format';
	import type { MoneySnapshotData } from '$lib/server/services/analysis/analysisTypes';

	let { snapshot }: { snapshot: MoneySnapshotData } = $props();
</script>

<section class="money-snapshot-section" aria-label="Money Snapshot">
	<div class="snapshot-grid">
		<!-- Money Out Tile -->
		<div class="snapshot-card card-out">
			<div class="card-header">
				<span class="card-label">Money Out</span>
				<span class="card-icon">🔥</span>
			</div>
			<div class="card-value">{formatCurrency(snapshot.moneyOut)}</div>
			<div class="card-footer">
				<span class="subtext">{snapshot.transactionCount} transactions</span>
			</div>
		</div>

		<!-- Money In Tile -->
		<div class="snapshot-card card-in">
			<div class="card-header">
				<span class="card-label">Money In</span>
				<span class="card-icon">💰</span>
			</div>
			<div class="card-value">{formatCurrency(snapshot.moneyIn)}</div>
			<div class="card-footer">
				<span class="subtext">Income & returning</span>
			</div>
		</div>

		<!-- Net Cash Flow Tile -->
		<div class="snapshot-card card-net">
			<div class="card-header">
				<span class="card-label">Net Cash Flow</span>
				<span class="card-icon">⚖️</span>
			</div>
			<div
				class="card-value"
				class:net-positive={snapshot.netCashFlow >= 0}
				class:net-negative={snapshot.netCashFlow < 0}
			>
				{snapshot.netCashFlow >= 0 ? '+' : ''}{formatCurrency(snapshot.netCashFlow)}
			</div>
			<div class="card-footer">
				<span class="subtext">Money In − Money Out</span>
			</div>
		</div>

		<!-- Avg Daily Drain Tile -->
		<div class="snapshot-card card-drain">
			<div class="card-header">
				<span class="card-label">Avg Daily Drain</span>
				<span class="card-icon">⚡</span>
			</div>
			<div class="card-value">{formatCurrency(snapshot.avgDailyDrain)}<span class="per-day">/day</span></div>
			<div class="card-footer">
				<span class="subtext">Average daily outflow</span>
			</div>
		</div>
	</div>
</section>

<style>
	.money-snapshot-section {
		margin-bottom: 24px;
	}

	.snapshot-grid {
		display: grid;
		grid-template-columns: repeat(1, 1fr);
		gap: 14px;
	}

	@media (min-width: 640px) {
		.snapshot-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (min-width: 1024px) {
		.snapshot-grid {
			grid-template-columns: repeat(4, 1fr);
		}
	}

	.snapshot-card {
		background: var(--color-surface, #ffffff);
		border: 1px solid var(--color-hairline, rgba(20, 48, 46, 0.08));
		border-radius: var(--radius-lg, 16px);
		padding: 16px 20px;
		box-shadow: var(--shadow-card, 0 2px 8px rgba(0, 0, 0, 0.04));
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 8px;
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	.snapshot-card:hover {
		transform: translateY(-2px);
		box-shadow: var(--shadow-hover, 0 4px 14px rgba(0, 0, 0, 0.08));
	}

	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.card-label {
		font-size: 0.8125rem;
		font-weight: 700;
		color: var(--color-text-subtitle, #5c7a78);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.card-icon {
		font-size: 1.1rem;
	}

	.card-value {
		font-size: 1.625rem;
		font-weight: 800;
		color: var(--color-text-title, #14302e);
		line-height: 1.1;
		font-feature-settings: 'tnum';
	}

	.per-day {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text-subtitle, #5c7a78);
		margin-left: 4px;
	}

	.net-positive {
		color: var(--color-teal-base, #2ba8a2);
	}

	.net-negative {
		color: var(--color-coral-base, #ef6c4a);
	}

	.card-footer {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.775rem;
	}

	.subtext {
		color: var(--color-text-subtitle, #5c7a78);
	}
</style>


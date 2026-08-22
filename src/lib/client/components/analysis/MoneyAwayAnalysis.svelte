<script lang="ts">
	import { formatCurrency } from '$lib/client/utils/format';
	import type { MoneyAwayData } from '$lib/server/services/analysis/analysisTypes';

	let { lending }: { lending: MoneyAwayData } = $props();
</script>

<div class="money-away-card">
	<div class="card-header">
		<div>
			<h3 class="card-title">Money Away (Lending)</h3>
			<p class="card-subtitle">How much of your money is currently away from you?</p>
		</div>
		<span class="lending-badge">{lending.repaymentRate}% Recovered</span>
	</div>

	<div class="away-grid">
		<!-- Lent -->
		<div class="a-tile">
			<span class="a-label">Lent (Selected Period)</span>
			<span class="a-val">{formatCurrency(lending.lent)}</span>
			<span class="a-sub">new loans extended</span>
		</div>

		<!-- Returned -->
		<div class="a-tile">
			<span class="a-label">Returned (Selected Period)</span>
			<span class="a-val text-recovered">{formatCurrency(lending.returned)}</span>
			<span class="a-sub">repayments received</span>
		</div>

		<!-- Outstanding -->
		<div class="a-tile tile-outstanding">
			<span class="a-label">Outstanding Balance</span>
			<span class="a-val text-away">{formatCurrency(lending.outstanding)}</span>
			<span class="a-sub">{lending.activeLendingCount} active loan{lending.activeLendingCount === 1 ? '' : 's'}</span>
		</div>
	</div>

	{#if lending.largestOutstanding}
		<div class="largest-loan-box">
			<span class="box-icon">👤</span>
			<div class="box-text">
				<span class="box-title">Largest Outstanding Loan: <strong>{lending.largestOutstanding.borrowerName}</strong></span>
				<span class="box-sub">{formatCurrency(lending.largestOutstanding.amount)} remaining away</span>
			</div>
		</div>
	{/if}
</div>

<style>
	.money-away-card {
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

	.lending-badge {
		font-size: 0.75rem;
		font-weight: 700;
		background: rgba(56, 189, 248, 0.12);
		color: #0284c7;
		padding: 4px 10px;
		border-radius: var(--radius-pill, 9999px);
	}

	.away-grid {
		display: grid;
		grid-template-columns: repeat(1, 1fr);
		gap: 12px;
		margin-bottom: 14px;
	}

	@media (min-width: 640px) {
		.away-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	.a-tile {
		background: rgba(20, 48, 46, 0.02);
		border: 1px solid var(--color-hairline, rgba(20, 48, 46, 0.06));
		border-radius: var(--radius-md, 12px);
		padding: 12px 14px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.a-label {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--color-text-subtitle, #5c7a78);
		text-transform: uppercase;
	}

	.a-val {
		font-size: 1.25rem;
		font-weight: 800;
		color: var(--color-text-title, #14302e);
	}

	.a-sub {
		font-size: 0.75rem;
		color: var(--color-text-subtitle, #5c7a78);
	}

	.text-recovered { color: var(--color-teal-base, #2ba8a2); }
	.text-away { color: #0284c7; }

	.largest-loan-box {
		display: flex;
		align-items: center;
		gap: 10px;
		background: rgba(56, 189, 248, 0.06);
		border: 1px solid rgba(56, 189, 248, 0.2);
		border-radius: var(--radius-md, 12px);
		padding: 12px 16px;
	}

	.box-icon { font-size: 1.2rem; }

	.box-text {
		display: flex;
		flex-direction: column;
		font-size: 0.8125rem;
	}

	.box-title { color: var(--color-text-title, #14302e); }
	.box-sub { color: var(--color-text-subtitle, #5c7a78); }
</style>

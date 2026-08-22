<script lang="ts">
	import { formatCurrency } from '$lib/client/utils/format';
	import type { MoneyReturningData } from '$lib/server/services/analysis/analysisTypes';

	let { returning }: { returning: MoneyReturningData } = $props();
</script>

<div class="returning-card">
	<div class="card-header">
		<div>
			<h3 class="card-title">Money Returning Context</h3>
			<p class="card-subtitle">Breakdown of money entering your pocket</p>
		</div>
		<span class="total-returning">{formatCurrency(returning.total)}</span>
	</div>

	<div class="returning-grid">
		<!-- Income -->
		<div class="r-tile">
			<span class="r-label">Earned Income</span>
			<span class="r-val">{formatCurrency(returning.income)}</span>
			<span class="r-sub">salary, freelance & business</span>
		</div>

		<!-- Lending Repayments -->
		<div class="r-tile">
			<span class="r-label">Lending Repayments</span>
			<span class="r-val">{formatCurrency(returning.repayments)}</span>
			<span class="r-sub">recovered loans</span>
		</div>

		<!-- Refunds -->
		<div class="r-tile">
			<span class="r-label">Refunds & Reversals</span>
			<span class="r-val">{formatCurrency(returning.refunds)}</span>
			<span class="r-sub">merchant refunds</span>
		</div>
	</div>
</div>

<style>
	.returning-card {
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

	.total-returning {
		font-size: 1.125rem;
		font-weight: 800;
		color: var(--color-teal-base, #2ba8a2);
	}

	.returning-grid {
		display: grid;
		grid-template-columns: repeat(1, 1fr);
		gap: 12px;
	}

	@media (min-width: 640px) {
		.returning-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	.r-tile {
		background: rgba(43, 168, 162, 0.04);
		border: 1px solid rgba(43, 168, 162, 0.12);
		border-radius: var(--radius-md, 12px);
		padding: 12px 14px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.r-label {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--color-text-subtitle, #5c7a78);
		text-transform: uppercase;
	}

	.r-val {
		font-size: 1.25rem;
		font-weight: 800;
		color: var(--color-teal-base, #2ba8a2);
	}

	.r-sub {
		font-size: 0.75rem;
		color: var(--color-text-subtitle, #5c7a78);
	}
</style>

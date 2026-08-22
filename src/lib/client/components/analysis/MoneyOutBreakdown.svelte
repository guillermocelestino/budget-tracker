<script lang="ts">
	import { formatCurrency } from '$lib/client/utils/format';
	import type { MoneyOutBreakdownData } from '$lib/server/services/analysis/analysisTypes';

	let { breakdown }: { breakdown: MoneyOutBreakdownData } = $props();

	const totalOut = $derived(breakdown.moneyGone + breakdown.moneyAway + breakdown.moneyCommitted);
</script>

<div class="breakdown-card">
	<div class="card-header">
		<h3 class="card-title">Money Out Taxonomy Breakdown</h3>
		<span class="card-total">Total Out: {formatCurrency(totalOut)}</span>
	</div>

	<div class="breakdown-bars">
		<div class="stacked-bar">
			<div
				class="bar-segment seg-gone"
				style="width: {breakdown.moneyGonePct}%;"
				title="Money Gone: {breakdown.moneyGonePct}%"
			></div>
			<div
				class="bar-segment seg-away"
				style="width: {breakdown.moneyAwayPct}%;"
				title="Money Away: {breakdown.moneyAwayPct}%"
			></div>
			<div
				class="bar-segment seg-committed"
				style="width: {breakdown.moneyCommittedPct}%;"
				title="Money Committed: {breakdown.moneyCommittedPct}%"
			></div>
		</div>
	</div>

	<div class="items-grid">
		<!-- Money Gone -->
		<div class="breakdown-item">
			<div class="item-header">
				<span class="dot dot-gone"></span>
				<span class="item-name">Money Gone</span>
				<span class="item-tag">Expenses</span>
			</div>
			<div class="item-amount">{formatCurrency(breakdown.moneyGone)}</div>
			<div class="item-pct">{breakdown.moneyGonePct}% of Money Out</div>
		</div>

		<!-- Money Away -->
		<div class="breakdown-item">
			<div class="item-header">
				<span class="dot dot-away"></span>
				<span class="item-name">Money Away</span>
				<span class="item-tag">Lending</span>
			</div>
			<div class="item-amount">{formatCurrency(breakdown.moneyAway)}</div>
			<div class="item-pct">{breakdown.moneyAwayPct}% of Money Out</div>
		</div>

		<!-- Money Committed -->
		<div class="breakdown-item">
			<div class="item-header">
				<span class="dot dot-committed"></span>
				<span class="item-name">Money Committed</span>
				<span class="item-tag">Obligations</span>
			</div>
			<div class="item-amount">{formatCurrency(breakdown.moneyCommitted)}</div>
			<div class="item-pct">{breakdown.moneyCommittedPct}% of Money Out</div>
		</div>

		<!-- Money Returning -->
		<div class="breakdown-item item-returning">
			<div class="item-header">
				<span class="dot dot-returning"></span>
				<span class="item-name">Money Returning</span>
				<span class="item-tag">Cash In</span>
			</div>
			<div class="item-amount">{formatCurrency(breakdown.moneyReturning)}</div>
			<div class="item-pct">Income & repayments</div>
		</div>
	</div>
</div>

<style>
	.breakdown-card {
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

	.card-total {
		font-size: 0.875rem;
		font-weight: 700;
		color: var(--color-text-subtitle, #5c7a78);
	}

	.breakdown-bars {
		margin-bottom: 20px;
	}

	.stacked-bar {
		display: flex;
		height: 12px;
		width: 100%;
		background: rgba(20, 48, 46, 0.06);
		border-radius: var(--radius-pill, 9999px);
		overflow: hidden;
	}

	.bar-segment {
		height: 100%;
		transition: width 0.3s ease;
	}

	.seg-gone { background: var(--color-coral-base, #ef6c4a); }
	.seg-away { background: #38bdf8; }
	.seg-committed { background: #f59e0b; }

	.items-grid {
		display: grid;
		grid-template-columns: repeat(1, 1fr);
		gap: 12px;
	}

	@media (min-width: 640px) {
		.items-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (min-width: 1024px) {
		.items-grid {
			grid-template-columns: repeat(4, 1fr);
		}
	}

	.breakdown-item {
		background: rgba(20, 48, 46, 0.02);
		border: 1px solid var(--color-hairline, rgba(20, 48, 46, 0.06));
		border-radius: var(--radius-md, 12px);
		padding: 12px 14px;
	}

	.item-header {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 6px;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}

	.dot-gone { background: var(--color-coral-base, #ef6c4a); }
	.dot-away { background: #38bdf8; }
	.dot-committed { background: #f59e0b; }
	.dot-returning { background: var(--color-teal-base, #2ba8a2); }

	.item-name {
		font-size: 0.8125rem;
		font-weight: 700;
		color: var(--color-text-title, #14302e);
	}

	.item-tag {
		margin-left: auto;
		font-size: 0.6875rem;
		font-weight: 600;
		color: var(--color-text-subtitle, #5c7a78);
		background: rgba(0,0,0,0.04);
		padding: 1px 6px;
		border-radius: 4px;
	}

	.item-amount {
		font-size: 1.25rem;
		font-weight: 800;
		color: var(--color-text-title, #14302e);
		line-height: 1.2;
	}

	.item-pct {
		font-size: 0.75rem;
		color: var(--color-text-subtitle, #5c7a78);
		margin-top: 2px;
	}
</style>

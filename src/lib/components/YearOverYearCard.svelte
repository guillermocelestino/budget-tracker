<script lang="ts">
	import { formatCurrency } from '$lib/utils/format';

	let {
		yoyData,
		selectedMonth,
	}: {
		yoyData: {
			prevYearMonth: string;
			previousMonth: { income: number; expense: number; balance: number };
			currentYTD: { income: number; expense: number };
			previousYTD: { income: number; expense: number };
			changes: {
				monthIncomeChange: number;
				monthExpenseChange: number;
				ytdIncomeChange: number;
				ytdExpenseChange: number;
			};
		} | undefined;
		selectedMonth: string;
	} = $props();

	const prevMonthLabel = $derived(
		yoyData?.prevYearMonth ?? 'Last year'
	);

	function changeClass(change: number): string {
		if (change > 0) return 'positive';
		if (change < 0) return 'negative';
		return 'neutral';
	}

	function changeArrow(change: number, isIncome: boolean): string {
		if (change === 0) return '→';
		if (isIncome) return change > 0 ? '↑' : '↓';
		return change > 0 ? '↑' : '↓';
	}
</script>

{#if yoyData}
	<div class="yoy-section">
		<div class="yoy-header">
			<h3 class="yoy-title">📊 Year-over-Year Comparison</h3>
		</div>

		<!-- Monthly Comparison -->
		<div class="yoy-grid">
			<div class="yoy-card current">
				<div class="yoy-card-label">This Month</div>
				<div class="yoy-card-month">{selectedMonth}</div>
				<div class="yoy-card-row">
					<span class="yoy-label">Income</span>
					<span class="yoy-value income">{formatCurrency(yoyData.currentMonth?.income ?? 0)}</span>
				</div>
				<div class="yoy-card-row">
					<span class="yoy-label">Expenses</span>
					<span class="yoy-value expense">{formatCurrency(yoyData.currentMonth?.expense ?? 0)}</span>
				</div>
				<div class="yoy-card-row">
					<span class="yoy-label">Balance</span>
					<span class="yoy-value" class:income={(yoyData.currentMonth?.balance ?? 0) >= 0} class:expense={(yoyData.currentMonth?.balance ?? 0) < 0}>
						{formatCurrency(yoyData.currentMonth?.balance ?? 0)}
					</span>
				</div>
			</div>

			<div class="yoy-card previous">
				<div class="yoy-card-label">Same Month</div>
				<div class="yoy-card-month">{prevMonthLabel}</div>
				<div class="yoy-card-row">
					<span class="yoy-label">Income</span>
					<span class="yoy-value income">{formatCurrency(yoyData.previousMonth.income)}</span>
				</div>
				<div class="yoy-card-row">
					<span class="yoy-label">Expenses</span>
					<span class="yoy-value expense">{formatCurrency(yoyData.previousMonth.expense)}</span>
				</div>
				<div class="yoy-card-row">
					<span class="yoy-label">Balance</span>
					<span class="yoy-value" class:income={yoyData.previousMonth.balance >= 0} class:expense={yoyData.previousMonth.balance < 0}>
						{formatCurrency(yoyData.previousMonth.balance)}
					</span>
				</div>
			</div>
		</div>

		<!-- Change badges -->
		<div class="yoy-changes">
			<div class="change-badge" class:positive={yoyData.changes.monthIncomeChange > 0} class:negative={yoyData.changes.monthIncomeChange < 0}>
				<span class="change-arrow">{changeArrow(yoyData.changes.monthIncomeChange, true)}</span>
				<span class="change-label">Income</span>
				<span class="change-value">{yoyData.changes.monthIncomeChange > 0 ? '+' : ''}{yoyData.changes.monthIncomeChange}%</span>
			</div>
			<div class="change-badge" class:positive={yoyData.changes.monthExpenseChange < 0} class:negative={yoyData.changes.monthExpenseChange > 0}>
				<span class="change-arrow">{changeArrow(yoyData.changes.monthExpenseChange, false)}</span>
				<span class="change-label">Expenses</span>
				<span class="change-value">{yoyData.changes.monthExpenseChange > 0 ? '+' : ''}{yoyData.changes.monthExpenseChange}%</span>
			</div>
		</div>

		<!-- YTD Comparison -->
		<div class="ytd-section">
			<div class="ytd-title">Year to Date</div>
			<div class="ytd-grid">
				<div class="ytd-col">
					<div class="ytd-year">This Year</div>
					<div class="ytd-row">
						<span>Income</span>
						<span class="income">{formatCurrency(yoyData.currentYTD.income)}</span>
					</div>
					<div class="ytd-row">
						<span>Expenses</span>
						<span class="expense">{formatCurrency(yoyData.currentYTD.expense)}</span>
					</div>
				</div>
				<div class="ytd-changes">
					<div class="change-badge small" class:positive={yoyData.changes.ytdIncomeChange > 0} class:negative={yoyData.changes.ytdIncomeChange < 0}>
						<span class="change-arrow">{changeArrow(yoyData.changes.ytdIncomeChange, true)}</span>
						<span class="change-value">{yoyData.changes.ytdIncomeChange > 0 ? '+' : ''}{yoyData.changes.ytdIncomeChange}%</span>
					</div>
					<div class="change-badge small" class:positive={yoyData.changes.ytdExpenseChange < 0} class:negative={yoyData.changes.ytdExpenseChange > 0}>
						<span class="change-arrow">{changeArrow(yoyData.changes.ytdExpenseChange, false)}</span>
						<span class="change-value">{yoyData.changes.ytdExpenseChange > 0 ? '+' : ''}{yoyData.changes.ytdExpenseChange}%</span>
					</div>
				</div>
				<div class="ytd-col">
					<div class="ytd-year">Last Year</div>
					<div class="ytd-row">
						<span>Income</span>
						<span class="income">{formatCurrency(yoyData.previousYTD.income)}</span>
					</div>
					<div class="ytd-row">
						<span>Expenses</span>
						<span class="expense">{formatCurrency(yoyData.previousYTD.expense)}</span>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.yoy-section {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--space-lg);
		margin-bottom: var(--space-lg);
		box-shadow: var(--shadow-sm);
	}

	.yoy-header {
		margin-bottom: var(--space-md);
	}

	.yoy-title {
		margin: 0;
		font-size: var(--font-size-lg);
		font-weight: 600;
		color: var(--color-text);
	}

	.yoy-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-md);
		margin-bottom: var(--space-md);
	}

	.yoy-card {
		padding: var(--space-md);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
	}

	.yoy-card.current {
		background: var(--color-primary-light);
		border-color: var(--color-primary);
	}

	.yoy-card-label {
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-text-secondary);
		margin-bottom: 2px;
	}

	.yoy-card-month {
		font-size: var(--font-size-sm);
		color: var(--color-text-secondary);
		margin-bottom: var(--space-sm);
	}

	.yoy-card-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 4px 0;
	}

	.yoy-label {
		font-size: var(--font-size-sm);
		color: var(--color-text-secondary);
	}

	.yoy-value {
		font-size: var(--font-size-base);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.yoy-value.income {
		color: var(--color-income);
	}

	.yoy-value.expense {
		color: var(--color-expense);
	}

	.yoy-changes {
		display: flex;
		gap: var(--space-sm);
		margin-bottom: var(--space-md);
	}

	.change-badge {
		flex: 1;
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
		background: var(--color-bg);
		border: 1px solid var(--color-border);
	}

	.change-badge.positive {
		background: rgba(16, 185, 129, 0.1);
		border-color: var(--color-income);
	}

	.change-badge.negative {
		background: rgba(239, 68, 68, 0.1);
		border-color: var(--color-expense);
	}

	.change-arrow {
		font-size: var(--font-size-base);
		font-weight: 700;
	}

	.change-badge.positive .change-arrow {
		color: var(--color-income);
	}

	.change-badge.negative .change-arrow {
		color: var(--color-expense);
	}

	.change-label {
		font-size: var(--font-size-sm);
		color: var(--color-text-secondary);
		flex: 1;
	}

	.change-value {
		font-size: var(--font-size-sm);
		font-weight: 700;
	}

	.change-badge.positive .change-value {
		color: var(--color-income);
	}

	.change-badge.negative .change-value {
		color: var(--color-expense);
	}

	.change-badge.small {
		padding: var(--space-xs) var(--space-sm);
	}

	.ytd-section {
		border-top: 1px solid var(--color-border);
		padding-top: var(--space-md);
	}

	.ytd-title {
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-text-secondary);
		margin-bottom: var(--space-sm);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.ytd-grid {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		gap: var(--space-md);
		align-items: center;
	}

	.ytd-year {
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-text);
		margin-bottom: var(--space-xs);
	}

	.ytd-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 2px 0;
		font-size: var(--font-size-sm);
		color: var(--color-text-secondary);
	}

	.ytd-row .income {
		font-weight: 700;
		color: var(--color-income);
	}

	.ytd-row .expense {
		font-weight: 700;
		color: var(--color-expense);
	}

	.ytd-changes {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	@media (max-width: 768px) {
		.yoy-grid {
			grid-template-columns: 1fr;
		}

		.ytd-grid {
			grid-template-columns: 1fr;
		}

		.ytd-changes {
			flex-direction: row;
			justify-content: center;
		}

		.yoy-changes {
			flex-direction: column;
		}
	}
</style>

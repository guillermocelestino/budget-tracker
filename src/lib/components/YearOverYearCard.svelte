<script lang="ts">
	import { formatCurrency } from '$lib/utils/format';

	let {
		yoyData,
		selectedMonth,
	}: {
		yoyData: {
			prevYearMonth: string;
			currentMonth: { income: number; expense: number; balance: number };
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

	const incomeUp = $derived((yoyData?.changes.monthIncomeChange ?? 0) > 0);
	const incomeChange = $derived(yoyData?.changes.monthIncomeChange ?? 0);
	const expenseChange = $derived(yoyData?.changes.monthExpenseChange ?? 0);

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
		<div class="yoy-ribbon"></div>
		<div class="yoy-header">
			<h3 class="yoy-title">
				{#if incomeUp}
					<span class="crown">👑</span>
				{/if}
				Year-over-Year
			</h3>
		</div>

		<!-- Monthly Comparison -->
		<div class="yoy-grid">
			<div class="yoy-card current" class:gold={incomeUp}>
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
			<div class="change-badge" class:gold-medal={incomeUp} class:quiet={!incomeUp}>
				<span class="change-arrow">{changeArrow(incomeChange, true)}</span>
				<span class="change-label">Income</span>
				<span class="change-value">{incomeChange > 0 ? '+' : ''}{incomeChange}%</span>
			</div>
			<div class="change-badge" class:coral={expenseChange > 0} class:quiet={expenseChange <= 0}>
				<span class="change-arrow">{changeArrow(expenseChange, false)}</span>
				<span class="change-label">Expenses</span>
				<span class="change-value">{expenseChange > 0 ? '+' : ''}{expenseChange}%</span>
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
					<div class="change-badge small" class:gold-medal={yoyData.changes.ytdIncomeChange > 0} class:quiet={yoyData.changes.ytdIncomeChange <= 0}>
						<span class="change-arrow">{changeArrow(yoyData.changes.ytdIncomeChange, true)}</span>
						<span class="change-value">{yoyData.changes.ytdIncomeChange > 0 ? '+' : ''}{yoyData.changes.ytdIncomeChange}%</span>
					</div>
					<div class="change-badge small" class:coral={yoyData.changes.ytdExpenseChange > 0} class:quiet={yoyData.changes.ytdExpenseChange <= 0}>
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
		position: relative;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		padding: var(--space-lg);
		padding-top: calc(var(--space-lg) + 3px);
		margin-bottom: var(--space-lg);
		box-shadow: var(--shadow-card);
		overflow: hidden;
		transition: box-shadow 250ms var(--ease);
	}

	.yoy-section:hover {
		box-shadow: var(--shadow-lg);
	}

	.yoy-ribbon {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 3px;
		background: linear-gradient(90deg, var(--color-teal), var(--color-gold));
	}

	.yoy-header {
		margin-bottom: var(--space-md);
	}

	.yoy-title {
		margin: 0;
		font-size: var(--font-size-lg);
		font-weight: 700;
		color: var(--color-ink);
		font-family: var(--font-display);
	}

	.crown {
		animation: crown-bounce 2s ease-in-out infinite;
		display: inline-block;
	}

	.yoy-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-md);
		margin-bottom: var(--space-md);
	}

	.yoy-card {
		padding: var(--space-md);
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-border);
		background: var(--color-cream);
	}

	.yoy-card.current.gold {
		background: linear-gradient(170deg, var(--color-cream) 0%, rgba(255, 210, 63, 0.08) 100%);
		border-color: rgba(255, 210, 63, 0.25);
	}

	.yoy-card-label {
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-text-muted);
		margin-bottom: 2px;
	}

	.yoy-card-month {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
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
		color: var(--color-text-muted);
	}

	.yoy-value {
		font-size: var(--font-size-base);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--color-ink);
	}

	.yoy-value.income {
		color: var(--color-teal);
	}

	.yoy-value.expense {
		color: var(--color-coral);
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
		border-radius: var(--radius-pill);
		background: var(--color-cream);
		border: 1px solid var(--color-border);
		transition: all 200ms var(--bounce);
	}

	.change-badge.gold-medal {
		background: linear-gradient(170deg, var(--color-cream) 0%, rgba(255, 210, 63, 0.12) 100%);
		border-color: var(--color-gold);
		box-shadow: var(--glow-gold);
	}

	.change-badge.coral {
		background: linear-gradient(170deg, var(--color-cream) 0%, rgba(239, 108, 74, 0.08) 100%);
		border-color: rgba(239, 108, 74, 0.25);
	}

	.change-badge.quiet {
		border-color: var(--color-border);
	}

	.change-arrow {
		font-size: var(--font-size-base);
		font-weight: 700;
	}

	.change-badge.gold-medal .change-arrow {
		color: var(--color-gold-dark);
	}

	.change-badge.coral .change-arrow {
		color: var(--color-coral);
	}

	.change-badge.quiet .change-arrow {
		color: var(--color-text-muted);
	}

	.change-label {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		flex: 1;
	}

	.change-value {
		font-size: var(--font-size-sm);
		font-weight: 700;
	}

	.change-badge.gold-medal .change-value {
		color: var(--color-ink);
	}

	.change-badge.coral .change-value {
		color: var(--color-coral);
	}

	.change-badge.quiet .change-value {
		color: var(--color-text-muted);
	}

	.change-badge.small {
		padding: var(--space-xs) var(--space-sm);
	}

	.ytd-section {
		border-top: 1px dashed var(--color-border);
		padding-top: var(--space-md);
	}

	.ytd-title {
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-text-muted);
		margin-bottom: var(--space-sm);
		text-transform: lowercase;
		letter-spacing: 0.02em;
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
		color: var(--color-ink);
		margin-bottom: var(--space-xs);
	}

	.ytd-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 2px 0;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	.ytd-row .income {
		font-weight: 700;
		color: var(--color-teal);
	}

	.ytd-row .expense {
		font-weight: 700;
		color: var(--color-coral);
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

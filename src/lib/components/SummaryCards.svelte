<script lang="ts">
	import { formatCurrency } from '$lib/utils/format';

	let {
		totalIncome = 0,
		totalExpenses = 0,
		balance = 0,
		savingsRate = 0,
	}: {
		totalIncome?: number;
		totalExpenses?: number;
		balance?: number;
		savingsRate?: number;
	} = $props();
</script>

<div class="summary-grid">
	<div class="summary-card income">
		<div class="card-icon">
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<line x1="12" x2="12" y1="2" y2="22"/>
				<path d="M6 4h7a4 4 0 0 1 0 8H6" /><line x1="4" x2="18" y1="12" y2="12" /><line x1="4" x2="18" y1="16" y2="16"/>
			</svg>
		</div>
		<div class="card-content">
			<span class="card-label">Total Income</span>
			<span class="card-value">{formatCurrency(totalIncome)}</span>
		</div>
		<div class="card-accent"></div>
	</div>

	<div class="summary-card expense">
		<div class="card-icon">
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M2 12a5 5 0 0 0 5 5 8 8 0 0 1 5 2 8 8 0 0 1 5-2 5 5 0 0 0 5-5V7h-5a8 8 0 0 0-5 2 8 8 0 0 0-5-2H2Z"/>
				<path d="M6 11c1.5 0 3 .5 3 2-2 0-3 0-3-2Z"/>
			</svg>
		</div>
		<div class="card-content">
			<span class="card-label">Total Expenses</span>
			<span class="card-value">{formatCurrency(totalExpenses)}</span>
		</div>
		<div class="card-accent"></div>
	</div>

	<div class="summary-card balance" class:negative={balance < 0}>
		<div class="card-icon">
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z"/>
			</svg>
		</div>
		<div class="card-content">
			<span class="card-label">Current Balance</span>
			<span class="card-value">{formatCurrency(balance)}</span>
		</div>
		<div class="card-accent"></div>
	</div>

	<div class="summary-card savings">
		<div class="card-icon">
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M12 2L2 7l10 5 10-5-10-5z"/>
				<path d="M2 17l10 5 10-5"/>
				<path d="M2 12l10 5 10-5"/>
			</svg>
		</div>
		<div class="card-content">
			<span class="card-label">Savings Rate</span>
			<span class="card-value" class:negative={savingsRate < 0}>{savingsRate.toFixed(1)}%</span>
		</div>
		<div class="card-accent"></div>
	</div>
</div>

<style>
	.summary-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: var(--space-md);
		margin-bottom: var(--space-lg);
	}

	.summary-card {
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--space-md);
		background: var(--color-surface);
		border-radius: var(--radius-xl);
		padding: var(--space-lg);
		box-shadow: var(--shadow-sm);
		border: 1px solid var(--color-border);
		transition: all 200ms ease;
		overflow: hidden;
	}

	.summary-card:hover {
		transform: translateY(-3px);
		box-shadow: var(--shadow-lg);
	}

	.summary-card.income:hover {
		border-color: rgba(16, 185, 129, 0.3);
	}

	.summary-card.expense:hover {
		border-color: rgba(239, 68, 68, 0.3);
	}

	.summary-card.balance:hover,
	.summary-card.savings:hover {
		border-color: rgba(99, 102, 241, 0.3);
	}

	.card-icon {
		width: 52px;
		height: 52px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-lg);
		flex-shrink: 0;
	}

	.summary-card.income .card-icon {
		background: linear-gradient(135deg, var(--color-income-light) 0%, rgba(16, 185, 129, 0.15) 100%);
		color: var(--color-income);
	}

	.summary-card.expense .card-icon {
		background: linear-gradient(135deg, var(--color-expense-light) 0%, rgba(239, 68, 68, 0.15) 100%);
		color: var(--color-expense);
	}

	.summary-card.balance .card-icon,
	.summary-card.savings .card-icon {
		background: linear-gradient(135deg, var(--color-primary-light) 0%, rgba(99, 102, 241, 0.15) 100%);
		color: var(--color-primary);
	}

	.summary-card.balance.negative .card-icon {
		background: linear-gradient(135deg, var(--color-expense-light) 0%, rgba(239, 68, 68, 0.15) 100%);
		color: var(--color-expense);
	}

	.card-content {
		display: flex;
		flex-direction: column;
		z-index: 1;
	}

	.card-label {
		font-size: var(--font-size-sm);
		color: var(--color-text-secondary);
		margin-bottom: 4px;
		font-weight: 500;
	}

	.card-value {
		font-size: var(--font-size-xl);
		font-weight: 700;
		color: var(--color-text);
		font-variant-numeric: tabular-nums;
		transition: opacity 300ms ease;
	}

	.summary-card.balance.negative .card-value,
	.summary-card.savings .card-value.negative {
		color: var(--color-expense);
	}

	.summary-card.savings .card-value {
		color: var(--color-income);
	}

	.card-accent {
		position: absolute;
		top: 0;
		right: 0;
		width: 80px;
		height: 80px;
		border-radius: 0 0 0 100%;
		opacity: 0.1;
	}

	.summary-card.income .card-accent {
		background: var(--color-income);
	}

	.summary-card.expense .card-accent {
		background: var(--color-expense);
	}

	.summary-card.balance .card-accent,
	.summary-card.savings .card-accent {
		background: var(--color-primary);
	}

	.summary-card.balance.negative .card-accent {
		background: var(--color-expense);
	}

	@media (max-width: 1024px) {
		.summary-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (max-width: 768px) {
		.summary-grid {
			grid-template-columns: 1fr;
		}

		.summary-card {
			padding: var(--space-md);
		}

		.card-icon {
			width: 48px;
			height: 48px;
		}

		.card-value {
			font-size: var(--font-size-lg);
		}
	}
</style>

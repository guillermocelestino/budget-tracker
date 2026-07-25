<script lang="ts">
	import { formatCurrency } from '$lib/utils/format';

	let {
		totalIncome = 0,
		totalExpenses = 0,
		balance = 0,
	}: {
		totalIncome?: number;
		totalExpenses?: number;
		balance?: number;
	} = $props();
</script>

<div class="summary-grid">
	<div class="summary-card income">
		<div class="card-icon">💰</div>
		<div class="card-content">
			<span class="card-label">Income</span>
			<span class="card-value">{formatCurrency(totalIncome)}</span>
		</div>
	</div>

	<div class="summary-card expense">
		<div class="card-icon">💸</div>
		<div class="card-content">
			<span class="card-label">Expenses</span>
			<span class="card-value">{formatCurrency(totalExpenses)}</span>
		</div>
	</div>

	<div class="summary-card balance" class:negative={balance < 0}>
		<div class="card-icon">🏦</div>
		<div class="card-content">
			<span class="card-label">Balance</span>
			<span class="card-value">{formatCurrency(balance)}</span>
		</div>
	</div>
</div>

<style>
	.summary-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--space-md);
		margin-bottom: var(--space-lg);
	}

	.summary-card {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		padding: var(--space-lg);
		box-shadow: var(--shadow-sm);
		border: 1px solid var(--color-border);
	}

	.card-icon {
		font-size: 2rem;
	}

	.card-content {
		display: flex;
		flex-direction: column;
	}

	.card-label {
		font-size: var(--font-size-sm);
		color: var(--color-text-secondary);
		margin-bottom: 2px;
	}

	.card-value {
		font-size: var(--font-size-xl);
		font-weight: 700;
		color: var(--color-text);
	}

	.summary-card.income {
		border-left: 4px solid var(--color-income);
	}

	.summary-card.expense {
		border-left: 4px solid var(--color-expense);
	}

	.summary-card.balance {
		border-left: 4px solid var(--color-primary);
	}

	.summary-card.balance.negative {
		border-left-color: var(--color-expense);
	}

	.summary-card.balance.negative .card-value {
		color: var(--color-expense);
	}

	.card-value {
		composes: card-value;
	}

	@media (max-width: 768px) {
		.summary-grid {
			grid-template-columns: 1fr;
		}
	}
</style>

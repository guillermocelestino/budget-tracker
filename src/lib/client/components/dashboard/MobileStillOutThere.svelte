<script lang="ts">
	import { formatCurrency } from '$lib/client/utils/format';

	interface ActiveLoan {
		id: number;
		borrower_name: string;
		remaining: number;
	}

	let {
		outstanding = 0,
		loans = []
	}: {
		outstanding?: number;
		loans?: ActiveLoan[];
	} = $props();

	const loanCountText = $derived.by(() => {
		const count = loans.length;
		if (count === 0 && outstanding > 0) return 'Active loans outstanding';
		if (count === 1) return '1 loan outstanding';
		return `${count} loans outstanding`;
	});
</script>

<div class="still-out-card" class:has-outstanding={outstanding > 0}>
	<div class="still-out-header">
		<span class="still-out-tag">🤝 STILL OUT OF YOUR POCKET</span>
		<a href="/lending" class="view-link">View details ›</a>
	</div>

	{#if outstanding > 0}
		<div class="summary-subhead-row">
			<span class="loan-count-label">{loanCountText}</span>
			<span class="total-outstanding-val">{formatCurrency(outstanding)}</span>
		</div>

		{#if loans.length > 0}
			<div class="loan-list">
				{#each loans.slice(0, 5) as loan (loan.id)}
					<div class="loan-item">
						<span class="borrower-name">{loan.borrower_name}</span>
						<span class="loan-remaining">{formatCurrency(loan.remaining)}</span>
					</div>
				{/each}
			</div>
		{/if}
	{:else}
		<div class="empty-state">
			<span class="check-icon">✨</span>
			<span class="empty-text">All clear — no money currently out in loans!</span>
		</div>
	{/if}
</div>

<style>
	.still-out-card {
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-2xl, 20px);
		padding: 16px 18px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		box-shadow: var(--shadow-sm);
	}

	.still-out-card.has-outstanding {
		border-left: 4px solid var(--color-money-away, #5DADE2);
	}

	.still-out-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.still-out-tag {
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-text-muted);
	}

	.view-link {
		font-size: 11px;
		font-weight: 700;
		color: var(--color-money-away, #5DADE2);
		text-decoration: none;
	}

	.summary-subhead-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		padding-bottom: 4px;
		border-bottom: 1px dashed var(--color-hairline);
	}

	.loan-count-label {
		font-size: 12px;
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.total-outstanding-val {
		font-family: var(--font-display);
		font-size: 18px;
		font-weight: 900;
		color: var(--color-money-away, #5DADE2);
	}

	.loan-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.loan-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 13px;
	}

	.borrower-name {
		font-weight: 600;
		color: var(--color-ink);
	}

	.loan-remaining {
		font-family: var(--font-display);
		font-weight: 700;
		color: var(--color-ink);
	}

	.empty-state {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 0;
	}

	.check-icon {
		font-size: 16px;
	}

	.empty-text {
		font-size: 12px;
		font-weight: 600;
		color: var(--color-text-muted);
	}
</style>

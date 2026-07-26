<script lang="ts">
	import { formatCurrency } from '$lib/utils/format';

	let {
		totalLent = 0,
		totalRecovered = 0,
		outstanding = 0,
	}: {
		totalLent?: number;
		totalRecovered?: number;
		outstanding?: number;
	} = $props();
</script>

<div class="lending-summary-grid">
	<div class="summary-card">
		<div class="card-icon lent">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M12 2a3 3 0 0 0-3 3v1h6V5a3 3 0 0 0-3-3z"/>
				<path d="M5 8h14a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/>
			</svg>
		</div>
		<div class="card-content">
			<span class="card-label">Total Lent</span>
			<span class="card-value">{formatCurrency(totalLent)}</span>
		</div>
		<div class="card-accent"></div>
	</div>
	<div class="summary-card">
		<div class="card-icon recovered">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<line x1="12" x2="12" y1="2" y2="22"/>
				<path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
			</svg>
		</div>
		<div class="card-content">
			<span class="card-label">Recovered</span>
			<span class="card-value recovered">{formatCurrency(totalRecovered)}</span>
		</div>
		<div class="card-accent"></div>
	</div>
	<div class="summary-card">
		<div class="card-icon outstanding">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="12" r="10"/>
				<path d="M12 6v6l4 2"/>
			</svg>
		</div>
		<div class="card-content">
			<span class="card-label">Outstanding</span>
			<span class="card-value outstanding">{formatCurrency(outstanding)}</span>
		</div>
		<div class="card-accent"></div>
	</div>
</div>

<style>
	.lending-summary-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--space-md);
		margin-bottom: var(--space-lg);
		animation: slideInUp 0.5s ease-out;
	}

	.summary-card {
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--space-md);
		background: rgba(255, 255, 255, 0.85);
		backdrop-filter: blur(20px);
		border-radius: var(--radius-xl);
		padding: var(--space-lg);
		box-shadow: var(--shadow-sm);
		border: 1px solid var(--color-border);
		overflow: hidden;
		transition: all 200ms ease;
	}

	.summary-card:hover {
		transform: translateY(-3px);
		box-shadow: var(--shadow-lg);
	}

	.card-icon {
		width: 44px;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-md);
		flex-shrink: 0;
		z-index: 1;
	}

	.card-icon.lent {
		background: linear-gradient(135deg, var(--color-primary-light) 0%, rgba(99, 102, 241, 0.15) 100%);
		color: var(--color-primary);
	}

	.card-icon.recovered {
		background: linear-gradient(135deg, var(--color-income-light) 0%, rgba(16, 185, 129, 0.15) 100%);
		color: var(--color-income);
	}

	.card-icon.outstanding {
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
		margin-bottom: 2px;
		font-weight: 500;
	}

	.card-value {
		font-size: var(--font-size-lg);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.card-value.recovered {
		color: var(--color-income);
	}

	.card-value.outstanding {
		color: var(--color-expense);
	}

	.card-accent {
		position: absolute;
		top: 0;
		right: 0;
		width: 60px;
		height: 60px;
		border-radius: 0 0 0 100%;
		opacity: 0.08;
	}

	.summary-card:nth-child(1) .card-accent { background: var(--color-primary); }
	.summary-card:nth-child(2) .card-accent { background: var(--color-income); }
	.summary-card:nth-child(3) .card-accent { background: var(--color-expense); }

	@keyframes slideInUp {
		from { opacity: 0; transform: translateY(20px); }
		to { opacity: 1; transform: translateY(0); }
	}

	@media (max-width: 768px) {
		.lending-summary-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
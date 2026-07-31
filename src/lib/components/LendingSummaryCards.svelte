<script lang="ts">
	import { formatCurrency } from '$lib/utils/format';

	let {
		totalLent = 0,
		totalRecovered = 0,
		outstanding = 0,
		direction = 'lent'
	}: {
		totalLent?: number;
		totalRecovered?: number;
		outstanding?: number;
		direction?: 'lent' | 'borrowed';
	} = $props();

	const isBorrowed = $derived(direction === 'borrowed');
	const totalLabel = $derived(isBorrowed ? 'Total Borrowed' : 'Total Lent');
	const recoveredLabel = $derived(isBorrowed ? 'Repaid' : 'Recovered');
	const outstandingLabel = $derived(isBorrowed ? 'Still Owing' : 'Outstanding');
	const totalAccentClass = $derived(isBorrowed ? 'borrowed' : 'lent');
	const recoveredAccentClass = $derived(isBorrowed ? 'repaid' : 'recovered');
	const outstandingAccentClass = $derived(isBorrowed ? 'owing' : 'outstanding');
</script>

<div class="lending-summary-grid">
	<div class="summary-card flip7-card">
		<div class="card-accent {totalAccentClass}"></div>
		<div class="flip7-watermark" aria-hidden="true">
			<svg width="96" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
				<rect x="2" y="6" width="20" height="12" rx="2"/>
				<circle cx="12" cy="12" r="2.5"/>
				<path d="M6 12h.01M18 12h.01"/>
			</svg>
		</div>
		<div class="card-icon {totalAccentClass}">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M12 2a3 3 0 0 0-3 3v1h6V5a3 3 0 0 0-3-3z"/>
				<path d="M5 8h14a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/>
			</svg>
		</div>
		<div class="card-content">
			<span class="card-label">{totalLabel}</span>
			<span class="card-value">{formatCurrency(totalLent)}</span>
		</div>
	</div>
	<div class="summary-card flip7-card">
		<div class="card-accent {recoveredAccentClass}"></div>
		<div class="card-icon {recoveredAccentClass}">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<line x1="12" x2="12" y1="2" y2="22"/>
				<path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
			</svg>
		</div>
		<div class="card-content">
			<span class="card-label">{recoveredLabel}</span>
			<span class="card-value recovered">{formatCurrency(totalRecovered)}</span>
		</div>
	</div>
	<div class="summary-card flip7-card">
		<div class="card-accent {outstandingAccentClass}"></div>
		<div class="card-icon {outstandingAccentClass}">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="12" r="10"/>
				<path d="M12 6v6l4 2"/>
			</svg>
		</div>
		<div class="card-content">
			<span class="card-label">{outstandingLabel}</span>
			<span class="card-value outstanding">{formatCurrency(outstanding)}</span>
		</div>
	</div>
</div>

<style>
	.lending-summary-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--space-md);
		margin-bottom: var(--space-lg);
		animation: fade-in-up 500ms var(--ease) both;
	}

	.summary-card {
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--space-md);
		padding: var(--space-lg);
		padding-left: calc(var(--space-lg) + 4px);
		background: var(--color-surface);
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-card);
		border: 1px solid var(--color-border);
		overflow: hidden;
		transition: all 250ms var(--bounce);
	}

	.summary-card:hover {
		transform: translateY(-3px) scale(1.02);
		box-shadow: var(--shadow-lg);
	}

	.card-accent {
		position: absolute;
		top: 0;
		left: 0;
		bottom: 0;
		width: 4px;
		border-radius: 2px 0 0 2px;
	}

	.card-accent.lent { background: var(--color-teal); }
	.card-accent.recovered { background: linear-gradient(180deg, var(--color-teal), var(--color-gold)); }
	.card-accent.outstanding { background: var(--color-coral); }
	.card-accent.borrowed { background: var(--color-coral); }
	.card-accent.repaid { background: linear-gradient(180deg, var(--color-coral), var(--color-gold)); }
	.card-accent.owing { background: var(--color-teal); }

	/* ── Dark signature: the Flip7 ::before replaces the accent div ── */
	[data-theme="dark"] .card-accent { display: none; }

	[data-theme="dark"] .summary-card:has(.card-accent.lent)::before { background: var(--color-teal); box-shadow: var(--glow-card); }
	[data-theme="dark"] .summary-card:has(.card-accent.recovered)::before { background: linear-gradient(180deg, var(--color-teal), var(--color-gold)); box-shadow: var(--glow-card); }
	[data-theme="dark"] .summary-card:has(.card-accent.outstanding)::before { background: var(--color-coral); box-shadow: var(--glow-coral); }
	[data-theme="dark"] .summary-card:has(.card-accent.borrowed)::before { background: var(--color-coral); box-shadow: var(--glow-coral); }
	[data-theme="dark"] .summary-card:has(.card-accent.repaid)::before { background: linear-gradient(180deg, var(--color-coral), var(--color-gold)); box-shadow: var(--glow-coral); }
	[data-theme="dark"] .summary-card:has(.card-accent.owing)::before { background: var(--color-teal); box-shadow: var(--glow-card); }

	.card-icon {
		width: 44px;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-lg);
		flex-shrink: 0;
		z-index: 1;
	}

	.card-icon.lent {
		background: var(--color-teal-bg);
		color: var(--color-teal);
	}

	.card-icon.recovered {
		background: rgba(255, 210, 63, 0.15);
		color: var(--color-gold-dark);
	}

	.card-icon.outstanding {
		background: rgba(239, 108, 74, 0.10);
		color: var(--color-coral);
	}

	.card-icon.borrowed {
		background: rgba(239, 108, 74, 0.10);
		color: var(--color-coral);
	}

	.card-icon.repaid {
		background: rgba(255, 210, 63, 0.15);
		color: var(--color-gold-dark);
	}

	.card-icon.owing {
		background: var(--color-teal-bg);
		color: var(--color-teal);
	}

	.card-content {
		position: relative;
		display: flex;
		flex-direction: column;
		z-index: 1;
	}

	.card-label {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		margin-bottom: 2px;
		font-weight: 500;
	}

	.card-value {
		font-size: var(--font-size-lg);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--color-ink);
	}

	.card-value.recovered {
		color: var(--color-teal);
	}

	.card-value.outstanding {
		color: var(--color-coral);
	}

	.card-value.repaid {
		color: var(--color-teal);
	}

	.card-value.owing {
		color: var(--color-coral);
	}

	@media (max-width: 768px) {
		.lending-summary-grid {
			grid-template-columns: 1fr;
		}
	}
</style>

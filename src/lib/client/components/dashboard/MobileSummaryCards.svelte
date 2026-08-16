<script lang="ts">
	import { formatCurrency } from '$lib/client/utils/format';

	let {
		spent = 0,
		lent = 0,
		repaid = 0
	}: {
		spent?: number;
		lent?: number;
		repaid?: number;
	} = $props();

	function formatCompact(amount: number): string {
		if (amount >= 1000) {
			const k = amount / 1000;
			return `₱${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
		}
		return formatCurrency(amount);
	}
</script>

<div class="summary-cards-grid">
	<!-- Card 1: SPENT -->
	<div class="summary-card spent-card">
		<span class="card-tag">SPENT</span>
		<span class="card-subtag">GONE</span>
		<span class="card-val">{formatCompact(spent)}</span>
	</div>

	<!-- Card 2: LENT -->
	<div class="summary-card lent-card">
		<span class="card-tag">LENT</span>
		<span class="card-subtag">AWAY</span>
		<span class="card-val">{formatCompact(lent)}</span>
	</div>

	<!-- Card 3: REPAID -->
	<div class="summary-card repaid-card">
		<span class="card-tag">REPAID</span>
		<span class="card-subtag">COMMITTED</span>
		<span class="card-val">{formatCompact(repaid)}</span>
	</div>
</div>

<style>
	.summary-cards-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
	}

	.summary-card {
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-xl, 18px);
		padding: 12px 10px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		box-shadow: var(--shadow-sm);
		transition: transform 140ms ease;
	}

	.summary-card:active {
		transform: scale(0.97);
	}

	.card-tag {
		font-family: var(--font-display);
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-text-muted);
	}

	.card-subtag {
		font-family: var(--font-mono);
		font-size: 9px;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.spent-card { border-top: 3px solid var(--color-money-gone, #EF6C4A); }
	.spent-card .card-subtag { color: var(--color-money-gone, #EF6C4A); }

	.lent-card { border-top: 3px solid var(--color-money-away, #5DADE2); }
	.lent-card .card-subtag { color: var(--color-money-away, #5DADE2); }

	.repaid-card { border-top: 3px solid var(--color-gold, #FFD23F); }
	.repaid-card .card-subtag { color: var(--color-gold-dark, #D97706); }

	.card-val {
		font-family: var(--font-display);
		font-size: clamp(14px, 4vw, 18px);
		font-weight: 800;
		color: var(--color-ink);
		margin-top: 4px;
		line-height: 1.1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>

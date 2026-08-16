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

	const total = $derived(spent + lent + repaid);

	function getWidth(val: number): number {
		if (total <= 0 || val <= 0) return 0;
		return Math.min(100, Math.round((val / total) * 100));
	}

	function formatCompact(amount: number): string {
		if (amount >= 1000) {
			const k = amount / 1000;
			return `₱${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
		}
		return formatCurrency(amount);
	}
</script>

<div class="drain-pillars-grid">
	<!-- Pillar 1: SPENT -->
	<div class="pillar-card spent-pillar">
		<div class="pillar-top-row">
			<span class="pillar-emoji">💸</span>
			<div class="pillar-titles">
				<span class="pillar-tag">SPENT</span>
				<span class="pillar-subtag">GONE</span>
			</div>
		</div>
		<span class="pillar-val">{formatCompact(spent)}</span>
		<div class="pillar-progress-track">
			<div class="pillar-progress-fill spent-fill" style:width="{getWidth(spent)}%"></div>
		</div>
	</div>

	<!-- Pillar 2: LENT -->
	<div class="pillar-card lent-pillar">
		<div class="pillar-top-row">
			<span class="pillar-emoji">🤝</span>
			<div class="pillar-titles">
				<span class="pillar-tag">LENT</span>
				<span class="pillar-subtag">AWAY</span>
			</div>
		</div>
		<span class="pillar-val">{formatCompact(lent)}</span>
		<div class="pillar-progress-track">
			<div class="pillar-progress-fill lent-fill" style:width="{getWidth(lent)}%"></div>
		</div>
	</div>

	<!-- Pillar 3: REPAID -->
	<div class="pillar-card repaid-pillar">
		<div class="pillar-top-row">
			<span class="pillar-emoji">🧾</span>
			<div class="pillar-titles">
				<span class="pillar-tag">REPAID</span>
				<span class="pillar-subtag">COMMITTED</span>
			</div>
		</div>
		<span class="pillar-val">{formatCompact(repaid)}</span>
		<div class="pillar-progress-track">
			<div class="pillar-progress-fill repaid-fill" style:width="{getWidth(repaid)}%"></div>
		</div>
	</div>
</div>

<style>
	.drain-pillars-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
	}

	.pillar-card {
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-xl, 18px);
		padding: 12px 10px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		box-shadow: var(--shadow-sm);
		position: relative;
		overflow: hidden;
	}

	.spent-pillar { border-top: 3px solid var(--color-coral, #EF6C4A); }
	.lent-pillar { border-top: 3px solid var(--color-sky, #5DADE2); }
	.repaid-pillar { border-top: 3px solid var(--color-gold, #FFD23F); }

	.pillar-top-row {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.pillar-emoji {
		font-size: 16px;
	}

	.pillar-titles {
		display: flex;
		flex-direction: column;
		line-height: 1;
	}

	.pillar-tag {
		font-family: var(--font-display);
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.06em;
		color: var(--color-text-muted);
	}

	.pillar-subtag {
		font-family: var(--font-mono);
		font-size: 9px;
		font-weight: 800;
		letter-spacing: 0.08em;
	}

	.spent-pillar .pillar-subtag { color: var(--color-coral, #EF6C4A); }
	.lent-pillar .pillar-subtag { color: var(--color-sky, #5DADE2); }
	.repaid-pillar .pillar-subtag { color: var(--color-gold-dark, #D97706); }

	.pillar-val {
		font-family: var(--font-display);
		font-size: clamp(14px, 4vw, 18px);
		font-weight: 900;
		color: var(--color-ink);
		line-height: 1.1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.pillar-progress-track {
		height: 4px;
		background: var(--color-hairline);
		border-radius: var(--radius-pill, 999px);
		overflow: hidden;
		margin-top: 2px;
	}

	.pillar-progress-fill {
		height: 100%;
		border-radius: var(--radius-pill, 999px);
		transition: width 300ms ease;
	}

	.spent-fill { background: var(--color-coral, #EF6C4A); }
	.lent-fill { background: var(--color-sky, #5DADE2); }
	.repaid-fill { background: var(--color-gold, #FFD23F); }
</style>

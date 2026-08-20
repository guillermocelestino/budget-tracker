<script lang="ts">
	import { formatCurrency } from '$lib/client/utils/format';
	import { getMonthLabel } from '$lib/shared/utils/format';

	let {
		monthStr = '',
		totalExpenses = 0,
		totalLent = 0,
		totalRepaid = 0,
		wreckedToday = 0,
		expenseChange = 0
	}: {
		monthStr?: string;
		totalExpenses?: number;
		totalLent?: number;
		totalRepaid?: number;
		wreckedToday?: number;
		expenseChange?: number;
	} = $props();

	const totalOut = $derived(totalExpenses + totalLent + totalRepaid);
	const monthLabel = $derived(monthStr ? getMonthLabel(monthStr).toUpperCase() : '');

	const spentPct = $derived(totalOut > 0 ? (totalExpenses / totalOut) * 100 : 33.3);
	const lentPct = $derived(totalOut > 0 ? (totalLent / totalOut) * 100 : 33.3);
	const repaidPct = $derived(totalOut > 0 ? (totalRepaid / totalOut) * 100 : 33.4);

	const formattedChange = $derived.by(() => {
		if (expenseChange === 0) return 'Same as last month';
		const sign = expenseChange > 0 ? '+' : '';
		return `${sign}${Math.round(expenseChange)}% vs last month`;
	});
</script>

<div class="money-hero-card">
	<div class="hero-header">
		<div class="hero-title-wrap">
			<span class="hero-icon">💸</span>
			<h2 class="hero-title">LEFT YOUR POCKET</h2>
		</div>
		{#if wreckedToday > 0}
			<span class="wrecked-badge">💀 wrecked ₱{Math.round(wreckedToday)} today</span>
		{/if}
	</div>

	<div class="hero-period">{monthLabel} · SO FAR</div>

	<div class="hero-total-amount">{formatCurrency(totalOut)}</div>

	<div class="hero-comparison">
		<span class="comparison-tag" class:increase={expenseChange > 0} class:decrease={expenseChange < 0}>
			{formattedChange}
		</span>
	</div>

	<!-- Proportional progress bar -->
	<div class="hero-breakdown-bar">
		<div class="bar-segment spent-segment" style="width: {spentPct}%;" title="Spent"></div>
		<div class="bar-segment lent-segment" style="width: {lentPct}%;" title="Lent"></div>
		<div class="bar-segment repaid-segment" style="width: {repaidPct}%;" title="Repaid"></div>
	</div>

	<div class="hero-breakdown-labels">
		<div class="label-col">
			<span class="dot spent-dot"></span>
			<span class="col-title">Spent</span>
			<span class="col-val">{formatCurrency(totalExpenses)}</span>
		</div>
		<div class="label-col">
			<span class="dot lent-dot"></span>
			<span class="col-title">Lent</span>
			<span class="col-val">{formatCurrency(totalLent)}</span>
		</div>
		<div class="label-col">
			<span class="dot repaid-dot"></span>
			<span class="col-title">Repaid</span>
			<span class="col-val">{formatCurrency(totalRepaid)}</span>
		</div>
	</div>
</div>

<style>
	.money-hero-card {
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-2xl, 20px);
		padding: 20px;
		box-shadow: var(--shadow-sm);
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 10px;
		position: relative;
		overflow: hidden;
		height: 100%;
	}

	.hero-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.hero-title-wrap {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.hero-icon {
		font-size: 16px;
	}

	.hero-title {
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.1em;
		color: var(--color-ink);
		text-transform: uppercase;
		margin: 0;
	}

	.wrecked-badge {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		color: var(--color-money-gone, #EF6C4A);
		background: rgba(239, 108, 74, 0.12);
		padding: 3px 8px;
		border-radius: var(--radius-pill);
		white-space: nowrap;
	}

	.hero-period {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 700;
		color: var(--color-text-muted);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		margin-top: 4px;
	}

	.hero-total-amount {
		font-family: var(--font-display);
		font-size: clamp(32px, 8vw, 42px);
		font-weight: 900;
		color: var(--color-ink);
		line-height: 1;
		letter-spacing: -0.03em;
		margin: 2px 0 4px 0;
	}

	.hero-comparison {
		display: flex;
		align-items: center;
		margin-bottom: 8px;
	}

	.comparison-tag {
		font-size: 12px;
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.comparison-tag.increase {
		color: var(--color-money-gone, #EF6C4A);
	}

	.comparison-tag.decrease {
		color: var(--color-teal, #2BA8A2);
	}

	.hero-breakdown-bar {
		display: flex;
		height: 10px;
		width: 100%;
		border-radius: var(--radius-pill);
		overflow: hidden;
		background: var(--color-surface-inset, rgba(0, 0, 0, 0.05));
		margin-bottom: 8px;
	}

	.bar-segment {
		height: 100%;
		transition: width 300ms ease;
	}

	.spent-segment {
		background: var(--color-money-gone, #EF6C4A);
	}

	.lent-segment {
		background: var(--color-money-away, #5DADE2);
	}

	.repaid-segment {
		background: var(--color-gold, #FFD23F);
	}

	.hero-breakdown-labels {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
		padding-top: 6px;
		border-top: 1px solid var(--color-hairline);
	}

	.label-col {
		display: flex;
		flex-direction: column;
		gap: 2px;
		position: relative;
		padding-left: 12px;
	}

	.dot {
		position: absolute;
		left: 0;
		top: 5px;
		width: 6px;
		height: 6px;
		border-radius: 50%;
	}

	.spent-dot { background: var(--color-money-gone, #EF6C4A); }
	.lent-dot { background: var(--color-money-away, #5DADE2); }
	.repaid-dot { background: var(--color-gold, #FFD23F); }

	.col-title {
		font-size: 10px;
		font-weight: 700;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.col-val {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 800;
		color: var(--color-ink);
	}
</style>

<script lang="ts">
	import { formatSignedCurrency } from '$lib/client/utils/format';
	import type { Snippet } from 'svelte';

	type Trend = { text: string; sentiment?: 'positive' | 'negative' };

	let {
		label,
		value,
		tone = 'auto',
		hero = false,
		icon,
		active = false,
		dimmed = false,
		onclick,
		ariaPressed,
		trend,
		className = ''
	}: {
		label: string;
		value: number;
		tone?: 'in' | 'out' | 'auto';
		hero?: boolean;
		icon?: Snippet;
		active?: boolean;
		dimmed?: boolean;
		onclick?: () => void;
		ariaPressed?: boolean;
		trend?: Trend;
		className?: string;
	} = $props();

	const isIn = $derived(tone === 'in' || (tone === 'auto' && value >= 0));
	const isOut = $derived(tone === 'out' || (tone === 'auto' && value < 0));
</script>

{#if onclick}
	<button
		class="card flip7-card {className}"
		class:active
		class:dimmed
		class:negative={isOut}
		onclick={onclick}
		aria-pressed={ariaPressed}
	>
		<div class="card-accent" class:accent-in={isIn} class:accent-out={isOut}></div>
		{#if icon}
			<div class="card-icon" class:icon-in={isIn} class:icon-out={isOut}>{@render icon()}</div>
		{/if}
		<div class="card-content">
			<span class="card-label">{label}</span>
			<span class="card-value" class:hero-value={hero} class:value-in={isIn} class:value-out={isOut}>{formatSignedCurrency(value)}</span>
			{#if trend}
				<span class="card-trend {trend.sentiment ?? ''}">
					{trend.text}
				</span>
			{/if}
		</div>
	</button>
{:else}
	<div class="card flip7-card {className}" class:active class:dimmed class:negative={isOut}>
		<div class="card-accent" class:accent-in={isIn} class:accent-out={isOut}></div>
		{#if icon}
			<div class="card-icon" class:icon-in={isIn} class:icon-out={isOut}>{@render icon()}</div>
		{/if}
		<div class="card-content">
			<span class="card-label">{label}</span>
			<span class="card-value" class:hero-value={hero} class:value-in={isIn} class:value-out={isOut}>{formatSignedCurrency(value)}</span>
			{#if trend}
				<span class="card-trend {trend.sentiment ?? ''}">
					{trend.text}
				</span>
			{/if}
		</div>
	</div>
{/if}

<style>
	/* Summary card — one shared implementation for the list-page KPI tiles.
	   Class names are preserved (.card, .card-accent, …) so existing page-level
	   :global() overrides keep targeting them. Money is mono + tabular + colored
	   by direction (rule 2 applies inside the shared component too). */
	.card {
		position: relative;
		display: flex;
		align-items: flex-start;
		gap: var(--space-md);
		padding: calc(var(--space-md) - 2px) var(--space-md);
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-xl);
		cursor: pointer;
		font-family: var(--font-body);
		text-align: left;
		overflow: hidden;
		min-height: 72px;
		transition: all 200ms var(--ease);
		-webkit-tap-highlight-color: transparent;
	}

	.card:hover {
		border-color: var(--color-teal);
		box-shadow: var(--glow-card);
		transform: translateY(-2px);
	}

	.card:active {
		transform: translateY(0) scale(0.98);
	}

	/* Shared focus ring token (keyboard focus only) */
	.card:focus-visible {
		outline: none;
		box-shadow: var(--focus);
	}

	[data-theme="dark"] .card.flip7-card::before {
		content: none;
	}

	/* ── Left accent bar — direction-colored (gold retired) ── */
	.card-accent {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 4px;
		border-radius: 0 2px 2px 0;
		transition: all 250ms var(--bounce);
	}

	.accent-in {
		background: var(--teal);
		box-shadow: var(--glow-card);
	}

	.accent-out {
		background: var(--rose);
		box-shadow: var(--glow-coral);
	}

	/* ── Icon chip ── */
	.card-icon {
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-lg);
		flex-shrink: 0;
		z-index: 1;
	}

	.icon-in {
		background: var(--mint-tint);
		color: var(--teal-deep);
	}

	.icon-out {
		background: var(--rose-soft);
		color: var(--rose);
	}

	/* ── Content ── */
	.card-content {
		display: flex;
		flex-direction: column;
		gap: 1px;
		z-index: 1;
		min-width: 0;
	}

	.card-label {
		font-family: var(--font-display);
		font-size: var(--font-size-xs);
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: none;
		letter-spacing: 0.02em;
		margin-bottom: 0;
	}

	/* Money — rounded mono, tabular, direction-colored (rule 2) */
	.card-value {
		font-size: 20px;
		font-weight: 700;
		line-height: 1.15;
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.02em;
		white-space: nowrap;
	}

	.hero-value {
		font-size: 22px;
		font-weight: 800;
	}

	.value-in {
		color: var(--teal);
	}

	.value-out {
		color: var(--rose);
	}

	/* ── Sentiment trend chip (teal = good, rose = bad, never arrow-blind) ── */
	.card-trend {
		display: inline-block;
		margin-top: 2px;
		font-size: 10px;
		font-weight: 600;
		padding: 1px 8px;
		border-radius: var(--radius-pill);
		width: fit-content;
		background: var(--color-bg);
		color: var(--color-text-muted);
		font-family: var(--font-display);
		white-space: nowrap;
	}

	.card-trend.positive {
		color: var(--teal);
		background: var(--mint-tint);
	}

	.card-trend.negative {
		color: var(--rose);
		background: var(--rose-soft);
	}

	/* ── Active filter state — teal (gold retired) ── */
	.card.active {
		border-color: var(--teal);
		background: var(--mint-tint);
		box-shadow: var(--glow-card);
		transform: scale(1.02);
	}

	.card.active .card-accent {
		background: var(--teal);
		box-shadow: var(--glow-card);
	}

	/* ── Dimmed state (a different card is active) ── */
	.card.dimmed {
		opacity: 0.45;
		transform: scale(0.98);
	}

	.card.dimmed:hover {
		opacity: 0.7;
		transform: scale(1);
	}
</style>

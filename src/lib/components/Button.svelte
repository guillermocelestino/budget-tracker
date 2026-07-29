<script lang="ts">
	let {
		variant = 'primary',
		size = 'md',
		href = '',
		type = 'button',
		disabled = false,
		fullWidth = false,
		onclick,
		children,
	}: {
		variant?: 'primary' | 'danger' | 'ghost' | 'link';
		size?: 'sm' | 'md';
		href?: string;
		type?: 'button' | 'submit';
		disabled?: boolean;
		fullWidth?: boolean;
		onclick?: (e: MouseEvent) => void;
		children?: import('svelte').Snippet;
	} = $props();
</script>

{#if href}
	<a
		href={href}
		class="btn btn-{variant} btn-{size}"
		class:full-width={fullWidth}
	>
		{@render children?.()}
	</a>
{:else}
	<button
		{type}
		{disabled}
		class="btn btn-{variant} btn-{size}"
		class:full-width={fullWidth}
		onclick={onclick}
	>
		{@render children?.()}
	</button>
{/if}

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-xs);
		border: none;
		border-radius: var(--radius-pill);
		font-family: inherit;
		font-weight: 600;
		cursor: pointer;
		text-decoration: none;
		transition: all var(--transition-fast);
		line-height: 1.4;
		padding: 12px var(--space-lg);
		min-height: 44px;
		position: relative;
		overflow: hidden;
		-webkit-tap-highlight-color: transparent;
	}

	.btn:active {
		transform: scale(0.95);
		transition: transform 120ms var(--bounce);
	}

	.btn-sm {
		padding: var(--space-sm) var(--space-md);
		font-size: var(--font-size-sm);
		min-height: 36px;
	}

	.btn-md {
		padding: 12px var(--space-lg);
		font-size: var(--font-size-base);
	}

	/* ═══ Primary = Gold gloss pill CTA ═══ */
	.btn-primary {
		background: linear-gradient(135deg, var(--color-gold) 0%, var(--color-gold-dark) 100%);
		color: var(--color-ink);
		box-shadow: var(--glow-gold);
		font-weight: var(--font-weight-bold);
	}

	.btn-primary::before {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 50%);
		border-radius: var(--radius-pill);
		pointer-events: none;
	}

	.btn-primary:hover {
		box-shadow: 0 6px 28px rgba(255, 210, 63, 0.55);
		transform: translateY(-1px);
	}

	.btn-primary:active {
		box-shadow: var(--glow-gold);
		transform: scale(0.95);
	}

	/* ═══ Danger = Coral BOOM pill ═══ */
	.btn-danger {
		background: linear-gradient(135deg, var(--color-coral) 0%, var(--color-coral-dark) 100%);
		color: white;
		box-shadow: var(--glow-coral);
		font-weight: var(--font-weight-bold);
	}

	.btn-danger:hover {
		box-shadow: 0 6px 28px rgba(239, 108, 74, 0.50);
		transform: translateY(-1px);
	}

	.btn-danger:active {
		transform: scale(0.95);
	}

	/* ═══ Ghost = Teal outline pill ═══ */
	.btn-ghost {
		background: transparent;
		color: var(--color-teal);
		border: 1px solid var(--color-teal);
	}

	.btn-ghost:hover {
		background: var(--color-teal-bg);
	}

	.btn-ghost:active {
		transform: scale(0.95);
	}

	/* ═══ Link = Gold text + animated underline ═══ */
	.btn-link {
		background: none;
		color: var(--color-gold);
		padding: var(--space-xs) var(--space-sm);
		border-radius: 0;
		position: relative;
		display: inline-flex;
	}

	.btn-link::after {
		content: '';
		position: absolute;
		bottom: 2px;
		left: 0;
		width: 0;
		height: 2px;
		background: var(--color-gold);
		transition: width var(--transition-normal);
		border-radius: var(--radius-sm);
	}

	.btn-link:hover::after {
		width: 100%;
	}

	.btn-link:hover {
		text-decoration: none;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		transform: none !important;
		box-shadow: none !important;
	}

	.full-width {
		width: 100%;
	}
</style>
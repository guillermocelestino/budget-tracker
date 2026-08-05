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
		ariaLabel = '',
		title = '',
		el = $bindable(null),
	}: {
		variant?: 'primary' | 'danger' | 'ghost' | 'link' | 'teal';
		size?: 'sm' | 'md';
		href?: string;
		type?: 'button' | 'submit';
		disabled?: boolean;
		fullWidth?: boolean;
		onclick?: (e: MouseEvent) => void;
		children?: import('svelte').Snippet;
		ariaLabel?: string;
		title?: string;
		el?: HTMLElement | null;
	} = $props();
</script>

{#if href}
	<a
		bind:this={el}
		href={href}
		class="btn btn-{variant} btn-{size}"
		class:full-width={fullWidth}
		aria-label={ariaLabel || undefined}
		title={title || undefined}
	>
		{@render children?.()}
	</a>
{:else}
	<button
		bind:this={el}
		{type}
		{disabled}
		class="btn btn-{variant} btn-{size}"
		class:full-width={fullWidth}
		onclick={onclick}
		aria-label={ariaLabel || undefined}
		title={title || undefined}
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

	.btn:focus-visible {
		outline: none;
		box-shadow: var(--focus);
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

	/* ═══ Primary = Gold gloss pill CTA ═══
	     One loud action per screen: saturated gold fill + glow + gloss.
	     Text is fixed dark ink (#14302E) so it stays legible on gold in BOTH
	     themes (matches the hero pill's on-gold fg). */
	.btn-primary {
		background: linear-gradient(135deg, var(--color-gold) 0%, var(--color-gold-dark) 100%);
		color: #14302E;
		box-shadow: var(--glow-gold);
		font-family: var(--font-display);
		font-weight: var(--font-weight-extrabold);
		letter-spacing: var(--letter-spacing-wide);
	}

	/* Static top gloss (rounded to the pill) */
	.btn-primary::before {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, rgba(255,255,255,0.28) 0%, transparent 55%);
		border-radius: var(--radius-pill);
		pointer-events: none;
	}

	/* Sheen sweep across the gloss on hover (≤400ms, --ease) */
	.btn-primary::after {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: -60%;
		width: 40%;
		background: linear-gradient(105deg, transparent, rgba(255,255,255,0.45), transparent);
		transform: skewX(-20deg);
		transition: left 400ms var(--ease);
		pointer-events: none;
	}

	.btn-primary:hover {
		box-shadow: 0 6px 28px rgba(255, 210, 63, 0.55);
		transform: translateY(-1px);
	}

	.btn-primary:hover::after {
		left: 120%;
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

	/* ═══ Teal = solid mint confirm (secondary-weight) ═══
	     Not a gold-primary — one loud action per page. Replaces the hand-rolled
	     .btn-primary clones in the lending/borrowed modals. */
	.btn-teal {
		background: var(--teal);
		color: var(--color-surface);
		box-shadow: 0 4px 16px rgba(79, 157, 136, 0.18);
		font-weight: var(--font-weight-semibold);
	}

	.btn-teal:hover {
		background: var(--teal-deep);
		box-shadow: 0 6px 24px rgba(79, 157, 136, 0.28);
		transform: translateY(-1px);
	}

	.btn-teal:active {
		transform: scale(0.95);
	}

	/* ═══ Ghost = Teal outline pill (quiet secondary) ═══
	     No glow at rest — the secondary stays quieter than the gold primary;
	     a faint teal glow appears only on hover. */
	.btn-ghost {
		background: transparent;
		color: var(--color-teal);
		border: 1px solid var(--color-teal);
		font-weight: var(--font-weight-semibold);
	}

	.btn-ghost:hover {
		background: var(--color-teal-bg);
		border-color: var(--color-teal-dark);
		box-shadow: var(--glow-card);
		transform: translateY(-1px);
	}

	.btn-ghost:hover svg {
		transform: translateY(1px);
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
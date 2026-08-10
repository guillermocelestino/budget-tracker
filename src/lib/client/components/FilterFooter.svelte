<script lang="ts">
	/**
	 * FilterFooter — the single shared footer for filter panels on /recurring,
	 * /lending and /borrowed. One primary action (Apply Filters) and one quiet
	 * ghost (Reset Filters). The host decides enablement; this component owns
	 * the tokens. DOM order is [Apply, Reset] so tab order matches the visual
	 * order in both the desktop row (Apply right, Reset left) and the stacked
	 * mobile sheet (Apply top, Reset below).
	 */
	let {
		canApply = false,
		canClear = false,
		onApply,
		onClear,
		mode = 'popover',
	}: {
		canApply?: boolean;
		canClear?: boolean;
		onApply?: () => void;
		onClear?: () => void;
		mode?: 'popover' | 'sheet';
	} = $props();
</script>

<div class="filter-footer" class:sheet={mode === 'sheet'}>
	<button class="ff-apply" disabled={!canApply} onclick={onApply} type="button">Apply Filters</button>
	<button class="ff-reset" disabled={!canClear} onclick={onClear} type="button">Reset Filters</button>
</div>

<style>
	.filter-footer {
		position: sticky;
		bottom: 0;
		z-index: 2;
		display: flex;
		flex-direction: row-reverse;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-sm);
		padding: var(--space-md) var(--space-lg);
		margin-top: var(--space-sm);
		border-top: 1px solid var(--line);
		background: var(--color-surface);
	}

	/* Apply — the single primary action: solid teal pill */
	.ff-apply {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 44px;
		padding: 10px 20px;
		border: none;
		border-radius: var(--radius-pill);
		background: var(--teal);
		color: var(--color-surface);
		font-family: var(--font-display);
		font-size: 15px;
		font-weight: 600;
		line-height: 1;
		cursor: pointer;
		box-shadow: 0 4px 16px rgba(79, 157, 136, 0.18);
		transition: background 140ms ease-out, box-shadow 140ms ease-out, transform 100ms ease-out;
		-webkit-tap-highlight-color: transparent;
	}

	.ff-apply:hover:not(:disabled) {
		background: var(--teal-deep);
		box-shadow: 0 4px 18px rgba(79, 157, 136, 0.22);
	}

	.ff-apply:active:not(:disabled) {
		transform: scale(0.97);
	}

	.ff-apply:focus-visible {
		outline: none;
		/* shared ring with a surface-coloured offset OUTSIDE so it reads on teal */
		box-shadow: 0 0 0 2px var(--color-surface), 0 0 0 4px var(--teal-deep);
	}

	.ff-apply:disabled {
		opacity: 0.6;
		pointer-events: none;
	}

	/* Reset — quiet ghost, never competes with Apply */
	.ff-reset {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 44px;
		padding: 10px 16px;
		border: none;
		border-radius: var(--radius-pill);
		background: transparent;
		color: var(--muted);
		font-family: var(--font-display);
		font-size: 15px;
		font-weight: 500;
		line-height: 1;
		cursor: pointer;
		transition: background 140ms ease-out, color 140ms ease-out, transform 100ms ease-out;
		-webkit-tap-highlight-color: transparent;
	}

	.ff-reset:hover:not(:disabled) {
		background: var(--mint-tint);
		color: var(--teal-deep);
	}

	.ff-reset:active:not(:disabled) {
		transform: scale(0.97);
	}

	.ff-reset:focus-visible {
		outline: 2px solid var(--teal-deep);
		outline-offset: 2px;
	}

	.ff-reset:disabled {
		opacity: 0.6;
		pointer-events: none;
	}

	/* Mobile bottom sheet — stacked full-width, Apply on top (DOM order) */
	.filter-footer.sheet {
		flex-direction: column;
		align-items: stretch;
	}

	.filter-footer.sheet .ff-apply,
	.filter-footer.sheet .ff-reset {
		width: 100%;
	}

	/* Narrow popover (<480px) — stacked too */
	@media (max-width: 479px) {
		.filter-footer {
			flex-direction: column;
			align-items: stretch;
		}

		.filter-footer .ff-apply,
		.filter-footer .ff-reset {
			width: 100%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.ff-apply,
		.ff-reset {
			transition: none;
			transform: none;
		}
	}
</style>

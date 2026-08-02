<script lang="ts">
	/**
	 * ListToolbar — a reusable two-zone control band for list pages.
	 *
	 * Left zone (snippet prop `filters`): flexible, wraps rightward as filters are added.
	 *   Search anchors at far-left and never moves; future status/date/interest/sort
	 *   pills append to its right.
	 * Right zone (snippet prop `views`): fixed-width cluster — density toggle, export, etc.
	 *
	 * The partition + left anchor are fixed forever, so adding features is an
	 * additive snippet drop, never a layout change. Bulk-action mode is an overlay,
	 * not a replacement of this toolbar.
	 */
	let {
		filters,
		views,
		sticky = false,
	}: {
		filters?: import('svelte').Snippet;
		views?: import('svelte').Snippet;
		sticky?: boolean;
	} = $props();
</script>

<div class="list-toolbar" class:sticky>
	{#if filters}
		<div class="toolbar-filters">
			{@render filters()}
		</div>
	{/if}
	{#if views}
		<div class="toolbar-views">
			{#if filters}
				<span class="toolbar-divider" aria-hidden="true"></span>
			{/if}
			{@render views()}
		</div>
	{/if}
</div>

<style>
	.list-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-lg);
		margin-top: var(--space-xl);
		margin-bottom: var(--space-md);
		min-width: 0;
	}

	.list-toolbar.sticky {
		position: sticky;
		top: 0;
		z-index: 20;
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-hairline);
		padding-top: var(--space-sm);
		padding-bottom: var(--space-sm);
		margin-top: 0;
		margin-bottom: var(--space-md);
	}

	/* Left zone: flexible, can grow rightward; children wrap on small screens. */
	.toolbar-filters {
		flex: 1 1 auto;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		flex-wrap: wrap;
	}

	/* Unified search+filter pill (SearchFilterPill) — desktop cap so it
	   reads as the anchor control without stretching the whole row. */
	.toolbar-filters :global(.search-filter-pill) {
		max-width: clamp(360px, 30vw, 420px);
	}

	/* Right zone: stable fixed cluster — density, export, etc. */
	.toolbar-views {
		flex: 0 0 auto;
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	/* Hairline partition between the filtering group (left) and the
	   presentation cluster (right) — makes the toolbar read as two
	   intentional zones instead of three loose controls. Desktop only. */
	.toolbar-divider {
		flex: 0 0 1px;
		height: 24px;
		align-self: center;
		background: var(--color-hairline);
		opacity: 0.8;
	}

	/* Mount stagger animation for children */
	.toolbar-filters > *,
	.toolbar-views > * {
		animation: fadeSlideIn 300ms var(--ease) both;
	}

	.toolbar-filters > *:nth-child(1) { animation-delay: calc(0 * 60ms); }
	.toolbar-filters > *:nth-child(2) { animation-delay: calc(1 * 60ms); }
	.toolbar-filters > *:nth-child(3) { animation-delay: calc(2 * 60ms); }
	.toolbar-filters > *:nth-child(4) { animation-delay: calc(3 * 60ms); }
	.toolbar-views > *:nth-child(1) { animation-delay: calc(4 * 60ms); }
	.toolbar-views > *:nth-child(2) { animation-delay: calc(5 * 60ms); }

	@keyframes fadeSlideIn {
		from { opacity: 0; transform: translateY(8px); }
		to { opacity: 1; transform: translateY(0); }
	}

	@media (prefers-reduced-motion: reduce) {
		.toolbar-filters > *,
		.toolbar-views > * {
			animation: none !important;
		}
	}

	/* Desktop row (≥901px): search, status, and view toggle share one 44px
	   centerline so the toolbar reads as a single composed control band.
	   Scoped to the non-wrapping row — tablet/mobile keep their own sizing. */
	@media (min-width: 901px) {
		.list-toolbar :global(.view-toggle) {
			min-height: 44px;
		}
	}

	/* Tablet / mobile: left zone children stack vertically.
	   Search becomes full-width first, then status, then density right-aligned. */
	@media (max-width: 900px) {
		.list-toolbar {
			flex-wrap: wrap;
			gap: var(--space-md);
		}

		.toolbar-divider {
			display: none;
		}

		.toolbar-filters {
			order: 1;
			flex-basis: calc(100% - 80px);
		}

		.toolbar-views {
			order: 2;
			flex-basis: 80px;
			justify-content: flex-end;
		}
	}

	@media (max-width: 767px) {
		.list-toolbar {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-md);
		}

		.toolbar-filters {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-sm);
			order: 1;
			flex-basis: auto;
		}

		.toolbar-views {
			order: 2;
			flex-basis: auto;
			justify-content: flex-end;
		}

		.toolbar-filters :global(.search-filter-pill) {
			max-width: none;
			width: 100%;
		}

		.list-toolbar.sticky {
			position: static;
			background: transparent;
			border-bottom: none;
			padding: 0;
		}
	}
</style>

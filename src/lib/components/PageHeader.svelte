<script lang="ts">
	let { title, subtitle, action, flush = false }: { title: string; subtitle?: import('svelte').Snippet; action?: import('svelte').Snippet; flush?: boolean } = $props();
</script>

<div class="page-header" class:flush={flush}>
	<div class="page-title-group">
		<h1 class="page-title">{title}</h1>
		{#if subtitle}
			<div class="page-subtitle">
				{@render subtitle()}
			</div>
		{/if}
	</div>
	{#if action}
		<div class="page-actions">
			{@render action()}
		</div>
	{/if}
</div>

<style>
	.page-header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-sm) var(--space-lg);
		margin-bottom: var(--space-lg);
		padding: var(--space-md) var(--space-lg);
		background: var(--color-cream);
		border: 3px dashed var(--color-teal);
		border-left: none;
		border-right: none;
		border-top: none;
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		border-radius: 0;
	}

	.page-title-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
	}

	.page-subtitle {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		font-weight: 400;
		line-height: 1.3;
	}

	.page-title {
		margin: 0;
		font-size: var(--font-size-xl);
		font-family: var(--font-display);
		font-weight: var(--font-weight-extrabold);
		color: var(--color-text);
		letter-spacing: var(--letter-spacing-heading);
		line-height: var(--line-height-tight);
	}

	.page-actions {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-sm);
		min-width: 0;
	}

	/* flush = align header content to the content rail (no extra horizontal inset) */
	.page-header.flush {
		padding-left: 0;
		padding-right: 0;
	}

	@media (max-width: 768px) {
		.page-header {
			position: sticky;
			top: 0;
			z-index: 10;
			padding: var(--space-sm) var(--space-md);
			margin-left: calc(-1 * var(--space-md));
			margin-right: calc(-1 * var(--space-md));
			margin-bottom: var(--space-md);
		}

		.page-header.flush {
			padding-left: var(--space-md);
			padding-right: var(--space-md);
		}

		.page-title {
			font-size: var(--font-size-lg);
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
	}
</style>

<script lang="ts">
	let {
		label = '',
		children,
	}: {
		label?: string;
		children?: import('svelte').Snippet;
	} = $props();
</script>

<div class="settings-section">
	{#if label}
		<h3 class="section-heading">{label}</h3>
	{/if}
	<div class="section-body">
		{@render children?.()}
	</div>
</div>

<style>
	.settings-section {
		margin-bottom: var(--space-xl);
	}

	.section-heading {
		font-family: var(--font-display);
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-bold);
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		margin-bottom: var(--space-md);
		padding-bottom: var(--space-xs);
		border-bottom: 2px dashed var(--color-hairline);
	}

	.section-body {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}
</style>

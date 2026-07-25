<script lang="ts">
	let { title, action }: { title: string; action?: import('svelte').Snippet } = $props();
</script>

<div class="page-header">
	<h1 class="page-title">{title}</h1>
	{#if action}
		<div class="page-actions">
			{@render action()}
		</div>
	{/if}
</div>

<style>
	.page-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--space-lg);
	}

	.page-title {
		margin: 0;
		font-size: var(--font-size-xl);
		color: var(--color-text);
	}

	.page-actions {
		display: flex;
		gap: var(--space-sm);
	}
</style>

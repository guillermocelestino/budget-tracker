<script lang="ts">
	let {
		icon = '📭',
		title = '',
		description = '',
		actionLabel = '',
		actionHref = '',
		onAction,
	}: {
		icon?: string;
		title?: string;
		description?: string;
		actionLabel?: string;
		actionHref?: string;
		onAction?: () => void;
	} = $props();
</script>

<div class="empty-state">
	<div class="empty-icon-box">
		<span class="empty-icon">{icon}</span>
	</div>
	{#if title}
		<h3 class="empty-title">{title}</h3>
	{/if}
	{#if description}
		<p class="empty-desc">{description}</p>
	{/if}
	{#if actionLabel && actionHref}
		<a href={actionHref} class="empty-action">
			{actionLabel}
		</a>
	{/if}
	{#if actionLabel && onAction}
		<button class="empty-action" onclick={onAction} type="button">
			{actionLabel}
		</button>
	{/if}
</div>

<style>
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--space-2xl) var(--space-lg);
		text-align: center;
		background: var(--color-surface);
		border: 1px dashed var(--color-hairline);
		border-radius: var(--radius-xl);
		gap: var(--space-sm);
		animation: fade-in-up 400ms var(--ease) both;
	}

	.empty-icon-box {
		width: 72px;
		height: 72px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-teal-bg);
		border-radius: var(--radius-lg);
		margin-bottom: var(--space-xs);
	}

	.empty-icon {
		font-size: 32px;
		line-height: 1;
	}

	.empty-title {
		font-family: var(--font-display);
		font-size: var(--font-size-base);
		font-weight: var(--font-weight-bold);
		color: var(--color-ink);
		margin: 0;
	}

	.empty-desc {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		margin: 0;
		max-width: 280px;
		line-height: 1.4;
	}

	.empty-action {
		margin-top: var(--space-sm);
		padding: var(--space-sm) var(--space-xl);
		background: linear-gradient(135deg, var(--color-gold), var(--color-gold-light));
		color: var(--color-ink);
		border: none;
		border-radius: var(--radius-pill);
		font-family: var(--font-display);
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-bold);
		cursor: pointer;
		text-decoration: none;
		min-height: 44px;
		display: inline-flex;
		align-items: center;
		box-shadow: var(--glow-gold);
		transition: all 200ms var(--bounce);
	}

	.empty-action:hover {
		transform: translateY(-1px);
		box-shadow: 0 6px 24px rgba(255, 210, 63, 0.5);
		text-decoration: none;
		color: var(--color-ink);
	}

	.empty-action:active {
		transform: scale(0.97);
	}

	@media (prefers-reduced-motion: reduce) {
		.empty-state { animation: none; }
	}
</style>

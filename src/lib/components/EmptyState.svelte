<script lang="ts">
	let {
		icon = '📭',
		title = '',
		description = '',
		actionLabel = '',
		actionHref = '',
		onAction,
		secondaryLabel = '',
		secondaryHref = '',
		onSecondaryAction,
	}: {
		icon?: string;
		title?: string;
		description?: string;
		actionLabel?: string;
		actionHref?: string;
		onAction?: () => void;
		secondaryLabel?: string;
		secondaryHref?: string;
		onSecondaryAction?: () => void;
	} = $props();
</script>

<div class="empty-state">
	{#if icon}
		<div class="empty-icon-box">
			<span class="empty-icon">{icon}</span>
		</div>
	{/if}
	{#if title}
		<h3 class="empty-title">{title}</h3>
	{/if}
	{#if description}
		<p class="empty-desc">{description}</p>
	{/if}
	<div class="empty-actions">
		{#if actionLabel && actionHref}
			<a href={actionHref} class="empty-action" onclick={onAction ? (e) => { e.preventDefault(); onAction(); } : undefined}>
				{actionLabel}
			</a>
		{/if}
		{#if actionLabel && onAction && !actionHref}
			<button class="empty-action" onclick={onAction} type="button">
				{actionLabel}
			</button>
		{/if}
		{#if secondaryLabel && secondaryHref}
			<a href={secondaryHref} class="empty-secondary">
				{secondaryLabel}
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
				</svg>
			</a>
		{:else if secondaryLabel && onSecondaryAction}
			<button class="empty-secondary" onclick={onSecondaryAction} type="button">
				{secondaryLabel}
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
				</svg>
			</button>
		{/if}
	</div>
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

	.empty-actions {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-sm);
		margin-top: var(--space-sm);
	}

	.empty-action {
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
		position: relative;
		overflow: hidden;
	}

	.empty-action::before {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, rgba(255,255,255,0.30) 0%, transparent 50%);
		border-radius: var(--radius-pill);
		pointer-events: none;
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

	.empty-secondary {
		font-size: var(--font-size-xs);
		color: var(--color-teal);
		text-decoration: none;
		font-weight: 600;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 4px 8px;
		border-radius: var(--radius-sm);
		transition: all 150ms var(--ease);
		min-height: 32px;
		border: none;
		background: transparent;
		font-family: var(--font-body);
		cursor: pointer;
	}

	.empty-secondary:hover {
		background: var(--color-teal-bg);
		gap: 6px;
		text-decoration: none;
		color: var(--color-teal-dark);
	}

	.empty-secondary svg {
		transition: transform 150ms var(--ease);
	}

	.empty-secondary:hover svg {
		transform: translateX(2px);
	}

	@media (prefers-reduced-motion: reduce) {
		.empty-state { animation: none; }
	}
</style>

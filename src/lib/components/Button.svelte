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
		border-radius: var(--radius-md);
		font-family: inherit;
		font-weight: 600;
		cursor: pointer;
		text-decoration: none;
		transition: background var(--transition-fast), opacity var(--transition-fast), transform var(--transition-fast);
		line-height: 1.4;
		min-height: 44px;
	}

	.btn:active {
		transform: scale(0.98);
	}

	.btn-sm {
		padding: var(--space-sm) var(--space-md);
		font-size: var(--font-size-sm);
	}

	.btn-md {
		padding: 12px var(--space-lg);
		font-size: var(--font-size-base);
	}

	.btn-primary {
		background: var(--color-primary);
		color: white;
	}

	.btn-primary:hover {
		background: var(--color-primary-hover);
	}

	.btn-danger {
		background: var(--color-expense);
		color: white;
	}

	.btn-danger:hover {
		background: var(--color-danger-hover);
	}

	.btn-ghost {
		background: var(--color-bg);
		color: var(--color-text);
		border: 1px solid var(--color-border);
	}

	.btn-ghost:hover {
		background: var(--color-border);
	}

	.btn-link {
		background: none;
		color: var(--color-primary);
		padding: var(--space-xs) var(--space-sm);
	}

	.btn-link:hover {
		text-decoration: underline;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.full-width {
		width: 100%;
	}
</style>
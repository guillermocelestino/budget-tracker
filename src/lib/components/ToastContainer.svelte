<script lang="ts">
	import { toastState, dismissToast } from '$lib/stores/toast.svelte';
</script>

<div class="toast-container">
	{#each [...toastState.items].reverse() as toast (toast.id)}
		<div class="toast toast-{toast.type}" class:toast-success={toast.type === 'success'} class:toast-error={toast.type === 'error'} class:toast-info={toast.type === 'info'} role="alert">
			<div class="toast-accent"></div>
			<div class="toast-body">
				<span class="toast-icon">
					{#if toast.type === 'success'}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>{/if}
					{#if toast.type === 'error'}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/></svg>{/if}
					{#if toast.type === 'info'}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/></svg>{/if}
				</span>
				<span class="toast-message">{toast.message}</span>
			</div>
			<button class="toast-close" onclick={() => dismissToast(toast.id)} aria-label="Close"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg></button>
			{#if toast.duration > 0}
				<div class="toast-progress" style="animation-duration: {toast.duration}ms"></div>
			{/if}
		</div>
	{/each}
</div>

<style>
	.toast-container {
		position: fixed;
		top: var(--space-lg);
		left: 50%;
		transform: translateX(-50%);
		z-index: 9999;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-sm);
		pointer-events: none;
	}

	.toast {
		pointer-events: auto;
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		padding-left: calc(var(--space-md) + 4px);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-card);
		color: var(--color-ink);
		font-size: var(--font-size-sm);
		font-weight: 500;
		min-width: 280px;
		max-width: 400px;
		position: relative;
		overflow: hidden;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		animation: toastIn 400ms var(--bounce);
	}

	.toast-accent {
		position: absolute;
		top: 0;
		left: 0;
		bottom: 0;
		width: 4px;
		border-radius: 2px 0 0 2px;
	}

	.toast-success .toast-accent {
		background: var(--color-teal);
	}
	.toast-success {
		box-shadow: var(--shadow-card), var(--glow-gold);
	}

	.toast-error .toast-accent {
		background: var(--color-coral);
	}
	.toast-error {
		box-shadow: var(--shadow-card), var(--glow-coral);
	}

	.toast-info .toast-accent {
		background: var(--color-sky);
	}
	.toast-info {
		box-shadow: var(--shadow-card), var(--glow-sky);
	}

	.toast-body {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		flex: 1;
	}

	.toast-icon {
		font-size: 1.2rem;
		flex-shrink: 0;
	}

	.toast-success .toast-icon { color: var(--color-teal); }
	.toast-error .toast-icon { color: var(--color-coral); }
	.toast-info .toast-icon { color: var(--color-sky); }

	.toast-message {
		flex: 1;
	}

	.toast-close {
		background: none;
		border: none;
		color: var(--color-text-muted);
		font-size: 1.25rem;
		cursor: pointer;
		padding: 0 0 0 var(--space-sm);
		opacity: 0.6;
		line-height: 1;
	}

	.toast-close:hover {
		opacity: 1;
	}

	.toast-progress {
		position: absolute;
		bottom: 0;
		left: 4px;
		right: 0;
		height: 2px;
		background: var(--color-hairline);
		animation: progressShrink linear forwards;
	}

	.toast-success .toast-progress { background: var(--color-teal); opacity: 0.3; }
	.toast-error .toast-progress { background: var(--color-coral); opacity: 0.3; }
	.toast-info .toast-progress { background: var(--color-sky); opacity: 0.3; }

	@keyframes toastIn {
		from {
			transform: translateY(-24px) scale(0.96);
			opacity: 0;
		}
		to {
			transform: translateY(0) scale(1);
			opacity: 1;
		}
	}

	@keyframes progressShrink {
		from { width: 100%; }
		to { width: 0%; }
	}

	@media (max-width: 480px) {
		.toast-container {
			left: var(--space-md);
			right: var(--space-md);
			transform: none;
		}

		.toast {
			min-width: 0;
			max-width: none;
		}
	}
</style>

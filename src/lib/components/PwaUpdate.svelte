<script lang="ts">
	import { onMount } from 'svelte';

	let needRefresh = $state(false);
	let offlineReady = $state(false);

	let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | undefined = $state();

	onMount(() => {
		import('virtual:pwa-register/svelte').then(({ useRegisterSW }) => {
			const sw = useRegisterSW();

			updateServiceWorker = sw.updateServiceWorker.bind(sw);

			const unsubNeedRefresh = sw.needRefresh.subscribe((v) => {
				needRefresh = v;
			});
			const unsubOfflineReady = sw.offlineReady.subscribe((v) => {
				offlineReady = v;
			});

			return () => {
				unsubNeedRefresh();
				unsubOfflineReady();
			};
		});
	});

	function handleRefresh() {
		updateServiceWorker?.(true);
	}

	function handleDismiss() {
		updateServiceWorker?.(false);
		// Force dismiss locally in case store doesn't update reactively
		needRefresh = false;
		offlineReady = false;
	}
</script>

{#if needRefresh}
	<div class="pwa-toast" role="alert">
		<div class="pwa-message">
			<span class="pwa-icon">{'📦'}</span>
			<div>
				<strong>Update available</strong>
				<p>A new version of Finance Tracker is ready.</p>
			</div>
		</div>
		<div class="pwa-buttons">
			<button class="pwa-btn pwa-btn-primary" onclick={handleRefresh}>Refresh</button>
			<button class="pwa-btn pwa-btn-secondary" onclick={handleDismiss}>Dismiss</button>
		</div>
	</div>
{:else if offlineReady}
	<div class="pwa-toast" role="status">
		<div class="pwa-message">
			<span class="pwa-icon">{'✅'}</span>
			<div>
				<strong>Ready offline</strong>
				<p>Finance Tracker can now work without internet.</p>
			</div>
		</div>
		<button class="pwa-btn pwa-btn-secondary" onclick={handleDismiss}>Got it</button>
	</div>
{/if}

<style>
	.pwa-toast {
		position: fixed;
		bottom: var(--space-lg);
		right: var(--space-lg);
		z-index: 9999;
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		padding: var(--space-md) var(--space-lg);
		background: var(--color-surface);
		color: var(--color-text);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		max-width: 360px;
		animation: slideUp 0.3s ease-out;
	}

	.pwa-message {
		display: flex;
		gap: var(--space-sm);
		align-items: flex-start;
	}

	.pwa-message p {
		margin: var(--space-xs) 0 0;
		font-size: var(--font-size-sm);
		opacity: 0.8;
	}

	.pwa-icon {
		font-size: 1.5rem;
		flex-shrink: 0;
	}

	.pwa-buttons {
		display: flex;
		gap: var(--space-xs);
		justify-content: flex-end;
	}

	.pwa-btn {
		padding: var(--space-xs) var(--space-md);
		border-radius: var(--radius-sm);
		font-size: var(--font-size-sm);
		font-weight: 500;
		cursor: pointer;
		border: none;
		transition: opacity 0.15s;
	}

	.pwa-btn:hover {
		opacity: 0.9;
	}

	.pwa-btn-primary {
		background: var(--color-primary);
		color: #fff;
	}

	.pwa-btn-secondary {
		background: transparent;
		color: var(--color-text);
		border: 1px solid var(--color-border);
	}

	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(1rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (max-width: 480px) {
		.pwa-toast {
			left: var(--space-md);
			right: var(--space-md);
			bottom: var(--space-md);
			max-width: none;
		}
	}
</style>

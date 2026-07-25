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
				<p>A new version of Budget Tracker is ready.</p>
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
				<p>Budget Tracker can now work without internet.</p>
			</div>
		</div>
		<button class="pwa-btn pwa-btn-secondary" onclick={handleDismiss}>Got it</button>
	</div>
{/if}

<style>
	.pwa-toast {
		position: fixed;
		bottom: var(--space-lg, 1rem);
		right: var(--space-lg, 1rem);
		z-index: 9999;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem 1.25rem;
		background: var(--color-surface, #1e293b);
		color: var(--color-text, #f1f5f9);
		border: 1px solid var(--color-border, #334155);
		border-radius: 0.75rem;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
		max-width: 360px;
		animation: slideUp 0.3s ease-out;
	}

	.pwa-message {
		display: flex;
		gap: 0.75rem;
		align-items: flex-start;
	}

	.pwa-message p {
		margin: 0.25rem 0 0;
		font-size: 0.875rem;
		opacity: 0.8;
	}

	.pwa-icon {
		font-size: 1.5rem;
		flex-shrink: 0;
	}

	.pwa-buttons {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}

	.pwa-btn {
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		border: none;
		transition: opacity 0.15s;
	}

	.pwa-btn:hover {
		opacity: 0.9;
	}

	.pwa-btn-primary {
		background: var(--color-primary, #3b82f6);
		color: #fff;
	}

	.pwa-btn-secondary {
		background: transparent;
		color: var(--color-text, #f1f5f9);
		border: 1px solid var(--color-border, #475569);
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
			left: var(--space-md, 0.75rem);
			right: var(--space-md, 0.75rem);
			bottom: var(--space-md, 0.75rem);
			max-width: none;
		}
	}
</style>

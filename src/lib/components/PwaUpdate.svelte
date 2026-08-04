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
		<div class="pwa-accent"></div>
		<div class="pwa-message">
			<span class="pwa-icon">⚡</span>
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
	<div class="pwa-toast offline-toast" role="status">
		<div class="pwa-accent"></div>
		<div class="pwa-message">
			<span class="pwa-icon">📦</span>
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
		padding-left: calc(var(--space-lg) + 4px);
		background: var(--color-cream);
		color: var(--color-ink);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-card), var(--glow-sky);
		max-width: 360px;
		position: relative;
		overflow: hidden;
		animation: pwaSlideUp 400ms var(--bounce);
	}

	.pwa-accent {
		position: absolute;
		top: 0;
		left: 0;
		bottom: 0;
		width: 4px;
		background: var(--color-sky);
	}

	.offline-toast .pwa-accent {
		background: var(--color-teal);
	}

	.pwa-message {
		display: flex;
		gap: var(--space-sm);
		align-items: flex-start;
	}

	.pwa-message p {
		margin: var(--space-xs) 0 0;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
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
		border-radius: var(--radius-pill);
		font-size: var(--font-size-sm);
		font-weight: 600;
		cursor: pointer;
		border: none;
		font-family: var(--font-body);
		transition: all var(--transition-fast);
		min-height: 36px;
	}

	.pwa-btn-primary {
		background: var(--color-sky);
		color: #fff;
	}

	.pwa-btn-primary:hover {
		background: var(--color-sky-light);
		transform: scale(1.03);
	}

	.pwa-btn-secondary {
		background: transparent;
		color: var(--color-ink);
		border: 1px solid var(--color-border);
	}

	.pwa-btn-secondary:hover {
		background: var(--color-teal-bg);
		border-color: var(--color-teal);
	}

	@keyframes pwaSlideUp {
		from {
			opacity: 0;
			transform: translateY(1rem) scale(0.97);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
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

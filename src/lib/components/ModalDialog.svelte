<script lang="ts">
	import { tick } from 'svelte';

	let { open = false, title = 'Confirm', onclose, children, size = 'default' }: {
		open?: boolean;
		title?: string;
		onclose?: () => void;
		children?: import('svelte').Snippet;
		size?: 'default' | 'wide';
	} = $props();

	let modalCard = $state<HTMLElement | null>(null);

	function close() {
		onclose?.();
	}

	function handleBackdrop(e: MouseEvent) {
		if (e.target === e.currentTarget) close();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			close();
			return;
		}
		if (e.key === 'Tab' && modalCard) {
			const focusable = modalCard.querySelectorAll<HTMLElement>(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			);
			if (focusable.length === 0) return;
			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		}
	}

	$effect(() => {
		if (open) {
			tick().then(() => {
				const firstFocusable = modalCard?.querySelector<HTMLElement>(
					'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
				);
				firstFocusable?.focus();
			});
		}
	});
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions a11y_interactive_supports_focus -->
	<div class="modal-backdrop" tabindex="-1" onclick={handleBackdrop} role="dialog" aria-modal="true" aria-label={title}>
		<div class="modal-card {size === 'wide' ? 'modal-card-wide' : ''}" bind:this={modalCard}>
			<div class="modal-ribbon"></div>
			<div class="modal-header">
				<h3 class="modal-title">{title}</h3>
				<button class="modal-close" onclick={close} aria-label="Close">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="18" x2="6" y1="6" y2="18"/>
					<line x1="6" x2="18" y1="6" y2="18"/>
				</svg>
			</button>
			</div>
			<div class="modal-body">
				{@render children?.()}
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(20, 48, 46, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: var(--space-md);
	}

	.modal-card {
		background: var(--color-cream);
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-card);
		min-width: 320px;
		max-width: 500px;
		width: 100%;
		position: relative;
		overflow: hidden;
		animation: modal-in 300ms var(--bounce);
		border: 1px solid var(--color-border);
	}

	.modal-card-wide {
		max-width: 720px;
		max-height: calc(100dvh - 32px);
	}

	.modal-card-wide .modal-body {
		overflow-y: auto;
		max-height: calc(100dvh - 200px);
	}

	.modal-ribbon {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 3px;
		background: linear-gradient(90deg, var(--color-teal), var(--color-gold));
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-md) var(--space-lg);
		padding-top: calc(var(--space-md) + 3px);
		border-bottom: 1px dashed var(--color-border);
	}

	.modal-title {
		margin: 0;
		font-size: var(--font-size-lg);
		font-weight: 700;
		color: var(--color-ink);
		font-family: var(--font-display);
		letter-spacing: var(--letter-spacing-tight);
	}

	.modal-close {
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		color: var(--color-text-muted);
		padding: 0;
		line-height: 1;
		transition: transform var(--transition-fast);
	}

	.modal-close:hover {
		color: var(--color-ink);
		transform: rotate(90deg);
	}

	.modal-body {
		padding: var(--space-lg);
	}

	@keyframes modal-in {
		from {
			opacity: 0;
			transform: scale(0.92) translateY(10px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}
</style>

<script lang="ts">
	import { tick } from 'svelte';

	let { open = false, title = 'Confirm', onclose, children, size = 'default', icon, subtitle }: {
		open?: boolean;
		title?: string;
		onclose?: () => void;
		children?: import('svelte').Snippet;
		size?: 'default' | 'wide';
		icon?: import('svelte').Snippet;
		subtitle?: string;
	} = $props();

	let modalCard = $state<HTMLElement | null>(null);
	let dragY = $state(0);
	let isDragging = $state(false);
	let startY = 0;
	let lastY = 0;
	let lastTime = 0;
	let velocityY = 0;

	function close() {
		dragY = 0;
		isDragging = false;
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

	/* ─── Mobile Drag-to-Dismiss Gesture (1:1 tracking + velocity handoff) ─── */
	function onPointerDown(e: PointerEvent) {
		// Only trigger sheet drag on mobile screens
		if (window.innerWidth > 640) return;

		const target = e.target as HTMLElement;
		// Don't intercept clicks inside inputs, buttons, or scrollable form controls
		if (target.closest('button, input, select, textarea, a')) return;

		isDragging = true;
		startY = e.clientY;
		lastY = e.clientY;
		lastTime = performance.now();
		velocityY = 0;

		if (modalCard) {
			modalCard.setPointerCapture(e.pointerId);
		}
	}

	function onPointerMove(e: PointerEvent) {
		if (!isDragging) return;

		const now = performance.now();
		const dt = now - lastTime;
		const dy = e.clientY - startY;

		// Only allow dragging downward (sheet pull down)
		if (dy > 0) {
			dragY = dy;
			if (dt > 0) {
				velocityY = (e.clientY - lastY) / dt; // px/ms
			}
		} else {
			dragY = dy * 0.2; // Rubberband resistance when dragging up
		}

		lastY = e.clientY;
		lastTime = now;
	}

	function onPointerUp(e: PointerEvent) {
		if (!isDragging) return;
		isDragging = false;

		if (modalCard && modalCard.hasPointerCapture(e.pointerId)) {
			modalCard.releasePointerCapture(e.pointerId);
		}

		// Dismiss if pulled down past 100px OR flicked downward with velocity
		if (dragY > 100 || velocityY > 0.4) {
			close();
		} else {
			// Spring back to top
			dragY = 0;
		}
	}

	$effect(() => {
		if (open) {
			dragY = 0;
			isDragging = false;
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
		<div
			class="modal-card {size === 'wide' ? 'modal-card-wide' : ''}"
			class:dragging={isDragging}
			bind:this={modalCard}
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerUp}
			style={dragY > 0 ? `transform: translateY(${dragY}px)` : dragY < 0 ? `transform: translateY(${dragY}px)` : ''}
		>
			<!-- Mobile sheet drag handle -->
			<div class="sheet-grab-bar" aria-hidden="true">
				<div class="sheet-grab-handle"></div>
			</div>

			<div class="modal-header">
				<div class="modal-heading">
					{#if icon}
						{@render icon()}
					{/if}
					<div class="modal-heading-text">
						<h3 class="modal-title">{title}</h3>
						{#if subtitle}
							<p class="modal-subtitle">{subtitle}</p>
						{/if}
					</div>
				</div>
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
		background: rgba(10, 20, 18, 0.45);
		backdrop-filter: blur(20px) saturate(180%);
		-webkit-backdrop-filter: blur(20px) saturate(180%);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: var(--z-modal, 1000);
		padding: var(--space-md);
		animation: backdrop-fade 250ms ease-out;
	}

	[data-theme="dark"] .modal-backdrop {
		background: rgba(0, 0, 0, 0.65);
	}

	@keyframes backdrop-fade {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.sheet-grab-bar {
		display: none;
		justify-content: center;
		padding: 10px 0 2px;
		cursor: grab;
	}

	.sheet-grab-handle {
		width: 36px;
		height: 5px;
		border-radius: 999px;
		background: var(--color-hairline, rgba(0, 0, 0, 0.2));
	}

	[data-theme="dark"] .sheet-grab-handle {
		background: rgba(255, 255, 255, 0.25);
	}

	.modal-card {
		background: var(--color-surface);
		border-radius: var(--radius-2xl, 24px);
		box-shadow: 0 20px 48px rgba(0, 0, 0, 0.18), 0 2px 10px rgba(0, 0, 0, 0.08);
		min-width: 320px;
		max-width: 500px;
		width: 100%;
		position: relative;
		overflow: hidden;
		animation: modal-spring-in 350ms cubic-bezier(0.16, 1, 0.3, 1);
		border: 1px solid var(--color-hairline, rgba(20, 48, 46, 0.12));
		transition: transform 250ms cubic-bezier(0.16, 1, 0.3, 1);
		touch-action: none;
	}

	[data-theme="dark"] .modal-card {
		border-color: rgba(255, 255, 255, 0.12);
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6), 0 2px 12px rgba(0, 0, 0, 0.3);
	}

	.modal-card.dragging {
		transition: none !important;
	}

	.modal-card-wide {
		max-width: 720px;
		max-height: calc(100dvh - 32px);
	}

	.modal-card-wide .modal-body {
		overflow-y: auto;
		max-height: calc(100dvh - 200px);
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-sm);
		padding: var(--space-md) var(--space-lg);
		border-bottom: 1px solid var(--color-hairline, rgba(20, 48, 46, 0.1));
	}

	.modal-heading {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		min-width: 0;
	}

	.modal-heading-text {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}

	.modal-title {
		margin: 0;
		font-size: var(--font-size-lg);
		font-weight: 700;
		color: var(--color-ink);
		font-family: var(--font-display);
		letter-spacing: var(--letter-spacing-tight);
	}

	.modal-subtitle {
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	.modal-close {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: rgba(20, 48, 46, 0.06);
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		color: var(--color-text-muted);
		padding: 0;
		transition: all 180ms cubic-bezier(0.2, 0, 0, 1);
		-webkit-tap-highlight-color: transparent;
	}

	[data-theme="dark"] .modal-close {
		background: rgba(255, 255, 255, 0.08);
	}

	.modal-close:hover {
		color: var(--color-ink);
		background: rgba(20, 48, 46, 0.12);
		transform: scale(1.05);
	}

	.modal-close:active {
		transform: scale(0.92);
	}

	.modal-body {
		padding: var(--space-lg);
	}

	@keyframes modal-spring-in {
		from {
			opacity: 0;
			transform: scale(0.92) translateY(16px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	/* ── Mobile Apple-style Bottom Sheet ── */
	@media (max-width: 640px) {
		.modal-backdrop {
			padding: 0;
			align-items: flex-end;
		}

		.sheet-grab-bar {
			display: flex;
		}

		.modal-card {
			max-width: 100vw;
			border-radius: 28px 28px 0 0;
			border-bottom: none;
			border-left: none;
			border-right: none;
			max-height: 90dvh;
			animation: sheet-spring-up 380ms cubic-bezier(0.16, 1, 0.3, 1);
		}

		@keyframes sheet-spring-up {
			from {
				transform: translateY(100%);
			}
			to {
				transform: translateY(0);
			}
		}
	}
</style>

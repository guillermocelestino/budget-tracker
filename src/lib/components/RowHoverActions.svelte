<script lang="ts">
	import type { Snippet } from 'svelte';

	type RowAction = {
		id: string;
		label: string; // tooltip text + aria-label
		text?: string; // if set → labeled pill (e.g. "Mark Paid"); else icon button
		icon?: Snippet;
		onClick: () => void;
		tone?: 'danger';
		hideBelow?: 'lg' | 'md'; // responsive drop (mirrors Recurring 1099/899px)
	};

	let {
		actions = [] as RowAction[]
	}: {
		actions: RowAction[];
	} = $props();

	// First danger-tone action index — a hairline divider renders immediately
	// before it, so destructive actions read as a separate zone, not a fourth
	// sibling. -1 when there is no danger action (e.g. Recurring) → no divider.
	const firstDangerIndex = $derived(actions.findIndex((a) => a.tone === 'danger'));

	/* ── Quick-action tooltips ──
	   Pointer shows a tooltip after a 250ms intent delay; keyboard focus-visible
	   shows it instantly. Hidden on leave / blur / Escape / scroll. Edge-aware:
	   flips below when it would clip the viewport top, and is clamped to stay
	   ≥8px inside the viewport. Never triggered by row hover alone. */
	let tipTimer: ReturnType<typeof setTimeout> | undefined;
	let activeTipEl: HTMLElement | null = null;
	let tipTrigger: 'pointer' | 'focus' | null = null;

	function hideTip() {
		clearTimeout(tipTimer);
		tipTimer = undefined;
		if (activeTipEl) {
			activeTipEl.classList.remove('show');
			activeTipEl = null;
		}
		tipTrigger = null;
	}

	function hideTipByPointer() {
		clearTimeout(tipTimer);
		tipTimer = undefined;
		if (!activeTipEl) {
			tipTrigger = null;
			return;
		}
		// A keyboard-shown tooltip stays until blur — mouse movement must not hide it.
		if (tipTrigger === 'focus') return;
		activeTipEl.classList.remove('show');
		activeTipEl = null;
		tipTrigger = null;
	}

	function scheduleTip(btn: HTMLButtonElement, instant: boolean) {
		clearTimeout(tipTimer);
		tipTimer = undefined;
		const tip = btn.parentElement?.querySelector<HTMLElement>('.quick-tip');
		if (!tip) return;
		const show = () => {
			if (activeTipEl && activeTipEl !== tip) activeTipEl.classList.remove('show');
			activeTipEl = tip;
			tipTrigger = instant ? 'focus' : 'pointer';
			tip.classList.add('show');
			positionTip(tip, btn);
		};
		if (instant) show();
		else tipTimer = setTimeout(show, 250);
	}

	// Host-agnostic: clamps to the viewport instead of an enclosing card.
	function positionTip(tip: HTMLElement, btn: HTMLButtonElement) {
		requestAnimationFrame(() => {
			const pad = 8;
			const tipRect = tip.getBoundingClientRect();
			const btnRect = btn.getBoundingClientRect();
			// Flip below when the pill would clip the viewport top.
			const flip = btnRect.top - tipRect.height - 6 < pad;
			tip.classList.toggle('flip', flip);
			let dx = 0;
			if (tipRect.left < pad) dx = pad - tipRect.left;
			else if (tipRect.right > window.innerWidth - pad) dx = window.innerWidth - pad - tipRect.right;
			tip.style.transform = dx !== 0 ? `translateX(calc(-50% + ${dx}px))` : '';
		});
	}
</script>

{#if actions.length > 0}
	<div class="hover-actions">
		{#each actions as a, i (a.id)}
			{#if a.tone === 'danger' && firstDangerIndex === i && i > 0}
				<span class="quick-divider" aria-hidden="true"></span>
			{/if}
			<div
				class="quick-btn-wrap"
				data-action={a.id}
				class:hide-lg={a.hideBelow === 'lg'}
				class:hide-md={a.hideBelow === 'md'}
			>
				<button
					class="quick-btn"
					class:pill={!!a.text}
					class:tone-danger={a.tone === 'danger'}
					aria-label={a.label}
					onclick={(e) => {
						e.stopPropagation();
						a.onClick();
					}}
					onpointerenter={(e) => scheduleTip(e.currentTarget, false)}
					onpointerleave={hideTipByPointer}
					onfocus={(e) => {
						if (e.currentTarget.matches(':focus-visible')) scheduleTip(e.currentTarget, true);
					}}
					onblur={hideTip}
					type="button"
				>
					{#if a.text}
						<span class="quick-btn-label">{a.text}</span>
					{:else if a.icon}
						{@render a.icon()}
					{/if}
				</button>
				<span class="quick-tip">{a.label}</span>
			</div>
		{/each}
	</div>
{/if}

<!-- Hide tooltips on Escape (discard) and on scroll (never leave a stale pill) -->
<svelte:window onkeydown={(e) => { if (e.key === 'Escape') hideTip(); }} onscroll={hideTip} />

<style>
	/* Reserved quick-action cluster — empty at rest (opacity 0, pointer-events
	   none) so nothing shifts; revealed on [data-hover-row] hover / focus. */
	.hover-actions {
		display: flex;
		align-items: center;
		gap: 4px;
		opacity: 0;
		transform: translateX(4px);
		pointer-events: none;
		transition: opacity 140ms ease-out, transform 140ms ease-out;
	}

	.quick-btn-wrap {
		position: relative;
	}

	/* Hairline divider before the first destructive action — 1px × 16px with a
	   symmetric 8px/8px zone (flex gap 4px + margin-inline 4px each side), so
	   delete reads as its own zone, not a fourth sibling. */
	.quick-divider {
		width: 1px;
		height: 16px;
		flex-shrink: 0;
		background: var(--line);
		margin-inline: 4px;
	}

	/* One identical 44px footprint per quick action: the visible tile (radius
	   10px) always fills it — transparent at rest, mint tile on hover/focus. */
	.quick-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		flex-shrink: 0;
		border: none;
		border-radius: 10px;
		background: transparent;
		color: var(--muted);
		cursor: default;
		transition: background 140ms ease-out, color 140ms ease-out;
		-webkit-tap-highlight-color: transparent;
	}

	.quick-btn:hover,
	.quick-btn:focus-visible {
		background: var(--mint-tint);
		color: var(--teal-deep);
	}

	/* Shared focus ring token (keyboard focus only) */
	.quick-btn:focus-visible {
		outline: none;
		box-shadow: var(--focus);
	}

	.quick-btn svg {
		width: 18px;
		height: 18px;
	}

	/* Labeled pill action (e.g. "Mark Paid") — solid teal, prominent */
	.quick-btn.pill {
		width: auto;
		padding: 0 16px;
		border-radius: var(--radius-pill);
		background: var(--teal);
		color: var(--color-surface);
		font-family: var(--font-body);
		font-size: 13px;
		font-weight: 600;
	}

	.quick-btn.pill:hover,
	.quick-btn.pill:focus-visible {
		background: var(--teal-deep);
		color: var(--color-surface);
	}

	.quick-btn-label {
		white-space: nowrap;
	}

	/* Destructive tone */
	.quick-btn.tone-danger:hover,
	.quick-btn.tone-danger:focus-visible {
		background: var(--rose-soft);
		color: var(--rose);
	}

	/* Per-button tooltip — anchored to its own button, centered above the glyph */
	.quick-tip {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		bottom: calc(100% + 6px);
		white-space: nowrap;
		pointer-events: none;
		z-index: 60;
		background: var(--ink);
		color: var(--color-surface);
		font-family: var(--font-body);
		font-size: 12px;
		font-weight: 500;
		line-height: 1;
		border-radius: 8px;
		padding: 4px 10px;
		opacity: 0;
		visibility: hidden;
		transition: opacity 140ms ease-out, visibility 0s linear 140ms;
	}

	.quick-tip.show {
		opacity: 1;
		visibility: visible;
		transition: opacity 140ms ease-out;
	}

	/* Edge-aware flip (JS drives it; host-agnostic) */
	.quick-tip.flip {
		top: calc(100% + 6px);
		bottom: auto;
	}

	/* Hover / focus gating — hover-capable pointers only. The row tints first
	   (no delay); the cluster fades in 70ms later. */
	@media (hover: hover) and (pointer: fine) {
		:global([data-hover-row]:hover) .hover-actions,
		:global([data-hover-row]:focus-within) .hover-actions {
			opacity: 1;
			transform: translateX(0);
			pointer-events: auto;
			transition-delay: 70ms;
		}
	}

	/* Narrow desktop: drop actions in the same order Recurring uses. */
	@media (max-width: 1099px) {
		.quick-btn-wrap.hide-lg {
			display: none;
		}
	}

	@media (max-width: 899px) {
		.quick-btn-wrap.hide-md {
			display: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.hover-actions,
		.quick-tip {
			transition: none;
		}
	}
</style>

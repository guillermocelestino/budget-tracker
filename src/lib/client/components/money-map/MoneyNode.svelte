<script lang="ts">
	import { formatCurrency } from '$lib/client/utils/format';

	export interface MoneyNodeProps {
		id: string;
		type: 'net' | 'income' | 'expense' | 'lending' | 'recurring';
		title: string;
		amount: number;
		serialTag: string;
		x: number;
		y: number;
		rotation?: number; // degrees e.g. -2 to 3
		percentage?: number;
		subtext?: string;
		color?: string;
		isCentral?: boolean;
		isHighlighted?: boolean;
		isDimmed?: boolean;
		isSelected?: boolean;
		onselect?: (id: string) => void;
		ondragstart?: (e: PointerEvent, id: string) => void;
		onhover?: (id: string | null) => void;
	}

	let {
		id,
		type,
		title,
		amount,
		serialTag,
		x,
		y,
		rotation = 0,
		percentage,
		subtext,
		color,
		isCentral = false,
		isHighlighted = false,
		isDimmed = false,
		isSelected = false,
		onselect,
		ondragstart,
		onhover
	}: MoneyNodeProps = $props();

	function handlePointerDown(e: PointerEvent) {
		if (ondragstart) {
			ondragstart(e, id);
		}
	}

	function handleClick() {
		if (onselect) {
			onselect(id);
		}
	}

	function handlePointerEnter() {
		if (onhover) {
			onhover(id);
		}
	}

	function handlePointerLeave() {
		if (onhover) {
			onhover(null);
		}
	}

	const nodeIcon = $derived.by(() => {
		switch (type) {
			case 'net':
				return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`;
			case 'income':
				return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`;
			case 'expense':
				return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg>`;
			case 'lending':
				return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m20.42 4.58-7.65 7.65-2.12-2.12a1.5 1.5 0 0 0-2.12 2.12l3.54 3.54a1.5 1.5 0 0 0 2.12-2.12L12 12"/><path d="m8.58 15.42-3.54 3.54"/></svg>`;
			case 'recurring':
				return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
		}
	});
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
<!-- LAYER 1: Position Container (owns translate3d(x, y, 0), fixed hit area, pointer events) -->
<div
	class="banknote-position-layer node-type-{type}"
	class:is-central={isCentral}
	class:is-highlighted={isHighlighted}
	class:is-dimmed={isDimmed}
	class:is-selected={isSelected}
	style="transform: translate3d({x}px, {y}px, 0);"
	onpointerdown={handlePointerDown}
	onclick={handleClick}
	onpointerenter={handlePointerEnter}
	onpointerleave={handlePointerLeave}
	role="button"
	tabindex="0"
	aria-label="{title} {formatCurrency(amount)}"
>
	<!-- LAYER 2: Floating Animation Wrapper (owns translateY float animation ONLY) -->
	<div class="banknote-float-layer">
		<!-- LAYER 3: Rotation Wrapper (owns rotate(rotation) ONLY) -->
		<div class="banknote-rotate-layer" style="transform: rotate({rotation}deg);">
			<!-- LAYER 4: Hover & Card Design Layer (owns scale(1.025) + glow + border + pattern ONLY) -->
			<div class="banknote-hover-layer node-card-{type}">
				<!-- Guilloche security background pattern overlay -->
				<div class="banknote-pattern"></div>

				<!-- Inner decorative frame border -->
				<div class="inner-frame">
					<!-- Top Row: Currency Seal + Serial Tag + Type Badge -->
					<div class="note-header">
						<div class="seal-badge" style={color ? `background: ${color}20; color: ${color};` : ''}>
							<!-- eslint-disable-next-line svelte/no-at-html-tags -->
							{@html nodeIcon}
						</div>
						<span class="serial-tag">{serialTag}</span>
						<span class="type-label">{title}</span>
					</div>

					<!-- Middle: Prominent Amount -->
					<div class="note-body">
						<div class="currency-symbol">₱</div>
						<div class="amount-val">
							{formatCurrency(amount).replace('₱', '')}
						</div>
					</div>

					<!-- Bottom Row: Subtext / Metadata -->
					<div class="note-footer">
						{#if percentage !== undefined && percentage > 0}
							<span class="meta-pill">{percentage}% of total</span>
						{:else if subtext}
							<span class="meta-pill">{subtext}</span>
						{:else}
							<span class="meta-pill">{type.toUpperCase()}</span>
						{/if}
						<div class="flip7-stamp">FLIP7</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	/* LAYER 1: Outer Position Container — positioning & hit area ONLY */
	.banknote-position-layer {
		position: absolute;
		left: 0;
		top: 0;
		width: 185px;
		height: 92px;
		user-select: none;
		cursor: grab;
		will-change: transform;
		z-index: 10;
		touch-action: none;
		transition: opacity 200ms ease, filter 200ms ease;
	}

	.banknote-position-layer.is-central {
		width: 250px;
		height: 120px;
		z-index: 30;
	}

	.node-type-lending,
	.node-type-recurring {
		width: 170px;
		height: 84px;
	}

	.banknote-position-layer:active {
		cursor: grabbing;
	}

	.banknote-position-layer.is-highlighted {
		z-index: 40 !important;
	}

	.banknote-position-layer.is-dimmed {
		opacity: 0.25;
		filter: grayscale(40%);
	}

	/* LAYER 2: Floating Animation Layer — translateY float animation ONLY */
	.banknote-float-layer {
		width: 100%;
		height: 100%;
		position: relative;
		animation: floatNote 6s ease-in-out infinite alternate;
	}

	@keyframes floatNote {
		0% {
			transform: translateY(0px);
		}
		100% {
			transform: translateY(-5px);
		}
	}

	/* LAYER 3: Rotation Wrapper — inline rotate(deg) ONLY */
	.banknote-rotate-layer {
		width: 100%;
		height: 100%;
		position: relative;
	}

	/* LAYER 4: Inner Hover & Card Layer — card visual design, border, pattern, hover scale & glow ONLY */
	.banknote-hover-layer {
		width: 100%;
		height: 100%;
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-hairline);
		box-shadow: var(--shadow-card);
		transition: transform 180ms var(--ease), box-shadow 200ms ease;
		position: relative;
		overflow: hidden;
	}

	/* Card Type Borders & Accent Colors */
	.node-card-net {
		background: linear-gradient(135deg, var(--color-surface) 0%, rgba(255, 210, 63, 0.12) 100%);
		border: 2px solid var(--color-gold);
		box-shadow: var(--glow-gold), 0 8px 28px rgba(255, 210, 63, 0.35);
	}

	.node-card-income {
		border-left: 5px solid var(--color-teal);
	}
	.node-card-expense {
		border-left: 5px solid var(--color-coral);
	}
	.node-card-lending {
		border-left: 5px solid var(--color-sky);
	}
	.node-card-recurring {
		border-left: 5px solid var(--color-teal-light);
	}

	/* Hover & Selection states operating strictly on Layer 4 */
	.banknote-position-layer:hover .banknote-hover-layer,
	.banknote-position-layer.is-highlighted .banknote-hover-layer {
		transform: scale(1.025) translateZ(0);
		box-shadow: 0 10px 32px rgba(0, 0, 0, 0.22), var(--glow-card);
	}

	.banknote-position-layer.is-central:hover .banknote-hover-layer,
	.banknote-position-layer.is-central.is-highlighted .banknote-hover-layer {
		transform: scale(1.03) translateZ(0);
		box-shadow: 0 12px 42px rgba(255, 210, 63, 0.5), var(--glow-gold);
	}

	.banknote-position-layer.is-selected .banknote-hover-layer {
		outline: 2px solid var(--color-teal);
		outline-offset: 2px;
	}

	/* Guilloche paper texture backdrop */
	.banknote-pattern {
		position: absolute;
		inset: 0;
		border-radius: var(--radius-lg);
		background-image: repeating-linear-gradient(
			45deg,
			rgba(20, 48, 46, 0.02) 0px,
			rgba(20, 48, 46, 0.02) 2px,
			transparent 2px,
			transparent 6px
		);
		pointer-events: none;
	}

	[data-theme="dark"] .banknote-pattern {
		background-image: repeating-linear-gradient(
			45deg,
			rgba(255, 255, 255, 0.03) 0px,
			rgba(255, 255, 255, 0.03) 2px,
			transparent 2px,
			transparent 6px
		);
	}

	/* Inner decorative hairline frame */
	.inner-frame {
		position: absolute;
		inset: 4px;
		border: 1px dashed rgba(20, 48, 46, 0.12);
		border-radius: calc(var(--radius-lg) - 4px);
		padding: 6px 8px;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		pointer-events: none;
	}

	[data-theme="dark"] .inner-frame {
		border-color: rgba(255, 255, 255, 0.12);
	}

	.note-header {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.seal-badge {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: var(--radius-sm);
		background: var(--color-teal-bg);
		color: var(--color-teal);
		flex-shrink: 0;
	}

	.is-central .seal-badge {
		width: 26px;
		height: 26px;
		background: var(--color-gold-bg);
		color: var(--color-gold-dark);
	}

	[data-theme="dark"] .is-central .seal-badge {
		color: var(--color-gold);
	}

	.serial-tag {
		font-family: var(--font-mono);
		font-size: 9px;
		color: var(--color-text-muted);
		letter-spacing: 0.04em;
	}

	.type-label {
		font-size: 10px;
		font-weight: var(--font-weight-extrabold);
		color: var(--color-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		margin-left: auto;
	}

	.is-central .type-label {
		font-size: 11px;
	}

	.note-body {
		display: flex;
		align-items: baseline;
		gap: 2px;
		margin: 2px 0;
	}

	.currency-symbol {
		font-family: var(--font-display);
		font-size: 13px;
		font-weight: var(--font-weight-bold);
		color: var(--color-text-muted);
	}

	.is-central .currency-symbol {
		font-size: 18px;
	}

	.amount-val {
		font-family: var(--font-display);
		font-size: 18px;
		font-weight: var(--font-weight-extrabold);
		color: var(--color-text);
		line-height: 1;
		white-space: nowrap;
	}

	.is-central .amount-val {
		font-size: 26px;
		color: var(--color-gold-dark);
	}

	[data-theme="dark"] .is-central .amount-val {
		color: var(--color-gold);
	}

	.note-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.meta-pill {
		font-size: 9px;
		font-weight: var(--font-weight-semibold);
		color: var(--color-text-muted);
		background: var(--color-surface-inset);
		padding: 1px 5px;
		border-radius: var(--radius-pill);
		white-space: nowrap;
		max-width: 120px;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.flip7-stamp {
		font-family: var(--font-display);
		font-size: 8px;
		font-weight: 900;
		color: var(--color-teal);
		opacity: 0.45;
		letter-spacing: 0.08em;
	}

	.is-central .flip7-stamp {
		color: var(--color-gold-dark);
		opacity: 0.6;
	}

	@media (prefers-reduced-motion: reduce) {
		.banknote-float-layer {
			animation: none !important;
		}
		.banknote-hover-layer {
			transition: none !important;
		}
	}
</style>

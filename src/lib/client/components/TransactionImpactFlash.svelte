<script lang="ts">
	import { onMount } from 'svelte';
	import { formatWithCommas } from '$lib/shared/utils/format';
	import type { TransactionType } from '$lib/types';

	let {
		type = 'expense',
		amount = 0,
		categoryName = '',
		onComplete = () => {}
	}: {
		type?: TransactionType;
		amount?: number;
		categoryName?: string;
		onComplete?: () => void;
	} = $props();

	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				node.remove();
			}
		};
	}

	const formattedAmount = $derived(
		formatWithCommas(String(Math.abs(amount)))
	);

	onMount(() => {
		const prefersReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const timer = setTimeout(() => {
			onComplete();
		}, prefersReduced ? 1200 : 2000);

		return () => clearTimeout(timer);
	});
</script>

<div class="impact-flash-layer" use:portal aria-hidden="true">
	<div class="impact-flash-container {type}">
		<div class="impact-ripple"></div>
		<div class="impact-card">
			<span class="impact-amount">
				{type === 'income' ? '+₱' : '-₱'}{formattedAmount}
			</span>
			{#if categoryName}
				<span class="impact-category">{categoryName}</span>
			{/if}
		</div>
	</div>
</div>

<style>
	.impact-flash-layer {
		position: fixed;
		inset: 0;
		z-index: 99999;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
		user-select: none;
		background: rgba(0, 0, 0, 0.03);
		backdrop-filter: blur(3px);
		-webkit-backdrop-filter: blur(3px);
	}

	.impact-flash-container {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		animation: moneyImpactAnim 2000ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}

	.impact-ripple {
		position: absolute;
		width: 320px;
		height: 320px;
		border-radius: var(--radius-full, 9999px);
		border: 2px solid currentColor;
		opacity: 0;
		animation: moneyRippleAnim 2000ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}

	.impact-flash-container.expense {
		color: var(--color-coral, #EF6C4A);
	}

	.impact-flash-container.income {
		color: var(--color-teal, #2BA8A2);
	}

	.impact-card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--space-xl, 24px) var(--space-2xl, 36px);
		background: transparent;
	}

	.impact-amount {
		font-family: var(--font-display, sans-serif);
		font-size: clamp(80px, 9vw, 160px);
		font-weight: 800;
		letter-spacing: -0.03em;
		line-height: 1;
		color: currentColor;
		text-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
		filter: drop-shadow(0 4px 16px rgba(0, 0, 0, 0.1));
	}

	[data-theme="dark"] .impact-amount {
		text-shadow: 0 12px 48px rgba(0, 0, 0, 0.5);
		filter: drop-shadow(0 4px 20px rgba(0, 0, 0, 0.4));
	}

	.impact-category {
		font-family: var(--font-body, sans-serif);
		font-size: clamp(16px, 1.6vw, 22px);
		font-weight: 600;
		color: var(--color-text-muted, #64748b);
		margin-top: 12px;
		letter-spacing: 0.03em;
		text-transform: capitalize;
		text-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
	}

	@media (max-width: 640px) {
		.impact-amount {
			font-size: clamp(48px, 14vw, 84px);
		}
		.impact-category {
			font-size: var(--font-size-base, 16px);
			margin-top: 8px;
		}
		.impact-ripple {
			width: 200px;
			height: 200px;
		}
	}

	@keyframes moneyImpactAnim {
		0% {
			opacity: 0;
			transform: translateY(16px) scale(0.85);
		}
		10% {
			opacity: 1;
			transform: translateY(0) scale(1.03);
		}
		15% {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
		45% {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
		100% {
			opacity: 0;
			transform: translateY(-100px) scale(1.01);
		}
	}

	@keyframes moneyRippleAnim {
		0% {
			transform: scale(0.4);
			opacity: 0;
		}
		12% {
			transform: scale(0.85);
			opacity: 0.12;
		}
		50% {
			transform: scale(1.5);
			opacity: 0;
		}
		100% {
			transform: scale(1.6);
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.impact-flash-layer {
			backdrop-filter: none;
			-webkit-backdrop-filter: none;
		}
		.impact-flash-container {
			animation: moneyImpactReduced 1200ms ease forwards !important;
		}
		.impact-ripple {
			display: none !important;
		}
	}

	@keyframes moneyImpactReduced {
		0% {
			opacity: 0;
		}
		20% {
			opacity: 1;
		}
		70% {
			opacity: 1;
		}
		100% {
			opacity: 0;
		}
	}
</style>

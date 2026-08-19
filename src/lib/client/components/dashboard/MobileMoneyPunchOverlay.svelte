<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { formatCurrency } from '$lib/client/utils/format';

	export type PunchType =
		| 'spent'
		| 'income'
		| 'lent'
		| 'borrowed'
		| 'repaid'
		| 'recurring';

	let {
		type = 'spent',
		amount = 0,
		onComplete
	}: {
		type?: PunchType;
		amount?: number;
		onComplete?: () => void;
	} = $props();

	let timer: ReturnType<typeof setTimeout> | null = null;

	const config = $derived.by(() => {
		switch (type) {
			case 'spent':
				return {
					icon: '💸',
					title: 'MONEY OUT',
					subtitle: 'money left your pocket',
					accentColor: 'var(--color-coral, #ef4444)',
					glowColor: 'rgba(239, 108, 74, 0.35)',
					particleColor: 'rgba(239, 108, 74, 0.7)',
					particleDirection: 'down' as const
				};
			case 'income':
				return {
					icon: '💰',
					title: 'MONEY IN',
					subtitle: 'money entered your pocket',
					accentColor: 'var(--color-teal, #2BA8A2)',
					glowColor: 'rgba(43, 168, 162, 0.35)',
					particleColor: 'rgba(43, 168, 162, 0.7)',
					particleDirection: 'up' as const
				};
			case 'lent':
				return {
					icon: '🤝',
					title: 'MONEY AWAY',
					subtitle: 'money left your hands',
					accentColor: 'var(--color-gold, #f59e0b)',
					glowColor: 'rgba(255, 210, 63, 0.35)',
					particleColor: 'rgba(255, 210, 63, 0.7)',
					particleDirection: 'down' as const
				};
			case 'borrowed':
				return {
					icon: '📥',
					title: 'MONEY COMMITTED',
					subtitle: 'money entered your pocket with an obligation',
					accentColor: '#8b5cf6',
					glowColor: 'rgba(139, 92, 246, 0.35)',
					particleColor: 'rgba(139, 92, 246, 0.7)',
					particleDirection: 'up' as const
				};
			case 'repaid':
				return {
					icon: '🧾',
					title: 'MONEY COMMITTED',
					subtitle: 'an obligation left your pocket',
					accentColor: '#f97316',
					glowColor: 'rgba(249, 115, 22, 0.35)',
					particleColor: 'rgba(249, 115, 22, 0.7)',
					particleDirection: 'down' as const
				};
			case 'recurring':
				return {
					icon: '🔄',
					title: 'MONEY COMMITTED',
					subtitle: 'a recurring payment left your pocket',
					accentColor: '#0ea5e9',
					glowColor: 'rgba(14, 165, 233, 0.35)',
					particleColor: 'rgba(14, 165, 233, 0.7)',
					particleDirection: 'down' as const
				};
			default:
				return {
					icon: '💸',
					title: 'MONEY OUT',
					subtitle: 'money left your pocket',
					accentColor: 'var(--color-coral, #ef4444)',
					glowColor: 'rgba(239, 108, 74, 0.35)',
					particleColor: 'rgba(239, 108, 74, 0.7)',
					particleDirection: 'down' as const
				};
		}
	});

	// Generate 16 money-leak particles with varying positions and timings
	const particles = Array.from({ length: 16 }, (_, i) => {
		const left = (i * 6.25 + (i % 3) * 2.5) % 95 + 2;
		const width = 2 + (i % 4) * 2;
		const height = 18 + (i % 5) * 12;
		const duration = 1.6 + (i % 4) * 0.3;
		const delay = (i % 7) * 0.18;
		const opacity = 0.4 + (i % 3) * 0.25;
		return { id: i, left, width, height, duration, delay, opacity };
	});

	onMount(() => {
		// ~2.9s full animation lifecycle
		timer = setTimeout(() => {
			onComplete?.();
		}, 2900);
	});

	onDestroy(() => {
		if (timer) clearTimeout(timer);
	});
</script>

<div
	class="mobile-punch-backdrop"
	role="dialog"
	aria-modal="true"
	aria-label="Money logged animation"
>
	<!-- Radial Glow Background -->
	<div
		class="radial-glow"
		style:--glow-color={config.glowColor}
	></div>

	<!-- 16 Money Leak Particles -->
	<div class="particle-container" aria-hidden="true">
		{#each particles as p (p.id)}
			<div
				class="leak-particle"
				class:upward={config.particleDirection === 'up'}
				style:left="{p.left}%"
				style:width="{p.width}px"
				style:height="{p.height}px"
				style:--p-duration="{p.duration}s"
				style:--p-delay="{p.delay}s"
				style:--p-opacity={p.opacity}
				style:--p-color={config.particleColor}
			></div>
		{/each}
	</div>

	<!-- Main Card Content (punchIn animation) -->
	<div class="punch-card" style:--accent-color={config.accentColor}>
		<div class="icon-wrap">{config.icon}</div>
		<h2 class="title-wordIn">{config.title}</h2>
		<div class="amount-display">{formatCurrency(amount)}</div>
		<p class="subtitle-text">{config.subtitle}</p>
	</div>
</div>

<style>
	.mobile-punch-backdrop {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(10, 15, 14, 0.92);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		overflow: hidden;
		touch-action: none;
	}

	/* ─── Radial Glow ─── */
	.radial-glow {
		position: absolute;
		width: 340px;
		height: 340px;
		border-radius: 50%;
		background: radial-gradient(circle, var(--glow-color) 0%, rgba(0, 0, 0, 0) 70%);
		pointer-events: none;
		animation: pulseGlow 2.9s ease-in-out infinite alternate;
	}

	@keyframes pulseGlow {
		0% { transform: scale(0.9); opacity: 0.7; }
		50% { transform: scale(1.15); opacity: 1; }
		100% { transform: scale(0.95); opacity: 0.8; }
	}

	/* ─── Particles ─── */
	.particle-container {
		position: absolute;
		inset: 0;
		pointer-events: none;
		overflow: hidden;
	}

	.leak-particle {
		position: absolute;
		top: 0;
		border-radius: 999px;
		background: linear-gradient(180deg, var(--p-color) 0%, rgba(255, 255, 255, 0.05) 100%);
		box-shadow: 0 0 8px var(--p-color);
		animation: particleLeak var(--p-duration) cubic-bezier(0.25, 0.46, 0.45, 0.94) var(--p-delay) infinite;
	}

	.leak-particle.upward {
		animation: particleLeakUp var(--p-duration) cubic-bezier(0.25, 0.46, 0.45, 0.94) var(--p-delay) infinite;
	}

	@keyframes particleLeak {
		0% {
			transform: translateY(-10vh);
			opacity: 0;
		}
		15% {
			opacity: var(--p-opacity, 0.8);
		}
		100% {
			transform: translateY(110vh);
			opacity: 0;
		}
	}

	@keyframes particleLeakUp {
		0% {
			transform: translateY(110vh);
			opacity: 0;
		}
		15% {
			opacity: var(--p-opacity, 0.8);
		}
		100% {
			transform: translateY(-10vh);
			opacity: 0;
		}
	}

	/* ─── Main Punch Card ─── */
	.punch-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 32px 24px;
		z-index: 10;
		animation: punchIn 2.9s cubic-bezier(0.2, 0.7, 0.2, 1) forwards;
	}

	@keyframes punchIn {
		0% {
			opacity: 0;
			transform: translateY(-10px) scale(0.85);
		}
		14% {
			opacity: 1;
			transform: translateY(0) scale(1.05);
		}
		24% {
			transform: translateY(0) scale(1);
		}
		76% {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
		100% {
			opacity: 0;
			transform: translateY(36px) scale(0.97);
		}
	}

	/* ─── Icon ─── */
	.icon-wrap {
		font-size: 54px;
		margin-bottom: 12px;
		filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3));
	}

	/* ─── Title Text (wordIn) ─── */
	.title-wordIn {
		font-family: var(--font-display, sans-serif);
		font-size: 20px;
		font-weight: 900;
		color: var(--accent-color);
		margin: 0 0 12px 0;
		text-transform: uppercase;
		animation: wordIn 2.9s cubic-bezier(0.2, 0.7, 0.2, 1) forwards;
		text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
	}

	@keyframes wordIn {
		0% {
			opacity: 0;
			letter-spacing: 0.55em;
			transform: translateY(10px);
		}
		30% {
			opacity: 1;
			letter-spacing: 0.16em;
			transform: translateY(0);
		}
		100% {
			opacity: 1;
			letter-spacing: 0.16em;
			transform: translateY(0);
		}
	}

	/* ─── Amount Display ─── */
	.amount-display {
		font-family: var(--font-display, sans-serif);
		font-size: 42px;
		font-weight: 900;
		letter-spacing: -0.02em;
		color: #FFFFFF;
		margin-bottom: 8px;
		text-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
	}

	/* ─── Subtitle Text ─── */
	.subtitle-text {
		font-size: 14px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.75);
		margin: 0;
		letter-spacing: -0.01em;
	}

	/* ─── Reduced Motion Support ─── */
	@media (prefers-reduced-motion: reduce) {
		.radial-glow {
			animation: none;
		}
		.particle-container {
			display: none;
		}
		.punch-card {
			animation: fadeSimple 2.9s ease forwards;
		}
		.title-wordIn {
			animation: none;
			letter-spacing: 0.16em;
		}
	}

	@keyframes fadeSimple {
		0% { opacity: 0; }
		15% { opacity: 1; }
		85% { opacity: 1; }
		100% { opacity: 0; }
	}
</style>

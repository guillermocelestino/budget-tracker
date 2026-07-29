<script lang="ts">
	import { isOnboardingDismissed, dismissOnboarding } from '$lib/stores/preferences.svelte';

	let {
		autoShow = false,
	}: {
		autoShow?: boolean;
	} = $props();

	let visible = $state(false);
	let step = $state(0);

	// Check localStorage after mount to avoid SSR hydration flash
	$effect(() => {
		if (autoShow && !isOnboardingDismissed()) {
			visible = true;
		}
	});

	const steps = [
		{
			icon: '💰',
			title: 'Track Your Money',
			desc: 'Add income and expenses to see where your money goes. Every transaction builds your financial picture.',
		},
		{
			icon: '🎯',
			title: 'Set Budgets',
			desc: 'Give every category a limit. The teal bar shows you&rsquo;re on track; gold means watch out; coral means over budget.',
		},
		{
			icon: '🏆',
			title: 'Win at Finance',
			desc: 'Stay under budget and you earn the gold crown. Use lending tracking and reports to level up your money game.',
		},
	];

	function next() {
		if (step < steps.length - 1) {
			step++;
		} else {
			dismiss();
		}
	}

	function skip() {
		dismiss();
	}

	function dismiss() {
		dismissOnboarding();
		visible = false;
	}
</script>

{#if visible}
	<div class="onboarding-backdrop">
		<div class="onboarding-card" role="dialog" aria-label="Welcome">
			<div class="onboarding-step-indicator">
				{#each steps as _, i}
					<div class="ob-step-dot" class:ob-active={i === step} class:ob-done={i < step}></div>
				{/each}
			</div>

			<div class="onboarding-icon-box">
				<span class="ob-icon">{steps[step].icon}</span>
			</div>
			<h2 class="ob-title">{steps[step].title}</h2>
			<p class="ob-desc">{@html steps[step].desc}</p>

			<div class="ob-actions">
				<button class="ob-btn-primary" onclick={next}>
					{step < steps.length - 1 ? 'Next →' : 'Get Started!'}
				</button>
				<button class="ob-btn-skip" onclick={skip}>Skip tour</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.onboarding-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(12, 31, 30, 0.6);
		backdrop-filter: blur(6px);
		z-index: 9998;
		animation: fadeIn 300ms ease;
        display: flex;
        align-items: center;
        justify-content: center;
	}

	.onboarding-card {
		position: relative; /* flex container will center it */
		max-width: 400px;
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-xl);
		padding: var(--space-2xl);
		z-index: 9999;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: var(--space-md);
		box-shadow: var(--shadow-card);
		animation: bounce-in 500ms var(--bounce) both;
	}

	.onboarding-step-indicator {
		display: flex;
		gap: 6px;
		align-items: center;
	}

	.ob-step-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color-hairline);
		transition: all 300ms var(--bounce);
	}

	.ob-step-dot.ob-active {
		width: 24px;
		background: var(--color-teal);
		border-radius: var(--radius-pill);
		box-shadow: var(--glow-card);
	}

	.ob-step-dot.ob-done {
		background: var(--color-teal);
	}

	.onboarding-icon-box {
		width: 80px;
		height: 80px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-teal-bg);
		border-radius: var(--radius-lg);
		box-shadow: var(--glow-card);
	}

	.ob-icon {
		font-size: 36px;
		line-height: 1;
	}

	.ob-title {
		font-family: var(--font-display);
		font-size: var(--font-size-xl);
		font-weight: var(--font-weight-extrabold);
		color: var(--color-ink);
		margin: 0;
	}

	.ob-desc {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		line-height: 1.5;
		margin: 0;
		max-width: 300px;
	}

	.ob-actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		width: 100%;
		margin-top: var(--space-sm);
	}

	.ob-btn-primary {
		width: 100%;
		padding: 12px var(--space-xl);
		background: linear-gradient(135deg, var(--color-gold), var(--color-gold-light));
		color: var(--color-ink);
		border: none;
		border-radius: var(--radius-pill);
		font-family: var(--font-display);
		font-size: var(--font-size-base);
		font-weight: var(--font-weight-bold);
		cursor: pointer;
		min-height: 48px;
		box-shadow: var(--glow-gold);
		transition: all 200ms var(--bounce);
	}

	.ob-btn-primary:hover {
		transform: translateY(-1px);
		box-shadow: 0 6px 24px rgba(255, 210, 63, 0.5);
	}

	.ob-btn-primary:active {
		transform: scale(0.97);
	}

	.ob-btn-skip {
		background: none;
		border: none;
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
		font-weight: 600;
		cursor: pointer;
		padding: 8px;
		min-height: 44px;
		transition: all 150ms var(--ease);
		font-family: var(--font-body);
	}

	.ob-btn-skip:hover {
		color: var(--color-teal);
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@media (max-width: 480px) {
		.onboarding-card {
			max-width: calc(100vw - 24px);
			padding: var(--space-xl);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.onboarding-card,
		.onboarding-backdrop {
			animation: none;
		}
	}
</style>

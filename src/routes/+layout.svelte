<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { navigating } from '$app/stores';
	import favicon from '$lib/assets/favicon.svg';
	import '../styles/variables.css';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import PwaUpdate from '$lib/components/PwaUpdate.svelte';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import OnboardingWalkthrough from "$lib/components/OnboardingWalkthrough.svelte";
import SearchModal from '$lib/components/SearchModal.svelte';

	let { children }: { children?: import('svelte').Snippet } = $props();

	const isLoginPage = $derived($page.url.pathname === '/login');
	const isPublicRoute = $derived($page.url.pathname === '/' && !$page.data.user);
	const showSidebar = $derived(!isLoginPage && !isPublicRoute);
	const isNoSidebar = $derived(isLoginPage || isPublicRoute);

	let isOnline = $state(true);
	let searchOpen = $state(false);

	onMount(() => {
		const setOnline = () => (isOnline = true);
		const setOffline = () => (isOnline = false);
		window.addEventListener('online', setOnline);
		window.addEventListener('offline', setOffline);

		function onKeydown(e: KeyboardEvent) {
			if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
				e.preventDefault();
				searchOpen = true;
			}
		}
		window.addEventListener('keydown', onKeydown);

		return () => {
			window.removeEventListener('keydown', onKeydown);
			window.removeEventListener('online', setOnline);
			window.removeEventListener('offline', setOffline);
		};
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
		<meta name="apple-mobile-web-app-capable" content="yes" />
		<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
		<meta name="theme-color" content="#2BA8A2" media="(prefers-color-scheme: light)" />
		<meta name="theme-color" content="#0B110F" media="(prefers-color-scheme: dark)" />
</svelte:head>

<PwaUpdate />
<ToastContainer />

<OnboardingWalkthrough autoShow={showSidebar} />

<SearchModal isOpen={searchOpen} onClose={() => searchOpen = false} />

{#if !isOnline}
		<div class="offline-banner" role="alert">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.58 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1"/>
			</svg>
			<span>You are offline. Changes will sync when connectivity returns.</span>
		</div>
	{/if}

		<div class="app-shell">
		{#if showSidebar}
			<Sidebar onsearch={() => searchOpen = true} />
		{/if}
		<div class="main-area" class:no-sidebar={isNoSidebar}>
			<main class="main-content" class:navigating={$navigating} class:no-sidebar={isNoSidebar}>
				{@render children()}
			</main>
		</div>

		{#if showSidebar}
			<BottomNav />
		{/if}
	</div>

<style>
	:global(*) {
		margin: 0;
		padding: 0;
		box-sizing: border-box;
	}

	:global(body) {
		font-family: var(--font-body);
		background: var(--color-bg);
		color: var(--color-text);
		font-size: var(--font-size-base);
		line-height: 1.5;
		-webkit-font-smoothing: antialiased;
	}

	:global(a) {
		color: var(--color-teal);
		text-decoration: none;
	}

	:global(a:hover) {
		color: var(--color-teal-dark);
			text-decoration: underline;
	}

	:global(button) {
		font-family: inherit;
	}

	:global(body) {
		padding-top: var(--safe-top);
		padding-bottom: var(--safe-bottom);
		overflow-x: clip;
		-webkit-tap-highlight-color: transparent;
	}

	:global(*) {
		-webkit-tap-highlight-color: transparent;
	}

	/* iOS zoom prevention: inputs need 16px minimum */
	:global(input),
	:global(textarea),
	:global(select) {
		font-size: 16px !important;
	}

	/* Touch-friendly scroll containers */
	:global(.scrollable) {
		overscroll-behavior: contain;
	}

	/* Prevent pull-to-refresh on main content */
	:global(.main-content) {
		overscroll-behavior: none;
	}

	/* Disable callout on long-press */
	:global(img),
	:global(a) {
		-webkit-touch-callout: none;
	}

	/* Smooth momentum scrolling */
	:global(body),
	:global(html) {
		scroll-behavior: smooth;
		overflow-x: clip;
	}

	/* ── Offline banner ── */
	.offline-banner {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: 10px var(--space-md);
		background: var(--color-warning);
		color: #1a1a2e;
		font-size: var(--font-size-sm);
		font-weight: 500;
		text-align: center;
		justify-content: center;
		animation: banner-slide-down 250ms var(--ease-smooth);
	}

	@keyframes banner-slide-down {
		from { transform: translateY(-100%); opacity: 0; }
		to { transform: translateY(0); opacity: 1; }
	}

	@media (prefers-reduced-motion: reduce) {
		.offline-banner { animation: none; }
	}

	/* ── Ambient page background (overlaid gradient) ── */
	.app-shell::before {
		content: '';
		position: fixed;
		inset: 0;
		z-index: -2;
		background:
			radial-gradient(ellipse 80% 80% at 20% -20%, rgba(43, 168, 162, 0.08) 0%, transparent 50%),
			radial-gradient(ellipse 60% 60% at 80% 100%, rgba(255, 210, 63, 0.06) 0%, transparent 50%);
		pointer-events: none;
	}

	@media (max-width: 768px) {
		.app-shell::before {
			background:
				radial-gradient(ellipse 90% 60% at 10% -10%, rgba(43, 168, 162, 0.06) 0%, transparent 40%),
				radial-gradient(ellipse 70% 40% at 90% 110%, rgba(255, 210, 63, 0.06) 0%, transparent 40%);
		}
	}

	/* PageBackground owns the dark ambient blooms — keep this light-only layer
	   from double-lighting the dark theme. */
	[data-theme="dark"] .app-shell::before {
		opacity: 0;
	}

	/* ── Touch gesture affordance ── */
	@media (pointer: coarse) {
		:global(.card-clickable),
		:global(.row-tappable) {
			cursor: pointer;
			-webkit-tap-highlight-color: transparent;
			user-select: none;
		}

		:global(.card-clickable:active),
		:global(.row-tappable:active) {
			background: var(--color-primary-light);
			transition: background 60ms ease;
		}
	}

				.app-shell {
			display: flex;
			min-height: 100vh;
		}

		.main-area {
			flex: 1;
			min-width: 0;
			margin-left: var(--sidebar-width);
			min-height: 100vh;
		}

		.main-area.no-sidebar {
			margin-left: 0;
		}

		.main-content {
			padding: var(--space-lg) var(--space-xl);
			max-width: 1200px;
			width: 100%;
			transition: opacity 150ms ease;
			scrollbar-gutter: stable;
		}

		/* Drop scrollbar-gutter on mobile so it doesn't steal space */
		@media (max-width: 768px) {
			.main-content {
				scrollbar-gutter: auto;
				max-width: none;
			}
		}

		.main-content.no-sidebar {
			padding: 0;
			max-width: none;
		}

		.main-content.navigating {
			opacity: 0.5;
		}

		/* Safe area runtime population */
		@supports (padding-top: env(safe-area-inset-top)) {
			:root {
				--safe-top: env(safe-area-inset-top);
				--safe-bottom: env(safe-area-inset-bottom);
				--safe-left: env(safe-area-inset-left);
				--safe-right: env(safe-area-inset-right);
			}
		}

		@media (max-width: 768px) {
			.main-area {
				margin-left: 0;
				padding-bottom: 72px;
			}

			.main-area.no-sidebar {
				padding-top: 0;
				padding-bottom: 0;
			}

			.main-content {
				padding: var(--space-md);
			}

			.main-content.no-sidebar {
				padding: 0;
			}

			/* Hide sidebar on mobile */
			:global(.sidebar) {
				display: none;
			}
		}
	</style>

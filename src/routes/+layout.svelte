<script lang="ts">
	import { page } from '$app/stores';
	import { navigating } from '$app/stores';
	import favicon from '$lib/assets/favicon.svg';
	import '../styles/variables.css';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import PwaUpdate from '$lib/components/PwaUpdate.svelte';
	import ToastContainer from '$lib/components/ToastContainer.svelte';

	let { children }: { children?: import('svelte').Snippet } = $props();

	const isLoginPage = $derived($page.url.pathname === '/login');
	const isPublicRoute = $derived($page.url.pathname === '/' && !$page.data.user);
	const showSidebar = $derived(!isLoginPage && !isPublicRoute);
	const isNoSidebar = $derived(isLoginPage || isPublicRoute);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
		<meta name="apple-mobile-web-app-capable" content="yes" />
		<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
		<meta name="theme-color" content="#f8f9fa" media="(prefers-color-scheme: light)" />
		<meta name="theme-color" content="#111827" media="(prefers-color-scheme: dark)" />
</svelte:head>

<PwaUpdate />
<ToastContainer />

<div class="app-shell">
	{#if showSidebar}
		<Sidebar />
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
		font-family: var(--font-family);
		background: var(--color-bg);
		color: var(--color-text);
		font-size: var(--font-size-base);
		line-height: 1.5;
		-webkit-font-smoothing: antialiased;
	}

	:global(a) {
		color: var(--color-primary);
		text-decoration: none;
	}

	:global(a:hover) {
		text-decoration: underline;
	}

	:global(button) {
		font-family: inherit;
	}

	:global(body) {
		padding-top: var(--safe-top);
		padding-bottom: var(--safe-bottom);
		overflow-x: hidden;
		-webkit-tap-highlight-color: transparent;
		-webkit-overflow-scrolling: touch;
		overflow-scrolling: touch;
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
		-webkit-overflow-scrolling: touch;
		overflow-scrolling: touch;
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
		-webkit-overflow-scrolling: touch;
		scroll-behavior: smooth;
		overflow-x: hidden;
	}

		.app-shell {
		display: flex;
		min-height: 100vh;
	}

	.main-area {
		flex: 1;
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

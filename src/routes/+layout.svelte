<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../styles/variables.css';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import PwaUpdate from '$lib/components/PwaUpdate.svelte';
	import ToastContainer from '$lib/components/ToastContainer.svelte';

	let { children }: { children?: import('svelte').Snippet } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<PwaUpdate />
<ToastContainer />

<div class="app-shell">
	<Sidebar />
	<div class="main-area">
		<main class="main-content">
			{@render children()}
		</main>
	</div>
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

	.app-shell {
		display: flex;
		min-height: 100vh;
	}

	.main-area {
		flex: 1;
		margin-left: var(--sidebar-width);
		min-height: 100vh;
	}

	.main-content {
		padding: var(--space-lg) var(--space-xl);
		max-width: 1200px;
	}

	@media (max-width: 768px) {
		.main-area {
			margin-left: 0;
			padding-top: 48px;
		}

		.main-content {
			padding: var(--space-md);
		}
	}
</style>

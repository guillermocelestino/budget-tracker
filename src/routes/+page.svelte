<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		goto('/dashboard', { replaceState: true });
	});
</script>

<svelte:head>
	<title>Budget Tracker</title>
</svelte:head>

<p style="text-align: center; padding: 2rem; color: var(--color-text-secondary);">Redirecting...</p>

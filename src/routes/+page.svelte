<script lang="ts">
	import { browser } from '$app/environment';

	if (browser) {
		// Clear any cached service worker data
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.getRegistrations().then(regs => {
				regs.forEach(r => r.unregister());
			});
		}
		// Force redirect to dashboard or login
		window.location.href = '/dashboard';
	}
</script>

<svelte:head>
	<title>Budget Tracker</title>
	<meta http-equiv="refresh" content="0; url=/dashboard" />
</svelte:head>

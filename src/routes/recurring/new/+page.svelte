<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import MoneyCommittedModal from '$lib/client/components/MoneyCommittedModal.svelte';
	import PageBackground from '$lib/client/components/PageBackground.svelte';

	let data = $derived($page.data as App.PageData);
</script>

<svelte:head>
	<title>Money Committed — GET WRECK</title>
</svelte:head>

<PageBackground />

<MoneyCommittedModal
	open={true}
	categories={data.categories ?? []}
	onClose={() => goto('/recurring')}
	onSuccess={() => goto('/recurring')}
/>
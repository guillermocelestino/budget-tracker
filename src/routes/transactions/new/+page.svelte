<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import RecordMoneyModal from '$lib/client/components/RecordMoneyModal.svelte';
	import PageBackground from '$lib/client/components/PageBackground.svelte';

	let data = $derived($page.data as App.PageData);
</script>

<svelte:head>
	<title>Record Money — GET WRECK</title>
</svelte:head>

<PageBackground />

<RecordMoneyModal
	open={true}
	categories={data.categories ?? []}
	onClose={() => goto('/transactions')}
	onSuccess={() => goto('/transactions')}
/>


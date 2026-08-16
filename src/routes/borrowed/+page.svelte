<script lang="ts">
	import { page } from '$app/stores';
	import CommittedMoneyWorkspace from '$lib/client/components/CommittedMoneyWorkspace.svelte';

	let data = $derived($page.data);
</script>

<CommittedMoneyWorkspace {data} initialView="borrowed" />
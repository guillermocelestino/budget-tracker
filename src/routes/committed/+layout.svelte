<script lang="ts">
	import CommittedMoneyWorkspace from '$lib/client/components/CommittedMoneyWorkspace.svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children?: import('svelte').Snippet } = $props();
</script>

<CommittedMoneyWorkspace {data}>
	{@render children?.()}
</CommittedMoneyWorkspace>

<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { tick } from 'svelte';
	import MoneyCommittedModal from '$lib/client/components/MoneyCommittedModal.svelte';
	import MobileMoneyPunchOverlay, { type PunchType } from '$lib/client/components/dashboard/MobileMoneyPunchOverlay.svelte';
	import PageBackground from '$lib/client/components/PageBackground.svelte';

	let data = $derived($page.data as App.PageData);
	let punchData = $state<{ type: PunchType; amount: number } | null>(null);

	async function handleSuccess(payload?: { amount: number }) {
		if (payload && payload.amount > 0) {
			punchData = { type: 'recurring', amount: payload.amount };
			await tick();
			await new Promise((r) => setTimeout(r, 1800));
		}
		goto('/recurring');
	}
</script>

<svelte:head>
	<title>Money Committed — WRECKRD</title>
</svelte:head>

<PageBackground />

<MoneyCommittedModal
	open={true}
	categories={data.categories ?? []}
	onClose={() => goto('/recurring')}
	onSuccess={handleSuccess}
/>

{#if punchData}
	<MobileMoneyPunchOverlay
		type={punchData.type}
		amount={punchData.amount}
		onComplete={() => (punchData = null)}
	/>
{/if}
<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { tick } from 'svelte';
	import RecordMoneyModal from '$lib/client/components/RecordMoneyModal.svelte';
	import TransactionImpactFlash from '$lib/client/components/TransactionImpactFlash.svelte';
	import MobileMoneyPunchOverlay, { type PunchType } from '$lib/client/components/dashboard/MobileMoneyPunchOverlay.svelte';
	import PageBackground from '$lib/client/components/PageBackground.svelte';
	import type { TransactionType } from '$lib/types';

	let data = $derived($page.data as App.PageData);

	let impactData = $state<{ type: TransactionType; amount: number; categoryName: string } | null>(null);
	let punchData = $state<{ type: PunchType; amount: number } | null>(null);

	async function handleSuccess(payload?: { type: TransactionType; amount: number; categoryName: string }) {
		if (!payload) {
			goto('/transactions');
			return;
		}
		impactData = payload;
		// Also trigger MobileMoneyPunchOverlay (full-screen particle animation)
		const punchType: PunchType = payload.type === 'income' ? 'income' : 'spent';
		punchData = { type: punchType, amount: payload.amount };
		await tick(); // Let Impact Flash mount
		await new Promise((r) => setTimeout(r, 1800)); // Wait for animation (reduced-motion: 1200ms)
		goto('/transactions');
	}
</script>

<svelte:head>
	<title>Record Money — WRECKRD</title>
</svelte:head>

<PageBackground />

<RecordMoneyModal
	open={true}
	categories={data.categories ?? []}
	onClose={() => goto('/transactions')}
	onSuccess={handleSuccess}
/>

{#if impactData}
	<TransactionImpactFlash
		type={impactData.type}
		amount={impactData.amount}
		categoryName={impactData.categoryName}
		onComplete={() => (impactData = null)}
	/>
{/if}

{#if punchData}
	<MobileMoneyPunchOverlay
		type={punchData.type}
		amount={punchData.amount}
		onComplete={() => (punchData = null)}
	/>
{/if}
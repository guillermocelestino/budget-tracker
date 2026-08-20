<script lang="ts">
	import MobileDrainGauge from './MobileDrainGauge.svelte';

	let {
		totalExpenses = 0,
		totalLent = 0,
		totalRepaid = 0,
		monthStr = '',
		expenseChange = 0
	}: {
		totalExpenses?: number;
		totalLent?: number;
		totalRepaid?: number;
		monthStr?: string;
		expenseChange?: number;
	} = $props();

	const totalMoneyOut = $derived(totalExpenses + totalLent + totalRepaid);
</script>

<div class="pocket-drain-section">
	<div class="pocket-drain-hero-card">
		<h2 class="card-title">💧 POCKET DRAIN</h2>
		<MobileDrainGauge
			{totalMoneyOut}
			{monthStr}
			{expenseChange}
		/>
	</div>
</div>

<style>
	.pocket-drain-section {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.pocket-drain-hero-card {
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-2xl, 20px);
		padding: 20px;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		justify-content: space-between;
		gap: 12px;
		box-shadow: var(--shadow-sm);
		height: 100%;
	}

	.card-title {
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-ink);
		margin: 0;
		align-self: flex-start;
	}
</style>

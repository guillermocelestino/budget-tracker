<script lang="ts">
	import SummaryCard from '$lib/client/components/SummaryCard.svelte';

	let {
		totalLent = 0,
		totalRecovered = 0,
		outstanding = 0,
		direction = 'lent'
	}: {
		totalLent?: number;
		totalRecovered?: number;
		outstanding?: number;
		direction?: 'lent' | 'borrowed';
	} = $props();

	const isBorrowed = $derived(direction === 'borrowed');
	const totalLabel = $derived(isBorrowed ? 'Total Borrowed' : 'Total Lent');
	const recoveredLabel = $derived(isBorrowed ? 'Repaid' : 'Recovered');
	const outstandingLabel = $derived(isBorrowed ? 'Still Owing' : 'Outstanding');
</script>

{#snippet walletIcon()}
	<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>
	</svg>
{/snippet}

{#snippet cashIcon()}
	<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
	</svg>
{/snippet}

{#snippet clockIcon()}
	<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
	</svg>
{/snippet}

<div class="lending-summary-grid">
	<SummaryCard label={totalLabel} value={totalLent} tone={direction === 'lent' ? 'out' : 'in'} icon={walletIcon} />
	<SummaryCard label={recoveredLabel} value={totalRecovered} tone={direction === 'lent' ? 'in' : 'out'} icon={cashIcon} />
	<SummaryCard label={outstandingLabel} value={outstanding} tone="out" icon={clockIcon} />
</div>

<style>
	.lending-summary-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--space-md);
		margin-bottom: var(--space-lg);
		animation: fade-in-up 500ms var(--ease) both;
	}

	@media (max-width: 768px) {
		/* 2-per-row keeps readability + touch targets; the 3rd card spans
		   full width so nothing is squeezed into a cramped 3-across row. */
		.lending-summary-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: var(--space-sm);
		}

		:global(.lending-summary-grid > .card:nth-child(3)) {
			grid-column: 1 / -1;
		}
	}
</style>

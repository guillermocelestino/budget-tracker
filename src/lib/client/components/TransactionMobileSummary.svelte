<script lang="ts">
  import TransactionSummary from '$lib/client/components/TransactionSummary.svelte';
  import type { Transaction } from '$lib/types';

  let {
    transactions = [] as Transaction[],
    activeType = '',
    onCardClick,
  }: {
    transactions: Transaction[];
    activeType?: string;
    onCardClick?: (type: string) => void;
  } = $props();
</script>

<div class="mobile-summary-wrapper">
  <TransactionSummary {transactions} {activeType} {onCardClick} />
</div>

<style>
  .mobile-summary-wrapper {
    width: 100%;
    margin-bottom: var(--space-sm, 12px);
  }

  .mobile-summary-wrapper :global(.summary-cards) {
    margin-bottom: 0;
  }
</style>

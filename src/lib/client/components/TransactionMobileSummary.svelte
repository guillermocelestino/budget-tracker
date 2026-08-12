<script lang="ts">
  import { formatCurrency } from '$lib/client/utils/format';
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

  const totalIncome = $derived(
    transactions.reduce((sum, t) => (t.type === 'income' ? sum + t.amount : sum), 0)
  );
  const totalExpenses = $derived(
    transactions.reduce((sum, t) => (t.type === 'expense' ? sum + t.amount : sum), 0)
  );
  const netBalance = $derived(totalIncome - totalExpenses);

  function handleCardClick(type: string) {
    onCardClick?.(activeType === type ? '' : type);
  }
</script>

<div class="tms-strip" role="region" aria-label="Transactions Summary">
  <!-- Tile 1: Income -->
  <button
    type="button"
    class="tms-tile accent-teal"
    class:active={activeType === 'income'}
    class:dimmed={activeType !== '' && activeType !== 'income'}
    onclick={() => handleCardClick('income')}
    aria-pressed={activeType === 'income'}
    aria-label="Filter by Income"
  >
    <div class="tms-tile-header">
      <span class="tms-dot dot-teal"></span>
      <span class="tms-label">Income</span>
    </div>
    <span class="tms-value text-teal">+{formatCurrency(totalIncome)}</span>
  </button>

  <div class="tms-divider" aria-hidden="true"></div>

  <!-- Tile 2: Expenses -->
  <button
    type="button"
    class="tms-tile accent-coral"
    class:active={activeType === 'expense'}
    class:dimmed={activeType !== '' && activeType !== 'expense'}
    onclick={() => handleCardClick('expense')}
    aria-pressed={activeType === 'expense'}
    aria-label="Filter by Expenses"
  >
    <div class="tms-tile-header">
      <span class="tms-dot dot-coral"></span>
      <span class="tms-label">Expenses</span>
    </div>
    <span class="tms-value text-coral">−{formatCurrency(totalExpenses)}</span>
  </button>

  <div class="tms-divider" aria-hidden="true"></div>

  <!-- Tile 3: Net Balance -->
  <button
    type="button"
    class="tms-tile accent-gold"
    class:active={activeType === 'net'}
    class:dimmed={activeType !== '' && activeType !== 'net'}
    onclick={() => handleCardClick('net')}
    aria-pressed={activeType === 'net'}
    aria-label="Filter by Net Balance"
  >
    <div class="tms-tile-header">
      <span class="tms-dot dot-gold"></span>
      <span class="tms-label">Net Balance</span>
    </div>
    <span class="tms-value" class:text-coral={netBalance < 0} class:text-gold={netBalance >= 0}>
      {netBalance < 0 ? '−' : ''}{formatCurrency(Math.abs(netBalance))}
    </span>
  </button>
</div>

<style>
  .tms-strip {
    display: flex;
    align-items: center;
    width: 100%;
    background: var(--color-surface);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card);
    padding: 8px var(--space-xs);
    min-height: 64px;
    box-sizing: border-box;
  }

  .tms-tile {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    padding: 4px 6px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    text-align: left;
    cursor: pointer;
    font-family: inherit;
    transition: all var(--transition-fast);
    -webkit-tap-highlight-color: transparent;
  }

  .tms-tile:active {
    transform: scale(0.96);
  }

  .tms-tile.dimmed {
    opacity: 0.45;
  }

  .tms-tile.active {
    background: var(--color-teal-bg);
    border-color: var(--color-hairline);
    opacity: 1;
  }

  .tms-tile-header {
    display: flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
  }

  .tms-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .dot-teal { background: var(--color-teal); }
  .dot-coral { background: var(--color-coral); }
  .dot-gold { background: var(--color-gold); }

  .tms-label {
    font-size: 10px;
    font-weight: 700;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tms-value {
    font-family: var(--font-display);
    font-size: var(--font-size-sm);
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tms-divider {
    width: 1px;
    height: 28px;
    background: var(--color-hairline);
    flex-shrink: 0;
    margin: 0 2px;
  }

  .text-teal { color: var(--color-teal); }
  .text-coral { color: var(--color-coral); }
  .text-gold { color: var(--color-gold); }
</style>

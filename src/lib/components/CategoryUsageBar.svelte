<script lang="ts">
  import { formatCurrency } from '$lib/utils/format';

  let {
    spent = 0,
    budget = 0,
    compact = false,
  }: {
    spent: number;
    budget: number;
    compact?: boolean;
  } = $props();

  // If budget is 0 or not set, show 0% usage
  const usagePercent = $derived(budget > 0 ? Math.min((spent / budget) * 100, 100) : 0);
  const remaining = $derived(Math.max(budget - spent, 0));
  const isOverBudget = $derived(spent > budget && budget > 0);
</script>

{#if compact}
  <div class="usage-bar-compact">
    <div class="usage-bar-track-compact">
      <div class="usage-bar-fill" style:width="{usagePercent}%" class:over-budget={isOverBudget}></div>
    </div>
    <span class="usage-pct-sm">{usagePercent.toFixed(0)}%</span>
  </div>
{:else}
  <div class="usage-bar-container">
    <div class="usage-bar-label">
      <span>Budget Usage</span>
      {#if budget > 0}
        <span class="usage-value">{formatCurrency(spent)} / {formatCurrency(budget)}</span>
      {:else}
        <span class="usage-value">{formatCurrency(spent)} spent</span>
      {/if}
    </div>
    <div class="usage-bar-track">
      <div class="usage-bar-fill" style:width="{usagePercent}%" class:over-budget={isOverBudget}></div>
    </div>
    {#if budget > 0}
      <div class="usage-bar-details">
        <span class="usage-percentage">{usagePercent.toFixed(0)}%</span>
        {#if remaining > 0}
          <span class="usage-remaining">{formatCurrency(remaining)} remaining</span>
        {:else}
          <span class="usage-over">Overspent by {formatCurrency(-remaining)}</span>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .usage-bar-container {
    margin-top: var(--space-sm);
  }

  .usage-bar-label {
    display: flex;
    justify-content: space-between;
    margin-bottom: var(--space-xs);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  .usage-value {
    font-weight: 600;
    color: var(--color-text);
  }

  .usage-bar-track {
    width: 100%;
    height: 8px;
    background: var(--color-border);
    border-radius: 4px;
    overflow: hidden;
    background: var(--color-bg);
  }

  .usage-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--color-income) 0%, var(--color-primary) 100%);
    transition: width 0.3s ease;
    border-radius: 4px;
  }

  .usage-bar-fill.over-budget {
    background: linear-gradient(90deg, var(--color-expense) 0%, var(--color-danger) 100%);
  }

  .usage-bar-details {
    display: flex;
    justify-content: space-between;
    margin-top: var(--space-xs);
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
  }

  .usage-percentage {
    font-weight: 600;
  }

  .usage-remaining {
    color: var(--color-income);
  }

  .usage-over {
    color: var(--color-expense);
    font-weight: 600;
  }

  .usage-bar-compact {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .usage-bar-track-compact {
    flex: 1;
    height: 6px;
    background: var(--color-bg);
    border-radius: 3px;
    overflow: hidden;
  }

  .usage-pct-sm {
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--color-text-secondary);
    min-width: 35px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
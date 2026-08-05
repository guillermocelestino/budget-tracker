<script lang="ts">
  import FilterFooter from '$lib/components/FilterFooter.svelte';

  /**
   * LendingFilters — the filter panel for /lending and /borrowed.
   * Rendered inside the SearchFilterPill popover (desktop) or FiltersSheet
   * (mobile). The single future-proof home for lending filters: new filters
   * (Interest Rate, Due Date, Overdue Only, Has Notes, Sort By) are added as
   * additional `.filter-section` blocks — the toolbar itself never grows.
   *
   * Status edits are STAGED inside the open panel (`staged`); they are
   * committed to the host via `onStatusChange` on Apply, and discarded when
   * the panel closes without Apply. Reset returns to `defaultStatus`.
   */
  let {
    status = 'active',
    onStatusChange,
    counts = { all: 0, active: 0, paid: 0 },
    paidLabel = 'Paid',
    defaultStatus = 'active',
    mode = 'popover',
    onApply,
  }: {
    status?: 'all' | 'active' | 'paid';
    onStatusChange?: (status: 'all' | 'active' | 'paid') => void;
    counts?: { all: number; active: number; paid: number };
    paidLabel?: string;
    defaultStatus?: 'all' | 'active' | 'paid';
    mode?: 'popover' | 'sheet';
    onApply?: () => void;
  } = $props();

  // The panel remounts every open, so `staged` always starts from the applied
  // status — edits below it are staged until Apply.
  // svelte-ignore state_referenced_locally
  let staged = $state<'all' | 'active' | 'paid'>(status);

  const canApply = $derived(staged !== status);
  const canClear = $derived(status !== defaultStatus || staged !== defaultStatus);

  function handleApply() {
    onStatusChange?.(staged);
    onApply?.();
  }

  function handleClear() {
    staged = defaultStatus;
    onStatusChange?.(defaultStatus);
  }

  const statusOptions = $derived([
    { value: 'all' as const, label: 'All' },
    { value: 'active' as const, label: 'Active' },
    { value: 'paid' as const, label: paidLabel },
  ]);
</script>

<div class="lending-filters" class:sheet={mode === 'sheet'}>
  <!-- ═══ Status section ═══ -->
  <div class="filter-section">
    <div class="filter-section-label">Status</div>
    {#each statusOptions as opt (opt.value)}
      <button
        class="filter-option"
        class:active={staged === opt.value}
        onclick={() => (staged = opt.value)}
        role="radio"
        aria-checked={staged === opt.value}
        type="button"
      >
        <span class="filter-dot" aria-hidden="true"></span>
        <span class="filter-option-label">{opt.label}</span>
        <span class="filter-count">{counts[opt.value]}</span>
      </button>
    {/each}
  </div>

  <!-- ═══ Future sections land here (Interest Rate, Due Date, …) ═══ -->

  <!-- ═══ Shared footer: Reset (→ default view) / Apply (→ commit + close) ═══ -->
  <FilterFooter
    canApply={canApply}
    canClear={canClear}
    onApply={handleApply}
    onClear={handleClear}
    {mode}
  />
</div>

<style>
  .lending-filters {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .filter-section {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .filter-section-label {
    font-family: var(--font-display);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text-muted);
    padding: var(--space-xs) var(--space-sm) var(--space-xs);
    letter-spacing: 0.02em;
  }

  /* Radio-style option — matches the Transactions filter-popover options */
  .filter-option {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: 10px 12px;
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--color-text);
    cursor: pointer;
    transition: background 150ms var(--ease);
    text-align: left;
    width: 100%;
    min-height: 40px;
    -webkit-tap-highlight-color: transparent;
  }

  .filter-option:hover {
    background: var(--color-teal-bg);
  }

  .filter-option.active {
    background: var(--color-teal-bg);
    color: var(--color-teal);
    font-weight: 600;
  }

  .filter-option:focus-visible {
    outline: 2px solid var(--color-teal);
    outline-offset: -2px;
  }

  /* Active dot indicator */
  .filter-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-teal);
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 150ms var(--ease);
  }

  .filter-option.active .filter-dot {
    opacity: 1;
  }

  .filter-option-label {
    flex: 1;
    min-width: 0;
  }

  .filter-count {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  .filter-option.active .filter-count {
    color: var(--color-teal);
  }
</style>

<script lang="ts">
  import FilterFooter from '$lib/client/components/FilterFooter.svelte';
  import DateFilterMenu from '$lib/client/components/DateFilterMenu.svelte';

  /**
   * LendingFilters — the filter panel for /lending and /borrowed.
   * Rendered inside the SearchFilterPill popover (desktop) or FiltersSheet
   * (mobile).
   */
  let {
    status = 'active',
    onStatusChange,
    date = '',
    customFrom = '',
    customTo = '',
    onFilterChange,
    counts = { all: 0, active: 0, paid: 0 },
    paidLabel = 'Paid',
    defaultStatus = 'active',
    mode = 'popover',
    onApply,
  }: {
    status?: 'all' | 'active' | 'paid';
    onStatusChange?: (status: 'all' | 'active' | 'paid') => void;
    date?: string;
    customFrom?: string;
    customTo?: string;
    onFilterChange?: (filters: { status: 'all' | 'active' | 'paid'; date: string; customFrom: string; customTo: string }) => void;
    counts?: { all: number; active: number; paid: number };
    paidLabel?: string;
    defaultStatus?: 'all' | 'active' | 'paid';
    mode?: 'popover' | 'sheet';
    onApply?: () => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  let stagedStatus = $state<'all' | 'active' | 'paid'>(status);
  // svelte-ignore state_referenced_locally
  let stagedDate = $state<string>(date);
  // svelte-ignore state_referenced_locally
  let stagedFrom = $state<string>(customFrom);
  // svelte-ignore state_referenced_locally
  let stagedTo = $state<string>(customTo);

  const isRangeInvalid = $derived(!!stagedFrom && !!stagedTo && stagedFrom > stagedTo);

  const canApply = $derived(
    !isRangeInvalid &&
    (stagedStatus !== status || stagedDate !== date || stagedFrom !== customFrom || stagedTo !== customTo)
  );

  const canClear = $derived(
    status !== defaultStatus || date !== '' || customFrom !== '' || customTo !== '' ||
    stagedStatus !== defaultStatus || stagedDate !== '' || stagedFrom !== '' || stagedTo !== ''
  );

  function handleApply() {
    if (isRangeInvalid) return;
    onStatusChange?.(stagedStatus);
    onFilterChange?.({
      status: stagedStatus,
      date: stagedDate,
      customFrom: stagedFrom,
      customTo: stagedTo,
    });
    onApply?.();
  }

  function handleClear() {
    stagedStatus = defaultStatus;
    stagedDate = '';
    stagedFrom = '';
    stagedTo = '';
    onStatusChange?.(defaultStatus);
    onFilterChange?.({
      status: defaultStatus,
      date: '',
      customFrom: '',
      customTo: '',
    });
    onApply?.();
  }

  function handleDateSelect(preset: string) {
    if (preset === 'custom') {
      stagedDate = 'custom';
    } else {
      stagedDate = preset === 'any' ? '' : preset;
      stagedFrom = '';
      stagedTo = '';
    }
  }

  function handleCustomDateApply(from: string, to: string) {
    stagedDate = 'custom';
    stagedFrom = from;
    stagedTo = to;
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
        class:active={stagedStatus === opt.value}
        onclick={() => (stagedStatus = opt.value)}
        role="radio"
        aria-checked={stagedStatus === opt.value}
        type="button"
      >
        <span class="filter-dot" aria-hidden="true"></span>
        <span class="filter-option-label">{opt.label}</span>
        <span class="filter-count">{counts[opt.value]}</span>
      </button>
    {/each}
  </div>

  <!-- ═══ Date Range section ═══ -->
  <div class="filter-section">
    <div class="filter-section-label">Date Range</div>
    <DateFilterMenu
      activeFilter={stagedDate || 'any'}
      bind:customFrom={stagedFrom}
      bind:customTo={stagedTo}
      onSelect={handleDateSelect}
      onCustomApply={handleCustomDateApply}
      embedded={true}
    />
  </div>

  <!-- ═══ Shared footer: Reset / Apply ═══ -->
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

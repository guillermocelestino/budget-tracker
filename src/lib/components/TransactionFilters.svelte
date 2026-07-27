<script lang="ts">
  import { formatCurrency } from '$lib/utils/format';
  import type { Category } from '$lib/types';

  // ─── Props ────────────────────────────────────────────────────────

  let {
    categories = [] as Category[],
    activeFilters = { date: '', category: '', type: '' },
    onFilterChange,
  }: {
    categories?: Category[];
    activeFilters?: { date: string; category: string; type: string };
    onFilterChange?: (filters: { date: string; category: string; type: string; customFrom?: string; customTo?: string }) => void;
  } = $props();

  // ─── State ────────────────────────────────────────────────────────

  let activePopover = $state<string | null>(null);
  let customFrom = $state('');
  let customTo = $state('');

  // ─── Derived filter labels ───────────────────────────────────────

  const dateLabel = $derived.by(() => {
    if (!activeFilters.date) return 'Date';
    return activeFilters.date === 'custom' && customFrom && customTo
      ? `Date: ${customFrom} → ${customTo}`
      : `Date: ${activeFilters.date}`;
  });

  const categoryLabel = $derived(
    activeFilters.category
      ? `Category: ${activeFilters.category}`
      : 'Category'
  );

  const typeLabel = $derived(
    activeFilters.type
      ? `Type: ${activeFilters.type}`
      : 'Type'
  );

  const hasActiveFilters = $derived(
    activeFilters.date || activeFilters.category || activeFilters.type
  );

  const activeFilterCount = $derived(
    [activeFilters.date, activeFilters.category, activeFilters.type].filter(Boolean).length
  );

  // ─── Pill toggle ─────────────────────────────────────────────────

  function togglePopover(name: string) {
    activePopover = activePopover === name ? null : name;
  }

  // ─── Filter actions ──────────────────────────────────────────────

  function setDateFilter(value: string) {
    activePopover = null;
    if (value === 'custom') {
      onFilterChange?.({ ...activeFilters, date: 'custom', customFrom, customTo });
    } else {
      onFilterChange?.({ ...activeFilters, date: value });
    }
  }

  function setDateCustom() {
    activePopover = null;
    onFilterChange?.({ ...activeFilters, date: 'custom', customFrom, customTo });
  }

  function setCategoryFilter(catName: string) {
    activePopover = null;
    onFilterChange?.({ ...activeFilters, category: catName });
  }

  function setTypeFilter(type: string) {
    activePopover = null;
    onFilterChange?.({ ...activeFilters, type });
  }

  function clearFilters() {
    activePopover = null;
    customFrom = '';
    customTo = '';
    onFilterChange?.({ date: '', category: '', type: '' });
  }

  // ─── Click-outside listener ──────────────────────────────────────

  $effect(() => {
    if (!activePopover) return;

    let attached = false;
    let handler: ((e: MouseEvent) => void) | null = null;

    const raf = requestAnimationFrame(() => {
      handler = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.pill-wrap') && !target.closest('.filter-popover')) {
          activePopover = null;
        }
      };
      document.addEventListener('click', handler);
      attached = true;
    });

    return () => {
      cancelAnimationFrame(raf);
      if (attached && handler) {
        document.removeEventListener('click', handler);
      }
    };
  });
</script>

<div class="filter-bar">
  <!-- ═══ Date Pill ═══ -->
  <div class="pill-wrap">
    <button
      class="filter-pill"
      class:active={!!activeFilters.date}
      onclick={() => togglePopover('date')}
    >
      {dateLabel}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="pill-chevron">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>

    {#if activePopover === 'date'}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div class="filter-popover" onclick={(e) => e.stopPropagation()} role="listbox" aria-label="Date filter">
        <div class="popover-section">
          <button class="popover-option" class:active={activeFilters.date === 'this-week'} onclick={() => setDateFilter('this-week')} role="option" aria-selected={activeFilters.date === 'this-week'}>
            <span class="popover-dot"></span>
            <span>This Week</span>
          </button>
          <button class="popover-option" class:active={activeFilters.date === 'this-month'} onclick={() => setDateFilter('this-month')} role="option" aria-selected={activeFilters.date === 'this-month'}>
            <span class="popover-dot"></span>
            <span>This Month</span>
          </button>
          <button class="popover-option" class:active={activeFilters.date === 'last-3-months'} onclick={() => setDateFilter('last-3-months')} role="option" aria-selected={activeFilters.date === 'last-3-months'}>
            <span class="popover-dot"></span>
            <span>Last 3 Months</span>
          </button>
        </div>
        <div class="popover-divider"></div>
        <div class="popover-section">
          <div class="popover-option" class:active={activeFilters.date === 'custom'} role="option" aria-selected={activeFilters.date === 'custom'}>
            <span class="popover-dot"></span>
            <div class="custom-range">
              <span class="custom-label">Custom Range</span>
              <div class="custom-inputs">
                <input
                  type="date"
                  class="date-input"
                  value={customFrom}
                  oninput={(e) => customFrom = (e.target as HTMLInputElement).value}
                  onclick={(e) => e.stopPropagation()}
                  aria-label="From date"
                />
                <span class="date-sep">→</span>
                <input
                  type="date"
                  class="date-input"
                  value={customTo}
                  oninput={(e) => customTo = (e.target as HTMLInputElement).value}
                  onclick={(e) => e.stopPropagation()}
                  aria-label="To date"
                />
                <button class="date-apply" onclick={(e) => { e.stopPropagation(); setDateCustom(); }}>Apply</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- ═══ Category Pill ═══ -->
  <div class="pill-wrap">
    <button
      class="filter-pill"
      class:active={!!activeFilters.category}
      onclick={() => togglePopover('category')}
    >
      {categoryLabel}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="pill-chevron">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>

    {#if activePopover === 'category'}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div class="filter-popover" onclick={(e) => e.stopPropagation()} role="listbox" aria-label="Category filter">
        <div class="popover-section">
          <button class="popover-option" class:active={!activeFilters.category} onclick={() => setCategoryFilter('')} role="option" aria-selected={!activeFilters.category}>
            <span class="popover-dot"></span>
            <span>All Categories</span>
          </button>
        </div>
        {#if categories.length > 0}
          <div class="popover-divider"></div>
          <div class="popover-section scrollable">
            {#each categories as cat (cat.id)}
              <button class="popover-option" class:active={activeFilters.category === cat.name} onclick={() => setCategoryFilter(cat.name)} role="option" aria-selected={activeFilters.category === cat.name}>
                <span class="popover-dot"></span>
                <span class="cat-option">
                  <span class="cat-emoji">{cat.icon}</span>
                  {cat.name}
                </span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- ═══ Type Pill ═══ -->
  <div class="pill-wrap">
    <button
      class="filter-pill"
      class:active={!!activeFilters.type}
      onclick={() => togglePopover('type')}
    >
      {typeLabel}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="pill-chevron">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>

    {#if activePopover === 'type'}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div class="filter-popover" onclick={(e) => e.stopPropagation()} role="listbox" aria-label="Type filter">
        <div class="popover-section">
          <button class="popover-option" class:active={!activeFilters.type} onclick={() => setTypeFilter('')} role="option" aria-selected={!activeFilters.type}>
            <span class="popover-dot"></span>
            <span>All Types</span>
          </button>
        </div>
        <div class="popover-divider"></div>
        <div class="popover-section">
          <button class="popover-option" class:active={activeFilters.type === 'income'} onclick={() => setTypeFilter('income')} role="option" aria-selected={activeFilters.type === 'income'}>
            <span class="popover-dot"></span>
            <span class="type-option-icon income-color">💰</span>
            <span>Income</span>
          </button>
          <button class="popover-option" class:active={activeFilters.type === 'expense'} onclick={() => setTypeFilter('expense')} role="option" aria-selected={activeFilters.type === 'expense'}>
            <span class="popover-dot"></span>
            <span class="type-option-icon expense-color">💸</span>
            <span>Expense</span>
          </button>
        </div>
      </div>
    {/if}
  </div>

  <!-- ═══ Clear All ═══ -->
  {#if hasActiveFilters}
    <button class="filter-pill clear-pill" onclick={clearFilters}>
      Clear All
      {#if activeFilterCount > 0}
        <span class="clear-count">({activeFilterCount})</span>
      {/if}
    </button>
  {/if}
</div>

<style>
  /* ═══════════════════════════════════════════════════════════════════
     FILTER BAR
     Ramp/Stripe-style pill filters with floating popovers
     ═══════════════════════════════════════════════════════════════════ */

  .filter-bar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
    align-items: flex-start;
    margin-bottom: var(--space-lg);
    position: relative;
  }

  /* ─── Pill wrapper (position anchor for popover) ─── */
  .pill-wrap {
    position: relative;
  }

  /* ─── Filter pill ─── */
  .filter-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 999px;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    font-size: var(--font-size-sm);
    font-weight: 500;
    font-family: inherit;
    color: var(--color-text-secondary);
    cursor: pointer;
    min-height: 40px;
    transition: all 120ms cubic-bezier(0.4, 0, 0.2, 1);
    white-space: nowrap;
    -webkit-tap-highlight-color: transparent;
  }

  .filter-pill:hover {
    border-color: var(--color-primary);
    background: var(--color-bg);
    color: var(--color-text);
  }

  .filter-pill:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  /* Active (filter is set) */
  .filter-pill.active {
    background: var(--color-primary-light);
    border-color: var(--color-primary);
    color: var(--color-primary);
    font-weight: 600;
  }

  .pill-chevron {
    flex-shrink: 0;
    transition: transform 150ms ease;
  }

  .filter-pill.active .pill-chevron {
    transform: rotate(180deg);
  }

  /* ─── Clear pill ─── */
  .clear-pill {
    color: var(--color-expense);
    border-color: rgba(239, 68, 68, 0.2);
    background: transparent;
  }

  .clear-pill:hover {
    background: var(--color-expense-light);
    border-color: var(--color-expense);
    color: var(--color-expense);
  }

  .clear-count {
    font-weight: 600;
  }

  /* ═══════════════════════════════════════════════════════════════════
     FLOATING POPOVER
     ═══════════════════════════════════════════════════════════════════ */

  .filter-popover {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    min-width: 240px;
    max-height: 340px;
    overflow-y: auto;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
    z-index: var(--z-modal, 1000);
    padding: 6px;
    animation: popoverIn 150ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  [data-theme="dark"] .filter-popover {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    border-color: var(--color-border);
  }

  @keyframes popoverIn {
    from {
      opacity: 0;
      transform: translateY(-6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* ─── Popover sections ─── */
  .popover-section {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .popover-section.scrollable {
    max-height: 200px;
    overflow-y: auto;
  }

  .popover-divider {
    height: 1px;
    background: var(--color-border);
    margin: 4px 8px;
  }

  /* ─── Popover options ─── */
  .popover-option {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: 10px 12px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    font-size: var(--font-size-sm);
    font-weight: 500;
    font-family: inherit;
    color: var(--color-text);
    cursor: pointer;
    transition: background 100ms ease;
    text-align: left;
    width: 100%;
    min-height: 40px;
  }

  .popover-option:hover {
    background: rgba(99, 102, 241, 0.05);
  }

  .popover-option.active {
    background: var(--color-primary-light);
    color: var(--color-primary);
    font-weight: 600;
  }

  .popover-option:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
  }

  /* Active dot indicator */
  .popover-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-primary);
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 100ms ease;
  }

  .popover-option.active .popover-dot {
    opacity: 1;
  }

  /* ─── Category option with emoji ─── */
  .cat-option {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .cat-emoji {
    font-size: 1rem;
    line-height: 1;
  }

  /* ─── Type option icons ─── */
  .type-option-icon {
    font-size: 1rem;
    line-height: 1;
  }

  /* ─── Custom date range ─── */
  .custom-range {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
  }

  .custom-label {
    font-size: var(--font-size-sm);
    font-weight: 500;
  }

  .custom-inputs {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .date-input {
    flex: 1;
    min-width: 0;
    padding: 6px 8px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
    font-family: inherit;
    background: var(--color-surface);
    color: var(--color-text);
    min-height: 34px;
  }

  .date-input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px var(--color-primary-light);
  }

  .date-sep {
    color: var(--color-text-secondary);
    font-size: var(--font-size-xs);
    flex-shrink: 0;
  }

  .date-apply {
    padding: 6px 12px;
    border: none;
    border-radius: var(--radius-sm);
    background: var(--color-primary);
    color: white;
    font-size: var(--font-size-xs);
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    min-height: 34px;
    white-space: nowrap;
    transition: background 100ms ease;
  }

  .date-apply:hover {
    background: var(--color-primary-hover);
  }

  /* ─── Responsive ─── */
  @media (max-width: 768px) {
    .filter-bar {
      overflow-x: auto;
      flex-wrap: nowrap;
      -webkit-overflow-scrolling: touch;
      padding-bottom: 4px;
    }

    .filter-pill {
      flex-shrink: 0;
    }

    .filter-popover {
      position: fixed;
      top: auto;
      left: var(--space-md);
      right: var(--space-md);
      bottom: auto;
      min-width: 0;
      max-height: 60vh;
    }
  }
</style>

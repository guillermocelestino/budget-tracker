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
     FILTER BAR — Flip7
     Bubbly pill filters with card popovers
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

  /* ─── Bubbly filter pill ─── */
  .filter-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 18px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--color-hairline);
    background: var(--color-surface);
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--color-text-muted);
    cursor: pointer;
    min-height: 40px;
    transition: all 200ms var(--bounce);
    white-space: nowrap;
    -webkit-tap-highlight-color: transparent;
  }

  .filter-pill:hover {
    border-color: var(--color-teal);
    background: var(--color-teal-bg);
    color: var(--color-teal);
  }

  .filter-pill:focus-visible {
    outline: 2px solid var(--color-teal);
    outline-offset: 2px;
  }

  /* Active (filter is set) — teal-bg + glow */
  .filter-pill.active {
    background: var(--color-teal-bg);
    border-color: var(--color-teal);
    color: var(--color-teal);
    font-weight: 600;
    box-shadow: var(--glow-card);
  }

  .pill-chevron {
    flex-shrink: 0;
    transition: transform 200ms var(--ease);
  }

  .filter-pill.active .pill-chevron {
    transform: rotate(180deg);
  }

  /* ─── Clear pill ─── */
  .clear-pill {
    color: var(--color-coral);
    border-color: rgba(239, 108, 74, 0.20);
    background: transparent;
  }

  .clear-pill:hover {
    background: rgba(239, 108, 74, 0.10);
    border-color: var(--color-coral);
    color: var(--color-coral);
  }

  .clear-count {
    font-weight: 600;
  }

  /* ═══════════════════════════════════════════════════════════════════
     FLOATING POPOVER — Cream card with shadow-card
     ═══════════════════════════════════════════════════════════════════ */

  .filter-popover {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    min-width: 240px;
    max-height: 340px;
    overflow-y: auto;
    background: var(--color-cream);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card);
    z-index: var(--z-modal, 1000);
    padding: 6px;
    animation: popoverIn 200ms var(--bounce);
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
    background: var(--color-hairline);
    margin: 4px 8px;
  }

  /* ─── Popover options ─── */
  .popover-option {
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
  }

  .popover-option:hover {
    background: var(--color-teal-bg);
  }

  .popover-option.active {
    background: var(--color-teal-bg);
    color: var(--color-teal);
    font-weight: 600;
  }

  .popover-option:focus-visible {
    outline: 2px solid var(--color-teal);
    outline-offset: -2px;
  }

  /* Active dot indicator */
  .popover-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-teal);
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 150ms var(--ease);
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
    font-family: var(--font-display);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text);
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
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-md);
    font-size: var(--font-size-xs);
    font-family: var(--font-body);
    background: var(--color-surface);
    color: var(--color-text);
    min-height: 34px;
    transition: border-color 150ms var(--ease), box-shadow 150ms var(--ease);
  }

  .date-input:focus {
    outline: none;
    border-color: var(--color-teal);
    box-shadow: var(--focus);
  }

  .date-sep {
    color: var(--color-text-muted);
    font-size: var(--font-size-xs);
    flex-shrink: 0;
    font-family: var(--font-mono);
  }

  .date-apply {
    padding: 6px 14px;
    border: none;
    border-radius: var(--radius-pill);
    background: var(--color-teal);
    color: white;
    font-family: var(--font-display);
    font-size: var(--font-size-xs);
    font-weight: 700;
    cursor: pointer;
    min-height: 34px;
    white-space: nowrap;
    transition: all 150ms var(--ease);
    box-shadow: var(--glow-card);
  }

  .date-apply:hover {
    background: var(--color-teal-dark);
    box-shadow: 0 4px 20px rgba(43, 168, 162, 0.30);
  }

  .date-apply:active {
    transform: scale(0.96);
  }

  /* ─── Responsive ─── */
  @media (max-width: 768px) {
    .filter-bar {
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
    }

    .pill-wrap {
      width: 100%;
    }

    .filter-pill {
      width: 100%;
      justify-content: space-between;
    }

    .filter-popover {
      position: fixed;
      top: 50%;
      left: var(--space-md);
      right: var(--space-md);
      transform: translateY(-50%);
      min-width: 0;
      max-height: 60vh;
      border-radius: var(--radius-xl);
      margin: 0;
      box-shadow: 0 8px 40px rgba(0, 0, 0, 0.18);
      z-index: calc(var(--z-modal, 1000) + 1);
      animation: popoverIn 200ms var(--bounce);
      padding: var(--space-md);
      overflow-y: auto;
    }

    .custom-inputs {
      flex-direction: column;
      align-items: stretch;
      gap: var(--space-sm);
    }

    .date-apply {
      width: 100%;
      justify-content: center;
    }

    @keyframes sheetUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  }
</style>

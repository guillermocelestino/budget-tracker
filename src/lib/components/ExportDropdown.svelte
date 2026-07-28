<script lang="ts">
  let {
    totalFilteredCount = 0,
    filterSummary = '',
    onExport,
  }: {
    totalFilteredCount?: number;
    filterSummary?: string;
    onExport?: (format: 'csv' | 'pdf') => void;
  } = $props();

  let isOpen = $state(false);
  let buttonEl = $state<HTMLButtonElement | null>(null);
  let dropdownEl = $state<HTMLDivElement | null>(null);

  const hasFilters = $derived(filterSummary.length > 0);

  function toggle() {
    isOpen = !isOpen;
  }

  function close() {
    isOpen = false;
  }

  function handleSelect(format: 'csv' | 'pdf') {
    onExport?.(format);
    close();
  }

  // ─── Click-outside + Escape key ───
  $effect(() => {
    if (!isOpen) return;

    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        dropdownEl &&
        !dropdownEl.contains(target) &&
        buttonEl &&
        !buttonEl.contains(target)
      ) {
        close();
      }
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }

    // Defer adding the click listener so the toggle click doesn't
    // immediately trigger the outside-detection.
    const timer = setTimeout(() => {
      document.addEventListener('click', onClick);
    }, 0);
    document.addEventListener('keydown', onKey);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  });
</script>

<div class="ex-wrapper">
  <!-- ═══ Trigger button ═══ -->
  <button
    bind:this={buttonEl}
    class="ex-btn"
    class:active={isOpen}
    onclick={toggle}
    aria-expanded={isOpen}
    aria-haspopup="true"
    type="button"
  >
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" x2="12" y1="15" y2="3"/>
    </svg>
    Export
    <svg class="ex-chevron" class:open={isOpen} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
    {#if hasFilters}
      <span class="ex-dot"></span>
    {/if}
  </button>

  <!-- ═══ Dropdown panel ═══ -->
  {#if isOpen}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div bind:this={dropdownEl} class="ex-dropdown" role="menu">
      <!-- Summary bar -->
      <div class="ex-summary">
        Exporting {totalFilteredCount.toLocaleString()} transaction{totalFilteredCount !== 1 ? 's' : ''}
        {#if hasFilters}
          <span class="ex-badge">Filtered</span>
        {:else}
          <span class="ex-muted">All</span>
        {/if}
      </div>

      <!-- CSV option -->
      <button class="ex-option" onclick={() => handleSelect('csv')} role="menuitem" type="button">
        <div class="ex-option-icon csv-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="3" y1="9" x2="21" y2="9"/>
            <line x1="9" y1="3" x2="9" y2="21"/>
            <line x1="3" y1="15" x2="21" y2="15"/>
            <line x1="15" y1="3" x2="15" y2="21"/>
          </svg>
        </div>
        <div class="ex-option-body">
          <span class="ex-option-title">Spreadsheet (CSV)</span>
          <span class="ex-option-sub">Best for Excel, Sheets, or backups</span>
        </div>
      </button>

      <!-- PDF option -->
      <button class="ex-option" onclick={() => handleSelect('pdf')} role="menuitem" type="button">
        <div class="ex-option-icon pdf-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="8" y1="13" x2="16" y2="13"/>
            <line x1="8" y1="17" x2="16" y2="17"/>
          </svg>
        </div>
        <div class="ex-option-body">
          <span class="ex-option-title">Document (PDF)</span>
          <span class="ex-option-sub">Best for printing, accountants, or records</span>
        </div>
      </button>
    </div>
  {/if}
</div>

<style>
  /* ═══════════════════════════════════════════
     EXPORT DROPDOWN
     ═══════════════════════════════════════════ */

  .ex-wrapper {
    position: relative;
    display: inline-block;
  }

  /* ─── Trigger Button ─── */

  .ex-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: var(--space-sm) var(--space-md);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    min-height: 44px;
    transition: all var(--transition-fast);
    position: relative;
    white-space: nowrap;
  }

  .ex-btn:hover {
    background: var(--color-primary-light);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .ex-btn.active {
    background: var(--color-primary-light);
    border-color: var(--color-primary);
    color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-light);
  }

  .ex-chevron {
    transition: transform var(--transition-fast);
  }

  .ex-chevron.open {
    transform: rotate(180deg);
  }

  /* Active-filter dot indicator */
  .ex-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--color-primary);
    position: absolute;
    top: 8px;
    right: 6px;
  }

  /* ─── Dropdown Panel ─── */

  .ex-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    width: 320px;
    max-width: calc(100vw - 24px);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.06);
    z-index: 50;
    overflow: hidden;
    animation: dropIn 180ms cubic-bezier(0.22, 1, 0.36, 1);
    transform-origin: top right;
  }

  [data-theme="dark"] .ex-dropdown {
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35), 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  @keyframes dropIn {
    from {
      opacity: 0;
      transform: translateY(-6px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  /* ─── Summary Bar ─── */

  .ex-summary {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: var(--space-sm) var(--space-md);
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    font-weight: 500;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg);
  }

  .ex-badge {
    display: inline-flex;
    align-items: center;
    padding: 1px 7px;
    border-radius: var(--radius-sm);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    background: var(--color-primary-light);
    color: var(--color-primary);
  }

  .ex-muted {
    color: var(--color-text-secondary);
    font-size: 10px;
    font-weight: 500;
    opacity: 0.7;
  }

  /* ─── Option Rows ─── */

  .ex-option {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    width: 100%;
    padding: var(--space-md);
    border: none;
    background: transparent;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition: background 120ms ease;
    border-bottom: 1px solid var(--color-border);
  }

  .ex-option:last-child {
    border-bottom: none;
  }

  .ex-option:hover {
    background: rgba(99, 102, 241, 0.04);
  }

  .ex-option:active {
    background: rgba(99, 102, 241, 0.08);
  }

  /* ─── Option Icon ─── */

  .ex-option-icon {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .csv-icon {
    background: var(--color-income-light);
    color: var(--color-income);
  }

  .pdf-icon {
    background: var(--color-expense-light);
    color: var(--color-expense);
  }

  /* ─── Option Text ─── */

  .ex-option-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .ex-option-title {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text);
  }

  .ex-option-sub {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    line-height: 1.3;
  }

  /* ═══════════════════════════════════════════
     RESPONSIVE
     ═══════════════════════════════════════════ */

  @media (max-width: 640px) {
    .ex-dropdown {
      width: calc(100vw - 24px);
      right: -12px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ex-dropdown {
      animation: none;
    }
  }
</style>

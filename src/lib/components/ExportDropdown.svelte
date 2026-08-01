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
     EXPORT DROPDOWN — Flip7
     ═══════════════════════════════════════════ */

  .ex-wrapper {
    position: relative;
    display: inline-block;
  }

  /* ─── Trigger Button: teal ghost pill ─── */

  .ex-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: var(--space-sm) var(--space-md);
    background: transparent;
    border: 1px solid var(--color-teal);
    border-radius: var(--radius-pill);
    color: var(--color-teal);
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
    background: var(--color-teal-bg);
    box-shadow: var(--glow-card);
  }

  .ex-btn.active {
    background: var(--color-teal-bg);
    border-color: var(--color-teal-dark);
    color: var(--color-teal-dark);
    box-shadow: var(--glow-card);
  }

  .ex-btn:active {
    transform: scale(0.95);
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
    background: var(--color-gold);
    box-shadow: var(--glow-gold);
    position: absolute;
    top: 8px;
    right: 6px;
  }

  /* ─── Dropdown Panel: cream popover ─── */

  .ex-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    width: 340px;
    max-width: calc(100vw - 24px);
    background: var(--color-cream);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-card);
    z-index: 50;
    overflow: hidden;
    animation: dropIn 250ms var(--bounce);
    transform-origin: top right;
  }

  @keyframes dropIn {
    from {
      opacity: 0;
      transform: translateY(-8px) scale(0.95);
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
    color: var(--color-text-muted);
    font-weight: 500;
    border-bottom: 1px solid var(--color-hairline);
    background: var(--color-teal-bg);
  }

  .ex-badge {
    display: inline-flex;
    align-items: center;
    padding: 1px 7px;
    border-radius: var(--radius-pill);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    background: var(--color-teal);
    color: var(--color-ink-inverse);
  }

  .ex-muted {
    color: var(--color-text-muted);
    font-size: 10px;
    font-weight: 500;
    opacity: 0.7;
  }

  /* ─── Option Rows: lift + brighten on hover ─── */

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
    transition: all var(--transition-fast);
    border-bottom: 1px solid var(--color-hairline);
    position: relative;
  }

  .ex-option:last-child {
    border-bottom: none;
  }

  .ex-option:hover {
    background: var(--color-teal-bg);
    transform: translateY(-2px);
    box-shadow: var(--glow-card);
    border-radius: var(--radius-md);
    margin: 2px var(--space-xs);
    padding: var(--space-md) calc(var(--space-md) - var(--space-xs));
  }

  .ex-option:active {
    transform: scale(0.97);
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
    background: var(--color-teal-bg);
    color: var(--color-teal);
  }

  .pdf-icon {
    background: var(--color-gold-bg);
    color: var(--color-gold-dark);
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
    color: var(--color-ink);
  }

  .ex-option-sub {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    line-height: 1.3;
  }

  /* ─── Dark mode ─── */
  [data-theme="dark"] .ex-dropdown {
    background: var(--color-surface);
    border-color: var(--color-hairline);
  }

  [data-theme="dark"] .ex-summary {
    background: var(--color-surface);
  }

  [data-theme="dark"] .ex-option:hover {
    background: var(--color-teal-bg);
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
    .ex-option {
      transition: none;
    }
    .ex-option:hover {
      transform: none;
    }
  }
</style>

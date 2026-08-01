<script lang="ts">
  let {
    onImportClick,
    onExport,
  }: {
    onImportClick?: () => void;
    onExport?: (format: 'csv' | 'pdf') => void;
  } = $props();

  let isOpen = $state(false);
  let buttonEl = $state<HTMLButtonElement | null>(null);
  let menuEl = $state<HTMLDivElement | null>(null);

  function toggle() {
    isOpen = !isOpen;
  }

  function close() {
    isOpen = false;
    buttonEl?.focus();
  }

  function handleImport() {
    onImportClick?.();
    close();
  }

  function handleExport(format: 'csv' | 'pdf') {
    onExport?.(format);
    close();
  }

  $effect(() => {
    if (!isOpen) return;

    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        menuEl &&
        !menuEl.contains(target) &&
        buttonEl &&
        !buttonEl.contains(target)
      ) {
        close();
      }
    }

    function onKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        close();
      }
    }

    const timer = setTimeout(() => {
      document.addEventListener('click', onClick);
    }, 0);
    document.addEventListener('keydown', onKeydown);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKeydown);
    };
  });
</script>

<div class="more-menu-wrapper">
  <button
    bind:this={buttonEl}
    class="more-btn"
    class:active={isOpen}
    onclick={toggle}
    aria-expanded={isOpen}
    aria-haspopup="true"
    aria-label="More actions"
    type="button"
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="1"/>
      <circle cx="19" cy="12" r="1"/>
      <circle cx="5" cy="12" r="1"/>
    </svg>
    <span>More</span>
  </button>

  {#if isOpen}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div bind:this={menuEl} class="more-dropdown" role="menu" aria-label="More actions">
      <button class="more-option" onclick={handleImport} role="menuitem" type="button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        <span>Import CSV</span>
      </button>

      <div class="more-divider"></div>

      <button class="more-option" onclick={() => handleExport('csv')} role="menuitem" type="button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <line x1="3" y1="9" x2="21" y2="9"/>
          <line x1="9" y1="3" x2="9" y2="21"/>
        </svg>
        <span>Export CSV</span>
      </button>

      <button class="more-option" onclick={() => handleExport('pdf')} role="menuitem" type="button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="8" y1="13" x2="16" y2="13"/>
        </svg>
        <span>Export PDF</span>
      </button>
    </div>
  {/if}
</div>

<style>
  .more-menu-wrapper {
    position: relative;
    display: inline-block;
  }

  .more-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--color-hairline);
    background: var(--color-surface);
    color: var(--color-text-muted);
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    min-height: 40px;
    transition: all var(--transition-fast);
    -webkit-tap-highlight-color: transparent;
  }

  .more-btn:hover, .more-btn.active {
    border-color: var(--color-teal);
    background: var(--color-teal-bg);
    color: var(--color-teal);
  }

  .more-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    min-width: 180px;
    background: var(--color-cream);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card);
    z-index: var(--z-modal, 1000);
    padding: 6px;
    animation: popIn 200ms var(--bounce);
  }

  [data-theme="dark"] .more-dropdown {
    background: var(--color-surface);
    border-color: var(--color-hairline);
  }

  @keyframes popIn {
    from {
      opacity: 0;
      transform: translateY(-6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .more-option {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
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
    min-height: 40px;
  }

  .more-option:hover {
    background: var(--color-teal-bg);
    color: var(--color-teal);
  }

  .more-divider {
    height: 1px;
    background: var(--color-hairline);
    margin: 4px 6px;
  }

  @media (prefers-reduced-motion: reduce) {
    .more-dropdown {
      animation: none;
    }
  }
</style>

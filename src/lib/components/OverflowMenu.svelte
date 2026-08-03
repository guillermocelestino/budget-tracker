<script lang="ts">
  import { showInfo } from '$lib/stores/toast.svelte';

  let {
    onImportCsv,
    onExportCsv,
    onExportPdf,
  }: {
    onImportCsv?: () => void;
    onExportCsv?: () => void;
    onExportPdf?: () => void;
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

  function comingSoon(feature: string) {
    showInfo(`${feature} is coming soon`);
    close();
  }

  $effect(() => {
    if (!isOpen) return;

    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      if (menuEl && !menuEl.contains(target) && buttonEl && !buttonEl.contains(target)) {
        close();
      }
    }

    function onKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
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

<div class="overflow-wrapper">
  <button
    bind:this={buttonEl}
    class="overflow-btn"
    class:active={isOpen}
    onclick={toggle}
    aria-expanded={isOpen}
    aria-haspopup="menu"
    aria-label="More actions"
    type="button"
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="1"/>
      <circle cx="19" cy="12" r="1"/>
      <circle cx="5" cy="12" r="1"/>
    </svg>
  </button>

  {#if isOpen}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div bind:this={menuEl} class="overflow-menu" role="menu" aria-label="Import and export">
      <p class="overflow-group-label">Import</p>
      <button class="overflow-option" onclick={() => { onImportCsv?.(); close(); }} role="menuitem" type="button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        <span class="overflow-label">Import CSV</span>
      </button>
      <button class="overflow-option" onclick={() => comingSoon('Import Excel')} role="menuitem" type="button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        <span class="overflow-label">Import Excel</span>
        <span class="overflow-tag">Soon</span>
      </button>

      <div class="overflow-divider"></div>

      <p class="overflow-group-label">Export</p>
      <button class="overflow-option" onclick={() => { onExportCsv?.(); close(); }} role="menuitem" type="button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <line x1="3" y1="9" x2="21" y2="9"/>
          <line x1="9" y1="3" x2="9" y2="21"/>
        </svg>
        <span class="overflow-label">Export CSV</span>
      </button>
      <button class="overflow-option" onclick={() => comingSoon('Export Excel')} role="menuitem" type="button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <line x1="3" y1="9" x2="21" y2="9"/>
          <line x1="9" y1="3" x2="9" y2="21"/>
        </svg>
        <span class="overflow-label">Export Excel</span>
        <span class="overflow-tag">Soon</span>
      </button>
      {#if onExportPdf}
        <button class="overflow-option" onclick={() => { onExportPdf(); close(); }} role="menuitem" type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="8" y1="13" x2="16" y2="13"/>
          </svg>
          <span class="overflow-label">Export PDF</span>
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .overflow-wrapper {
    position: relative;
    display: inline-flex;
  }

  .overflow-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    border-radius: var(--radius-pill);
    border: 1px solid var(--color-hairline);
    background: var(--color-surface);
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all var(--transition-fast);
    -webkit-tap-highlight-color: transparent;
  }

  .overflow-btn:hover,
  .overflow-btn.active {
    border-color: var(--color-teal);
    background: var(--color-teal-bg);
    color: var(--color-teal);
  }

  .overflow-btn:focus-visible {
    outline: 2px solid var(--color-teal);
    outline-offset: 2px;
  }

  .overflow-menu {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    min-width: 220px;
    background: var(--color-cream);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card);
    z-index: var(--z-modal, 1000);
    padding: 6px;
    animation: overflowIn 200ms var(--ease);
  }

  [data-theme="dark"] .overflow-menu {
    background: var(--color-surface);
    border-color: var(--color-hairline);
  }

  @keyframes overflowIn {
    from {
      opacity: 0;
      transform: translateY(-6px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .overflow-group-label {
    margin: 6px 12px 2px;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
  }

  .overflow-option {
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
    transition: background 180ms var(--ease);
    text-align: left;
    min-height: 48px;
  }

  .overflow-option:hover {
    background: var(--color-teal-bg);
    color: var(--color-teal);
  }

  .overflow-option:focus-visible {
    outline: 2px solid var(--color-teal);
    outline-offset: -2px;
  }

  .overflow-label {
    flex: 1;
    min-width: 0;
  }

  .overflow-tag {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    color: var(--color-gold-dark);
    background: var(--color-gold-bg);
    border-radius: var(--radius-pill);
    padding: 2px 8px;
  }

  .overflow-divider {
    height: 1px;
    background: var(--color-hairline);
    margin: 4px 6px;
  }

  @media (prefers-reduced-motion: reduce) {
    .overflow-menu {
      animation: none;
    }
  }
</style>

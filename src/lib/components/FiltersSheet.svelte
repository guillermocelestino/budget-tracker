<script lang="ts">
  import { tick } from 'svelte';
  import type { Snippet } from 'svelte';

  let {
    open = $bindable(false),
    onClose = () => {},
    children,
  }: {
    open?: boolean;
    onClose?: () => void;
    children?: Snippet;
  } = $props();

  let panelEl = $state<HTMLDivElement | null>(null);

  // Lock body scroll while open
  $effect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  });

  // Focus the first focusable control on open
  $effect(() => {
    if (!open) return;
    tick().then(() => {
      const first = panelEl?.querySelector<HTMLElement>('button, input, select');
      first?.focus();
    });
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    // Trap Tab inside the sheet while open.
    if (e.key === 'Tab' && panelEl) {
      const focusables = Array.from(
        panelEl.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="filters-backdrop" onclick={onClose} role="presentation"></div>
  <div class="filters-sheet" id="filters-panel" bind:this={panelEl} role="dialog" aria-modal="true" aria-label="Filters">
    <div class="filters-handle" aria-hidden="true"></div>
    <div class="filters-header">
      <h3 class="filters-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
        </svg>
        Filters
      </h3>
      <button class="filters-close" onclick={onClose} aria-label="Close filters">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" x2="6" y1="6" y2="18"/>
          <line x1="6" x2="18" y1="6" y2="18"/>
        </svg>
      </button>
    </div>
    <div class="filters-body">
      {@render children?.()}
    </div>
  </div>
{/if}

<style>
  .filters-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(20, 48, 46, 0.4);
    backdrop-filter: blur(3px);
    z-index: calc(var(--z-modal, 1000) + 1);
    animation: filtersFade 220ms var(--ease);
  }

  .filters-sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    max-height: 78vh;
    background: var(--color-surface);
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    box-shadow: 0 -8px 32px rgba(20, 48, 46, 0.12);
    z-index: calc(var(--z-modal, 1000) + 2);
    display: flex;
    flex-direction: column;
    padding-bottom: calc(var(--safe-bottom, 0px) + var(--space-sm));
    animation: filtersUp 220ms var(--ease);
  }

  [data-theme="dark"] .filters-sheet {
    box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.35);
  }

  .filters-handle {
    width: 40px;
    height: 5px;
    background: var(--color-gold);
    border-radius: var(--radius-pill);
    margin: var(--space-sm) auto;
    flex-shrink: 0;
    box-shadow: var(--glow-gold);
  }

  .filters-header {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-xs) var(--space-lg);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .filters-title {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
    letter-spacing: var(--letter-spacing-tight);
    color: var(--color-ink);
  }

  .filters-title svg {
    color: var(--color-teal);
  }

  .filters-close {
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px;
    border-radius: var(--radius-md);
    color: var(--color-text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    min-width: 44px;
    transition: all var(--transition-fast);
  }

  .filters-close:hover {
    background: var(--color-teal-bg);
    color: var(--color-teal);
  }

  .filters-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-md) var(--space-lg) 0;
    overscroll-behavior: contain;
  }

  @keyframes filtersFade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes filtersUp {
    from { transform: translateY(24px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .filters-sheet,
    .filters-backdrop {
      animation: none;
    }
  }
</style>

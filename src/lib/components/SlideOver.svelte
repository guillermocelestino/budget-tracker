<script lang="ts">
  let {
    isOpen = false,
    title = '',
    onClose = () => {},
    children,
  }: {
    isOpen?: boolean;
    title?: string;
    onClose?: () => void;
    children: import('svelte').Snippet;
  } = $props();

  // Detect touch device for gesture affordance
  const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  // Lock body scroll when open
  $effect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  });

  let dragY = $state(0);
  let isDragging = $state(false);
  let sheetEl = $state<HTMLElement | null>(null);

  function handleTouchStart(e: TouchEvent) {
    const scrollTop = sheetEl?.querySelector('.slide-over-body')?.scrollTop ?? 0;
    // Only initiate drag if at the top of the scroll or touching handle area
    if (scrollTop > 0) return;
    isDragging = true;
    dragY = e.touches[0].clientY;
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isDragging) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - dragY;
    // Only allow dragging down
    if (diff > 0) {
      sheetEl?.style.setProperty('transform', 'translateY(' + diff + 'px)');
    }
  }

  function handleTouchEnd(e: TouchEvent) {
    if (!isDragging) return;
    isDragging = false;
    const currentY = e.changedTouches[0].clientY;
    const diff = currentY - dragY;
    sheetEl?.style.setProperty('transform', '');
    // If dragged more than 100px, close
    if (diff > 100) {
      onClose();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="slide-over-backdrop" onclick={onClose} role="presentation"></div>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="slide-over"
    bind:this={sheetEl}
    ontouchstart={isTouchDevice ? handleTouchStart : undefined}
    ontouchmove={handleTouchMove}
    ontouchend={handleTouchEnd}
  >
    <div class="slide-over-header">
      <!-- Drag handle shown on mobile -->
      <div class="drag-handle" aria-hidden="true"></div>
      <h3>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        {title}
      </h3>
      <button class="slide-over-close" onclick={onClose} aria-label="Close">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" x2="6" y1="6" y2="18"/>
          <line x1="6" x2="18" y1="6" y2="18"/>
        </svg>
      </button>
    </div>
    <div class="slide-over-body">
      {@render children()}
    </div>
  </div>
{/if}

<style>
  .slide-over-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(2px);
    z-index: 98;
    animation: fadeIn 200ms ease;
  }

  .slide-over {
    position: fixed;
    top: 0;
    right: 0;
    width: 480px;
    max-width: 100vw;
    height: 100vh;
    height: 100dvh;
    background: var(--color-surface);
    border-left: 1px solid var(--color-border);
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.1);
    z-index: var(--z-modal);
    display: flex;
    flex-direction: column;
    animation: slideInRight 300ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  [data-theme="dark"] .slide-over {
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.3);
  }

  .drag-handle {
    display: none;
    width: 36px;
    height: 4px;
    background: var(--color-border);
    border-radius: 2px;
    margin: 0 auto;
    flex-shrink: 0;
  }

  .slide-over-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-lg) var(--space-xl);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .slide-over-header h3 {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--color-text);
  }

  .slide-over-header h3 svg {
    color: var(--color-primary);
  }

  .slide-over-close {
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px;
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    min-width: 44px;
    transition: all var(--transition-fast);
  }

  .slide-over-close:hover {
    background: var(--color-bg);
    color: var(--color-text);
  }

  .slide-over-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-lg) var(--space-xl);
  }

  @keyframes slideInRight {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @media (max-width: 640px) {
    .slide-over {
      width: 100vw;
      max-height: 92vh;
      animation: slideUp 300ms cubic-bezier(0.22, 1, 0.36, 1);
      border-left: none;
      border-radius: var(--radius-xl) var(--radius-xl) 0 0;
      padding-bottom: var(--safe-bottom, 0px);
    }

    .slide-over-body {
      padding: var(--space-md) var(--space-lg);
    }

    @keyframes slideUp {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .slide-over,
    .slide-over-backdrop {
      animation: none !important;
      transition: none !important;
      will-change: auto;
    }
  }
</style>

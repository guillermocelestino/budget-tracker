<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { tick } from 'svelte';

  type ActionId = 'transaction' | 'borrowed' | 'lent' | 'category';

  interface DialAction {
    id: ActionId;
    label: string;
    icon: string;
    bg: string;
    color: string;
    go: () => void;
  }

  const ALL_ACTIONS: DialAction[] = [
    {
      id: 'transaction',
      label: 'Transaction',
      icon: 'plus',
      bg: 'var(--color-income-light)',
      color: 'var(--color-income)',
      go: () => goto('/transactions/new'),
    },
    {
      id: 'borrowed',
      label: 'Borrowed',
      icon: 'arrowDown',
      bg: 'var(--color-coral-light)',
      color: 'var(--color-coral)',
      go: () => goto('/borrowed?add=1'),
    },
    {
      id: 'lent',
      label: 'Lent',
      icon: 'arrowUp',
      bg: 'var(--color-teal-light)',
      color: 'var(--color-teal)',
      go: () => goto('/lending?add=1'),
    },
    {
      id: 'category',
      label: 'Category',
      icon: 'tag',
      bg: 'var(--color-gold-bg)',
      color: 'var(--color-gold-dark)',
      go: () => goto('/categories?add=1'),
    },
  ];

  function priorityFor(path: string): ActionId {
    if (path.startsWith('/borrowed')) return 'borrowed';
    if (path.startsWith('/lending')) return 'lent';
    if (path.startsWith('/categories') || path.startsWith('/settings')) return 'category';
    return 'transaction';
  }

  // Context-aware order: the action matching the current page sits closest to the FAB.
  const actions = $derived.by(() => {
    const priority = priorityFor($page.url.pathname);
    const idx = ALL_ACTIONS.findIndex((a) => a.id === priority);
    return [...ALL_ACTIONS.slice(idx), ...ALL_ACTIONS.slice(0, idx)];
  });

  let open = $state(false);
  let triggerEl = $state<HTMLButtonElement | null>(null);
  let menuEl = $state<HTMLDivElement | null>(null);
  let layerEl = $state<HTMLDivElement | null>(null);

  function openDial() {
    open = true;
  }

  function close() {
    open = false;
    triggerEl?.focus();
  }

  function handleTriggerClick() {
    if (open) {
      close();
      return;
    }

    const path = $page.url.pathname;
    if (path.startsWith('/transactions')) {
      goto('/transactions?add=1');
    } else if (path.startsWith('/lending')) {
      goto('/lending?add=1');
    } else if (path.startsWith('/borrowed')) {
      goto('/borrowed?add=1');
    } else if (path.startsWith('/categories')) {
      goto('/categories?add=1');
    } else if (path.startsWith('/recurring')) {
      goto('/recurring?add=1');
    } else {
      openDial();
    }
  }

  function select(action: DialAction) {
    close();
    action.go();
  }

  // Focus the first option when the dial opens
  $effect(() => {
    if (!open) return;
    tick().then(() => {
      menuEl?.querySelector<HTMLButtonElement>('.sd-option')?.focus();
    });
  });

  // Close on click-outside or Escape (deferred listener so the opening click doesn't self-close)
  $effect(() => {
    if (!open) return;

    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      if (layerEl && !layerEl.contains(target) && triggerEl && !triggerEl.contains(target)) {
        close();
      }
    }

    function onKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }

    const timer = setTimeout(() => document.addEventListener('click', onClick), 0);
    document.addEventListener('keydown', onKeydown);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKeydown);
    };
  });

  // Portal the expanded layer out of the bottom-nav stacking context (z 90) so the dim
  // backdrop can cover the viewport and the menu paints above the "More" popup.
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }
</script>

{#snippet icon(name: string)}
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    {#if name === 'plus'}
      <line x1="12" x2="12" y1="5" y2="19" />
      <line x1="5" x2="19" y1="12" y2="12" />
    {:else if name === 'arrowDown'}
      <line x1="12" x2="12" y1="5" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    {:else if name === 'arrowUp'}
      <line x1="12" x2="12" y1="19" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    {:else if name === 'tag'}
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.83z" />
      <line x1="7" x2="7.01" y1="7" y2="7" />
    {/if}
  </svg>
{/snippet}

<!-- ═══ Expandable option layer (portaled to <body>) ═══ -->
{#if open}
  <div class="sd-layer" use:portal bind:this={layerEl}>
    <div class="sd-backdrop" onclick={close} aria-hidden="true"></div>
    <div class="sd-menu" bind:this={menuEl} role="menu" aria-label="Create">
      {#each actions as action, i (action.id)}
        <button
          class="sd-option"
          role="menuitem"
          type="button"
          onclick={() => select(action)}
          style:--i={actions.length - 1 - i}
        >
          <span class="sd-option-icon" style:--opt-bg={action.bg} style:--opt-color={action.color}>
            {@render icon(action.icon)}
          </span>
          <span>{action.label}</span>
        </button>
      {/each}
    </div>
  </div>
{/if}

<!-- ═══ Gold trigger (replaces the old single-purpose + FAB) ═══ -->
<button
  bind:this={triggerEl}
  class="sd-trigger"
  class:open
  onclick={handleTriggerClick}
  aria-label="Create"
  aria-haspopup="menu"
  aria-expanded={open}
  type="button"
>
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <line x1="12" x2="12" y1="5" y2="19" />
    <line x1="5" x2="19" y1="12" y2="12" />
  </svg>
</button>

<style>
  /* ═══ Gold trigger (matches the retired .bn-fab) ═══ */
  .sd-trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 54px;
    height: 54px;
    border: none;
    border-radius: var(--radius-pill);
    background: linear-gradient(135deg, var(--color-gold) 0%, var(--color-gold-dark) 100%);
    color: var(--color-on-gold);
    box-shadow: var(--glow-gold);
    cursor: pointer;
    position: relative;
    overflow: hidden;
    -webkit-tap-highlight-color: transparent;
    transition: all var(--transition-fast);
    animation: sd-spring-in 600ms var(--bounce) backwards;
  }

  /* Gloss sheen on trigger */
  .sd-trigger::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, transparent 50%);
    border-radius: var(--radius-pill);
    pointer-events: none;
  }

  .sd-trigger:hover {
    transform: translateY(-2px) scale(1.04);
    box-shadow: 0 6px 24px rgba(255, 210, 63, 0.55);
  }

  .sd-trigger:active {
    transform: scale(0.95);
    box-shadow: var(--glow-gold);
  }

  .sd-trigger svg {
    transition: transform 200ms var(--bounce);
  }

  .sd-trigger.open svg {
    transform: rotate(45deg);
  }

  @keyframes sd-spring-in {
    0% { transform: scale(0); opacity: 0; }
    60% { transform: scale(1.12); }
    100% { transform: scale(1); opacity: 1; }
  }

  /* ═══ Portaled layer: dim backdrop + option menu ═══ */
  .sd-layer {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal);
  }

  .sd-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(20, 48, 46, 0.4);
    animation: sd-fade 200ms var(--ease) backwards;
  }

  .sd-menu {
    position: absolute;
    bottom: calc(84px + var(--safe-bottom, 0px));
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column-reverse;
    gap: var(--space-sm);
    min-width: 172px;
    max-width: calc(100vw - 24px);
    animation: sd-rise 220ms var(--ease) backwards;
  }

  .sd-option {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-sm) var(--space-md);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
    color: var(--color-text);
    font-family: inherit;
    font-size: var(--font-size-sm);
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
    min-height: 48px;
    -webkit-tap-highlight-color: transparent;
    animation: sd-pop 240ms var(--bounce) backwards;
    animation-delay: calc(var(--i) * 40ms);
  }

  .sd-option:active {
    transform: scale(0.97);
  }

  .sd-option-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 34px;
    height: 34px;
    border-radius: var(--radius-full);
    background: var(--opt-bg);
    color: var(--opt-color);
  }

  @keyframes sd-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes sd-rise {
    from { opacity: 0; transform: translate(-50%, 12px); }
    to { opacity: 1; transform: translate(-50%, 0); }
  }

  @keyframes sd-pop {
    from { opacity: 0; transform: translateY(10px) scale(0.92); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  @media (max-width: 480px) {
    .sd-trigger {
      width: 48px;
      height: 48px;
    }
  }
</style>

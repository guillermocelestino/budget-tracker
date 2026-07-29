<script lang="ts">
  import { page } from '$app/stores';
  import { fly } from 'svelte/transition';

  let moreOpen = $state(false);
  let moreBtnEl = $state<HTMLButtonElement | null>(null);
  let morePanelEl = $state<HTMLDivElement | null>(null);

  // Close "More" on click-outside
  $effect(() => {
    if (!moreOpen) return;

    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        morePanelEl &&
        !morePanelEl.contains(target) &&
        moreBtnEl &&
        !moreBtnEl.contains(target)
      ) {
        moreOpen = false;
      }
    }

    const timer = setTimeout(() => document.addEventListener('click', onClick), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', onClick);
    };
  });

  function isActive(href: string): boolean {
    const path = $page.url.pathname;
    if (href === '/') return path === '/';
    return path.startsWith(href);
  }
</script>

<!-- ═══ Bottom navigation bar ═══ -->
<nav class="bottom-nav" aria-label="Mobile navigation">
  <!-- Dashboard -->
  <a
    href="/dashboard"
    class="bn-item"
    class:active={isActive('/dashboard')}
    aria-label="Dashboard"
  >
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/>
      <rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>
    </svg>
    <span class="bn-label">Home</span>
  </a>

  <!-- Transactions -->
  <a
    href="/transactions"
    class="bn-item"
    class:active={isActive('/transactions')}
    aria-label="Transactions"
  >
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/>
    </svg>
    <span class="bn-label">Activity</span>
  </a>

  <!-- ═══ Floating Action Button (centered, prominent) ═══ -->
  <div class="bn-fab-wrap">
    <a
      href="/transactions/new"
      class="bn-fab"
      aria-label="Add transaction"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" x2="12" y1="5" y2="19"/>
        <line x1="5" x2="19" y1="12" y2="12"/>
      </svg>
    </a>
  </div>

  <!-- Reports -->
  <a
    href="/reports"
    class="bn-item"
    class:active={isActive('/reports')}
    aria-label="Reports"
  >
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>
    </svg>
    <span class="bn-label">Reports</span>
  </a>

  <!-- More (opens popup) -->
  <button
    bind:this={moreBtnEl}
    class="bn-item bn-more-btn"
    class:active={moreOpen}
    onclick={() => (moreOpen = !moreOpen)}
    aria-label="More"
    aria-expanded={moreOpen}
  >
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
    </svg>
    <span class="bn-label">More</span>
  </button>
</nav>

<!-- ═══ More popup panel ═══ -->
{#if moreOpen}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={morePanelEl}
    class="more-panel"
    role="menu"
    transition:fly={{ y: 12, duration: 150, opacity: 0 }}
  >
    <a href="/lending" class="more-item" role="menuitem" class:active={isActive('/lending')} onclick={() => (moreOpen = false)}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m20.42 4.58-7.65 7.65-2.12-2.12a1.5 1.5 0 0 0-2.12 2.12l3.54 3.54a1.5 1.5 0 0 0 2.12-2.12L12 12"/>
        <path d="m8.58 15.42-3.54 3.54"/><path d="m15.42 8.58 3.54-3.54"/>
      </svg>
      Lending
    </a>
    <a href="/categories" class="more-item" role="menuitem" class:active={isActive('/categories')} onclick={() => (moreOpen = false)}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/>
        <path d="M7 7h.01"/>
      </svg>
      Categories
    </a>
    <a href="/settings" class="more-item" role="menuitem" class:active={isActive('/settings')} onclick={() => (moreOpen = false)}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
      Settings
    </a>
  </div>
{/if}

<style>
  /* ═══════════════════════════════════════════════
     BOTTOM NAVIGATION — Flip7 Design
     ═══════════════════════════════════════════════ */

  /* Only visible on mobile */
  .bottom-nav {
    display: none;
    position: fixed;
    bottom: var(--safe-bottom, 0px);
    left: 12px;
    right: 12px;
    height: 64px;
    margin-bottom: 8px;
    background: var(--color-surface);
    border: 1px solid var(--color-hairline);
    box-shadow: var(--shadow-card);
    border-radius: var(--radius-pill);
    z-index: var(--z-sidebar);
    flex-direction: row;
    align-items: stretch;
    justify-content: space-around;
    padding: 0 4px;
  }

  @media (max-width: 768px) {
    .bottom-nav {
      display: flex;
    }
  }

  /* ─── Tab items ─── */

  .bn-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    flex: 1;
    min-width: 0;
    padding: 4px 2px;
    color: var(--color-text-muted);
    text-decoration: none;
    cursor: pointer;
    border: none;
    background: none;
    font-family: inherit;
    transition: all var(--transition-fast);
    position: relative;
    border-radius: var(--radius-lg);
    -webkit-tap-highlight-color: transparent;
  }

  .bn-item:active {
    transform: scale(0.92);
  }

  .bn-item.active:active {
    transform: scale(0.94);
  }

  .bn-item.active {
    color: var(--color-teal);
    background: var(--color-teal-bg);
  }

  .bn-item:hover {
    color: var(--color-teal);
    text-decoration: none;
  }

  .bn-item svg {
    transition: transform 200ms var(--bounce);
  }

  .bn-item.active svg {
    transform: scale(1.1);
    color: var(--color-teal);
  }

  /* Gold dot indicator on active tab */
  .bn-item.active::after {
    content: '';
    position: absolute;
    top: -16px;
    left: 50%;
    transform: translateX(-50%);
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-gold);
    box-shadow: 0 0 6px rgba(255, 210, 63, 0.6);
    animation: dot-in 250ms var(--bounce) both;
  }

  @keyframes dot-in {
    from { transform: translateX(-50%) scale(0); opacity: 0; }
    to { transform: translateX(-50%) scale(1); opacity: 1; }
  }

  .bn-label {
    font-size: 10px;
    font-weight: 600;
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .bn-item.active .bn-label {
    color: var(--color-teal);
    font-weight: var(--font-weight-bold);
  }

  /* ─── Floating Action Button ─── */

  .bn-fab-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    position: relative;
    top: -16px;
    width: 56px;
  }

  .bn-fab {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 54px;
    height: 54px;
    border-radius: var(--radius-pill);
    background: linear-gradient(135deg, var(--color-gold) 0%, var(--color-gold-dark) 100%);
    color: var(--color-ink);
    box-shadow: var(--glow-gold);
    transition: all var(--transition-fast);
    text-decoration: none;
    position: relative;
    overflow: hidden;
    -webkit-tap-highlight-color: transparent;
    animation: fab-spring-in 600ms var(--bounce) both;
  }

  /* Gloss sheen on FAB */
  .bn-fab::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(255,255,255,0.30) 0%, transparent 50%);
    border-radius: var(--radius-pill);
    pointer-events: none;
  }

  @keyframes fab-spring-in {
    0% { transform: scale(0); opacity: 0; }
    60% { transform: scale(1.12); }
    100% { transform: scale(1); opacity: 1; }
  }

  .bn-fab:hover {
    transform: translateY(-2px) scale(1.04);
    box-shadow: 0 6px 24px rgba(255, 210, 63, 0.55);
    text-decoration: none;
  }

  .bn-fab:active {
    transform: scale(0.95);
    box-shadow: var(--glow-gold);
  }

  /* ─── More popup panel ─── */

  .more-panel {
    position: fixed;
    bottom: 80px;
    right: 12px;
    min-width: 180px;
    background: var(--color-cream);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-card);
    z-index: calc(var(--z-sidebar) + 1);
    overflow: hidden;
    padding: 6px;
  }

  [data-theme="dark"] .more-panel {
    background: var(--color-surface);
    border-color: var(--color-hairline);
  }

  .more-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-md);
    color: var(--color-text);
    text-decoration: none;
    font-size: var(--font-size-sm);
    font-weight: 500;
    min-height: 44px;
    transition: all var(--transition-fast);
  }

  .more-item:hover {
    background: var(--color-teal-bg);
    color: var(--color-teal);
    text-decoration: none;
  }

  .more-item.active {
    color: var(--color-teal);
    background: var(--color-teal-bg);
    font-weight: var(--font-weight-semibold);
  }

  .more-item svg {
    flex-shrink: 0;
    color: var(--color-text-muted);
  }

  .more-item:hover svg,
  .more-item.active svg {
    color: var(--color-teal);
  }

  /* ═══════════════════════════════════════════════
     RESPONSIVE
     ═══════════════════════════════════════════════ */

  @media (min-width: 769px) {
    .bottom-nav {
      display: none !important;
    }
    .more-panel {
      display: none !important;
    }
  }

  @media (max-width: 480px) {
    .bn-fab-wrap {
      width: 48px;
    }
    .bn-fab {
      width: 48px;
      height: 48px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .bn-item,
    .bn-fab {
      transition: none;
    }
  }
</style>

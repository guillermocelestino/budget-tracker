<script lang="ts">
  import { page } from '$app/stores';
  import { fly } from 'svelte/transition';
  import SpeedDial from './SpeedDial.svelte';

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
  <!-- Gone -->
  <a
    href="/transactions"
    class="bn-item bn-gone"
    class:active={isActive('/transactions')}
    aria-label="Money Gone"
  >
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
    </svg>
    <span class="bn-label">Gone</span>
  </a>

  <!-- Away -->
  <a
    href="/lending"
    class="bn-item bn-away"
    class:active={isActive('/lending')}
    aria-label="Money Away"
  >
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.6 2 5.1 2 2.5 0 2.5-2 5.1-2 1.3 0 1.9.5 2.5 1"/>
      <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5 2 2.6 0 2.6 2 5.1 2 2.5 0 2.5-2 5.1-2 1.3 0 1.9.5 2.5 1"/>
      <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5 2 2.6 0 2.6 2 5.1 2 2.5 0 2.5-2 5.1-2 1.3 0 1.9.5 2.5 1"/>
    </svg>
    <span class="bn-label">Away</span>
  </a>

  <!-- ═══ Speed Dial FAB (centered, expandable) ═══ -->
  <div class="bn-fab-wrap">
    <SpeedDial />
  </div>

  <!-- Committed -->
  <a
    href="/committed"
    class="bn-item bn-committed"
    class:active={isActive('/committed')}
    aria-label="Money Committed"
  >
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
    <span class="bn-label">Committed</span>
  </a>

  <!-- More (opens popup) -->
  <button
    bind:this={moreBtnEl}
    class="bn-item bn-more-btn"
    class:active={moreOpen}
    onclick={() => (moreOpen = !moreOpen)}
    aria-label="More options"
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
    <a href="/dashboard" class="more-item" role="menuitem" class:active={isActive('/dashboard')} onclick={() => (moreOpen = false)}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/>
        <rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>
      </svg>
      Command Center
    </a>
    <a href="/money-map" class="more-item" role="menuitem" class:active={isActive('/money-map')} onclick={() => (moreOpen = false)}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"/><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/>
        <circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/>
        <line x1="7" y1="7" x2="10" y2="10"/><line x1="17" y1="7" x2="14" y2="10"/>
        <line x1="7" y1="17" x2="10" y2="14"/><line x1="17" y1="17" x2="14" y2="14"/>
      </svg>
      Money Map
    </a>
    <a href="/analysis" class="more-item" role="menuitem" class:active={isActive('/analysis')} onclick={() => (moreOpen = false)}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>
      </svg>
      Analysis
    </a>
    <a href="/borrowed" class="more-item" role="menuitem" class:active={isActive('/borrowed')} onclick={() => (moreOpen = false)}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3.58 19.42l7.65-7.65 2.12 2.12a1.5 1.5 0 0 0 2.12-2.12l-3.54-3.54a1.5 1.5 0 0 0-2.12 2.12L12 12"/>
        <path d="m15.42 8.58 3.54-3.54"/><path d="m8.58 15.42-3.54 3.54"/>
      </svg>
      Borrowed
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
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    max-width: none;
    transform: none;
    margin: 0;
    min-height: 64px;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: none;
    border-top: 1px solid rgba(0, 0, 0, 0.08);
    box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.05);
    border-top-left-radius: 18px;
    border-top-right-radius: 18px;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    z-index: var(--z-sidebar);
    flex-direction: row;
    align-items: center;
    justify-content: space-around;
    padding: 8px 12px calc(8px + env(safe-area-inset-bottom, 0px));
  }

  [data-theme="dark"] .bottom-nav {
    background: rgba(15, 23, 42, 0.95);
    border-top-color: var(--color-hairline);
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
    padding: 8px 8px;
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

  .bn-item.bn-gone.active {
    color: var(--color-money-gone);
    background: rgba(239, 108, 74, 0.12);
  }
  .bn-item.bn-gone.active svg,
  .bn-item.bn-gone.active .bn-label {
    color: var(--color-money-gone);
  }

  .bn-item.bn-away.active {
    color: var(--color-money-away);
    background: rgba(93, 173, 226, 0.12);
  }
  .bn-item.bn-away.active svg,
  .bn-item.bn-away.active .bn-label {
    color: var(--color-money-away);
  }

  .bn-item.bn-committed.active {
    color: var(--color-money-committed);
    background: rgba(255, 210, 63, 0.15);
  }
  .bn-item.bn-committed.active svg,
  .bn-item.bn-committed.active .bn-label {
    color: var(--color-money-committed);
  }

  /* Dark: the active item reads as a glowing pill */
  [data-theme="dark"] .bn-item.active {
    box-shadow: var(--glow-card);
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
    top: 0;
    margin-top: -24px;
    width: 56px;
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
  }

  @media (prefers-reduced-motion: reduce) {
    .bn-item {
      transition: none;
    }
  }
</style>

<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { prefs, updatePrefs } from '$lib/client/stores/preferences.svelte';
  import { COMMAND_CENTER_NAV, MONEY_OUT_NAV, EXPLORE_NAV } from '$lib/client/utils/modalities';

  let { onsearch }: { onsearch?: () => void } = $props();

  // ─── State ────────────────────────────────────────────────────────

  let mobileOpen = $state(false);
  let isCollapsed = $state(false);

  // Theme is managed by the shared preferences store
  const isDarkMode = $derived(
    prefs.theme === 'dark' || (prefs.theme === 'system' &&
      typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  );

  // ─── Restore saved preferences ────────────────────────────────────

  onMount(() => {
    const savedCollapsed = localStorage.getItem('sidebar-collapsed');
    if (savedCollapsed === 'true') {
      isCollapsed = true;
      document.documentElement.style.setProperty('--sidebar-width', '72px');
    } else {
      document.documentElement.style.setProperty('--sidebar-width', '256px');
    }
  });

  // ─── Actions ──────────────────────────────────────────────────────

  function toggleTheme() {
    // Toggle between light and dark (ignore 'system' mode for the toggle)
    const next = prefs.theme === 'dark' ? 'light' : 'dark';
    updatePrefs({ theme: next });
  }

  function toggleCollapse() {
    isCollapsed = !isCollapsed;
    document.documentElement.style.setProperty(
      '--sidebar-width',
      isCollapsed ? '72px' : '256px'
    );
    localStorage.setItem('sidebar-collapsed', String(isCollapsed));
  }

  function isActive(href: string): boolean {
    const path = $page.url.pathname;
    if (href === '/') return path === '/';
    return path.startsWith(href);
  }

  // ─── Icon Components (inline SVGs, project convention) ────────────

  const icons: Record<string, string> = {
    dashboard: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <rect width="7" height="7" x="3.5" y="3.5" rx="1.5"/>
      <rect width="7" height="7" x="13.5" y="3.5" rx="1.5"/>
      <rect width="7" height="7" x="13.5" y="13.5" rx="1.5"/>
      <rect width="7" height="7" x="3.5" y="13.5" rx="1.5"/>
    </svg>`,
    'money-gone': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
    </svg>`,
    'money-away': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.6 2 5.1 2 2.5 0 2.5-2 5.1-2 1.3 0 1.9.5 2.5 1"/>
      <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5 2 2.6 0 2.6 2 5.1 2 2.5 0 2.5-2 5.1-2 1.3 0 1.9.5 2.5 1"/>
      <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5 2 2.6 0 2.6 2 5.1 2 2.5 0 2.5-2 5.1-2 1.3 0 1.9.5 2.5 1"/>
    </svg>`,
    'money-committed': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>`,
    'true-position': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="6"/>
      <circle cx="12" cy="12" r="2"/>
    </svg>`,
    'money-map': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3"/><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/>
      <circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/>
      <line x1="7" y1="7" x2="10" y2="10"/><line x1="17" y1="7" x2="14" y2="10"/>
      <line x1="7" y1="17" x2="10" y2="14"/><line x1="17" y1="17" x2="14" y2="14"/>
    </svg>`,
    reports: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y1="13"/>
      <line x1="16" y1="17" x2="8" y1="17"/>
   </svg>`,
    categories: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/>
      <path d="M7 7h.01"/>
    </svg>`,
    settings: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>`,
  };
</script>

<!-- ═══ Mobile hamburger ═══ -->
<button
  class="mobile-toggle"
  onclick={() => (mobileOpen = !mobileOpen)}
  aria-label="Toggle navigation"
  aria-expanded={mobileOpen}
>
  <span class="hamburger"></span>
</button>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape' && mobileOpen) mobileOpen = false; }} />

<!-- ═══ Sidebar (desktop drawer) ═══ -->
<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions a11y_no_noninteractive_element_interactions -->
<aside class="sidebar" class:open={mobileOpen} class:collapsed={isCollapsed}>
  <!-- ─── Brand header ─── -->
  <div class="sidebar-header">
    <a href="/dashboard" class="logo-link">
      {#if !isCollapsed}
        <div class="brand-text">
          <h2>GET WRECK</h2>
          <span class="brand-tagline">MONEY OUT OS</span>
        </div>
      {:else}
        <div class="brand-text collapsed-brand">
          <h2>GW</h2>
        </div>
      {/if}
    </a>
  </div>

  <!-- ─── Scrollable Navigation Body ─── -->
  <div class="sidebar-body">
    <!-- COMMAND CENTER Section -->
    {#if !isCollapsed}
      <div class="sidebar-section-header">COMMAND CENTER</div>
    {/if}
    <nav class="sidebar-nav" aria-label="COMMAND CENTER">
      {#each COMMAND_CENTER_NAV as item (item.href)}
        <a
          href={item.href}
          class="nav-item command-center-item"
          class:active={isActive(item.href)}
          title={isCollapsed ? item.label : undefined}
        >
          <!-- icons is an internal map of inline SVG strings (not user input) -->
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          <span class="nav-icon">{@html icons[item.icon]}</span>
          <span class="nav-label">{item.label}</span>
        </a>
      {/each}
    </nav>

    <!-- Zone divider -->
    <div class="nav-divider"></div>

    <!-- MONEY OUT Section -->
    {#if !isCollapsed}
      <div class="sidebar-section-header">MONEY OUT</div>
    {/if}
    <nav class="sidebar-nav" aria-label="MONEY OUT">
      {#each MONEY_OUT_NAV as item (item.href)}
        <a
          href={item.href}
          class="nav-item modality-{item.modality}"
          class:active={isActive(item.href)}
          title={isCollapsed ? item.label : undefined}
        >
          <!-- icons is an internal map of inline SVG strings (not user input) -->
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          <span class="nav-icon">{@html icons[item.icon]}</span>
          <span class="nav-label">{item.label}</span>
        </a>
      {/each}
    </nav>

    <!-- Zone divider -->
    <div class="nav-divider"></div>

    <!-- EXPLORE Section -->
    {#if !isCollapsed}
      <div class="sidebar-section-header">EXPLORE</div>
    {/if}
    <nav class="sidebar-nav" aria-label="EXPLORE">
      {#each EXPLORE_NAV as item (item.href)}
        <a
          href={item.href}
          class="nav-item secondary-item"
          class:active={isActive(item.href)}
          title={isCollapsed ? item.label : undefined}
        >
          <!-- icons is an internal map of inline SVG strings (not user input) -->
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          <span class="nav-icon">{@html icons[item.icon]}</span>
          <span class="nav-label">{item.label}</span>
        </a>
      {/each}
    </nav>
  </div>

  <!-- ─── Footer pinned at bottom (Logout ALWAYS visible) ─── -->
  <div class="sidebar-footer">
    <!-- Logout button pinned at top of footer -->
    <a href="/logout" class="nav-item logout-link" title={isCollapsed ? 'Logout' : undefined}>
      <span class="nav-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>
        </svg>
      </span>
      {#if !isCollapsed}
        <span class="nav-label">Logout</span>
      {/if}
    </a>

    <!-- Footer utilities -->
    <div class="footer-utilities">
      <button class="footer-btn" onclick={onsearch} aria-label="Search (⌘K)" title="Search (⌘K)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/>
        </svg>
      </button>
      <button class="footer-btn" onclick={toggleTheme} aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'} title={isDarkMode ? 'Light Mode' : 'Dark Mode'}>
        {#if isDarkMode}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"/><line x1="12" x2="12" y1="1" y2="3"/><line x1="12" x2="12" y1="21" y2="23"/>
            <line x1="4.22" x2="5.64" y1="4.22" y2="5.64"/><line x1="18.36" x2="19.78" y1="18.36" y2="19.78"/>
            <line x1="1" x2="3" y1="12" y2="12"/><line x1="21" x2="23" y1="12" y2="12"/>
            <line x1="4.22" x2="5.64" y1="19.78" y2="18.36"/><line x1="18.36" x2="19.78" y1="5.64" y2="4.22"/>
          </svg>
        {:else}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        {/if}
      </button>
      <button class="footer-btn" onclick={toggleCollapse} aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={isCollapsed ? 'Expand' : 'Collapse'}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m15 18-6-6 6-6"/>
        </svg>
      </button>
    </div>
  </div>
</aside>

<!-- ═══ Mobile overlay ═══ -->
{#if mobileOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions a11y_no_noninteractive_element_interactions -->
  <div class="sidebar-overlay" onclick={() => (mobileOpen = false)} role="presentation"></div>
{/if}

<style>
  /* ═══════════════════════════════════════════════════════════════════
     SIDEBAR COMPLETE — Flip7 Design
     Tokens: variables.css (--color-teal, --color-gold, --color-hairline, etc.)
     ═══════════════════════════════════════════════════════════════════ */

  /* ─── Mobile hamburger ─── */
  .mobile-toggle {
    display: none;
    position: fixed;
    top: var(--space-sm);
    left: var(--space-sm);
    z-index: 100;
    background: var(--color-surface);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-md);
    padding: 10px;
    cursor: pointer;
    min-width: 44px;
    min-height: 44px;
    align-items: center;
    justify-content: center;
    box-shadow: var(--shadow-sm);
    -webkit-tap-highlight-color: transparent;
  }

  .hamburger,
  .hamburger::before,
  .hamburger::after {
    display: block;
    width: 22px;
    height: 2px;
    background: var(--color-text);
    border-radius: 2px;
    position: relative;
    transition: all 200ms var(--bounce);
  }

  .hamburger::before,
  .hamburger::after {
    content: '';
    position: absolute;
    left: 0;
  }

  .hamburger::before { top: -7px; }
  .hamburger::after  { top: 7px; }

  /* ─── Sidebar shell ─── */
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    width: var(--sidebar-width, 300px);
    height: 100vh;
    height: 100dvh;
    background: var(--color-surface-inset);
    border-right: 1px solid var(--color-hairline);
    border-top-right-radius: 32px;
    border-bottom-right-radius: 32px;
    display: flex;
    flex-direction: column;
    z-index: 90;
    overflow: hidden;
    transition: width 350ms var(--bounce);
  }

  /* ─── Brand header ─── */
  .sidebar-header {
    display: flex;
    align-items: center;
    padding: 28px 24px 12px;
    min-height: 76px;
    flex-shrink: 0;
  }

  .logo-link {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    text-decoration: none;
    color: inherit;
    margin: 0 auto 0 6px;
  }

  .brand-text h2 {
    font-family: var(--font-display);
    font-size: 24px;
    font-weight: 700;
    color: var(--color-ink);
    margin: 0;
    line-height: 1.1;
    letter-spacing: -0.01em;
  }

  .brand-tagline {
    font-size: 13px;
    font-weight: 700;
    color: var(--color-teal-dark);
    text-transform: uppercase;
    letter-spacing: 0.10em;
    display: block;
    margin-top: 2px;
  }

  /* ─── Scrollable Navigation Body ─── */
  .sidebar-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(16, 147, 136, 0.2) transparent;
    padding: 6px 0;
  }

  /* ─── Centered Navigation Container (240px wide) ─── */
  .sidebar-nav {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 240px;
    margin: 0 auto;
    padding: 4px 0;
  }

  .collapsed .sidebar-nav {
    width: 100%;
    padding: 4px 0;
    align-items: center;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px 18px;
    min-height: 48px;
    color: var(--color-ink);
    text-decoration: none;
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    border-radius: 28px;
    cursor: pointer;
    position: relative;
    transition: all 180ms var(--bounce);
    -webkit-tap-highlight-color: transparent;
  }

  .nav-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    color: var(--color-teal-dark);
    transition: color 180ms var(--bounce);
  }

  /* ─── Section Header ─── */
  .sidebar-section-header {
    font-family: var(--font-display);
    font-size: 11px;
    font-weight: 800;
    color: var(--color-text-muted);
    letter-spacing: 0.12em;
    padding: 12px 28px 4px;
    text-transform: uppercase;
    opacity: 0.75;
  }

  .collapsed .sidebar-section-header {
    display: none;
  }

  /* Hover */
  .nav-item:hover {
    background: var(--color-teal-bg);
  }

  .nav-item:hover .nav-icon {
    scale: 1.05;
  }

  /* Active — solid rounded pill + soft drop shadow + white text & icon */
  .nav-item.active {
    background: var(--color-teal-dark);
    color: var(--color-ink-inverse) !important;
    font-weight: 700;
    min-height: 54px;
    border-radius: 30px;
    box-shadow: 0 6px 20px -4px rgba(20, 155, 145, 0.35);
  }

  .nav-item.active .nav-icon {
    color: var(--color-ink-inverse) !important;
  }

  /* GET WRECK Modality Active Colors */
  .nav-item.modality-gone.active {
    background: var(--color-money-gone);
    color: var(--color-ink-inverse) !important;
    box-shadow: 0 6px 20px -4px rgba(239, 108, 74, 0.45);
  }

  .nav-item.modality-away.active {
    background: var(--color-money-away);
    color: var(--color-ink-inverse) !important;
    box-shadow: 0 6px 20px -4px rgba(93, 173, 226, 0.45);
  }

  .nav-item.modality-committed.active {
    background: var(--color-money-committed);
    color: var(--color-on-gold) !important;
    box-shadow: 0 6px 20px -4px rgba(255, 210, 63, 0.50);
  }

  .nav-item.modality-committed.active .nav-icon {
    color: var(--color-on-gold) !important;
  }

  .nav-item.command-center-item.active {
    background: var(--color-teal-dark, #149B91);
    color: var(--color-ink-inverse) !important;
    font-weight: 800;
    box-shadow: 0 6px 20px -4px rgba(20, 155, 145, 0.45);
  }

  .nav-item.modality-position.active {
    background: var(--color-true-position);
    color: var(--color-ink-inverse) !important;
    box-shadow: 0 6px 20px -4px rgba(30, 140, 134, 0.45);
  }

  .nav-item:active {
    scale: 0.97;
  }

  /* Secondary items — slightly smaller text */
  .secondary-item {
    font-size: 13px;
  }

  .secondary-item.active {
    font-weight: var(--font-weight-semibold);
  }

  /* ─── Nav icon ─── */
  .nav-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    color: var(--color-text-muted);
    transition: scale 140ms var(--bounce);
  }


  /* ─── Nav label — sequenced fade for collapse/expand ─── */
  .nav-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    opacity: 1;
    transition: opacity 150ms ease 180ms;
  }

  /* ─── Collapsed state — icon-only sidebar ─── */
  .collapsed .nav-label {
    opacity: 0;
    width: 0;
    overflow: hidden;
    pointer-events: none;
    transition: opacity 100ms ease, width 0ms ease 100ms;
  }

  .collapsed .nav-item {
    justify-content: center;
    padding: 10px;
    width: 48px;
    margin: 0 auto;
    gap: 0;
  }

  .collapsed .nav-item.active {
    width: 48px;
    min-height: 48px;
  }

  .collapsed .sidebar-header {
    justify-content: center;
    padding: 28px 8px 12px;
  }

  .collapsed .logo-link {
    margin: 0;
    justify-content: center;
  }

  .collapsed .sidebar-footer {
    width: auto;
    padding: 10px 8px 16px;
  }

  .collapsed .logout-link {
    justify-content: center;
    padding: 10px;
    width: 48px;
    margin: 0 auto;
  }

  .collapsed .footer-utilities {
    justify-content: center;
    flex-direction: column;
    padding-left: 0;
  }

   /* ─── Footer pinned at bottom (Guaranteed space) ─── */
  .sidebar-footer {
    flex-shrink: 0;
    width: 200px;
    margin: 0 auto;
    padding: 10px 0 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    border-top: 1px solid var(--color-hairline);
    background: var(--color-surface-inset);
  }

  .logout-link {
    color: var(--color-coral) !important;
  }

  .logout-link .nav-icon {
    color: var(--color-coral) !important;
  }

  .logout-link:hover {
    background: var(--color-expense-light) !important;
  }

  .footer-utilities {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 8px;
    padding-left: 4px;
  }

  .footer-btn {
    appearance: none;
    -webkit-appearance: none;
    background: transparent;
    border: none;
    outline: none;
    box-shadow: none;
    color: var(--color-text-muted);
    padding: 8px;
    border-radius: 10px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    font-family: inherit;
    transition: background 140ms ease, color 140ms ease;
    -webkit-tap-highlight-color: transparent;
  }

  .footer-btn:hover {
    background: var(--color-teal-bg);
    color: var(--color-teal);
  }

  .footer-btn:focus,
  .footer-btn:focus-visible {
    outline: none;
    box-shadow: none;
    background: var(--color-teal-bg);
  }

  .footer-item {
    color: var(--color-text-muted);
    text-decoration: none;
    font-size: 14px;
    font-weight: 500;
    border-radius: 10px;
    cursor: pointer;
    background: none;
    border: none;
    font-family: inherit;
    transition: all 140ms var(--bounce);
    white-space: nowrap;
    -webkit-tap-highlight-color: transparent;
  }

  .footer-item:hover {
    background: var(--color-teal-bg);
    color: var(--color-teal);
  }



  .footer-item:active {
    scale: 0.97;
  }

  .footer-item:hover .footer-icon {
    color: var(--color-teal);
  }

  .logout-link:hover {
    color: var(--color-coral) !important;
    background: var(--color-expense-light) !important;
  }

  .footer-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    color: var(--color-text-muted);
    transition: color 140ms var(--bounce);
  }

  .collapse-trigger svg {
    transition: transform 350ms var(--bounce);
  }

  .collapsed .collapse-trigger svg {
    transform: rotate(180deg);
  }

  /* Collapsed footer items centered */
  .collapsed .footer-item {
    justify-content: center;
    padding: 10px;
    margin: 0 auto;
    width: 44px;
    border-radius: 12px;
  }

  .collapsed .sidebar-footer {
    align-items: center;
  }

  .version-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 4px 10px;
    background: var(--color-teal-bg);
    border: 1px solid var(--color-hairline);
    border-radius: 20px;
    font-size: 11px;
    font-weight: 500;
    color: var(--color-teal);
    width: fit-content;
    margin-top: var(--space-xs);
  }

  .collapsed .version-badge {
    display: none;
  }

  /* ─── Mobile overlay ─── */
  .sidebar-overlay {
    display: none;
  }

  /* ═══════════════════════════════════════════════════════════════════
     RESPONSIVE
     ═══════════════════════════════════════════════════════════════════ */

  /* ─── Tablet & down: off-canvas drawer ─── */
  @media (max-width: 768px) {
    .mobile-toggle {
      display: none !important;
    }

    .sidebar {
      display: none;
    }


    /* On mobile, labels always visible (drawer is always expanded) */
    .sidebar .nav-label {
      opacity: 1;
      width: auto;
      margin: revert;
      transition: none;
    }

    .sidebar .nav-item {
      justify-content: flex-start;
      padding: 10px 12px;
      margin: 0;
      width: auto;
      border-radius: 10px;
      border-left: 4px solid transparent;
    }

    .sidebar .sidebar-nav {
      align-items: stretch;
      padding: var(--space-xs) var(--space-sm);
    }

    .sidebar .logo-link {
      justify-content: flex-start;
    }

    .sidebar .footer-item {
      justify-content: flex-start;
      padding: 10px 12px;
      margin: 0;
      width: auto;
      border-radius: 10px;
    }

    .sidebar .sidebar-footer {
      align-items: stretch;
    }

    .sidebar .nav-divider {
      margin: var(--space-xs) var(--space-lg);
    }

    .sidebar-overlay {
      display: block;
      position: fixed;
      inset: 0;
      background: rgba(20, 48, 46, 0.40);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: 89;
      animation: overlayIn 200ms ease;
    }

    .sidebar-header {
      min-height: auto;
      padding: var(--space-md);
    }
  }

  /* ─── Reduced motion ─── */
  @media (prefers-reduced-motion: reduce) {
    .sidebar,
    .nav-item,
    .nav-label,
    .collapse-trigger svg,
    .footer-item,
    .sidebar-overlay,
    .hamburger,
    .hamburger::before,
    .hamburger::after {
      transition: none !important;
    }

    .sidebar {
      transition: width 0ms !important;
    }
  }

  /* ─── Animations ─── */
  @keyframes overlayIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
</style>

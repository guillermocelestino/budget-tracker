<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { prefs, updatePrefs } from '$lib/client/stores/preferences.svelte';

  let { onsearch }: { onsearch?: () => void } = $props();

  // ─── Navigation Architecture ──────────────────────────────────────
  // Two zones: Primary (core workflows, visited daily/weekly)
  //              Secondary (configuration, visited infrequently)

  const primaryNav = [
    { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { href: '/transactions', label: 'Transactions', icon: 'transactions' },
    { href: '/money-map', label: 'Money Map', icon: 'money-map' },
    { href: '/net-worth', label: 'Net Worth', icon: 'net-worth' },
    { href: '/lending', label: 'Lending', icon: 'lending' },
    { href: '/borrowed', label: 'Borrowed', icon: 'borrowed' },
    { href: '/recurring', label: 'Recurring', icon: 'recurring' },
    { href: '/reports', label: 'Reports', icon: 'reports' },
  ];

  const secondaryNav = [
    { href: '/categories', label: 'Categories', icon: 'categories' },
    { href: '/settings', label: 'Settings', icon: 'settings' },
  ];

  // ─── State ────────────────────────────────────────────────────────

  let mobileOpen = $state(false);
  let isCollapsed = $state(false);

  // Theme is managed by the shared preferences store (localStorage 'budget-tracker-prefs')
  // The toggle cycles between 'light' and 'dark'

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
  // Swap these for lucide-svelte <IconHome /> placeholders when ready.

  const icons: Record<string, string> = {
    dashboard: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/>
      <rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>
    </svg>`,
    transactions: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/>
    </svg>`,
    'money-map': `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3"/><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/>
      <circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/>
      <line x1="7" y1="7" x2="10" y2="10"/><line x1="17" y1="7" x2="14" y2="10"/>
      <line x1="7" y1="17" x2="10" y2="14"/><line x1="17" y1="17" x2="14" y2="14"/>
    </svg>`,
    lending: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="m20.42 4.58-7.65 7.65-2.12-2.12a1.5 1.5 0 0 0-2.12 2.12l3.54 3.54a1.5 1.5 0 0 0 2.12-2.12L12 12"/>
      <path d="m8.58 15.42-3.54 3.54"/><path d="m15.42 8.58 3.54-3.54"/>
    </svg>`,
    borrowed: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3.58 19.42l7.65-7.65 2.12 2.12a1.5 1.5 0 0 0 2.12-2.12l-3.54-3.54a1.5 1.5 0 0 0-2.12 2.12L12 12"/>
      <path d="m15.42 8.58 3.54-3.54"/><path d="m8.58 15.42-3.54 3.54"/>
    </svg>`,
    'net-worth': `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
    </svg>`,
    recurring: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
      <path d="M12 2a10 10 0 0 1 0 20 10 10 0 0 1 0-20"/>
    </svg>`,
    reports: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="12" x2="12" y1="20" y2="10"/>
      <line x1="18" x2="18" y1="20" y2="4"/>
      <line x1="6" x2="6" y1="20" y2="16"/>
      <line x1="3" x2="21" y1="20" y2="20"/>
   </svg>`,
    categories: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/>
      <path d="M7 7h.01"/>
    </svg>`,
    settings: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
      <div class="logo-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2v20M6 4h7a4 4 0 0 1 0 8H6"/><line x1="4" x2="18" y1="12" y2="12"/><line x1="4" x2="18" y1="16" y2="16"/>
        </svg>
      </div>
      {#if !isCollapsed}
        <div class="brand-text">
          <h2>Trackr</h2>
          <span class="brand-tagline">Smart Finance</span>
        </div>
      {/if}
    </a>
  </div>

  <!-- ─── Primary Navigation (core workflows) ─── -->
  <nav class="sidebar-nav" aria-label="Primary">
    {#each primaryNav as item (item.href)}
      <a
        href={item.href}
        class="nav-item"
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

  <!-- ─── Zone divider ─── -->
  <div class="nav-divider"></div>

  <!-- ─── Secondary Navigation (configuration) ─── -->
  <nav class="sidebar-nav" aria-label="Secondary">
    {#each secondaryNav as item (item.href)}
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

  <!-- ─── Push footer down ─── -->
  <div class="sidebar-spacer"></div>

  <!-- ─── Footer (theme, collapse, logout) ─── -->
  <div class="sidebar-footer">
    <!-- Theme toggle -->
    <button class="footer-item" onclick={toggleTheme} aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
      <span class="footer-icon">
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
      </span>
      {#if !isCollapsed}
        <span class="nav-label">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
      {/if}
    </button>

    <!-- Collapse toggle -->
    <button class="footer-item collapse-trigger" onclick={toggleCollapse} aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
      <span class="footer-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m15 18-6-6 6-6"/>
        </svg>
      </span>
      {#if !isCollapsed}
        <span class="nav-label">Collapse</span>
      {/if}
    </button>

    <!-- Search -->
    <button class="footer-item" onclick={onsearch} aria-label="Search (⌘K)">
      <span class="footer-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/>
        </svg>
      </span>
      {#if !isCollapsed}
        <span class="nav-label">Search</span>
        <span class="search-kbd">⌘K</span>
      {/if}
    </button>

    <!-- Logout -->
    <a href="/logout" class="footer-item logout-link">
      <span class="footer-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>
        </svg>
      </span>
      {#if !isCollapsed}
        <span class="nav-label">Logout</span>
      {/if}
    </a>

    {#if !isCollapsed}
      <div class="version-badge">v0.1.0</div>
    {/if}
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
    width: var(--sidebar-width, 256px);
    height: 100vh;
    height: 100dvh;
    background: var(--color-surface);
    border-right: 1px solid var(--color-hairline);
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
    padding: var(--space-lg);
    border-bottom: 1px solid var(--color-hairline);
    min-height: 80px;
    flex-shrink: 0;
  }

  .logo-link {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    text-decoration: none;
    color: inherit;
  }

  .logo-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    background: linear-gradient(135deg, var(--color-teal) 0%, var(--color-teal-dark) 100%);
    border-radius: var(--radius-md);
    flex-shrink: 0;
    color: white;
    box-shadow: 0 4px 16px rgba(43, 168, 162, 0.35);
  }

  .brand-text h2 {
    font-family: var(--font-display);
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-extrabold);
    color: var(--color-text);
    margin: 0;
    line-height: 1.2;
    letter-spacing: var(--letter-spacing-heading);
  }

  .brand-tagline {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    letter-spacing: var(--letter-spacing-wide);
  }

  /* ─── Navigation ─── */
  .sidebar-nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-xs) var(--space-sm);
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    min-height: 48px;
    color: var(--color-text);
    text-decoration: none;
    font-size: 14px;
    font-weight: 500;
    border-radius: 10px;
    cursor: pointer;
    border-left: 4px solid transparent;
    position: relative;
    transition: all 140ms var(--bounce);
    -webkit-tap-highlight-color: transparent;
  }

  /* Hover — subtle lift + bounce */
  .nav-item:hover {
    background: var(--color-teal-bg);
    transform: translateX(2px);
  }

  [data-theme="dark"] .nav-item:hover {
    background: rgba(43, 168, 162, 0.10);
  }

  .nav-item:hover .nav-icon {
    scale: 1.05;
  }

  /* Active — teal left accent + pill bg + gold dot */
  .nav-item.active {
    background: #2BA8A2;
    color: #FFFFFF;
    font-weight: var(--font-weight-semibold);
    border-left: 4px solid var(--color-teal);
    box-shadow: var(--glow-card);
  }

  [data-theme="dark"] .nav-item.active {
    background: #2BA8A2;
    border-left-color: var(--color-teal-light);
  }

  .nav-item.active .nav-icon {
    color: #FFFFFF;
  }

  /* Gold dot prefix on active label */
  .nav-item.active .nav-label::before {
    content: '●';
    color: var(--color-gold);
    font-size: 8px;
    margin-right: 6px;
    display: inline-block;
    vertical-align: middle;
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

  .collapsed .nav-label {
    opacity: 0;
    width: 0;
    margin: 0;
    transition: opacity 80ms ease, width 0ms linear 80ms;
  }

  /* Centered icons in collapsed mode */
  .collapsed .nav-item {
    padding: 10px;
    margin: 0 auto;
    width: 44px;
    border-radius: 12px;
    border-left: none;
  }

  .collapsed .sidebar-nav {
    padding: var(--space-xs) 0;
    align-items: center;
  }

  .collapsed .nav-icon {
    margin: 0;
  }

  .collapsed .logo-link {
    justify-content: center;
  }

  /* ─── Zone divider ─── */
  .nav-divider {
    height: 1px;
    background: var(--color-hairline);
    margin: var(--space-xs) var(--space-lg);
    flex-shrink: 0;
    transition: margin 350ms var(--bounce);
  }

  .collapsed .nav-divider {
    margin: var(--space-xs) var(--space-md);
  }

  /* ─── Spacer ─── */
  .sidebar-spacer {
    flex: 1;
  }

  /* ─── Footer ─── */
  .sidebar-footer {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-md);
    border-top: 1px solid var(--color-hairline);
    flex-shrink: 0;
  }

  .footer-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    min-height: 44px;
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

  [data-theme="dark"] .footer-item:hover {
    background: rgba(43, 168, 162, 0.10);
    color: var(--color-teal-light);
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

  [data-theme="dark"] .logout-link:hover {
    background: rgba(239, 108, 74, 0.12) !important;
    color: var(--color-coral-light) !important;
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

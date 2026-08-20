<script lang="ts">
  import { page } from '$app/stores';
  import { prefs, updatePrefs } from '$lib/client/stores/preferences.svelte';
  import { COMMAND_CENTER_NAV, MONEY_OUT_NAV, EXPLORE_NAV } from '$lib/client/utils/modalities';

  let { onsearch }: { onsearch?: () => void } = $props();

  let mobileOpen = $state(false);

  // Dark mode state from preferences store
  const isDarkMode = $derived(
    prefs.theme === 'dark' || (prefs.theme === 'system' &&
      typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  );

  function toggleTheme() {
    const next = prefs.theme === 'dark' ? 'light' : 'dark';
    updatePrefs({ theme: next });
  }

  function isActive(href: string): boolean {
    const path = $page.url.pathname;
    if (href === '/dashboard') {
      return path === '/dashboard' || path === '/' || path.startsWith('/dashboard/');
    }
    if (href === '/committed' || href === '/recurring') {
      return path.startsWith('/committed') || path.startsWith('/recurring');
    }
    return path.startsWith(href);
  }

  function getThemeClass(href: string): string {
    if (href === '/dashboard') return 'theme-teal';
    if (href === '/transactions') return 'theme-coral';
    if (href === '/lending') return 'theme-sky';
    if (href === '/committed' || href === '/recurring') return 'theme-amber';
    return 'theme-neutral';
  }

  // ─── Icon Components (inline SVGs matching project convention & mock) ───
  const icons: Record<string, string> = {
    dashboard: `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <rect width="7" height="7" x="3.5" y="3.5" rx="1.5"/>
      <rect width="7" height="7" x="13.5" y="3.5" rx="1.5"/>
      <rect width="7" height="7" x="13.5" y="13.5" rx="1.5"/>
      <rect width="7" height="7" x="3.5" y="13.5" rx="1.5"/>
    </svg>`,
    'money-gone': `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2c0 5-4 7-4 11 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-4-6-4-11z"/>
      <path d="M12 13c-1.1 0-2 .9-2 2 0 1.66 1.34 3 3 3s3-1.34 3-3c0-1.1-.9-2-2-2z"/>
    </svg>`,
    'money-away': `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>`,
    'money-committed': `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>`,
    'true-position': `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
    </svg>`,
    'money-map': `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
      <line x1="8" y1="2" x2="8" y2="18"/>
      <line x1="16" y1="6" x2="16" y2="22"/>
    </svg>`,
    reports: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>`,
    categories: `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <rect width="7" height="7" x="3.5" y="3.5" rx="1.5"/>
      <rect width="7" height="7" x="13.5" y="3.5" rx="1.5"/>
      <rect width="7" height="7" x="13.5" y="13.5" rx="1.5"/>
      <rect width="7" height="7" x="3.5" y="13.5" rx="1.5"/>
    </svg>`,
    settings: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>`,
  };
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape' && mobileOpen) mobileOpen = false; }} />

<!-- ═══ Floating Dark Teal Sidebar ═══ -->
<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions a11y_no_noninteractive_element_interactions -->
<aside class="sidebar" class:open={mobileOpen}>
  <!-- ─── Brand header ─── -->
  <div class="sidebar-header">
    <a href="/dashboard" class="logo-link">
      <div class="brand-text">
        <h2 class="brand-title">WRECKRD</h2>
        <span class="brand-subtitle">Track. Wreck. Repeat.</span>
      </div>
    </a>
  </div>

  <!-- ─── Scrollable Navigation Body ─── -->
  <div class="sidebar-body">
    <!-- COMMAND CENTER Section -->
    <nav class="sidebar-nav" aria-label="COMMAND CENTER">
      {#each COMMAND_CENTER_NAV as item (item.href)}
        <a
          href={item.href}
          class="nav-item {getThemeClass(item.href)}"
          class:active={isActive(item.href)}
        >
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          <span class="nav-icon">{@html icons[item.icon]}</span>
          <span class="nav-label">{item.label}</span>
        </a>
      {/each}
    </nav>

    <!-- MONEY OUT Section -->
    <nav class="sidebar-nav" aria-label="MONEY OUT">
      {#each MONEY_OUT_NAV as item (item.href)}
        <a
          href={item.href}
          class="nav-item {getThemeClass(item.href)}"
          class:active={isActive(item.href)}
        >
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          <span class="nav-icon">{@html icons[item.icon]}</span>
          <span class="nav-label">{item.label}</span>
        </a>
      {/each}
    </nav>

    <!-- EXPLORE Section -->
    <nav class="sidebar-nav" aria-label="EXPLORE">
      {#each EXPLORE_NAV as item (item.href)}
        <a
          href={item.href}
          class="nav-item {getThemeClass(item.href)}"
          class:active={isActive(item.href)}
        >
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          <span class="nav-icon">{@html icons[item.icon]}</span>
          <span class="nav-label">{item.label}</span>
        </a>
      {/each}
    </nav>

    <!-- ─── Pinned Footer Utilities & Logout at bottom ─── -->
    <div class="sidebar-footer-wrap">
      <a href="/logout" class="nav-item logout-item">
        <span class="nav-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>
          </svg>
        </span>
        <span class="nav-label">Logout</span>
      </a>

      <div class="sidebar-footer-utils">
        {#if onsearch}
          <button class="footer-btn" onclick={onsearch} aria-label="Search (⌘K)" title="Search (⌘K)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/>
            </svg>
          </button>
        {/if}
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
      </div>
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
     DARK SIDEBAR — Floating Teal Panel (Matches Mockup)
     ═══════════════════════════════════════════════════════════════════ */

  .sidebar {
    position: fixed;
    top: 12px;
    left: 12px;
    bottom: 12px;
    width: 190px;
    height: calc(100vh - 24px);
    height: calc(100dvh - 24px);
    background: #1E3D38;
    border: 1px solid rgba(255, 255, 255, 0.10);
    border-radius: 24px;
    display: flex;
    flex-direction: column;
    z-index: 90;
    overflow: hidden;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
    transition: transform 300ms ease;
  }

  /* ─── Brand header ─── */
  .sidebar-header {
    padding: 24px 16px 16px;
    text-align: center;
    flex-shrink: 0;
  }

  .logo-link {
    text-decoration: none;
    color: inherit;
    display: block;
  }

  .brand-title {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 800;
    color: #FFFFFF;
    letter-spacing: 0.02em;
    margin: 0;
    line-height: 1.1;
  }

  .brand-subtitle {
    font-family: var(--font-display);
    font-size: 10px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.60);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    display: block;
    margin-top: 4px;
  }

  /* ─── Scrollable Navigation Body ─── */
  .sidebar-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
    padding: 4px 12px 16px;
    display: flex;
    flex-direction: column;
  }

  .sidebar-nav {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 2px 0;
  }

  .nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 10px 8px;
    gap: 4px;
    color: rgba(255, 255, 255, 0.88);
    text-decoration: none;
    font-family: var(--font-display);
    font-size: 12px;
    font-weight: 500;
    border-radius: var(--radius-xl, 16px);
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 0.2s ease-in-out;
    -webkit-tap-highlight-color: transparent;
  }

  .nav-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    color: currentColor;
    transition: transform 0.2s ease-in-out, color 0.2s ease-in-out;
  }

  .nav-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.2;
    max-width: 100%;
  }

  /* ─── Hover state ─── */
  .nav-item:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--color-ink-inverse, #FFFFFF);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .nav-item:hover .nav-icon {
    transform: translateY(-1px);
  }

  /* ═══════════════════════════════════════════════════════════════════
     ROUTE-THEMED DYNAMIC ACTIVE PILL SYSTEM (Referencing variable.css)
     ═══════════════════════════════════════════════════════════════════ */
  .nav-item.active {
    font-weight: 700;
  }

  /* 🎯 Command Center (/dashboard) — Soft Teal */
  .nav-item.active.theme-teal {
    background: color-mix(in srgb, var(--color-teal, #2BA8A2) 22%, transparent);
    color: var(--color-teal-light, #3CC4BD);
    border: 1px solid color-mix(in srgb, var(--color-teal, #2BA8A2) 35%, transparent);
    box-shadow: 0 4px 16px rgba(43, 168, 162, 0.25);
  }

  .nav-item.active.theme-teal .nav-icon {
    color: var(--color-teal-light, #3CC4BD);
  }

  /* 🔥 Money Gone (/transactions) — Soft Coral */
  .nav-item.active.theme-coral {
    background: color-mix(in srgb, var(--color-coral, #EF6C4A) 22%, transparent);
    color: var(--color-coral-light, #FF8A6A);
    border: 1px solid color-mix(in srgb, var(--color-coral, #EF6C4A) 35%, transparent);
    box-shadow: var(--glow-coral, 0 4px 16px rgba(239, 108, 74, 0.28));
  }

  .nav-item.active.theme-coral .nav-icon {
    color: var(--color-coral-light, #FF8A6A);
  }

  /* 🌊 Money Away (/lending) — Soft Sky Blue */
  .nav-item.active.theme-sky {
    background: color-mix(in srgb, var(--color-sky, #5DADE2) 22%, transparent);
    color: var(--color-sky-light, #7FC0EB);
    border: 1px solid color-mix(in srgb, var(--color-sky, #5DADE2) 35%, transparent);
    box-shadow: var(--glow-sky, 0 4px 16px rgba(93, 173, 226, 0.25));
  }

  .nav-item.active.theme-sky .nav-icon {
    color: var(--color-sky-light, #7FC0EB);
  }

  /* 🔒 Money Committed (/committed or /recurring) — Soft Amber/Gold */
  .nav-item.active.theme-amber {
    background: color-mix(in srgb, var(--color-gold, #FFD23F) 22%, transparent);
    color: var(--color-gold, #FFD23F);
    border: 1px solid color-mix(in srgb, var(--color-gold, #FFD23F) 35%, transparent);
    box-shadow: var(--glow-gold, 0 4px 16px rgba(255, 210, 63, 0.25));
  }

  .nav-item.active.theme-amber .nav-icon {
    color: var(--color-gold, #FFD23F);
  }

  /* ⚙ Utility / Secondary Views (True Position, Analysis, Settings) — Soft Neutral */
  .nav-item.active.theme-neutral {
    background: rgba(255, 255, 255, 0.12);
    color: var(--color-ink-inverse, #FFFFFF);
    border: 1px solid rgba(255, 255, 255, 0.25);
    box-shadow: 0 4px 16px rgba(255, 255, 255, 0.12);
  }

  .nav-item.active.theme-neutral .nav-icon {
    color: var(--color-ink-inverse, #FFFFFF);
  }

  /* ─── Pinned Footer Utilities & Logout at bottom ─── */
  .sidebar-footer-wrap {
    margin-top: auto;
    padding-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .logout-item {
    color: rgba(255, 255, 255, 0.75);
  }

  .logout-item:hover {
    background: rgba(239, 108, 74, 0.18);
    color: #FF8A6A;
  }

  .sidebar-footer-utils {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .footer-btn {
    appearance: none;
    -webkit-appearance: none;
    background: transparent;
    border: none;
    outline: none;
    color: rgba(255, 255, 255, 0.70);
    padding: 6px;
    border-radius: 10px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    transition: background 140ms ease, color 140ms ease;
    -webkit-tap-highlight-color: transparent;
  }

  .footer-btn:hover {
    background: rgba(255, 255, 255, 0.10);
    color: #FFFFFF;
  }

  /* ─── Responsive (Mobile) ─── */
  @media (max-width: 768px) {
    .sidebar {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sidebar,
    .nav-item,
    .nav-icon {
      transition: none !important;
    }
  }
</style>

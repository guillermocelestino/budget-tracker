<script lang="ts">
  import { browser } from '$app/environment';
  import FiltersSheet from '$lib/client/components/FiltersSheet.svelte';
  import type { Snippet } from 'svelte';

  /**
   * SearchFilterPill — the unified `[ 🔍 Search | Filter ]` control used on
   * /transactions and /lending. The search input and the Filter trigger are
   * merged into one rounded pill (hairline divider between them); clicking
   * Filter opens a popover on desktop and the FiltersSheet bottom sheet on
   * mobile. Both pages render their page-specific filter panel via the
   * `panel` snippet (receives the container mode and a close callback).
   *
   * Debounce is intentionally page-owned (Transactions already debounces
   * into its URL sync; Lending debounces into its search term) so this stays
   * a dumb, reusable control.
   */
  let {
    value = $bindable(''),
    placeholder = 'Search…',
    ariaLabel = 'Search',
    filterAriaLabel = 'Filter',
    activeFilterCount = 0,
    open = $bindable(false),
    panel,
    loading = false,
  }: {
    value?: string;
    placeholder?: string;
    ariaLabel?: string;
    filterAriaLabel?: string;
    activeFilterCount?: number;
    open?: boolean;
    panel: Snippet<['popover' | 'sheet', () => void]>;
    loading?: boolean;
  } = $props();

  // Filter control: inline popover on desktop, FiltersSheet bottom sheet on mobile.
  let isMobile = $state(browser && window.matchMedia('(max-width: 768px)').matches);
  let popoverEl = $state<HTMLDivElement | null>(null);
  let filterBtnEl = $state<HTMLButtonElement | null>(null);

  $effect(() => {
    if (!browser) return;
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent) => (isMobile = e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  });

  // Desktop popover: focus the first control on open; close on outside
  // click or Escape (returning focus to the Filter button).
  $effect(() => {
    if (!open || isMobile) return;

    const raf = requestAnimationFrame(() => {
      popoverEl?.querySelector<HTMLElement>('button, input, select')?.focus();
    });

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!popoverEl?.contains(target) && !filterBtnEl?.contains(target)) {
        open = false;
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        open = false;
        filterBtnEl?.focus();
      }
    };

    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  });

  function closePopover() {
    open = false;
    filterBtnEl?.focus();
  }

  function closeSheet() {
    open = false;
  }
</script>

<div class="search-filter-pill" class:active={open}>
  {#if loading}
    <svg class="search-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-label="Searching">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  {:else}
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  {/if}
  <input
    type="search"
    {placeholder}
    aria-label={ariaLabel}
    bind:value
  />
  <span class="search-divider" aria-hidden="true"></span>
  <div class="pill-filter">
    <button
      class="search-filter-btn"
      class:active={activeFilterCount > 0}
      onclick={() => (open = !open)}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls="filters-panel"
      aria-label={filterAriaLabel}
      type="button"
      bind:this={filterBtnEl}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
      </svg>
      <span class="search-filter-label">Filter</span>
      {#if activeFilterCount > 0}
        <span class="filters-badge">{activeFilterCount}</span>
      {/if}
    </button>
    {#if open && !isMobile}
      <div class="filters-popover" id="filters-panel" role="dialog" aria-label="Filters" bind:this={popoverEl}>
        {@render panel('popover', closePopover)}
      </div>
    {/if}
  </div>
</div>

{#if open && isMobile}
  <FiltersSheet open={open} onClose={closeSheet}>
    {@render panel('sheet', closeSheet)}
  </FiltersSheet>
{/if}

<style>
  /* ─── Unified search + filter pill (moved from /transactions) ───
     Width is host-controlled (flex: 1 1 auto grows within its toolbar);
     pages cap it (e.g. Lending: clamp(360px, 30vw, 420px)). */
  .search-filter-pill {
    flex: 1 1 auto;
    min-width: 0;
    max-width: 100%;
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    height: 44px;
    padding: 0 var(--space-md);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-pill);
    background: var(--color-surface);
    color: var(--color-text-muted);
    transition: border-color 180ms var(--ease), box-shadow 180ms var(--ease);
  }

  .search-filter-pill:focus-within {
    border-color: var(--color-teal);
    box-shadow: var(--focus);
  }

  .search-filter-pill svg {
    flex-shrink: 0;
  }

  .search-filter-pill input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--color-text);
  }

  .search-filter-pill input::placeholder {
    color: var(--color-text-muted);
  }

  .search-filter-pill input::-webkit-search-cancel-button {
    -webkit-appearance: none;
  }

  /* Filter trigger + desktop popover anchor */
  .pill-filter {
    position: relative;
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }

  .filters-popover {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    left: auto;
    width: min(380px, calc(100vw - 32px));
    max-height: 70vh;
    overflow-y: auto;
    background: var(--color-cream);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card);
    z-index: var(--z-modal, 1000);
    padding: var(--space-sm);
    animation: fade-in-up 350ms var(--ease) both;
  }

  /* Sticky Reset/Apply footer matches the cream popover surface */
  .filters-popover :global(.filter-footer) {
    background: var(--color-cream);
  }

  /* Unified-pill divider — quiet separator, not an accent */
  .search-divider {
    width: 1px;
    height: 20px;
    flex-shrink: 0;
    background: var(--color-hairline);
    opacity: 0.6;
    margin: 0 2px;
  }

  /* In-pill Filter trigger (lives at the search pill's right edge).
     A transparent border is always reserved so state changes never shift
     layout or toolbar height. */
  .search-filter-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    flex-shrink: 0;
    height: 44px;
    min-width: 44px;
    padding: 0 var(--space-xl);   /* 24px inline hit area */
    border: 1px solid transparent;
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-text-muted);
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all 180ms var(--ease);
    -webkit-tap-highlight-color: transparent;
  }

  .search-filter-btn:hover {
    background: var(--color-teal-bg);
    color: var(--color-teal);
  }

  /* Active — one or more filters applied: glyph turns teal, count chip shown.
     Otherwise the funnel stays quiet --muted. */
  .search-filter-btn.active {
    color: var(--teal);
    font-weight: 600;
  }

  .search-filter-btn:focus-visible {
    outline: 2px solid var(--color-teal);
    outline-offset: -2px;
  }

  /* Slightly smaller filter glyph — Search is the primary control */
  .search-filter-btn svg {
    width: 14px;
    height: 14px;
  }

  .search-filter-label {
    display: inline-flex;
    color: var(--color-text-muted);
  }

  /* Pill reflects an open filter state */
  .search-filter-pill.active {
    border-color: var(--color-teal);
  }

  .filters-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: var(--radius-pill);
    background: var(--mint-tint);
    color: var(--teal-deep);
    font-size: var(--font-size-xs);
    font-weight: 700;
    font-family: var(--font-mono);
  }

  /* Mobile: the pill keeps its full width (host rules) but the Filter
     trigger collapses to an icon-only 44×44 target in the same pill. */
  @media (max-width: 768px) {
    .search-filter-label {
      display: none;
    }

    .search-filter-btn {
      width: 44px;
      padding: 0;
    }
  }
  .search-spinner {
    animation: searchSpin 600ms linear infinite;
    color: var(--color-teal, #0d9488);
    flex-shrink: 0;
  }

  @keyframes searchSpin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>

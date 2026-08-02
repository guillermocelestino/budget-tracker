<script lang="ts">
  import { onMount } from 'svelte';

  type SegOption = {
    value: string;
    label?: string;
    count?: number;
    icon?: 'grid' | 'table';
    ariaLabel?: string;
  };

  let {
    showFlatView = false,
    onChange,
    options,
    value,
    onSelect,
    iconOnly = false,
    ariaLabel = 'Transaction View Mode',
    slidingThumb = false,
    stretch = false,
  }: {
    showFlatView?: boolean;
    onChange?: (flat: boolean) => void;
    options?: SegOption[];
    value?: string;
    onSelect?: (value: string) => void;
    iconOnly?: boolean;
    ariaLabel?: string;
    slidingThumb?: boolean;
    stretch?: boolean;
  } = $props();

  // Derived active index for sliding thumb
  const activeIndex = $derived.by(() => {
    if (!options) return showFlatView ? 1 : 0;
    return options.findIndex(opt => opt.value === value) ?? 0;
  });

  // Thumb positioning state
  let thumbStyle = $state('');

  // The component's own container — bound below. Scoping the measurement to
  // this element (instead of document.querySelector) matters because pages
  // render multiple sliding-thumb toggles (lending/borrowed each have two);
  // a global query would make every thumb measure against the first one.
  let containerEl = $state<HTMLDivElement | null>(null);

  // Update thumb position when active index changes or layout shifts
  function updateThumbPosition() {
    if (!slidingThumb) return;

    const container = containerEl;
    const activeBtn = container?.querySelector('.toggle-btn.active') as HTMLElement;

    if (container && activeBtn) {
      const containerRect = container.getBoundingClientRect();
      const btnRect = activeBtn.getBoundingClientRect();

      const left = btnRect.left - containerRect.left;
      const width = btnRect.width;

      thumbStyle = `transform: translateX(${left}px); width: ${width}px;`;
    }
  }

  // Update on value change
  $effect(() => {
    if (slidingThumb) {
      // Defer to next tick to let DOM update
      // Read reactive values to track them as dependencies
      activeIndex;
      value;
      showFlatView;
      requestAnimationFrame(updateThumbPosition);
    }
  });

  // Update on mount and resize
  onMount(() => {
    if (slidingThumb) {
      updateThumbPosition();
      window.addEventListener('resize', updateThumbPosition);
      return () => window.removeEventListener('resize', updateThumbPosition);
    }
  });
</script>

{#if options}
  <div class="view-toggle" class:stretch role="radiogroup" aria-label={ariaLabel} bind:this={containerEl}>
    {#if slidingThumb}
      <div class="thumb" aria-hidden="true" style={thumbStyle}></div>
    {/if}
    {#each options as opt, i (opt.value)}
      <button
        class="toggle-btn"
        class:active={opt.value === value}
        class:icon-only={iconOnly}
        onclick={() => onSelect?.(opt.value)}
        role="radio"
        aria-checked={opt.value === value}
        aria-label={opt.ariaLabel ?? opt.label}
        type="button"
        style:--seg-index={i}
      >
        {#if opt.icon === 'grid'}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
        {:else if opt.icon === 'table'}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="3" y1="9" x2="21" y2="9"/>
            <line x1="3" y1="15" x2="21" y2="15"/>
            <line x1="9" y1="3" x2="9" y2="21"/>
            <line x1="15" y1="3" x2="15" y2="21"/>
          </svg>
        {/if}
        {#if opt.label}
          <span>{opt.label}</span>
        {/if}
        {#if opt.count !== undefined}
          <span class="seg-count">{opt.count}</span>
        {/if}
      </button>
    {/each}
  </div>
{:else}
  <div class="view-toggle" class:stretch role="radiogroup" aria-label="Transaction View Mode" bind:this={containerEl}>
    {#if slidingThumb}
      <div class="thumb" aria-hidden="true" style={thumbStyle}></div>
    {/if}
    <button
      class="toggle-btn"
      class:active={!showFlatView}
      onclick={() => onChange?.(false)}
      role="radio"
      aria-checked={!showFlatView}
      type="button"
      style:--seg-index={0}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
      <span>Grouped</span>
    </button>
    <button
      class="toggle-btn"
      class:active={showFlatView}
      onclick={() => onChange?.(true)}
      role="radio"
      aria-checked={showFlatView}
      type="button"
      style:--seg-index={1}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <line x1="3" y1="9" x2="21" y2="9"/>
        <line x1="3" y1="15" x2="21" y2="15"/>
        <line x1="9" y1="3" x2="9" y2="21"/>
        <line x1="15" y1="3" x2="15" y2="21"/>
      </svg>
      <span>Table</span>
    </button>
  </div>
{/if}

<style>
  .view-toggle {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    background: var(--color-bg);
    padding: 3px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--color-hairline);
    min-height: 44px;
    position: relative;
  }

  /* Sliding thumb — only rendered when slidingThumb=true */
  .thumb {
    position: absolute;
    top: 3px;
    bottom: 3px;
    border-radius: var(--radius-pill);
    background: var(--color-teal-bg);
    box-shadow: var(--glow-card);
    z-index: 0;
    pointer-events: none;
    transition: transform 200ms var(--ease), width 200ms var(--ease);
    /* Width set by JS based on active segment */
  }

  /* When sliding thumb is active, segments don't have their own background */
  .view-toggle:has(.thumb) .toggle-btn {
    background: transparent !important;
    box-shadow: none !important;
    position: relative;
    z-index: 1;
  }

  .toggle-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border: none;
    background: transparent;
    border-radius: var(--radius-pill);
    cursor: pointer;
    color: var(--color-text-muted);
    font-size: var(--font-size-xs);
    font-weight: 600;
    font-family: var(--font-body);
    transition: all var(--transition-fast);
    min-height: 38px;
    white-space: nowrap;
    -webkit-tap-highlight-color: transparent;
    position: relative;
    z-index: 1;
  }

  .toggle-btn:hover:not(.active) {
    background: var(--color-teal-bg);
    color: var(--color-teal);
  }

  /* Static active state (when slidingThumb=false) */
  .toggle-btn.active {
    background: var(--color-teal-bg);
    color: var(--color-teal);
    font-weight: 700;
  }

  [data-theme="dark"] .toggle-btn.active {
    background: var(--color-teal-bg);
    color: var(--color-teal);
    box-shadow: var(--glow-card);
  }

  /* Active segment styling when sliding thumb is enabled */
  .view-toggle:has(.thumb) .toggle-btn.active {
    background: transparent;
    color: var(--color-teal);
    font-weight: 700;
  }

  [data-theme="dark"] .view-toggle:has(.thumb) .toggle-btn.active {
    box-shadow: none;
  }

  .toggle-btn.icon-only {
    padding: 6px 10px;
  }

  .seg-count {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    opacity: 0.8;
  }

  /* ── Full-width 50/50 segmented control (mobile) ──
     Enabled via the `stretch` prop: the control fills its container and
     each segment takes half the width for oversized tap targets. Scoped to
     ≤768px so desktop (and the options-mode toggles on lending/borrowed)
     keep the compact content-width pill. */
  @media (max-width: 768px) {
    .view-toggle.stretch {
      width: 100%;
      min-height: 44px;
    }

    .view-toggle.stretch .toggle-btn {
      flex: 1;
      justify-content: center;
      min-height: 38px;
    }
  }

  /* Mount stagger for segments */
  .view-toggle:has(.thumb) .toggle-btn {
    animation: fadeSlideIn 300ms var(--ease) both;
    animation-delay: calc((var(--seg-index, 0)) * 60ms);
  }

  @keyframes fadeSlideIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media (prefers-reduced-motion: reduce) {
    .toggle-btn {
      transition: none;
    }
    .thumb {
      transition: none;
    }
    .view-toggle .toggle-btn {
      animation: none !important;
    }
  }
</style>
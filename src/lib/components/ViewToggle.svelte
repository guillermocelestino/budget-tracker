<script lang="ts">
  let {
    showFlatView = false,
    onChange,
  }: {
    showFlatView?: boolean;
    onChange?: (flat: boolean) => void;
  } = $props();
</script>

<div class="view-toggle" role="radiogroup" aria-label="Transaction View Mode">
  <button
    class="toggle-btn"
    class:active={!showFlatView}
    onclick={() => onChange?.(false)}
    role="radio"
    aria-checked={!showFlatView}
    type="button"
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
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <line x1="3" y1="9" x2="21" y2="9"/>
      <line x1="3" y1="15" x2="21" y2="15"/>
      <line x1="9" y1="3" x2="9" y2="21"/>
      <line x1="15" y1="3" x2="15" y2="21"/>
    </svg>
    <span>Flat</span>
  </button>
</div>

<style>
  .view-toggle {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    background: var(--color-bg);
    padding: 3px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--color-hairline);
    min-height: 40px;
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
    min-height: 32px;
    white-space: nowrap;
    -webkit-tap-highlight-color: transparent;
  }

  .toggle-btn:hover:not(.active) {
    background: var(--color-surface);
    color: var(--color-ink);
  }

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

  @media (prefers-reduced-motion: reduce) {
    .toggle-btn {
      transition: none;
    }
  }
</style>

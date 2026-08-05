<script lang="ts">
  import { tick } from 'svelte';

  /**
   * RowActionsMenu — the per-record overflow bottom sheet (Edit / Duplicate /
   * Delete + Cancel). Content-neutral: hosts pass a title + pre-formatted
   * amount string, so the same sheet serves Transaction rows and Lending cards.
   */
  let {
    title,
    amount,
    tone = 'neutral',
    ariaLabel = 'Actions',
    isActive,
    onClose = () => {},
    onEdit,
    onDuplicate,
    onDelete,
    onRunNow,
    onPause,
    onResume,
    onPay,
    payLabel = 'Mark Paid',
  }: {
    title: string;
    amount: string;
    tone?: 'income' | 'expense' | 'neutral';
    ariaLabel?: string;
    isActive?: boolean;
    onClose?: () => void;
    onEdit?: () => void;
    onDuplicate?: () => void;
    onDelete?: () => void;
    onRunNow?: () => void;
    onPause?: () => void;
    onResume?: () => void;
    onPay?: () => void;
    payLabel?: string;
  } = $props();

  let panelEl = $state<HTMLDivElement | null>(null);

  // Lock body scroll while open
  $effect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  });

  // Focus the first action on open
  $effect(() => {
    tick().then(() => {
      panelEl?.querySelector<HTMLElement>('button')?.focus();
    });
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="row-backdrop" onclick={onClose} role="presentation"></div>
<div class="row-sheet" bind:this={panelEl} role="menu" aria-label={ariaLabel}>
  <div class="row-handle" aria-hidden="true"></div>
  <div class="row-head">
    <span class="row-desc">{title}</span>
    <span class="row-amount" class:income={tone === 'income'} class:expense={tone === 'expense'} class:neutral={tone === 'neutral'}>{amount}</span>
  </div>
  <div class="row-actions">
    {#if onPay}
      <button class="row-action" onclick={() => onPay?.()} role="menuitem" type="button">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span>{payLabel}</span>
      </button>
    {/if}
    <button class="row-action" onclick={() => onEdit?.()} role="menuitem" type="button">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
      <span>Edit</span>
    </button>
    <button class="row-action" onclick={() => onDuplicate?.()} role="menuitem" type="button">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg>
      <span>Duplicate</span>
    </button>
    {#if onRunNow}
      <button class="row-action" onclick={() => onRunNow?.()} role="menuitem" type="button">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        <span>Run Now</span>
      </button>
    {/if}
    {#if isActive && onPause}
      <button class="row-action" onclick={() => onPause?.()} role="menuitem" type="button">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="6" y="4" width="4" height="16"/>
          <rect x="14" y="4" width="4" height="16"/>
        </svg>
        <span>Pause</span>
      </button>
    {:else if !isActive && onResume}
      <button class="row-action" onclick={() => onResume?.()} role="menuitem" type="button">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        <span>Resume</span>
      </button>
    {/if}
    <button class="row-action danger" onclick={() => onDelete?.()} role="menuitem" type="button">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        <line x1="10" y1="11" x2="10" y2="17"/>
        <line x1="14" y1="11" x2="14" y2="17"/>
      </svg>
      <span>Delete</span>
    </button>
  </div>
  <button class="row-cancel" onclick={onClose} type="button">Cancel</button>
</div>

<style>
  .row-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(20, 48, 46, 0.4);
    backdrop-filter: blur(3px);
    z-index: calc(var(--z-modal, 1000) + 1);
    animation: rowFade 220ms var(--ease);
  }

  .row-sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--color-surface);
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    box-shadow: 0 -8px 32px rgba(20, 48, 46, 0.12);
    z-index: calc(var(--z-modal, 1000) + 2);
    padding: var(--space-sm) var(--space-lg) calc(var(--safe-bottom, 0px) + var(--space-md));
    animation: rowUp 220ms var(--ease);
  }

  [data-theme="dark"] .row-sheet {
    box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.35);
  }

  .row-handle {
    width: 40px;
    height: 5px;
    background: var(--color-teal);
    border-radius: var(--radius-pill);
    margin: var(--space-xs) auto var(--space-md);
    box-shadow: var(--glow-card);
  }

  .row-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    padding: var(--space-xs) var(--space-xs) var(--space-lg);
    border-bottom: 1px solid var(--color-hairline);
    margin-bottom: var(--space-sm);
  }

  .row-desc {
    font-family: var(--font-display);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--color-ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .row-amount {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-bold);
    flex-shrink: 0;
  }

  .row-amount.income {
    color: var(--color-teal);
  }

  .row-amount.expense {
    color: var(--color-coral);
  }

  .row-amount.neutral {
    color: var(--color-ink);
  }

  .row-actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .row-action {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    width: 100%;
    min-height: 48px;
    padding: 0 var(--space-md);
    border: none;
    border-radius: var(--radius-lg);
    background: var(--color-surface-inset);
    font-family: var(--font-body);
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--color-ink);
    cursor: pointer;
    text-align: left;
    transition: background 180ms var(--ease);
  }

  .row-action:hover {
    background: var(--color-teal-bg);
    color: var(--color-teal);
  }

  .row-action:focus-visible {
    outline: 2px solid var(--color-teal);
    outline-offset: -2px;
  }

  .row-action.danger {
    color: var(--color-coral);
  }

  .row-action.danger:hover {
    background: var(--color-coral-bg);
    color: var(--color-coral-dark);
  }

  .row-cancel {
    width: 100%;
    min-height: 48px;
    margin-top: var(--space-sm);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    font-family: var(--font-body);
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 180ms var(--ease);
  }

  .row-cancel:hover {
    background: var(--color-teal-bg);
    border-color: var(--color-teal);
    color: var(--color-teal);
  }

  @keyframes rowFade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes rowUp {
    from { transform: translateY(24px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .row-sheet,
    .row-backdrop {
      animation: none;
    }
  }
</style>

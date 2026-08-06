<script lang="ts">
  import { tick } from 'svelte';
  import type { Snippet } from 'svelte';

  /**
   * RowActionsMenu — per-record overflow actions in two presentations driven
   * from ONE shared actions array (never forked):
   *   • Desktop (hover-capable AND ≥760px): a compact anchored popover,
   *     right-aligned to the triggering kebab, edge-aware (flips above near
   *     the viewport bottom, clamped horizontally), styled after the header
   *     OverflowMenu. No scrim, no drag handle, no full-width Cancel.
   *   • Touch / narrow: the full-bleed bottom sheet (drag handle, full-width
   *     rows, Cancel), unchanged.
   * Content-neutral: hosts pass a title + pre-formatted amount + an optional
   * anchor element, so the same popover/sheet serves Transaction rows,
   * Recurring rows, and Lending cards.
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
    payLabel = 'Record Payment',
    onViewHistory,
    anchor = null,
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
    onViewHistory?: () => void;
    anchor?: HTMLElement | null;
  } = $props();

  type MenuAction = {
    id: string;
    label: string;
    icon: Snippet;
    onClick: () => void;
    danger?: boolean;
  };

  let panelEl = $state<HTMLDivElement | null>(null);
  let posStyle = $state('visibility: hidden;');

  // ── Presentation gate: desktop popover requires a fine pointer + hover
  //    intent + a wide viewport. Anything else keeps the bottom sheet.
  const desktopMq =
    typeof window !== 'undefined'
      ? window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 760px)')
      : null;
  let isDesktop = $state(desktopMq?.matches ?? false);
  $effect(() => {
    if (!desktopMq) return;
    const handler = () => { isDesktop = desktopMq.matches; };
    desktopMq.addEventListener?.('change', handler);
    return () => desktopMq.removeEventListener?.('change', handler);
  });

  // ── One shared actions array feeds BOTH the sheet and the popover. ──
  const actions = $derived.by<MenuAction[]>(() => {
    const list: MenuAction[] = [];
    if (onPay) list.push({ id: 'pay', label: payLabel, icon: iconPay, onClick: () => onPay?.() });
    if (onViewHistory) list.push({ id: 'history', label: 'View History', icon: iconHistory, onClick: () => onViewHistory?.() });
    if (onEdit) list.push({ id: 'edit', label: 'Edit', icon: iconEdit, onClick: () => onEdit?.() });
    if (onDuplicate) list.push({ id: 'duplicate', label: 'Duplicate', icon: iconDup, onClick: () => onDuplicate?.() });
    if (onRunNow) list.push({ id: 'run', label: 'Run Now', icon: iconRun, onClick: () => onRunNow?.() });
    if (isActive && onPause) list.push({ id: 'pause', label: 'Pause', icon: iconPause, onClick: () => onPause?.() });
    else if (!isActive && onResume) list.push({ id: 'resume', label: 'Resume', icon: iconResume, onClick: () => onResume?.() });
    if (onDelete) list.push({ id: 'delete', label: 'Delete', icon: iconDelete, onClick: () => onDelete?.(), danger: true });
    return list;
  });

  // Bottom sheet locks body scroll; the popover does not (fixed, no shift).
  $effect(() => {
    if (isDesktop) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  });

  // Focus the first action on open (both presentations).
  $effect(() => {
    tick().then(() => {
      panelEl?.querySelector<HTMLElement>('button')?.focus();
    });
  });

  // Return focus to the triggering kebab when the menu unmounts.
  $effect(() => {
    return () => {
      anchor?.focus?.();
    };
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  // Desktop popover: close on outside click (the opening kebab is excluded).
  $effect(() => {
    if (!isDesktop) return;
    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      if (panelEl && !panelEl.contains(target) && !(anchor && anchor.contains(target))) onClose();
    }
    const timer = setTimeout(() => document.addEventListener('click', onClick), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', onClick);
    };
  });

  // Desktop popover: position from the kebab rect — right-aligned, opens
  // below by default, flips above near the viewport bottom, clamped
  // horizontally (same edge logic as the quick-action tooltips).
  $effect(() => {
    if (!isDesktop || !anchor) return;
    const el = panelEl;
    if (!el) return;
    const pad = 8;
    const position = () => {
      const rect = anchor.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const mw = el.offsetWidth;
      const mh = el.offsetHeight;
      let right = Math.max(pad, vw - rect.right);
      if (right + mw > vw - pad) right = Math.max(pad, vw - mw - pad);
      let top = rect.bottom + 6;
      if (top + mh > vh - pad) top = Math.max(pad, rect.top - mh - 6);
      posStyle = `top: ${top}px; right: ${right}px; visibility: visible;`;
    };
    const raf = requestAnimationFrame(position);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  });
</script>

{#snippet iconPay()}
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
{/snippet}

{#snippet iconHistory()}
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
{/snippet}

{#snippet iconEdit()}
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
{/snippet}

{#snippet iconDup()}
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
{/snippet}

{#snippet iconRun()}
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
{/snippet}

{#snippet iconPause()}
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
{/snippet}

{#snippet iconResume()}
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
{/snippet}

{#snippet iconDelete()}
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
{/snippet}

<svelte:window onkeydown={handleKeydown} />

{#if isDesktop && anchor}
  <!-- ═══ Desktop: compact anchored popover (no scrim / handle / Cancel) ═══ -->
  <div bind:this={panelEl} class="row-popover" style={posStyle} role="menu" aria-label={ariaLabel}>
    {#if title}
      <div class="popover-head">
        <span class="popover-title">{title}</span>
        <span class="popover-amount" class:income={tone === 'income'} class:expense={tone === 'expense'} class:neutral={tone === 'neutral'}>{amount}</span>
      </div>
    {/if}
    <div class="popover-actions">
      {#each actions as action (action.id)}
        <button class="popover-item" class:danger={action.danger} onclick={() => action.onClick()} role="menuitem" type="button">
          {@render action.icon()}
          <span>{action.label}</span>
        </button>
      {/each}
    </div>
  </div>
{:else}
  <!-- ═══ Touch / narrow: full-bleed bottom sheet (unchanged) ═══ -->
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="row-backdrop" onclick={onClose} role="presentation"></div>
  <div class="row-sheet" bind:this={panelEl} role="menu" aria-label={ariaLabel}>
    <div class="row-handle" aria-hidden="true"></div>
    <div class="row-head">
      <span class="row-desc">{title}</span>
      <span class="row-amount" class:income={tone === 'income'} class:expense={tone === 'expense'} class:neutral={tone === 'neutral'}>{amount}</span>
    </div>
    <div class="row-actions">
      {#each actions as action (action.id)}
        <button class="row-action" class:danger={action.danger} onclick={() => action.onClick()} role="menuitem" type="button">
          {@render action.icon()}
          <span>{action.label}</span>
        </button>
      {/each}
    </div>
    <button class="row-cancel" onclick={onClose} type="button">Cancel</button>
  </div>
{/if}

<style>
  /* ── Desktop popover — anchored, right-aligned, no scrim ── */
  .row-popover {
    position: fixed;
    width: 248px;
    background: var(--color-surface);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    z-index: var(--z-modal, 1000);
    padding: 6px;
    animation: popoverIn 160ms var(--ease);
  }

  @keyframes popoverIn {
    from {
      opacity: 0;
      transform: translateY(-4px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  /* Optional compact header: title + mono direction-colored amount, hairline */
  .popover-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
    padding: 6px 12px 10px;
    border-bottom: 1px solid var(--color-hairline);
    margin-bottom: 4px;
  }

  .popover-title {
    font-family: var(--font-display);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .popover-amount {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-bold);
    flex-shrink: 0;
  }

  .popover-amount.income {
    color: var(--color-teal);
  }

  .popover-amount.expense {
    color: var(--color-coral);
  }

  .popover-amount.neutral {
    color: var(--color-ink);
  }

  .popover-actions {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  /* Icon + label rows, 44px (WCAG ≥44px), mint hover, rose delete zone */
  .popover-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 44px;
    padding: 0 16px;
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--color-ink);
    cursor: pointer;
    text-align: left;
    transition: background 140ms var(--ease), color 140ms var(--ease);
  }

  .popover-item:hover {
    background: var(--mint-tint);
    color: var(--teal-deep);
  }

  .popover-item:focus-visible {
    outline: 2px solid var(--color-teal);
    outline-offset: -2px;
  }

  .popover-item.danger {
    color: var(--color-coral);
  }

  .popover-item.danger:hover {
    background: var(--rose-soft);
    color: var(--rose);
  }

  /* ═══ Mobile bottom sheet — unchanged ═══ */
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
    .row-backdrop,
    .row-popover {
      animation: none;
    }
  }
</style>

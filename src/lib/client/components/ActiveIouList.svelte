<script lang="ts">
  import { onMount } from 'svelte';
  import { formatCurrency, formatDate } from '$lib/client/utils/format';
import { dateToString, getToday } from '$lib/shared/utils/format';
  import { calculateProjectedInterestForLending } from '$lib/shared/utils/projectedInterest';
  import RowActionsMenu from '$lib/client/components/RowActionsMenu.svelte';
  import RowHoverActions from '$lib/client/components/RowHoverActions.svelte';
  import type { LendingWithPayments } from '$lib/types';

  let {
    ious = [],
    onPay,
    onEdit,
    onDelete,
    onDuplicate,
    onViewHistory,
    direction = 'lent',
    viewMode = 'table',
    selectionMode = false,
    selectedIds = new Set<number>(),
    onToggleSelection,
    showProjectedInterest = false,
  }: {
    ious: LendingWithPayments[];
    onPay?: (id: number) => void;
    onEdit?: (id: number) => void;
    onDelete?: (id: number) => void;
    onDuplicate?: (id: number) => void;
    onViewHistory?: (id: number) => void;
    direction?: 'lent' | 'borrowed';
    viewMode?: 'card' | 'table';
    selectionMode?: boolean;
    selectedIds?: Set<number>;
    onToggleSelection?: (id: number) => void;
    /** Lending-only: show the derived Projected Interest column (default off for /borrowed). */
    showProjectedInterest?: boolean;
  } = $props();

  // ─── Compute today from app helper (respects DEMO_TODAY) ───
  const todayStr = getToday();
  const today = new Date(todayStr + 'T00:00:00');

  // ─── Scroll reveal state ───
  let reducedMotion = $state(false);

  // Detect reduced motion preference
  onMount(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion = mediaQuery.matches;
    const handler = (e: MediaQueryListEvent) => { reducedMotion = e.matches; };
    mediaQuery.addEventListener?.('change', handler);
    return () => mediaQuery.removeEventListener?.('change', handler);
  });

  // ─── Scroll reveal observer
  onMount(() => {
    if (reducedMotion) return;

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
        }
      }
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });

    // Find all revealable elements - use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      const root = document.querySelector('.iou-container');
      if (root) {
        const headers = root.querySelectorAll('.group-header.reveal-on-scroll');
        const cards = root.querySelectorAll('.iou-card.reveal-on-scroll');
        for (const el of headers) {
          el.classList.add('will-reveal');
          observer.observe(el);
        }
        for (const el of cards) {
          el.classList.add('will-reveal');
          observer.observe(el);
        }
      }
    });

    return () => observer.disconnect();
  });

  // ─── Triage bucket helpers ───
  type State = 'overdue' | 'due-this-week' | 'later' | 'paid' | 'on-track';

  function computeState(iou: LendingWithPayments): State {
    if (iou.status === 'paid') return 'paid';
    // Postgres returns `date` columns as Date objects — normalize to string.
    const dueStr = dateToString(iou.due_date);
    if (!dueStr) return 'later';
    const due = new Date(dueStr + 'T00:00:00');
    const diffMs = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'overdue';
    if (diffDays <= 7) return 'due-this-week';
    return 'later';
  }

  function daysUntilDue(dueDate: string | Date | null): number | null {
    const dueStr = dateToString(dueDate);
    if (!dueStr) return null;
    const due = new Date(dueStr + 'T00:00:00');
    const diffMs = due.getTime() - today.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  // ─── Progress ───
  // If the schema had repaid_amount, we'd compute from that.
  // Today we use amount as 100% and show 0 progress for active, 100% for paid.
  // In future: partial repayments via a separate table.
  function recoveredAmount(iou: LendingWithPayments): number {
    return iou.resolved_total;
  }

  // ─── Triage groups ───
  type TriageGroup = {
    id: string;
    label: string;
    emoji: string;
    state: State;
    items: LendingWithPayments[];
    count: number;
  };

  const triageGroups = $derived.by(() => {
    const overdue: LendingWithPayments[] = [];
    const dueThisWeek: LendingWithPayments[] = [];
    const later: LendingWithPayments[] = [];
    const paid: LendingWithPayments[] = [];

    for (const iou of ious) {
      const state = computeState(iou);
      switch (state) {
        case 'overdue': overdue.push(iou); break;
        case 'due-this-week': dueThisWeek.push(iou); break;
        case 'later': later.push(iou); break;
        case 'paid': paid.push(iou); break;
        default: later.push(iou);
      }
    }

    // Sort by amount desc within each group (snowball-friendly: largest first)
    const sortByAmountDesc = (a: LendingWithPayments, b: LendingWithPayments) => b.amount - a.amount;

    const groups: TriageGroup[] = [];

    if (overdue.length > 0) {
      overdue.sort(sortByAmountDesc);
      groups.push({
        id: 'overdue', label: 'Overdue', emoji: '🔥', state: 'overdue',
        items: overdue, count: overdue.length,
      });
    }
    if (dueThisWeek.length > 0) {
      dueThisWeek.sort(sortByAmountDesc);
      groups.push({
        id: 'due-this-week', label: 'Due This Week', emoji: '⏰', state: 'due-this-week',
        items: dueThisWeek, count: dueThisWeek.length,
      });
    }
    if (later.length > 0) {
      later.sort(sortByAmountDesc);
      groups.push({
        id: 'later', label: 'Later', emoji: '📅', state: 'later',
        items: later, count: later.length,
      });
    }
    if (paid.length > 0) {
      paid.sort(sortByAmountDesc);
      groups.push({
        id: 'paid', label: 'Paid', emoji: '✅', state: 'paid',
        items: paid, count: paid.length,
      });
    }

    return groups;
  });

  // ─── Per-card overflow menu (mobile) ───
  let menuIou = $state<LendingWithPayments | null>(null);
  let menuAnchor = $state<HTMLElement | null>(null); // kebab/overflow el → anchors desktop popover

  // ─── State styling helpers (gold retired → amber; coral → rose) ───
  function stateAccentColor(state: State): string {
    switch (state) {
      case 'overdue': return 'var(--rose)';
      case 'due-this-week': return 'var(--color-amber)';
      case 'later': return 'var(--teal)';
      case 'paid': return 'var(--color-sky)';
      default: return 'var(--teal)';
    }
  }

  function stateBgColor(state: State): string {
    switch (state) {
      case 'overdue': return 'var(--rose-soft)';
      case 'due-this-week': return 'var(--color-amber-bg)';
      case 'later': return 'var(--mint-tint)';
      case 'paid': return 'rgba(93, 173, 226, 0.08)';
      default: return 'var(--mint-tint)';
    }
  }

  function stateTextColor(state: State): string {
    switch (state) {
      case 'overdue': return 'var(--rose)';
      case 'due-this-week': return 'var(--color-amber-dark)';
      case 'later': return 'var(--teal)';
      case 'paid': return 'var(--color-sky)';
      default: return 'var(--teal)';
    }
  }

  function stateLabel(state: State): string {
    switch (state) {
      case 'overdue': return 'Overdue';
      case 'due-this-week': return 'Due Soon';
      case 'later': return 'On Track';
      case 'paid': return 'Cleared';
      default: return 'Active';
    }
  }

  function countdownLabel(iou: LendingWithPayments): { text: string; color: string } | null {
    if (iou.status === 'paid') return null;
    const days = daysUntilDue(iou.due_date);
    if (days === null) return null;
    if (days < 0) return { text: `${-days}d overdue`, color: 'var(--rose)' };
    if (days === 0) return { text: 'Due today', color: 'var(--color-amber)' };
    if (days <= 7) return { text: `Due in ${days}d`, color: 'var(--color-amber)' };
    return { text: `Due in ${days}d`, color: 'var(--teal)' };
  }

  // ─── Money direction (rule 2) — lent is money out (− rose), borrowed is in (+ teal) ───
  function moneyDirectionColor(): string {
    return direction === 'borrowed' ? 'var(--teal)' : 'var(--rose)';
  }

  function formatDirectionalAmount(amount: number): string {
    return (direction === 'borrowed' ? '+' : '−') + formatCurrency(amount);
  }

  // Compact-card DUE cell: countdown + due date on one line.
  function formatDueForCard(iou: LendingWithPayments, cd: { text: string; color: string } | null): string {
    const datePart = iou.due_date ? formatDate(iou.due_date) : null;
    if (cd) return datePart ? `${cd.text} · ${datePart}` : cd.text;
    return datePart ?? '—';
  }
</script>

{#snippet editIcon()}
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
{/snippet}

{#snippet trashIcon()}
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
{/snippet}

<!-- ════════════════════════════════════════
     MOBILE COMPACT CARDS (below md, < 768px)
     The ONLY list presentation on phones/tablets: one compact card per
     record with avatar, name, status badge, "⋯" menu, amount, and the
     DUE / PROGRESS / PROJECTED INTEREST values in tight label+value rows.
     Card height = content height (no fixed/min heights). Hidden at md+.
     ════════════════════════════════════════ -->
<div class="iou-mobile-list">
  {#if ious.length === 0}
    <div class="empty-state">
      <div class="empty-icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v1h6V5a3 3 0 0 0-3-3z"/>
          <path d="M5 8h14a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/>
        </svg>
      </div>
      <p class="empty-title">
        {direction === 'lent' ? 'All settled up!' : 'No debts — that\'s the best position to be in 🏆'}
      </p>
      <p class="empty-sub">
        {direction === 'lent' ? 'No outstanding loans right now' : 'Add a borrowing to start tracking'}
      </p>
    </div>
  {:else}
    {#each ious as iou (iou.id)}
      {@const state = computeState(iou)}
      {@const cd = countdownLabel(iou)}
      {@const progressPct = iou.amount > 0 ? Math.min((iou.resolved_total / iou.amount) * 100, 100) : 0}
      {@const pct = Math.round(progressPct)}
      {@const init = iou.borrower_name.charAt(0).toUpperCase()}
      {@const accent = stateAccentColor(state)}
      {@const bg = stateBgColor(state)}
      {@const fg = stateTextColor(state)}
      {@const dueText = formatDueForCard(iou, cd)}
      <div
        class="iou-mobile-card"
        class:overdue={state === 'overdue'}
        class:paid={iou.status === 'paid'}
      >
        <div class="mc-head">
          {#if selectionMode}
            <button
              class="mc-checkbox"
              type="button"
              aria-label="{selectedIds.has(iou.id) ? 'Deselect' : 'Select'} {iou.borrower_name}"
              onclick={(e) => { e.stopPropagation(); onToggleSelection?.(iou.id); }}
            >
              <input type="checkbox" checked={selectedIds.has(iou.id)} aria-hidden="true" tabindex="-1" readonly />
            </button>
          {/if}

          <div class="mc-avatar" style="border-color: {accent}; background: {bg};">
            <span style="color: {fg};">{init}</span>
          </div>

          <div class="mc-head-main">
            <span class="mc-name" class:struck={iou.status === 'paid'}>{iou.borrower_name}</span>
            <span class="mc-badge" style="background: {bg}; color: {fg};">{stateLabel(state)}</span>
          </div>

          <button
            class="mc-kebab"
            type="button"
            aria-label="More actions for {iou.borrower_name}"
            aria-haspopup="menu"
            aria-expanded={menuIou?.id === iou.id}
            onclick={(e) => { menuAnchor = e.currentTarget as HTMLElement; menuIou = iou; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
          </button>
        </div>

        <span class="mc-meta">
          {direction === 'lent' ? 'Lent' : 'Borrowed'} {formatDate(iou.date_lent)}
          {#if iou.notes && iou.notes.length > 0} · {iou.notes}{/if}
        </span>

        <div class="mc-cells">
          <div class="mc-row">
            <span class="mc-cell">
              <span class="mc-k">Amount</span>
              <span class="mc-v mc-amount" class:struck={iou.status === 'paid'} style="color: {moneyDirectionColor()};">{formatDirectionalAmount(iou.remaining)}</span>
            </span>
            <span class="mc-cell mc-right">
              <span class="mc-k">Due</span>
              <span class="mc-v">{dueText}</span>
            </span>
          </div>

          <div class="mc-row">
            <span class="mc-cell">
              <span class="mc-k">Progress</span>
              <span class="mc-v mc-progress">
                <span class="mc-track" aria-hidden="true"><span class="mc-fill" style="width: {pct}%; background: {accent};"></span></span>
                <span class="mc-pct">{pct}%</span>
              </span>
            </span>
            <span class="mc-cell mc-right">
              <span class="mc-k">Interest</span>
              <span class="mc-v mc-interest">{formatCurrency(calculateProjectedInterestForLending(iou))}</span>
            </span>
          </div>
        </div>
      </div>
    {/each}
  {/if}
</div>

<!-- ════════════════════════════════════════
     DESKTOP VIEW (md+, ≥ 768px) — markup unchanged. Hidden below md so
     phones always get the compact card list above.
     CARD VIEW (Primary: triage-grouped)
     ════════════════════════════════════════ -->
<div class="iou-desktop-area">
{#if viewMode === 'card'}
  {#if ious.length === 0}
    <div class="empty-state">
      <div class="empty-icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v1h6V5a3 3 0 0 0-3-3z"/>
          <path d="M5 8h14a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/>
        </svg>
      </div>
      <p class="empty-title">
        {direction === 'lent' ? 'All settled up!' : 'No debts — that\'s the best position to be in 🏆'}
      </p>
      <p class="empty-sub">
        {direction === 'lent' ? 'No outstanding loans right now' : 'Add a borrowing to start tracking'}
      </p>
    </div>
  {:else}
    <div class="iou-container">
      {#each triageGroups as group (group.id)}
        <div class="triage-group" data-group={group.id}>
          <!-- Sticky group header -->
          <div class="group-header reveal-on-scroll" style="border-bottom-color: {stateAccentColor(group.state)};">
            <span class="group-emoji">{group.emoji}</span>
            <span class="group-label">{group.label}</span>
            <span class="group-count">• {group.count} loan{group.count === 1 ? '' : 's'}</span>
          </div>

          {#each group.items as iou (iou.id)}
            {@const state = computeState(iou)}
            {@const cd = countdownLabel(iou)}
            {@const progressPct = iou.amount > 0 ? Math.min((iou.resolved_total / iou.amount) * 100, 100) : 0}
            {@const init = iou.borrower_name.charAt(0).toUpperCase()}
            <div
              class="iou-card reveal-on-scroll"
              class:paid={iou.status === 'paid'}
              class:overdue={state === 'overdue'}
              class:iou-card-selected={selectionMode && selectedIds.has(iou.id)}
              data-hover-row
              style="border-color: {stateAccentColor(state)}40;"
            >
              <!-- Selection checkbox (card view, top-right corner) -->
              {#if selectionMode}
                <button
                  class="iou-card-checkbox-btn"
                  type="button"
                  aria-label="{selectedIds.has(iou.id) ? 'Deselect' : 'Select'} {iou.borrower_name}"
                  onclick={(e) => { e.stopPropagation(); onToggleSelection?.(iou.id); }}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(iou.id)}
                    aria-hidden="true"
                    tabindex="-1"
                    readonly
                  />
                </button>
              {/if}
              <!-- Left accent bar (STATE, not sign) -->
              <div class="iou-accent" style="background: {stateAccentColor(state)};"></div>

              <!-- Initial circle with colored ring -->
              <div class="iou-initial-ring" style="border-color: {stateAccentColor(state)}; background: {stateBgColor(state)};">
                <span class="iou-initial" style="color: {stateTextColor(state)};">{init}</span>
              </div>

              <!-- Center: name + meta + progress -->
              <div class="iou-info">
                <span class="iou-name" class:strikethrough={iou.status === 'paid'}>{iou.borrower_name}</span>
                <span class="iou-meta">
                  {direction === 'lent' ? 'Lent' : 'Borrowed'} {formatDate(iou.date_lent)}
                  {#if iou.due_date} · Due {formatDate(iou.due_date)}{/if}
                  {#if iou.interest_rate > 0} · {iou.interest_rate}% interest{/if}
                  {#if showProjectedInterest} · Proj. {formatCurrency(calculateProjectedInterestForLending(iou))}{/if}
                  {#if iou.notes && iou.notes.length > 0} · {iou.notes}{/if}
                </span>

                <!-- Due-first meta for mobile (urgency first) -->
                <span class="iou-meta-mobile">
                  {#if iou.due_date}Due {formatDate(iou.due_date)}{/if}
                  {#if iou.notes && iou.notes.length > 0}
                    {#if iou.due_date} · {/if}{iou.notes}
                  {:else if !iou.due_date && iou.interest_rate > 0}
                    {iou.interest_rate}% interest
                  {/if}
                </span>

                <!-- Progress bar -->
                <div class="iou-progress">
                  <span class="progress-caption">Collected</span>
                  <div class="progress-track">
                    <div
                      class="progress-fill"
                      style="width: {Math.min(progressPct, 100)}%; background: {stateAccentColor(state)};"
                    ></div>
                  </div>
                  <span class="progress-label" style="color: {stateTextColor(state)};">
                    {formatCurrency(recoveredAmount(iou))} / {formatCurrency(iou.amount)}
                  </span>
                  <span class="progress-pct" style="color: {stateTextColor(state)};">{Math.round(progressPct)}%</span>
                </div>

                <!-- Hover actions (desktop) — absolute inside the info area,
                     right-aligned, ending before the amount/status cluster.
                     Paid rows render no cluster (the Recovered glow is their
                     state; the kebab is their only overflow path). -->
                {#if iou.status !== 'paid'}
                  <div class="iou-hover-slot">
                    <RowHoverActions
                      actions={[
                        { id: 'pay', label: 'Record Payment', text: 'Record Payment', onClick: () => onPay?.(iou.id) },
                        { id: 'edit', label: 'Edit', icon: editIcon, onClick: () => onEdit?.(iou.id) },
                        // Quick-delete: last, danger-tone, same confirm modal
                        // as the kebab. Conditional — no dead button.
                        ...(onDelete
                          ? [{ id: 'delete', label: 'Delete', icon: trashIcon, tone: 'danger' as const, onClick: () => onDelete?.(iou.id) }]
                          : [])
                      ]}
                    />
                  </div>
                {/if}
              </div>

              <!-- Right: remaining (primary) + countdown + overflow (mobile) + recovered glow -->
              <div class="iou-right">
                <span class="iou-amount" class:paid-amount={iou.status === 'paid'} style="color: {moneyDirectionColor()};">
                  {formatDirectionalAmount(iou.remaining)}
                </span>
                {#if iou.status !== 'paid' && iou.resolved_total > 0}
                  <span class="iou-paid-sub">{formatCurrency(iou.resolved_total)} paid</span>
                {/if}

                <!-- Countdown pill -->
                {#if cd}
                  <span class="countdown-pill" style="background: {cd.color}15; color: {cd.color}; border: 1px solid {cd.color}30;">
                    {cd.text}
                  </span>
                {/if}

                <!-- Always-visible overflow (⋯) + recovered glow for paid -->
                <div class="iou-actions-row">
                  {#if iou.status === 'paid'}
                    <span class="recovered-glow">
                      {direction === 'lent' ? 'Recovered' : 'Repaid'}
                    </span>
                  {/if}
                  <button class="iou-overflow" onclick={(e) => { menuAnchor = e.currentTarget as HTMLElement; menuIou = iou; }} type="button" aria-label="More actions for {iou.borrower_name}" aria-haspopup="menu" aria-expanded={menuIou?.id === iou.id}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                  </button>
                </div>
              </div>

              <!-- Single primary CTA (mobile) -->
              <div class="iou-mobile-actions">
                {#if iou.status === 'paid'}
                  <span class="recovered-glow">
                    {direction === 'lent' ? 'Recovered' : 'Repaid'}
                  </span>
                {:else}
                  <button class="iou-btn iou-btn-pay" onclick={() => onPay?.(iou.id)} type="button">
                    Record Payment
                  </button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/each}
    </div>
  {/if}

<!-- ════════════════════════════════════════
     REGISTER VIEW (Table) — Flip7 register, mirrors /transactions flat view
     ════════════════════════════════════════ -->
{:else}
  {#if ious.length === 0}
    <div class="iou-register">
      <div class="empty-state table-empty">
        <p>No records to show</p>
      </div>
    </div>
  {:else}
    <div class="iou-register">
      <!-- Sticky column header (mono uppercase, like the transactions register) -->
      <div
        class="register-header"
        class:show-projected={showProjectedInterest}
        role="rowheader"
        style={selectionMode
          ? 'grid-template-columns: 44px 28px minmax(0, 1fr) 96px 108px 116px 110px 300px 48px;'
          : showProjectedInterest
            ? 'grid-template-columns: 28px minmax(0, 1fr) 96px 108px 116px 110px 300px 48px;'
            : ''}
      >
        {#if selectionMode}<span class="rh-check" aria-hidden="true"></span>{/if}
        <span class="rh-circle" aria-hidden="true"></span>
        <span class="rh-name">{direction === 'lent' ? 'Borrower' : 'Lender'}</span>
        <span class="rh-due">Due</span>
        <span class="rh-progress">Progress</span>
        <span class="rh-amount">Amount</span>
        {#if showProjectedInterest}<span class="rh-projected">Projected Interest</span>{/if}
        <!-- Reserved actions zone header — empty, ~300px wide -->
        <span class="rh-actions-zone" aria-hidden="true"></span>
        <span class="rh-kebab" aria-hidden="true"></span>
      </div>

      {#each ious as iou (iou.id)}
        {@const state = computeState(iou)}
        {@const cd = countdownLabel(iou)}
        {@const progressPct = iou.amount > 0 ? Math.min((iou.resolved_total / iou.amount) * 100, 100) : 0}
        {@const accent = stateAccentColor(state)}
        {@const bg = stateBgColor(state)}
        {@const fg = stateTextColor(state)}
        {@const init = iou.borrower_name.charAt(0).toUpperCase()}
        <div
          class="iou-row"
          class:overdue={state === 'overdue'}
          class:paid={iou.status === 'paid'}
          class:iou-row-selected={selectionMode && selectedIds.has(iou.id)}
          class:show-projected={showProjectedInterest}
          data-hover-row
          style="--row-accent: {accent};{selectionMode
            ? ' grid-template-columns: 44px 28px minmax(0, 1fr) 96px 108px 116px 110px 300px 48px;'
            : showProjectedInterest
              ? ' grid-template-columns: 28px minmax(0, 1fr) 96px 108px 116px 110px 300px 48px;'
              : ' grid-template-columns: 28px minmax(0, 1fr) 96px 108px 116px 300px 48px;'}"
          role="button"
          tabindex="0"
          aria-label="{selectionMode ? (selectedIds.has(iou.id) ? 'Deselect' : 'Select') + ' ' + iou.borrower_name : 'View payment history for ' + iou.borrower_name}"
          onclick={() => {
            if (selectionMode) { onToggleSelection?.(iou.id); }
            else { onViewHistory?.(iou.id); }
          }}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (selectionMode) { onToggleSelection?.(iou.id); }
              else { onViewHistory?.(iou.id); }
            }
          }}
        >

          <!-- Checkbox column (selection mode only) -->
          {#if selectionMode}
            <span class="row-check-cell">
              <input
                type="checkbox"
                class="row-checkbox"
                checked={selectedIds.has(iou.id)}
                aria-label="{selectedIds.has(iou.id) ? 'Deselect' : 'Select'} {iou.borrower_name}"
                onclick={(e) => e.stopPropagation()}
                onchange={() => onToggleSelection?.(iou.id)}
              />
            </span>
          {/if}
          <!-- Leading state-tinted ring -->
          <span class="row-circle" style="background: {bg}; color: {fg};">{init}</span>

          <!-- Identity: name + state chip + meta -->
          <div class="row-main">
            <div class="row-line1">
              <span class="row-name" class:strikethrough={iou.status === 'paid'}>{iou.borrower_name}</span>
              <span class="row-state-chip" style="background: {bg}; color: {fg};">{stateLabel(state)}</span>
            </div>
            <div class="row-meta">
              {direction === 'lent' ? 'Lent' : 'Borrowed'} {formatDate(iou.date_lent)}
              {#if iou.interest_rate > 0} · {iou.interest_rate}% interest{/if}
              {#if iou.notes} · {iou.notes}{/if}
            </div>
          </div>

          <!-- Due: countdown + date -->
          <div class="row-due" data-label="Due">
            <span class="row-due-group">
              {#if cd}
                <span class="cd-text" style="color: {cd.color};">{cd.text}</span>
              {:else}
                <span class="cd-text muted">—</span>
              {/if}
              {#if iou.due_date}
                <span class="due-date">{formatDate(iou.due_date)}</span>
              {/if}
            </span>
          </div>

          <!-- Progress -->
          <div class="row-progress" data-label="Progress">
            <span class="row-progress-group">
              <span class="row-progress-track">
                <span class="row-progress-fill" style="width: {progressPct}%; background: {accent};"></span>
              </span>
              <span class="row-progress-label">{progressPct}%</span>
            </span>
          </div>

          <!-- Amount (headline money column) — remaining is primary -->
          <div class="row-amount">
            <span class="amount-num" class:struck={iou.status === 'paid'} style="color: {moneyDirectionColor()};">{formatDirectionalAmount(iou.remaining)}</span>
          </div>

          <!-- Projected Interest (Lending-only derived column) -->
          {#if showProjectedInterest}
            <div class="row-projected" data-label="Projected Interest">
              <span class="projected-num">{formatCurrency(calculateProjectedInterestForLending(iou))}</span>
            </div>
          {/if}

          <!-- Reserved actions zone: fixed-width ~300px column on desktop (md+).
               Empty header + empty in non-hovered rows.
               On hover, the quick actions fade in INSIDE this zone,
               right-aligned and vertically centered. -->
          <div class="row-actions-zone">
            {#if iou.status !== 'paid'}
              <div class="row-actions">
                <RowHoverActions
                  actions={[
                    { id: 'pay', label: 'Record Payment', text: 'Record Payment', onClick: () => onPay?.(iou.id) },
                    { id: 'edit', label: 'Edit', icon: editIcon, onClick: () => onEdit?.(iou.id) },
                    // Quick-delete: last, danger-tone, same confirm modal as the
                    // kebab. Conditional — no dead button.
                    ...(onDelete
                      ? [{ id: 'delete', label: 'Delete', icon: trashIcon, tone: 'danger' as const, onClick: () => onDelete?.(iou.id) }]
                      : [])
                  ]}
                />
              </div>
            {/if}
          </div>

          <!-- Always-visible kebab menu in its own separate column -->
          <button class="row-kebab" aria-label="Actions for {iou.borrower_name}" onclick={(e) => { e.stopPropagation(); menuAnchor = e.currentTarget as HTMLElement; menuIou = iou; }} type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
          </button>
        </div>
      {/each}
    </div>
  {/if}
{/if}
</div>

<!-- ═══ Per-card overflow menu (mobile) ═══ -->
{#if menuIou}
  <RowActionsMenu
    title={menuIou.borrower_name}
    amount={formatCurrency(menuIou.amount)}
    tone="neutral"
    ariaLabel="Lending actions"
    anchor={menuAnchor}
    onClose={() => (menuIou = null)}
    onPay={() => { const id = menuIou!.id; menuIou = null; onPay?.(id); }}
    payLabel="Record Payment"
    onViewHistory={() => { const id = menuIou!.id; menuIou = null; onViewHistory?.(id); }}
    onEdit={() => { const id = menuIou!.id; menuIou = null; onEdit?.(id); }}
    onDuplicate={() => { const id = menuIou!.id; menuIou = null; onDuplicate?.(id); }}
    onDelete={() => { const id = menuIou!.id; menuIou = null; onDelete?.(id); }}
  />
{/if}

<style>
  /* ═══════════════════════════════════════════════════════
     Shared
     ═══════════════════════════════════════════════════════ */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-2xl) var(--space-md);
    text-align: center;
    background: var(--color-cream);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-card);
  }

  .empty-icon {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-teal-bg);
    color: var(--color-teal);
    border-radius: var(--radius-lg);
    margin-bottom: var(--space-md);
  }

  .empty-title {
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--color-ink);
    margin: 0 0 4px;
  }

  .empty-sub {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
    margin: 0;
  }

  .table-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-2xl) var(--space-md);
    text-align: center;
    background: var(--color-surface);
  }

  .table-empty p {
    margin: 0;
    color: var(--color-text-muted);
    font-style: italic;
    font-size: var(--font-size-sm);
  }

  /* ═══════════════════════════════════════════════════════
     CARD VIEW
     ═══════════════════════════════════════════════════════ */
  .iou-container {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .triage-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    border: none;
    outline: none;
    box-shadow: none;
  }

  /* Group header (sticky). Right padding is 0 so the count chip snaps to the
     content right rail (matches header actions + toolbar + hero). */
  .group-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid var(--line);
    background: var(--mint-tint);
    position: sticky;
    top: 0;
    z-index: 3;
    backdrop-filter: blur(8px);
    box-shadow: none;
    outline: none;
  }

  .group-emoji {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-teal-bg);
    border-radius: var(--radius-sm);
    font-size: 14px;
    flex-shrink: 0;
  }

  .group-label {
    font-family: var(--font-display);
    font-size: var(--font-size-sm);
    font-weight: 700;
    color: var(--teal-deep);
    text-transform: none;
    letter-spacing: 0.02em;
  }

  .group-count {
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  /* Card */
  .iou-card {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: 14px var(--space-md);
    padding-left: calc(var(--space-md) + 4px);
    background: var(--color-surface);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-xl);
    min-height: 72px;
    transition: all 200ms var(--bounce);
    overflow: hidden;
  }

  .iou-card:hover {
    background: var(--row-hover-bg);
    box-shadow: var(--shadow-lg);
    transform: translateY(-2px);
  }

  /* Focus split: pointer users get no outline; keyboard users get the
     proper --focus ring with 2px --surface offset. */
  .iou-card:focus {
    outline: none;
  }

  .iou-card:focus-visible {
    outline: none;
    box-shadow: var(--focus);
  }

  .iou-card.paid {
    opacity: 0.7;
    background: var(--color-cream);
  }

  /* ═══════════════════════════════════════════════════════
     Overdue slow breathing pulse (cards)
     ═══════════════════════════════════════════════════════ */
  .iou-card.overdue {
    animation: boom-pulse 3s ease-in-out infinite;
  }

  /* ═══════════════════════════════════════════════════════
     Progress fill animation on reveal
     ═══════════════════════════════════════════════════════ */
  .iou-card.revealed .progress-fill {
    animation: fillProgress 600ms var(--ease) both;
  }

  @keyframes fillProgress {
    from { width: 0%; }
    to { width: var(--progress-target, 100%); }
  }

  /* ═══════════════════════════════════════════════════════
     Scroll Reveal Animations
     ═══════════════════════════════════════════════════════ */
  .reveal-on-scroll.will-reveal {
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 400ms var(--ease), transform 400ms var(--ease);
  }

  .reveal-on-scroll.will-reveal.revealed {
    opacity: 1;
    transform: translateY(0);
  }

  /* Staggered reveal for group headers */
  .triage-group:first-child .group-header.reveal-on-scroll.will-reveal { transition-delay: 0ms; }
  .triage-group:nth-child(2) .group-header.reveal-on-scroll.will-reveal { transition-delay: 60ms; }
  .triage-group:nth-child(3) .group-header.reveal-on-scroll.will-reveal { transition-delay: 120ms; }
  .triage-group:nth-child(4) .group-header.reveal-on-scroll.will-reveal { transition-delay: 180ms; }

  /* Cards reveal after their group header */
  .triage-group .iou-card.reveal-on-scroll.will-reveal { transition-delay: 100ms; }

  /* Left accent bar (STATE-colored) */
  .iou-accent {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: 4px;
    border-radius: 0 2px 2px 0;
  }

  /* Initial ring */
  .iou-initial-ring {
    width: 42px;
    height: 42px;
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border: 2px solid;
  }

  .iou-initial {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 800;
  }

  /* Center: name + metadata + progress */
  .iou-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    position: relative;
  }

  /* Hover cluster — absolute inside the info area, right-aligned, ending
     before the amount/status cluster. Single-gradient backdrop (solid
     row-hover tint with a left-fading edge) blends into the card. */
  .iou-hover-slot {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    z-index: 3;
  }

  /* Backdrop only at 760-1199px where cluster can overlap text */
  @media (min-width: 760px) and (max-width: 1199px) {
    .iou-hover-slot :global(.hover-actions) {
      background: linear-gradient(to right, transparent, var(--row-hover-bg) 24px);
      padding-left: 24px;
    }
  }

  /* ≥1200px: no backdrop — middle region is empty, nothing collides */
  @media (min-width: 1200px) {
    .iou-hover-slot :global(.hover-actions) {
      background: none;
      padding: 0;
    }
  }

  .iou-name {
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--color-ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .iou-name.strikethrough {
    text-decoration: line-through;
    color: var(--color-text-muted);
  }

  .iou-meta {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Due-first meta for mobile — hidden on desktop (replaces .iou-meta) */
  .iou-meta-mobile {
    display: none;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    white-space: normal;
  }

  /* Progress bar */
  .iou-progress {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin-top: 4px;
  }

  .progress-track {
    flex: 1;
    max-width: 100px;
    height: 6px;
    background: var(--color-hairline);
    border-radius: var(--radius-pill);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    border-radius: var(--radius-pill);
    transition: width 600ms var(--ease);
    min-width: 0;
  }

  .progress-label {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 600;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  /* "Collected" caption + percentage — shown on mobile only */
  .progress-caption {
    display: none;
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  .progress-pct {
    display: none;
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 600;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  /* Right: amount + actions */
  .iou-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    flex-shrink: 0;
    min-width: 90px;
  }

  .iou-amount {
    font-size: var(--font-size-base);
    font-weight: 700;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
  }

  .iou-amount.paid-amount {
    text-decoration: line-through;
    color: var(--color-text-muted) !important;
  }

  .iou-paid-sub {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 600;
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  /* Countdown pill */
  .countdown-pill {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: var(--radius-pill);
    font-family: var(--font-mono);
    letter-spacing: -0.01em;
    white-space: nowrap;
  }

  .iou-actions-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 2px;
  }

  .iou-btn {
    padding: 4px 10px;
    border-radius: var(--radius-pill);
    font-size: var(--font-size-xs);
    font-weight: 600;
    min-height: 30px;
    cursor: pointer;
    border: none;
    font-family: inherit;
    transition: all 120ms ease;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .iou-btn-pay {
    background: var(--teal);
    color: var(--color-surface);
  }

  .iou-btn-pay:hover {
    background: var(--teal-deep);
    transform: scale(1.05);
    box-shadow: 0 4px 16px rgba(79, 157, 136, 0.22);
  }

  .recovered-glow {
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--color-sky);
    padding: 4px 10px;
    border-radius: var(--radius-pill);
    background: rgba(93, 173, 226, 0.10);
    box-shadow: var(--glow-sky);
  }

  /* Overflow trigger (⋯) — always visible, quiet at rest */
  .iou-overflow {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    margin-top: 2px;
    border: none;
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    transition: background 140ms ease-out, color 140ms ease-out;
    -webkit-tap-highlight-color: transparent;
  }

  .iou-overflow:hover {
    background: var(--color-teal-bg);
    color: var(--color-teal);
  }

  /* Single primary CTA — mobile only */
  .iou-mobile-actions {
    display: none;
  }

  /* ═══════════════════════════════════════════════════════
     REGISTER VIEW (Table) — Flip7 register, mirrors /transactions
     ═══════════════════════════════════════════════════════ */

  /* Card shell — identical to the transactions flat register */
  .iou-register {
    background: var(--color-surface);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-xl);
    overflow: hidden;
  }

  /* ── Column header (sticky, mono uppercase) ──
     Mirrors the data-row grid at both breakpoints so headers never drift
     from their columns. <1200px: trailing 48px kebab column. ≥1200px: the
     trailing column widens to the reserved actions column — measured from
     the hover cluster + kebab arithmetic (see .iou-row ≥1200px). */
  .register-header {
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr) 96px 108px 116px 48px;
    align-items: center;
    column-gap: var(--space-sm);
    padding: var(--space-xs) var(--space-lg);
    background: var(--mint-tint);
    border-bottom: 1px solid var(--color-hairline);
    position: sticky;
    top: 0;
    z-index: 2;
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-muted);
  }

  @media (min-width: 768px) {
    .register-header {
      grid-template-columns: 28px minmax(0, 1fr) 96px 108px 116px 300px 48px;
    }

    .register-header.show-projected {
      grid-template-columns: 28px minmax(0, 1fr) 96px 108px 116px 110px 300px 48px;
    }
  }

  .rh-circle {
    width: 28px;
    height: 28px;
  }

  .rh-name { min-width: 0; }
  .rh-due { min-width: 0; }
  .rh-progress { text-align: right; }
  .rh-amount { text-align: right; }
  .rh-projected { text-align: right; }

  /* Reserved actions zone header cell — empty, ~300px wide on desktop (≥768px).
     Hidden below 768px — mobile/tablet layout is unchanged. */
  .rh-actions-zone {
    display: none;
  }

  @media (min-width: 768px) {
    .rh-actions-zone {
      display: block;
      width: 300px;
    }
  }

  /* ── Selection check column header ── */
  .rh-check {
    width: 44px;
    height: 28px;
    flex-shrink: 0;
  }

  /* ── Row checkbox cell ── */
  .row-check-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    flex-shrink: 0;
  }

  .row-checkbox {
    width: 18px;
    height: 18px;
    accent-color: var(--color-teal);
    cursor: pointer;
    flex-shrink: 0;
    border-radius: var(--radius-sm);
  }

  /* ── Selected row highlight ── */
  .iou-row-selected {
    background: var(--color-teal-bg, rgba(79, 157, 136, 0.06)) !important;
  }

  .iou-row-selected::after {
    content: '';
    position: absolute;
    inset: 0;
    border-left: 3px solid var(--color-teal);
    pointer-events: none;
  }

  /* ── Card selection checkbox ── */
  .iou-card-checkbox-btn {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    cursor: pointer;
    padding: 0;
    border-radius: var(--radius-sm);
  }

  .iou-card-checkbox-btn input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: var(--color-teal);
    cursor: pointer;
    pointer-events: none;
  }

  .iou-card-selected {
    outline: 2px solid var(--color-teal);
    outline-offset: -1px;
  }

  /* Desktop (≥769px): comfortable minimum header height. min-height (not
     fixed height) so the header can still grow if content wraps. */
  @media (min-width: 769px) {
    .register-header {
      min-height: 42px;
    }
  }

  /* ── Rows ── */
  .iou-row {
    position: relative;
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr) 96px 108px 116px 48px;
    align-items: center;
    column-gap: var(--space-sm);
    padding: var(--space-sm) var(--space-lg);
    border-bottom: 1px solid var(--color-hairline);
    background: var(--color-surface);
    min-height: 56px;
    transition: background 180ms var(--ease);
    overflow: hidden;
    cursor: pointer; /* clickable row → opens payment history (same as .txn-row) */
  }

  /* ≥768px: the trailing column becomes a reserved actions column holding
     the hover cluster + kebab together (money never shifts). Sized from
     measured arithmetic so overlap is impossible by construction:
       Record Payment pill ≈ 140px  (13px "Record Payment" ~108px + 32px padding)
       edit icon              44px
       divider (1px+8px margins)  9px
       delete icon            44px
       3 flex gaps × 4px       12px
       ─ cluster subtotal     249px
       kebab                  44px
       cell gap (flex)         4px
       ─ reserved column      297px → 300px
     Grid-template-columns must match .register-header exactly so header and
     rows never drift. */
  @media (min-width: 768px) {
    .iou-row {
      grid-template-columns: 28px minmax(0, 1fr) 96px 108px 116px 300px 48px;
    }

    .iou-row.show-projected {
      grid-template-columns: 28px minmax(0, 1fr) 96px 108px 116px 110px 300px 48px;
    }
  }

  /* Left accent bar — state-colored (coral=overdue, gold=due, teal=track, sky=paid),
     revealed on hover, the lifecycle signature over the register shell. */
  .iou-row::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 0;
    border-radius: 0 2px 2px 0;
    background: var(--row-accent, var(--color-teal));
    transition: width 120ms var(--ease);
    pointer-events: none;
  }

  .iou-row:hover {
    background: var(--color-teal-bg);
  }

  .iou-row:hover::before {
    width: 4px;
  }

  .iou-row:focus-visible {
    outline: 2px solid var(--color-teal);
    outline-offset: -2px;
  }

  .iou-row:last-child {
    border-bottom: none;
  }

  .iou-row.overdue {
    background: rgba(239, 108, 74, 0.03);
  }

  .iou-row.overdue:hover {
    background: rgba(239, 108, 74, 0.06);
  }

  .iou-row.paid {
    opacity: 0.62;
  }

  /* Leading state ring */
  .row-circle {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-display);
    font-size: 11px;
    font-weight: 800;
    flex-shrink: 0;
  }

  /* Identity — position:relative anchors the hover cluster overlay */
  .row-main {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    position: relative;
  }

  .row-line1 {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .row-name {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .row-name.strikethrough {
    text-decoration: line-through;
    color: var(--color-text-muted);
  }

  .row-state-chip {
    padding: 1px 8px;
    border-radius: var(--radius-pill);
    font-family: var(--font-display);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.03em;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .row-meta {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Due: countdown + date */
  .row-due {
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
  }

  .row-due-group {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
    min-width: 0;
  }

  .cd-text {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .cd-text.muted {
    color: var(--color-text-muted);
  }

  .due-date {
    font-size: 10px;
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }

  /* Progress */
  .row-progress {
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
  }

  .row-progress-group {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .row-progress-track {
    width: 48px;
    height: 4px;
    background: var(--color-hairline);
    border-radius: var(--radius-pill);
    overflow: hidden;
  }

  .row-progress-fill {
    height: 100%;
    border-radius: var(--radius-pill);
    transition: width 400ms var(--ease);
  }

  .row-progress-label {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 600;
    color: var(--color-text-muted);
    width: 28px;
    text-align: right;
  }

  /* Amount — headline money column */
  .row-amount {
    min-width: 0;
    text-align: right;
  }

  .amount-num {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
  }

  .amount-num.struck {
    text-decoration: line-through;
    color: var(--color-text-muted) !important;
  }

  /* Projected Interest — Lending-only derived column */
  .row-projected {
    min-width: 0;
    text-align: right;
  }

  .projected-num {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
    color: var(--color-text-muted);
  }

  /* Reserved actions zone row cell — invisible on mobile/tablet,
     fixed ~300px on desktop (≥768px). On hover, the quick actions
     fade in INSIDE this zone, right-aligned and vertically centered. */
  .row-actions-zone {
    display: none;
  }

  @media (min-width: 768px) {
    .row-actions-zone {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      width: 300px;
    }
  }

  /* Reserved actions — always rendered; show with opacity-0 group-hover:opacity-100.
     The parent row has data-hover-row which RowHoverActions.css uses to reveal. */
  .row-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    width: 100%;
  }

  /* RowHoverActions hover-actions opacity handled by its own CSS via
     :global([data-hover-row]:hover) .hover-actions */

  /* Kebab — always visible, quiet at rest. Opens the overflow sheet holding
     View History / Duplicate / Edit / Delete (the cluster carries only the
     quick actions). */
  .row-kebab {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    justify-self: center;
    align-self: center;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: background 180ms var(--ease), color 180ms var(--ease);
  }

  .row-kebab:hover,
  .row-kebab:focus-visible {
    background: var(--mint-tint);
    color: var(--teal-deep);
  }

  @media (prefers-reduced-motion: reduce) {
    .iou-card { transition: none; }
    .iou-card.overdue { animation: none; }
    .progress-fill { transition: none; animation: none !important; }
    .reveal-on-scroll.will-reveal {
      opacity: 1 !important;
      transform: none !important;
      transition: none !important;
    }
    .iou-row { transition: none; }
    .iou-row::before { transition: none; }
    .row-actions { transition: none; }
    .row-progress-fill { transition: none; }
    .iou-overflow { transition: none; }
  }

  /* ═══════════════════════════════════════════════════════
     Responsive
     ═══════════════════════════════════════════════════════ */
  @media (max-width: 640px) {
    /* Card reflows to a compact grid: avatar | name+amount | then meta,
       progress, then the single CTA row. Desktop keeps the flex row above. */
    .iou-card {
      display: grid;
      grid-template-columns: 40px 1fr auto;
      grid-template-areas:
        'avatar info right'
        'actions actions actions';
      column-gap: 10px;
      row-gap: 4px;
      align-items: start;
      padding: 10px 12px;
      min-height: 0;
    }

    .iou-initial-ring {
      grid-area: avatar;
      width: 40px;
      height: 40px;
      margin-top: 2px;
    }

    .iou-info { grid-area: info; min-width: 0; }

    .iou-right {
      grid-area: right;
      align-items: flex-end;
      gap: 4px;
      min-width: 0;
    }

    .iou-meta { display: none; }

    .iou-meta-mobile {
      display: block;
    }

    .iou-amount {
      font-size: var(--font-size-lg);
      text-align: right;
      white-space: nowrap;
    }

    .iou-overflow {
      display: inline-flex;
    }

    .state-pill { display: none; }

    .iou-mobile-actions {
      grid-area: actions;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--space-sm);
      padding-top: 6px;
      margin-top: 2px;
      border-top: 1px solid var(--color-hairline);
    }

    .iou-mobile-actions .iou-btn-pay {
      min-height: 36px;
      padding: 6px 16px;
      font-size: var(--font-size-sm);
    }

    .iou-mobile-actions .recovered-glow {
      padding: 6px 16px;
    }

    .iou-progress {
      width: 100%;
      gap: 6px;
      margin-top: 4px;
    }

    .progress-track {
      flex: 1;
      max-width: none;
      height: 6px;
    }

    .progress-caption {
      display: inline;
      font-size: var(--font-size-xs);
    }

    .progress-pct {
      display: inline;
      font-size: var(--font-size-xs);
    }
  }

  @media (max-width: 480px) {
    .group-header {
      background: var(--color-cream);
    }

    .iou-initial { font-size: 13px; }
  }

  /* ═══════════════════════════════════════════════════════
     RESPONSIVE: Register collapses to labeled cards (≤640px)
     Mirrors the /transactions register mobile pattern. The Card/Table toggle
     stays meaningful on mobile: Card mode = triage cards, Table mode = these
     labeled cards (one per row).
     ═══════════════════════════════════════════════════════ */
  @media (max-width: 640px) {
    .iou-register {
      background: transparent;
      border: none;
      overflow: visible;
    }

    .register-header {
      display: none;
    }

    .iou-row {
      display: grid;
      grid-template-columns: 28px 1fr auto;
      column-gap: var(--space-sm);
      row-gap: 4px;
      padding: var(--space-sm) var(--space-md);
      margin: 0 var(--space-sm) 6px;
      background: var(--color-surface);
      border: 1px solid var(--color-hairline);
      border-radius: var(--radius-lg);
      min-height: 0;
    }

    .iou-row:last-child {
      margin-bottom: 0;
    }

    .iou-row::before {
      display: none;
    }

    .iou-row:hover {
      background: var(--color-surface);
    }

    .iou-row.overdue {
      background: rgba(239, 108, 74, 0.04);
    }

    .iou-row.overdue:hover {
      background: rgba(239, 108, 74, 0.04);
    }

    .iou-row.paid {
      opacity: 0.7;
    }

    /* Line 1: circle + name/chip left, kebab top right, amount below kebab */
    .row-circle {
      grid-column: 1;
      grid-row: 1;
      align-self: start;
      margin-top: 2px;
    }

    .row-main {
      grid-column: 2;
      grid-row: 1;
    }

    .row-kebab {
      grid-column: 3;
      grid-row: 1;
      justify-self: end;
      align-self: start;
      margin-top: 2px;
    }

    .row-amount {
      grid-column: 3;
      grid-row: 2;
      align-self: start;
      margin-top: 2px;
    }

    .row-meta {
      white-space: normal;
    }

    /* Hide the desktop-only actions zone on mobile — it creates an empty gap */
    .row-actions-zone {
      display: none;
    }

    /* Labeled rows: label (::before) left, value group right */
    .row-due,
    .row-progress,
    .row-projected {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-sm);
      padding-top: 4px;
      border-top: 1px solid var(--color-hairline);
    }

    .row-due {
      grid-row: 3;
      flex-direction: row;
    }

    .row-progress {
      grid-row: 4;
      flex-direction: row;
    }

    .row-projected {
      grid-row: 5;
      flex-direction: row;
    }

    .row-due::before,
    .row-progress::before,
    .row-projected::before {
      content: attr(data-label);
      font-family: var(--font-display);
      font-size: var(--font-size-xs);
      font-weight: 600;
      color: var(--color-text-muted);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      flex-shrink: 0;
    }

    .row-due-group {
      flex-direction: row;
      align-items: center;
      gap: 6px;
    }

    /* Actions: full-width button bar at bottom */
    .row-actions {
      position: static;
      grid-column: 1 / -1;
      grid-row: 6;
      display: flex;
      align-items: center;
      width: 100%;
      gap: 6px;
      padding: 6px 52px 0 0;
      margin-top: 2px;
      border-top: 1px solid var(--color-hairline);
    }

    /* Cluster hidden on touch / narrow — kebab is the only actions path */
    .row-actions {
      display: none;
    }
  }

  /* <768px (narrow desktop/tablet) and touch: no hover cluster — the kebab is the
     only actions path. The actions-zone column is hidden on mobile/tablet. */
  @media (max-width: 767px) {
    .row-actions {
      display: none;
    }
    .iou-hover-slot {
      display: none;
    }
  }

  /* Touch + coarse pointer: cluster hidden everywhere, kebab visible */
  @media (hover: none), (pointer: coarse) {
    .row-actions {
      display: none;
    }
    .iou-hover-slot {
      display: none;
    }
    .row-kebab {
      display: inline-flex;
    }
  }

  /* ═══════════════════════════════════════════════════════
     MOBILE COMPACT CARDS — the ONLY list presentation < 768px
     (below md). Desktop (≥ 768px) keeps the card/table views above;
     the desktop area and the mobile list are mutually exclusive by
     breakpoint. Compact label+value rows, no fixed/min heights.
     ═══════════════════════════════════════════════════════ */
  .iou-mobile-list {
    display: none;
  }

  /* Desktop (md+) — wrapper is transparent so the card/table views lay
     out exactly as before (no extra box in the DOM flow). */
  .iou-desktop-area {
    display: contents;
  }

  @media (max-width: 767px) {
    .iou-desktop-area {
      display: none;
    }

    .iou-mobile-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
    }

    .iou-mobile-card {
      position: relative;
      display: flex;
      flex-direction: column;
      padding: 14px 16px;
      background: var(--color-surface);
      border: 1px solid var(--color-hairline);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-sm);
    }

    .iou-mobile-card.overdue {
      background: rgba(239, 108, 74, 0.04);
    }

    .iou-mobile-card.paid {
      opacity: 0.7;
    }

    /* Head row: [checkbox] [avatar] [name + badge] [⋯] */
    .mc-head {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .mc-checkbox {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      flex-shrink: 0;
      margin-right: 10px;
      border: none;
      border-radius: var(--radius-full);
      background: transparent;
      cursor: pointer;
    }

    .mc-checkbox input {
      width: 20px;
      height: 20px;
      margin: 0;
      accent-color: var(--color-teal);
      pointer-events: none;
    }

    .mc-avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      flex-shrink: 0;
      border: 2px solid;
      border-radius: var(--radius-full);
      font-family: var(--font-display);
      font-size: 16px;
      font-weight: 800;
    }

    .mc-head-main {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-width: 0;
    }

    .mc-name {
      font-size: var(--font-size-base);
      font-weight: 600;
      color: var(--color-ink);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .mc-name.struck {
      text-decoration: line-through;
      color: var(--color-text-muted);
    }

    .mc-badge {
      align-self: flex-start;
      padding: 1px 8px;
      border-radius: var(--radius-pill);
      font-family: var(--font-display);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.03em;
      white-space: nowrap;
    }

    .mc-kebab {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      flex-shrink: 0;
      border: none;
      border-radius: var(--radius-pill);
      background: transparent;
      color: var(--color-text-muted);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }

    /* Meta line: "Lent Jun 1, 2026 · notes" */
    .mc-meta {
      margin-top: 2px;
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Label + value rows (divider above the first row) */
    .mc-cells {
      display: flex;
      flex-direction: column;
      margin-top: 10px;
    }

    .mc-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-md);
      padding-top: 8px;
      margin-top: 8px;
      border-top: 1px solid var(--color-hairline);
    }

    .mc-cell {
      display: flex;
      align-items: baseline;
      gap: 6px;
      min-width: 0;
    }

    .mc-right {
      justify-content: flex-end;
    }

    .mc-k {
      flex-shrink: 0;
      font-family: var(--font-display);
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--color-text-muted);
    }

    .mc-v {
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 600;
      color: var(--color-ink);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .mc-amount {
      font-size: var(--font-size-sm);
      font-weight: 700;
    }

    .mc-amount.struck {
      text-decoration: line-through;
      color: var(--color-text-muted) !important;
    }

    .mc-progress {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .mc-track {
      width: 56px;
      height: 4px;
      border-radius: var(--radius-pill);
      background: var(--color-hairline);
      overflow: hidden;
    }

    .mc-fill {
      display: block;
      height: 100%;
      border-radius: var(--radius-pill);
    }

    .mc-pct {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 600;
      color: var(--color-text-muted);
      white-space: nowrap;
    }

    .mc-interest {
      color: var(--color-text-muted);
    }
  }
</style>

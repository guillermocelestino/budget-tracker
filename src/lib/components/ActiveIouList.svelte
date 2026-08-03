<script lang="ts">
  import { onMount } from 'svelte';
  import { formatCurrency, formatDate, getToday } from '$lib/utils/format';
  import RowActionsMenu from '$lib/components/RowActionsMenu.svelte';
  import type { Lending } from '$lib/types';

  let {
    ious = [],
    onPay,
    onEdit,
    onDelete,
    onDuplicate,
    direction = 'lent',
    viewMode = 'card',
  }: {
    ious: Lending[];
    onPay?: (id: number) => void;
    onEdit?: (id: number) => void;
    onDelete?: (id: number) => void;
    onDuplicate?: (id: number) => void;
    direction?: 'lent' | 'borrowed';
    viewMode?: 'card' | 'table';
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

  function computeState(iou: Lending): State {
    if (iou.status === 'paid') return 'paid';
    if (!iou.due_date) return 'later';
    const due = new Date(iou.due_date + 'T00:00:00');
    const diffMs = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'overdue';
    if (diffDays <= 7) return 'due-this-week';
    return 'later';
  }

  function daysUntilDue(dueDate: string | null): number | null {
    if (!dueDate) return null;
    const due = new Date(dueDate + 'T00:00:00');
    const diffMs = due.getTime() - today.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  function daysOverdue(dueDate: string | null): number {
    if (!dueDate) return 0;
    const due = new Date(dueDate + 'T00:00:00');
    const diffMs = today.getTime() - due.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }

  // ─── Progress ───
  // If the schema had repaid_amount, we'd compute from that.
  // Today we use amount as 100% and show 0 progress for active, 100% for paid.
  // In future: partial repayments via a separate table.
  function progressPercent(iou: Lending): number {
    return iou.status === 'paid' ? 100 : 0;
  }

  function recoveredAmount(iou: Lending): number {
    return iou.status === 'paid' ? iou.amount : 0;
  }

  // ─── Triage groups ───
  type TriageGroup = {
    id: string;
    label: string;
    emoji: string;
    state: State;
    items: Lending[];
    count: number;
  };

  const triageGroups = $derived.by(() => {
    const overdue: Lending[] = [];
    const dueThisWeek: Lending[] = [];
    const later: Lending[] = [];
    const paid: Lending[] = [];

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
    const sortByAmountDesc = (a: Lending, b: Lending) => b.amount - a.amount;

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

  const hasActiveItems = $derived(triageGroups.some(g => g.id !== 'paid' && g.items.length > 0));

  // ─── Per-card overflow menu (mobile) ───
  let menuIou = $state<Lending | null>(null);

  // ─── State styling helpers ───
  function stateAccentColor(state: State): string {
    switch (state) {
      case 'overdue': return 'var(--color-coral)';
      case 'due-this-week': return 'var(--color-gold)';
      case 'later': return 'var(--color-teal)';
      case 'paid': return 'var(--color-sky)';
      default: return 'var(--color-teal)';
    }
  }

  function stateBgColor(state: State): string {
    switch (state) {
      case 'overdue': return 'rgba(239, 108, 74, 0.08)';
      case 'due-this-week': return 'rgba(255, 210, 63, 0.10)';
      case 'later': return 'var(--color-teal-bg)';
      case 'paid': return 'rgba(93, 173, 226, 0.08)';
      default: return 'var(--color-teal-bg)';
    }
  }

  function stateTextColor(state: State): string {
    switch (state) {
      case 'overdue': return 'var(--color-coral)';
      case 'due-this-week': return 'var(--color-gold-dark)';
      case 'later': return 'var(--color-teal)';
      case 'paid': return 'var(--color-sky)';
      default: return 'var(--color-teal)';
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

  function countdownLabel(iou: Lending): { text: string; color: string } | null {
    if (iou.status === 'paid') return null;
    const days = daysUntilDue(iou.due_date);
    if (days === null) return null;
    if (days < 0) return { text: `${-days}d overdue`, color: 'var(--color-coral)' };
    if (days === 0) return { text: 'Due today', color: 'var(--color-gold-dark)' };
    if (days <= 7) return { text: `Due in ${days}d`, color: 'var(--color-gold-dark)' };
    return { text: `Due in ${days}d`, color: 'var(--color-teal)' };
  }
</script>

<!-- ════════════════════════════════════════
     CARD VIEW (Primary: triage-grouped)
     ════════════════════════════════════════ -->
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
            {@const progressPct = iou.status === 'paid' ? 100 : 0}
            {@const init = iou.borrower_name.charAt(0).toUpperCase()}
            <div
              class="iou-card reveal-on-scroll"
              class:paid={iou.status === 'paid'}
              class:overdue={state === 'overdue'}
              style="border-color: {stateAccentColor(state)}40;"
            >
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
                  <span class="progress-pct" style="color: {stateTextColor(state)};">{progressPct}%</span>
                </div>
              </div>

              <!-- Right: amount + countdown + overflow (mobile) + hover actions (desktop) -->
              <div class="iou-right">
                <span class="iou-amount" class:paid-amount={iou.status === 'paid'} style="color: {stateTextColor(state)};">
                  {formatCurrency(iou.amount)}
                </span>

                <!-- Countdown pill -->
                {#if cd}
                  <span class="countdown-pill" style="background: {cd.color}15; color: {cd.color}; border: 1px solid {cd.color}30;">
                    {cd.text}
                  </span>
                {/if}

                <!-- Overflow trigger (mobile) -->
                <button class="iou-overflow" onclick={() => (menuIou = iou)} type="button" aria-label="More actions for {iou.borrower_name}" aria-haspopup="menu" aria-expanded={menuIou?.id === iou.id}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                </button>

                <!-- Hover actions (desktop) -->
                <div class="iou-actions">
                  <button class="iou-btn iou-btn-edit" onclick={() => onEdit?.(iou.id)} type="button" title="Edit">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                  </button>
                  <button class="iou-btn iou-btn-dup" onclick={() => onDuplicate?.(iou.id)} type="button" title="Duplicate">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  </button>
                  {#if iou.status !== 'paid'}
                    <button class="iou-btn iou-btn-pay" onclick={() => onPay?.(iou.id)} type="button">
                      {direction === 'lent' ? 'Mark Paid' : 'Repay'}
                    </button>
                  {:else}
                    <span class="recovered-glow">
                      {direction === 'lent' ? 'Recovered' : 'Repaid'}
                    </span>
                  {/if}
                  <button class="iou-btn iou-btn-delete" onclick={() => onDelete?.(iou.id)} type="button" title="Delete">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
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
                    {direction === 'lent' ? 'Mark Paid' : 'Repay'}
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
      <div class="register-header" role="rowheader">
        <span class="rh-circle" aria-hidden="true"></span>
        <span class="rh-name">{direction === 'lent' ? 'Borrower' : 'Lender'}</span>
        <span class="rh-due">Due</span>
        <span class="rh-progress">Progress</span>
        <span class="rh-amount">Amount</span>
      </div>

      {#each ious as iou (iou.id)}
        {@const state = computeState(iou)}
        {@const cd = countdownLabel(iou)}
        {@const progressPct = iou.status === 'paid' ? 100 : 0}
        {@const accent = stateAccentColor(state)}
        {@const bg = stateBgColor(state)}
        {@const fg = stateTextColor(state)}
        {@const init = iou.borrower_name.charAt(0).toUpperCase()}
        <div
          class="iou-row"
          class:overdue={state === 'overdue'}
          class:paid={iou.status === 'paid'}
          style="--row-accent: {accent};"
        >
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

          <!-- Amount (headline money column) -->
          <div class="row-amount">
            <span class="amount-num" class:struck={iou.status === 'paid'}>{formatCurrency(iou.amount)}</span>
          </div>

          <!-- Hover-reveal actions (overlay, never shift columns) -->
          <div class="row-actions">
            {#if iou.status !== 'paid'}
              <button class="row-pay" onclick={() => onPay?.(iou.id)} type="button">
                {direction === 'lent' ? 'Mark Paid' : 'Repay'}
              </button>
            {/if}
            <button class="row-icon" onclick={() => onEdit?.(iou.id)} type="button" title="Edit" aria-label="Edit {iou.borrower_name}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
            </button>
            <button class="row-icon" onclick={() => onDuplicate?.(iou.id)} type="button" title="Duplicate" aria-label="Duplicate {iou.borrower_name}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
            <button class="row-icon row-icon-del" onclick={() => onDelete?.(iou.id)} type="button" title="Delete" aria-label="Delete {iou.borrower_name}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
{/if}

<!-- ═══ Per-card overflow menu (mobile) ═══ -->
{#if menuIou}
  {@const menuIouId = menuIou.id}
  <RowActionsMenu
    title={menuIou.borrower_name}
    amount={formatCurrency(menuIou.amount)}
    tone="neutral"
    ariaLabel="Lending actions"
    onClose={() => (menuIou = null)}
    onEdit={() => { menuIou = null; onEdit?.(menuIouId); }}
    onDuplicate={() => { menuIou = null; onDuplicate?.(menuIouId); }}
    onDelete={() => { menuIou = null; onDelete?.(menuIouId); }}
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
  }

  /* Group header (sticky). Right padding is 0 so the count chip snaps to the
     content right rail (matches header actions + toolbar + hero). */
  .group-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) 0 var(--space-sm) var(--space-md);
    border-bottom: 3px dashed var(--color-teal);
    background: var(--color-cream);
    position: sticky;
    top: 0;
    z-index: 3;
    backdrop-filter: blur(8px);
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
    color: var(--color-ink);
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
    transform: translateY(-2px);
    box-shadow: var(--shadow-card);
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

  /* Hover actions */
  .iou-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 120ms ease;
    pointer-events: none;
    margin-top: 2px;
  }

  .iou-card:hover .iou-actions {
    opacity: 1;
    pointer-events: auto;
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
    background: var(--color-gold);
    /* Dark text on gold in BOTH themes — ink flips light in dark mode. */
    color: var(--color-on-gold);
  }

  .iou-btn-pay:hover {
    background: var(--color-gold-light);
    transform: scale(1.05);
    box-shadow: var(--glow-gold);
  }

  .iou-btn-delete {
    background: transparent;
    color: var(--color-text-muted);
    width: 30px;
    padding: 0;
    justify_content: center;
  }

  .iou-btn-delete:hover {
    background: rgba(239, 108, 74, 0.10);
    color: var(--color-coral);
  }

  .iou-btn-edit {
    background: transparent;
    color: var(--color-text-muted);
    width: 30px;
    padding: 0;
    justify-content: center;
  }

  .iou-btn-edit:hover {
    background: var(--color-teal-bg);
    color: var(--color-teal);
  }

  .iou-btn-dup {
    background: transparent;
    color: var(--color-text-muted);
    width: 30px;
    padding: 0;
    justify-content: center;
  }

  .iou-btn-dup:hover {
    background: var(--color-teal-bg);
    color: var(--color-teal);
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

  /* Overflow trigger (⋯) — mobile only */
  .iou-overflow {
    display: none;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    margin-top: 2px;
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-pill);
    background: var(--color-surface-inset);
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 120ms ease;
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

  /* ── Column header (sticky, mono uppercase) ── */
  .register-header {
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr) 96px 108px 116px;
    align-items: center;
    column-gap: var(--space-sm);
    padding: var(--space-xs) var(--space-lg);
    background: var(--color-surface-inset);
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

  .rh-circle {
    width: 28px;
    height: 28px;
  }

  .rh-name { min-width: 0; }
  .rh-due { min-width: 0; }
  .rh-progress { text-align: right; }
  .rh-amount { text-align: right; }

  /* ── Rows ── */
  .iou-row {
    position: relative;
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr) 96px 108px 116px;
    align-items: center;
    column-gap: var(--space-sm);
    padding: var(--space-sm) var(--space-lg);
    border-bottom: 1px dashed var(--color-hairline);
    background: var(--color-surface);
    min-height: 56px;
    transition: background 180ms var(--ease);
    overflow: hidden;
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

  /* Identity */
  .row-main {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
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

  /* ── Hover-reveal actions (overlay, never shift columns) ── */
  .row-actions {
    position: absolute;
    right: var(--space-lg);
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    gap: 2px;
    opacity: 0;
    padding: 4px;
    background: var(--color-surface);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    z-index: 2;
    transition: opacity 120ms var(--ease);
    pointer-events: none;
  }

  .iou-row:hover .row-actions {
    opacity: 1;
    pointer-events: auto;
  }

  .row-pay {
    padding: 4px 12px;
    border: none;
    border-radius: var(--radius-pill);
    background: var(--color-gold);
    color: var(--color-on-gold);
    font-family: var(--font-display);
    font-size: var(--font-size-xs);
    font-weight: 700;
    min-height: 30px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 120ms ease;
  }

  .row-pay:hover {
    background: var(--color-gold-light);
    box-shadow: var(--glow-gold);
  }

  .row-icon {
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 120ms ease;
  }

  .row-icon:hover {
    background: var(--color-teal-bg);
    color: var(--color-teal);
  }

  .row-icon-del:hover {
    background: rgba(239, 108, 74, 0.10);
    color: var(--color-coral);
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

    .iou-actions { display: none; }

    .iou-mobile-actions {
      grid-area: actions;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--space-sm);
      padding-top: 6px;
      margin-top: 2px;
      border-top: 1px dashed var(--color-hairline);
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
      border: 1px dashed var(--color-hairline);
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

    /* Line 1: circle + name/chip left, amount right */
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

    .row-amount {
      grid-column: 3;
      grid-row: 1;
      align-self: start;
      margin-top: 2px;
    }

    .row-meta {
      white-space: normal;
    }

    /* Labeled rows: label (::before) left, value group right */
    .row-due,
    .row-progress {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-sm);
      padding-top: 4px;
      border-top: 1px dashed var(--color-hairline);
    }

    .row-due {
      grid-row: 2;
      flex-direction: row;
    }

    .row-progress {
      grid-row: 3;
      flex-direction: row;
    }

    .row-due::before,
    .row-progress::before {
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

    /* Actions: full-width button bar */
    .row-actions {
      position: static;
      grid-column: 1 / -1;
      grid-row: 4;
      display: flex;
      width: 100%;
      gap: 6px;
      opacity: 1;
      transform: none;
      pointer-events: auto;
      background: none;
      border: none;
      border-radius: 0;
      box-shadow: none;
      padding: 6px 0 0;
      margin-top: 2px;
      border-top: 1px dashed var(--color-hairline);
    }

    .row-pay {
      flex: 1.2;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 36px;
      padding: 6px 8px;
    }

    .row-icon {
      flex: 1;
      width: auto;
      min-height: 36px;
      background: var(--color-cream);
    }
  }
</style>
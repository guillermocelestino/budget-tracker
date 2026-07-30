<script lang="ts">
  import { formatCurrency, formatDate, getToday } from '$lib/utils/format';
  import type { Lending } from '$lib/types';

  let {
    ious = [],
    onPay,
    onEdit,
    onDelete,
    direction = 'lent',
    viewMode = 'card',
  }: {
    ious: Lending[];
    onPay?: (id: number) => void;
    onEdit?: (id: number) => void;
    onDelete?: (id: number) => void;
    direction?: 'lent' | 'borrowed';
    viewMode?: 'card' | 'table';
  } = $props();

  // ─── Compute today from app helper (respects DEMO_TODAY) ───
  const todayStr = getToday();
  const today = new Date(todayStr + 'T00:00:00');

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
          <div class="group-header" style="border-bottom-color: {stateAccentColor(group.state)};">
            <span class="group-emoji">{group.emoji}</span>
            <span class="group-label">{group.label}</span>
            <span class="group-count">{group.count}</span>
          </div>

          {#each group.items as iou (iou.id)}
            {@const state = computeState(iou)}
            {@const cd = countdownLabel(iou)}
            {@const progressPct = iou.status === 'paid' ? 100 : 0}
            {@const init = iou.borrower_name.charAt(0).toUpperCase()}
            <div
              class="iou-card"
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

              <!-- Center: name + metadata + progress -->
              <div class="iou-info">
                <span class="iou-name" class:strikethrough={iou.status === 'paid'}>{iou.borrower_name}</span>
                <span class="iou-meta">
                  {direction === 'lent' ? 'Lent' : 'Borrowed'} {formatDate(iou.date_lent)}
                  {#if iou.due_date} · Due {formatDate(iou.due_date)}{/if}
                  {#if iou.interest_rate > 0} · {iou.interest_rate}% interest{/if}
                  {#if iou.notes && iou.notes.length > 0} · {iou.notes}{/if}
                </span>

                <!-- Progress bar -->
                <div class="iou-progress">
                  <div class="progress-track">
                    <div
                      class="progress-fill"
                      style="width: {Math.min(progressPct, 100)}%; background: {stateAccentColor(state)};"
                    ></div>
                  </div>
                  <span class="progress-label" style="color: {stateTextColor(state)};">
                    {formatCurrency(recoveredAmount(iou))} / {formatCurrency(iou.amount)}
                  </span>
                </div>
              </div>

              <!-- Right: amount + action -->
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

                <!-- State pill badge (tablet-on-card) -->
                <span class="state-pill" style="background: {stateBgColor(state)}; color: {stateTextColor(state)};">
                  {stateLabel(state)}
                </span>

                <!-- Hover actions -->
                <div class="iou-actions">
                  <button class="iou-btn iou-btn-edit" onclick={() => onEdit?.(iou.id)} type="button" title="Edit">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                  </button>
                  {#if iou.status !== 'paid'}
                    <button class="iou-btn iou-btn-pay" onclick={() => onPay?.(iou.id)} type="button">
                      {direction === 'lent' ? 'Mark Paid' : 'Repay'}
                    </button>
                  {:else}
                    <span class="recovered-glow">Recovered</span>
                  {/if}
                  <button class="iou-btn iou-btn-delete" onclick={() => onDelete?.(iou.id)} type="button" title="Delete">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/each}
    </div>
  {/if}

<!-- ════════════════════════════════════════
     TABLE VIEW (Compact, with lifecycle columns)
     ════════════════════════════════════════ -->
{:else}
  {#if ious.length === 0}
    <div class="empty-state table-empty">
      <p>No records to show</p>
    </div>
  {:else}
    <div class="table-scroll">
      <table class="lifecycle-table">
        <thead>
          <tr>
            <th>{direction === 'lent' ? 'Borrower' : 'Lender'}</th>
            <th class="num">Amount</th>
            <th class="num">Progress</th>
            <th>State</th>
            <th>Countdown</th>
            <th class="num">Interest</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each ious as iou (iou.id)}
            {@const state = computeState(iou)}
            {@const cd = countdownLabel(iou)}
            {@const progressPct = iou.status === 'paid' ? 100 : 0}
            <tr class:overdue={state === 'overdue'} class:paid={iou.status === 'paid'}>
              <td>
                <div class="borrower-cell">
                  <div class="borrower-avatar" style="background: {stateBgColor(state)}; color: {stateTextColor(state)};">
                    {iou.borrower_name.charAt(0).toUpperCase()}
                  </div>
                  {iou.borrower_name}
                </div>
              </td>
              <td class="num amount-cell">{formatCurrency(iou.amount)}</td>
              <td class="num">
                <div class="table-progress-wrap">
                  <div class="table-progress-track">
                    <div class="table-progress-fill" style="width: {progressPct}%; background: {stateAccentColor(state)};"></div>
                  </div>
                  <span class="table-progress-label">{progressPct}%</span>
                </div>
              </td>
              <td>
                <span class="state-chip" style="background: {stateBgColor(state)}; color: {stateTextColor(state)};">
                  {stateLabel(state)}
                </span>
              </td>
              <td>
                {#if cd}
                  <span class="cd-text" style="color: {cd.color};">{cd.text}</span>
                {:else}
                  <span class="cd-text muted">—</span>
                {/if}
              </td>
              <td class="num">{iou.interest_rate}%</td>
              <td>
                <div class="action-btns">
                  {#if iou.status !== 'paid'}
                    <button class="action-btn pay" onclick={() => onPay?.(iou.id)} type="button">{direction === 'lent' ? 'Paid' : 'Repay'}</button>
                  {/if}
                  <button class="action-btn edit" onclick={() => onEdit?.(iou.id)} type="button">Edit</button>
                  <button class="action-btn delete" onclick={() => onDelete?.(iou.id)} type="button">Del</button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
{/if}

<style>
  /* ══════════════════════════════════════════════════════
     Shared
     ══════════════════════════════════════════════════════ */
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
    background: var(--color-surface);
  }

  .table-empty p {
    margin: 0;
    color: var(--color-text-muted);
    font-style: italic;
  }

  /* ══════════════════════════════════════════════════════
     CARD VIEW
     ══════════════════════════════════════════════════════ */
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

  /* Group header (sticky) */
  .group-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
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
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    color: var(--color-text-muted);
    padding: 2px 10px;
    background: var(--color-surface);
    border-radius: var(--radius-pill);
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

  .iou-card.overdue {
    animation: boom-pulse 2s ease-in-out infinite;
  }

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

  /* State badge */
  .state-pill {
    font-size: 9px;
    font-weight: 700;
    padding: 1px 8px;
    border-radius: var(--radius-pill);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    display: none; /* Shown on hover */
  }

  .iou-card:hover .state-pill {
    display: inline;
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
    color: var(--color-ink);
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
    justify-content: center;
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

  .recovered-glow {
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--color-sky);
    padding: 4px 10px;
    border-radius: var(--radius-pill);
    background: rgba(93, 173, 226, 0.10);
    box-shadow: var(--glow-sky);
  }

  /* ══════════════════════════════════════════════════════
     TABLE VIEW
     ══════════════════════════════════════════════════════ */
  .table-scroll {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .lifecycle-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--font-size-sm);
    font-variant-numeric: tabular-nums;
  }

  .lifecycle-table thead th {
    text-align: left;
    padding: 10px 12px;
    font-weight: 600;
    color: var(--color-text-muted);
    font-size: 11px;
    text-transform: lowercase;
    letter-spacing: 0.02em;
    background: var(--color-cream);
    border-bottom: 3px dashed var(--color-teal);
    white-space: nowrap;
    font-family: var(--font-display);
  }

  .lifecycle-table thead th.num {
    text-align: right;
  }

  .lifecycle-table tbody td {
    padding: 10px 12px;
    border-bottom: 1px solid var(--color-hairline);
    vertical-align: middle;
    white-space: nowrap;
    transition: background 120ms ease;
  }

  .lifecycle-table tbody tr:hover td {
    background: var(--color-teal-bg);
  }

  .lifecycle-table tbody tr:hover td:first-child {
    box-shadow: inset 3px 0 0 0 var(--color-teal);
  }

  .lifecycle-table tbody tr.overdue td {
    background: rgba(239, 108, 74, 0.03);
  }

  .lifecycle-table tbody tr.overdue:hover td {
    background: rgba(239, 108, 74, 0.06);
  }

  .lifecycle-table tbody tr.paid td {
    opacity: 0.6;
  }

  .lifecycle-table tbody tr:last-child td {
    border-bottom: 1px solid var(--color-hairline);
  }

  .num {
    text-align: right;
    font-weight: 600;
    font-family: var(--font-mono);
  }

  .amount-cell {
    font-weight: 700;
  }

  .borrower-cell {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-weight: 600;
  }

  .borrower-avatar {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-full);
    font-weight: 700;
    font-size: var(--font-size-sm);
    font-family: var(--font-display);
    flex-shrink: 0;
  }

  /* Table progress */
  .table-progress-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 80px;
    justify-content: flex-end;
  }

  .table-progress-track {
    width: 50px;
    height: 4px;
    background: var(--color-hairline);
    border-radius: var(--radius-pill);
    overflow: hidden;
  }

  .table-progress-fill {
    height: 100%;
    border-radius: var(--radius-pill);
    transition: width 400ms var(--ease);
  }

  .table-progress-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--color-text-muted);
    width: 30px;
    text-align: right;
  }

  /* State chip */
  .state-chip {
    padding: 2px 10px;
    border-radius: var(--radius-pill);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.03em;
    white-space: nowrap;
    font-family: var(--font-display);
  }

  /* Countdown text */
  .cd-text {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .cd-text.muted {
    color: var(--color-text-muted);
  }

  /* Action buttons */
  .action-btns {
    display: flex;
    gap: 4px;
  }

  .action-btn {
    padding: 3px 8px;
    border: none;
    border-radius: var(--radius-sm);
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
    transition: all 120ms ease;
    font-family: inherit;
    min-height: 28px;
  }

  .action-btn.pay {
    background: var(--color-gold);
    color: var(--color-ink);
  }

  .action-btn.pay:hover {
    background: var(--color-gold-light);
    box-shadow: var(--glow-gold);
  }

  .action-btn.edit {
    background: var(--color-teal-bg);
    color: var(--color-teal);
  }

  .action-btn.edit:hover {
    background: var(--color-teal);
    color: white;
  }

  .action-btn.delete {
    background: rgba(239, 108, 74, 0.10);
    color: var(--color-coral);
  }

  .action-btn.delete:hover {
    background: var(--color-coral);
    color: white;
  }

  /* ══════════════════════════════════════════════════════
     Responsive
     ══════════════════════════════════════════════════════ */
  @media (prefers-reduced-motion: reduce) {
    .iou-card { transition: none; }
    .iou-card.overdue { animation: none; }
    .progress-fill { transition: none; }
  }

  @media (max-width: 640px) {
    .iou-card { flex-wrap: wrap; gap: var(--space-sm); }
    .iou-meta { display: none; }
    .iou-progress { max-width: 120px; }
    .state-pill { display: inline; }
  }

  @media (max-width: 480px) {
    .group-header {
      background: var(--color-cream);
    }

    .iou-initial-ring {
      width: 32px;
      height: 32px;
    }
    .iou-initial { font-size: 13px; }
    .iou-amount { font-size: var(--font-size-sm); }
    .iou-right {
      flex-direction: row;
      flex-wrap: wrap;
      width: 100%;
      justify-content: space-between;
      align-items: center;
      padding-top: 4px;
      border-top: 1px dashed var(--color-hairline);
      margin-top: 4px;
    }
    .iou-actions { opacity: 1; pointer-events: auto; padding-top: 2px; }

    .lifecycle-table { font-size: 11px; }
    .lifecycle-table thead th,
    .lifecycle-table tbody td {
      padding: 8px 6px;
    }
    .lifecycle-table tbody td:nth-child(5),
    .lifecycle-table thead th:nth-child(5) {
      display: none;
    }
  }
</style>
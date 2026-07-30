<script lang="ts">
  import { formatCurrency, formatDate } from '$lib/utils/format';
  import type { Lending } from '$lib/types';

  let {
    ious = [],
    onPay,
    onEdit,
    onDelete,
    direction = 'lent'
  }: {
    ious: Lending[];
    onPay?: (id: number) => void;
    onEdit?: (id: number) => void;
    onDelete?: (id: number) => void;
    direction?: 'lent' | 'borrowed';
  } = $props();

  function daysOverdue(dueDate: string | null): number {
    if (!dueDate) return 0;
    const due = new Date(dueDate);
    const today = new Date();
    const diff = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  }

  const directionAccent = $derived(direction === 'lent' ? 'teal' : 'coral');
  const amountPrefix = $derived(direction === 'lent' ? '+' : '−');
  const amountColor = $derived(direction === 'lent' ? 'var(--color-teal)' : 'var(--color-coral)');
  const dateLabel = $derived(direction === 'lent' ? 'Lent on' : 'Borrowed on');
  const payButtonText = $derived(direction === 'lent' ? 'Mark Paid' : 'Mark Repaid');
</script>

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
    {#each ious as iou (iou.id)}
      {@const overdue = daysOverdue(iou.due_date)}
      <div class="iou-row" class:overdue={overdue > 0} class:paid={iou.status === 'paid'} data-iou-id={iou.id}>
        <div class="iou-accent" class:teal={iou.status !== 'paid' && overdue === 0 && direction === 'lent'} class:coral={overdue > 0 || direction === 'borrowed'} class:sky={iou.status === 'paid'}></div>

        <!-- Direction icon -->
        <div class="iou-arrow">
          {#if iou.status === 'paid'}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          {:else}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
              <polyline points="17 6 23 6 23 12"/>
            </svg>
          {/if}
        </div>

        <!-- Center: name + metadata -->
        <div class="iou-info">
          <span class="iou-name" class:strikethrough={iou.status === 'paid'}>{iou.borrower_name}</span>
          <span class="iou-meta">
            {dateLabel} {formatDate(iou.date_lent)}
            {#if iou.due_date} · Due {formatDate(iou.due_date)}{/if}
            {#if iou.interest_rate > 0} · {iou.interest_rate}% interest{/if}
            {#if iou.notes && iou.notes.length > 0} · {iou.notes}{/if}
          </span>
          {#if overdue > 0 && iou.status !== 'paid'}
            <span class="overdue-badge">{overdue} days overdue</span>
          {/if}
        </div>

        <!-- Right: amount + hover actions -->
        <div class="iou-right">
          <span class="iou-amount" class:paid-amount={iou.status === 'paid'} style="color: {amountColor}">{amountPrefix}{formatCurrency(iou.amount)}</span>
          <div class="iou-actions">
            <button class="iou-btn iou-btn-edit" onclick={() => onEdit?.(iou.id)} type="button" title="Edit">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
              </svg>
            </button>
            {#if iou.status !== 'paid'}
              <button class="iou-btn iou-btn-pay" onclick={() => onPay?.(iou.id)} type="button">
                {payButtonText}
              </button>
            {:else}
              <span class="recovered-glow">Recovered</span>
            {/if}
            <button class="iou-btn iou-btn-delete" onclick={() => onDelete?.(iou.id)} type="button" title="Delete">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  /* ── Container ── */
  .iou-container {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  /* ── Row ── */
  .iou-row {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: 14px var(--space-md);
    padding-left: calc(var(--space-md) + 4px);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    min-height: 68px;
    transition: all 200ms var(--bounce);
    overflow: hidden;
  }

  .iou-row:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-card);
  }

  .iou-row.paid {
    opacity: 0.7;
    background: var(--color-cream);
  }

  .iou-row.overdue {
    animation: boom-pulse 2s ease-in-out infinite;
    border-color: var(--color-coral);
  }

  .iou-accent {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: 4px;
    border-radius: 2px 0 0 2px;
  }
  .iou-accent.teal { background: var(--color-teal); }
  .iou-accent.coral { background: var(--color-coral); }
  .iou-accent.sky { background: var(--color-sky); }

  /* ── Direction arrow ── */
  .iou-arrow {
    width: 42px;
    height: 42px;
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: var(--color-teal-bg);
    color: var(--color-teal);
  }

  .iou-row.overdue .iou-arrow {
    background: rgba(239, 108, 74, 0.10);
    color: var(--color-coral);
  }

  .iou-row.paid .iou-arrow {
    background: rgba(93, 173, 226, 0.10);
    color: var(--color-sky);
  }

  /* ── Info: name + metadata ── */
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

  .overdue-badge {
    font-size: 11px;
    font-weight: 700;
    color: var(--color-coral);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* ── Amount + actions ── */
  .iou-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    flex-shrink: 0;
  }

  .iou-amount {
    font-size: var(--font-size-base);
    font-weight: 700;
    color: var(--color-teal);
    font-variant-numeric: tabular-nums;
  }

  .iou-amount.paid-amount {
    text-decoration: line-through;
    color: var(--color-text-muted);
  }

  .iou-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 150ms ease;
    pointer-events: none;
  }

  .iou-row:hover .iou-actions {
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

  /* ── Empty state ── */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-2xl) var(--space-md);
    text-align: center;
    background: var(--color-cream);
    border: 1px solid var(--color-border);
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

  /* ── Mobile ── */
  @media (max-width: 640px) {
    .iou-row { flex-wrap: wrap; }
    .iou-right { flex-direction: row; align-items: center; gap: var(--space-sm); width: 100%; }
    .iou-meta { display: none; }
  }
</style>

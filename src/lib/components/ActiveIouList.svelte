<script lang="ts">
  import { formatCurrency, formatDate } from '$lib/utils/format';
  import type { Lending } from '$lib/types';

  let {
    ious = [],
    onPay,
    onEdit,
    onDelete,
  }: {
    ious: Lending[];
    onPay?: (id: number) => void;
    onEdit?: (id: number) => void;
    onDelete?: (id: number) => void;
  } = $props();
</script>

{#if ious.length === 0}
  <div class="empty-state">
    <div class="empty-icon">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v1h6V5a3 3 0 0 0-3-3z"/><path d="M5 8h14a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/>
      </svg>
    </div>
    <p class="empty-title">All settled up!</p>
    <p class="empty-sub">No outstanding loans right now</p>
  </div>
{:else}
  <div class="iou-container">
    {#each ious as iou (iou.id)}
      <div class="iou-row" data-iou-id={iou.id}>
        <!-- Direction icon: green → = owed to me, red ← = I owe -->
        <div class="iou-arrow owed-to-me">
          {#if true}
            <!-- All active lendings = others owe you -->
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
              <polyline points="17 6 23 6 23 12"/>
            </svg>
          {/if}
        </div>

        <!-- Center: name + metadata -->
        <div class="iou-info">
          <span class="iou-name">{iou.borrower_name}</span>
          <span class="iou-meta">
            Lent on {formatDate(iou.date_lent)}
            {#if iou.due_date} · Due {formatDate(iou.due_date)}{/if}
            {#if iou.interest_rate > 0} · {iou.interest_rate}% interest{/if}
            {#if iou.notes && iou.notes.length > 0} · {iou.notes}{/if}
          </span>
        </div>

        <!-- Right: amount + hover actions -->
        <div class="iou-right">
          <span class="iou-amount">+{formatCurrency(iou.amount)}</span>
          <div class="iou-actions">
            <button class="iou-btn iou-btn-edit" onclick={() => onEdit?.(iou.id)} type="button" title="Edit">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
              </svg>
            </button>
            <button class="iou-btn iou-btn-pay" onclick={() => onPay?.(iou.id)} type="button">
              Mark Paid
            </button>
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
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    overflow: hidden;
  }

  /* ── Row ── */
  .iou-row {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: 14px var(--space-md);
    border-bottom: 1px solid var(--color-border);
    min-height: 68px;
    transition: background 150ms ease;
  }

  .iou-row:last-child { border-bottom: none; }

  .iou-row:hover {
    background: rgba(99, 102, 241, 0.04);
  }

  /* ── Direction arrow (Splitwise-style) ── */
  .iou-arrow {
    width: 42px;
    height: 42px;
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  /* Owed to me: green circle + up-right arrow */
  .iou-arrow.owed-to-me {
    background: linear-gradient(135deg, var(--color-income-light), rgba(16, 185, 129, 0.2));
    color: var(--color-income);
  }

  /* I owe: rose circle + down-right arrow
     This class is reserved for future IOU direction support
     when the lending model distinguishes "direction". */
  .iou-arrow.i-owe {
    background: linear-gradient(135deg, var(--color-expense-light), rgba(239, 68, 68, 0.2));
    color: var(--color-expense);
  }

  /* Default: lending/amber tint when direction unclear */
  .iou-arrow:not(.owed-to-me):not(.i-owe) {
    background: linear-gradient(135deg, var(--color-warning-light), rgba(245, 158, 11, 0.2));
    color: var(--color-warning);
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
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .iou-meta {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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
    color: var(--color-income);
    font-variant-numeric: tabular-nums;
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
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
    font-weight: 600;
    min-height: 30px;
    cursor: pointer;
    border: none;
    font-family: inherit;
    transition: background 120ms ease;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .iou-btn-pay {
    background: var(--color-income);
    color: white;
  }

  .iou-btn-pay:hover { background: #059669; }

  .iou-btn-delete {
    background: transparent;
    color: var(--color-text-secondary);
    width: 30px;
    padding: 0;
    justify-content: center;
  }

  .iou-btn-delete:hover {
    background: var(--color-expense-light);
    color: var(--color-expense);
  }

  .iou-btn-edit {
    background: transparent;
    color: var(--color-text-secondary);
    width: 30px;
    padding: 0;
    justify-content: center;
  }

  .iou-btn-edit:hover {
    background: var(--color-primary-light);
    color: var(--color-primary);
  }

  /* ── Empty state ── */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-2xl) var(--space-md);
    text-align: center;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
  }

  .empty-icon {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--color-income-light), rgba(16, 185, 129, 0.1));
    color: var(--color-income);
    border-radius: var(--radius-lg);
    margin-bottom: var(--space-md);
  }

  .empty-title {
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--color-text);
    margin: 0 0 4px;
  }

  .empty-sub {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    margin: 0;
  }

  /* ── Mobile ── */
  @media (max-width: 640px) {
    .iou-row { flex-wrap: wrap; }
    .iou-right { flex-direction: row; align-items: center; gap: var(--space-sm); width: 100%; }
    .iou-meta { display: none; }
  }
</style>
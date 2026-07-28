<script lang="ts">
  import { enhance } from '$app/forms';
  import { showSuccess, showError } from '$lib/stores/toast.svelte';
  import { formatWithCommas } from '$lib/utils/format';
  import type { Lending } from '$lib/types';

  let {
    lendingRecord,
    onCancel,
    onSuccess,
  }: {
    lendingRecord?: Lending;
    onCancel?: () => void;
    onSuccess?: () => void;
  } = $props();

  let borrowerName = $state('');
  let rawAmount = $state('');
  let interestRate = $state('0');
  let dateLent = $state('');
  let dueDate = $state('');
  let notes = $state('');

  // Initialize state when lendingRecord is provided (edit mode)
  $effect(() => {
    if (lendingRecord) {
      borrowerName = lendingRecord.borrower_name;
      rawAmount = lendingRecord.amount.toString();
      interestRate = lendingRecord.interest_rate.toString();
      dateLent = lendingRecord.date_lent;
      dueDate = lendingRecord.due_date ?? '';
      notes = lendingRecord.notes ?? '';
    }
  });

  const displayAmount = $derived(rawAmount ? formatWithCommas(rawAmount) : '');

  const isValid = $derived(
    borrowerName.trim().length > 0 &&
    rawAmount !== '' &&
    parseFloat(rawAmount) > 0 &&
    dateLent !== ''
  );

  function onAmountInput(e: Event) {
    const input = e.target as HTMLInputElement;
    let raw = input.value.replace(/[^0-9.]/g, '');
    const dots = raw.match(/\./g);
    if (dots && dots.length > 1) raw = raw.slice(0, raw.lastIndexOf('.'));
    rawAmount = raw;
    input.value = raw ? formatWithCommas(raw) : '';
  }

  function onAmountFocus(e: Event) {
    const input = e.target as HTMLInputElement;
    input.value = rawAmount;
    const len = input.value.length;
    input.setSelectionRange(len, len);
  }

  function onAmountBlur(e: Event) {
    const input = e.target as HTMLInputElement;
    if (rawAmount) {
      const num = parseFloat(rawAmount);
      if (!isNaN(num)) {
        input.value = formatWithCommas(
          num % 1 === 0 ? String(num) : num.toFixed(2)
        );
      }
    }
  }

  function handleEnhance() {
    return async ({ result, update }: { result: { type: string; data?: { error?: string } }; update: () => Promise<void> }) => {
      if (result.type === 'success') {
        showSuccess(lendingRecord ? 'Lending updated successfully' : 'Lending recorded successfully');
        onSuccess?.();
      } else if (result.type === 'failure') {
        showError(result.data?.error || 'An error occurred');
      }
      await update();
    };
  }
</script>

<form method="POST" action={lendingRecord ? '?/update' : '?/create'} use:enhance={handleEnhance}>
  {#if lendingRecord}
    <input type="hidden" name="id" value={lendingRecord.id} />
    <input type="hidden" name="status" value={lendingRecord.status} />
  {/if}

  <div class="form-group">
    <label for="borrower_name">Borrower Name</label>
    <input
      id="borrower_name"
      name="borrower_name"
      type="text"
      required
      placeholder="Who borrowed the money?"
      bind:value={borrowerName}
    />
  </div>

  <div class="form-row">
    <div class="form-group">
      <label for="amount">Amount</label>
      <div class="amount-wrap">
        <span class="amount-prefix">₱</span>
        <input
          id="amount"
          type="text"
          inputmode="decimal"
          required
          placeholder="0.00"
          value={displayAmount}
          oninput={onAmountInput}
          onfocus={onAmountFocus}
          onblur={onAmountBlur}
          autocomplete="off"
        />
      </div>
      <input type="hidden" name="amount" value={rawAmount} />
    </div>

    <div class="form-group">
      <label for="interest_rate">Interest %</label>
      <input
        id="interest_rate"
        name="interest_rate"
        type="number"
        step="0.1"
        placeholder="0"
        bind:value={interestRate}
      />
    </div>
  </div>

  <div class="form-row">
    <div class="form-group">
      <label for="date_lent">Date Lent</label>
      <input
        id="date_lent"
        name="date_lent"
        type="date"
        required
        bind:value={dateLent}
      />
    </div>

    <div class="form-group">
      <label for="due_date">Due Date</label>
      <input
        id="due_date"
        name="due_date"
        type="date"
        bind:value={dueDate}
      />
    </div>
  </div>

  <div class="form-group">
    <label for="notes">Notes</label>
    <textarea
      id="notes"
      name="notes"
      rows="2"
      placeholder="Optional notes"
      bind:value={notes}
    ></textarea>
  </div>

  <div class="form-actions">
    <button type="submit" class="btn btn-primary" disabled={!isValid}>
      {lendingRecord ? 'Update Lending' : 'Record Lending'}
    </button>
    {#if onCancel}
      <button type="button" class="btn btn-secondary" onclick={onCancel}>Cancel</button>
    {/if}
  </div>
</form>

<style>
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: var(--space-md);
  }

  .form-group label {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text);
  }

  .form-group input,
  .form-group textarea {
    padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-base);
    font-family: inherit;
    background: var(--color-surface);
    color: var(--color-text);
    width: 100%;
    min-height: 44px;
    transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  }

  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-light);
  }

  .form-group textarea {
    min-height: 80px;
    resize: vertical;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-md);
  }

  .amount-wrap {
    display: flex;
    align-items: stretch;
  }

  .amount-prefix {
    display: flex;
    align-items: center;
    padding: 0 12px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-right: none;
    border-radius: var(--radius-sm) 0 0 var(--radius-sm);
    font-weight: 600;
    color: var(--color-text-secondary);
    font-size: var(--font-size-base);
  }

  .amount-wrap input {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }

  .form-actions {
    display: flex;
    gap: var(--space-sm);
    margin-top: var(--space-lg);
  }

  .btn {
    flex: 1;
    padding: var(--space-sm) var(--space-lg);
    border-radius: var(--radius-md);
    font-size: var(--font-size-base);
    font-weight: 600;
    cursor: pointer;
    border: none;
    min-height: 44px;
    transition: all var(--transition-fast);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--color-primary);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--color-primary-hover);
  }

  .btn-secondary {
    background: var(--color-bg);
    color: var(--color-text);
    border: 1px solid var(--color-border);
  }

  .btn-secondary:hover {
    background: var(--color-border);
  }

  @media (max-width: 640px) {
    .form-row {
      grid-template-columns: 1fr;
    }
  }
</style>

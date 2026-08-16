<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { formatCurrency } from '$lib/client/utils/format';
import { formatDateShort } from '$lib/shared/utils/format';
  import { getCategoryHue, getCategoryTint, getCategoryText } from '$lib/shared/utils/categoryColors';
  import { themeState } from '$lib/client/stores/preferences.svelte';
  import CategoryUsageBar from './CategoryUsageBar.svelte';
  import { showSuccess, showError } from '$lib/client/stores/toast.svelte';

  // ─── Types ────────────────────────────────────────────────────────

  export interface EnrichedCategory {
    id: number;
    name: string;
    color: string;
    icon: string;
    type: 'income' | 'expense';
    budget_limit: number | null;
    budgeted: number;
    spent: number;
    earned: number;
    created_at: string;
    txnCount: number;
    recurringCount: number;
    lastUsed: string | null;
  }

  // ─── Props ────────────────────────────────────────────────────────

  let {
    categories = [] as EnrichedCategory[],
    onEdit,
    onDelete,
    onAdd,
    compact = false,
    totalCount = 0,
    activeType = 'expense',
    typeCounts,
  }: {
    categories: EnrichedCategory[];
    onEdit?: (cat: EnrichedCategory) => void;
    onDelete?: (cat: EnrichedCategory) => void;
    onAdd?: (type: 'income' | 'expense') => void;
    compact?: boolean;
    totalCount?: number;
    /** Which column is shown on mobile (segmented switcher state). */
    activeType?: 'income' | 'expense';
    /** Unfiltered per-type totals, to distinguish "empty type" from "filtered out". */
    typeCounts?: { income: number; expense: number };
  } = $props();

  // Dark-mode state for category chip contrast (AA lightened text).
  const isDark = $derived(themeState.isDark);

  // ─── Derived groupings ────────────────────────────────────────────

  const incomeCategories = $derived(categories.filter((c) => c.type === 'income'));
  const expenseCategories = $derived(categories.filter((c) => c.type === 'expense'));

  // ─── Inline budget editing state ──────────────────────────────────

  let editingId = $state<number | null>(null);
  let editRaw = $state('');

  function startEdit(cat: EnrichedCategory) {
    editingId = cat.id;
    editRaw = cat.budget_limit != null ? String(cat.budget_limit) : '';
  }

  function cancelEdit() {
    editingId = null;
    editRaw = '';
  }

  async function saveEdit(cat: EnrichedCategory) {
    const raw = editRaw.replace(/[^0-9.]/g, '');
    const dots = raw.match(/\./g);
    const clean = dots && dots.length > 1 ? raw.slice(0, raw.lastIndexOf('.')) : raw;
    const budgetLimit = clean ? parseFloat(clean) : null;

    if (budgetLimit !== null && (isNaN(budgetLimit) || budgetLimit < 0)) return;

    try {
      const formData = new FormData();
      formData.append('id', String(cat.id));
      formData.append('budget_limit', budgetLimit != null ? String(budgetLimit) : '');

      const resp = await fetch('?/budgetUpdate', { method: 'POST', body: formData });
      if (resp.ok) {
        showSuccess('Budget updated');
        await invalidateAll();
      } else {
        showError('Failed to update budget');
      }
    } catch {
      showError('Failed to update budget');
    }
    editingId = null;
    editRaw = '';
  }

  function handleBudgetKeydown(e: KeyboardEvent, cat: EnrichedCategory) {
    if (e.key === 'Enter') { e.preventDefault(); saveEdit(cat); }
    if (e.key === 'Escape') { cancelEdit(); }
  }

  function onBudgetInput(e: Event) {
    const input = e.target as HTMLInputElement;
    editRaw = input.value.replace(/[^0-9.]/g, '');
    input.value = editRaw;
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  function statusClass(cat: EnrichedCategory): 'ok' | 'warn' | 'over' {
    if (!cat.budget_limit || cat.budget_limit <= 0) return 'ok';
    const pct = cat.spent / cat.budget_limit;
    if (pct >= 1) return 'over';
    if (pct >= 0.75) return 'warn';
    return 'ok';
  }

  function budgetPercent(cat: EnrichedCategory): number {
    if (!cat.budget_limit || cat.budget_limit <= 0) return 0;
    return Math.min((cat.spent / cat.budget_limit) * 100, 100);
  }

  </script>

<!-- Shared action / compact-row snippets -->
{#snippet cardActions(cat: EnrichedCategory)}
  <div class="card-actions">
    <button class="btn-icon" onclick={() => onEdit?.(cat)} title="Edit category" aria-label="Edit {cat.name}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
    </button>
    <button class="btn-icon danger" onclick={() => onDelete?.(cat)} title="Delete category" aria-label="Delete {cat.name}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
    </button>
  </div>
{/snippet}

{#snippet compactActions(cat: EnrichedCategory)}
  <span class="compact-actions">
    <button class="btn-icon" onclick={() => onEdit?.(cat)} title="Edit category" aria-label="Edit {cat.name}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
    </button>
    <button class="btn-icon danger" onclick={() => onDelete?.(cat)} title="Delete category" aria-label="Delete {cat.name}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
    </button>
  </span>
{/snippet}

{#snippet compactRow(cat: EnrichedCategory, tint: string, fg: string)}
  <div class="compact-row">
    <span class="compact-icon" style="background: {tint}; color: {fg}">{cat.icon}</span>
    <span class="compact-name">{cat.name}</span>
    <span class="compact-type" class:income={cat.type === 'income'}>{cat.type === 'income' ? 'Income' : 'Expense'}</span>
    <span class="compact-meta">{cat.txnCount || 0} txns · {cat.recurringCount || 0} rec{cat.lastUsed ? ` · ${formatDateShort(cat.lastUsed)}` : ''}</span>
    <span class="compact-amount">{formatCurrency(cat.type === 'income' ? cat.earned : cat.spent)}</span>
    {@render compactActions(cat)}
  </div>
{/snippet}

<!-- ════════════════════════════════════════════════════════════════
     CATEGORY BOARD — Expense + Income columns
     Desktop (≥1024px): side-by-side columns. Below that the board
     stacks to one column; on mobile (≤768px) only the activeType
     column is shown (segmented switcher lives in the page).
     ════════════════════════════════════════════════════════════════ -->
{#if totalCount === 0}
  <div class="empty-state">
    <div class="empty-icon">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/>
        <line x1="7" x2="7.01" y1="7" y2="7"/>
      </svg>
    </div>
    <p>Start organizing your finances.</p>
    <span>Categories help organize your income, expenses, budgets, and recurring schedules.</span>
    {#if onAdd}
      <button class="empty-cta" onclick={() => onAdd?.('expense')} type="button">Add First Category</button>
    {/if}
  </div>
{:else}
  <div class="board" class:single={compact}>
    <!-- ══ EXPENSE column — the main budget surface ══ -->
    <section class="board-column board-column--expense flip7-card accent-coral" class:inactive={activeType !== 'expense'} aria-label="Expense categories">
      <header class="column-header">
        <span class="column-title">💸 Expense</span>
        <span class="column-count">{expenseCategories.length} categories</span>
        <span class="column-total">
          {formatCurrency(expenseCategories.reduce((s, c) => s + c.spent, 0))} spent
          of {formatCurrency(expenseCategories.reduce((s, c) => s + c.budgeted, 0))}
        </span>
      </header>
      {#if expenseCategories.length > 0}
        <div class="category-list">
          {#each expenseCategories as cat (cat.id)}
            {@const hue = getCategoryHue('', cat.color)}
            {@const tint = getCategoryTint('', hue, isDark)}
            {@const fg = getCategoryText('', hue, isDark)}
            {#if compact}
              {@render compactRow(cat, tint, fg)}
            {:else}
              <div class="category-card" class:over-budget={statusClass(cat) === 'over'}>
                <div class="card-accent" style="background: {hue}"></div>

                <!-- ─── Card row 1: icon + name + meta + actions ─── -->
                <div class="card-header-area">
                  <div class="card-left">
                    <span class="cat-icon" style="background: {tint}; color: {fg}">{cat.icon}</span>
                    <div class="cat-info">
                      <span class="cat-name">{cat.name}</span>
                      <span class="cat-type-badge coral">Expense</span>
                      <span class="cat-usage">{cat.txnCount || 0} transactions · {cat.recurringCount || 0} recurring</span>
                    </div>
                  </div>
                  {@render cardActions(cat)}
                </div>

                <!-- ─── Budget cluster: Budgeted · Spent · Available + status pill ─── -->
                {#if cat.budget_limit != null}
                  <div class="budget-cluster">
                    <span class="cluster-item">
                      <span class="cluster-label">Budgeted</span>
                      {#if editingId === cat.id}
                        <span class="budget-edit-wrap">
                          <span class="budget-prefix">₱</span>
                          <input
                            type="text"
                            inputmode="decimal"
                            class="budget-edit-input"
                            value={editRaw}
                            oninput={onBudgetInput}
                            onkeydown={(e) => handleBudgetKeydown(e, cat)}
                            onblur={() => saveEdit(cat)}
                            autofocus
                            autocomplete="off"
                          />
                        </span>
                      {:else}
                        <button class="cluster-value clickable" onclick={() => startEdit(cat)} title="Edit budget">{formatCurrency(cat.budgeted)}</button>
                      {/if}
                    </span>
                    <span class="cluster-sep" aria-hidden="true">·</span>
                    <span class="cluster-item">
                      <span class="cluster-label">Spent</span>
                      <span class="cluster-value" class:inverted={cat.spent > 0}>{formatCurrency(cat.spent)}</span>
                    </span>
                    <span class="cluster-sep" aria-hidden="true">·</span>
                    <span class="cluster-item">
                      <span class="cluster-label">Available</span>
                      <span class="cluster-value" class:positive={cat.budgeted - cat.spent >= 0} class:negative={cat.budgeted - cat.spent < 0}>{formatCurrency(cat.budgeted - cat.spent)}</span>
                    </span>
                    {#if statusClass(cat) === 'over'}
                      <span class="status-badge over">Over</span>
                    {:else if statusClass(cat) === 'warn'}
                      <span class="status-badge warn">Warn</span>
                    {:else if cat.spent > 0}
                      <span class="status-badge ok">Under</span>
                    {/if}
                  </div>
                {:else}
                  <div class="no-budget-cluster">
                    <span class="no-budget-text">No budget set</span>
                    <span class="cluster-sep" aria-hidden="true">·</span>
                    <button class="no-budget-set" onclick={() => startEdit(cat)}>+ Set budget</button>
                  </div>
                {/if}

                <!-- ─── Card row 3: progress bar ─── -->
                {#if cat.budget_limit != null && cat.budget_limit > 0}
                  <div class="progress-section">
                    <CategoryUsageBar percent={budgetPercent(cat)} status={statusClass(cat)} />
                    <div class="progress-footer">
                      <span class="pct-value" class:ok={statusClass(cat) === 'ok'} class:warn={statusClass(cat) === 'warn'} class:over={statusClass(cat) === 'over'}>
                        {Math.round(budgetPercent(cat))}%
                      </span>
                      <span class="pct-label">
                        {#if statusClass(cat) === 'over'}
                          Overspent by {formatCurrency(cat.spent - cat.budgeted)}
                        {:else}
                          {formatCurrency(cat.budgeted - cat.spent)} remaining
                        {/if}
                      </span>
                    </div>
                  </div>
                {/if}
              </div>
            {/if}
          {/each}
        </div>
      {:else}
        <div class="column-empty">
          {#if (typeCounts?.expense ?? 0) > 0}
            <p>No matching expense categories</p>
            <span>Try a different search or filter.</span>
          {:else}
            <p>No expense categories yet</p>
            <span>Track where money goes by adding your first expense category.</span>
          {/if}
        </div>
      {/if}
      {#if onAdd}
        <button class="column-add" type="button" onclick={() => onAdd?.('expense')}>+ Add Expense</button>
      {/if}
    </section>

    <!-- ══ INCOME column ══ -->
    <section class="board-column board-column--income flip7-card accent-teal" class:inactive={activeType !== 'income'} aria-label="Income categories">
      <header class="column-header">
        <span class="column-title">💰 Income</span>
        <span class="column-count">{incomeCategories.length} categories</span>
        <span class="column-total">{formatCurrency(incomeCategories.reduce((s, c) => s + c.earned, 0))} earned</span>
      </header>
      {#if incomeCategories.length > 0}
        <div class="category-list">
          {#each incomeCategories as cat (cat.id)}
            {@const hue = getCategoryHue('', cat.color)}
            {@const tint = getCategoryTint('', hue, isDark)}
            {@const fg = getCategoryText('', hue, isDark)}
            {#if compact}
              {@render compactRow(cat, tint, fg)}
            {:else}
              <div class="category-card income-card">
                <div class="card-accent" style="background: {hue}"></div>
                <div class="card-body">
                  <div class="card-left">
                    <span class="cat-icon" style="background: {tint}; color: {fg}">{cat.icon}</span>
                    <div class="cat-info">
                      <span class="cat-name">{cat.name}</span>
                      <span class="cat-type-badge teal">Income</span>
                      <span class="cat-usage">{cat.txnCount || 0} transactions · {cat.recurringCount || 0} recurring</span>
                    </div>
                  </div>
                  <div class="card-right">
                    <span class="income-value">{formatCurrency(cat.earned)}</span>
                    <span class="income-label">earned this month</span>
                  </div>
                  {@render cardActions(cat)}
                </div>
              </div>
            {/if}
          {/each}
        </div>
      {:else}
        <div class="column-empty">
          {#if (typeCounts?.income ?? 0) > 0}
            <p>No matching income categories</p>
            <span>Try a different search or filter.</span>
          {:else}
            <p>No income categories yet</p>
            <span>See what's coming in by adding your first income category.</span>
          {/if}
        </div>
      {/if}
      {#if onAdd}
        <button class="column-add" type="button" onclick={() => onAdd?.('income')}>+ Add Income</button>
      {/if}
    </section>
  </div>
{/if}

<style>
  /* ═══════════════════════════════════════════════════════════════════
     CATEGORY LIST — Flip7 Design
     ═══════════════════════════════════════════════════════════════════ */

  /* ─── Board: two columns on wide desktop, stacked below ─── */
  .board {
    display: grid;
    gap: var(--space-lg);
  }

  /* Compact (table) view keeps the full-width single column at every size */
  .board.single {
    grid-template-columns: 1fr;
  }

  @media (min-width: 1024px) {
    .board:not(.single) {
      grid-template-columns: 1fr 1fr;
      align-items: start;
    }
  }

  /* Mobile: the segmented switcher (in the page) drives which column shows */
  @media (max-width: 768px) {
    .board-column.inactive {
      display: none;
    }
  }

  .board-column {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    padding: var(--space-md);
    min-width: 0;
  }

  .column-header {
    display: flex;
    align-items: baseline;
    gap: var(--space-sm);
    flex-wrap: wrap;
    padding: 0 var(--space-xs);
  }

  .column-title {
    font-size: var(--font-size-base);
    font-weight: 700;
    color: var(--color-ink);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-family: var(--font-display);
  }

  .board-column--expense .column-title {
    color: var(--color-coral);
  }

  .board-column--income .column-title {
    color: var(--color-teal);
  }

  .column-count {
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--color-text-muted);
  }

  .column-total {
    font-size: var(--font-size-sm);
    font-weight: 700;
    color: var(--color-ink);
    font-variant-numeric: tabular-nums;
    margin-left: auto;
  }

  /* ─── In-column empty state (type exists but nothing matches, or none yet) ─── */
  .column-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 4px;
    padding: var(--space-xl) var(--space-md);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-lg);
  }

  .column-empty p {
    margin: 0;
    font-weight: 600;
    color: var(--color-ink);
    font-size: var(--font-size-sm);
  }

  .column-empty span {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    max-width: 260px;
  }

  /* ─── Per-column add CTA — quiet dashed footer row ─── */
  .column-add {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-lg);
    background: transparent;
    color: var(--color-teal);
    font-family: var(--font-display);
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: background 150ms var(--ease), border-color 150ms var(--ease), color 150ms var(--ease);
    -webkit-tap-highlight-color: transparent;
  }

  .column-add:hover {
    background: var(--color-teal-bg);
    border-color: var(--color-teal);
  }

  .column-add:focus-visible {
    outline: 2px solid var(--color-teal);
    outline-offset: 2px;
  }

  /* ─── Card list container ─── */
  .category-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  /* ─── Category card ─── */
  .category-card {
    position: relative;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    padding: var(--space-sm) var(--space-lg);
    padding-left: calc(var(--space-lg) + 4px);
    transition: all 250ms var(--bounce);
    overflow: hidden;
  }

  .card-accent {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: 4px;
    border-radius: 2px 0 0 2px;
  }

  .category-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-card);
  }

  .category-card.over-budget {
    border-color: rgba(239, 108, 74, 0.25);
  }

  .category-card.over-budget:hover {
    border-color: rgba(239, 108, 74, 0.4);
    box-shadow: var(--glow-coral);
  }

  /* Income cards — more compact, no budget info */
  .income-card {
    padding: var(--space-sm) var(--space-lg);
    padding-left: calc(var(--space-lg) + 4px);
  }

  /* ─── Card row 1: header area ─── */
  .card-body {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .card-header-area {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-xs);
  }

  .card-left {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    min-width: 0;
    margin-right: auto;
  }

  .card-right {
    text-align: right;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-self: center;
    min-height: 44px;
  }

  /* ─── Category icon ─── */
  .cat-icon {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-lg);
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  /* ─── Category info ─── */
  .cat-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .cat-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Usage line on cards — lightweight management metadata */
  .cat-usage {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ─── Type Badge (Pill) ─── */
  .cat-type-badge {
    display: inline-flex;
    align-items: center;
    font-size: 11px;
    font-weight: 600;
    padding: 1px 10px;
    border-radius: var(--radius-pill);
    width: fit-content;
    letter-spacing: 0.02em;
  }

  .cat-type-badge.teal {
    background: var(--color-teal-bg);
    color: var(--color-teal);
  }

  .cat-type-badge.coral {
    background: rgba(239, 108, 74, 0.10);
    color: var(--color-coral);
  }

  /* ─── Card actions — always visible, muted at rest (no kebab) ───
     Two actions (Edit/Delete) don't warrant another click; they stay
     discoverable at a lower default opacity and strengthen on interaction. */
  .card-actions {
    display: flex;
    gap: 4px;
    align-items: center;
    opacity: 0.45;
    transition: opacity 150ms ease;
  }

  .category-card:hover .card-actions,
  .category-card:focus-within .card-actions,
  .card-actions:focus-within,
  .card-actions:hover {
    opacity: 1;
  }

  .btn-icon {
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px;
    border-radius: var(--radius-md);
    min-width: 44px;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 120ms ease;
    color: var(--color-text-muted);
  }

  .btn-icon:hover {
    background: var(--color-teal-bg);
    color: var(--color-teal);
  }

  .btn-icon.danger:hover {
    background: rgba(239, 108, 74, 0.10);
    color: var(--color-coral);
  }

  /* ─── Income value ─── */
  .income-value {
    font-size: var(--font-size-base);
    font-weight: 700;
    color: var(--color-teal);
    font-variant-numeric: tabular-nums;
  }

  .income-label {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    display: block;
    margin-top: 2px;
  }

  /* ─── Budget cluster: Budgeted · Spent · Available (compact, left-aligned) ─── */
  .budget-cluster {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px var(--space-sm);
    min-height: 24px;
  }

  .cluster-item {
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
    min-width: 0;
  }

  .cluster-label {
    font-size: 11px;
    font-weight: 500;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .cluster-value {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-ink);
    background: none;
    border: none;
    padding: 0;
    text-align: left;
    cursor: default;
    min-height: auto;
  }

  .cluster-value.clickable {
    cursor: pointer;
    border-bottom: 1px solid var(--color-border);
    padding-bottom: 1px;
    transition: border-color 120ms ease;
  }

  .cluster-value.clickable:hover {
    border-color: var(--color-teal);
    color: var(--color-teal);
  }

  .cluster-value.inverted {
    color: var(--color-coral);
  }

  .cluster-value.positive {
    color: var(--teal);
  }

  .cluster-value.negative {
    color: var(--color-coral);
  }

  .cluster-sep {
    color: var(--color-text-muted);
  }

  /* No-budget inline line: "No budget set · + Set budget" */
  .no-budget-cluster {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 24px;
  }

  .no-budget-text {
    font-size: 13px;
    color: var(--color-text-muted);
  }

  .no-budget-set {
    background: none;
    border: none;
    padding: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--teal);
    cursor: pointer;
    font-family: inherit;
    transition: color 120ms ease;
  }

  .no-budget-set:hover {
    color: var(--teal-deep);
    text-decoration: underline;
  }

  /* ─── Status badges — anchored right in the cluster ─── */
  .status-badge {
    display: inline-block;
    font-size: 11px;
    font-weight: 600;
    padding: 1px 8px;
    border-radius: var(--radius-pill);
    width: fit-content;
    margin-left: auto;
  }

  .status-badge.ok {
    background: var(--color-teal-bg);
    color: var(--color-teal);
  }

  .status-badge.warn {
    background: var(--color-amber-bg);
    color: var(--color-amber);
  }

  .status-badge.over {
    background: rgba(239, 108, 74, 0.10);
    color: var(--color-coral);
  }

  /* ─── Inline budget edit ─── */
  .budget-edit-wrap {
    display: inline-flex;
    align-items: center;
    gap: 0;
    border: 1px solid var(--color-teal);
    border-radius: var(--radius-sm);
    overflow: hidden;
    background: var(--color-cream);
    box-shadow: var(--focus);
  }

  .budget-prefix {
    padding: 2px 0 2px 6px;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-muted);
    background: var(--color-bg);
    border-right: 1px solid var(--color-border);
  }

  .budget-edit-input {
    width: 90px;
    padding: 4px 6px;
    border: none;
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    color: var(--color-ink);
    background: transparent;
    outline: none;
    font-variant-numeric: tabular-nums;
  }

  /* ─── Progress section ─── */
  .progress-section {
    margin-top: var(--space-xs);
    padding-top: var(--space-xs);
    border-top: 1px solid var(--line);
  }

  .progress-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: var(--space-xs);
  }

  .pct-value {
    font-size: 12px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .pct-value.ok { color: var(--color-teal); }
  .pct-value.warn { color: var(--color-amber); }
  .pct-value.over { color: var(--color-coral); }

  .pct-label {
    font-size: 12px;
    color: var(--color-text-muted);
  }

  /* ─── Empty state ─── */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: var(--space-2xl) var(--space-md);
    background: var(--color-cream);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    gap: var(--space-sm);
    box-shadow: var(--shadow-card);
  }

  .empty-icon {
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-teal-bg);
    color: var(--color-teal);
    border-radius: var(--radius-lg);
    margin-bottom: var(--space-sm);
  }

  .empty-state p {
    font-weight: 600;
    color: var(--color-ink);
    font-size: var(--font-size-lg);
    margin: 0;
  }

  .empty-state span {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
    max-width: 280px;
  }

  /* Empty-state CTA — teal (the gold header Add coexists, so this stays quiet) */
  .empty-cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 var(--space-xl);
    border: none;
    border-radius: var(--radius-pill);
    background: var(--teal);
    color: var(--color-surface);
    font-family: var(--font-display);
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: background 140ms ease-out, box-shadow 140ms ease-out, transform 140ms ease-out;
    margin-top: var(--space-sm);
    -webkit-tap-highlight-color: transparent;
  }

  .empty-cta:hover {
    background: var(--teal-deep);
    box-shadow: 0 4px 16px rgba(79, 157, 136, 0.22);
    transform: translateY(-1px);
  }

  .empty-cta:focus-visible {
    outline: 2px solid var(--teal-deep);
    outline-offset: 2px;
  }

  /* ─── Compact view (high density for large catalogs) ─── */
  .compact-row {
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr) auto auto auto auto;
    align-items: center;
    gap: var(--space-md);
    min-height: 48px;
    padding: var(--space-xs) var(--space-md);
    background: var(--color-surface);
    border: 1px solid var(--color-hairline);
    border-bottom: none;
    transition: background 150ms var(--ease);
  }

  .compact-row:first-of-type {
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  }

  .compact-row:last-of-type {
    border-bottom: 1px solid var(--color-hairline);
    border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  }

  .compact-row:hover {
    background: var(--color-teal-bg);
  }

  .compact-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-md);
    font-size: 1rem;
    flex-shrink: 0;
  }

  .compact-name {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .compact-type {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: 2px 8px;
    border-radius: var(--radius-pill);
    background: var(--color-coral-bg);
    color: var(--color-coral);
    flex-shrink: 0;
  }

  .compact-type.income {
    background: var(--color-teal-bg);
    color: var(--color-teal);
  }

  .compact-meta {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .compact-amount {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    font-size: var(--font-size-sm);
    font-weight: 700;
    color: var(--color-ink);
    text-align: right;
    min-width: 84px;
  }

  .compact-actions {
    display: flex;
    gap: 2px;
    align-items: center;
    opacity: 0.45;
    transition: opacity 150ms ease;
  }

  .compact-row:hover .compact-actions,
  .compact-actions:focus-within {
    opacity: 1;
  }

  /* ─── Responsive ─── */
  @media (max-width: 640px) {
    .board-column {
      padding: var(--space-sm);
    }

    .card-actions {
      opacity: 1;
    }

    .category-card {
      padding: var(--space-sm) var(--space-md);
      padding-left: calc(var(--space-md) + 4px);
    }

    /* Compact rows slim down on mobile: drop type + meta columns */
    .compact-row {
      grid-template-columns: 32px minmax(0, 1fr) auto auto;
    }

    .compact-type,
    .compact-meta {
      display: none;
    }
  }

  @media (max-width: 480px) {
    .cat-icon {
      width: 40px;
      height: 40px;
      font-size: 1rem;
    }

    .card-actions {
      opacity: 1;
    }

    .category-card {
      padding: var(--space-sm) var(--space-md);
      padding-left: calc(var(--space-md) + 4px);
    }

    .card-header-area {
      flex-wrap: wrap;
      gap: var(--space-sm);
    }

    .card-body {
      flex-wrap: wrap;
    }
  }
</style>

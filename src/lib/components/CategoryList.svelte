<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { formatCurrency, formatDateShort } from '$lib/utils/format';
  import { getCategoryHue, getCategoryTint, getCategoryText } from '$lib/utils/categoryColors';
  import { themeState } from '$lib/stores/preferences.svelte';
  import CategoryUsageBar from './CategoryUsageBar.svelte';
  import { showSuccess, showError } from '$lib/stores/toast.svelte';

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
  }: {
    categories: EnrichedCategory[];
    onEdit?: (cat: EnrichedCategory) => void;
    onDelete?: (cat: EnrichedCategory) => void;
    onAdd?: () => void;
    compact?: boolean;
    totalCount?: number;
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
     INCOME CATEGORIES — collapsed section
     ════════════════════════════════════════════════════════════════ -->
{#if incomeCategories.length > 0}
  <details class="category-group" open={false}>
    <summary class="group-header">
      <span class="header-left">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="chevron-icon">
          <path d="m9 18 6-6-6-6"/>
        </svg>
        <span class="group-title">Income · {incomeCategories.length}</span>
      </span>
      <span class="group-total">{formatCurrency(incomeCategories.reduce((s, c) => s + c.earned, 0))} earned</span>
    </summary>
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
  </details>
{/if}

<!-- ════════════════════════════════════════════════════════════════
     EXPENSE CATEGORIES — the main budget surface
     ════════════════════════════════════════════════════════════════ -->
{#if expenseCategories.length > 0}
  <div class="category-group">
    <div class="group-header">
      <span class="group-title">Expenses · {expenseCategories.length}</span>
      <span class="group-total">
        {formatCurrency(expenseCategories.reduce((s, c) => s + c.spent, 0))} spent
        of {formatCurrency(expenseCategories.reduce((s, c) => s + c.budgeted, 0))}
      </span>
    </div>
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

            <!-- ─── Card row 2: Budgeted │ Spent │ Available ─── -->
            <div class="budget-grid">
              <!-- Budgeted column -->
              <div class="budget-col">
                <span class="budget-col-label">Budgeted</span>
                {#if editingId === cat.id}
                  <div class="budget-edit-wrap">
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
                  </div>
                {:else if cat.budget_limit != null}
                  <button class="budget-col-value clickable" onclick={() => startEdit(cat)} title="Edit budget">
                    {formatCurrency(cat.budgeted)}
                  </button>
                {:else}
                  <button class="budget-set-btn" onclick={() => startEdit(cat)}>
                    + Set Budget
                  </button>
                {/if}
              </div>

              <!-- Spent column -->
              <div class="budget-col">
                <span class="budget-col-label">Spent</span>
                <span class="budget-col-value" class:inverted={cat.spent > 0}>
                  {formatCurrency(cat.spent)}
                </span>
              </div>

              <!-- Available column -->
              <div class="budget-col available-col">
                <span class="budget-col-label">Available</span>
                <span class="budget-col-hero" class:positive={cat.budgeted - cat.spent >= 0} class:negative={cat.budgeted - cat.spent < 0}>
                  {cat.budget_limit != null ? formatCurrency(cat.budgeted - cat.spent) : '—'}
                </span>
                {#if cat.budget_limit != null && cat.budgeted - cat.spent >= 0}
                  <span class="status-badge ok">Under</span>
                {:else if cat.budget_limit != null}
                  <span class="status-badge over">Over</span>
                {/if}
              </div>
            </div>

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
            {:else if cat.budget_limit === null}
              <div class="no-budget-hint">
                <span class="hint-text">No budget set</span>
              </div>
            {/if}
          </div>
        {/if}
      {/each}
    </div>
  </div>
{/if}

<!-- ─── Empty states ─── -->
{#if categories.length === 0}
  {#if totalCount > 0}
    <div class="empty-state">
      <div class="empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </div>
      <p>No matching categories</p>
      <span>Try a different search or filter.</span>
    </div>
  {:else}
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
        <button class="empty-cta" onclick={onAdd} type="button">Add First Category</button>
      {/if}
    </div>
  {/if}
{/if}

<style>
  /* ═══════════════════════════════════════════════════════════════════
     CATEGORY LIST — Flip7 Design
     ═══════════════════════════════════════════════════════════════════ */

  /* ─── Group headers ─── */
  .category-group {
    margin-bottom: var(--space-lg);
    border: none;
  }

  .group-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-sm) 0;
    margin-bottom: var(--space-md);
    cursor: pointer;
    list-style: none;
    user-select: none;
    border-bottom: 1px solid var(--line);
  }

  .group-header::-webkit-details-marker {
    display: none;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }

  .chevron-icon {
    transition: transform 200ms var(--ease);
  }

  details[open] .chevron-icon {
    transform: rotate(90deg);
  }

  .group-title {
    font-size: var(--font-size-sm);
    font-weight: 700;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-family: var(--font-display);
  }

  .group-total {
    font-size: var(--font-size-sm);
    font-weight: 700;
    color: var(--color-ink);
    font-variant-numeric: tabular-nums;
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
    padding: var(--space-md) var(--space-lg);
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
    padding: var(--space-md) var(--space-lg);
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
    margin-bottom: var(--space-md);
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

  /* ─── Three-column budget grid ─── */
  .budget-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1.5fr;
    gap: var(--space-md);
    margin-bottom: var(--space-sm);
  }

  .budget-col {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .available-col {
    text-align: right;
  }

  .budget-col-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .budget-col-value {
    font-size: 13px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--color-ink);
    background: none;
    border: none;
    padding: 0;
    font-family: inherit;
    text-align: left;
    cursor: default;
    min-height: auto;
  }

  .budget-col-value.clickable {
    cursor: pointer;
    border-bottom: 1px solid var(--color-border);
    padding-bottom: 1px;
    transition: border-color 120ms ease;
  }

  .budget-col-value.clickable:hover {
    border-color: var(--color-teal);
    color: var(--color-teal);
  }

  .budget-col-value.inverted {
    color: var(--color-coral);
  }

  /* ─── Available hero number ─── */
  .budget-col-hero {
    font-size: 15px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
  }

  .budget-col-hero.positive {
    color: var(--color-teal);
  }

  .budget-col-hero.negative {
    color: var(--color-coral);
  }

  /* ─── Status badges ─── */
  .status-badge {
    display: inline-block;
    font-size: 11px;
    font-weight: 600;
    padding: 1px 8px;
    border-radius: var(--radius-pill);
    margin-top: 4px;
    width: fit-content;
  }

  .status-badge.ok {
    background: var(--color-teal-bg);
    color: var(--color-teal);
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

  /* ─── Set Budget button ─── */
  .budget-set-btn {
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-pill);
    padding: 4px 12px;
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-muted);
    cursor: pointer;
    font-family: inherit;
    transition: all 120ms ease;
    width: fit-content;
    min-height: auto;
  }

  .budget-set-btn:hover {
    border-color: var(--color-teal);
    color: var(--color-teal);
    background: var(--color-teal-bg);
  }

  /* ─── Progress section ─── */
  .progress-section {
    margin-top: var(--space-sm);
    padding-top: var(--space-sm);
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

  /* ─── No budget hint ─── */
  .no-budget-hint {
    margin-top: var(--space-sm);
    padding-top: var(--space-sm);
    border-top: 1px solid var(--line);
  }

  .hint-text {
    font-size: 12px;
    color: var(--color-text-muted);
    font-style: italic;
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
    text-transform: uppercase;
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
    .budget-grid {
      grid-template-columns: 1fr 1fr;
      gap: var(--space-sm);
    }

    .available-col {
      grid-column: 1 / -1;
      text-align: left;
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: var(--space-sm);
      padding-top: var(--space-xs);
      border-top: 1px solid var(--line);
      margin-top: var(--space-xs);
    }

    .available-col .budget-col-hero {
      font-size: 14px;
    }

    .card-actions {
      opacity: 1;
    }

    .category-card {
      padding: var(--space-md);
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
    .budget-grid {
      grid-template-columns: 1fr;
      gap: var(--space-xs);
    }

    .available-col {
      border-top: 1px solid var(--line);
      padding-top: var(--space-xs);
      margin-top: var(--space-xs);
    }

    .cat-icon {
      width: 40px;
      height: 40px;
      font-size: 1rem;
    }

    .card-actions {
      opacity: 1;
    }

    .category-card {
      padding: var(--space-md);
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

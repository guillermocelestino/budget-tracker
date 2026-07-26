# Plan: Add Toggle Button for Card/Table View + Edit/Add in Lending Page

## Context
The lending page currently only shows a card grid view with no inline editing. Add:
1. Toggle between Card and Table view
2. Add new lending directly from the table view (inline form)
3. Edit existing lending directly from the table view (inline form)
4. Delete from table view

## Design

### View Toggle (pill-style)
Place before the tabs section:
```svelte
<div class="view-toggle">
    <button class="toggle-btn" class:active={viewMode === 'card'} onclick={() => viewMode = 'card'}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
        </svg>
    </button>
    <button class="toggle-btn" class:active={viewMode === 'table'} onclick={() => viewMode = 'table'}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>
            <line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
        </svg>
    </button>
</div>
```

### Card View (existing)
Keep as-is, wrapped in `{#if viewMode === 'card'}`.

### Table View (new)
**Features:**
- Inline add form at top (collapsible "Add New" row)
- Each row has Edit/Delete actions
- Click Edit → row transforms into inline edit form
- Click Add New → shows new lending form

```svelte
{#if viewMode === 'table'}
    <!-- Add New Row Toggle -->
    <button class="btn-add-new" onclick={() => showAddForm = !showAddForm}>
        {showAddForm ? 'Cancel' : '+ Add New Lending'}
    </button>

    <!-- Inline Add Form (when expanded) -->
    {#if showAddForm}
        <form class="inline-form">
            <input name="borrower_name" placeholder="Borrower" required />
            <input name="amount" type="text" placeholder="₱0.00" required />
            <input name="interest_rate" type="number" placeholder="0" />
            <input name="date_lent" type="date" required />
            <input name="due_date" type="date" />
            <button type="submit" class="btn-save">Save</button>
            <button type="button" class="btn-cancel" onclick={() => showAddForm = false}>Cancel</button>
        </form>
    {/if}

    <!-- Table -->
    <div class="lending-table-container">
        <table class="lending-table">
            <thead>
                <tr>
                    <th>Borrower</th>
                    <th>Amount</th>
                    <th>Interest</th>
                    <th>Date Lent</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                {#each showLendings as lending}
                    {#if editingId === lending.id}
                        <!-- Inline Edit Row -->
                        <tr class="edit-row">
                            <td><input bind:value={editForm.borrower_name} /></td>
                            <td><input bind:value={editForm.amount} /></td>
                            <td><input bind:value={editForm.interest_rate} /></td>
                            <td><input type="date" bind:value={editForm.date_lent} /></td>
                            <td><input type="date" bind:value={editForm.due_date} /></td>
                            <td>
                                <select bind:value={editForm.status}>
                                    <option value="active">Active</option>
                                    <option value="paid">Paid</option>
                                </select>
                            </td>
                            <td>
                                <button class="btn-save" onclick={saveEdit}>Save</button>
                                <button class="btn-cancel" onclick={() => editingId = null}>Cancel</button>
                            </td>
                        </tr>
                    {:else}
                        <!-- Data Row -->
                        <tr>
                            <td>
                                <div class="borrower-cell">
                                    <div class="borrower-avatar">{lending.borrower_name.charAt(0).toUpperCase()}</div>
                                    {lending.borrower_name}
                                </div>
                            </td>
                            <td class="amount-cell">{formatCurrency(lending.amount)}</td>
                            <td>{lending.interest_rate}%</td>
                            <td>{formatDate(lending.date_lent)}</td>
                            <td>{lending.due_date ? formatDate(lending.due_date) : '—'}</td>
                            <td><span class="badge" class:active={lending.status === 'active'}>{lending.status}</span></td>
                            <td>
                                <button class="action-btn edit" onclick={() => startEdit(lending)}>Edit</button>
                                <button class="action-btn delete" onclick={() => deleteId = lending.id}>Delete</button>
                            </td>
                        </tr>
                    {/if}
                {/each}
            </tbody>
        </table>
    </div>
{/if}
```

### Card View Updates (add Edit button if not present)
Add Edit button to lending cards so both views have equal functionality.

## Files
- `src/routes/lending/+page.svelte`
- `src/routes/lending/+page.server.ts` — already has create/edit/delete actions

## New State Variables
```svelte
let viewMode = $state<'card' | 'table'>('card');
let showAddForm = $state(false);
let editingId = $state<number | null>(null);
let editForm = $state({ borrower_name: '', amount: '', interest_rate: '', date_lent: '', due_date: '', status: 'active' });
```

## CSS Additions
- `.view-toggle` — pill container
- `.toggle-btn` — icon buttons
- `.lending-table-container` — scrollable wrapper
- `.lending-table` — full width with alternating row colors
- `.edit-row` — highlighted background
- `.btn-add-new` — gradient button like Add Your First Lending
- `.action-btn.edit` — small primary button
- `.action-btn.delete` — small danger button

## Verification
1. Toggle between card and table view — both render correctly
2. Add new lending from table view — form submits and list updates
3. Edit lending from table view — inline edit works, cancel reverts
4. Delete from table view — confirmation modal appears
5. Card view Edit button works similarly
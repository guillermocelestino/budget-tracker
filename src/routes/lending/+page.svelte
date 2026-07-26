<script lang="ts">
	import { page } from '$app/stores';
	import { enhance } from '$app/forms';
	import { formatCurrency, formatDate } from '$lib/utils/format';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import ModalDialog from '$lib/components/ModalDialog.svelte';
	import PageBackground from '$lib/components/PageBackground.svelte';
	import { showSuccess, showError } from '$lib/stores/toast.svelte';

	let data = $derived($page.data as App.PageData);

	let showForm = $state(false);
	let activeTab = $state<'active' | 'paid'>('active');
	let markPaidId = $state<number | null>(null);
	let recordAsIncome = $state(true);
	let deleteId = $state<number | null>(null);

	const activeLendings = $derived(data.activeLendings ?? []);
	const paidLendings = $derived(data.paidLendings ?? []);
	const totals = $derived(data.totals ?? { totalLent: 0, totalRecovered: 0, outstanding: 0 });

	let rawAmount = $state('');

	function formatWithCommas(value: string): string {
		const parts = value.split('.');
		parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
		return parts.join('.');
	}

	const displayAmount = $derived(rawAmount ? formatWithCommas(rawAmount) : '');

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

	const showLendings = $derived(activeTab === 'active' ? activeLendings : paidLendings);
</script>

<svelte:head>
	<title>Lending — Budget Tracker</title>
</svelte:head>

<PageHeader title="Lending">
	{#snippet action()}
		<button class="btn-add" onclick={() => showForm = true}>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
				<line x1="12" x2="12" y1="5" y2="19"/>
				<line x1="5" x2="19" y1="12" y2="12"/>
			</svg>
			New Lending
		</button>
	{/snippet}
</PageHeader>

<PageBackground />

<!-- Summary Cards -->
<div class="summary-grid">
	<div class="summary-card">
		<div class="card-icon lent">
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M12 2a3 3 0 0 0-3 3v1h6V5a3 3 0 0 0-3-3z"/>
				<path d="M5 8h14a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/>
			</svg>
		</div>
		<div class="card-content">
			<span class="card-label">Total Lent</span>
			<span class="card-value">{formatCurrency(totals.totalLent)}</span>
		</div>
		<div class="card-accent"></div>
	</div>
	<div class="summary-card recovered">
		<div class="card-icon">
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<line x1="12" x2="12" y1="2" y2="22"/>
				<path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
			</svg>
		</div>
		<div class="card-content">
			<span class="card-label">Recovered</span>
			<span class="card-value income">{formatCurrency(totals.totalRecovered)}</span>
		</div>
		<div class="card-accent"></div>
	</div>
	<div class="summary-card">
		<div class="card-icon outstanding">
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="12" r="10"/>
				<path d="M12 6v6l4 2"/>
			</svg>
		</div>
		<div class="card-content">
			<span class="card-label">Outstanding</span>
			<span class="card-value expense">{formatCurrency(totals.outstanding)}</span>
		</div>
		<div class="card-accent"></div>
	</div>
</div>

<!-- New Lending Form -->
{#if showForm}
	<div class="form-overlay" onclick={() => showForm = false}></div>
	<div class="form-panel">
		<div class="form-panel-header">
			<h3>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="12" x2="12" y1="5" y2="19"/>
					<line x1="5" x2="19" y1="12" y2="12"/>
				</svg>
				New Lending
			</h3>
			<button class="btn-close" onclick={() => showForm = false} aria-label="Close">&times;</button>
		</div>
		<form method="POST" action="?/create" use:enhance={() => {
			return async ({ result, update }) => {
				await update();
				if (result.type === 'success') {
					showForm = false;
					showSuccess('Lending recorded successfully');
				} else if (result.type === 'failure') {
					showError(result.data?.error || 'Failed to record lending');
				}
			};
		}}>
			<div class="form-group">
				<label for="borrower_name">Borrower Name</label>
				<input id="borrower_name" name="borrower_name" type="text" required placeholder="Who borrowed the money?" />
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
					<input id="interest_rate" name="interest_rate" type="number" step="0.1" placeholder="0" value="0" />
				</div>
			</div>
			<div class="form-row">
				<div class="form-group">
					<label for="date_lent">Date Lent</label>
					<input id="date_lent" name="date_lent" type="date" required />
				</div>
				<div class="form-group">
					<label for="due_date">Due Date</label>
					<input id="due_date" name="due_date" type="date" />
				</div>
			</div>
			<div class="form-group">
				<label for="notes">Notes</label>
				<textarea id="notes" name="notes" rows="2" placeholder="Optional notes"></textarea>
			</div>
			<div class="form-actions">
				<button type="submit" class="btn btn-primary">Record Lending</button>
				<button type="button" class="btn btn-secondary" onclick={() => showForm = false}>Cancel</button>
			</div>
		</form>
	</div>
{/if}

<!-- Tabs -->
<div class="tabs">
	<button class="tab" class:active={activeTab === 'active'} onclick={() => activeTab = 'active'}>
		Active ({activeLendings.length})
	</button>
	<button class="tab" class:active={activeTab === 'paid'} onclick={() => activeTab = 'paid'}>
		Paid ({paidLendings.length})
	</button>
</div>

<!-- Lending Cards -->
{#if showLendings.length === 0}
	<div class="empty-state">
		<div class="empty-illustration">
			<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
				<path d="M12 2a3 3 0 0 0-3 3v1h6V5a3 3 0 0 0-3-3z"/>
				<path d="M5 8h14a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/>
				<path d="M3 12h18v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7z"/>
			</svg>
		</div>
		<h3>No {activeTab} lendings</h3>
		<p>{activeTab === 'active' ? 'Start tracking money you lent out' : 'Paid lendings will appear here'}</p>
		{#if activeTab === 'active'}
			<button class="btn-gradient" onclick={() => showForm = true}>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
					<line x1="12" x2="12" y1="5" y2="19"/>
					<line x1="5" x2="19" y1="12" y2="12"/>
				</svg>
				Add Your First Lending
			</button>
		{/if}
	</div>
{:else}
	<div class="lending-grid">
		{#each showLendings as lending (lending.id)}
			<div class="lending-card" class:paid={lending.status === 'paid'}>
				<div class="lending-header">
					<div class="lending-borrower">
						<div class="borrower-avatar">{lending.borrower_name.charAt(0).toUpperCase()}</div>
						<span>{lending.borrower_name}</span>
					</div>
					<span class="badge" class:active={lending.status === 'active'} class:paid={lending.status === 'paid'}>
						{lending.status === 'active' ? 'Active' : 'Paid'}
					</span>
				</div>
				<div class="lending-amount">{formatCurrency(lending.amount)}</div>
				<div class="lending-details">
					<div class="detail">
						<span class="detail-label">Interest</span>
						<span class="detail-value">{lending.interest_rate}%</span>
					</div>
					<div class="detail">
						<span class="detail-label">Date Lent</span>
						<span class="detail-value">{formatDate(lending.date_lent)}</span>
					</div>
					{#if lending.due_date}
						<div class="detail">
							<span class="detail-label">Due Date</span>
							<span class="detail-value">{formatDate(lending.due_date)}</span>
						</div>
					{/if}
				</div>
				{#if lending.notes}
					<p class="lending-notes">📝 {lending.notes}</p>
				{/if}
				<div class="lending-actions">
					{#if lending.status === 'active'}
						<button class="btn-paid" onclick={() => markPaidId = lending.id}>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
								<polyline points="20 6 9 17 4 12"/>
							</svg>
							Mark as Paid
						</button>
					{/if}
					<button class="btn-delete" onclick={() => deleteId = lending.id} aria-label="Delete">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="3 6 5 6 21 6"/>
							<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
						</svg>
					</button>
				</div>
			</div>
		{/each}
	</div>
{/if}

<!-- Mark as Paid Modal -->
{#if markPaidId !== null}
	<ModalDialog open={markPaidId !== null} onclose={() => { markPaidId = null; recordAsIncome = true; }} title="Record Repayment">
		<div class="modal-icon-wrap">
			<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="20 6 9 17 4 12"/>
			</svg>
		</div>
		<p class="modal-desc">Would you like to record this repayment as income?</p>
		<form method="POST" action="?/markPaid" use:enhance={() => {
			return async ({ result, update }) => {
				await update();
				if (result.type === 'success') {
					markPaidId = null;
					showSuccess('Marked as paid successfully');
				} else {
					showError(result.data?.error || 'Failed to update');
				}
			};
		}}>
			<input type="hidden" name="id" value={markPaidId} />
			<div class="radio-group">
				<label class="radio-option">
					<input type="radio" name="record_as_income" value="true" bind:group={recordAsIncome} />
					<span class="radio-label">Yes, record as income transaction</span>
					<span class="radio-desc">Creates an income entry in Transactions</span>
				</label>
				<label class="radio-option">
					<input type="radio" name="record_as_income" value="false" bind:group={recordAsIncome} />
					<span class="radio-label">No, just mark as paid</span>
					<span class="radio-desc">No transaction created</span>
				</label>
			</div>
			<div class="modal-actions">
				<button type="submit" class="btn btn-primary">Confirm</button>
				<button type="button" class="btn btn-secondary" onclick={() => { markPaidId = null; recordAsIncome = true; }}>Cancel</button>
			</div>
		</form>
	</ModalDialog>
{/if}

<!-- Delete Confirmation -->
{#if deleteId !== null}
	<ModalDialog open={deleteId !== null} onclose={() => deleteId = null} title="Delete Lending">
		<div class="modal-icon-wrap danger">
			<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="3 6 5 6 21 6"/>
				<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
			</svg>
		</div>
		<p>Are you sure you want to delete this lending record?</p>
		<form method="POST" action="?/delete" use:enhance={() => {
			return async ({ result, update }) => {
				await update();
				if (result.type === 'success') {
					deleteId = null;
					showSuccess('Lending deleted');
				} else {
					showError('Failed to delete');
				}
			};
		}}>
			<input type="hidden" name="id" value={deleteId} />
			<div class="modal-actions">
				<button type="submit" class="btn btn-danger">Delete</button>
				<button type="button" class="btn btn-secondary" onclick={() => deleteId = null}>Cancel</button>
			</div>
		</form>
	</ModalDialog>
{/if}

<style>
	.btn-add {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		padding: var(--space-sm) var(--space-md);
		background: linear-gradient(135deg, var(--color-primary) 0%, #8b5cf6 100%);
		color: white;
		border: none;
		border-radius: var(--radius-md);
		font-size: var(--font-size-sm);
		font-weight: 600;
		cursor: pointer;
		min-height: 44px;
		box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
		transition: all var(--transition-fast);
	}

	.btn-add:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
	}

	.summary-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--space-md);
		margin-bottom: var(--space-lg);
		animation: slideInUp 0.5s ease-out;
	}

	.summary-card {
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--space-md);
		background: rgba(255, 255, 255, 0.85);
		backdrop-filter: blur(20px);
		border-radius: var(--radius-xl);
		padding: var(--space-lg);
		box-shadow: var(--shadow-sm);
		border: 1px solid var(--color-border);
		overflow: hidden;
		transition: all 200ms ease;
	}

	.summary-card:hover {
		transform: translateY(-3px);
		box-shadow: var(--shadow-lg);
	}

	.card-icon {
		width: 52px;
		height: 52px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-lg);
		flex-shrink: 0;
		z-index: 1;
	}

	.summary-card:nth-child(1) .card-icon {
		background: linear-gradient(135deg, var(--color-primary-light) 0%, rgba(99, 102, 241, 0.15) 100%);
		color: var(--color-primary);
	}

	.summary-card:nth-child(2) .card-icon {
		background: linear-gradient(135deg, var(--color-income-light) 0%, rgba(16, 185, 129, 0.15) 100%);
		color: var(--color-income);
	}

	.summary-card:nth-child(3) .card-icon {
		background: linear-gradient(135deg, var(--color-expense-light) 0%, rgba(239, 68, 68, 0.15) 100%);
		color: var(--color-expense);
	}

	.card-content {
		display: flex;
		flex-direction: column;
		z-index: 1;
	}

	.card-label {
		font-size: var(--font-size-sm);
		color: var(--color-text-secondary);
		margin-bottom: 4px;
		font-weight: 500;
	}

	.card-value {
		font-size: var(--font-size-xl);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.card-value.income {
		color: var(--color-income);
	}

	.card-value.expense {
		color: var(--color-expense);
	}

	.card-accent {
		position: absolute;
		top: 0;
		right: 0;
		width: 80px;
		height: 80px;
		border-radius: 0 0 0 100%;
		opacity: 0.1;
	}

	.summary-card:nth-child(1) .card-accent { background: var(--color-primary); }
	.summary-card:nth-child(2) .card-accent { background: var(--color-income); }
	.summary-card:nth-child(3) .card-accent { background: var(--color-expense); }

	@keyframes slideInUp {
		from { opacity: 0; transform: translateY(20px); }
		to { opacity: 1; transform: translateY(0); }
	}

	/* Tabs */
	.tabs {
		display: flex;
		gap: var(--space-sm);
		margin-bottom: var(--space-lg);
		background: var(--color-bg);
		padding: 4px;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		width: fit-content;
	}

	.tab {
		padding: var(--space-sm) var(--space-lg);
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: var(--font-size-sm);
		font-weight: 600;
		font-family: inherit;
		background: transparent;
		color: var(--color-text-secondary);
		transition: all var(--transition-fast);
		min-height: 40px;
	}

	.tab.active {
		background: var(--color-primary);
		color: white;
		box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
	}

	.tab:not(.active):hover {
		background: var(--color-surface);
		color: var(--color-text);
	}

	/* Form Overlay */
	.form-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.3);
		backdrop-filter: blur(4px);
		z-index: 80;
		animation: fadeIn 200ms ease;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.form-panel {
		position: relative;
		max-width: 500px;
		margin: 0 auto var(--space-lg);
		background: rgba(255, 255, 255, 0.95);
		backdrop-filter: blur(20px);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		padding: var(--space-lg);
		box-shadow: var(--shadow-lg);
		animation: slideIn 250ms ease-out;
		z-index: 81;
	}

	@keyframes slideIn {
		from { opacity: 0; transform: translateY(-20px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.form-panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--space-md);
		padding-bottom: var(--space-md);
		border-bottom: 1px solid var(--color-border);
	}

	.form-panel-header h3 {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		margin: 0;
		font-size: var(--font-size-lg);
	}

	.form-panel-header h3 svg {
		color: var(--color-primary);
	}

	.btn-close {
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		color: var(--color-text-secondary);
		padding: 4px 8px;
		border-radius: var(--radius-sm);
		transition: all var(--transition-fast);
	}

	.btn-close:hover {
		background: var(--color-bg);
		color: var(--color-text);
	}

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
	.form-group textarea,
	.form-group select {
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
	}

	.amount-wrap input {
		border-top-left-radius: 0;
		border-bottom-left-radius: 0;
	}

	/* Lending Grid */
	.lending-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: var(--space-md);
	}

	.lending-card {
		background: rgba(255, 255, 255, 0.85);
		backdrop-filter: blur(20px);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		padding: var(--space-lg);
		box-shadow: var(--shadow-sm);
		transition: all 200ms ease;
		animation: cardIn 0.4s ease-out backwards;
	}

	.lending-card:hover {
		transform: translateY(-4px);
		box-shadow: var(--shadow-lg);
		border-color: rgba(99, 102, 241, 0.3);
	}

	.lending-card.paid {
		opacity: 0.6;
	}

	.lending-card.paid:hover {
		opacity: 0.85;
	}

	@keyframes cardIn {
		from { opacity: 0; transform: translateY(15px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.lending-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--space-sm);
	}

	.lending-borrower {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		font-weight: 600;
		font-size: var(--font-size-base);
	}

	.borrower-avatar {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, var(--color-primary-light) 0%, rgba(99, 102, 241, 0.2) 100%);
		color: var(--color-primary);
		border-radius: var(--radius-md);
		font-weight: 700;
		font-size: var(--font-size-sm);
		flex-shrink: 0;
	}

	.badge {
		padding: 3px 12px;
		border-radius: 999px;
		font-size: var(--font-size-sm);
		font-weight: 600;
	}

	.badge.active {
		background: linear-gradient(135deg, #fef3c7, #fde68a);
		color: #92400e;
		border: 1px solid rgba(245, 158, 11, 0.3);
	}

	.badge.paid {
		background: linear-gradient(135deg, #d1fae5, #a7f3d0);
		color: #065f46;
		border: 1px solid rgba(16, 185, 129, 0.3);
	}

	.lending-amount {
		font-size: var(--font-size-2xl);
		font-weight: 700;
		color: var(--color-text);
		font-variant-numeric: tabular-nums;
		margin-bottom: var(--space-sm);
	}

	.lending-details {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-md);
		margin-bottom: var(--space-sm);
	}

	.detail {
		display: flex;
		flex-direction: column;
	}

	.detail-label {
		font-size: var(--font-size-xs);
		color: var(--color-text-secondary);
	}

	.detail-value {
		font-weight: 600;
		font-size: var(--font-size-sm);
	}

	.lending-notes {
		font-size: var(--font-size-sm);
		color: var(--color-text-secondary);
		margin-bottom: var(--space-sm);
		padding: var(--space-xs) var(--space-sm);
		background: var(--color-bg);
		border-radius: var(--radius-sm);
	}

	.lending-actions {
		display: flex;
		gap: var(--space-sm);
		margin-top: var(--space-sm);
	}

	.btn-paid {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		padding: var(--space-xs) var(--space-md);
		background: linear-gradient(135deg, var(--color-income) 0%, #34d399 100%);
		color: white;
		border: none;
		border-radius: var(--radius-md);
		font-size: var(--font-size-sm);
		font-weight: 600;
		cursor: pointer;
		min-height: 36px;
		box-shadow: 0 4px 15px -3px rgba(16, 185, 129, 0.4);
		transition: all var(--transition-fast);
	}

	.btn-paid:hover {
		transform: translateY(-2px);
		box-shadow: 0 8px 25px -5px rgba(16, 185, 129, 0.5);
	}

	.btn-delete {
		background: none;
		border: none;
		cursor: pointer;
		padding: 8px;
		border-radius: var(--radius-sm);
		color: var(--color-text-secondary);
		min-height: 36px;
		min-width: 36px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition: all var(--transition-fast);
	}

	.btn-delete:hover {
		background: var(--color-expense-light);
		color: var(--color-expense);
	}

	/* Empty State */
	.empty-state {
		text-align: center;
		padding: var(--space-2xl);
		background: rgba(255, 255, 255, 0.85);
		backdrop-filter: blur(20px);
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-xl);
		animation: fadeSlideIn 0.5s ease-out;
	}

	.empty-illustration {
		width: 80px;
		height: 80px;
		margin: 0 auto var(--space-md);
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, var(--color-primary-light) 0%, rgba(99, 102, 241, 0.1) 100%);
		color: var(--color-primary);
		border-radius: var(--radius-lg);
	}

	.empty-state h3 {
		margin: 0 0 var(--space-xs);
		font-size: var(--font-size-lg);
	}

	.empty-state p {
		color: var(--color-text-secondary);
		font-size: var(--font-size-sm);
		margin: 0 0 var(--space-lg);
	}

	.btn-gradient {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		padding: var(--space-sm) var(--space-lg);
		background: linear-gradient(135deg, var(--color-primary) 0%, #8b5cf6 100%);
		color: white;
		border: none;
		border-radius: var(--radius-md);
		font-size: var(--font-size-sm);
		font-weight: 600;
		cursor: pointer;
		min-height: 44px;
		box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
		transition: all var(--transition-fast);
	}

	.btn-gradient:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
	}

	@keyframes fadeSlideIn {
		from { opacity: 0; transform: translateY(10px); }
		to { opacity: 1; transform: translateY(0); }
	}

	/* Modal */
	.modal-icon-wrap {
		width: 64px;
		height: 64px;
		margin: 0 auto var(--space-md);
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, var(--color-income-light) 0%, rgba(16, 185, 129, 0.1) 100%);
		color: var(--color-income);
		border-radius: var(--radius-lg);
	}

	.modal-icon-wrap.danger {
		background: linear-gradient(135deg, var(--color-expense-light) 0%, rgba(239, 68, 68, 0.1) 100%);
		color: var(--color-expense);
	}

	.modal-desc {
		text-align: center;
		margin-bottom: var(--space-md);
	}

	.radio-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		margin: var(--space-md) 0;
	}

	.radio-option {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.radio-option:has(input:checked) {
		border-color: var(--color-primary);
		background: var(--color-primary-light);
	}

	.radio-option input {
		accent-color: var(--color-primary);
	}

	.radio-label {
		font-weight: 600;
		font-size: var(--font-size-sm);
	}

	.radio-desc {
		font-size: var(--font-size-xs);
		color: var(--color-text-secondary);
	}

	.form-actions,
	.modal-actions {
		display: flex;
		gap: var(--space-sm);
		margin-top: var(--space-lg);
	}

	.btn {
		padding: var(--space-sm) var(--space-lg);
		border-radius: var(--radius-md);
		font-size: var(--font-size-base);
		font-weight: 600;
		cursor: pointer;
		border: none;
		min-height: 44px;
		flex: 1;
		transition: all var(--transition-fast);
	}

	.btn-primary {
		background: var(--color-primary);
		color: white;
	}

	.btn-primary:hover {
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

	.btn-danger {
		background: var(--color-expense);
		color: white;
	}

	.btn-danger:hover {
		background: var(--color-danger-hover);
	}

	@media (max-width: 768px) {
		.summary-grid {
			grid-template-columns: 1fr;
		}

		.form-row {
			grid-template-columns: 1fr;
		}

		.lending-grid {
			grid-template-columns: 1fr;
		}

		.lending-amount {
			font-size: var(--font-size-xl);
		}
	}
</style>

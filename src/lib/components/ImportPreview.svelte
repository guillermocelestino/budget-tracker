<script lang="ts">
	import { formatCurrency } from '$lib/utils/format';

	let {
		rows = [],
		onConfirm,
		onCancel,
	}: {
		rows: { date: string; description: string; amount: number; type: string; category_name: string }[];
		onConfirm?: () => void;
		onCancel?: () => void;
	} = $props();

	const totalAmount = $derived(rows.reduce((s, r) => s + r.amount, 0));
	const count = $derived(rows.length);
</script>

<div class="import-preview">
	<div class="preview-header">
		<h3>Preview Import</h3>
		<span class="preview-count">{count} transactions · {formatCurrency(totalAmount)} total</span>
	</div>

	<div class="preview-table-wrap">
		<table class="preview-table">
			<thead>
				<tr>
					<th>Date</th>
					<th>Description</th>
					<th>Category</th>
					<th>Type</th>
					<th class="text-right">Amount</th>
				</tr>
			</thead>
			<tbody>
				{#each rows.slice(0, 20) as row, i}
					<tr>
						<td class="cell-date">{row.date}</td>
						<td class="cell-desc">{row.description}</td>
						<td class="cell-cat">{row.category_name}</td>
						<td>
							<span class="type-chip" class:income={row.type === 'income'} class:expense={row.type !== 'income'}>
								{row.type}
							</span>
						</td>
						<td class="cell-amount" class:amount-income={row.type === 'income'} class:amount-expense={row.type !== 'income'}>
							{formatCurrency(row.amount)}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
		{#if rows.length > 20}
			<div class="more-hint">...and {rows.length - 20} more rows</div>
		{/if}
	</div>

	<div class="preview-actions">
		<button class="btn-confirm" onclick={onConfirm} type="button">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="20 6 9 17 4 12"/>
			</svg>
			Import {count} Transactions
		</button>
		<button class="btn-cancel" onclick={onCancel} type="button">Cancel</button>
	</div>
</div>

<style>
	.import-preview {
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-xl);
		overflow: hidden;
		box-shadow: var(--shadow-card);
	}

	.preview-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-md) var(--space-lg);
		border-bottom: 1px dashed var(--color-hairline);
	}

	.preview-header h3 {
		font-family: var(--font-display);
		font-size: var(--font-size-base);
		font-weight: var(--font-weight-bold);
		color: var(--color-ink);
		margin: 0;
	}

	.preview-count {
		font-size: var(--font-size-xs);
		color: var(--color-teal);
		font-family: var(--font-mono);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.preview-table-wrap {
		overflow-x: auto;
		max-height: 320px;
		overflow-y: auto;
	}

	.preview-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--font-size-sm);
	}

	.preview-table th {
		text-align: left;
		padding: var(--space-sm) var(--space-md);
		color: var(--color-text-muted);
		font-weight: 600;
		font-size: var(--font-size-xs);
		border-bottom: 1px solid var(--color-hairline);
		position: sticky;
		top: 0;
		background: var(--color-cream);
		z-index: 1;
	}

	.preview-table td {
		padding: var(--space-xs) var(--space-md);
		border-bottom: 1px solid var(--color-hairline);
		vertical-align: middle;
	}

	.text-right {
		text-align: right;
	}

	.cell-date {
		font-family: var(--font-mono);
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		white-space: nowrap;
	}

	.cell-desc {
		color: var(--color-ink);
		font-weight: 500;
		max-width: 200px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.cell-cat {
		font-size: var(--font-size-xs);
	}

	.type-chip {
		padding: 2px 8px;
		border-radius: var(--radius-pill);
		font-size: 10px;
		font-weight: 700;
		font-family: var(--font-display);
	}

	.type-chip.income {
		background: var(--color-teal-bg);
		color: var(--color-teal);
	}

	.type-chip.expense {
		background: rgba(239, 108, 74, 0.10);
		color: var(--color-coral);
	}

	.cell-amount {
		font-family: var(--font-mono);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		text-align: right;
	}

	.amount-income { color: var(--color-teal); }
	.amount-expense { color: var(--color-coral); }

	.more-hint {
		padding: var(--space-sm) var(--space-md);
		text-align: center;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		font-style: italic;
		background: var(--color-cream);
	}

	.preview-actions {
		display: flex;
		gap: var(--space-sm);
		padding: var(--space-md) var(--space-lg);
		border-top: 1px solid var(--color-hairline);
		background: var(--color-cream);
	}

	.btn-confirm {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-xs);
		padding: var(--space-sm) var(--space-lg);
		background: linear-gradient(135deg, var(--color-gold), var(--color-gold-light));
		color: var(--color-ink);
		border: none;
		border-radius: var(--radius-pill);
		font-family: var(--font-display);
		font-size: var(--font-size-base);
		font-weight: var(--font-weight-bold);
		cursor: pointer;
		min-height: 48px;
		box-shadow: var(--glow-gold);
		transition: all 200ms var(--bounce);
	}

	.btn-confirm:hover {
		transform: translateY(-1px);
		box-shadow: 0 6px 24px rgba(255, 210, 63, 0.55);
	}

	.btn-confirm:active {
		transform: scale(0.97);
	}

	.btn-cancel {
		padding: var(--space-sm) var(--space-xl);
		background: var(--color-bg);
		color: var(--color-text-muted);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-pill);
		font-family: var(--font-body);
		font-size: var(--font-size-sm);
		font-weight: 600;
		cursor: pointer;
		min-height: 48px;
		transition: all 150ms var(--ease);
	}

	.btn-cancel:hover {
		background: var(--color-teal-bg);
		border-color: var(--color-teal);
		color: var(--color-teal);
	}
</style>

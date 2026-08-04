<script lang="ts">
	import { formatCurrency } from '$lib/utils/format';
	import type { ImportRow, ImportPreviewColumn, ImportValidationResult } from '$lib/utils/importValidation';

	/** Default transactions columns — reproduces the original table exactly. */
	const DEFAULT_COLUMNS: ImportPreviewColumn[] = [
		{ header: 'Status', key: '_status', kind: 'status' },
		{ header: 'Date', key: 'date', kind: 'date' },
		{ header: 'Description', key: 'description', kind: 'text', cls: 'cell-desc' },
		{ header: 'Category', key: 'category_name', kind: 'text', cls: 'cell-cat' },
		{ header: 'Type', key: 'type', kind: 'type' },
		{ header: 'Amount', key: 'amount', kind: 'amount', align: 'right' },
	];

	let {
		rows = [],
		validation = { validRows: [], invalidRows: [], unknownCategories: [] } as ImportValidationResult,
		onConfirm,
		onCancel,
		columns = DEFAULT_COLUMNS,
		confirmLabel = 'Import {n} Transactions',
		summaryHint = 'Invalid rows will be skipped. Fix your CSV or add missing categories to import them.',
		unknownTitle = 'Unknown categories:',
		unknownHint = 'Add these in <a href="/categories" target="_blank">Categories</a> or fix the CSV, then re-import.',
		newNamesTitle = '',
		newNamesHint = '',
		limit = 15,
	}: {
		rows: ImportRow[];
		validation: ImportValidationResult;
		onConfirm?: () => void;
		onCancel?: () => void;
		columns?: ImportPreviewColumn[];
		confirmLabel?: string;
		summaryHint?: string;
		unknownTitle?: string;
		unknownHint?: string;
		newNamesTitle?: string;
		newNamesHint?: string;
		limit?: number;
	} = $props();

	const validCount = $derived(validation.validRows.length);
	const invalidCount = $derived(validation.invalidRows.length);
	const totalCount = $derived(rows.length);
	const validTotal = $derived(
		validation.validRows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
	);
	const confirmText = $derived(confirmLabel.replace('{n}', String(validCount)));

	// Combine valid and invalid rows for display (keep the spread of row fields
	// plus status metadata on the same object).
	type DisplayRow = ImportRow & {
		_status: 'valid' | 'invalid';
		_index: number;
		_originalIndex: number;
		_errors?: string[];
		_warnings?: string[];
	};

	const displayRows = $derived<DisplayRow[]>(
		[
			...validation.validRows.map((r, i) => ({ ...r, _status: 'valid' as const, _index: i, _originalIndex: rows.indexOf(r) })),
			...validation.invalidRows.map(({ row }, i) => ({ ...row, _status: 'invalid' as const, _index: i, _errors: validation.invalidRows[i].errors, _warnings: validation.invalidRows[i].warnings, _originalIndex: rows.indexOf(row) })),
		]
	);

	// Rows to display (capped at limit)
	const displayRowLimit = $derived(limit > 0 ? limit : displayRows.length);
	const hasMoreRows = $derived(displayRows.length > displayRowLimit);

	const displayedRows = $derived(displayRows.slice(0, displayRowLimit));
</script>

<div class="import-preview">
	<div class="preview-header">
		<div class="preview-title">
			<h3>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<rect x="2" y="3" width="20" height="14" rx="2" />
					<path d="M8 21h8" />
					<path d="M12 17v4" />
				</svg>
				Preview Import
			</h3>
		</div>
		<div class="preview-chips">
			<span class="chip chip-teal">
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="20 6 9 17 4 12"/>
				</svg>
				{validCount} valid
			</span>
			{#if invalidCount > 0}
				<span class="chip chip-coral">
					<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/>
					</svg>
					{invalidCount} invalid
				</span>
			{/if}
		</div>
	</div>

	{#if validation.unknownCategories.length > 0}
		<div class="unknown-categories-banner">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
				<line x1="12" x2="12" y1="9" y2="13"/>
				<line x1="12" x2="12.01" y1="17" y2="17"/>
			</svg>
			<span>
				<strong>{unknownTitle}</strong> {validation.unknownCategories.join(', ')}
				<br>
				<!-- unknownHint is a static string passed by the wizard (not user input); it contains an anchor link -->
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				<small>{@html unknownHint}</small>
			</span>
		</div>
	{/if}

	{#if (validation.newNames ?? []).length > 0}
		<div class="new-names-banner">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
				<circle cx="12" cy="7" r="4"/>
			</svg>
			<span>
				<strong>{newNamesTitle}</strong> {(validation.newNames ?? []).join(', ')}
				{#if newNamesHint}<br><small>{newNamesHint}</small>{/if}
			</span>
		</div>
	{/if}

	<div class="preview-table-wrap">
		<table class="preview-table">
			<thead>
				<tr>
					{#each columns as col (col.header)}
						<th class:text-right={col.align === 'right'}>{col.header}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each displayedRows as row, i (i)}
					<tr class={row._status === 'valid' ? 'row-valid' : 'row-invalid'}>
						{#each columns as col (col.header)}
							{#if col.kind === 'status'}
								<td class="status-cell">
									{#if row._status === 'valid'}
										<div class="status-dot status-valid" title="Valid"></div>
									{:else}
										<div class="status-dot status-invalid" title="Invalid"></div>
									{/if}
								</td>
							{:else if col.kind === 'amount'}
								<td class="cell-amount" class:text-right={col.align === 'right'} class:amount-income={row.type === 'income'} class:amount-expense={row.type === 'expense'}>
									{formatCurrency(Number(row[col.key]))}
								</td>
							{:else if col.kind === 'type'}
								<td>
									{#if row.type}
										<span class="type-chip" class:income={row.type === 'income'} class:expense={row.type !== 'income'}>
											{row.type}
										</span>
									{:else}—{/if}
								</td>
							{:else if col.kind === 'date'}
								<td class="cell-date">{String(row[col.key] ?? '')}</td>
							{:else if col.kind === 'badge'}
								<td class="cell-badge">
									{#if row[col.key]}
										<span class="badge" class:badge-active={String(row[col.key]).toLowerCase() === 'paid' || String(row[col.key]).toLowerCase() === 'active'}>
											{String(row[col.key])}
										</span>
									{:else}—{/if}
								</td>
							{:else}
								<td class:cell-desc={col.cls === 'cell-desc'} class:cell-cat={col.cls === 'cell-cat'}>{String(row[col.key] ?? '')}</td>
							{/if}
						{/each}
					</tr>
					{#if row._status === 'invalid'}
						<tr class="error-row">
							<td colspan={columns.length}>
								<div class="error-detail">
									{#each row._errors ?? [] as err, i (i)}
										<div class="error-item">
											<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
												<circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/>
											</svg>
											{err}
										</div>
									{/each}
									{#each row._warnings ?? [] as warn, i (i)}
										<div class="warning-item">
											<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
												<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
												<line x1="12" x2="12.01" y1="17" y2="17"/>
											</svg>
											{warn}
										</div>
									{/each}
								</div>
							</td>
						</tr>
					{/if}
				{/each}
				{#if hasMoreRows}
					<tr class="more-rows-row">
						<td colspan={columns.length}>
							<div class="more-rows-indicator">
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<polyline points="17 17 12 12 7 7"/>
									<polyline points="17 7 12 12 7 17"/>
								</svg>
								…and {displayRows.length - displayRowLimit} more row{displayRows.length - displayRowLimit > 1 ? 's' : ''}
							</div>
						</td>
					</tr>
				{/if}
			</tbody>
		</table>
	</div>

	<div class="preview-summary">
		<div class="summary-main">
			<strong>{validCount}</strong> of <strong>{totalCount}</strong> rows ready to import
			<span class="summary-sub">Total: {formatCurrency(validTotal)}</span>
		</div>
		<div class="summary-hint">
			{summaryHint}
		</div>
	</div>

	<div class="preview-actions">
		<button
			class="btn-confirm"
			onclick={onConfirm}
			disabled={validCount === 0}
			type="submit"
		>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="20 6 9 17 4 12"/>
			</svg>
			{confirmText}
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
		flex-wrap: wrap;
		gap: var(--space-sm);
	}

	.preview-title h3 {
		font-family: var(--font-display);
		font-size: var(--font-size-base);
		font-weight: var(--font-weight-bold);
		color: var(--color-ink);
		margin: 0;
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.preview-chips {
		display: flex;
		gap: var(--space-sm);
		flex-wrap: wrap;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 4px 10px;
		border-radius: var(--radius-pill);
		font-size: var(--font-size-xs);
		font-weight: 700;
		font-family: var(--font-display);
		font-variant-numeric: tabular-nums;
	}

	.chip-teal {
		background: var(--color-teal-bg);
		color: var(--color-teal);
		border: 1px solid rgba(43, 168, 162, 0.2);
	}

	.chip-coral {
		background: rgba(239, 108, 74, 0.08);
		color: var(--color-coral);
		border: 1px solid rgba(239, 108, 74, 0.2);
	}

	.chip-sky {
		background: rgba(93, 173, 226, 0.08);
		color: var(--color-sky);
		border: 1px solid rgba(93, 173, 226, 0.2);
	}

	.unknown-categories-banner {
		display: flex;
		align-items: flex-start;
		gap: var(--space-sm);
		padding: var(--space-md) var(--space-lg);
		background: rgba(239, 108, 74, 0.06);
		border-bottom: 1px solid rgba(239, 108, 74, 0.12);
		color: var(--color-coral);
		font-size: var(--font-size-sm);
		line-height: 1.5;
	}

	.unknown-categories-banner svg {
		flex-shrink: 0;
		margin-top: 2px;
	}

	.unknown-categories-banner a {
		color: var(--color-coral);
		text-decoration: underline;
		font-weight: 600;
	}

	.unknown-categories-banner small {
		color: var(--color-text-muted);
	}

	.new-names-banner {
		display: flex;
		align-items: flex-start;
		gap: var(--space-sm);
		padding: var(--space-md) var(--space-lg);
		background: var(--color-teal-bg);
		border-bottom: 1px solid var(--color-teal);
		color: var(--color-teal);
		font-size: var(--font-size-sm);
		line-height: 1.5;
	}

	.new-names-banner svg {
		flex-shrink: 0;
		margin-top: 2px;
	}

	.new-names-banner small {
		color: var(--color-text-muted);
	}

	.preview-table-wrap {
		overflow-x: auto;
		max-height: 480px;
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
		background: var(--color-surface-inset);
		z-index: 1;
	}

	.preview-table td {
		padding: var(--space-xs) var(--space-md);
		border-bottom: 1px solid var(--color-hairline);
		vertical-align: middle;
	}

	.preview-table tr:last-child td {
		border-bottom: none;
	}

	.status-cell {
		width: 36px;
		text-align: center;
	}

	.status-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		margin: 0 auto;
	}

	.status-valid {
		background: var(--color-teal);
		box-shadow: 0 0 8px var(--color-teal);
	}

	.status-invalid {
		background: var(--color-coral);
		box-shadow: 0 0 8px var(--color-coral);
	}

	.row-valid {
		background: var(--color-surface);
	}

	.row-invalid {
		background: rgba(239, 108, 74, 0.03);
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
		max-width: 220px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.cell-cat {
		font-size: var(--font-size-xs);
	}

	.cell-badge {
		text-align: center;
	}

	.badge {
		padding: 2px 10px;
		border-radius: var(--radius-pill);
		font-size: var(--font-size-xs);
		font-weight: 700;
		font-family: var(--font-display);
		display: inline-block;
	}

	.badge-active {
		background: var(--color-teal-bg);
		color: var(--color-teal);
	}

	.badge:not(.badge-active) {
		background: rgba(239, 108, 74, 0.10);
		color: var(--color-coral);
	}

	.type-chip {
		padding: 2px 8px;
		border-radius: var(--radius-pill);
		font-size: 10px;
		font-weight: 700;
		font-family: var(--font-display);
		display: inline-block;
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
	}

	.amount-income { color: var(--color-teal); }
	.amount-expense { color: var(--color-coral); }

	.error-row {
		background: rgba(239, 108, 74, 0.05);
	}

	.error-detail {
		padding: var(--space-sm) var(--space-md);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.error-item, .warning-item {
		display: flex;
		align-items: flex-start;
		gap: var(--space-xs);
		font-size: var(--font-size-xs);
		line-height: 1.4;
	}

	.error-item {
		color: var(--color-coral);
	}

	.warning-item {
		color: var(--color-gold);
	}

	.error-item svg, .warning-item svg {
		flex-shrink: 0;
		margin-top: 1px;
	}

	.more-rows-row {
		background: var(--color-surface-inset);
	}

	.more-rows-indicator {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-xs);
		padding: var(--space-md);
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
		font-style: italic;
	}

	.more-rows-indicator svg {
		color: var(--color-text-muted);
	}

	.preview-summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-md) var(--space-lg);
		border-top: 1px dashed var(--color-hairline);
		background: var(--color-surface-inset);
	}

	.summary-main {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.summary-main strong {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		font-size: var(--font-size-base);
		color: var(--color-ink);
	}

	.summary-sub {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	.summary-hint {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		font-style: italic;
		text-align: right;
		max-width: 300px;
	}

	.preview-actions {
		display: flex;
		gap: var(--space-sm);
		padding: var(--space-md) var(--space-lg);
		border-top: 1px solid var(--color-hairline);
		background: var(--color-surface-inset);
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

	.btn-confirm:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 6px 24px rgba(255, 210, 63, 0.55);
	}

	.btn-confirm:active:not(:disabled) {
		transform: scale(0.97);
	}

	.btn-confirm:disabled {
		opacity: 0.4;
		cursor: not-allowed;
		box-shadow: none;
		transform: none;
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

	@media (max-width: 640px) {
		.preview-table th:nth-child(2),
		.preview-table td:nth-child(2) {
			display: none;
		}
		.preview-summary {
			flex-direction: column;
			align-items: flex-start;
			gap: var(--space-xs);
		}
		.summary-hint {
			text-align: left;
			max-width: none;
		}
		.preview-actions {
			flex-direction: column;
		}
	}
</style>
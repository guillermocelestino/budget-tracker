<script lang="ts">
	let {
		columns = [],
		mapping = {} as Record<string, string>,
		onChange,
	}: {
		columns: string[];
		mapping?: Record<string, string>;
		onChange?: (col: string, field: string) => void;
	} = $props();

	const fieldOptions = [
		{ value: 'skip', label: '— Skip column —' },
		{ value: 'date', label: '📅 Date' },
		{ value: 'description', label: '📝 Description' },
		{ value: 'amount', label: '💰 Amount' },
		{ value: 'type', label: '🔀 Type (income/expense)' },
		{ value: 'category_name', label: '📁 Category Name' },
	];

	const requiredFields = ['amount', 'date'];
	const mappedValues = $derived(Object.values(mapping));
	const hasRequired = $derived(requiredFields.every(f => mappedValues.includes(f)));
</script>

<div class="import-mapping">
	<div class="mapping-header">
		<h3>Map Columns</h3>
		<p class="mapping-desc">Tell us which CSV column matches each field</p>
	</div>

	<div class="mapping-table">
		<div class="mapping-row header-row">
			<span class="mapping-col-name">CSV Column</span>
			<span class="mapping-col-preview">Sample Value</span>
			<span class="mapping-col-field">Maps To</span>
		</div>
		{#each columns as col}
			<div class="mapping-row">
				<span class="mapping-col-name">
					<span class="col-chip">{col}</span>
				</span>
				<span class="mapping-col-preview">
					<span class="sample-val">—</span>
				</span>
				<span class="mapping-col-field">
					<div class="select-wrap-sm">
						<select
							value={mapping[col] ?? 'skip'}
							onchange={(e) => onChange?.(col, (e.target as HTMLSelectElement).value)}
						>
							{#each fieldOptions as opt}
								<option value={opt.value} selected={(mapping[col] ?? 'skip') === opt.value}>
									{opt.label}
								</option>
							{/each}
						</select>
					</div>
				</span>
			</div>
		{/each}
	</div>

	{#if !hasRequired}
		<p class="mapping-warning">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
				<line x1="12" x2="12" y1="9" y2="13"/>
				<line x1="12" x2="12.01" y1="17" y2="17"/>
			</svg>
			Map the <strong>Amount</strong> and <strong>Date</strong> columns to continue
		</p>
	{/if}
</div>

<style>
	.import-mapping {
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-xl);
		padding: var(--space-lg);
		box-shadow: var(--shadow-card);
	}

	.mapping-header {
		margin-bottom: var(--space-lg);
	}

	.mapping-header h3 {
		font-family: var(--font-display);
		font-size: var(--font-size-base);
		font-weight: var(--font-weight-bold);
		color: var(--color-ink);
		margin: 0 0 4px;
	}

	.mapping-desc {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		margin: 0;
	}

	.mapping-table {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.mapping-row {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: var(--space-md);
		align-items: center;
		padding: var(--space-sm) var(--space-md);
		border-bottom: 1px dashed var(--color-hairline);
		min-height: 44px;
	}

	.mapping-row:last-child {
		border-bottom: none;
	}

	.header-row {
		font-size: var(--font-size-xs);
		font-weight: 700;
		color: var(--color-text-muted);
		font-family: var(--font-display);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		background: var(--color-teal-bg);
		border-radius: var(--radius-md);
		border-bottom: none;
	}

	.col-chip {
		display: inline-block;
		padding: 2px 10px;
		background: var(--color-cream);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-pill);
		font-family: var(--font-mono);
		font-size: var(--font-size-xs);
		font-weight: 600;
		color: var(--color-ink);
	}

	.sample-val {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		font-style: italic;
	}

	.select-wrap-sm {
		position: relative;
	}

	.select-wrap-sm select {
		width: 100%;
		padding: 6px 28px 6px 10px;
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-md);
		background: var(--color-cream);
		color: var(--color-ink);
		font-family: var(--font-body);
		font-size: var(--font-size-xs);
		font-weight: 600;
		min-height: 36px;
		appearance: none;
		-webkit-appearance: none;
		cursor: pointer;
		transition: border-color 150ms var(--ease);
	}

	.select-wrap-sm select:focus {
		outline: none;
		border-color: var(--color-teal);
		box-shadow: var(--focus);
	}

	.select-wrap-sm::after {
		content: '';
		position: absolute;
		right: 10px;
		top: 50%;
		transform: translateY(-50%);
		width: 0;
		height: 0;
		border-left: 4px solid transparent;
		border-right: 4px solid transparent;
		border-top: 4px solid var(--color-text-muted);
		pointer-events: none;
	}

	.mapping-warning {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		margin: var(--space-md) 0 0;
		padding: var(--space-sm) var(--space-md);
		background: rgba(93, 173, 226, 0.08);
		border: 1px solid rgba(93, 173, 226, 0.2);
		border-radius: var(--radius-md);
		color: var(--color-sky);
		font-size: var(--font-size-xs);
		font-weight: 500;
	}

	.mapping-warning svg {
		flex-shrink: 0;
	}

	.mapping-warning strong {
		font-weight: 700;
	}

	@media (max-width: 640px) {
		.mapping-row {
			grid-template-columns: 1fr;
			gap: var(--space-xs);
		}

		.header-row {
			display: none;
		}
	}
</style>

<script lang="ts">
	import {
		DEFAULT_IMPORT_FIELDS,
		type ImportMappingConfig,
		type ImportFieldDef,
	} from '$lib/shared/utils/importValidation';

	let {
		columns = [],
		mapping = {} as Record<string, string>,
		onChange,
		config = { dateFormat: 'YYYY-MM-DD', typeRule: 'sign' } as ImportMappingConfig,
		onConfigChange,
		fields = DEFAULT_IMPORT_FIELDS,
		showTypeRule = true,
	}: {
		columns: string[];
		mapping?: Record<string, string>;
		onChange?: (col: string, field: string) => void;
		config?: ImportMappingConfig;
		onConfigChange?: (key: keyof ImportMappingConfig, value: string) => void;
		fields?: ImportFieldDef[];
		showTypeRule?: boolean;
	} = $props();

	// Schema-driven mapping targets — default reproduces the original
	// transactions field list exactly.
	const fieldOptions = $derived([
		{ value: 'skip', label: '— Skip column —' },
		...fields.map(f => ({ value: f.key, label: f.label })),
	]);

	const requiredFields = $derived(fields.filter(f => f.required).map(f => f.key));
	const requiredPlain = $derived(
		fields.filter(f => f.required).map(f => f.label.replace(/^\S+\s+/, ''))
	);
	const mappedValues = $derived(Object.values(mapping));
	const hasRequired = $derived(requiredFields.every(f => mappedValues.includes(f)));

	const dateFormats = [
		{ value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2026-07-15)' },
		{ value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (15/07/2026)' },
		{ value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (07/15/2026)' },
		{ value: 'DD-MM-YYYY', label: 'DD-MM-YYYY (15-07-2026)' },
		{ value: 'MMM DD, YYYY', label: 'MMM DD, YYYY (Jul 15, 2026)' },
		{ value: 'DD MMM YYYY', label: 'DD MMM YYYY (15 Jul 2026)' },
		{ value: 'YYYY/MM/DD', label: 'YYYY/MM/DD (2026/07/15)' },
	];

	const typeRules = [
		{ value: 'sign', label: 'Amount sign: negative = expense, positive = income (default)' },
		{ value: 'column', label: 'Use the mapped Type column (income/credit/+ → income)' },
		{ value: 'debit_credit', label: 'Bank debit/credit columns (credit → income)' },
	];
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
		{#each columns as col (col)}
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
							{#each fieldOptions as opt (opt.value)}
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

	<div class="mapping-options">
		<fieldset class="option-group">
			<legend>Date Format</legend>
			<div class="select-wrap">
				<select value={config.dateFormat} onchange={(e) => onConfigChange?.('dateFormat', (e.target as HTMLSelectElement).value)}>
					{#each dateFormats as fmt (fmt.value)}
						<option value={fmt.value} selected={config.dateFormat === fmt.value}>{fmt.label}</option>
					{/each}
				</select>
			</div>
			<p class="option-hint">How dates are formatted in your CSV</p>
		</fieldset>

		{#if showTypeRule}
			<fieldset class="option-group">
				<legend>Type Rule</legend>
				<div class="select-wrap">
					<select value={config.typeRule} onchange={(e) => onConfigChange?.('typeRule', (e.target as HTMLSelectElement).value)}>
						{#each typeRules as rule (rule.value)}
							<option value={rule.value} selected={config.typeRule === rule.value}>{rule.label}</option>
						{/each}
					</select>
				</div>
				<p class="option-hint">How to determine income vs expense from the amount</p>
			</fieldset>
		{/if}
	</div>

	{#if !hasRequired}
		<p class="mapping-warning">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
				<line x1="12" x2="12" y1="9" y2="13"/>
				<line x1="12" x2="12.01" y1="17" y2="17"/>
			</svg>
			Map the <strong>{requiredPlain.join(' and ')}</strong> columns to continue
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
		background: var(--color-surface-inset);
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

	.select-wrap-sm,
	.select-wrap {
		position: relative;
	}

	.select-wrap-sm select,
	.select-wrap select {
		width: 100%;
		padding: 6px 28px 6px 10px;
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-md);
		background: var(--color-surface-inset);
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

	.select-wrap select {
		font-size: var(--font-size-sm);
		padding: 8px 32px 8px 12px;
		min-height: 44px;
	}

	.select-wrap-sm select:focus,
	.select-wrap select:focus {
		outline: none;
		border-color: var(--color-teal);
		box-shadow: var(--focus);
	}

	.select-wrap-sm::after,
	.select-wrap::after {
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

	.mapping-options {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-md);
		margin-top: var(--space-lg);
		padding-top: var(--space-lg);
		border-top: 1px dashed var(--color-hairline);
	}

	.option-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.option-group legend {
		font-size: var(--font-size-xs);
		font-weight: 700;
		color: var(--color-text-muted);
		font-family: var(--font-display);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 2px;
	}

	.option-hint {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		margin: 0;
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

		.mapping-options {
			grid-template-columns: 1fr;
		}
	}
</style>
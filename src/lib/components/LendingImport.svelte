<script lang="ts">
	import { enhance } from '$app/forms';
	import SlideOver from './SlideOver.svelte';
	import ImportDropZone from './ImportDropZone.svelte';
	import ImportMapping from './ImportMapping.svelte';
	import ImportPreview from './ImportPreview.svelte';
	import ConfettiBurst from './ConfettiBurst.svelte';
	import { showSuccess, showError } from '$lib/stores/toast.svelte';
	import {
		LENDING_IMPORT_FIELDS,
		buildMappedLendingRows,
		validateAllLendingRows,
		type MappedLendingRow,
	} from '$lib/utils/lendingImport';
	import {
		parseCSV,
		autoMap,
		type ImportMappingConfig,
		type ImportPreviewColumn,
		type ImportValidationResult,
	} from '$lib/utils/importValidation';

	let {
		open = false,
		onClose,
		existingPeople = [] as string[],
		direction = 'lent',
		title = 'Import Lendings',
		noun = 'Lendings',
		sampleHref = '/lending-sample.csv',
		sampleFilename = 'lending-sample.csv',
	}: {
		open?: boolean;
		onClose?: () => void;
		existingPeople?: string[];
		direction?: 'lent' | 'borrowed';
		title?: string;
		noun?: string;
		sampleHref?: string;
		sampleFilename?: string;
	} = $props();

	type WizardStep = 'upload' | 'mapping' | 'preview' | 'done';

	let importStep = $state<WizardStep>('upload');
	let importColumns = $state<string[]>([]);
	let importRawRows = $state<string[][]>([]);
	let importMapping = $state<Record<string, string>>({});
	let importConfig = $state<ImportMappingConfig>({
		dateFormat: 'YYYY-MM-DD',
		typeRule: 'sign',
	});
	let importMappedRows = $state<MappedLendingRow[]>([]);
	let importValidation = $state<ImportValidationResult<MappedLendingRow>>({
		validRows: [],
		invalidRows: [],
		unknownCategories: [],
		newNames: [],
	});
	let importResult = $state<{ imported?: number; total?: number; skippedDuplicates?: number; skippedInvalid?: number; newPeople?: string[] } | null>(null);
	let importError = $state('');
	let importSubmitting = $state(false);

	// Match the app's own label convention (LendingForm): "Date Lent" for lent,
	// "Date Borrowed" for borrowed.
	const previewColumns = $derived<ImportPreviewColumn[]>([
		{ header: 'Status', key: '_status', kind: 'status' },
		{ header: 'Person', key: 'person_name', kind: 'text', cls: 'cell-desc' },
		{ header: 'Amount', key: 'amount', kind: 'amount', align: 'right' },
		{ header: direction === 'borrowed' ? 'Date Borrowed' : 'Date Lent', key: 'date_lent', kind: 'date' },
		{ header: 'Due Date', key: 'due_date', kind: 'date' },
	]);

	// ─── Handle file upload ───
	function handleFileUpload(file: File) {
		const reader = new FileReader();
		reader.onload = (e) => {
			const text = e.target?.result as string;
			const parsed = parseCSV(text);
			if (parsed.headers.length < 2) {
				importError = 'CSV must have at least a header row and one data row';
				return;
			}
			importColumns = parsed.headers;
			importRawRows = parsed.rows;
			importMapping = autoMap(parsed.headers, LENDING_IMPORT_FIELDS);
			importError = '';
			importStep = 'mapping';
		};
		reader.readAsText(file);
	}

	function handleMappingChange(col: string, field: string) {
		importMapping = { ...importMapping, [col]: field };
	}

	function handleConfigChange(key: keyof ImportMappingConfig, value: string) {
		importConfig = { ...importConfig, [key]: value };
	}

	// ─── Go to preview ───
	function goToPreview() {
		const built = buildMappedLendingRows(importRawRows, importColumns, importMapping, importConfig);
		const v = validateAllLendingRows(built, existingPeople, importConfig);
		importValidation = {
			validRows: v.validRows,
			invalidRows: v.invalidRows,
			unknownCategories: [],
			newNames: v.newPeople,
		};
		importMappedRows = built;
		importStep = 'preview';
	}

	// ─── Handle form submission result ───
	function handleImportEnhance() {
		return async ({ result, update }: { result: { type: string; data?: Record<string, unknown> }; update: () => Promise<void> }) => {
			await update();
			if (result.type === 'success') {
				const d = result.data || {};
				importResult = {
					imported: d.imported as number,
					total: d.total as number,
					skippedDuplicates: d.skippedDuplicates as number,
					skippedInvalid: d.skippedInvalid as number,
					newPeople: d.newPeople as string[] | undefined,
				};
				importStep = 'done';
				importSubmitting = false;
				const count = d.imported as number || 0;
				if (count > 0) {
					showSuccess(`Imported ${count} ${noun.toLowerCase()}` + (d.skippedDuplicates ? ` · skipped ${d.skippedDuplicates} duplicates` : ''));
				} else {
					showError('Nothing new to import');
				}
			} else if (result.type === 'failure') {
				importSubmitting = false;
				const d = result.data as { error?: string; details?: string[] } | undefined;
				importError = d?.error || 'Import failed';
				if (d?.details) {
					importError += ': ' + d.details.slice(0, 3).join('; ');
				}
			}
		};
	}
</script>

{#if open}
	<SlideOver isOpen={open} onClose={onClose} title={title}>
		{#snippet children()}
			{#if importStep === 'upload'}
				<ImportDropZone
					onFiles={handleFileUpload}
					onDownloadSample={() => window.open(sampleHref, '_blank')}
					{sampleHref}
					{sampleFilename}
				/>
				{#if importError}
					<div class="import-error">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/>
						</svg>
						{importError}
					</div>
				{/if}
			{/if}

			{#if importStep === 'mapping'}
				<div class="step-indicator">
					<span class="step-dot active"></span>
					<span class="step-dot active"></span>
					<span class="step-dot"></span>
					<span class="step-label">Step 2 of 3 — Map your columns</span>
				</div>
				<ImportMapping
					columns={importColumns}
					mapping={importMapping}
					onChange={handleMappingChange}
					config={importConfig}
					onConfigChange={handleConfigChange}
					fields={LENDING_IMPORT_FIELDS}
					showTypeRule={false}
				/>
				{#if importError}
					<div class="import-error">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/>
						</svg>
						{importError}
					</div>
				{/if}
				<div class="step-actions">
					<button
						class="btn-next"
						onclick={goToPreview}
						disabled={!Object.values(importMapping).includes('amount') || !Object.values(importMapping).includes('person_name') || !Object.values(importMapping).includes('date_lent')}
						type="button"
					>
						Preview {noun} →
					</button>
					<button class="btn-back" onclick={() => (importStep = 'upload')} type="button">← Back</button>
				</div>
			{/if}

			{#if importStep === 'preview'}
				<div class="step-indicator">
					<span class="step-dot active"></span>
					<span class="step-dot active"></span>
					<span class="step-dot active"></span>
					<span class="step-label">Step 3 of 3 — Review & Confirm</span>
				</div>
				<form method="POST" action="?/import" use:enhance={handleImportEnhance}>
					<input type="hidden" name="rows" value={JSON.stringify(importValidation.validRows)} />
					<input type="hidden" name="config" value={JSON.stringify(importConfig)} />
					<ImportPreview
						rows={importMappedRows}
						validation={importValidation}
						onConfirm={() => { importSubmitting = true; }}
						onCancel={() => (importStep = 'mapping')}
						columns={previewColumns}
						confirmLabel={'Import {n} ' + noun}
						summaryHint="Invalid rows will be skipped. Fix your CSV, then re-import."
						unknownTitle="People not found in your records:"
						unknownHint="These will be created automatically when you import."
						newNamesTitle="New people — will be created:"
						newNamesHint="They are added automatically on import."
					/>
				</form>
				{#if importError}
					<div class="import-error">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/>
						</svg>
						{importError}
					</div>
				{/if}
			{/if}

			{#if importStep === 'done' && importResult}
				<div class="import-done">
					<ConfettiBurst active={(importResult.imported ?? 0) > 0} />
					<div class="done-icon">
						<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
							<polyline points="22 4 12 14.01 9 11.01"/>
						</svg>
					</div>
					<h2 class="done-title">Import Complete</h2>
					<p class="done-desc">
						Successfully imported <strong>{importResult.imported}</strong> of <strong>{importResult.total}</strong> {noun.toLowerCase()}
						{#if importResult.skippedDuplicates && importResult.skippedDuplicates > 0}
							· skipped <strong>{importResult.skippedDuplicates}</strong> duplicates
						{/if}
						{#if importResult.skippedInvalid && importResult.skippedInvalid > 0}
							· skipped <strong>{importResult.skippedInvalid}</strong> invalid
						{/if}
					</p>
					<div class="done-actions">
						<button class="btn-primary" onclick={() => { onClose?.(); importStep = 'upload'; importError = ''; importResult = null; }} type="button">
							Done
						</button>
						<button class="btn-secondary" onclick={() => { importStep = 'upload'; importError = ''; importResult = null; }} type="button">
							Import Another File
						</button>
					</div>
				</div>
			{/if}
		{/snippet}
	</SlideOver>
{/if}

<style>
	.step-indicator {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: var(--space-md);
	}

	.step-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color-hairline);
	}

	.step-dot.active {
		background: var(--color-teal);
		box-shadow: var(--glow-card);
	}

	.step-label {
		margin-left: auto;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}

	.step-actions {
		display: flex;
		gap: var(--space-sm);
		margin-top: var(--space-lg);
	}

	.btn-next {
		flex: 1;
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

	.btn-next:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 6px 24px rgba(255, 210, 63, 0.55);
	}

	.btn-next:active:not(:disabled) {
		transform: scale(0.97);
	}

	.btn-next:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		box-shadow: none;
	}

	.btn-back {
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

	.btn-back:hover {
		background: var(--color-teal-bg);
		border-color: var(--color-teal);
		color: var(--color-teal);
	}

	.import-error {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		margin-top: var(--space-md);
		padding: var(--space-sm) var(--space-md);
		background: rgba(239, 108, 74, 0.08);
		border: 1px solid rgba(239, 108, 74, 0.2);
		border-radius: var(--radius-md);
		color: var(--color-coral);
		font-size: var(--font-size-sm);
		font-weight: 500;
	}

	.import-done {
		position: relative;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--space-3xl) var(--space-xl);
		text-align: center;
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-left: 4px solid var(--color-teal);
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-card);
		animation: bounce-in 500ms var(--bounce) both;
	}

	.done-icon {
		width: 80px;
		height: 80px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-teal-bg);
		color: var(--color-teal);
		border-radius: var(--radius-lg);
		margin-bottom: var(--space-lg);
		box-shadow: var(--glow-card);
		animation: glow-pulse 2s ease-in-out infinite;
	}

	.done-title {
		font-family: var(--font-display);
		font-size: var(--font-size-xl);
		font-weight: var(--font-weight-extrabold);
		color: var(--color-ink);
		margin: 0 0 var(--space-sm);
	}

	.done-desc {
		font-size: var(--font-size-base);
		color: var(--color-text-muted);
		margin: 0 0 var(--space-lg);
	}

	.done-desc strong {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		color: var(--color-ink);
	}

	.done-actions {
		display: flex;
		gap: var(--space-md);
	}

	.btn-primary {
		display: inline-flex;
		align-items: center;
		padding: var(--space-sm) var(--space-xl);
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

	.btn-secondary {
		padding: var(--space-sm) var(--space-xl);
		background: var(--color-bg);
		color: var(--color-text-muted);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-pill);
		font-family: var(--font-body);
		font-size: var(--font-size-base);
		font-weight: 600;
		cursor: pointer;
		min-height: 48px;
		transition: all 150ms var(--ease);
	}

	.btn-secondary:hover {
		background: var(--color-teal-bg);
		border-color: var(--color-teal);
		color: var(--color-teal);
	}

	@media (max-width: 640px) {
		.done-actions {
			flex-direction: column;
			width: 100%;
		}

		.step-actions {
			flex-direction: column;
		}
	}
</style>
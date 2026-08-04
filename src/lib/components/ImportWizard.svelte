<script lang="ts">
	import { enhance } from '$app/forms';
	import ModalDialog from './ModalDialog.svelte';
	import ImportDropZone from './ImportDropZone.svelte';
	import ImportPreview from './ImportPreview.svelte';
	import ConfettiBurst from './ConfettiBurst.svelte';
	import { showSuccess, showError } from '$lib/stores/toast.svelte';
	import { parseImportFile } from '$lib/utils/fileImport';
	import {
		autoMap,
		type ImportMappingConfig,
		type ImportPreviewColumn,
		type ImportValidationResult,
		type ImportFieldDef,
	} from '$lib/utils/importValidation';

	type GenericMappedRow = Record<string, unknown>;

	let {
		open = false,
		onClose,
		// Domain-specific props (passed by the route)
		fields = [] as ImportFieldDef[],
		columns = [] as ImportPreviewColumn[],
		buildRows: buildRowsFn,
		validateRows: validateRowsFn,
		deps = {} as Record<string, unknown>,
		title = 'Import',
		noun = 'rows',
		sampleHref = '/sample-transactions.csv',
		sampleFilename = 'sample-transactions.csv',
		templateHref,
		templateFilename,
		direction,
	}: {
		open?: boolean;
		onClose?: () => void;
		fields?: ImportFieldDef[];
		columns?: ImportPreviewColumn[];
		buildRows: (rawRows: string[][], headers: string[], mapping: Record<string, string>, config: ImportMappingConfig) => GenericMappedRow[];
		validateRows: (rows: GenericMappedRow[], deps: Record<string, unknown>, config: ImportMappingConfig) => ImportValidationResult<GenericMappedRow>;
		deps?: Record<string, unknown>;
		title?: string;
		noun?: string;
		sampleHref?: string;
		sampleFilename?: string;
		templateHref?: string;
		templateFilename?: string;
		direction?: 'lent' | 'borrowed';
	} = $props();

	type WizardStep = 'upload' | 'preview' | 'done';

	let step = $state<WizardStep>('upload');
	let file = $state<File | null>(null);
	let fileName = $state('');
	let headers = $state<string[]>([]);
	let rawRows = $state<string[][]>([]);
	let mapping = $state<Record<string, string>>({});
	let config = $state<ImportMappingConfig>({
		dateFormat: 'YYYY-MM-DD',
		typeRule: 'sign',
	});
	let mappedRows = $state<GenericMappedRow[]>([]);
	let validation = $state<ImportValidationResult<GenericMappedRow>>({
		validRows: [],
		invalidRows: [],
		unknownCategories: [],
		newNames: [],
	});
	let result = $state<{ imported?: number; total?: number; skippedDuplicates?: number; skippedInvalid?: number; newPeople?: string[] } | null>(null);
	let error = $state('');
	let isParsing = $state(false);
	let isSubmitting = $state(false);

	const requiredFields = $derived(fields.filter(f => f.required).map(f => f.key));
	const requiredUnmapped = $derived(
		requiredFields.filter(key => !Object.values(mapping).includes(key))
	);
	const canPreview = $derived(requiredUnmapped.length === 0 && Object.keys(mapping).length > 0);

	// ─── Handle file upload ───
	async function handleFileUpload(uploadedFile: File) {
		isParsing = true;
		error = '';

		try {
			const parsed = await parseImportFile(uploadedFile);

			if (parsed.headers.length < 2) {
				error = 'File must have at least a header row and one data row';
				isParsing = false;
				return;
			}

			file = uploadedFile;
			fileName = uploadedFile.name;
			headers = parsed.headers;
			rawRows = parsed.rows;
			mapping = autoMap(parsed.headers, fields);
			goToPreview(); // Build mapped rows and validate
		} catch (e) {
			error = `Failed to parse file: ${(e as Error).message}`;
		} finally {
			isParsing = false;
		}
	}

	// ─── Go to preview (validate rows) ───
	function goToPreview() {
		if (!canPreview) return;

		try {
			const built = buildRowsFn(rawRows, headers, mapping, config);
			const v = validateRowsFn(built, deps, config);
			mappedRows = built;
			validation = v;
			step = 'preview';
		} catch (e) {
			error = `Validation error: ${(e as Error).message}`;
		}
	}

	// ─── Handle config change ───
	function handleConfigChange(key: keyof ImportMappingConfig, value: string) {
		config = { ...config, [key]: value };
		// Re-validate if we're already in preview
		if (step === 'preview') {
			goToPreview();
		}
	}

	// ─── Handle form submission ───
	// The outer submit handler runs BEFORE SvelteKit sends the request
	// (it awaits this function, then fetches with the same FormData). So we
	// append the stored File here — the only place the file reaches the server.
	// No hidden <input type="file"> is needed in the DOM.
	function handleImportEnhance({ formData }: { formData: FormData }) {
		if (file) {
			formData.append('file', file);
		}

		return async ({ result: actionResult, update }: { result: { type: string; data?: Record<string, unknown> }; update: () => Promise<void> }) => {
			await update();
			isSubmitting = false;
			if (actionResult.type === 'success') {
				const d = actionResult.data || {};
				result = {
					imported: d.imported as number,
					total: d.total as number,
					skippedDuplicates: d.skippedDuplicates as number,
					skippedInvalid: d.skippedInvalid as number,
					newPeople: d.newPeople as string[] | undefined,
				};
				step = 'done';
				const count = d.imported as number || 0;
				if (count > 0) {
					let msg = `Imported ${count} ${noun.toLowerCase()}`;
					if (d.skippedDuplicates) msg += ` · skipped ${d.skippedDuplicates} duplicates`;
					if (d.skippedInvalid) msg += ` · skipped ${d.skippedInvalid} invalid`;
					if (d.newPeople && (d.newPeople as string[]).length) msg += ` · ${(d.newPeople as string[]).length} new ${direction === 'borrowed' ? 'lenders' : 'people'} created`;
					showSuccess(msg);
				} else {
					showError('Nothing new to import');
				}
			} else if (actionResult.type === 'failure') {
				const d = actionResult.data as { error?: string; details?: string[] } | undefined;
				error = d?.error || 'Import failed';
				if (d?.details) {
					error += ': ' + d.details.slice(0, 3).join('; ');
				}
			}
		};
	}

	// ─── Reset wizard ───
	function resetWizard() {
		step = 'upload';
		file = null;
		fileName = '';
		headers = [];
		rawRows = [];
		mapping = {};
		config = { dateFormat: 'YYYY-MM-DD', typeRule: 'sign' };
		mappedRows = [];
		validation = { validRows: [], invalidRows: [], unknownCategories: [], newNames: [] };
		result = null;
		error = '';
		isParsing = false;
		isSubmitting = false;
	}
</script>

{#if open}
	<ModalDialog {open} title={title} onclose={onClose} size="wide">
		{#snippet children()}
			{#if step === 'upload'}
				<ImportDropZone
					onFiles={handleFileUpload}
					onDownloadSample={() => window.open(sampleHref, '_blank')}
					{sampleHref}
					{sampleFilename}
					{templateHref}
					{templateFilename}
				/>
				{#if error}
					<div class="import-error">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/>
						</svg>
						{error}
					</div>
				{/if}
				{#if isParsing}
					<div class="parsing-indicator">
						<svg class="spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
							<path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"/>
						</svg>
						<p>Parsing {fileName}…</p>
					</div>
				{/if}
			{/if}

			{#if step === 'preview'}
				<div class="step-indicator">
					<span class="step-dot active"></span>
					<span class="step-dot active"></span>
					<span class="step-dot active"></span>
					<span class="step-label">Step 2 of 2 — Review & Confirm</span>
				</div>
				<form method="POST" action="?/import" use:enhance={handleImportEnhance} enctype="multipart/form-data">
					<input type="hidden" name="config" value={JSON.stringify(config)} />
					<ImportPreview
						rows={mappedRows}
						validation={validation}
						onConfirm={() => { isSubmitting = true; }}
						onCancel={() => { step = 'upload'; resetWizard(); onClose?.(); }}
						columns={columns}
						confirmLabel={'Import {n} ' + noun}
						summaryHint="Invalid rows will be skipped. Fix your file, then re-import."
						unknownTitle="Categories not found in your records:"
						unknownHint="Add these in Categories or fix the file, then re-import."
						newNamesTitle="New people — will be created:"
						newNamesHint="They are added automatically on import."
						limit={15}
					/>
				</form>
				{#if error}
					<div class="import-error">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/>
						</svg>
						{error}
					</div>
				{/if}
			{/if}

			{#if step === 'done' && result}
				<div class="import-done">
					<ConfettiBurst active={(result.imported ?? 0) > 0} />
					<div class="done-icon">
						<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
							<polyline points="22 4 12 14.01 9 11.01"/>
						</svg>
					</div>
					<h2 class="done-title">Import Complete</h2>
					<p class="done-desc">
						Successfully imported <strong>{result.imported}</strong> of <strong>{result.total}</strong> {noun.toLowerCase()}
						{#if result.skippedDuplicates && result.skippedDuplicates > 0}
							· skipped <strong>{result.skippedDuplicates}</strong> duplicates
						{/if}
						{#if result.skippedInvalid && result.skippedInvalid > 0}
							· skipped <strong>{result.skippedInvalid}</strong> invalid
						{/if}
						{#if result.newPeople && result.newPeople.length > 0}
							· <strong>{result.newPeople.length}</strong> new {direction === 'borrowed' ? 'lenders' : 'people'} created
						{/if}
					</p>
					<div class="done-actions">
						<button class="btn-primary" onclick={() => { onClose?.(); resetWizard(); }} type="button">
							Done
						</button>
						<button class="btn-secondary" onclick={resetWizard} type="button">
							Import Another File
						</button>
					</div>
				</div>
			{/if}
		{/snippet}
	</ModalDialog>
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

	.parsing-indicator {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-sm);
		margin-top: var(--space-lg);
		padding: var(--space-lg);
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
	}

	.spinner {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
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

	.btn-primary:hover {
		transform: translateY(-1px);
		box-shadow: 0 6px 24px rgba(255, 210, 63, 0.55);
	}

	.btn-primary:active {
		transform: scale(0.97);
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
	}
</style>
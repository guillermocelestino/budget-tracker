<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import PageBackground from '$lib/components/PageBackground.svelte';
	import ImportDropZone from '$lib/components/ImportDropZone.svelte';
	import ImportMapping from '$lib/components/ImportMapping.svelte';
	import ImportPreview from '$lib/components/ImportPreview.svelte';
	import { showSuccess } from '$lib/stores/toast.svelte';

	type WizardStep = 'upload' | 'mapping' | 'preview' | 'done';

	let step = $state<WizardStep>('upload');
	let columns = $state<string[]>([]);
	let rawRows = $state<string[][]>([]);
	let mapping = $state<Record<string, string>>({});
	let mappedRows = $state<{ date: string; description: string; amount: number; type: string; category_name: string }[]>([]);
	let importResult = $state<{ imported?: number; total?: number } | null>(null);
	let importError = $state('');

	// ─── Simple CSV parser that handles quoted values ───

	function parseCSV(text: string): { headers: string[]; rows: string[][] } {
		const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
		if (lines.length < 2) return { headers: [], rows: [] };

		function parseLine(line: string): string[] {
			const result: string[] = [];
			let current = '';
			let inQuotes = false;
			for (let i = 0; i < line.length; i++) {
				const ch = line[i];
				if (ch === '"') {
					if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
						current += '"';
						i++;
					} else {
						inQuotes = !inQuotes;
					}
				} else if (ch === ',' && !inQuotes) {
					result.push(current.trim());
					current = '';
				} else {
					current += ch;
				}
			}
			result.push(current.trim());
			return result;
		}

		const headers = parseLine(lines[0]);
		const rows = lines.slice(1).map(parseLine);
		return { headers, rows };
	}

	// ─── Auto-map columns by name ───

	function autoMap(cols: string[]): Record<string, string> {
		const map: Record<string, string> = {};
		const lower = cols.map(c => c.toLowerCase().trim());
		const known: [string, string[]][] = [
			['date', ['date', 'fecha', 'datum', 'data']],
			['description', ['description', 'desc', 'description', 'name', 'notes', 'note', 'memo', 'payee', 'merchant']],
			['amount', ['amount', 'amt', 'value', 'sum', 'total', 'price', 'cost', 'number', 'num']],
			['type', ['type', 'kind', 'category type', 'transaction type', 'class']],
			['category_name', ['category', 'cat', 'category name', 'group', 'label', 'tags']],
		];

		for (const [field, aliases] of known) {
			for (let i = 0; i < lower.length; i++) {
				if (aliases.includes(lower[i]) && cols[i]) {
					map[cols[i]] = field;
					break;
				}
			}
		}
		return map;
	}

	// ─── Handle file upload ───

	function handleFile(file: File) {
		const reader = new FileReader();
		reader.onload = (e) => {
			const text = e.target?.result as string;
			const parsed = parseCSV(text);
			if (parsed.headers.length < 2) {
				importError = 'CSV must have at least a header row and one data row';
				return;
			}
			columns = parsed.headers;
			rawRows = parsed.rows;
			mapping = autoMap(parsed.headers);
			importError = '';
			step = 'mapping';
		};
		reader.readAsText(file);
	}

	// ─── Handle mapping change ───

	function handleMappingChange(col: string, field: string) {
		mapping = { ...mapping, [col]: field };
	}

	// ─── Build mapped rows for preview ───

	function buildMappedRows(): typeof mappedRows {
		const dateCol = columns.find(c => mapping[c] === 'date');
		const descCol = columns.find(c => mapping[c] === 'description');
		const amtCol = columns.find(c => mapping[c] === 'amount');
		const typeCol = columns.find(c => mapping[c] === 'type');
		const catCol = columns.find(c => mapping[c] === 'category_name');

		return rawRows.map(row => {
			const getVal = (col: string | undefined, fallback = '') =>
				col ? row[columns.indexOf(col)] ?? fallback : fallback;

			const rawDate = getVal(dateCol);
			const rawAmt = getVal(amtCol, '0');
			const rawType = getVal(typeCol).toLowerCase();

			// Parse date: try YYYY-MM-DD first, then various formats
			let date = rawDate;
			if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
				const d = new Date(rawDate);
				if (!isNaN(d.getTime())) {
					date = d.toISOString().slice(0, 10);
				}
			}

			// Parse amount: strip currency symbols
			const amount = Math.abs(parseFloat(rawAmt.replace(/[^0-9.\-]/g, ''))) || 0;

			// Determine type
			let type = 'expense';
			if (rawType === 'income' || rawType === 'in' || rawType === 'credit' || rawType === '+') {
				type = 'income';
			}

			return {
				date,
				description: getVal(descCol, 'Imported transaction'),
				amount,
				type,
				category_name: getVal(catCol, 'Other Expense'),
			};
		}).filter(r => r.amount > 0 && r.date);
	}

	// ─── Go to preview ───

	function goToPreview() {
		mappedRows = buildMappedRows();
		step = 'preview';
	}

	// ─── Confirm import ───

	let isSubmitting = $state(false);

	function handleEnhance() {
		return async ({ result, update }: { result: { type: string; data?: Record<string, unknown> }; update: () => Promise<void> }) => {
			await update();
			if (result.type === 'success') {
				const d = result.data || {};
				importResult = { imported: d.imported as number, total: d.total as number };
				step = 'done';
				const count = d.imported as number || 0;
				showSuccess(`Imported ${count} transactions successfully`);
			} else if (result.type === 'failure') {
				const d = result.data as { error?: string; details?: string[] } | undefined;
				importError = d?.error || 'Import failed';
				if (d?.details) {
					importError += ': ' + d.details.slice(0, 3).join('; ');
				}
			}
		};
	}
</script>

<svelte:head>
	<title>Import Transactions — Budget Tracker</title>
</svelte:head>

<PageHeader title="Import Transactions">
	{#snippet subtitle()}
		<span>Import transactions from a CSV file</span>
	{/snippet}
</PageHeader>

<PageBackground />

<div class="import-page">
	{#if step === 'done' && importResult}
		<div class="import-done">
			<div class="done-icon">
				<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
					<polyline points="22 4 12 14.01 9 11.01"/>
				</svg>
			</div>
			<h2 class="done-title">Import Complete</h2>
			<p class="done-desc">
				Successfully imported <strong>{importResult.imported}</strong> of <strong>{importResult.total}</strong> transactions
			</p>
			<div class="done-actions">
				<a href="/transactions" class="btn-primary">View Transactions</a>
				<button class="btn-secondary" onclick={() => { step = 'upload'; importError = ''; }} type="button">
					Import Another File
				</button>
			</div>
		</div>
	{/if}

	{#if step === 'upload'}
		<ImportDropZone onFiles={handleFile} />
		{#if importError}
			<div class="import-error">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/>
				</svg>
				{importError}
			</div>
		{/if}
		<div class="import-hint">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/>
			</svg>
			<span>Expected columns: Date, Amount, Description, Type, Category Name</span>
		</div>
	{/if}

	{#if step === 'mapping'}
		<div class="step-indicator">
			<span class="step-dot active"></span>
			<span class="step-dot active"></span>
			<span class="step-dot"></span>
			<span class="step-label">Step 2 of 3 — Map your columns</span>
		</div>
		<ImportMapping {columns} {mapping} onChange={handleMappingChange} />
		<div class="step-actions">
			<button
				class="btn-next"
				onclick={goToPreview}
				disabled={!Object.values(mapping).includes('amount') || !Object.values(mapping).includes('date')}
				type="button"
			>
				Preview Transactions →
			</button>
			<button class="btn-back" onclick={() => step = 'upload'} type="button">← Back</button>
		</div>
	{/if}

	{#if step === 'preview'}
		<div class="step-indicator">
			<span class="step-dot active"></span>
			<span class="step-dot active"></span>
			<span class="step-dot active"></span>
			<span class="step-label">Step 3 of 3 — Review & Confirm</span>
		</div>
		<form method="POST" action="?/import" use:enhance={handleEnhance}>
			<input type="hidden" name="rows" value={JSON.stringify(mappedRows)} />
			<ImportPreview
				rows={mappedRows}
				onConfirm={() => { isSubmitting = true; }}
				onCancel={() => step = 'mapping'}
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
</div>

<style>
	.import-page {
		max-width: 720px;
		margin: 0 auto;
	}

	/* ─── Step indicator ─── */
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

	/* ─── Error ─── */
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

	.import-error svg {
		flex-shrink: 0;
	}

	/* ─── Hint ─── */
	.import-hint {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		margin-top: var(--space-md);
		padding: var(--space-sm) var(--space-md);
		background: var(--color-teal-bg);
		border-radius: var(--radius-md);
		color: var(--color-teal);
		font-size: var(--font-size-xs);
		font-weight: 500;
	}

	.import-hint svg {
		flex-shrink: 0;
		opacity: 0.6;
	}

	/* ─── Step actions ─── */
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

	/* ─── Done state ─── */
	.import-done {
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
		text-decoration: none;
		min-height: 48px;
		box-shadow: var(--glow-gold);
		transition: all 200ms var(--bounce);
	}

	.btn-primary:hover {
		transform: translateY(-1px);
		text-decoration: none;
		color: var(--color-ink);
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
		.import-page {
			max-width: none;
		}

		.done-actions {
			flex-direction: column;
			width: 100%;
		}

		.step-actions {
			flex-direction: column;
		}
	}
</style>

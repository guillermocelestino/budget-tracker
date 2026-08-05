<script lang="ts">
	import { page } from '$app/stores';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import SlideOver from '$lib/components/SlideOver.svelte';
	import PageBackground from '$lib/components/PageBackground.svelte';
	import LendingForm from '$lib/components/LendingForm.svelte';
	import ModalDialog from '$lib/components/ModalDialog.svelte';
	import LendingBalanceHeader from '$lib/components/LendingBalanceHeader.svelte';
	import LendingSummaryCards from '$lib/components/LendingSummaryCards.svelte';
	import ActiveIouList from '$lib/components/ActiveIouList.svelte';
	import Button from '$lib/components/Button.svelte';
	import OverflowMenu from '$lib/components/OverflowMenu.svelte';
	import ViewToggle from '$lib/components/ViewToggle.svelte';
	import ListToolbar from '$lib/components/ListToolbar.svelte';
	import SearchFilterPill from '$lib/components/SearchFilterPill.svelte';
	import LendingFilters from '$lib/components/LendingFilters.svelte';
	import CountChip from '$lib/components/CountChip.svelte';
	import ImportWizard from '$lib/components/ImportWizard.svelte';
	import { showSuccess, showError } from '$lib/stores/toast.svelte';
	import { downloadCsv, lendingsToCSV } from '$lib/utils/csv';
	import { generateBorrowedPdf } from '$lib/utils/pdf';
	import { LENDING_IMPORT_FIELDS, buildMappedLendingRows, validateAllLendingRows, type MappedLendingRow } from '$lib/utils/lendingImport';
	import type { ImportPreviewColumn, ImportMappingConfig, ImportValidationResult } from '$lib/utils/importValidation';
	import type { Lending } from '$lib/types';

	let data = $derived($page.data as App.PageData);

	let showPanel = $state(false);
	let editingLending = $state<Lending | null>(null);
	let activeTab = $state<'all' | 'active' | 'paid'>('active');
	let viewMode = $state<'card' | 'table'>('card');
	let markPaidId = $state<number | null>(null);
	let recordAsTransaction = $state(true);
	let deleteId = $state<number | null>(null);
	let searchInput = $state('');
	let filtersOpen = $state(false);
	let importWizardOpen = $state(false);

	// Debounced search term — the SearchFilterPill binds the raw input; we
	// push it into `searchTerm` after a 250ms idle window (same as the old
	// LendingSearch debounce, so search behavior is unchanged).
	let searchTerm = $state('');
	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			if (searchTerm !== searchInput) searchTerm = searchInput;
		}, 250);
		return () => {
			if (searchTimer) clearTimeout(searchTimer);
		};
	});

	const activeLendings = $derived(data.activeLendings ?? []);
	const paidLendings = $derived(data.paidLendings ?? []);
	const totals = $derived(data.totals ?? { totalLent: 0, totalRecovered: 0, outstanding: 0 });
	const existingPeople = $derived(
		Array.from(new Set([...activeLendings, ...paidLendings].map(l => l.borrower_name)))
	);

	// Status is the only filter; 'active' is the default view, so the Filter
	// badge lights up only when the user changes away from the default.
	const activeFilterCount = $derived(activeTab !== 'active' ? 1 : 0);

	// Stage 1 — tab selection (status filter, untouched by search).
	const tabLendings: Lending[] = $derived(
		activeTab === 'all'
			? [...activeLendings, ...paidLendings]
			: activeTab === 'active'
				? activeLendings
				: paidLendings
	);

	// Stage 2 — client-side search narrowing against borrower (lender) + notes.
	// The hero/summary read from `totals` (sourced from `data.totals`), NOT
	// showLendings, so search can never change the headline balance.
	const showLendings: Lending[] = $derived.by(() => {
		const term = searchTerm.trim().toLowerCase();
		if (!term) return tabLendings;
		return tabLendings.filter(
			(l) =>
				l.borrower_name.toLowerCase().includes(term) ||
				(l.notes ?? '').toLowerCase().includes(term)
		);
	});

	function openAdd() {
		editingLending = null;
		showPanel = true;
	}

	// Open the New Borrowing panel when arriving via the global FAB (?add=1)
	$effect(() => {
		const params = new URLSearchParams($page.url.searchParams);
		if (params.get('add') === '1') {
			params.delete('add');
			const qs = params.toString();
			history.replaceState(history.state, '', `${$page.url.pathname}${qs ? '?' + qs : ''}`);
			openAdd();
		}
	});

	function openEdit(lending: Lending) {
		editingLending = lending;
		showPanel = true;
	}

	function closePanel() {
		showPanel = false;
		editingLending = null;
	}

	function handleExportCsv() {
		const csv = lendingsToCSV(showLendings, 'borrowed');
		downloadCsv(csv, `borrowed-${new Date().toISOString().split('T')[0]}.csv`);
	}

	async function handleExportPdf() {
		if (showLendings.length === 0) {
			showError('No borrowings to export');
			return;
		}
		try {
			const doc = await generateBorrowedPdf(showLendings);
			doc.save(`borrowed-${new Date().toISOString().split('T')[0]}.pdf`);
		} catch (e) {
			console.error('[Export] PDF generation failed:', e);
			showError('Failed to generate PDF');
		}
	}

	// Duplicate an entry: POST a copy of the source to the API, then re-run the
	// page load so the new row appears immediately (same UX as Transactions).
	// Status is preserved so the copy lands in the same tab the user is on.
	async function handleDuplicate(id: number) {
		const src = showLendings.find((l) => l.id === id);
		if (!src) return;
		try {
			const res = await fetch('/api/lendings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					borrower_name: src.borrower_name,
					amount: src.amount,
					interest_rate: src.interest_rate,
					date_lent: src.date_lent,
					due_date: src.due_date,
					notes: src.notes,
					direction: src.direction,
					status: src.status,
				}),
			});
			if (!res.ok) throw new Error(((await res.json()).error) || 'Duplicate failed');
			showSuccess('Borrowing duplicated');
			await invalidateAll();
		} catch (e) {
			showError((e as Error).message || 'Failed to duplicate borrowing');
		}
	}

	// ─── Import Wizard props ──────────────────────────────────────────
	// Preview columns for ImportPreview
	const previewColumns = $derived<ImportPreviewColumn[]>([
		{ header: 'Status', key: '_status', kind: 'status' },
		{ header: 'Lender', key: 'person_name', kind: 'text', cls: 'cell-desc' },
		{ header: 'Amount', key: 'amount', kind: 'amount', align: 'right' },
		{ header: 'Date Borrowed', key: 'date_lent', kind: 'date' },
		{ header: 'Due Date', key: 'due_date', kind: 'date' },
		{ header: 'Status', key: 'status', kind: 'badge' },
		{ header: 'Amount Repaid', key: 'recovered_amount', kind: 'amount', align: 'right' },
	]);

	// ImportWizard build/validate functions
	function buildRows(rawRows: string[][], headers: string[], mapping: Record<string, string>, config: ImportMappingConfig) {
		return buildMappedLendingRows(rawRows, headers, mapping, config);
	}

	function validateRows(rows: MappedLendingRow[], deps: Record<string, unknown>, config: ImportMappingConfig): ImportValidationResult<MappedLendingRow> {
		// Normalize the lending validator into the generic ImportValidationResult
		// shape the wizard/preview render from (unknownCategories + newNames).
		const result = validateAllLendingRows(rows, deps.existingPeople as string[], config);
		return {
			validRows: result.validRows,
			invalidRows: result.invalidRows,
			unknownCategories: [],
			newNames: result.newPeople,
		};
	}

	// Import wizard deps
	const importDeps = $derived({ existingPeople });
</script>

<svelte:head>
	<title>Borrowed — Finance Tracker</title>
</svelte:head>

<PageHeader title="Borrowed" flush borderless>
	{#snippet badge()}
		<CountChip count={activeLendings.length} suffix="active" />
	{/snippet}
	{#snippet subtitle()}
		<span class="context-subline">{activeLendings.length} active · {paidLendings.length} repaid</span>
	{/snippet}
	{#snippet action()}
		<div class="header-actions">
			<span class="desktop-only">
				<Button variant="primary" onclick={openAdd}>
					<span class="btn-lead" aria-hidden="true">+</span>
					New Borrowing
				</Button>
				<OverflowMenu
					onImportCsv={() => (importWizardOpen = true)}
					onExportCsv={handleExportCsv}
					onExportPdf={handleExportPdf}
				/>
			</span>
			<span class="mobile-only">
				<OverflowMenu
					onImportCsv={() => (importWizardOpen = true)}
					onExportCsv={handleExportCsv}
					onExportPdf={handleExportPdf}
				/>
			</span>
		</div>
	{/snippet}
</PageHeader>

<PageBackground />

<LendingBalanceHeader
	totalOwedToMe={0}
	totalIOwe={totals.outstanding}
	direction="borrowed"
/>

<LendingSummaryCards
	totalLent={totals.totalLent}
	totalRecovered={totals.totalRecovered}
	outstanding={totals.outstanding}
	direction="borrowed"
/>

<!-- ═══ Slide-over for Add / Edit ═══ -->
<SlideOver
	isOpen={showPanel}
	title={editingLending ? 'Edit Borrowing' : 'New Borrowing'}
	onClose={closePanel}
>
	<LendingForm
			lendingRecord={editingLending ?? undefined}
			onCancel={closePanel}
			onSuccess={closePanel}
			direction="borrowed"
		/>
</SlideOver>

<!-- ═══ Import Wizard Modal ═══ -->
<ImportWizard
	open={importWizardOpen}
	onClose={() => (importWizardOpen = false)}
	fields={LENDING_IMPORT_FIELDS}
	columns={previewColumns}
	buildRows={buildRows}
	validateRows={validateRows as unknown as (rows: Record<string, unknown>[], deps: Record<string, unknown>, config: ImportMappingConfig) => ImportValidationResult<Record<string, unknown>>}
	deps={importDeps}
	title="Import Borrowings"
	noun="borrowings"
	sampleHref="/borrowed-sample.csv"
	sampleFilename="borrowed-sample.csv"
	templateHref="/templates/borrowed.xlsx"
	templateFilename="borrowed-import-template.xlsx"
	direction="borrowed"
/>

<!-- ═══ ListToolbar: unified Search|Filter pill (left), view mode (right) ═══ -->
<ListToolbar>
	{#snippet filters()}
		<SearchFilterPill
			bind:value={searchInput}
			bind:open={filtersOpen}
			activeFilterCount={activeFilterCount}
			placeholder="Search borrower, lender, notes…"
			ariaLabel="Search borrowings"
			filterAriaLabel="Filter borrowings"
		>
			{#snippet panel(mode, close)}
				<LendingFilters
					status={activeTab}
					onStatusChange={(s) => (activeTab = s)}
					counts={{
						all: activeLendings.length + paidLendings.length,
						active: activeLendings.length,
						paid: paidLendings.length,
					}}
					paidLabel="Repaid"
					{mode}
					onApply={close}
				/>
			{/snippet}
		</SearchFilterPill>
	{/snippet}
	{#snippet views()}
		<ViewToggle
			options={[
				{ value: 'card', icon: 'grid', label: 'Grouped', ariaLabel: 'Card view' },
				{ value: 'table', icon: 'table', label: 'Table', ariaLabel: 'Table view' },
			]}
			value={viewMode}
			onSelect={(v) => (viewMode = v as 'card' | 'table')}
			ariaLabel="Borrowing list view"
			slidingThumb
			stretch
		/>
	{/snippet}
</ListToolbar>

<ActiveIouList
	ious={showLendings}
	onPay={(id) => markPaidId = id}
	onEdit={(id) => { const l = showLendings.find(l => l.id === id); if (l) openEdit(l); }}
	onDelete={(id) => deleteId = id}
	onDuplicate={handleDuplicate}
	direction="borrowed"
	viewMode={viewMode}
/>

<!-- ═══ Mark as Paid Modal ═══ -->
{#if markPaidId !== null}
	<ModalDialog open={markPaidId !== null} onclose={() => { markPaidId = null; recordAsTransaction = true; }} title="Record Repayment">
		<div class="modal-icon-wrap">
			<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="20 6 9 17 4 12"/>
			</svg>
		</div>
		<p class="modal-desc">Would you like to record this repayment as an expense?</p>
		<form method="POST" action="?/markPaid" use:enhance={() => {
			return async ({ result, update }: { result: { type: string; data?: { error?: string } }; update: () => Promise<void> }) => {
				await update();
				if (result.type === 'success') {
					markPaidId = null;
					showSuccess('Marked as repaid successfully');
				} else {
					showError((result.data as { error?: string } | undefined)?.error || 'Failed to update');
				}
			};
		}}>
			<input type="hidden" name="id" value={markPaidId} />
			<div class="radio-group">
				<label class="radio-option">
					<input type="radio" name="record_as_transaction" value="true" bind:group={recordAsTransaction} />
					<span class="radio-label">Yes, record as expense transaction</span>
					<span class="radio-desc">Creates an expense entry in Transactions (repaying debt = money out)</span>
				</label>
				<label class="radio-option">
					<input type="radio" name="record_as_transaction" value="false" bind:group={recordAsTransaction} />
					<span class="radio-label">No, just mark as repaid</span>
					<span class="radio-desc">No transaction created</span>
				</label>
			</div>
			<div class="modal-actions">
				<Button variant="teal" type="submit">Confirm</Button>
				<Button variant="ghost" type="button" onclick={() => { markPaidId = null; recordAsTransaction = true; }}>Cancel</Button>
			</div>
		</form>
	</ModalDialog>
{/if}

<!-- ═══ Delete Confirmation ═══ -->
{#if deleteId !== null}
	<ModalDialog open={deleteId !== null} onclose={() => deleteId = null} title="Delete Borrowing">
		<div class="modal-icon-wrap danger">
			<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="3 6 5 6 21 6"/>
				<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
			</svg>
		</div>
		<p>Are you sure you want to delete this borrowing record?</p>
		<form method="POST" action="?/delete" use:enhance={() => {
			return async ({ result, update }: { result: { type: string; data?: { error?: string } }; update: () => Promise<void> }) => {
				await update();
				if (result.type === 'success') {
					deleteId = null;
					showSuccess('Borrowing deleted');
				} else {
					showError((result.data as { error?: string } | undefined)?.error || 'Failed to delete');
				}
			};
		}}>
			<input type="hidden" name="id" value={deleteId} />
			<div class="modal-actions">
				<Button variant="danger" type="submit">Delete</Button>
				<Button variant="ghost" type="button" onclick={() => deleteId = null}>Cancel</Button>
			</div>
		</form>
	</ModalDialog>
{/if}

<style>
	/* Raise the header's stacking context so the OverflowMenu dropdown
	   (trapped inside the header's backdrop-filter context) paints above
	   the content that follows it. Matches /transactions. */
	:global(.page-header) {
		position: relative;
		z-index: 30;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		flex-wrap: wrap;
		min-width: 0;
	}

	.btn-lead {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 18px;
		height: 18px;
		font-weight: var(--font-weight-extrabold);
	}

	/* ─── Context subline (header) ─── */
	.context-subline {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		font-size: var(--font-size-xs);
		letter-spacing: 0.02em;
		color: var(--muted);
	}

	/* ─── Mobile / Desktop visibility (matches /transactions + /lending) ─── */
	.desktop-only {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.mobile-only {
		display: none;
	}

	.modal-icon-wrap {
		width: 64px;
		height: 64px;
		margin: 0 auto var(--space-md);
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-income-light);
		color: var(--color-income);
		border-radius: var(--radius-lg);
	}

	.modal-icon-wrap.danger {
		background: var(--color-expense-light);
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
		border-color: var(--color-teal);
		background: var(--color-teal-bg);
	}

	.radio-option input {
		accent-color: var(--color-teal);
	}

	.radio-label {
		font-weight: 600;
		font-size: var(--font-size-sm);
	}

	.radio-desc {
		font-size: var(--font-size-xs);
		color: var(--color-text-secondary);
	}

	.modal-actions {
		display: flex;
		gap: var(--space-sm);
		margin-top: var(--space-lg);
	}

	.modal-actions :global(.btn) {
		flex: 1;
	}

	@media (max-width: 768px) {
		.desktop-only {
			display: none !important;
		}

		.mobile-only {
			display: flex;
			align-items: center;
		}
	}

	/* ─── Mobile toolbar rhythm — match /transactions (≤767px) ───
	   One compact band: unified Search|Filter pill, then the single ViewToggle
	   left-anchored below it, directly above the list. */
	@media (max-width: 767px) {
		:global(main.main-content .list-toolbar) {
			margin-top: var(--space-md);
		}

		:global(main.main-content .list-toolbar .toolbar-views) {
			justify-content: flex-start;
		}
	}
</style>
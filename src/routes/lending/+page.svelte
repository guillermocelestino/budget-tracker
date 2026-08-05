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
	import ActiveIouList from '$lib/components/ActiveIouList.svelte';
	import RecordPaymentModal from '$lib/components/RecordPaymentModal.svelte';
	import PaymentHistoryPanel from '$lib/components/PaymentHistoryPanel.svelte';
	import EditPaymentModal from '$lib/components/EditPaymentModal.svelte';
	import DeletePaymentConfirmModal from '$lib/components/DeletePaymentConfirmModal.svelte';
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
	import { generateLendingPdf } from '$lib/utils/pdf';
	import { LENDING_IMPORT_FIELDS, buildMappedLendingRows, validateAllLendingRows, type MappedLendingRow } from '$lib/utils/lendingImport';
	import type { ImportPreviewColumn, ImportMappingConfig, ImportValidationResult } from '$lib/utils/importValidation';
	import type { Lending, LendingPayment, LendingWithPayments } from '$lib/types';

	let data = $derived($page.data as App.PageData);

	let showPanel = $state(false);
	let editingLending = $state<Lending | null>(null);
	let activeTab = $state<'all' | 'active' | 'paid'>('active');
	let viewMode = $state<'card' | 'table'>('card');
	let recordPaymentLending = $state<LendingWithPayments | null>(null);
	let deleteId = $state<number | null>(null);
	let historyLending = $state<LendingWithPayments | null>(null);
	let historyPayments = $state<LendingPayment[]>([]);
	let historyOpen = $state(false);
	let editPaymentLending = $state<LendingWithPayments | null>(null);
	let editPayment = $state<LendingPayment | null>(null);
	let deletePayment = $state<LendingPayment | null>(null);
	let editingLendingHasPayments = $state(false);
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
	const tabLendings: LendingWithPayments[] = $derived(
		activeTab === 'all'
			? [...activeLendings, ...paidLendings]
			: activeTab === 'active'
				? activeLendings
				: paidLendings
	);

	// Stage 2 — client-side search narrowing against borrower_name + notes.
	// The hero (totals) reads from `data.totals`, NOT showLendings, so search
	// can never change the headline balance — it only narrows the visible list.
	const showLendings: LendingWithPayments[] = $derived.by(() => {
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

	// Open the New Lending panel when arriving via the global FAB (?add=1)
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
		const csv = lendingsToCSV(showLendings, 'lent');
		downloadCsv(csv, `lending-${new Date().toISOString().split('T')[0]}.csv`);
	}

	async function handleExportPdf() {
		if (showLendings.length === 0) {
			showError('No lendings to export');
			return;
		}
		try {
			const doc = await generateLendingPdf(showLendings);
			doc.save(`lending-${new Date().toISOString().split('T')[0]}.pdf`);
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
			showSuccess('Lending duplicated');
			await invalidateAll();
		} catch (e) {
			showError((e as Error).message || 'Failed to duplicate lending');
		}
	}

	// ─── Import Wizard props ──────────────────────────────────────────
	// Preview columns for ImportPreview
	// IMPORTANT: All headers must be unique - ImportPreview uses col.header as the key
	const previewColumns = $derived<ImportPreviewColumn[]>([
		{ header: 'Validity', key: '_status', kind: 'status' },
		{ header: 'Person', key: 'person_name', kind: 'text', cls: 'cell-desc' },
		{ header: 'Amount', key: 'amount', kind: 'amount', align: 'right' },
		{ header: 'Date Lent', key: 'date_lent', kind: 'date' },
		{ header: 'Due Date', key: 'due_date', kind: 'date' },
		{ header: 'Status', key: 'status', kind: 'badge' },
		{ header: 'Amount Recovered', key: 'recovered_amount', kind: 'amount', align: 'right' },
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
	<title>Lending — Finance Tracker</title>
</svelte:head>

<PageHeader title="Lending" flush borderless>
	{#snippet badge()}
		<CountChip count={activeLendings.length} suffix="active" />
	{/snippet}
	{#snippet subtitle()}
		<span class="context-subline">{activeLendings.length} active · {paidLendings.length} paid</span>
	{/snippet}
	{#snippet action()}
		<div class="header-actions">
			<span class="desktop-only">
				<Button variant="primary" onclick={openAdd}>
					<span class="btn-lead" aria-hidden="true">+</span>
					New Lending
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
	totalOwedToMe={totals.outstanding}
	totalIOwe={0}
/>

<!-- ═══ Slide-over for Add / Edit ═══ -->
<SlideOver
	isOpen={showPanel}
	title={editingLending ? 'Edit Lending' : 'New Lending'}
	onClose={closePanel}
>
	<LendingForm
			lendingRecord={editingLending ?? undefined}
			onCancel={closePanel}
			onSuccess={closePanel}
			hasPayments={editingLendingHasPayments}
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
	title="Import Lendings"
	noun="lendings"
	sampleHref="/lending-sample.csv"
	sampleFilename="lending-sample.csv"
	templateHref="/templates/lending.xlsx"
	templateFilename="lending-import-template.xlsx"
	direction="lent"
/>

<!-- ═══ ListToolbar: unified Search|Filter pill (left), view mode (right) ═══ -->
<ListToolbar>
	{#snippet filters()}
		<SearchFilterPill
			bind:value={searchInput}
			bind:open={filtersOpen}
			activeFilterCount={activeFilterCount}
			placeholder="Search borrower, lender, notes…"
			ariaLabel="Search lendings"
			filterAriaLabel="Filter lendings"
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
			ariaLabel="Lending list view"
			slidingThumb
			stretch
		/>
	{/snippet}
</ListToolbar>

<ActiveIouList
	ious={showLendings}
	onPay={(id) => { const l = showLendings.find(l => l.id === id); if (l) recordPaymentLending = l; }}
	onViewHistory={async (id) => {
		const l = showLendings.find(l => l.id === id);
		if (!l) return;
		const res = await fetch(`/api/lendings/${id}/payments`);
		if (res.ok) {
			historyPayments = await res.json();
			historyLending = l;
			historyOpen = true;
		}
	}}
	onEdit={(id) => {
		const l = showLendings.find(l => l.id === id);
		if (l) {
			editingLendingHasPayments = l.resolved_total > 0;
			openEdit(l);
		}
	}}
	onDelete={(id) => deleteId = id}
	onDuplicate={handleDuplicate}
	viewMode={viewMode}
/>

<!-- ═══ Record Payment Modal ═══ -->
{#if recordPaymentLending}
	<RecordPaymentModal
		lending={recordPaymentLending}
		direction="lent"
		onclose={() => recordPaymentLending = null}
	/>
{/if}

<!-- ═══ Payment History SlideOver ═══ -->
{#if historyOpen && historyLending}
	<SlideOver
		isOpen={historyOpen}
		title="Payment History"
		onClose={() => { historyOpen = false; historyLending = null; historyPayments = []; }}
	>
		<PaymentHistoryPanel
			lending={historyLending}
			payments={historyPayments}
			direction="lent"
			onRecordPayment={() => { historyOpen = false; recordPaymentLending = historyLending; }}
			onEditPayment={(paymentId) => {
				const p = historyPayments.find(p => p.id === paymentId);
				if (p && historyLending) {
					historyOpen = false;
					editPaymentLending = historyLending;
					editPayment = p;
				}
			}}
			onDeletePayment={(paymentId) => {
				const p = historyPayments.find(p => p.id === paymentId);
				if (p) {
					historyOpen = false;
					deletePayment = p;
				}
			}}
		/>
	</SlideOver>
{/if}

<!-- ═══ Edit Payment Modal ═══ -->
{#if editPaymentLending && editPayment}
	<EditPaymentModal
		lending={editPaymentLending}
		payment={editPayment}
		direction="lent"
		onclose={() => { editPaymentLending = null; editPayment = null; }}
	/>
{/if}

<!-- ═══ Delete Payment Confirmation ═══ -->
{#if deletePayment}
	<DeletePaymentConfirmModal
		payment={deletePayment}
		onclose={() => deletePayment = null}
	/>
{/if}

<!-- ═══ Delete Confirmation ═══ -->
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
			return async ({ result, update }: { result: { type: string; data?: { error?: string } }; update: () => Promise<void> }) => {
				await update();
				if (result.type === 'success') {
					deleteId = null;
					showSuccess('Lending deleted');
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

	/* ─── Mobile / Desktop visibility (matches /transactions) ─── */
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
		background: linear-gradient(135deg, var(--color-income-light) 0%, rgba(16, 185, 129, 0.1) 100%);
		color: var(--color-income);
		border-radius: var(--radius-lg);
	}

	.modal-icon-wrap.danger {
		background: linear-gradient(135deg, var(--color-expense-light) 0%, rgba(239, 68, 68, 0.1) 100%);
		color: var(--color-expense);
	}

	.modal-actions {
		display: flex;
		gap: var(--space-sm);
		margin-top: var(--space-lg);
	}

	.modal-actions :global(.btn) {
		flex: 1;
	}

	@keyframes fadeSlideIn {
		from { opacity: 0; transform: translateY(10px); }
		to { opacity: 1; transform: translateY(0); }
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
	   The toolbar is one compact band: unified Search|Filter pill, then the
	   single ViewToggle left-anchored below it, directly above the list. */
	@media (max-width: 767px) {
		:global(main.main-content .list-toolbar) {
			margin-top: var(--space-md);
		}

		:global(main.main-content .list-toolbar .toolbar-views) {
			justify-content: flex-start;
		}
	}
</style>
<script lang="ts">
	import { formatCurrency, formatDate, getToday } from '$lib/utils/format';
	import RowActionsMenu from '$lib/components/RowActionsMenu.svelte';
	import RowHoverActions from '$lib/components/RowHoverActions.svelte';
	import { getCategoryHue, getCategoryText, getCategoryTint } from '$lib/utils/categoryColors';
	import { isDark } from '$lib/stores/preferences.svelte';
	import type { RecurringTransaction } from '$lib/types';

	let {
		recurring = [],
		onDelete,
		onEdit,
		onDuplicate,
		onRunNow,
		onPause,
		onResume,
		showActions = true,
		loading = false,
		emptyState,
	}: {
		recurring: RecurringTransaction[];
		onDelete?: (id: number) => void;
		onEdit?: (recurring: RecurringTransaction) => void;
		onDuplicate?: (id: number) => void;
		onRunNow?: (id: number) => void;
		onPause?: (id: number) => void;
		onResume?: (id: number) => void;
		showActions?: boolean;
		loading?: boolean;
		emptyState?: import('svelte').Snippet;
	} = $props();

	let menuTxn = $state<RecurringTransaction | null>(null);

	const frequencyLabels: Record<string, string> = {
		daily: 'Daily',
		weekly: 'Weekly',
		monthly: 'Monthly',
		yearly: 'Yearly'
	};

	function formatNextRun(dateStr: string): string {
		const today = getToday();
		const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
		const date = new Date(dateStr + 'T00:00:00');

		if (dateStr === today) return 'Today';
		if (dateStr === tomorrow) return 'Tomorrow';

		const diffDays = Math.ceil((date.getTime() - new Date(today + 'T00:00:00').getTime()) / 86_400_000);
		if (diffDays > 0 && diffDays <= 7) {
			return `In ${diffDays} day${diffDays > 1 ? 's' : ''}`;
		}
		if (diffDays < 0) {
			return `${Math.abs(diffDays)} day${Math.abs(diffDays) > 1 ? 's' : ''} ago`;
		}

		return formatDate(dateStr);
	}

	function getStatusBadge(rec: RecurringTransaction): { label: string; class: string } {
		if (!rec.active) {
			return { label: 'Paused', class: 'status-paused' };
		}
		const nextRun = new Date(rec.next_run + 'T00:00:00');
		const today = new Date(getToday() + 'T00:00:00');
		if (nextRun < today) {
			return { label: 'Overdue', class: 'status-overdue' };
		}
		return { label: 'Active', class: 'status-active' };
	}

</script>

<!-- ── SNIPPETS ── -->
{#snippet runIcon()}
	<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
{/snippet}

{#snippet editIcon()}
	<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
{/snippet}

{#snippet dupIcon()}
	<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
{/snippet}

{#snippet pauseIcon()}
	<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
{/snippet}

{#snippet resumeIcon()}
	<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
{/snippet}

{#snippet recurringRow(rec: RecurringTransaction)}
	{@const status = getStatusBadge(rec)}
	{@const isIncome = rec.type === 'income'}
	{@const hue = getCategoryHue(rec.category_name, rec.category_color)}
	{@const tint = getCategoryTint(rec.category_name, hue, isDark)}
	{@const fg = getCategoryText(rec.category_name, hue, isDark)}

	<div class="recurring-row" class:txn-income={isIncome} class:txn-expense={!isIncome} data-recurring-id={rec.id} data-hover-row role="button" tabindex="0" aria-label="{rec.description}, {frequencyLabels[rec.frequency]}, next: {formatNextRun(rec.next_run)}" onclick={() => onEdit?.(rec)} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit?.(rec); } }}>
		<!-- Category accent bar -->
		<div class="cat-stripe" style="background: {fg}"></div>

		<!-- Description: icon chip + title/status + next-run -->
		<div class="txn-desc-cell">
			<div class="cat-circle" style="background: {tint}; color: {fg}">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
					<path d="M12 2v20M6 4h7a4 4 0 0 1 0 8H6"/><line x1="4" x2="18" y1="12" y2="12"/><line x1="4" x2="18" y1="16" y2="16"/>
				</svg>
			</div>
			<div class="txn-info">
				<div class="txn-title-line">
					<span class="txn-desc">{rec.description}</span>
					<span class="status-badge {status.class}">{status.label}</span>
				</div>
				<div class="next-run">Next: {formatNextRun(rec.next_run)}</div>
			</div>
		</div>

		<!-- Frequency + category share a display:contents wrapper on desktop so
		     each stays an independent grid column; they wrap together on mobile. -->
		<div class="pills-cell">
			<div class="freq-cell">
				<span class="freq-pill">
					{frequencyLabels[rec.frequency]}
					{#if rec.interval > 1}
						(every {rec.interval})
					{/if}
				</span>
			</div>
			<div class="cat-cell">
				<span class="cat-pill" style="background: {tint}; color: {fg}">
					{rec.category_name || 'Uncategorized'}
				</span>
			</div>
		</div>

		<!-- Amount -->
		<div class="amount-cell">
			<span class="txn-amount" class:amount-income={isIncome} class:amount-expense={!isIncome}>
				{isIncome ? '+' : '−'}{formatCurrency(rec.amount)}
			</span>
		</div>

		<!-- Reserved quick-action slot (revealed on row hover / focus) -->
		{#if showActions}
			<div class="actions-cell">
				<RowHoverActions
					actions={[
						{ id: 'run', label: 'Run now', icon: runIcon, onClick: () => onRunNow?.(rec.id), hideBelow: 'md' },
						{ id: 'edit', label: 'Edit', icon: editIcon, onClick: () => onEdit?.(rec) },
						{ id: 'duplicate', label: 'Duplicate', icon: dupIcon, onClick: () => onDuplicate?.(rec.id), hideBelow: 'lg' },
						rec.active
							? { id: 'pause', label: 'Pause', icon: pauseIcon, onClick: () => onPause?.(rec.id) }
							: { id: 'resume', label: 'Resume', icon: resumeIcon, onClick: () => onResume?.(rec.id) }
					]}
				/>
			</div>

			<button class="kebab-btn" aria-label="Actions for {rec.description}" onclick={(e) => { e.stopPropagation(); menuTxn = rec; }} type="button">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="1"/>
					<circle cx="19" cy="12" r="1"/>
					<circle cx="5" cy="12" r="1"/>
				</svg>
			</button>
		{/if}
	</div>
{/snippet}

<!-- Hide tooltips on Escape (discard) and on scroll (never leave a stale pill) -->

<!-- ── RENDER ── -->
<div class="recurring-list">
	{#if loading}
		<div class="shimmer-list" aria-busy="true" aria-label="Loading recurring transactions">
			{#each Array(5) as _, i (i)}
				<div class="shimmer-row">
					<div class="shimmer-dot skeleton" style="width:32px;height:32px"></div>
					<div class="shimmer-info">
						<div class="skeleton" style="width:60%;height:14px;margin-bottom:6px"></div>
						<div class="skeleton" style="width:35%;height:10px"></div>
					</div>
					<div class="shimmer-amount">
						<div class="skeleton" style="width:70px;height:14px"></div>
					</div>
				</div>
			{/each}
		</div>
	{:else if recurring.length === 0}
		{#if emptyState}
			{@render emptyState()}
		{:else}
			<div class="empty-state">
				<div class="empty-icon-circle">
					<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
						<path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>
					</svg>
				</div>
				<p class="empty-title">No recurring transactions yet</p>
				<p class="empty-sub">Add your first recurring transaction to automate your finances</p>
				<a href="/recurring/new" class="empty-action">Add Recurring Transaction</a>
			</div>
		{/if}
	{:else}
		<div class="recurring-table">
			<div class="recurring-header" role="rowheader">
				<span class="rh-desc">Description</span>
				<span class="rh-freq">Frequency</span>
				<span class="rh-cat">Category</span>
				<span class="rh-amount">Amount</span>
				<span class="rh-actions" aria-hidden="true"></span>
				<span class="rh-kebab" aria-hidden="true"></span>
			</div>
			{#each recurring as rec (rec.id)}
				{@render recurringRow(rec)}
			{/each}
		</div>
	{/if}
</div>

{#if menuTxn}
	{@const menuId = menuTxn.id}
	{@const menuRec = menuTxn}
	<RowActionsMenu
		title={menuTxn.description || 'Recurring Transaction'}
		amount={menuTxn.type === 'income' ? `+${formatCurrency(menuTxn.amount)}` : `-${formatCurrency(menuTxn.amount)}`}
		tone={menuTxn.type === 'income' ? 'income' : 'expense'}
		isActive={menuTxn.active}
		onClose={() => (menuTxn = null)}
		onEdit={() => { menuTxn = null; onEdit?.(menuRec); }}
		onDuplicate={() => { menuTxn = null; onDuplicate?.(menuId); }}
		onDelete={() => { menuTxn = null; onDelete?.(menuId); }}
		onRunNow={() => { menuTxn = null; onRunNow?.(menuId); }}
		onPause={() => { menuTxn = null; onPause?.(menuId); }}
		onResume={() => { menuTxn = null; onResume?.(menuId); }}
	/>
{/if}

<style>
	/* ── Container ── */
	.recurring-list { width: 100%; }

	/* ── Table card ──
	   Overflow visible so the per-button tooltips are never clipped; the mint
	   header band and last row carry their own corner rounding instead. */
	.recurring-table {
		background: var(--color-surface);
		border: 1px solid var(--line);
		border-radius: 22px;
		box-shadow: 0 8px 28px rgba(79, 157, 136, 0.12);
		overflow: visible;
	}

	/* ── Column header — solid mint band, no hard border ── */
	.recurring-header {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 120px 170px 130px 232px 48px;
		align-items: center;
		padding: 0 12px;
		min-height: 42px;
		background: var(--mint-tint);
		border-radius: 22px 22px 0 0;
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted);
	}

	.recurring-header > span {
		min-width: 0;
		padding-right: var(--space-md);
	}

	.rh-amount {
		text-align: right;
	}

	/* ── Row — shared grid with the header (fixes column alignment) ── */
	.recurring-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 120px 170px 130px 232px 48px;
		align-items: center;
		min-height: 76px;
		padding: 12px;
		border-bottom: 1px solid var(--line);
		position: relative;
		cursor: pointer;
		transition: background 140ms ease-out;
		-webkit-tap-highlight-color: transparent;
	}

	.recurring-row:last-child {
		border-bottom: none;
		border-radius: 0 0 22px 22px;
	}

	/* Row activates first — tinted mint, then the actions follow (Section 5) */
	.recurring-row:hover,
	.recurring-row:focus-within {
		background: rgba(217, 239, 231, 0.35);
	}

	.recurring-row:focus-visible {
		outline: 2px solid var(--teal-deep);
		outline-offset: 2px;
	}

	/* Left accent bar — category hue, inset vertically, rounded caps */
	.cat-stripe {
		position: absolute;
		left: 0;
		top: 12px;
		bottom: 12px;
		width: 4px;
		border-radius: var(--radius-pill);
		flex-shrink: 0;
		pointer-events: none;
		transition: box-shadow 140ms ease-out;
	}

	.recurring-row:hover .cat-stripe,
	.recurring-row:focus-within .cat-stripe {
		box-shadow: 0 0 10px rgba(79, 157, 136, 0.35);
	}

	/* ── Description cell ── */
	.txn-desc-cell {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
		padding-right: var(--space-md);
	}

	.cat-circle {
		width: 36px;
		height: 36px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 14px;
	}

	.txn-info {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}

	.txn-title-line {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
		min-width: 0;
	}

	.txn-desc {
		font-family: var(--font-display);
		font-size: 16px;
		font-weight: 500;
		color: var(--ink);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.next-run {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--muted);
	}

	/* Frequency + category — transparent wrapper on desktop (see markup) */
	.pills-cell { display: contents; }

	.freq-cell {
		min-width: 0;
		padding-right: var(--space-md);
	}

	.freq-pill {
		display: inline-flex;
		align-items: center;
		max-width: 100%;
		padding: 4px 10px;
		border-radius: var(--radius-pill);
		background: var(--mint-tint);
		color: var(--teal-deep);
		font-family: var(--font-body);
		font-size: 11px;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.cat-cell {
		min-width: 0;
		padding-right: var(--space-md);
	}

	/* Category pill — full words, never truncate mid-word; wraps if needed */
	.cat-pill {
		display: inline-block;
		padding: 4px 10px;
		border-radius: var(--radius-pill);
		font-family: var(--font-body);
		font-size: 12px;
		font-weight: 600;
		white-space: normal;
	}

	/* ── Amount — rounded monospace, tabular, direction-colored, right-aligned ── */
	.amount-cell {
		min-width: 0;
		padding-right: var(--space-md);
		text-align: right;
	}

	.txn-amount {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		font-size: 15px;
		font-weight: 600;
		white-space: nowrap;
	}

	.amount-income { color: var(--teal); }
	.amount-expense { color: var(--rose); }

	/* ── Status pill ── */
	.status-badge {
		display: inline-flex;
		align-items: center;
		padding: 2px 10px;
		border-radius: var(--radius-pill);
		font-family: var(--font-body);
		font-size: 11px;
		font-weight: 600;
		text-transform: capitalize;
		white-space: nowrap;
	}

	.status-active { background: var(--mint-tint); color: var(--teal-deep); }
	.status-paused { background: #eef1f0; color: var(--muted); }
	.status-overdue { background: var(--rose-soft); color: var(--rose); }

	/* ── Reserved quick-action slot ──
	   Empty at rest (opacity 0, pointer-events none) so nothing shifts;
	   revealed only on row hover / focus-within. The cluster + tooltips now
	   live in the shared RowHoverActions component. */
	.actions-cell {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		min-width: 0;
		padding-right: 8px;
	}

	/* ── Kebab — always visible and quiet; mint tile only on its own hover ── */
	.kebab-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		justify-self: center;
		align-self: center;
		border: none;
		border-radius: 10px;
		background: transparent;
		color: var(--muted);
		cursor: default;
		transition: background 140ms ease-out, color 140ms ease-out;
		-webkit-tap-highlight-color: transparent;
	}

	.kebab-btn:hover,
	.kebab-btn:focus-visible {
		background: var(--mint-tint);
		color: var(--teal-deep);
	}

	.kebab-btn svg {
		width: 24px;
		height: 24px;
	}

	/* Narrow desktop: shrink the reserved slot; the shared RowHoverActions
	   handles the Duplicate/Run drops via its own hideBelow media rules. The
	   header shares the same template. */
	@media (max-width: 1099px) {
		.recurring-row,
		.recurring-header {
			grid-template-columns: minmax(0, 1fr) 120px 170px 130px 148px 48px;
		}
	}

	@media (max-width: 899px) {
		.recurring-row,
		.recurring-header {
			grid-template-columns: minmax(0, 1fr) 120px 170px 130px 100px 48px;
		}
	}

	/* Touch / pointer-coarse — collapse the reserved slot, drop to 5 columns */
	@media (hover: none) {
		.actions-cell { display: none; }
		.recurring-header .rh-actions { display: none; }
		.recurring-row,
		.recurring-header {
			grid-template-columns: minmax(0, 1fr) 120px 170px 130px 48px;
		}
	}

	/* ── Empty state ── */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--space-2xl) var(--space-lg);
		text-align: center;
		background: var(--color-surface);
		border: 1px solid var(--line);
		border-radius: 22px;
		box-shadow: 0 8px 28px rgba(79, 157, 136, 0.10);
	}

	.empty-icon-circle {
		width: 88px;
		height: 88px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: var(--mint-tint);
		color: var(--teal-deep);
		margin-bottom: var(--space-md);
	}

	.empty-title {
		font-family: var(--font-display);
		font-size: var(--font-size-lg);
		font-weight: 700;
		color: var(--ink);
		margin: 0 0 var(--space-xs);
	}

	.empty-sub {
		font-size: var(--font-size-sm);
		color: var(--muted);
		margin: 0 0 var(--space-lg);
		max-width: 300px;
		line-height: 1.5;
	}

	.empty-action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 44px;
		padding: 0 var(--space-xl);
		background: var(--teal);
		color: var(--color-surface);
		border: none;
		border-radius: var(--radius-pill);
		font-family: var(--font-display);
		font-size: var(--font-size-sm);
		font-weight: 600;
		text-decoration: none;
		cursor: pointer;
		transition: background 140ms ease-out, box-shadow 140ms ease-out;
	}

	.empty-action:hover {
		background: var(--teal-deep);
		box-shadow: 0 4px 16px rgba(79, 157, 136, 0.22);
	}

	/* ── Shimmer ── */
	.shimmer-list { width: 100%; }
	.shimmer-row {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-lg);
		border-bottom: 1px solid var(--line);
	}

	.shimmer-dot { border-radius: 50%; }
	.shimmer-info { flex: 1; display: flex; flex-direction: column; gap: 6px; }
	.shimmer-amount { width: 100px; display: flex; justify-content: flex-end; }

	.skeleton {
		background: linear-gradient(90deg, var(--color-bg) 25%, var(--color-surface-inset) 50%, var(--color-bg) 75%);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: var(--radius-sm);
	}

	@keyframes shimmer {
		0% { background-position: 200% 0; }
		100% { background-position: -200% 0; }
	}

	/* ── Mobile stacked cards (<760px) ── */
	@media (max-width: 759px) {
		.recurring-table {
			display: flex;
			flex-direction: column;
			gap: 16px;
			background: transparent;
			border: none;
			box-shadow: none;
		}

		.recurring-header { display: none; }

		.recurring-row {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto auto;
			grid-template-areas:
				'desc desc desc'
				'pills amount kebab';
			gap: 12px 8px;
			align-items: center;
			background: var(--color-surface);
			border: 1px solid var(--line);
			border-radius: 18px;
			box-shadow: 0 4px 16px rgba(79, 157, 136, 0.10);
			padding: 20px 16px 16px;
			min-height: 0;
		}

		.recurring-row:last-child { border-bottom: 1px solid var(--line); }

		.txn-desc-cell {
			grid-area: desc;
			padding-right: 0;
		}

		.pills-cell {
			grid-area: pills;
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 8px;
		}

		.freq-cell { padding-right: 0; }
		.cat-cell { padding-right: 0; }

		.amount-cell {
			grid-area: amount;
			justify-self: end;
			padding-right: 0;
		}

		.kebab-btn { grid-area: kebab; }

		.actions-cell { display: none; }
	}

	@media (prefers-reduced-motion: reduce) {
		* {
			transition: none !important;
			animation: none !important;
		}
	}
</style>

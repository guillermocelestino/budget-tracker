<script lang="ts">
	import { formatCurrency, formatDate, getToday } from '$lib/utils/format';
	import RowActionsMenu from '$lib/components/RowActionsMenu.svelte';
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

	/* ── Category hue remapping ──
	   The seed palette ships royal-blue / indigo / violet values (e.g. Bills &
	   Utilities #3b82f6, Entertainment #8b5cf6) which are forbidden here. Remap
	   known categories to calm in-family hues (teal / rose / ocean), and
	   neutralize any residual blue-ish color on user-created categories. */
	const CATEGORY_HUES: Record<string, string> = {
		Salary: '#3f8f79',
		Freelance: '#5f9d8a',
		'Other Income': '#7b9f91',
		'Food & Dining': '#c0564f',
		Transportation: '#c08a4a',
		Shopping: '#b0864d',
		Entertainment: '#a07a6a',
		'Bills & Utilities': '#468499',
		Healthcare: '#c56a8b',
		Education: '#4f8f9e',
		'Other Expense': '#7a8986'
	};

	const CATEGORY_TINTS: Record<string, string> = {
		'Bills & Utilities': '#e0eef2'
	};

	function hexToRgb(hex: string): [number, number, number] {
		const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
		return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [79, 157, 136];
	}

	function withAlpha(hex: string, alpha: number): string {
		const [r, g, b] = hexToRgb(hex);
		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	}

	function isForbiddenHue(hex: string): boolean {
		const [r0, g0, b0] = hexToRgb(hex);
		const r = r0 / 255;
		const g = g0 / 255;
		const b = b0 / 255;
		const max = Math.max(r, g, b);
		const min = Math.min(r, g, b);
		const d = max - min;
		if (d === 0) return false;
		let h: number;
		if (max === r) h = ((g - b) / d) % 6;
		else if (max === g) h = (b - r) / d + 2;
		else h = (r - g) / d + 4;
		h = (h * 60 + 360) % 360;
		// blue → indigo → violet
		return h >= 205 && h < 305;
	}

	function getCategoryHue(name: string | null | undefined, dbColor: string | null | undefined): string {
		const n = name || '';
		if (CATEGORY_HUES[n]) return CATEGORY_HUES[n];
		const c = dbColor || '#4f9d88';
		return isForbiddenHue(c) ? '#4f9d88' : c;
	}

	function getCategoryTint(name: string | null | undefined, hue: string): string {
		const n = name || '';
		if (CATEGORY_TINTS[n]) return CATEGORY_TINTS[n];
		return withAlpha(hue, 0.12);
	}

	/* ── Quick-action tooltips ──
	   Each quick button owns a per-button tooltip (a sibling .quick-tip span).
	   Pointer shows it after a 250ms intent delay; keyboard focus-visible shows
	   it instantly. Hidden on leave / blur / Escape / scroll. Edge-aware: the
	   tooltip flips below when the button sits in the first row (or the pill
	   would clip the viewport top) and is clamped to stay ≥8px inside the card.
	   Never triggered by row hover alone — only the button itself. */
	let tipTimer: ReturnType<typeof setTimeout> | undefined;
	let activeTipEl: HTMLElement | null = null;
	let tipTrigger: 'pointer' | 'focus' | null = null;

	function hideTip() {
		clearTimeout(tipTimer);
		tipTimer = undefined;
		if (activeTipEl) {
			activeTipEl.classList.remove('show');
			activeTipEl = null;
		}
		tipTrigger = null;
	}

	function hideTipByPointer() {
		clearTimeout(tipTimer);
		tipTimer = undefined;
		if (!activeTipEl) {
			tipTrigger = null;
			return;
		}
		// A keyboard-shown tooltip stays until blur — mouse movement must not hide it.
		if (tipTrigger === 'focus') return;
		activeTipEl.classList.remove('show');
		activeTipEl = null;
		tipTrigger = null;
	}

	function scheduleTip(btn: HTMLButtonElement, instant: boolean) {
		clearTimeout(tipTimer);
		tipTimer = undefined;
		const tip = btn.parentElement?.querySelector<HTMLElement>('.quick-tip');
		if (!tip) return;
		const show = () => {
			if (activeTipEl && activeTipEl !== tip) activeTipEl.classList.remove('show');
			activeTipEl = tip;
			tipTrigger = instant ? 'focus' : 'pointer';
			tip.classList.add('show');
			positionTip(tip, btn);
		};
		if (instant) show();
		else tipTimer = setTimeout(show, 250);
	}

	function positionTip(tip: HTMLElement, btn: HTMLButtonElement) {
		requestAnimationFrame(() => {
			const card = btn.closest<HTMLElement>('.recurring-table');
			if (!card) return;
			const pad = 8;
			const tipRect = tip.getBoundingClientRect();
			const btnRect = btn.getBoundingClientRect();
			const cardRect = card.getBoundingClientRect();
			// Flip below when the button is in the first row (<48px clear space
			// above it inside the card) or the pill would clip the viewport top.
			const flip =
				btnRect.top - cardRect.top < 48 ||
				btnRect.top - tipRect.height - 6 < pad;
			tip.classList.toggle('flip', flip);
			// Clamp horizontally so the pill stays ≥8px inside the card edges.
			let dx = 0;
			if (tipRect.left < cardRect.left + pad) dx = cardRect.left + pad - tipRect.left;
			else if (tipRect.right > cardRect.right - pad) dx = cardRect.right - pad - tipRect.right;
			tip.style.transform = dx !== 0 ? `translateX(calc(-50% + ${dx}px))` : '';
		});
	}
</script>

<!-- ── SNIPPETS ── -->
{#snippet recurringRow(rec: RecurringTransaction)}
	{@const status = getStatusBadge(rec)}
	{@const isIncome = rec.type === 'income'}
	{@const hue = getCategoryHue(rec.category_name, rec.category_color)}
	{@const tint = getCategoryTint(rec.category_name, hue)}

	<div class="recurring-row" class:txn-income={isIncome} class:txn-expense={!isIncome} data-recurring-id={rec.id} role="button" tabindex="0" aria-label="{rec.description}, {frequencyLabels[rec.frequency]}, next: {formatNextRun(rec.next_run)}" onclick={() => onEdit?.(rec)} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit?.(rec); } }}>
		<!-- Category accent bar -->
		<div class="cat-stripe" style="background: {hue}"></div>

		<!-- Description: icon chip + title/status + next-run -->
		<div class="txn-desc-cell">
			<div class="cat-circle" style="background: {tint}; color: {hue}">
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
				<span class="cat-pill" style="background: {tint}; color: {hue}">
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
				<div class="hover-actions">
					<div class="quick-btn-wrap" data-action="run">
						<button class="quick-btn" aria-label="Run now" onclick={(e) => { e.stopPropagation(); onRunNow?.(rec.id); }} onpointerenter={(e) => scheduleTip(e.currentTarget, false)} onpointerleave={hideTipByPointer} onfocus={(e) => { if (e.currentTarget.matches(':focus-visible')) scheduleTip(e.currentTarget, true); }} onblur={hideTip} type="button">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
						</button>
						<span class="quick-tip">Run now</span>
					</div>
					<div class="quick-btn-wrap" data-action="edit">
						<button class="quick-btn" aria-label="Edit" onclick={(e) => { e.stopPropagation(); onEdit?.(rec); }} onpointerenter={(e) => scheduleTip(e.currentTarget, false)} onpointerleave={hideTipByPointer} onfocus={(e) => { if (e.currentTarget.matches(':focus-visible')) scheduleTip(e.currentTarget, true); }} onblur={hideTip} type="button">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
						</button>
						<span class="quick-tip">Edit</span>
					</div>
					<div class="quick-btn-wrap" data-action="duplicate">
						<button class="quick-btn" aria-label="Duplicate" onclick={(e) => { e.stopPropagation(); onDuplicate?.(rec.id); }} onpointerenter={(e) => scheduleTip(e.currentTarget, false)} onpointerleave={hideTipByPointer} onfocus={(e) => { if (e.currentTarget.matches(':focus-visible')) scheduleTip(e.currentTarget, true); }} onblur={hideTip} type="button">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
						</button>
						<span class="quick-tip">Duplicate</span>
					</div>
					{#if rec.active}
						<div class="quick-btn-wrap" data-action="pause">
							<button class="quick-btn" aria-label="Pause" onclick={(e) => { e.stopPropagation(); onPause?.(rec.id); }} onpointerenter={(e) => scheduleTip(e.currentTarget, false)} onpointerleave={hideTipByPointer} onfocus={(e) => { if (e.currentTarget.matches(':focus-visible')) scheduleTip(e.currentTarget, true); }} onblur={hideTip} type="button">
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
							</button>
							<span class="quick-tip">Pause</span>
						</div>
					{:else}
						<div class="quick-btn-wrap" data-action="pause">
							<button class="quick-btn" aria-label="Resume" onclick={(e) => { e.stopPropagation(); onResume?.(rec.id); }} onpointerenter={(e) => scheduleTip(e.currentTarget, false)} onpointerleave={hideTipByPointer} onfocus={(e) => { if (e.currentTarget.matches(':focus-visible')) scheduleTip(e.currentTarget, true); }} onblur={hideTip} type="button">
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
							</button>
							<span class="quick-tip">Resume</span>
						</div>
					{/if}
				</div>
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
<svelte:window onkeydown={(e) => { if (e.key === 'Escape') hideTip(); }} onscroll={hideTip} />

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
	   revealed only on row hover / focus-within. */
	.actions-cell {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		min-width: 0;
		padding-right: 8px;
	}

	.hover-actions {
		display: flex;
		align-items: center;
		gap: 4px;
		opacity: 0;
		transform: translateX(4px);
		pointer-events: none;
		transition: opacity 140ms ease-out, transform 140ms ease-out;
	}

	/* One identical 44px footprint for every quick action: the visible tile
	   (radius 10px) always fills it — transparent at rest, --mint-tint on the
	   button's own hover/focus. Nothing grows, shrinks, or shifts. */
	.quick-btn-wrap {
		position: relative;
	}

	.quick-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		flex-shrink: 0;
		border: none;
		border-radius: 10px;
		background: transparent;
		color: var(--muted);
		cursor: default;
		transition: background 140ms ease-out, color 140ms ease-out;
		-webkit-tap-highlight-color: transparent;
	}

	.quick-btn:hover,
	.quick-btn:focus-visible {
		background: var(--mint-tint);
		color: var(--teal-deep);
	}

	.quick-btn:focus-visible {
		outline: 2px solid var(--teal-deep);
		outline-offset: 2px;
	}

	.quick-btn svg {
		width: 18px;
		height: 18px;
	}

	/* Per-button tooltip — anchored to its own button, centered above the glyph */
	.quick-tip {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		bottom: calc(100% + 6px);
		white-space: nowrap;
		pointer-events: none;
		z-index: 60;
		background: var(--ink);
		color: var(--color-surface);
		font-family: var(--font-body);
		font-size: 12px;
		font-weight: 500;
		line-height: 1;
		border-radius: 8px;
		padding: 4px 10px;
		opacity: 0;
		visibility: hidden;
		transition: opacity 140ms ease-out, visibility 0s linear 140ms;
	}

	.quick-tip.show {
		opacity: 1;
		visibility: visible;
		transition: opacity 140ms ease-out;
	}

	/* Edge-aware flip: first-row buttons (and JS `.flip`) put the pill below */
	.recurring-row:first-child .quick-tip,
	.quick-tip.flip {
		top: calc(100% + 6px);
		bottom: auto;
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

	/* ── Hover / focus gating — hover-capable pointers only ──
	   The row tints first (no delay); the cluster fades in 70ms later, so
	   controls never appear on an untinted row. */
	@media (hover: hover) and (pointer: fine) {
		.recurring-row:hover .hover-actions,
		.recurring-row:focus-within .hover-actions {
			opacity: 1;
			transform: translateX(0);
			pointer-events: auto;
			transition-delay: 70ms;
		}
	}

	/* Narrow desktop: shrink the reserved slot and drop Duplicate first, then
	   Run now, keeping Edit + Pause. The header shares the same template. */
	@media (max-width: 1099px) {
		.quick-btn-wrap[data-action='duplicate'] { display: none; }
		.recurring-row,
		.recurring-header {
			grid-template-columns: minmax(0, 1fr) 120px 170px 130px 148px 48px;
		}
	}

	@media (max-width: 899px) {
		.quick-btn-wrap[data-action='run'] { display: none; }
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

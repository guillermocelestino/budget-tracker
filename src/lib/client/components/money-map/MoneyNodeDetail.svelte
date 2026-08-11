<script lang="ts">
	import { formatCurrency } from '$lib/client/utils/format';

	export interface NodeDetailData {
		id: string;
		type: 'net' | 'income' | 'expense' | 'lending' | 'recurring';
		title: string;
		amount: number;
		serialTag: string;
		percentage?: number;
		color?: string;
		// Specific extra fields
		totalIncome?: number;
		totalExpenses?: number;
		cashPaid?: number;
		outstanding?: number;
		frequency?: string;
		nextDueDate?: string | null;
		daysUntil?: number | null;
	}

	let {
		node,
		targetPosition = null,
		containerBounds = null,
		onclose
	}: {
		node: NodeDetailData | null;
		targetPosition?: { x: number; y: number } | null;
		containerBounds?: { width: number; height: number } | null;
		onclose: () => void;
	} = $props();

	function getTypeLabel(type: NodeDetailData['type']): string {
		switch (type) {
			case 'net':
				return 'NET MONEY';
			case 'income':
				return 'INCOME CATEGORY';
			case 'expense':
				return 'EXPENSE CATEGORY';
			case 'lending':
				return 'LENDING ITEM';
			case 'recurring':
				return 'RECURRING COMMITMENT';
		}
	}

	function getActionLink(node: NodeDetailData): { href: string; label: string } {
		switch (node.type) {
			case 'lending':
				return { href: '/lending', label: 'View Lending Hub →' };
			case 'recurring':
				return { href: '/recurring', label: 'View Recurring Hub →' };
			case 'expense':
			case 'income':
				return { href: `/transactions?category=${encodeURIComponent(node.title)}`, label: 'View Category Transactions →' };
			case 'net':
			default:
				return { href: '/dashboard', label: 'View Dashboard →' };
		}
	}

	// Calculate popover positioning relative to node and canvas container
	const popoverStyle = $derived.by(() => {
		if (!targetPosition || !containerBounds || containerBounds.width < 640) {
			return ''; // Mobile fallback: bottom sheet CSS handles layout
		}

		const popW = 320;
		const popH = 300;
		const margin = 16;

		// Default position: to the right of node
		let left = targetPosition.x + 100;
		let top = targetPosition.y - 80;

		// Flip to left if overflowing right edge
		if (left + popW > containerBounds.width - margin) {
			left = targetPosition.x - popW - 100;
		}

		// Clamp left inside container
		left = Math.max(margin, Math.min(left, containerBounds.width - popW - margin));

		// Clamp top inside container
		top = Math.max(margin, Math.min(top, containerBounds.height - popH - margin));

		return `left: ${Math.round(left)}px; top: ${Math.round(top)}px; position: absolute; bottom: auto; right: auto;`;
	});

	// Derived lending recovery percentage
	const lendingProgress = $derived.by(() => {
		if (!node || node.type !== 'lending') return 0;
		const total = node.amount || 1;
		const paid = node.cashPaid || 0;
		return Math.min(100, Math.max(0, Math.round((paid / total) * 100)));
	});
</script>

{#if node}
	<!-- Backdrop overlay (subtle transparent click target for canvas) -->
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
	<div class="detail-backdrop" onclick={onclose} role="presentation"></div>

	<!-- Floating Popover / Bottom Sheet panel -->
	<div
		class="detail-floating-panel flip7-card accent-{node.type === 'net' ? 'gold' : node.type === 'income' ? 'teal' : node.type === 'expense' ? 'coral' : node.type === 'lending' ? 'sky' : 'teal'}"
		style={popoverStyle}
		role="dialog"
		aria-labelledby="node-title"
	>
		<!-- Mobile Pull Bar Indicator -->
		<div class="mobile-drag-indicator"></div>

		<div class="drawer-header">
			<div class="header-left">
				<span class="type-badge badge-{node.type}">
					{getTypeLabel(node.type)}
				</span>
				<span class="serial-tag">{node.serialTag}</span>
			</div>
			<button class="close-btn" onclick={onclose} aria-label="Close detail panel">✕</button>
		</div>

		<div class="drawer-body">
			<h3 id="node-title" class="node-title">{node.title}</h3>
			<div class="node-amount amount-{node.type}">
				{node.type === 'income' ? '+' : node.type === 'expense' ? '−' : ''}{formatCurrency(node.amount)}
			</div>

			<!-- Contextual stats based on node type -->
			<div class="detail-stats">
				{#if node.type === 'net'}
					<div class="stat-row">
						<span class="stat-label">Total Monthly Income</span>
						<span class="stat-val text-teal">+{formatCurrency(node.totalIncome ?? 0)}</span>
					</div>
					<div class="stat-row">
						<span class="stat-label">Total Monthly Expenses</span>
						<span class="stat-val text-coral">−{formatCurrency(node.totalExpenses ?? 0)}</span>
					</div>
					<div class="stat-row highlight-row">
						<span class="stat-label">Net Remaining Balance</span>
						<span class="stat-val text-gold">{formatCurrency(node.amount)}</span>
					</div>
				{:else if node.type === 'income' || node.type === 'expense'}
					{#if node.percentage !== undefined}
						<div class="stat-row">
							<span class="stat-label">Share of Total {node.type === 'income' ? 'Income' : 'Expenses'}</span>
							<span class="stat-val">{node.percentage}%</span>
						</div>
					{/if}
				{:else if node.type === 'lending'}
					<div class="stat-row">
						<span class="stat-label">Original Loan Amount</span>
						<span class="stat-val">{formatCurrency(node.amount)}</span>
					</div>
					<div class="stat-row">
						<span class="stat-label">Cash Recovered</span>
						<span class="stat-val text-teal">{formatCurrency(node.cashPaid ?? 0)} ({lendingProgress}%)</span>
					</div>
					<!-- Recovery Progress Bar -->
					<div class="recovery-progress-track">
						<div class="recovery-progress-fill" style="width: {lendingProgress}%;"></div>
					</div>
					<div class="stat-row highlight-row">
						<span class="stat-label">Outstanding Balance</span>
						<span class="stat-val text-sky">{formatCurrency(node.outstanding ?? 0)}</span>
					</div>
				{:else if node.type === 'recurring'}
					{#if node.frequency}
						<div class="stat-row">
							<span class="stat-label">Frequency</span>
							<span class="stat-val text-capitalize">{node.frequency}</span>
						</div>
					{/if}
					{#if node.daysUntil !== null && node.daysUntil !== undefined}
						<div class="stat-row highlight-row">
							<span class="stat-label">Next Due Date</span>
							<span class="stat-val text-gold">In {node.daysUntil} day{node.daysUntil === 1 ? '' : 's'}</span>
						</div>
					{/if}
				{/if}
			</div>

			<!-- Action link -->
			<a href={getActionLink(node).href} class="detail-action-btn">
				{getActionLink(node).label}
			</a>
		</div>
	</div>
{/if}

<style>
	/* Subtle backdrop click handler */
	.detail-backdrop {
		position: absolute;
		inset: 0;
		background: rgba(11, 17, 15, 0.15);
		z-index: 90;
		animation: fadeIn 120ms ease;
	}

	/* Floating popover card on desktop / bottom sheet on mobile */
	.detail-floating-panel {
		position: absolute;
		bottom: var(--space-md);
		right: var(--space-md);
		width: 320px;
		max-width: calc(100% - 32px);
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-2xl);
		box-shadow: var(--shadow-lg), var(--glow-card);
		z-index: 100;
		padding: var(--space-lg);
		animation: popIn 180ms var(--bounce);
		transition: left 200ms var(--ease), top 200ms var(--ease);
	}

	.mobile-drag-indicator {
		display: none;
		width: 36px;
		height: 4px;
		background: var(--color-hairline);
		border-radius: 2px;
		margin: 0 auto var(--space-sm) auto;
	}

	@media (max-width: 639px) {
		.detail-floating-panel {
			position: absolute !important;
			left: 0 !important;
			right: 0 !important;
			bottom: 0 !important;
			top: auto !important;
			width: 100% !important;
			max-width: 100% !important;
			border-radius: 24px 24px 0 0 !important;
			border-bottom: none !important;
			box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.25) !important;
		}

		.mobile-drag-indicator {
			display: block;
		}
	}

	.drawer-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--space-xs);
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.type-badge {
		font-size: 10px;
		font-weight: var(--font-weight-extrabold);
		letter-spacing: 0.05em;
		padding: 3px 8px;
		border-radius: var(--radius-pill);
		text-transform: uppercase;
	}

	.badge-net { background: var(--color-gold-bg); color: var(--color-on-gold); }
	.badge-income { background: var(--color-teal-bg); color: var(--color-teal); }
	.badge-expense { background: var(--color-coral-bg); color: var(--color-coral); }
	.badge-lending { background: rgba(93, 173, 226, 0.15); color: var(--color-sky); }
	.badge-recurring { background: var(--color-teal-bg); color: var(--color-teal-dark); }

	.serial-tag {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--color-text-muted);
		opacity: 0.8;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 16px;
		color: var(--color-text-muted);
		cursor: pointer;
		padding: 4px 8px;
		border-radius: var(--radius-sm);
		transition: color 150ms ease;
	}

	.close-btn:hover {
		color: var(--color-text);
		background: var(--color-teal-bg);
	}

	.node-title {
		font-family: var(--font-display);
		font-size: var(--font-size-base);
		font-weight: var(--font-weight-bold);
		color: var(--color-text);
		margin-bottom: 2px;
	}

	.node-amount {
		font-family: var(--font-display);
		font-size: var(--font-size-xl);
		font-weight: var(--font-weight-extrabold);
		margin-bottom: var(--space-sm);
	}

	.amount-net { color: var(--color-gold-dark); }
	[data-theme="dark"] .amount-net { color: var(--color-gold); }
	.amount-income { color: var(--color-teal); }
	.amount-expense { color: var(--color-coral); }
	.amount-lending { color: var(--color-sky); }
	.amount-recurring { color: var(--color-teal-dark); }

	.detail-stats {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: var(--space-sm) var(--space-md);
		background: var(--color-surface-inset);
		border-radius: var(--radius-lg);
		margin-bottom: var(--space-md);
	}

	.stat-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: var(--font-size-xs);
		padding: 3px 0;
	}

	.stat-label {
		color: var(--color-text-muted);
	}

	.stat-val {
		font-weight: var(--font-weight-bold);
		color: var(--color-text);
	}

	.recovery-progress-track {
		width: 100%;
		height: 6px;
		background: var(--color-hairline);
		border-radius: 3px;
		overflow: hidden;
		margin: 4px 0;
	}

	.recovery-progress-fill {
		height: 100%;
		background: var(--color-teal);
		border-radius: 3px;
		transition: width 300ms ease;
	}

	.highlight-row {
		border-top: 1px dashed var(--color-hairline);
		padding-top: var(--space-xs);
		margin-top: var(--space-xs);
	}

	.text-teal { color: var(--color-teal); }
	.text-coral { color: var(--color-coral); }
	.text-gold { color: var(--color-gold-dark); }
	[data-theme="dark"] .text-gold { color: var(--color-gold); }
	.text-sky { color: var(--color-sky); }
	.text-capitalize { text-transform: capitalize; }

	.detail-action-btn {
		display: block;
		width: 100%;
		text-align: center;
		padding: 8px var(--space-md);
		background: var(--color-teal-bg);
		color: var(--color-teal-dark);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-md);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-bold);
		text-decoration: none;
		transition: all 150ms var(--bounce);
	}

	.detail-action-btn:hover {
		background: var(--color-teal);
		color: #ffffff;
		transform: translateY(-1px);
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes popIn {
		from { opacity: 0; transform: scale(0.94) translateY(8px); }
		to { opacity: 1; transform: scale(1) translateY(0); }
	}
</style>

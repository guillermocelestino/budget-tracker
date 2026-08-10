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
		onclose
	}: {
		node: NodeDetailData | null;
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
</script>

{#if node}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
	<div class="detail-backdrop" onclick={onclose} role="presentation"></div>

	<!-- Drawer/Popover card -->
	<div class="detail-drawer flip7-card accent-{node.type === 'net' ? 'gold' : node.type === 'income' ? 'teal' : node.type === 'expense' ? 'coral' : node.type === 'lending' ? 'sky' : 'teal'}" role="dialog" aria-labelledby="node-title">
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

			<!-- Contextual details based on node type -->
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
						<span class="stat-val text-teal">{formatCurrency(node.cashPaid ?? 0)}</span>
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
	.detail-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(11, 17, 15, 0.45);
		backdrop-filter: blur(4px);
		-webkit-backdrop-filter: blur(4px);
		z-index: 998;
		animation: fadeIn 150ms ease;
	}

	.detail-drawer {
		position: fixed;
		bottom: var(--space-xl);
		right: var(--space-xl);
		width: 360px;
		max-width: calc(100vw - 32px);
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-2xl);
		box-shadow: var(--shadow-lg), var(--glow-card);
		z-index: 999;
		padding: var(--space-lg);
		animation: slideUp 200ms var(--bounce);
	}

	@media (max-width: 640px) {
		.detail-drawer {
			right: 16px;
			left: 16px;
			bottom: calc(72px + var(--safe-bottom));
			width: auto;
		}
	}

	.drawer-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--space-md);
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
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-bold);
		color: var(--color-text);
		margin-bottom: var(--space-xs);
	}

	.node-amount {
		font-family: var(--font-display);
		font-size: var(--font-size-2xl);
		font-weight: var(--font-weight-extrabold);
		margin-bottom: var(--space-md);
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
		gap: var(--space-xs);
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
		padding: 4px 0;
	}

	.stat-label {
		color: var(--color-text-muted);
	}

	.stat-val {
		font-weight: var(--font-weight-bold);
		color: var(--color-text);
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
		padding: 10px var(--space-md);
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

	@keyframes slideUp {
		from { opacity: 0; transform: translateY(12px) scale(0.96); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}
</style>

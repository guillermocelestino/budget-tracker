<script lang="ts">
	import { formatCurrency } from '$lib/client/utils/format';

	let {
		currentTotal = 0,
		projectedTotal = 0,
		type = 'expense',
		isRefund = false,
		categoryName = '',
	}: {
		currentTotal?: number;
		projectedTotal?: number;
		type?: 'expense' | 'income';
		isRefund?: boolean;
		categoryName?: string;
	} = $props();

	const hasChange = $derived(Math.abs(projectedTotal - currentTotal) > 0.001);
	const delta = $derived(Math.abs(projectedTotal - currentTotal));
</script>

{#if hasChange}
	<div class="impact-preview-card" class:income={type === 'income'} class:refund={isRefund}>
		<div class="preview-header">
			<span class="preview-title">
				{#if isRefund}
					↩ Refund Impact
				{:else if type === 'income'}
					💰 Income Impact
				{:else}
					📊 Spending Impact
				{/if}
			</span>
			{#if categoryName}
				<span class="preview-category">{categoryName}</span>
			{/if}
		</div>

		{#if isRefund}
			<p class="preview-refund-msg">
				This refund adds <strong>{formatCurrency(delta)}</strong> back into your monthly total.
			</p>
		{:else}
			<div class="stacked-impact">
				<div class="impact-col">
					<span class="impact-label">{type === 'income' ? 'Monthly Income' : 'Monthly Total'}</span>
					<span class="impact-val current">{formatCurrency(currentTotal)}</span>
				</div>
				<div class="impact-arrow">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
					</svg>
					<span class="arrow-sub">After saving</span>
				</div>
				<div class="impact-col">
					<span class="impact-label">Projected Total</span>
					<span class="impact-val projected" class:positive={type === 'income'} class:negative={type === 'expense'}>
						{formatCurrency(projectedTotal)}
					</span>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.impact-preview-card {
		background: var(--color-surface-inset);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-lg);
		padding: var(--space-md);
		margin-top: var(--space-md);
		transition: all 250ms var(--ease);
		animation: fadeIn 200ms var(--ease);
	}

	.preview-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--space-xs);
	}

	.preview-title {
		font-family: var(--font-display);
		font-size: var(--font-size-xs);
		font-weight: 700;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.preview-category {
		font-family: var(--font-body);
		font-size: var(--font-size-xs);
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.preview-refund-msg {
		font-size: var(--font-size-sm);
		color: var(--teal-deep);
		margin: 0;
		line-height: 1.4;
	}

	.stacked-impact {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-md);
		padding-top: var(--space-xs);
	}

	.impact-col {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.impact-label {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		font-weight: 500;
	}

	.impact-val {
		font-family: var(--font-display);
		font-size: var(--font-size-lg);
		font-weight: 700;
		color: var(--color-text);
	}

	.impact-val.current {
		opacity: 0.75;
	}

	.impact-val.projected.negative {
		color: var(--color-coral);
	}

	.impact-val.projected.positive {
		color: var(--color-teal);
	}

	.impact-arrow {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		color: var(--color-teal);
		opacity: 0.8;
	}

	.arrow-sub {
		font-size: 10px;
		font-weight: 600;
		color: var(--color-text-muted);
		white-space: nowrap;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.impact-preview-card {
			animation: none;
		}
	}
</style>

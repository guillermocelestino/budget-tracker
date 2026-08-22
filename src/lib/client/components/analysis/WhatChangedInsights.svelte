<script lang="ts">
	import type { StructuredInsight } from '$lib/server/services/analysis/analysisTypes';

	let { insights = [] }: { insights: StructuredInsight[] } = $props();

	function getSeverityIcon(severity: StructuredInsight['severity']): string {
		if (severity === 'positive') return '🌱';
		if (severity === 'warning') return '⚠️';
		if (severity === 'attention') return '💡';
		if (severity === 'info') return 'ℹ️';
		return '📌';
	}
</script>

<div class="insights-card">
	<div class="card-header">
		<h3 class="card-title">Key Insights</h3>
		<p class="card-subtitle">Data-driven financial insights for the selected period</p>
	</div>

	{#if insights.length === 0}
		<div class="empty-insights">
			<span>📊 Not enough data yet to produce insights for this period.</span>
		</div>
	{:else}
		<div class="insights-list">
			{#each insights as item (item.id)}
				<div class="insight-item severity-{item.severity}">
					<div class="insight-icon">{getSeverityIcon(item.severity)}</div>
					<div class="insight-content">
						<div class="insight-top">
							<span class="insight-title">{item.title}</span>
							{#if item.metric}
								<span class="insight-metric">{item.metric}</span>
							{/if}
						</div>
						<p class="insight-desc">{item.description}</p>
					</div>

					{#if item.value}
						<div class="insight-val-badge">
							<span class="val-main">{item.value}</span>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.insights-card {
		background: var(--color-surface, #ffffff);
		border: 1px solid var(--color-hairline, rgba(20, 48, 46, 0.08));
		border-radius: var(--radius-lg, 16px);
		padding: 20px;
		box-shadow: var(--shadow-card, 0 2px 8px rgba(0, 0, 0, 0.04));
		margin-bottom: 24px;
	}

	.card-header {
		margin-bottom: 16px;
	}

	.card-title {
		font-size: 1.125rem;
		font-weight: 800;
		color: var(--color-text-title, #14302e);
		margin: 0;
	}

	.card-subtitle {
		font-size: 0.8125rem;
		color: var(--color-text-subtitle, #5c7a78);
		margin: 2px 0 0 0;
	}

	.empty-insights {
		font-size: 0.875rem;
		color: var(--color-text-subtitle, #5c7a78);
		padding: 16px;
		background: rgba(20, 48, 46, 0.02);
		border-radius: var(--radius-md, 12px);
		text-align: center;
	}

	.insights-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.insight-item {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 14px 16px;
		border-radius: var(--radius-md, 12px);
		border: 1px solid var(--color-hairline, rgba(20, 48, 46, 0.08));
		background: rgba(20, 48, 46, 0.02);
		transition: transform 0.15s ease;
	}

	.insight-item:hover {
		transform: translateX(2px);
	}

	.insight-item.severity-positive {
		background: rgba(43, 168, 162, 0.04);
		border-color: rgba(43, 168, 162, 0.2);
	}

	.insight-item.severity-warning {
		background: rgba(239, 108, 74, 0.04);
		border-color: rgba(239, 108, 74, 0.2);
	}

	.insight-item.severity-attention {
		background: rgba(245, 158, 11, 0.04);
		border-color: rgba(245, 158, 11, 0.2);
	}

	.insight-item.severity-info {
		background: rgba(56, 189, 248, 0.04);
		border-color: rgba(56, 189, 248, 0.2);
	}

	.insight-icon {
		font-size: 1.2rem;
		flex-shrink: 0;
		margin-top: 1px;
	}

	.insight-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.insight-top {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.insight-title {
		font-size: 0.9375rem;
		font-weight: 700;
		color: var(--color-text-title, #14302e);
	}

	.insight-metric {
		font-size: 0.6875rem;
		font-weight: 700;
		text-transform: uppercase;
		background: rgba(0,0,0,0.05);
		color: var(--color-text-subtitle, #5c7a78);
		padding: 1px 6px;
		border-radius: 4px;
	}

	.insight-desc {
		font-size: 0.8125rem;
		color: var(--color-text-subtitle, #5c7a78);
		margin: 0;
		line-height: 1.4;
	}

	.insight-val-badge {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		font-size: 0.8125rem;
		flex-shrink: 0;
	}

	.val-main {
		font-weight: 800;
		color: var(--color-text-title, #14302e);
	}
</style>


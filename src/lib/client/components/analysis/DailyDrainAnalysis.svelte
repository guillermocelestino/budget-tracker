<script lang="ts">
	import { formatCurrency } from '$lib/client/utils/format';
	import type { DailyDrainData } from '$lib/server/services/analysis/analysisTypes';

	let { dailyDrain }: { dailyDrain: DailyDrainData } = $props();
</script>

<div class="daily-drain-card">
	<div class="card-header">
		<h3 class="card-title">Daily Drain Analysis</h3>
		<p class="card-subtitle">Which days are draining your pocket the most?</p>
	</div>

	<div class="drain-stats-grid">
		<!-- Avg Daily Drain -->
		<div class="stat-tile">
			<span class="stat-label">Avg Daily Drain</span>
			<span class="stat-val">{formatCurrency(dailyDrain.avgDailyDrain)}</span>
		</div>

		<!-- Highest Drain Day -->
		{#if dailyDrain.highestDrainDay}
			<div class="stat-tile tile-peak">
				<span class="stat-label">Highest Drain Day</span>
				<span class="stat-val text-peak">{dailyDrain.highestDrainDay.dayOfWeek}</span>
				<span class="stat-sub">{formatCurrency(dailyDrain.highestDrainDay.amount)} ({dailyDrain.highestDrainDay.date})</span>
			</div>
		{/if}

		<!-- Lowest Drain Day -->
		{#if dailyDrain.lowestDrainDay}
			<div class="stat-tile tile-low">
				<span class="stat-label">Lowest Drain Day</span>
				<span class="stat-val text-low">{dailyDrain.lowestDrainDay.dayOfWeek}</span>
				<span class="stat-sub">{formatCurrency(dailyDrain.lowestDrainDay.amount)} ({dailyDrain.lowestDrainDay.date})</span>
			</div>
		{/if}
	</div>

	{#if dailyDrain.unusuallyHighDays.length > 0}
		<div class="high-days-box">
			<h4 class="box-title">⚡ Unusually High Drain Days</h4>
			<div class="high-days-list">
				{#each dailyDrain.unusuallyHighDays.slice(0, 4) as day (day.date)}
					<div class="high-day-chip">
						<span class="day-date">{day.date}</span>
						<span class="day-amt">{formatCurrency(day.amount)}</span>
						<span class="day-ratio">{day.ratioToAvg}x avg</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.daily-drain-card {
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

	.drain-stats-grid {
		display: grid;
		grid-template-columns: repeat(1, 1fr);
		gap: 12px;
		margin-bottom: 16px;
	}

	@media (min-width: 640px) {
		.drain-stats-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	.stat-tile {
		background: rgba(20, 48, 46, 0.02);
		border: 1px solid var(--color-hairline, rgba(20, 48, 46, 0.06));
		border-radius: var(--radius-md, 12px);
		padding: 12px 14px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.stat-label {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--color-text-subtitle, #5c7a78);
		text-transform: uppercase;
	}

	.stat-val {
		font-size: 1.25rem;
		font-weight: 800;
		color: var(--color-text-title, #14302e);
	}

	.stat-sub {
		font-size: 0.75rem;
		color: var(--color-text-subtitle, #5c7a78);
	}

	.text-peak {
		color: var(--color-coral-base, #ef6c4a);
	}

	.text-low {
		color: var(--color-teal-base, #2ba8a2);
	}

	.high-days-box {
		background: rgba(239, 108, 74, 0.04);
		border: 1px dashed rgba(239, 108, 74, 0.2);
		border-radius: var(--radius-md, 12px);
		padding: 12px 16px;
	}

	.box-title {
		font-size: 0.8125rem;
		font-weight: 700;
		color: var(--color-coral-base, #ef6c4a);
		margin: 0 0 8px 0;
	}

	.high-days-list {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.high-day-chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		background: #ffffff;
		border: 1px solid rgba(239, 108, 74, 0.2);
		border-radius: var(--radius-pill, 9999px);
		font-size: 0.75rem;
	}

	.day-date { font-weight: 600; color: var(--color-text-subtitle, #5c7a78); }
	.day-amt { font-weight: 800; color: var(--color-text-title, #14302e); }
	.day-ratio { font-weight: 700; color: var(--color-coral-base, #ef6c4a); }
</style>

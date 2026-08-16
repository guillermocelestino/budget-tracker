<script lang="ts">
	import { formatCurrency } from '$lib/client/utils/format';
	import { getMonthLabel, getCurrentMonth, getToday } from '$lib/shared/utils/format';

	export interface DailyOutflowItem {
		date: string; // YYYY-MM-DD
		amount: number;
	}

	let {
		dailyOutflows = [],
		monthStr = ''
	}: {
		dailyOutflows?: DailyOutflowItem[];
		monthStr?: string;
	} = $props();

	const activeMonth = $derived(monthStr || getCurrentMonth());
	const calendarMonth = getCurrentMonth();
	const todayStr = getToday();
	const isThisMonth = $derived(activeMonth === calendarMonth);

	const monthName = $derived(getMonthLabel(activeMonth).toUpperCase());

	const yearMonth = $derived.by(() => {
		const parts = activeMonth.split('-');
		const y = parseInt(parts[0], 10) || new Date().getFullYear();
		const m = parseInt(parts[1], 10) || (new Date().getMonth() + 1);
		return { year: y, month: m };
	});

	const daysInMonth = $derived(
		new Date(yearMonth.year, yearMonth.month, 0).getDate()
	);

	const daysInText = $derived.by(() => {
		if (isThisMonth) {
			const currentDay = new Date().getDate();
			const elapsed = Math.min(currentDay, daysInMonth);
			return `${elapsed} days in`;
		}
		if (activeMonth < calendarMonth) {
			return `${daysInMonth} days in`;
		}
		return '0 days in';
	});

	const dailyMap = $derived.by(() => {
		const map = new Map<string, number>();
		for (const item of dailyOutflows) {
			map.set(item.date, item.amount);
		}
		return map;
	});

	const monthDays = $derived.by(() => {
		const result = [];
		const y = yearMonth.year;
		const mStr = String(yearMonth.month).padStart(2, '0');

		for (let day = 1; day <= daysInMonth; day++) {
			const dayStr = String(day).padStart(2, '0');
			const fullDate = `${y}-${mStr}-${dayStr}`;
			const amount = dailyMap.get(fullDate) ?? 0;
			const isToday = fullDate === todayStr;

			result.push({
				day,
				fullDate,
				amount,
				isToday
			});
		}
		return result;
	});

	const maxOutflow = $derived.by(() => {
		if (monthDays.length === 0) return 1;
		const max = Math.max(...monthDays.map(d => d.amount));
		return max > 0 ? max : 1;
	});

	let hoveredDay = $state<{ day: number; fullDate: string; amount: number } | null>(null);
</script>

<div class="daily-drain-card">
	<div class="card-header">
		<h2 class="card-title">DAILY DRAIN · {monthName}</h2>
		<span class="days-in-tag">{daysInText}</span>
	</div>

	{#if hoveredDay}
		<div class="active-day-readout">
			<span class="readout-date">Day {hoveredDay.day} ({hoveredDay.fullDate})</span>
			<span class="readout-amount">{formatCurrency(hoveredDay.amount)}</span>
		</div>
	{:else}
		<div class="active-day-readout hint">
			<span class="readout-date">Tap bar for daily breakdown</span>
			<span class="readout-amount">Peak: {formatCurrency(maxOutflow > 1 ? maxOutflow : 0)}</span>
		</div>
	{/if}

	<div class="chart-container">
		<div class="bars-flex">
			{#each monthDays as item, i (item.fullDate)}
				{@const hasAmount = item.amount > 0}
				{@const pct = hasAmount ? Math.max(10, Math.round((item.amount / maxOutflow) * 100)) : 0}
				
				<button
					type="button"
					class="bar-wrapper"
					class:is-today={item.isToday}
					class:has-amount={hasAmount}
					style="--index: {i};"
					onclick={() => (hoveredDay = item)}
					onmouseenter={() => (hoveredDay = item)}
					onmouseleave={() => (hoveredDay = null)}
					aria-label="Day {item.day}: {formatCurrency(item.amount)}"
				>
					<div class="bar-track-col">
						<div
							class="bar-col-fill"
							style:height={hasAmount ? `${pct}%` : '2px'}
						></div>
					</div>
				</button>
			{/each}
		</div>

		<!-- Date axis ticks -->
		<div class="date-axis">
			<span class="axis-tick">1</span>
			<span class="axis-tick">10</span>
			<span class="axis-tick">20</span>
			<span class="axis-tick">{daysInMonth}</span>
		</div>
	</div>
</div>

<style>
	.daily-drain-card {
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-2xl, 20px);
		padding: 16px 20px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		box-shadow: var(--shadow-sm);
	}

	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.card-title {
		font-family: var(--font-display);
		font-size: 13px;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-ink);
		margin: 0;
	}

	.days-in-tag {
		font-family: var(--font-display);
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.08em;
		color: var(--color-text-muted);
		text-transform: uppercase;
	}

	/* ─── Active Readout ─── */
	.active-day-readout {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--color-surface-inset, rgba(0, 0, 0, 0.04));
		border-radius: var(--radius-lg, 12px);
		padding: 6px 12px;
		min-height: 32px;
	}

	.active-day-readout.hint .readout-date {
		color: var(--color-text-muted);
		font-weight: 600;
	}

	.readout-date {
		font-size: 11px;
		font-weight: 700;
		color: var(--color-ink);
	}

	.readout-amount {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 800;
		color: var(--color-money-gone, #EF6C4A);
	}

	/* ─── Chart ─── */
	.chart-container {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.bars-flex {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		height: 120px;
		gap: 2px;
		padding-top: 8px;
		border-bottom: 1px solid var(--color-hairline);
	}

	.bar-wrapper {
		flex: 1;
		min-width: 0;
		height: 100%;
		background: transparent;
		border: none;
		padding: 0;
		margin: 0;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		align-items: center;
		outline: none;
		position: relative;
	}

	.bar-track-col {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		align-items: center;
	}

	.bar-col-fill {
		width: 100%;
		background: rgba(239, 108, 74, 0.45);
		border-radius: 3px 3px 0 0;
		transition: height 350ms cubic-bezier(0.16, 1, 0.3, 1), background 150ms ease;
		animation: growUp 400ms cubic-bezier(0.16, 1, 0.3, 1) backwards;
		animation-delay: calc(var(--index) * 12ms);
	}

	/* Zero value baseline */
	.bar-wrapper:not(.has-amount) .bar-col-fill {
		background: var(--color-hairline, rgba(255, 255, 255, 0.15));
		border-radius: 1px;
	}

	/* Hover / Active state */
	.bar-wrapper:hover .bar-col-fill,
	.bar-wrapper:focus .bar-col-fill {
		background: var(--color-money-gone, #EF6C4A);
		box-shadow: 0 0 8px rgba(239, 108, 74, 0.6);
	}

	/* Today's bar emphasis */
	.bar-wrapper.is-today .bar-col-fill {
		background: var(--color-gold, #FFD23F);
		box-shadow: 0 0 10px rgba(255, 210, 63, 0.7);
	}

	.bar-wrapper.is-today.has-amount .bar-col-fill {
		background: var(--color-money-gone, #EF6C4A);
		outline: 1.5px solid var(--color-gold, #FFD23F);
		box-shadow: 0 0 10px rgba(239, 108, 74, 0.8);
	}

	/* ─── Axis Ticks ─── */
	.date-axis {
		display: flex;
		justify-content: space-between;
		padding: 2px 2px 0 2px;
	}

	.axis-tick {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		color: var(--color-text-muted);
	}

	/* ─── Animations & Accessibility ─── */
	@keyframes growUp {
		from {
			transform: scaleY(0);
			transform-origin: bottom;
		}
		to {
			transform: scaleY(1);
			transform-origin: bottom;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.bar-col-fill {
			animation: none !important;
			transition: none !important;
		}
	}
</style>

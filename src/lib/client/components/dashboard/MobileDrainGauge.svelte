<script lang="ts">
	import { formatCurrency } from '$lib/client/utils/format';

	let {
		totalMoneyOut = 0,
		monthStr = '',
		expenseChange = 0
	}: {
		totalMoneyOut?: number;
		monthStr?: string;
		expenseChange?: number;
	} = $props();

	// Calculate elapsed days in the selected month
	const daysElapsed = $derived.by(() => {
		const now = new Date();
		const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

		if (!monthStr || monthStr === currentYearMonth) {
			return Math.max(1, now.getDate());
		}
		const [y, m] = monthStr.split('-').map(Number);
		return new Date(y, m, 0).getDate();
	});

	// Current daily money-out rate
	const dailyRate = $derived(daysElapsed > 0 ? Math.round(totalMoneyOut / daysElapsed) : 0);

	// Total calendar days in previous month
	const prevMonthDays = $derived.by(() => {
		const now = new Date();
		const targetStr = monthStr || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
		const [y, m] = targetStr.split('-').map(Number);
		const prevDate = new Date(y, m - 1, 0); // last day of previous month
		return prevDate.getDate();
	});

	// Previous month daily money-out rate
	const prevDailyRate = $derived.by(() => {
		if (expenseChange === 0 || totalMoneyOut <= 0) return null;
		const factor = 1 + (expenseChange / 100);
		if (factor <= 0) return null;
		const prevTotal = totalMoneyOut / factor;
		return Math.max(0, Math.round(prevTotal / prevMonthDays));
	});

	// Rate change percentage vs previous month's daily rate
	const rateChange = $derived.by(() => {
		if (prevDailyRate === null || prevDailyRate === 0) return expenseChange;
		return ((dailyRate - prevDailyRate) / prevDailyRate) * 100;
	});

	/**
	 * Severity threshold logic:
	 * - HIGH / Bleeding (🔥): rateChange > 25%
	 * - MEDIUM / Draining (🩸): 5% < rateChange <= 25%
	 * - LOW / Calm (😌): rateChange <= 5%
	 */
	const severity = $derived.by(() => {
		if (rateChange > 25) {
			return {
				level: 'HIGH',
				emoji: '🔥',
				label: 'Bleeding',
				color: 'var(--color-coral, #EF6C4A)',
				bg: 'rgba(239, 108, 74, 0.14)',
				angle: 324, // 90% fill
				glow: 'rgba(239, 108, 74, 0.35)'
			};
		}
		if (rateChange > 5) {
			return {
				level: 'MEDIUM',
				emoji: '🩸',
				label: 'Draining',
				color: 'var(--color-gold-dark, #D97706)',
				bg: 'rgba(217, 119, 6, 0.14)',
				angle: 216, // 60% fill
				glow: 'rgba(217, 119, 6, 0.35)'
			};
		}
		return {
			level: 'LOW',
			emoji: '😌',
			label: 'Calm',
			color: 'var(--color-teal, #2BA8A2)',
			bg: 'rgba(43, 168, 162, 0.14)',
			angle: 90, // 25% fill
			glow: 'rgba(43, 168, 162, 0.3)'
		};
	});

</script>

<div class="drain-gauge-card">
	<!-- Circular Conic-Gradient Donut Gauge -->
	<div
		class="donut-ring"
		style:--gauge-color={severity.color}
		style:--gauge-bg={severity.bg}
		style:--gauge-angle="{severity.angle}deg"
		style:--gauge-glow={severity.glow}
	>
		<div class="ring-center">
			<span class="emoji-icon">{severity.emoji}</span>
			<span
				class="status-label"
				style:color={severity.color}
			>
				{severity.label}
			</span>
		</div>
	</div>

	<!-- Diagnostic Subtext & Baseline Comparison Chip -->
	<div class="rate-diagnostic-wrap">
		<div class="main-rate-pill" style:background={severity.bg} style:color={severity.color}>
			<span class="pill-title">{severity.label} ~{formatCurrency(dailyRate)}/day</span>
		</div>
		{#if prevDailyRate !== null}
			<div class="baseline-chip">
				<span class="chip-dot" style:background={severity.color}></span>
				<span class="chip-label">
					{dailyRate > prevDailyRate ? 'Up from' : (dailyRate < prevDailyRate ? 'Down from' : 'Same as')}
					<strong>{formatCurrency(prevDailyRate)}/day</strong> last month
				</span>
			</div>
		{/if}
	</div>
</div>

<style>
	.drain-gauge-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 4px 0;
		width: 100%;
		height: 100%;
	}

	.donut-ring {
		position: relative;
		width: 130px;
		height: 130px;
		border-radius: 50%;
		background: conic-gradient(
			var(--gauge-color) 0deg var(--gauge-angle),
			var(--gauge-bg) var(--gauge-angle) 360deg
		);
		box-shadow: 0 0 20px var(--gauge-glow);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 300ms ease;
		flex-shrink: 0;
	}

	.ring-center {
		width: 100px;
		height: 100px;
		border-radius: 50%;
		background: var(--color-surface);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.08);
		padding: 6px;
		gap: 2px;
	}

	.emoji-icon {
		font-size: 26px;
		line-height: 1;
	}

	.status-label {
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.03em;
	}

	.rate-diagnostic-wrap {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		width: 100%;
	}

	.main-rate-pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 6px 14px;
		border-radius: var(--radius-pill, 999px);
		font-family: var(--font-display);
		font-size: 13px;
		font-weight: 800;
		letter-spacing: -0.01em;
		text-align: center;
	}

	.baseline-chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		background: var(--color-surface-inset, rgba(0, 0, 0, 0.04));
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-pill, 999px);
		font-size: 11px;
		color: var(--color-text-muted);
	}

	.chip-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.chip-label strong {
		color: var(--color-ink);
		font-family: var(--font-mono);
		font-weight: 700;
	}

	@media (prefers-reduced-motion: reduce) {
		.donut-ring {
			transition: none !important;
		}
	}
</style>

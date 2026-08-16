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

	const comparisonText = $derived.by(() => {
		if (prevDailyRate === null) return '';
		if (dailyRate > prevDailyRate) return `— up from ${formatCurrency(prevDailyRate)}.`;
		if (dailyRate < prevDailyRate) return `— down from ${formatCurrency(prevDailyRate)}.`;
		return '— same as last month.';
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

	<!-- Diagnostic Subtext -->
	<div class="rate-diagnostic-text">
		<strong>{severity.label} ~{formatCurrency(dailyRate)}/day</strong>
		{#if comparisonText}
			<span class="comparison-subtext"> {comparisonText}</span>
		{/if}
	</div>
</div>

<style>
	.drain-gauge-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
		padding: 4px 0 8px 0;
		width: 100%;
	}

	.donut-ring {
		position: relative;
		width: 140px;
		height: 140px;
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
	}

	.ring-center {
		width: 110px;
		height: 110px;
		border-radius: 50%;
		background: var(--color-surface);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.08);
		padding: 6px;
		gap: 4px;
	}

	.emoji-icon {
		font-size: 28px;
		line-height: 1;
	}

	.status-label {
		font-family: var(--font-display);
		font-size: 13px;
		font-weight: 800;
		letter-spacing: 0.03em;
	}

	.rate-diagnostic-text {
		text-align: center;
		font-size: 13px;
		line-height: 1.4;
		color: var(--color-ink);
	}

	.comparison-subtext {
		color: var(--color-text-muted);
		font-weight: 500;
	}

	@media (prefers-reduced-motion: reduce) {
		.donut-ring {
			transition: none !important;
		}
	}
</style>

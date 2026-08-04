<script lang="ts">
	import { page } from '$app/stores';
	import DashboardHero from '$lib/components/DashboardHero.svelte';
	import KpiRail from '$lib/components/KpiRail.svelte';
	import SafeToSpendWidget from '$lib/components/SafeToSpendWidget.svelte';
	import ForecastBanner from '$lib/components/ForecastBanner.svelte';
	import CashFlowChart from '$lib/components/CashFlowChart.svelte';
	import RecentActivityWidget from '$lib/components/RecentActivityWidget.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import CategoryBreakdownWidget from '$lib/components/CategoryBreakdownWidget.svelte';
	import PageBackground from '$lib/components/PageBackground.svelte';
	import { getCurrentMonth, getMonthLabel } from '$lib/utils/format';
	let data = $derived($page.data as App.PageData);

	// ─── Forecast computation ───

	const now = new Date();
	const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
	const daysElapsed = now.getDate();
	const daysRemaining = daysInMonth - daysElapsed;
	const avgDailySpend = $derived(daysElapsed > 0
		? (data.summary?.totalExpenses ?? 0) / daysElapsed
		: 0);

	const categoryItems = $derived(
		(data.categoryLabels ?? []).map((name, i) => ({
			name,
			total: (data.categoryData ?? [])[i] || 0,
			color: (data.categoryColors ?? [])[i] || '#6366f1',
		}))
	);

	// Context subline — mirrors /transactions and /lending header format
	const contextSubline = $derived.by(() => {
		const monthLabel = getMonthLabel(getCurrentMonth());
		const rate = Math.round(data.summary?.savingsRate ?? 0);
		return `${monthLabel} · Savings rate ${rate}%`;
	});
</script>

<svelte:head>
	<title>Dashboard — Finance Tracker</title>
</svelte:head>

<PageHeader title="Dashboard" flush>
	{#snippet subtitle()}
		<span class="context-subline">{contextSubline}</span>
	{/snippet}
</PageHeader>

<PageBackground />

<!-- ═══ Section 1: Hero — Net Balance + Key Deltas + Lending Footer ═══ -->
<div class="dashboard-section">
	<DashboardHero
		balance={data.summary?.balance ?? 0}
		savingsRate={data.summary?.savingsRate ?? 0}
		lendingSummary={data.lendingSummary}
		incomeChange={data.incomeChange}
		expenseChange={data.expenseChange}
	/>
</div>

<!-- ═══ Section 2: Insights — Available to Spend + Forecast (equal height) ═══ -->
<div class="dashboard-section">
	<div class="insights-row">
		<SafeToSpendWidget
			income={data.summary?.totalIncome ?? 0}
			budgeted={data.totalBudgeted ?? 0}
			spentSoFar={data.summary?.totalExpenses ?? 0}
		/>

		<ForecastBanner
			currentBalance={data.summary?.balance ?? 0}
			totalIncome={data.summary?.totalIncome ?? 0}
			{avgDailySpend}
			{daysRemaining}
		/>
	</div>
</div>

<!-- ═══ Section 3: Recent Activity (compact, above charts on mobile) ═══ -->
<div class="dashboard-section">
	<div class="activity-section">
		<RecentActivityWidget
			transactions={data.recentTransactions ?? []}
		/>
	</div>
</div>

<!-- ═══ Section 4: Charts — Cash Flow (full width) + Category (tall) ═══ -->
<div class="dashboard-section">
	<div class="charts-row">
	{#if data.trendLabels && data.trendLabels.length > 1}
		<div class="chart-card flip7-card">
			<div class="chart-header">
				<h2 class="section-title">Cash Flow</h2>
			</div>
			<div class="chart-body">
				<CashFlowChart
					labels={data.trendLabels ?? []}
					incomeData={data.trendIncome ?? []}
					expenseData={data.trendExpenses ?? []}
				/>
			</div>
		</div>
	{/if}

	{#if data.categoryLabels && data.categoryLabels.length > 0}
		<div class="chart-card flip7-card">
			<div class="chart-header">
				<h2 class="section-title">Spending by Category</h2>
			</div>
			<div class="chart-body">
				<CategoryBreakdownWidget
					categories={categoryItems}
				/>
			</div>
		</div>
	{/if}
	</div>
</div>

<!-- ═══ Section 5: KPI Rail — Primary + Compact Cards (bottom, out of the fold) ═══ -->
<div class="dashboard-section">
	<KpiRail
		income={data.summary?.totalIncome ?? 0}
		incomeChange={data.incomeChange}
		incomeTrend={data.trendIncome ?? []}
		incomeLabels={data.trendLabels ?? []}
		expenses={data.summary?.totalExpenses ?? 0}
		expenseChange={data.expenseChange}
		expenseTrend={data.trendExpenses ?? []}
		expenseLabels={data.trendLabels ?? []}
		lentOutstanding={data.lendingSummary?.outstanding ?? 0}
		recovered={data.lendingSummary?.totalRecovered ?? 0}
		borrowedOutstanding={data.borrowedSummary?.outstanding ?? 0}
		repaid={data.borrowedSummary?.totalRepaid ?? 0}
	/>
</div>

<style>
	/* ─── Page header (matches /transactions + /lending) ─── */
	:global(.page-header) {
		position: relative;
		z-index: 30;
	}

	.context-subline {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		font-size: var(--font-size-xs);
		letter-spacing: 0.02em;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		flex-wrap: wrap;
		min-width: 0;
	}

	.btn-lead {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 18px;
		height: 18px;
		font-weight: var(--font-weight-extrabold);
	}

	.desktop-only {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	@media (max-width: 768px) {
		.desktop-only {
			display: none !important;
		}
	}

	/* ═══ Section Spacing — 8pt Rhythm ═══ */
	.section-title {
		font-size: var(--font-size-lg);
		color: var(--color-text);
		font-weight: 600;
		margin: 0 0 var(--space-sm);
	}

	/* Insights Row: 2 cards side by side on desktop — equal height */
	.insights-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-md);
		margin-bottom: var(--space-xl);
		align-items: stretch;
	}

	.insights-row > * {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	/* Charts Row: single column — Cash Flow full-width, Category tall below */
	.charts-row {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--space-md);
		margin-bottom: var(--space-xl);
	}

	/* Chart Card Wrapper — aspect-ratio driven, no fixed height */
	.chart-card {
		padding: var(--space-lg);
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.chart-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--space-md);
		flex-wrap: wrap;
		gap: var(--space-sm);
	}

	.chart-body {
		flex: 1;
		min-height: 0;
		width: 100%;
	}

	/* Activity Section — between insights and charts on all viewports */
	.activity-section {
		margin-bottom: var(--space-xl);
	}

	/* Stagger Animation */
	.dashboard-section {
		animation: fadeSlideUp 400ms var(--ease) both;
	}
	.dashboard-section:nth-child(1) { animation-delay: 0ms; }
	.dashboard-section:nth-child(2) { animation-delay: 80ms; }
	.dashboard-section:nth-child(3) { animation-delay: 160ms; }
	.dashboard-section:nth-child(4) { animation-delay: 240ms; }
	.dashboard-section:nth-child(5) { animation-delay: 320ms; }

	@keyframes fadeSlideUp {
		from { opacity: 0; transform: translateY(12px); }
		to { opacity: 1; transform: translateY(0); }
	}

	/* ════════════════════════════════════════
	   RESPONSIVE
	   ════════════════════════════════════════ */

	@media (max-width: 1024px) {
		.insights-row,
		.charts-row {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 768px) {
		.insights-row,
		.charts-row {
			grid-template-columns: 1fr;
			gap: var(--space-md);
		}

		.chart-card {
			padding: var(--space-md);
		}
	}

	@media (max-width: 480px) {
		.chart-card {
			padding: var(--space-sm);
			border-radius: var(--radius-lg);
		}

		.section-title {
			font-size: var(--font-size-base);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.chart-card,
		.insights-row > *,
		.charts-row > *,
		.dashboard-section {
			animation: none;
			transition: none;
		}
	}
</style>
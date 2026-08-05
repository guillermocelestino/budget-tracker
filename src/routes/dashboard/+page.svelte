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
	import { getCurrentMonth, getMonthLabel, formatDate, formatCurrency } from '$lib/utils/format';
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

	// Upcoming recurring items
	const upcomingRecurring = $derived(data.upcomingRecurring ?? []);
	const upcomingWithDays = $derived(upcomingRecurring.map(rec => {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const nextRun = new Date(rec.next_run + 'T00:00:00');
		const diffDays = Math.ceil((nextRun.getTime() - today.getTime()) / 86400000);
		let label: string;
		if (diffDays === 0) label = 'Today';
		else if (diffDays === 1) label = 'Tomorrow';
		else if (diffDays > 1 && diffDays <= 7) label = `In ${diffDays} days`;
		else label = formatDate(rec.next_run);
		return { ...rec, label };
	}));

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

<!-- ═══ Section 3.5: Upcoming Recurring ═══ -->
{#if upcomingWithDays.length > 0}
<div class="dashboard-section">
	<div class="upcoming-recurring-section flip7-card">
		<div class="upcoming-header">
			<h2 class="section-title">Upcoming Recurring</h2>
			<a href="/recurring" class="view-all-link">View all</a>
		</div>
		<div class="upcoming-list">
			{#each upcomingWithDays as rec (rec.id)}
				<div class="upcoming-item">
					<div class="upcoming-icon" style="background: {rec.category_color || '#2BA8A2'}20; color: {rec.category_color || '#2BA8A2'}">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
					</div>
					<div class="upcoming-info">
						<span class="upcoming-name">{rec.description}</span>
						<span class="upcoming-meta">{rec.frequency} · {rec.category_name}</span>
					</div>
					<div class="upcoming-amount" style="color: {rec.type === 'income' ? 'var(--color-teal)' : 'var(--color-coral)'}">
						{rec.type === 'income' ? '+' : '−'}{formatCurrency(rec.amount)}
					</div>
					<span class="upcoming-date">{rec.label}</span>
				</div>
			{/each}
		</div>
	</div>
</div>
{/if}

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

	/* Upcoming Recurring Section */
	.upcoming-recurring-section {
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-xl);
		padding: var(--space-lg);
		/* Match the 24px vertical rhythm of the other dashboard sections
		   (insights-row, activity-section, charts-row) */
		margin-bottom: var(--space-xl);
	}

	.upcoming-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--space-md);
	}

	.view-all-link {
		font-family: var(--font-display);
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-teal);
		text-decoration: none;
		transition: color 150ms var(--ease);
	}

	.view-all-link:hover {
		color: var(--color-teal-dark);
		text-decoration: underline;
	}

	.upcoming-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.upcoming-item {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		padding: var(--space-sm);
		border-radius: var(--radius-md);
		transition: background 150ms var(--ease);
	}

	.upcoming-item:hover {
		background: var(--color-surface-hover);
	}

	.upcoming-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: var(--radius-md);
		flex-shrink: 0;
	}

	.upcoming-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
		min-width: 0;
	}

	.upcoming-name {
		font-family: var(--font-body);
		font-size: var(--font-size-sm);
		font-weight: 500;
		color: var(--color-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.upcoming-meta {
		font-family: var(--font-mono);
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	.upcoming-amount {
		font-family: var(--font-display);
		font-size: var(--font-size-sm);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		flex-shrink: 0;
	}

	.upcoming-date {
		font-family: var(--font-mono);
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		background: var(--color-bg);
		padding: 2px 8px;
		border-radius: var(--radius-pill);
		flex-shrink: 0;
		white-space: nowrap;
	}

	@media (max-width: 480px) {
		.upcoming-recurring-section {
			padding: var(--space-md);
		}

		.upcoming-item {
			flex-wrap: wrap;
		}

		.upcoming-info {
			flex: 1 1 calc(100% - 60px);
		}

		.upcoming-amount {
			order: -1;
			margin-left: auto;
		}

		.upcoming-date {
			width: 100%;
			text-align: right;
			margin-top: var(--space-xs);
		}
	}
</style>
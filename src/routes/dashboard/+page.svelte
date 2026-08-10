<script lang="ts">
	import { page } from '$app/stores';
	import PageHeader from '$lib/client/components/PageHeader.svelte';
	import PageBackground from '$lib/client/components/PageBackground.svelte';
	import TopKpiGrid from '$lib/client/components/TopKpiGrid.svelte';
	import CashFlowChart from '$lib/client/components/CashFlowChart.svelte';
	import CategoryBreakdownWidget from '$lib/client/components/CategoryBreakdownWidget.svelte';
	import ForecastBanner from '$lib/client/components/ForecastBanner.svelte';
	import FinancialPositionWidget from '$lib/client/components/FinancialPositionWidget.svelte';
	import RecentActivityWidget from '$lib/client/components/RecentActivityWidget.svelte';
	import UpcomingRecurringWidget from '$lib/client/components/UpcomingRecurringWidget.svelte';
	import { formatDate } from '$lib/client/utils/format';
	import { getCurrentMonth, getMonthLabel } from '$lib/shared/utils/format';

	let data = $derived($page.data as App.PageData);

	// ─── Forecast computation ───
	const now = new Date();
	const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
	const daysElapsed = now.getDate();
	const daysRemaining = daysInMonth - daysElapsed;
	const avgDailySpend = $derived(daysElapsed > 0
		? (data.summary?.totalExpenses ?? 0) / daysElapsed
		: 0);

	// ─── Category items ───
	const categoryItems = $derived(
		(data.categoryLabels ?? []).map((name, i) => ({
			name,
			total: (data.categoryData ?? [])[i] || 0,
			color: (data.categoryColors ?? [])[i] || '#2BA8A2',
		}))
	);

	// ─── Upcoming recurring items ───
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

	// ─── Context subline ───
	const contextSubline = $derived.by(() => {
		const monthLabel = getMonthLabel(getCurrentMonth());
		const rate = Math.round(data.summary?.savingsRate ?? 0);
		return `${monthLabel} · Savings rate ${rate}%`;
	});
</script>

<svelte:head>
	<title>Dashboard — Finance Tracker</title>
</svelte:head>

<PageHeader title="Dashboard" flush borderless>
	{#snippet subtitle()}
		<span class="context-subline">{contextSubline}</span>
	{/snippet}
</PageHeader>

<PageBackground />

<div class="dashboard-shell">
	<!-- ════ LAYER 1: TOP KPI SUMMARY (Above the Fold) ════ -->
	<section class="dashboard-section">
		<TopKpiGrid
			balance={data.summary?.balance ?? 0}
			savingsRate={data.summary?.savingsRate ?? 0}
			income={data.summary?.totalIncome ?? 0}
			incomeChange={data.incomeChange}
			incomeTrend={data.trendIncome ?? []}
			incomeLabels={data.trendLabels ?? []}
			expenses={data.summary?.totalExpenses ?? 0}
			expenseChange={data.expenseChange}
			expenseTrend={data.trendExpenses ?? []}
			expenseLabels={data.trendLabels ?? []}
			budgeted={data.totalBudgeted ?? 0}
		/>
	</section>

	<!-- ════ LAYER 2: PRIMARY FINANCIAL ANALYSIS (Cash Flow 2/3 + Categories 1/3) ════ -->
	<section class="dashboard-section">
		<div class="viz-grid">
			<div class="viz-main flip7-card">
				<div class="card-header">
					<h2 class="card-title">Cash Flow Trend</h2>
					<span class="card-subtitle">Monthly Income vs. Expenses</span>
				</div>
				<div class="card-body">
					<CashFlowChart
						labels={data.trendLabels ?? []}
						incomeData={data.trendIncome ?? []}
						expenseData={data.trendExpenses ?? []}
					/>
				</div>
			</div>

			<div class="viz-side flip7-card">
				<div class="card-header">
					<h2 class="card-title">Spending by Category</h2>
					<span class="card-subtitle">Top Expense Breakdown</span>
				</div>
				<div class="card-body">
					<CategoryBreakdownWidget categories={categoryItems} />
				</div>
			</div>
		</div>
	</section>

	<!-- ════ LAYER 3: SECONDARY INSIGHTS (Forecast 1/2 + Financial Position 1/2) ════ -->
	<section class="dashboard-section">
		<div class="insights-grid">
			<ForecastBanner
				currentBalance={data.summary?.balance ?? 0}
				totalIncome={data.summary?.totalIncome ?? 0}
				{avgDailySpend}
				{daysRemaining}
			/>

			<FinancialPositionWidget
				netWorth={data.netWorth}
				lendingSummary={data.lendingSummary}
				borrowedSummary={data.borrowedSummary}
			/>
		</div>
	</section>

	<!-- ════ LAYER 4: RECENT ACTIVITY & UPCOMING RECURRING (Activity 1/2 + Upcoming 1/2) ════ -->
	<section class="dashboard-section">
		<div class="activity-grid">
			<RecentActivityWidget transactions={data.recentTransactions ?? []} />

			<UpcomingRecurringWidget items={upcomingWithDays} />
		</div>
	</section>
</div>

<style>
	:global(.page-header) {
		position: relative;
		z-index: 30;
	}

	.context-subline {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		font-size: var(--font-size-xs);
		letter-spacing: 0.02em;
		color: var(--color-text-muted);
	}

	/* ─── Dashboard Shell ─── */
	.dashboard-shell {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
		padding-bottom: var(--space-3xl);
	}

	/* ─── Staggered Entrance Animation ─── */
	.dashboard-section {
		animation: fadeSlideUp 400ms var(--ease) both;
	}
	.dashboard-section:nth-child(1) { animation-delay: 0ms; }
	.dashboard-section:nth-child(2) { animation-delay: 80ms; }
	.dashboard-section:nth-child(3) { animation-delay: 160ms; }
	.dashboard-section:nth-child(4) { animation-delay: 240ms; }

	@keyframes fadeSlideUp {
		from { opacity: 0; transform: translateY(12px); }
		to { opacity: 1; transform: translateY(0); }
	}

	/* ─── Layer 2: Visual Grid (2/3 Cash Flow + 1/3 Category Breakdown) ─── */
	.viz-grid {
		display: grid;
		grid-template-columns: 2fr 1fr;
		gap: var(--space-md);
		align-items: stretch;
	}

	.viz-main, .viz-side {
		display: flex;
		flex-direction: column;
		padding: var(--space-lg);
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-card);
	}

	.card-header {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin-bottom: var(--space-md);
	}

	.card-title {
		font-size: var(--font-size-base);
		font-weight: 600;
		color: var(--color-ink);
		margin: 0;
	}

	.card-subtitle {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	.card-body {
		flex: 1;
		min-height: 0;
		width: 100%;
	}

	/* ─── Layer 3: Secondary Insights Grid (1/2 Forecast + 1/2 Financial Position) ─── */
	.insights-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-md);
		align-items: stretch;
	}

	/* ─── Layer 4: Activity Grid (1/2 Activity + 1/2 Upcoming) ─── */
	.activity-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-md);
		align-items: stretch;
	}

	/* ════════════════════════════════════════
	   RESPONSIVE LAYOUT
	   ════════════════════════════════════════ */

	@media (max-width: 1024px) {
		.viz-grid {
			grid-template-columns: 1fr;
		}

		.insights-grid {
			grid-template-columns: 1fr;
		}

		.activity-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 480px) {
		.dashboard-shell {
			gap: var(--space-md);
		}

		.viz-main, .viz-side {
			padding: var(--space-md);
		}

		.card-title {
			font-size: var(--font-size-sm);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.dashboard-section {
			animation: none;
		}
	}
</style>
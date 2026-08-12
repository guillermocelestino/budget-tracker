<script lang="ts">
	import { page } from '$app/stores';
	import PageHeader from '$lib/client/components/PageHeader.svelte';
	import PageBackground from '$lib/client/components/PageBackground.svelte';
	import TopKpiGrid from '$lib/client/components/TopKpiGrid.svelte';
	import HeroBalanceWidget from '$lib/client/components/HeroBalanceWidget.svelte';
	import MobileSummaryRail from '$lib/client/components/MobileSummaryRail.svelte';
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

	// ─── Greeting helper for mobile header ───
	const greeting = $derived.by(() => {
		const hour = new Date().getHours();
		if (hour < 12) return 'Good morning';
		if (hour < 17) return 'Good afternoon';
		return 'Good evening';
	});

	function triggerSearch() {
		if (typeof window !== 'undefined') {
			window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
		}
	}
</script>

<svelte:head>
	<title>Dashboard — Finance Tracker</title>
</svelte:head>

<PageBackground />

<!-- ═══════════════════════════════════════════════════════════════════════════
     DESKTOP COMPOSITION (viewports > 768px) — UNCHANGED
     ═══════════════════════════════════════════════════════════════════════════ -->
<div class="desktop-dashboard">
	<PageHeader title="Dashboard" flush borderless>
		{#snippet subtitle()}
			<span class="context-subline">{contextSubline}</span>
		{/snippet}
	</PageHeader>

	<div class="dashboard-shell">
		<!-- LAYER 1: TOP KPI SUMMARY (Above the Fold) -->
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

		<!-- LAYER 2: PRIMARY FINANCIAL ANALYSIS (Cash Flow 2/3 + Categories 1/3) -->
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

		<!-- LAYER 3: SECONDARY INSIGHTS (Forecast 1/2 + Financial Position 1/2) -->
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

		<!-- LAYER 4: RECENT ACTIVITY & UPCOMING RECURRING (Activity 1/2 + Upcoming 1/2) -->
		<section class="dashboard-section">
			<div class="activity-grid">
				<RecentActivityWidget transactions={data.recentTransactions ?? []} />
				<UpcomingRecurringWidget items={upcomingWithDays} />
			</div>
		</section>
	</div>
</div>

<!-- ═══════════════════════════════════════════════════════════════════════════
     DEDICATED MOBILE COMPOSITION (viewports <= 768px)
     ═══════════════════════════════════════════════════════════════════════════ -->
<div class="mobile-dashboard">
	<!-- 1. Mobile App Header -->
	<header class="mobile-app-header">
		<div class="mobile-header-main">
			<div class="mobile-greeting-wrap">
				<h1 class="mobile-greeting">{greeting}</h1>
				<span class="context-subline">{contextSubline}</span>
			</div>
			<button class="mobile-search-btn" onclick={triggerSearch} aria-label="Search transactions">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
				</svg>
			</button>
		</div>
	</header>

	<div class="mobile-shell">
		<!-- 2. Hero Balance Card -->
		<section class="mobile-section">
			<HeroBalanceWidget
				balance={data.summary?.balance ?? 0}
				totalIncome={data.summary?.totalIncome ?? 0}
				totalExpenses={data.summary?.totalExpenses ?? 0}
				savingsRate={data.summary?.savingsRate ?? 0}
				lendingSummary={data.lendingSummary}
				incomeChange={data.incomeChange}
				expenseChange={data.expenseChange}
			/>
		</section>

		<!-- 3. Summary Metrics Rail -->
		<section class="mobile-section">
			<MobileSummaryRail
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
		</section>

		<!-- 4. Financial Analysis Section -->
		<section class="mobile-section">
			<div class="mobile-section-header">
				<h2 class="mobile-section-title">Financial Analysis</h2>
			</div>
			<div class="mobile-stack">
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

		<!-- 5. Insights & Financial Position Section -->
		<section class="mobile-section">
			<div class="mobile-section-header">
				<h2 class="mobile-section-title">Insights & Position</h2>
			</div>
			<div class="mobile-stack">
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

		<!-- 6. Recent Activity Feed -->
		<section class="mobile-section">
			<RecentActivityWidget transactions={data.recentTransactions ?? []} />
		</section>

		<!-- 7. Upcoming Recurring Bills -->
		<section class="mobile-section">
			<UpcomingRecurringWidget items={upcomingWithDays} />
		</section>
	</div>
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

	/* ─── Desktop vs. Mobile Composition Scoping ─── */
	.desktop-dashboard {
		display: block;
	}

	.mobile-dashboard {
		display: none;
	}

	/* ─── Dashboard Shell (Desktop) ─── */
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
	   RESPONSIVE LAYOUT & MOBILE SCOPING
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

	@media (max-width: 768px) {
		.desktop-dashboard {
			display: none !important;
		}

		.mobile-dashboard {
			display: flex;
			flex-direction: column;
			gap: var(--space-md);
			padding-bottom: var(--space-2xl);
		}

		.mobile-app-header {
			position: sticky;
			top: 0;
			z-index: 20;
			background: var(--color-bg);
			backdrop-filter: blur(12px);
			-webkit-backdrop-filter: blur(12px);
			padding: var(--space-sm) var(--space-md);
			border-bottom: 1px solid var(--color-hairline);
			margin-left: calc(-1 * var(--space-md));
			margin-right: calc(-1 * var(--space-md));
			margin-top: calc(-1 * var(--space-md));
			margin-bottom: var(--space-xs);
		}

		.mobile-header-main {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: var(--space-sm);
		}

		.mobile-greeting-wrap {
			display: flex;
			flex-direction: column;
			gap: 2px;
			min-width: 0;
		}

		.mobile-greeting {
			font-family: var(--font-display);
			font-size: var(--font-size-lg);
			font-weight: var(--font-weight-extrabold);
			color: var(--color-ink);
			margin: 0;
			letter-spacing: var(--letter-spacing-heading);
			line-height: 1.2;
		}

		.mobile-search-btn {
			width: 40px;
			height: 40px;
			border-radius: var(--radius-pill);
			background: var(--color-surface);
			border: 1px solid var(--color-hairline);
			color: var(--color-text-muted);
			display: flex;
			align-items: center;
			justify-content: center;
			cursor: pointer;
			flex-shrink: 0;
			box-shadow: var(--shadow-card);
			transition: all var(--transition-fast);
		}

		.mobile-search-btn:active {
			transform: scale(0.92);
			color: var(--color-teal);
			background: var(--color-teal-bg);
		}

		.mobile-shell {
			display: flex;
			flex-direction: column;
			gap: var(--space-lg);
		}

		.mobile-section {
			display: flex;
			flex-direction: column;
			gap: var(--space-xs);
		}

		.mobile-section-header {
			padding: 0 4px;
			margin-bottom: 2px;
		}

		.mobile-section-title {
			font-family: var(--font-display);
			font-size: 11px;
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.1em;
			color: var(--color-text-muted);
		}

		.mobile-stack {
			display: flex;
			flex-direction: column;
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
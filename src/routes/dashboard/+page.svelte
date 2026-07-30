<script lang="ts">
	import { page } from '$app/stores';
	import HeroBalanceWidget from '$lib/components/HeroBalanceWidget.svelte';
	import SafeToSpendWidget from '$lib/components/SafeToSpendWidget.svelte';
	import ForecastBanner from '$lib/components/ForecastBanner.svelte';
	import CashFlowChart from '$lib/components/CashFlowChart.svelte';
	import RecentActivityWidget from '$lib/components/RecentActivityWidget.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import CategoryBreakdownWidget from '$lib/components/CategoryBreakdownWidget.svelte';
	import PageBackground from '$lib/components/PageBackground.svelte';
	import NetWorthHero from '$lib/components/NetWorthHero.svelte';
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
</script>

<svelte:head>
	<title>Dashboard — Finance Tracker</title>
</svelte:head>

<PageHeader title="Dashboard">
	{#snippet subtitle()}
		<span class="header-subtitle">Track your financial overview</span>
	{/snippet}
</PageHeader>

<PageBackground />

<HeroBalanceWidget
	balance={data.summary?.balance ?? 0}
	totalIncome={data.summary?.totalIncome ?? 0}
	totalExpenses={data.summary?.totalExpenses ?? 0}
	savingsRate={data.summary?.savingsRate ?? 0}
	lendingSummary={data.lendingSummary}
	incomeChange={data.incomeChange}
	expenseChange={data.expenseChange}
/>

<!-- Net worth teaser — same snapshot as /net-worth -->
{#if data.netWorth}
	<section class="charts-section nw-teaser">
		<NetWorthHero snapshot={data.netWorth} variant="compact" />
	</section>
{/if}

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

{#if data.trendLabels && data.trendLabels.length > 1}
	<section class="charts-section">
		<h2 class="section-title">Cash Flow</h2>
		<div class="cashflow-card">
			<CashFlowChart
				labels={data.trendLabels ?? []}
				incomeData={data.trendIncome ?? []}
				expenseData={data.trendExpenses ?? []}
			/>
		</div>
	</section>
{/if}

{#if data.categoryLabels && data.categoryLabels.length > 0}
	<section class="charts-section">
		<h2 class="section-title">Spending by Category</h2>
		<div class="chart-card">
			<CategoryBreakdownWidget
				categories={categoryItems}
			/>
		</div>
	</section>
{/if}

		<section class="charts-section">
			<RecentActivityWidget
				transactions={data.recentTransactions ?? []}
			/>
		</section>

<style>
	.header-subtitle {
		font-size: var(--font-size-sm);
		color: var(--color-text-secondary);
		font-weight: 400;
	}

	.section-title {
		font-size: var(--font-size-lg);
		color: var(--color-text);
		font-weight: 600;
		margin: 0 0 var(--space-sm);
	}

	.charts-section {
		margin-top: var(--space-lg);
	}

	.nw-teaser {
		margin-bottom: var(--space-lg);
	}

	.cashflow-card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		padding: var(--space-md);
		box-shadow: var(--shadow-sm);
		height: 360px;
		min-width: 0;
	}

	.chart-card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		padding: var(--space-lg);
		box-shadow: var(--shadow-sm);
	}

	@media (max-width: 768px) {
		.cashflow-card {
			height: 280px;
			padding: var(--space-sm);
		}
		.chart-card {
			padding: var(--space-md);
		}
	}

	@media (max-width: 480px) {
		.cashflow-card {
			height: 240px;
			padding: var(--space-xs);
		}
		.chart-card {
			padding: var(--space-sm);
			border-radius: var(--radius-lg);
		}
		.section-title {
			font-size: var(--font-size-base);
		}
	}

	/* ═══ FORCED MOBILE OVERRIDES ═══ */
	@media (max-width: 768px) {
		.charts-section {
			width: 100% !important;
			box-sizing: border-box !important;
		}

		.cashflow-card {
			height: 250px !important;
			max-height: 250px !important;
			width: 100% !important;
			box-sizing: border-box !important;
		}

		.chart-card {
			width: 100% !important;
			box-sizing: border-box !important;
		}

		.section-title {
			font-size: 1rem !important;
		}
	}
</style>

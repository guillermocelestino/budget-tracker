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
	import MobileSummaryRail from '$lib/components/MobileSummaryRail.svelte';
	import Button from '$lib/components/Button.svelte';
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
	{#snippet action()}
		<span class="header-actions desktop-only">
			<Button variant="primary" href="/transactions/new">
				<span class="btn-lead" aria-hidden="true">+</span>
				Add Transaction
			</Button>
		</span>
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

<!-- Mobile summary rail — only visible ≤640px -->
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
	/* ─── Page header (matches /transactions + /lending) ─── */
	/* Raise the header's stacking context so menus/buttons paint above the
	   hero widgets that follow it in the DOM. */
	:global(.page-header) {
		position: relative;
		z-index: 30;
	}

	/* ─── Context subline (header) ─── */
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

	/* ─── Mobile / Desktop visibility (matches /transactions) ─── */
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

<script lang="ts">
	import { page } from '$app/stores';
	import HeroBalanceWidget from '$lib/components/HeroBalanceWidget.svelte';
	import CashFlowChart from '$lib/components/CashFlowChart.svelte';
	import RecentActivityWidget from '$lib/components/RecentActivityWidget.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import CategoryBreakdownWidget from '$lib/components/CategoryBreakdownWidget.svelte';
	import PageBackground from '$lib/components/PageBackground.svelte';
	let data = $derived($page.data as App.PageData);

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

	.cashflow-card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		padding: var(--space-md);
		box-shadow: var(--shadow-sm);
		height: 360px;
	}

	.chart-card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		padding: var(--space-lg);
		box-shadow: var(--shadow-sm);
	}
</style>
<script lang="ts">
	import AnalysisHeader from '$lib/client/components/analysis/AnalysisHeader.svelte';
	import AnalysisToolbar from '$lib/client/components/analysis/AnalysisToolbar.svelte';
	import MoneySnapshot from '$lib/client/components/analysis/MoneySnapshot.svelte';
	import MoneyOutTrendChart from '$lib/client/components/analysis/MoneyOutTrendChart.svelte';
	import MoneyOutBreakdown from '$lib/client/components/analysis/MoneyOutBreakdown.svelte';
	import WhereMoneyWent from '$lib/client/components/analysis/WhereMoneyWent.svelte';
	import DailyDrainAnalysis from '$lib/client/components/analysis/DailyDrainAnalysis.svelte';
	import SpendingBehavior from '$lib/client/components/analysis/SpendingBehavior.svelte';
	import CommittedMoneyAnalysis from '$lib/client/components/analysis/CommittedMoneyAnalysis.svelte';
	import MoneyAwayAnalysis from '$lib/client/components/analysis/MoneyAwayAnalysis.svelte';
	import MoneyReturningAnalysis from '$lib/client/components/analysis/MoneyReturningAnalysis.svelte';
	import CashFlowHistorical from '$lib/client/components/analysis/CashFlowHistorical.svelte';
	import WhatChangedInsights from '$lib/client/components/analysis/WhatChangedInsights.svelte';
	import LargestMovements from '$lib/client/components/analysis/LargestMovements.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const analysis = $derived(data.analysis);
</script>

<svelte:head>
	<title>Money Intelligence & Analysis | WRECKRD</title>
	<meta
		name="description"
		content="Financial intelligence workspace: analyze where your money is going, what changed, and what is affecting your cash flow."
	/>
</svelte:head>

<div class="page-container page-container--workspace">
	<div class="desktop-analysis">
		<!-- 1. Header -->
		<AnalysisHeader />

		<!-- 2. Toolbar -->
		<AnalysisToolbar
			period={data.period}
			startDate={data.startDate}
			endDate={data.endDate}
			dateRange={analysis.dateRange}
			presetCounts={analysis.presetCounts}
			transactionCount={analysis.snapshot.transactionCount}
		/>

		<!-- 3. Money Snapshot -->
		<MoneySnapshot snapshot={analysis.snapshot} />

		<!-- 3. Money Out Trend -->
		<MoneyOutTrendChart trend={analysis.trend} />

		<!-- 4. Money Out Taxonomy Breakdown -->
		<MoneyOutBreakdown breakdown={analysis.breakdown} />

		<!-- 5. Where The Money Went (Category Analysis) -->
		<WhereMoneyWent categories={analysis.categories} />

		<!-- 6. Daily Drain Analysis -->
		<DailyDrainAnalysis dailyDrain={analysis.dailyDrain} />

		<!-- 7. Spending Behavior -->
		<SpendingBehavior behavior={analysis.behavior} />

		<!-- 8. Committed Money -->
		<CommittedMoneyAnalysis committed={analysis.committed} />

		<!-- 9. Money Away (Lending) -->
		<MoneyAwayAnalysis lending={analysis.lending} />

		<!-- 10. Money Returning -->
		<MoneyReturningAnalysis returning={analysis.returning} />

		<!-- 11. Cash Flow & Historical Ratio -->
		<CashFlowHistorical cashFlow={analysis.cashFlow} />

		<!-- 12. What Changed? (Rule-Based Data-Driven Insights) -->
		<WhatChangedInsights insights={analysis.insights} />

		<!-- 13. Largest Financial Movements -->
		<LargestMovements movements={analysis.movements} />
	</div>
</div>

<style>
	.desktop-analysis {
		display: flex;
		flex-direction: column;
	}
</style>

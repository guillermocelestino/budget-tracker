<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { formatCurrency, getMonthLabel } from '$lib/utils/format';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import SummaryCards from '$lib/components/SummaryCards.svelte';
	import MonthlyChart from '$lib/components/MonthlyChart.svelte';
	import CategoryChart from '$lib/components/CategoryChart.svelte';

	let data = $derived($page.data as App.PageData);

	let selectedYear = $state(String(new Date().getFullYear()));
	let selectedMonth = $state(
		`${String(new Date().getFullYear())}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
	);

	$effect(() => {
		if (data.year) selectedYear = data.year;
		if (data.month) selectedMonth = data.month;
	});

	function changeYear(year: string) {
		selectedYear = year;
		const params = new URLSearchParams({ year, month: selectedMonth });
		goto(`/reports?${params.toString()}`);
	}

	function changeMonth(month: string) {
		selectedMonth = month;
		const params = new URLSearchParams({ year: selectedYear, month });
		goto(`/reports?${params.toString()}`);
	}

	const monthlyLabels = $derived(
		(data.monthlyData ?? []).map(m => getMonthLabel(m.month))
	);
	const monthlyIncome = $derived(
		(data.monthlyData ?? []).map(m => m.income)
	);
	const monthlyExpense = $derived(
		(data.monthlyData ?? []).map(m => m.expense)
	);

	const catLabels = $derived(
		(data.categoryData ?? []).map(c => c.category_name)
	);
	const catValues = $derived(
		(data.categoryData ?? []).map(c => c.total)
	);
	const catColors = $derived(
		(data.categoryData ?? []).map(c => c.category_color)
	);

	const months = $derived(
		Array.from({ length: 12 }, (_, i) => {
			const m = i + 1;
			const monthStr = `${selectedYear}-${String(m).padStart(2, '0')}`;
			return { value: monthStr, label: new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(parseInt(selectedYear), i)) };
		})
	);
</script>

<svelte:head>
	<title>Reports — Budget Tracker</title>
</svelte:head>

<PageHeader title="Reports" />

<div class="report-controls">
	<div class="control-group">
		<label for="year-select">Year</label>
		<select id="year-select" value={selectedYear} onchange={(e) => changeYear((e.target as HTMLSelectElement).value)}>
			{#each Array.from({ length: 5 }, (_, i) => String(2024 + i)) as yr}
				<option value={yr}>{yr}</option>
			{/each}
		</select>
	</div>
</div>

<section class="report-section">
	<h2 class="section-title">Monthly Overview</h2>
	<MonthlyChart
		labels={monthlyLabels}
		incomeData={monthlyIncome}
		expenseData={monthlyExpense}
	/>
</section>

<hr class="divider" />

<div class="report-controls">
	<div class="control-group">
		<label for="month-select">Month</label>
		<select id="month-select" value={selectedMonth} onchange={(e) => changeMonth((e.target as HTMLSelectElement).value)}>
			{#each months as m}
				<option value={m.value}>{m.label}</option>
			{/each}
		</select>
	</div>
</div>

<div class="category-report-grid">
	<div class="report-section chart-col">
		<h2 class="section-title">Expense by Category</h2>
		<CategoryChart
			labels={catLabels}
			data={catValues}
			colors={catColors}
		/>
	</div>

	<div class="report-section table-col">
		<h2 class="section-title">Category Breakdown</h2>
		<table class="breakdown-table">
			<thead>
				<tr>
					<th>Category</th>
					<th>Amount</th>
					<th>%</th>
				</tr>
			</thead>
			<tbody>
				{#each data.categoryData ?? [] as cat (cat.category_id)}
					<tr>
						<td>
							<span class="cat-dot" style="background: {cat.category_color}"></span>
							{cat.category_name}
						</td>
						<td class="amount">{formatCurrency(cat.total)}</td>
						<td class="pct">
							{(() => {
								const total = catValues.reduce((a: number, b: number) => a + b, 0);
								return total > 0 ? ((cat.total / total) * 100).toFixed(1) : '0.0';
							})()}%
						</td>
					</tr>
				{/each}
				{#if (data.categoryData ?? []).length === 0}
					<tr>
						<td colspan="3" class="empty">No expenses this month</td>
					</tr>
				{/if}
			</tbody>
		</table>
	</div>
</div>

<style>
	.report-controls {
		display: flex;
		gap: var(--space-md);
		margin-bottom: var(--space-lg);
		align-items: flex-end;
	}

	.control-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.control-group label {
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-text-secondary);
	}

	.control-group select {
		padding: var(--space-xs) var(--space-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		font-size: var(--font-size-base);
		font-family: inherit;
		background: var(--color-surface);
	}

	.report-section {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--space-lg);
		margin-bottom: var(--space-lg);
		box-shadow: var(--shadow-sm);
	}

	.section-title {
		font-size: var(--font-size-lg);
		margin-bottom: var(--space-md);
		color: var(--color-text);
	}

	.divider {
		border: none;
		border-top: 1px solid var(--color-border);
		margin: var(--space-lg) 0;
	}

	.category-report-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-lg);
	}

	.chart-col {
		margin-bottom: 0;
	}

	.table-col {
		margin-bottom: 0;
	}

	.breakdown-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--font-size-sm);
	}

	.breakdown-table th {
		text-align: left;
		padding: var(--space-sm) var(--space-md);
		color: var(--color-text-secondary);
		font-weight: 600;
		border-bottom: 2px solid var(--color-border);
	}

	.breakdown-table td {
		padding: var(--space-sm) var(--space-md);
		border-bottom: 1px solid var(--color-border);
	}

	.breakdown-table td.amount {
		text-align: right;
		font-variant-numeric: tabular-nums;
		font-weight: 600;
	}

	.breakdown-table td.pct {
		text-align: right;
		color: var(--color-text-secondary);
	}

	.cat-dot {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		margin-right: var(--space-xs);
		vertical-align: middle;
	}

	.empty {
		text-align: center;
		color: var(--color-text-secondary);
		font-style: italic;
		padding: var(--space-lg) !important;
	}

	@media (max-width: 768px) {
		.category-report-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 640px) {
		.report-controls {
			flex-direction: column;
			align-items: stretch;
		}

		.control-group select {
			width: 100%;
			min-height: 44px;
		}

		.breakdown-table th,
		.breakdown-table td {
			padding: var(--space-sm);
		}
	}
</style>

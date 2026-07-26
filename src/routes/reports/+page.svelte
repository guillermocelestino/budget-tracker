<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { formatCurrency, getMonthLabel } from '$lib/utils/format';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import SummaryCards from '$lib/components/SummaryCards.svelte';
	import MonthlyChart from '$lib/components/MonthlyChart.svelte';
	import CategoryChart from '$lib/components/CategoryChart.svelte';
	import YearOverYearCard from '$lib/components/YearOverYearCard.svelte';
import PageBackground from '$lib/components/PageBackground.svelte';

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

	// Linear regression for trend lines
	function linearRegression(data: number[]) {
		const n = data.length;
		if (n === 0) return { values: [], next: 0 };
		if (n === 1) return { values: [data[0]], next: data[0] };
		const xMean = (n - 1) / 2;
		const yMean = data.reduce((a, b) => a + b, 0) / n;
		let num = 0, den = 0;
		for (let i = 0; i < n; i++) {
			num += (i - xMean) * (data[i] - yMean);
			den += (i - xMean) ** 2;
		}
		const slope = den === 0 ? 0 : num / den;
		const intercept = yMean - slope * xMean;
		return {
			values: data.map((_, i) => Math.round(slope * i + intercept)),
			next: Math.max(0, Math.round(slope * n + intercept)),
		};
	}

	// Compute trend directly from chart data (same length, always aligned)
	const incomeTrend = $derived(linearRegression(monthlyIncome));
	const expenseTrend = $derived(linearRegression(monthlyExpense));

	let showTrend = $state(false);

	// Income chart data
	const incomeLabels = $derived(
		(data.incomeData ?? []).map(c => c.category_name)
	);
	const incomeValues = $derived(
		(data.incomeData ?? []).map(c => c.total)
	);
	const incomeColors = $derived(
		(data.incomeData ?? []).map(c => c.category_color)
	);

	// Expense chart data
	const expenseLabels = $derived(
		(data.expenseData ?? []).map(c => c.category_name)
	);
	const expenseValues = $derived(
		(data.expenseData ?? []).map(c => c.total)
	);
	const expenseColors = $derived(
		(data.expenseData ?? []).map(c => c.category_color)
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

<PageBackground />

<SummaryCards
	totalIncome={data.monthSummary?.income ?? 0}
	totalExpenses={data.monthSummary?.expense ?? 0}
	balance={data.monthSummary?.balance ?? 0}
	savingsRate={data.monthSummary?.income > 0 ? ((data.monthSummary.income - data.monthSummary.expense) / data.monthSummary.income) * 100 : 0}
/>

<YearOverYearCard yoyData={data.yoyData} selectedMonth={selectedMonth} />

<div class="report-actions">
	<button class="btn-refresh" onclick={() => goto(`/reports?year=${selectedYear}&month=${selectedMonth}&t=${Date.now()}`, { replaceState: true, invalidateAll: true })}>
		<svg class="refresh-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<polyline points="23 4 23 10 17 10"/>
			<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
		</svg>
		Refresh
	</button>
</div>

<div class="report-controls">
	<div class="control-group">
		<label for="year-select">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
				<line x1="16" x2="16" y1="2" y2="6"/>
				<line x1="8" x2="8" y1="2" y2="6"/>
				<line x1="3" x2="21" y1="10" y2="10"/>
			</svg>
			Year
		</label>
		<select id="year-select" value={selectedYear} onchange={(e) => changeYear((e.target as HTMLSelectElement).value)}>
			{#each Array.from({ length: 5 }, (_, i) => String(2024 + i)) as yr}
				<option value={yr}>{yr}</option>
			{/each}
		</select>
	</div>
</div>

<section class="report-section">
	<div class="section-header">
		<div class="section-title-group">
			<div class="section-icon">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M3 3v18h18"/>
					<path d="M18 17V9"/>
					<path d="M13 17V5"/>
					<path d="M8 17v-3"/>
				</svg>
			</div>
			<h2 class="section-title">Monthly Overview</h2>
		</div>
	</div>
	<MonthlyChart
		labels={monthlyLabels}
		incomeData={monthlyIncome}
		expenseData={monthlyExpense}
		trendIncome={incomeTrend.values}
		trendExpense={expenseTrend.values}
		showTrend={showTrend}
	/>

	<div class="chart-controls">
		<label class="trend-toggle" class:active={showTrend}>
			<input type="checkbox" bind:checked={showTrend} />
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
				<polyline points="17 6 23 6 23 12"/>
			</svg>
			<span>Trend lines</span>
		</label>
	</div>
</section>

{#if showTrend}
	<section class="report-section forecast-section">
		<div class="section-header">
			<div class="section-title-group">
				<div class="section-icon">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M12 2L2 7l10 5 10-5-10-5z"/>
						<path d="M2 17l10 5 10-5"/>
						<path d="M2 12l10 5 10-5"/>
					</svg>
				</div>
				<h2 class="section-title">Forecast</h2>
			</div>
		</div>
		<div class="forecast-grid">
			<div class="forecast-card income">
				<span class="forecast-label">Projected Income</span>
				<span class="forecast-value">{formatCurrency(incomeTrend.next)}</span>
				<span class="forecast-next">Next month</span>
			</div>
			<div class="forecast-card expense">
				<span class="forecast-label">Projected Expenses</span>
				<span class="forecast-value">{formatCurrency(expenseTrend.next)}</span>
				<span class="forecast-next">Next month</span>
			</div>
			<div class="forecast-card balance">
				<span class="forecast-label">Projected Balance</span>
				<span class="forecast-value" class:negative={incomeTrend.next - expenseTrend.next < 0}>{formatCurrency(incomeTrend.next - expenseTrend.next)}</span>
				<span class="forecast-next">Based on trend</span>
			</div>
		</div>
	</section>
{/if}

<div class="divider">
	<span class="divider-line"></span>
</div>

<div class="report-controls secondary">
	<div class="control-group">
		<label for="month-select">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
				<line x1="16" x2="16" y1="2" y2="6"/>
				<line x1="8" x2="8" y1="2" y2="6"/>
				<line x1="3" x2="21" y1="10" y2="10"/>
			</svg>
			Month
		</label>
		<select id="month-select" value={selectedMonth} onchange={(e) => changeMonth((e.target as HTMLSelectElement).value)}>
			{#each months as m}
				<option value={m.value}>{m.label}</option>
			{/each}
		</select>
	</div>
</div>

<div class="category-report-grid">
	<!-- Income Section -->
	<div class="report-section">
		<div class="section-header">
			<div class="section-title-group">
				<div class="section-icon income">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<line x1="12" x2="12" y1="2" y2="22"/>
							<path d="M6 4h7a4 4 0 0 1 0 8H6"/>
							<line x1="4" x2="18" y1="12" y2="12"/>
							<line x1="4" x2="18" y1="16" y2="16"/>
						</svg>
				</div>
				<h2 class="section-title">Income by Category</h2>
			</div>
		</div>
		<CategoryChart
			labels={incomeLabels}
			data={incomeValues}
			colors={incomeColors}
		/>
		<div class="breakdown-section">
			<table class="breakdown-table">
				<thead>
					<tr>
						<th>Category</th>
						<th class="amount">Amount</th>
						<th class="pct">%</th>
					</tr>
				</thead>
				<tbody>
					{#each data.incomeData ?? [] as cat (cat.category_id)}
						<tr>
							<td>
								<span class="cat-dot" style="background: {cat.category_color}"></span>
								{cat.category_name}
							</td>
							<td class="amount income">{formatCurrency(cat.total)}</td>
							<td class="pct">
								{(() => {
									const total = incomeValues.length > 0 ? incomeValues.reduce((a: number, b: number) => a + b, 0) : 0;
									return total > 0 ? ((cat.total / total) * 100).toFixed(1) : '0.0';
								})()}%
							</td>
						</tr>
					{/each}
					{#if (data.incomeData ?? []).length === 0}
						<tr>
							<td colspan="3" class="empty">No income this month</td>
						</tr>
					{/if}
				</tbody>
			</table>
		</div>
	</div>

	<!-- Expense Section -->
	<div class="report-section">
		<div class="section-header">
			<div class="section-title-group">
				<div class="section-icon expense">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>
						<path d="M22 12A10 10 0 0 0 12 2v10z"/>
					</svg>
				</div>
				<h2 class="section-title">Expense by Category</h2>
			</div>
		</div>
		<CategoryChart
			labels={expenseLabels}
			data={expenseValues}
			colors={expenseColors}
		/>
		<div class="breakdown-section">
			<table class="breakdown-table">
				<thead>
					<tr>
						<th>Category</th>
						<th class="amount">Amount</th>
						<th class="pct">%</th>
					</tr>
				</thead>
				<tbody>
					{#each data.expenseData ?? [] as cat (cat.category_id)}
						<tr>
							<td>
								<span class="cat-dot" style="background: {cat.category_color}"></span>
								{cat.category_name}
							</td>
							<td class="amount expense">{formatCurrency(cat.total)}</td>
							<td class="pct">
								{(() => {
									const total = expenseValues.length > 0 ? expenseValues.reduce((a: number, b: number) => a + b, 0) : 0;
									return total > 0 ? ((cat.total / total) * 100).toFixed(1) : '0.0';
								})()}%
							</td>
						</tr>
					{/each}
					{#if (data.expenseData ?? []).length === 0}
						<tr>
							<td colspan="3" class="empty">No expenses this month</td>
						</tr>
					{/if}
				</tbody>
			</table>
		</div>
	</div>
</div>

<!-- Top Spending Categories -->
{#if (data.expenseData ?? []).filter(c => c.total > 0).length > 0}
	<section class="report-section">
		<div class="section-header">
			<div class="section-title-group">
				<div class="section-icon expense">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M17 1l4 4-4 4"/>
						<path d="M3 11V9a4 4 0 0 1 4-4h14"/>
						<path d="M7 23l-4-4 4-4"/>
						<path d="M21 13v2a4 4 0 0 1-4 4H3"/>
					</svg>
				</div>
				<h2 class="section-title">Top Spending Categories</h2>
			</div>
		</div>
		<div class="top-categories">
			{#each (data.expenseData ?? []).filter(c => c.total > 0).sort((a, b) => b.total - a.total).slice(0, 3) as cat, i}
				<div class="top-cat-item">
					<span class="top-cat-rank">{i + 1}</span>
					<span class="top-cat-name">{cat.category_name}</span>
					<div class="top-cat-bar">
						<div class="top-cat-fill" style="width: {(cat.total / Math.max(...(data.expenseData ?? []).filter(c => c.total > 0).map(c => c.total))) * 100}%;"></div>
					</div>
					<span class="top-cat-amount">{formatCurrency(cat.total)}</span>
				</div>
			{/each}
		</div>
	</section>
{/if}

<style>
	.report-controls {
		display: flex;
		gap: var(--space-md);
		margin-bottom: var(--space-lg);
		align-items: flex-end;
	}

	.report-controls.secondary {
		margin-top: var(--space-lg);
		margin-bottom: var(--space-md);
	}

	.control-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.control-group label {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-text-secondary);
	}

	.control-group select {
		padding: 10px 36px 10px 14px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: var(--font-size-base);
		font-family: inherit;
		background: var(--color-surface);
		color: var(--color-text);
		cursor: pointer;
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 10px center;
		min-height: 44px;
		transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
	}

	.control-group select:hover {
		border-color: var(--color-primary);
	}

	.control-group select:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 3px var(--color-primary-light);
	}

	.report-section {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--space-lg);
		margin-bottom: var(--space-lg);
		box-shadow: var(--shadow-sm);
	}

	.section-header {
		margin-bottom: var(--space-md);
	}

	.section-title-group {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.section-icon {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-md);
		flex-shrink: 0;
		background: var(--color-primary-light);
		color: var(--color-primary);
	}

	.section-icon.income {
		background: var(--color-income-light);
		color: var(--color-income);
	}

	.section-icon.expense {
		background: var(--color-expense-light);
		color: var(--color-expense);
	}

	.section-title {
		font-size: var(--font-size-lg);
		font-weight: 600;
		color: var(--color-text);
		margin: 0;
	}

	.divider {
		display: flex;
		align-items: center;
		margin: var(--space-xl) 0;
	}

	.divider-line {
		flex: 1;
		height: 1px;
		background: linear-gradient(90deg, transparent, var(--color-border), transparent);
	}

	.category-report-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-lg);
	}

	.breakdown-section {
		margin-top: var(--space-md);
		padding-top: var(--space-md);
		border-top: 1px solid var(--color-border);
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

	.breakdown-table th.amount,
	.breakdown-table th.pct {
		text-align: right;
	}

	.breakdown-table td {
		padding: var(--space-sm) var(--space-md);
		border-bottom: 1px solid var(--color-border);
	}

	.breakdown-table tr:last-child td {
		border-bottom: none;
	}

	.amount {
		text-align: right;
		font-variant-numeric: tabular-nums;
		font-weight: 600;
	}

	.amount.income {
		color: var(--color-income);
	}

	.amount.expense {
		color: var(--color-expense);
	}

	.pct {
		text-align: right;
		color: var(--color-text-secondary);
	}

	.cat-dot {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		margin-right: var(--space-sm);
		vertical-align: middle;
	}

	.empty {
		text-align: center;
		color: var(--color-text-secondary);
		font-style: italic;
		padding: var(--space-xl) var(--space-md) !important;
	}

	.top-categories {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.top-cat-item {
		display: grid;
		grid-template-columns: 32px 1fr auto;
		align-items: center;
		gap: var(--space-md);
		padding: var(--space-md);
		background: var(--color-bg);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		transition: all var(--transition-fast);
	}

	.top-cat-item:hover {
		border-color: var(--color-primary);
		box-shadow: var(--shadow-sm);
		transform: translateX(4px);
	}

	.top-cat-rank {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-md);
		font-size: var(--font-size-sm);
		font-weight: 700;
		flex-shrink: 0;
	}

	.top-cat-item:nth-child(1) .top-cat-rank {
		background: linear-gradient(135deg, #f59e0b, #fbbf24);
		color: white;
		box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
	}

	.top-cat-item:nth-child(2) .top-cat-rank {
		background: linear-gradient(135deg, #6b7280, #9ca3af);
		color: white;
		box-shadow: 0 2px 8px rgba(107, 114, 128, 0.3);
	}

	.top-cat-item:nth-child(3) .top-cat-rank {
		background: linear-gradient(135deg, #92400e, #b45309);
		color: white;
		box-shadow: 0 2px 8px rgba(146, 64, 14, 0.3);
	}

	.top-cat-name {
		font-weight: 600;
		color: var(--color-text);
		font-size: var(--font-size-sm);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.top-cat-bar {
		height: 8px;
		background: var(--color-border);
		border-radius: 999px;
		overflow: hidden;
		min-width: 80px;
	}

	.top-cat-fill {
		height: 100%;
		border-radius: 999px;
		background: var(--color-expense);
		transition: width 500ms cubic-bezier(0.4, 0, 0.2, 1);
	}

	.top-cat-amount {
		font-weight: 700;
		font-size: var(--font-size-sm);
		color: var(--color-expense);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.chart-controls {
		display: flex;
		justify-content: center;
		margin-top: var(--space-md);
	}

	.trend-toggle {
		display: inline-flex;
		align-items: center;
		gap: var(--space-sm);
		cursor: pointer;
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-primary);
		padding: var(--space-sm) var(--space-lg);
		border: 2px solid var(--color-primary);
		border-radius: 999px;
		background: var(--color-surface);
		box-shadow: 0 2px 8px rgba(99, 102, 241, 0.15);
		transition: all var(--transition-fast);
		user-select: none;
	}

	.trend-toggle:hover {
		background: var(--color-primary-light);
		box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);
		transform: translateY(-1px);
	}

	.trend-toggle:active {
		transform: translateY(0);
	}

	.trend-toggle.active {
		background: var(--color-primary);
		color: white;
		box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
	}

	.trend-toggle.active svg {
		color: white;
	}

	.trend-toggle input {
		display: none;
	}

	.forecast-section {
		margin-bottom: var(--space-lg);
	}

	.forecast-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--space-md);
	}

	.forecast-card {
		padding: var(--space-md);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.forecast-label {
		font-size: var(--font-size-sm);
		color: var(--color-text-secondary);
	}

	.forecast-value {
		font-size: var(--font-size-lg);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.forecast-card.income .forecast-value {
		color: var(--color-income);
	}

	.forecast-card.expense .forecast-value {
		color: var(--color-expense);
	}

	.forecast-card.balance .forecast-value {
		color: var(--color-income);
	}

	.forecast-card.balance .forecast-value.negative {
		color: var(--color-expense);
	}

	.forecast-next {
		font-size: var(--font-size-xs);
		color: var(--color-text-secondary);
	}

	.report-actions {
		display: flex;
		justify-content: flex-end;
		margin-bottom: var(--space-md);
	}

	.btn-refresh {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		padding: var(--space-xs) var(--space-md);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		cursor: pointer;
		font-size: var(--font-size-sm);
		font-family: inherit;
		color: var(--color-text-secondary);
		transition: all var(--transition-fast);
		min-height: 36px;
	}

	.btn-refresh:hover {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	@media (max-width: 768px) {
		.category-report-grid {
			grid-template-columns: 1fr;
		}

		.report-controls {
			flex-direction: column;
			align-items: stretch;
		}

		.control-group select {
			width: 100%;
		}

		.breakdown-table th,
		.breakdown-table td {
			padding: var(--space-sm);
		}

		.forecast-grid {
			grid-template-columns: 1fr;
		}
	}
</style>

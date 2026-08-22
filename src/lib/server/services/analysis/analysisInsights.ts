/**
 * Rule-Based Financial Insights Engine
 */

import { formatCurrency } from '$lib/client/utils/format';
import type {
	CategoryAnalysisItem,
	CommittedMoneyData,
	DailyDrainData,
	MoneyAwayData,
	MoneySnapshotData,
	PeriodResolution,
	SpendingBehaviorData,
	StructuredInsight,
} from './analysisTypes';

export function generateStructuredInsights(
	resolution: PeriodResolution,
	snapshot: MoneySnapshotData,
	categories: CategoryAnalysisItem[],
	dailyDrain: DailyDrainData,
	behavior: SpendingBehaviorData,
	committed: CommittedMoneyData,
	lending: MoneyAwayData
): StructuredInsight[] {
	const insights: StructuredInsight[] = [];

	// 1. Largest Category
	if (behavior.largestCategory && behavior.largestCategory.amount > 0) {
		insights.push({
			id: 'largest-category',
			severity: 'positive',
			title: 'Top Category',
			description: `${behavior.largestCategory.name} is your largest spending category.`,
			metric: 'Category Leader',
			value: formatCurrency(behavior.largestCategory.amount),
		});
	}

	// 2. Peak Drain Day
	if (dailyDrain.highestDrainDay && dailyDrain.highestDrainDay.amount > 0) {
		const h = dailyDrain.highestDrainDay;
		insights.push({
			id: 'high-drain-day',
			severity: 'neutral',
			title: 'Highest Drain Day',
			description: `${h.dayOfWeek} was your highest-drain day at ${formatCurrency(h.amount)}.`,
			metric: 'Daily Peak',
			value: formatCurrency(h.amount),
		});
	}

	// 3. Average Daily Drain
	if (snapshot.avgDailyDrain > 0) {
		insights.push({
			id: 'avg-daily-drain',
			severity: 'info',
			title: 'Average Daily Drain',
			description: `Your average daily drain is ${formatCurrency(snapshot.avgDailyDrain)}.`,
			metric: 'Daily Pace',
			value: formatCurrency(snapshot.avgDailyDrain),
		});
	}

	// 4. Outstanding Lending Status
	if (lending.outstanding > 0) {
		insights.push({
			id: 'lending-status',
			severity: 'info',
			title: 'Money Away',
			description: `${formatCurrency(lending.outstanding)} is currently away through outstanding lending.`,
			metric: 'Outstanding Lending',
			value: formatCurrency(lending.outstanding),
		});
	}

	// 5. Committed Obligations
	const totalCommitted = committed.recurringTotal + committed.borrowedCommittedTotal;
	if (totalCommitted > 0) {
		insights.push({
			id: 'committed-obligations',
			severity: committed.committedPctOfMoneyOut > 40 ? 'attention' : 'neutral',
			title: 'Committed Obligations',
			description: `${formatCurrency(totalCommitted)} is currently committed through recurring obligations.`,
			metric: 'Committed Total',
			value: formatCurrency(totalCommitted),
		});
	}

	// 6. Single Large Transaction Highlight
	if (behavior.largestSingleTx && snapshot.moneyOut > 0) {
		const tx = behavior.largestSingleTx;
		const pctOfTotal = Math.round((tx.amount / snapshot.moneyOut) * 100);
		if (pctOfTotal >= 20) {
			insights.push({
				id: 'largest-tx',
				severity: 'attention',
				title: 'Largest Single Outflow',
				description: `Your largest single outflow was ${formatCurrency(tx.amount)} for "${tx.description}".`,
				metric: 'Single Outflow',
				value: formatCurrency(tx.amount),
			});
		}
	}

	return insights;
}


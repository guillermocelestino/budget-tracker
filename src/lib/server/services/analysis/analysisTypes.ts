/**
 * Analysis Domain Types & Contracts — WRECKRD Money Intelligence
 */

export type AnalysisPeriod = '1M' | '3M' | 'YTD' | '1Y' | 'ALL' | 'CUSTOM';

export interface DateRange {
	start: string; // YYYY-MM-DD
	end: string;   // YYYY-MM-DD
}

export interface PeriodResolution {
	period: AnalysisPeriod;
	current: DateRange;
	daysInPeriod: number;
	granularity: 'daily' | 'weekly' | 'monthly';
}

export interface MoneySnapshotData {
	moneyOut: number;
	moneyIn: number;
	netCashFlow: number;
	avgDailyDrain: number;
	transactionCount: number;
	largestOutflow: {
		description: string;
		amount: number;
		date: string;
		categoryName?: string;
	} | null;
	refundsTotal: number;
	repaymentsTotal: number;
}

export interface MoneyOutBreakdownData {
	moneyGone: number;       // Normal expenses
	moneyAway: number;       // New lending extended
	moneyCommitted: number;  // Recurring & debt obligations
	moneyReturning: number;  // Income + repayments + refunds
	moneyGonePct: number;
	moneyAwayPct: number;
	moneyCommittedPct: number;
}

export interface MoneyOutTrendData {
	granularity: 'daily' | 'weekly' | 'monthly';
	labels: string[];
	currentData: number[];
}

export interface CategoryAnalysisItem {
	id: number;
	name: string;
	color: string;
	icon: string;
	amount: number;
	percentage: number;
	txCount: number;
}

export interface DailyDrainData {
	avgDailyDrain: number;
	highestDrainDay: {
		date: string;
		amount: number;
		dayOfWeek: string;
	} | null;
	lowestDrainDay: {
		date: string;
		amount: number;
		dayOfWeek: string;
	} | null;
	unusuallyHighDays: Array<{
		date: string;
		amount: number;
		ratioToAvg: number;
	}>;
	dailyOutflows: Array<{
		date: string;
		amount: number;
	}>;
}

export interface SpendingBehaviorData {
	avgTxSize: number;
	txFrequencyPerDay: number;
	mostActiveDayOfWeek: string | null;
	highestSpendingWeekday: string | null;
	largestCategory: {
		name: string;
		amount: number;
	} | null;
	largestSingleTx: {
		description: string;
		amount: number;
		date: string;
		categoryName?: string;
	} | null;
}

export interface CommittedMoneyData {
	recurringTotal: number;
	upcomingRecurringTotal: number;
	borrowedCommittedTotal: number;
	recurringCategories: Array<{
		name: string;
		amount: number;
	}>;
	committedPctOfMoneyOut: number;
}

export interface MoneyAwayData {
	lent: number;               // Lent in selected timeframe
	returned: number;           // Returned in selected timeframe
	outstanding: number;        // Total active outstanding lending balance
	activeLendingCount: number;
	largestOutstanding: {
		borrowerName: string;
		amount: number;
	} | null;
	repaymentRate: number;      // % of total lent recovered
	historicalLent: number;
}

export interface MoneyReturningData {
	income: number;
	refunds: number;
	repayments: number;
	otherReturning: number;
	total: number;
}

export interface CashFlowData {
	historicalLabels: string[];
	historicalIncome: number[];
	historicalOutflow: number[];
	outflowRatio: number | null; // Money Out / Money In, null if Money In is 0
}

export type InsightSeverity = 'positive' | 'neutral' | 'attention' | 'warning' | 'info';

export interface StructuredInsight {
	id: string;
	severity: InsightSeverity;
	title: string;
	description: string;
	metric?: string;
	value?: string;
}

export interface LargestMovementsData {
	largestOutflows: Array<{
		id: number;
		description: string;
		amount: number;
		date: string;
		categoryName: string;
		categoryColor?: string;
	}>;
	topCategories: Array<{
		id: number;
		name: string;
		amount: number;
		percentage: number;
		color?: string;
		icon?: string;
	}>;
}

export interface AnalysisData {
	period: AnalysisPeriod;
	dateRange: DateRange;
	resolution: PeriodResolution;
	snapshot: MoneySnapshotData;
	breakdown: MoneyOutBreakdownData;
	trend: MoneyOutTrendData;
	categories: CategoryAnalysisItem[];
	dailyDrain: DailyDrainData;
	behavior: SpendingBehaviorData;
	committed: CommittedMoneyData;
	lending: MoneyAwayData;
	returning: MoneyReturningData;
	cashFlow: CashFlowData;
	insights: StructuredInsight[];
	movements: LargestMovementsData;
	presetCounts: Record<AnalysisPeriod, number>;
	hasSufficientData: boolean;
}


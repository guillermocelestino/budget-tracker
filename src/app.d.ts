import type { Transaction, Category, LendingWithPayments, RecurringTransaction, DashboardSummary, MonthlyReportItem, CategoryReportItem, NetWorthSnapshot } from '$lib/types';

declare global {
	namespace App {
		interface Locals {
			user?: { userId: number; username: string };
		}

		interface PageData {
			user?: { userId: number; username: string } | null;
			summary?: DashboardSummary;
			totalBudgeted?: number;
			recentTransactions?: Transaction[];
			transactions?: Transaction[];
			allForBalance?: Transaction[];
			allTimeCount?: number;
			total?: number;
			page?: number;
			totalPages?: number;
			limit?: number;
			dateError?: string | null;
			categories?: Category[];
			txnCounts?: Record<number, number>;
			recurringCounts?: Record<number, number>;
			lastUsed?: Record<number, string>;
			recurring?: RecurringTransaction[];
			activeCount?: number;
			upcomingRecurring?: RecurringTransaction[];
			transaction?: Transaction;
			recurringTransaction?: RecurringTransaction;
			errors?: Record<string, string>;
			error?: string;
			values?: Record<string, unknown>;
			spending?: Record<number, number>;
			income?: Record<number, number>;
					selectedMonth?: string;
			transaction?: Transaction;
			lendingSummary?: { totalLent: number; totalRecovered: number; outstanding: number };
			borrowedSummary?: { totalBorrowed: number; totalRepaid: number; outstanding: number };
			activeLendings?: LendingWithPayments[];
			paidLendings?: LendingWithPayments[];
			totals?: { totalLent: number; totalRecovered: number; outstanding: number };
			transactionCount?: number;
			categoryLabels?: string[];
			categoryData?: number[];
			categoryColors?: string[];
			trendLabels?: string[];
			trendIncome?: number[];
			trendExpenses?: number[];
			incomeChange?: number;
			expenseChange?: number;
			monthlyData?: MonthlyReportItem[];
			expenseData?: CategoryReportItem[];
			incomeData?: CategoryReportItem[];
			year?: string;
			month?: string;
			netWorth?: NetWorthSnapshot;
			moneyGoneStats?: {
				wreckedToday: number;
				wreckedThisMonth: number;
				outflowVelocity: number;
				daysElapsed: number;
				largestOutflow: { amount: number; description?: string; category_name?: string } | null;
				wreckedYesterday?: number;
				wreckedSamePointPrevMonth?: number;
				prevMonthVelocity?: number;
			};
			moneyCommittedStats?: {
				totalCommitted: number;
				next7Days: number;
				next30Days: number;
				debtOwed: number;
				borrowedActiveCount: number;
			};
			borrowedLendings?: LendingWithPayments[];
			yoyData?: {
				prevYearMonth: string;
				currentMonth: { income: number; expense: number; balance: number };
				previousMonth: { income: number; expense: number; balance: number };
				currentYTD: { income: number; expense: number };
				previousYTD: { income: number; expense: number };
				changes: {
					monthIncomeChange: number;
					monthExpenseChange: number;
					ytdIncomeChange: number;
					ytdExpenseChange: number;
				};
			};
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			[key: string]: any;
		}
	}
}

export {};

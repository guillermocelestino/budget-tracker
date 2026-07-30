import type { Transaction, Category, Lending, DashboardSummary, MonthlyReportItem, CategoryReportItem, NetWorthSnapshot } from '$lib/types';

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
			categories?: Category[];
			spending?: Record<number, number>;
			income?: Record<number, number>;
					selectedMonth?: string;
			transaction?: Transaction;
			lendingSummary?: { totalLent: number; totalRecovered: number; outstanding: number };
			activeLendings?: Lending[];
			paidLendings?: Lending[];
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
		}
	}
}

export {};

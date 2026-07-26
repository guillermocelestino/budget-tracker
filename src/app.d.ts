import type { Transaction, Category, DashboardSummary, MonthlyReportItem, CategoryReportItem } from '$lib/types';

declare global {
	namespace App {
		interface Locals {
			user?: { userId: number; username: string };
		}

		interface PageData {
			summary?: DashboardSummary;
			recentTransactions?: Transaction[];
			transactions?: Transaction[];
			total?: number;
			page?: number;
			totalPages?: number;
			categories?: Category[];
			spending?: Record<number, number>;
			income?: Record<number, number>;
			transaction?: Transaction;
			lendingSummary?: { totalLent: number; totalRecovered: number; outstanding: number };
			monthlyData?: MonthlyReportItem[];
			expenseData?: CategoryReportItem[];
			incomeData?: CategoryReportItem[];
			year?: string;
			month?: string;
			yoyData?: {
				prevYearMonth: string;
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

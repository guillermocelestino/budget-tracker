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
			transaction?: Transaction;
			monthlyData?: MonthlyReportItem[];
			categoryData?: CategoryReportItem[];
			year?: string;
			month?: string;
		}
	}
}

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
			transaction?: Transaction;
			monthlyData?: MonthlyReportItem[];
			categoryData?: CategoryReportItem[];
			year?: string;
			month?: string;
		}
	}
}

export {};

export type TransactionType = 'income' | 'expense';

export interface Transaction {
	id: number;
	amount: number;
	description: string;
	date: string;
	category_id: number;
	type: TransactionType;
	created_at: string;
	updated_at: string;
	category_name?: string;
	category_color?: string;
}

export interface TransactionFormData {
	type: TransactionType;
	amount: number;
	description: string;
	date: string;
	category_id: number;
}

export interface Category {
	id: number;
	name: string;
	color: string;
	icon: string;
	type: 'income' | 'expense';
	budget_limit: number | null;
	created_at: string;
}

export interface CategoryFormData {
	name: string;
	color: string;
	icon: string;
	type: 'income' | 'expense';
	budget_limit: number | null;
}

export interface MonthlyReportItem {
	month: string;
	income: number;
	expense: number;
}

export interface CategoryReportItem {
	category_id: number;
	category_name: string;
	category_color: string;
	total: number;
}

export interface DashboardSummary {
	totalIncome: number;
	totalExpenses: number;
	balance: number;
}

export interface PaginatedResult<T> {
	items: T[];
	total: number;
	page: number;
	totalPages: number;
}

export interface User {
	id: number;
	username: string;
	created_at: string;
}

export interface Lending {
	id: number;
	user_id: number;
	borrower_name: string;
	amount: number;
	interest_rate: number;
	date_lent: string;
	due_date: string | null;
	status: 'active' | 'paid';
	notes: string | null;
	created_at: string;
	updated_at: string;
}

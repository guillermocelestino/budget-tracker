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
		savingsRate?: number;
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
	direction: 'lent' | 'borrowed';
}

/** A single leg of the net-worth composition. */
export interface NetWorthLeg {
	key: 'cash' | 'lent' | 'borrowed';
	label: string;
	amount: number;
	tone: 'teal' | 'gold' | 'coral';
	/** true = liability (subtracted from net, drawn left on the tipping bar) */
	liability?: boolean;
}

/** Monthly cash cumulative band for the stacked-area chart. */
export interface CashTrendPoint {
	month: string; // YYYY-MM
	cash: number;  // cumulative Σ(income−expense) up to this month
}

/** Per-leg monthly delta for the narrative insight. */
export interface LegDelta {
	key: string;
	amount: number;
	label: string;
}

export interface NetWorthSnapshot {
	/** total net = cash + lent − borrowed */
	net: number;
	/** individual legs */
	legs: NetWorthLeg[];
	/** deltas vs last month (where computable) */
	deltas: LegDelta[];
	/** cumulative cash band by month — the HONEST historical band */
	cashTrend: CashTrendPoint[];
	/** today's lent and borrowed applied as labeled end-bands */
	lentToday: number;
	borrowedToday: number;
	/** caption explaining the approximation */
	caption: string;
	/** optional projection */
	projection?: {
		text: string;
		month: string; // projected month
	};
	/** largest mover for the narrative insight */
	biggestMover: LegDelta | null;
}

import { getDrizzle } from '$lib/database/drizzle';
import { transactions, categories } from '$lib/database/schema';
import { and, eq, ilike, or, desc, asc, sql, gte, lte, inArray } from 'drizzle-orm';
import type { Transaction, TransactionType } from '$lib/types';


/** Raw row shape produced by database queries for mapping. */
interface TransactionRowWithCategory {
	id: number;
	amount: string | number;
	description: string;
	date: string;
	category_id: number;
	type: string;
	created_at: Date | string;
	updated_at: Date | string;
	category_name: string | null;
	category_color: string | null;
}

/** Pagination and filter options for listTransactions. */
export interface TransactionFilters {
	type?: 'income' | 'expense';
	category_id?: number;
	date_from?: string;
	date_to?: string;
	search?: string;
	ids?: number[];
	sort?: 'date' | 'amount';
	order?: 'asc' | 'desc';
}

export interface ListResult<T> {
	items: T[];
	total: number;
	page: number;
	totalPages: number;
}

export interface CreateTransactionInput {
	type: TransactionType;
	amount: number;
	description: string;
	date: string; // YYYY-MM-DD
	category_id: number;
}

export interface UpdateTransactionInput {
	type?: TransactionType;
	amount?: number;
	description?: string;
	date?: string;
	category_id?: number;
}

/**
 * Format a Postgres timestamp (JS Date) as the 'YYYY-MM-DD HH:MM:SS' UTC string.
 * SQLite stores via `datetime('now')`, so both backends emit identical values.
 */
function toSqliteTimestamp(d: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/**
 * Map a raw transaction row (with category join) to the public Transaction type.
 * Handles Postgres NUMERIC → number conversion and date string normalization.
 */
function mapTransactionRow(row: TransactionRowWithCategory): Transaction {
	return {
		id: row.id,
		amount: parseFloat(String(row.amount)),
		description: row.description,
		date: row.date,
		category_id: row.category_id,
		type: row.type as TransactionType,
		created_at: row.created_at instanceof Date ? toSqliteTimestamp(row.created_at) : String(row.created_at),
		updated_at: row.updated_at instanceof Date ? toSqliteTimestamp(row.updated_at) : String(row.updated_at),
		category_name: row.category_name ?? undefined,
		category_color: row.category_color ?? undefined,
	};
}

/**
 * Build the WHERE conditions for transaction list queries.
 * Returns the SQL fragment and parameter array for raw SQL path,
 * and the Drizzle where conditions for the Drizzle path.
 */
function buildTransactionWhere(
	userId: number,
	filters: TransactionFilters
): {
	sqlWhere: string;
	sqlParams: (string | number)[];
	drizzleWhere: ReturnType<typeof and> | undefined;
} {
	const sqlConditions: string[] = ['t.user_id = $1'];
	const sqlParams: (string | number)[] = [userId];
	const drizzleConditions: ReturnType<typeof eq | typeof and | typeof ilike | typeof or | typeof gte | typeof lte | typeof inArray>[] = [eq(transactions.user_id, userId)];

	if (filters.type && (filters.type === 'income' || filters.type === 'expense')) {
		sqlConditions.push(`t.type = $${sqlParams.length + 1}`);
		sqlParams.push(filters.type);
		drizzleConditions.push(eq(transactions.type, filters.type));
	}

	if (filters.category_id && !isNaN(filters.category_id)) {
		sqlConditions.push(`t.category_id = $${sqlParams.length + 1}`);
		sqlParams.push(filters.category_id);
		drizzleConditions.push(eq(transactions.category_id, filters.category_id));
	}

	if (filters.date_from) {
		sqlConditions.push(`t.date >= $${sqlParams.length + 1}`);
		sqlParams.push(filters.date_from);
		drizzleConditions.push(gte(transactions.date, filters.date_from));
	}

	if (filters.date_to) {
		sqlConditions.push(`t.date <= $${sqlParams.length + 1}`);
		sqlParams.push(filters.date_to);
		drizzleConditions.push(lte(transactions.date, filters.date_to));
	}

	if (filters.search && filters.search.trim()) {
		const like = `%${filters.search.trim()}%`;
		sqlConditions.push(`(t.description ILIKE $${sqlParams.length + 1} OR c.name ILIKE $${sqlParams.length + 2})`);
		sqlParams.push(like, like);
		drizzleConditions.push(
			or(
				ilike(transactions.description, like),
				ilike(categories.name, like)
			)!
		);
	}

	if (filters.ids && filters.ids.length > 0) {
		const placeholders = filters.ids.map((_, i) => `$${sqlParams.length + i + 1}`).join(', ');
		sqlConditions.push(`t.id IN (${placeholders})`);
		sqlParams.push(...filters.ids);
		drizzleConditions.push(inArray(transactions.id, filters.ids));
	}

	const sqlWhere = sqlConditions.length > 0 ? `WHERE ${sqlConditions.join(' AND ')}` : '';
	const drizzleWhere = drizzleConditions.length > 0 ? and(...drizzleConditions) : undefined;

	return { sqlWhere, sqlParams, drizzleWhere };
}

/**
 * List transactions with pagination and filtering.
 * Supports optional pagination (page/limit) for export use cases.
 */
export async function listTransactions(
	userId: number,
	filters: TransactionFilters = {},
	page?: number,
	limit?: number
): Promise<ListResult<Transaction>> {
	const shouldPaginate = page !== undefined || limit !== undefined;
	const safePage = page !== undefined ? Math.max(1, page) : 1;
	const safeLimit = limit !== undefined ? Math.min(100, Math.max(1, limit)) : 20;
	const offset = (safePage - 1) * safeLimit;

	const { drizzleWhere } = buildTransactionWhere(userId, filters);

	const db = await getDrizzle();

	// COUNT query
	const [{ count }] = await db
		.select({ count: sql<number>`count(*)` })
		.from(transactions)
		.leftJoin(categories, eq(transactions.category_id, categories.id))
		.where(drizzleWhere);

	// Data query
	const sortField = filters.sort === 'amount' ? transactions.amount : transactions.date;
	const orderByExpression = filters.order === 'asc'
		? [asc(sortField), asc(transactions.id)]
		: [desc(sortField), desc(transactions.id)];

	const query = db
		.select({
			id: transactions.id,
			amount: transactions.amount,
			description: transactions.description,
			date: transactions.date,
			category_id: transactions.category_id,
			type: transactions.type,
			created_at: transactions.created_at,
			updated_at: transactions.updated_at,
			category_name: categories.name,
			category_color: categories.color,
		})
		.from(transactions)
		.leftJoin(categories, eq(transactions.category_id, categories.id))
		.where(drizzleWhere)
		.orderBy(...orderByExpression);

	const rows = shouldPaginate
		? await query.limit(safeLimit).offset(offset)
		: await query;

	// Map rows to Transaction type (which does not contain user_id)
	const items = rows.map((r) => mapTransactionRow(r as unknown as TransactionRowWithCategory));
	const total = Number(count);
	const totalPages = shouldPaginate ? Math.ceil(total / safeLimit) : 1;

	return { items, total, page: safePage, totalPages };
}

/**
 * Get a single transaction by ID with category join.
 * Returns null if not found or not owned by user.
 */
export async function getTransaction(userId: number, id: number): Promise<Transaction | null> {
	const db = await getDrizzle();
	const [row] = await db
		.select({
			id: transactions.id,
			amount: transactions.amount,
			description: transactions.description,
			date: transactions.date,
			category_id: transactions.category_id,
			type: transactions.type,
			created_at: transactions.created_at,
			updated_at: transactions.updated_at,
			category_name: categories.name,
			category_color: categories.color,
		})
		.from(transactions)
		.leftJoin(categories, eq(transactions.category_id, categories.id))
		.where(and(eq(transactions.user_id, userId), eq(transactions.id, id)))
		.limit(1);

	return row ? mapTransactionRow(row as unknown as TransactionRowWithCategory) : null;
}

/**
 * Validate transaction input fields.
 * Returns error object if validation fails, undefined if valid.
 */
function validateTransactionInput(
	input: CreateTransactionInput | UpdateTransactionInput,
	requireAll: boolean
): Record<string, string> | undefined {
	const errors: Record<string, string> = {};

	if (requireAll || input.type !== undefined) {
		if (!input.type || !['income', 'expense'].includes(input.type)) {
			errors.type = 'Select a type';
		}
	}

	if (requireAll || input.amount !== undefined) {
		if (input.amount === undefined || typeof input.amount !== 'number' || isNaN(input.amount) || input.amount === 0) {
			errors.amount = 'Enter a valid amount';
		}
	}

	if (requireAll || input.description !== undefined) {
		if (!input.description || typeof input.description !== 'string' || input.description.trim().length === 0) {
			errors.description = 'Enter a description';
		}
	}

	if (requireAll || input.date !== undefined) {
		if (!input.date || typeof input.date !== 'string') {
			errors.date = 'Select a date';
		}
	}

	if (requireAll || input.category_id !== undefined) {
		if (input.category_id === undefined || typeof input.category_id !== 'number' || isNaN(input.category_id)) {
			errors.category_id = 'Select a category';
		}
	}

	return Object.keys(errors).length > 0 ? errors : undefined;
}

/**
 * Verify that a category belongs to the user.
 * Returns true if category exists and is owned by user.
 */
async function verifyCategoryOwnership(
	userId: number,
	categoryId: number
): Promise<boolean> {
	const db = await getDrizzle();
	const [cat] = await db
		.select({ id: categories.id })
		.from(categories)
		.where(and(eq(categories.user_id, userId), eq(categories.id, categoryId)))
		.limit(1);
	return !!cat;
}

/**
 * Create a new transaction.
 * Validates input, verifies category ownership, inserts transaction.
 * Returns the created transaction ID.
 */
export async function createTransaction(
	userId: number,
	input: CreateTransactionInput
): Promise<number> {
	const errors = validateTransactionInput(input, true);
	if (errors) {
		throw new Error(JSON.stringify(errors));
	}

	// Verify category ownership
	const ownsCategory = await verifyCategoryOwnership(userId, input.category_id);
	if (!ownsCategory) {
		throw new Error('Category not found');
	}

	const db = await getDrizzle();
	const [row] = await db
		.insert(transactions)
		.values({
			user_id: userId,
			amount: String(input.amount),
			description: input.description.trim(),
			date: input.date,
			category_id: input.category_id,
			type: input.type,
		})
		.returning({ id: transactions.id });
	return row.id;
}

/** Drizzle client type returned by getDrizzle(). */
type DrizzleDb = Awaited<ReturnType<typeof getDrizzle>>;

/** Transaction object passed to `db.transaction(...)` — derived so it stays in sync with Drizzle. */
type DrizzleTransaction = Parameters<Parameters<DrizzleDb['transaction']>[0]>[0];

/**
 * Transaction-aware variant of createTransaction() for the Postgres/Drizzle path.
 *
 * Runs the same validation + category ownership check + transaction INSERT
 * entirely through the supplied Drizzle transaction context (tx.select / tx.insert)
 * — never getDrizzle()'s global db, which would use a different pooled connection
 * and escape the outer transaction. Must be called from inside a db.transaction();
 * it does not open its own transaction.
 *
 * Returns the created transaction's ID.
 */
export async function createTransactionInTxDrizzle(
	tx: DrizzleTransaction,
	userId: number,
	input: CreateTransactionInput
): Promise<number> {
	const errors = validateTransactionInput(input, true);
	if (errors) {
		throw new Error(JSON.stringify(errors));
	}

	// Verify category ownership
	const [cat] = await tx
		.select({ id: categories.id })
		.from(categories)
		.where(and(eq(categories.user_id, userId), eq(categories.id, input.category_id)))
		.limit(1);
	if (!cat) {
		throw new Error('Category not found');
	}

	const [row] = await tx
		.insert(transactions)
		.values({
			user_id: userId,
			amount: String(input.amount),
			description: input.description.trim(),
			date: input.date,
			category_id: input.category_id,
			type: input.type,
		})
		.returning({ id: transactions.id });
	return row.id;
}

/**
 * Update an existing transaction.
 * Validates input, verifies ownership and category ownership, updates transaction.
 * Returns true on success, false if not found.
 */
export async function updateTransaction(
	userId: number,
	id: number,
	input: UpdateTransactionInput
): Promise<boolean> {
	const errors = validateTransactionInput(input, false);
	if (errors) {
		throw new Error(JSON.stringify(errors));
	}

	// Verify transaction exists and belongs to user
	const existing = await getTransaction(userId, id);
	if (!existing) {
		return false;
	}

	// Verify category ownership if category is being changed
	if (input.category_id !== undefined && input.category_id !== existing.category_id) {
		const ownsCategory = await verifyCategoryOwnership(userId, input.category_id);
		if (!ownsCategory) {
			throw new Error('Category not found');
		}
	}

	const db = await getDrizzle();
	const updateData: Record<string, unknown> = {
		updated_at: new Date(),
	};

	if (input.type !== undefined) updateData.type = input.type;
	if (input.amount !== undefined) updateData.amount = String(input.amount);
	if (input.description !== undefined) updateData.description = input.description.trim();
	if (input.date !== undefined) updateData.date = input.date;
	if (input.category_id !== undefined) updateData.category_id = input.category_id;

	await db
		.update(transactions)
		.set(updateData)
		.where(and(eq(transactions.user_id, userId), eq(transactions.id, id)));

	return true;
}

/**
 * Delete a single transaction by ID.
 * Returns true if deleted, false if not found.
 */
export async function deleteTransaction(userId: number, id: number): Promise<boolean> {
	const db = await getDrizzle();
	const result = await db
		.delete(transactions)
		.where(and(eq(transactions.user_id, userId), eq(transactions.id, id)))
		.returning({ id: transactions.id });
	return result.length > 0;
}

/**
 * Delete multiple transactions by IDs atomically.
 * Returns the actual number of rows deleted.
 */
export async function deleteTransactions(userId: number, ids: number[]): Promise<number> {
	if (ids.length === 0) {
		return 0;
	}

	const db = await getDrizzle();
	return db.transaction(async (tx) => {
		const result = await tx
			.delete(transactions)
			.where(and(eq(transactions.user_id, userId), inArray(transactions.id, ids)))
			.returning({ id: transactions.id });
		return result.length;
	});
}

/** Get monthly income and expense totals for the dashboard. */
export async function getMonthlySummary(
	userId: number,
	month: string // YYYY-MM
): Promise<{ totalIncome: number; totalExpenses: number }> {
	const firstDay = `${month}-01`;
	const date = new Date(firstDay);
	const lastDayDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
	const lastDay = `${month}-${String(lastDayDate.getDate()).padStart(2, '0')}`;

	const db = await getDrizzle();
	const [row] = await db
		.select({
			totalIncome: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount} ELSE 0 END), 0)`,
			totalExpenses: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.amount} ELSE 0 END), 0)`
		})
		.from(transactions)
		.where(and(
			eq(transactions.user_id, userId),
			gte(transactions.date, firstDay),
			lte(transactions.date, lastDay)
		));
	return {
		totalIncome: parseFloat(row?.totalIncome ?? '0'),
		totalExpenses: parseFloat(row?.totalExpenses ?? '0')
	};
}

/** Get recent transactions for the dashboard. */
export async function getRecentTransactions(
	userId: number,
	limit: number
): Promise<Transaction[]> {
	const db = await getDrizzle();
	const rows = await db
		.select({
			id: transactions.id,
			amount: transactions.amount,
			description: transactions.description,
			date: transactions.date,
			category_id: transactions.category_id,
			type: transactions.type,
			created_at: transactions.created_at,
			updated_at: transactions.updated_at,
			category_name: categories.name,
			category_color: categories.color,
		})
		.from(transactions)
		.leftJoin(categories, eq(transactions.category_id, categories.id))
		.where(eq(transactions.user_id, userId))
		.orderBy(desc(transactions.date), desc(transactions.id))
		.limit(limit);

	return rows.map((r) => mapTransactionRow(r as unknown as TransactionRowWithCategory));
}

export interface MonthlyReportItem {
	month: string;
	income: number;
	expense: number;
}

/** Get monthly summary for a specific year. */
export async function getMonthlyReport(
	userId: number,
	year: number
): Promise<MonthlyReportItem[]> {
	const db = await getDrizzle();
	const rows = await db
		.select({
			month: sql<string>`TO_CHAR(${transactions.date}, 'YYYY-MM')`,
			income: sql<string>`SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount} ELSE 0 END)`,
			expense: sql<string>`SUM(CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.amount} ELSE 0 END)`
		})
		.from(transactions)
		.where(and(
			eq(transactions.user_id, userId),
			sql`EXTRACT(YEAR FROM ${transactions.date}) = ${year}`
		))
		.groupBy(sql`month`)
		.orderBy(sql`month ASC`);

	return rows.map(r => ({
		month: r.month,
		income: parseFloat(r.income ?? '0'),
		expense: parseFloat(r.expense ?? '0')
	}));
}

export interface CategoryReportItem {
	category_id: number;
	category_name: string;
	category_color: string;
	total: number;
}

/** Get transaction total by category for a specific month and type. */
export async function getCategoryReport(
	userId: number,
	month: string, // YYYY-MM
	type: 'income' | 'expense'
): Promise<CategoryReportItem[]> {
	const db = await getDrizzle();
	const rows = await db
		.select({
			category_id: categories.id,
			category_name: categories.name,
			category_color: categories.color,
			total: sql<string>`SUM(${transactions.amount})`
		})
		.from(transactions)
		.innerJoin(categories, eq(transactions.category_id, categories.id))
		.where(and(
			eq(transactions.user_id, userId),
			sql`TO_CHAR(${transactions.date}, 'YYYY-MM') = ${month}`,
			eq(transactions.type, type)
		))
		.groupBy(categories.id, categories.name, categories.color)
		.orderBy(desc(sql`SUM(${transactions.amount})`));

	return (rows as {
		category_id: number;
		category_name: string;
		category_color: string;
		total: string | null;
	}[]).map((r) => ({
		category_id: r.category_id,
		category_name: r.category_name,
		category_color: r.category_color,
		total: parseFloat(r.total ?? '0')
	}));
}

/** Search transactions by description or amount text. */
export async function searchTransactions(
	userId: number,
	q: string
): Promise<Transaction[]> {
	const pattern = `%${q}%`;
	const db = await getDrizzle();
	const rows = await db
		.select({
			id: transactions.id,
			amount: transactions.amount,
			description: transactions.description,
			date: transactions.date,
			category_id: transactions.category_id,
			type: transactions.type,
			created_at: transactions.created_at,
			updated_at: transactions.updated_at,
			category_name: categories.name,
			category_color: categories.color,
		})
		.from(transactions)
		.leftJoin(categories, eq(transactions.category_id, categories.id))
		.where(and(
			eq(transactions.user_id, userId),
			or(
				ilike(transactions.description, pattern),
				sql`CAST(${transactions.amount} AS TEXT) LIKE ${pattern}`
			)
		))
		.orderBy(desc(transactions.date))
		.limit(10);

	return rows.map((r) => mapTransactionRow(r as unknown as TransactionRowWithCategory));
}

export interface CategorySpending {
	category_id: number;
	income: number;
	expense: number;
}

/** Get income/expense totals per category for a specific month. */
export async function getCategorySpending(
	userId: number,
	month: string // YYYY-MM
): Promise<CategorySpending[]> {
	const db = await getDrizzle();
	const rows = await db
		.select({
			category_id: transactions.category_id,
			income: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount} ELSE 0 END), 0)`,
			expense: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.amount} ELSE 0 END), 0)`
		})
		.from(transactions)
		.where(and(
			eq(transactions.user_id, userId),
			sql`TO_CHAR(${transactions.date}, 'YYYY-MM') = ${month}`
		))
		.groupBy(transactions.category_id);

	return (rows as { category_id: number | null; income: string; expense: string }[]).map(r => ({
		category_id: r.category_id ?? 0,
		income: parseFloat(r.income ?? '0'),
		expense: parseFloat(r.expense ?? '0')
	}));
}

export interface CategoryUsage {
	category_id: number;
	cnt: number;
	last_used: string | null;
}

/** Get transaction counts and last used dates per category. */
export async function getCategoryUsage(
	userId: number
): Promise<CategoryUsage[]> {
	const db = await getDrizzle();
	const rows = await db
		.select({
			category_id: transactions.category_id,
			cnt: sql<number>`COUNT(*)::int`,
			last_used: sql<string | null>`MAX(${transactions.date})`
		})
		.from(transactions)
		.where(eq(transactions.user_id, userId))
		.groupBy(transactions.category_id);

	return (rows as { category_id: number | null; cnt: number; last_used: string | null }[]).map(r => ({
		category_id: r.category_id ?? 0,
		cnt: Number(r.cnt ?? 0),
		last_used: r.last_used
	}));
}

/** Get detailed category report including zero-spending categories. */
export async function getCategorySpendingReport(
	userId: number,
	month: string, // YYYY-MM
	type: 'income' | 'expense'
): Promise<CategoryReportItem[]> {
	const db = await getDrizzle();
	const rows = await db
		.select({
			category_id: categories.id,
			category_name: categories.name,
			category_color: categories.color,
			total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`
		})
		.from(categories)
		.leftJoin(
			transactions,
			and(
				eq(transactions.category_id, categories.id),
				sql`TO_CHAR(${transactions.date}, 'YYYY-MM') = ${month}`,
				eq(transactions.type, type)
			)
		)
		.where(and(
			eq(categories.user_id, userId),
			eq(categories.type, type)
		))
		.groupBy(categories.id, categories.name, categories.color)
		.orderBy(desc(sql`COALESCE(SUM(${transactions.amount}), 0)`));

	return rows.map((r) => ({
		category_id: r.category_id,
		category_name: r.category_name,
		category_color: r.category_color,
		total: parseFloat(r.total ?? '0')
	}));
}

/** Get transaction count for a specific user and month. */
export async function getTransactionCountForMonth(
	userId: number,
	month: string // YYYY-MM
): Promise<number> {
	const db = await getDrizzle();
	const [{ count }] = await db
		.select({ count: sql<number>`count(*)` })
		.from(transactions)
		.where(and(
			eq(transactions.user_id, userId),
			sql`TO_CHAR(${transactions.date}, 'YYYY-MM') = ${month}`
		));
	return Number(count);
}

/** Get all-time transaction count for a specific user. */
export async function getAllTimeTransactionCount(
	userId: number
): Promise<number> {
	const db = await getDrizzle();
	const [{ count }] = await db
		.select({ count: sql<number>`count(*)` })
		.from(transactions)
		.where(eq(transactions.user_id, userId));
	return Number(count);
}

/** Get YTD summary for income and expense up to a given month number. */
export async function getYTDSummary(
	userId: number,
	year: number,
	endMonthNum: number
): Promise<{ income: number; expense: number }> {
	const db = await getDrizzle();
	const [row] = await db
		.select({
			income: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount} ELSE 0 END), 0)`,
			expense: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.amount} ELSE 0 END), 0)`
		})
		.from(transactions)
		.where(and(
			eq(transactions.user_id, userId),
			sql`EXTRACT(YEAR FROM ${transactions.date}) = ${year}`,
			sql`EXTRACT(MONTH FROM ${transactions.date}) <= ${endMonthNum}`
		));
	return {
		income: parseFloat(row?.income ?? '0'),
		expense: parseFloat(row?.expense ?? '0')
	};
}

/** Get monthly income and expense trends starting from a specific date string. */
export async function getMonthlyTrends(
	userId: number,
	dateFrom: string
): Promise<{ month: string; income: number; expense: number }[]> {
	const db = await getDrizzle();
	const monthExpr = sql<string>`TO_CHAR(${transactions.date}, 'YYYY-MM')`;
	const rows = await db
		.select({
			month: monthExpr,
			income: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount} ELSE 0 END), 0)`,
			expense: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.amount} ELSE 0 END), 0)`
		})
		.from(transactions)
		.where(and(
			eq(transactions.user_id, userId),
			gte(transactions.date, dateFrom)
		))
		.groupBy(monthExpr)
		.orderBy(asc(monthExpr));

	return rows.map((r) => ({
		month: r.month,
		income: parseFloat(r.income),
		expense: parseFloat(r.expense)
	}));
}

/** Calculate the user's cash position from all-time transaction net income/expense flow. */
export async function getCashBalance(userId: number): Promise<number> {
	const db = await getDrizzle();
	const [row] = await db
		.select({
			income: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount} ELSE 0 END), 0)`,
			expense: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.amount} ELSE 0 END), 0)`
		})
		.from(transactions)
		.where(eq(transactions.user_id, userId));
	return parseFloat(row?.income ?? '0') - parseFloat(row?.expense ?? '0');
}

/** Get monthly cash flow net income/expense for all-time transactions. */
export async function getMonthlyCashFlows(
	userId: number
): Promise<{ month: string; net: number }[]> {
	const db = await getDrizzle();
	const monthExpr = sql<string>`TO_CHAR(${transactions.date}, 'YYYY-MM')`;
	const rows = await db
		.select({
			month: monthExpr,
			income: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount} ELSE 0 END), 0)`,
			expense: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.amount} ELSE 0 END), 0)`
		})
		.from(transactions)
		.where(eq(transactions.user_id, userId))
		.groupBy(monthExpr)
		.orderBy(asc(monthExpr));

	return rows.map((r) => ({
		month: r.month,
		net: parseFloat(r.income) - parseFloat(r.expense)
	}));
}

/** Retrieve minimal transaction records for duplicate checking during import. */
export async function getTransactionsForDuplicateCheck(
	userId: number
): Promise<{ date: string; amount: number; description: string; category_id: number }[]> {
	const db = await getDrizzle();
	const rows = await db
		.select({
			date: transactions.date,
			amount: transactions.amount,
			description: transactions.description,
			category_id: transactions.category_id
		})
		.from(transactions)
		.where(eq(transactions.user_id, userId));

	return rows.map((r) => ({
		date: r.date,
		amount: parseFloat(String(r.amount)),
		description: r.description,
		category_id: r.category_id
	}));
}
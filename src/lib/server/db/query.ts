import { getPgPool } from './index';

export async function queryOne<T>(text: string, params: unknown[] = []): Promise<T | undefined> {
	const client = await (await getPgPool()).connect();
	try {
		const { rows } = await client.query(text, params);
		return rows[0] as T | undefined;
	} finally {
		client.release();
	}
}

export async function queryMany<T>(text: string, params: unknown[] = []): Promise<T[]> {
	const client = await (await getPgPool()).connect();
	try {
		const { rows } = await client.query(text, params);
		return rows as T[];
	} finally {
		client.release();
	}
}

export async function execute(text: string, params: unknown[] = []): Promise<void> {
	const client = await (await getPgPool()).connect();
	try {
		await client.query(text, params);
	} finally {
		client.release();
	}
}

/**
 * Execute multiple operations inside a single database transaction.
 * If any operation fails, the entire transaction is rolled back.
 *
 * Uses BEGIN/COMMIT/ROLLBACK on a dedicated client.
 *
 * The callback receives helper functions that operate within the transaction:
 * - txQueryOne: queryOne scoped to the transaction
 * - txQueryMany: queryMany scoped to the transaction
 * - txExecute: execute scoped to the transaction
 */
export async function withTransaction<T>(
	callback: (helpers: {
		queryOne: <U>(text: string, params?: unknown[]) => Promise<U | undefined>;
		queryMany: <U>(text: string, params?: unknown[]) => Promise<U[]>;
		execute: (text: string, params?: unknown[]) => Promise<void>;
	}) => Promise<T>
): Promise<T> {
	const client = await (await getPgPool()).connect();
	try {
		await client.query('BEGIN');
		const helpers = {
			queryOne: async <U>(text: string, params: unknown[] = []): Promise<U | undefined> => {
				const { rows } = await client.query(text, params);
				return rows[0] as U | undefined;
			},
			queryMany: async <U>(text: string, params: unknown[] = []): Promise<U[]> => {
				const { rows } = await client.query(text, params);
				return rows as U[];
			},
			execute: async (text: string, params: unknown[] = []): Promise<void> => {
				await client.query(text, params);
			},
		};
		const result = await callback(helpers);
		await client.query('COMMIT');
		return result;
	} catch (err) {
		await client.query('ROLLBACK');
		throw err;
	} finally {
		client.release();
	}
}
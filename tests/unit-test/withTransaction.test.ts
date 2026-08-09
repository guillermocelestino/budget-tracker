import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

/**
 * Direct tests of the PRODUCTION withTransaction() implementation
 * (src/lib/database/query.ts) running against an in-memory SQLite database.
 *
 * Phase 6A concluded the transaction architecture is acceptable and should not
 * be refactored; Phase 6B's job is to prove the existing mechanism works. These
 * tests cover the three required properties:
 *   A. a successful transaction COMMITs — all writes persist
 *   B. a failed transaction ROLLs BACK — NO partial write survives
 *   C. rollback is scoped — pre-existing rows are untouched by a rollback
 *
 * Unlike the transactional SERVICE tests (which mock withTransaction as a
 * pass-through callback, so they cannot prove rollback), these tests exercise
 * the REAL BEGIN/COMMIT/ROLLBACK path: the `$lib/database` mock only replaces
 * the connection factory (getSQLiteDb) with an in-memory database.
 * `withTransaction` itself, plus translatePgToSQLite and the tx helpers, is
 * imported unmodified from `$lib/database/query`.
 */
const SQLITE_FIXTURE_SCHEMA = `
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

describe('withTransaction — SQLite production implementation (in-memory better-sqlite3)', () => {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	sqlite.exec(SQLITE_FIXTURE_SCHEMA);

	let withTransaction: typeof import('$lib/database/query').withTransaction;

	beforeAll(async () => {
		// Route the REAL query.ts connection factory to the in-memory DB.
		vi.doMock('$lib/database', () => ({
			usePostgres: false,
			getPgPool: () => Promise.reject(new Error('getPgPool should not be called on SQLite path')),
			getSQLiteDb: () => Promise.resolve(sqlite),
			initDb: async () => {},
			closeDb: async () => {}
		}));
		vi.resetModules();
		const mod = await import('$lib/database/query');
		withTransaction = mod.withTransaction;
	});

	beforeEach(() => {
		sqlite.exec('DELETE FROM users');
	});

	function countUsers(): number {
		return (sqlite.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c;
	}

	function insertUser(username: string, passwordHash = 'hash'): void {
		sqlite.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, passwordHash);
	}

	it('COMMITs all writes when the callback succeeds (Test A)', async () => {
		await withTransaction(async (tx) => {
			await tx.execute('INSERT INTO users (username, password_hash) VALUES ($1, $2)', ['alice', 'hash']);
			await tx.execute('INSERT INTO users (username, password_hash) VALUES ($1, $2)', ['bob', 'hash']);
		});

		// Both writes survived the COMMIT.
		expect(countUsers()).toBe(2);
		const names = (sqlite.prepare('SELECT username FROM users ORDER BY username').all() as { username: string }[])
			.map((r) => r.username);
		expect(names).toEqual(['alice', 'bob']);
	});

	it('ROLLs BACK all writes when the callback throws (Test B)', async () => {
		await expect(
			withTransaction(async (tx) => {
				await tx.execute('INSERT INTO users (username, password_hash) VALUES ($1, $2)', ['carol', 'hash']);
				await tx.execute('INSERT INTO users (username, password_hash) VALUES ($1, $2)', ['dave', 'hash']);
				throw new Error('simulated mid-transaction failure');
			})
		).rejects.toThrow('simulated mid-transaction failure');

		// NO partial write survived the ROLLBACK — neither the first nor the second write.
		expect(countUsers()).toBe(0);
	});

	it('ROLLs BACK only transaction writes; pre-existing data is untouched (Test C)', async () => {
		// Pre-existing row created OUTSIDE any transaction.
		insertUser('pre-existing');

		await expect(
			withTransaction(async (tx) => {
				// Modify pre-existing data...
				await tx.execute('UPDATE users SET password_hash = $1 WHERE username = $2', ['tampered', 'pre-existing']);
				// ...and insert additional data.
				await tx.execute('INSERT INTO users (username, password_hash) VALUES ($1, $2)', ['erin', 'hash']);
				throw new Error('simulated mid-transaction failure');
			})
		).rejects.toThrow('simulated mid-transaction failure');

		// The pre-existing row is unchanged...
		const row = sqlite.prepare('SELECT password_hash FROM users WHERE username = ?').get('pre-existing') as {
			password_hash: string;
		};
		expect(row.password_hash).toBe('hash');
		// ...and neither the modification nor the new write survived.
		expect(countUsers()).toBe(1);
	});

	it('leaves the connection usable after a ROLLBACK (no lingering open transaction)', async () => {
		await expect(
			withTransaction(async (tx) => {
				await tx.execute('INSERT INTO users (username, password_hash) VALUES ($1, $2)', ['frank', 'hash']);
				throw new Error('boom');
			})
		).rejects.toThrow('boom');

		// A fresh transaction on the same connection must still work.
		await withTransaction(async (tx) => {
			await tx.execute('INSERT INTO users (username, password_hash) VALUES ($1, $2)', ['grace', 'hash']);
		});
		expect(countUsers()).toBe(1);
	});
});

import { describe, it, expect } from 'vitest';
import { translatePgToSQLite } from './query';

/**
 * `translatePgToSQLite` returns `{ sql, paramIndices }`, not a plain string:
 * Postgres $N placeholders can be REUSED ($2 twice = same parameter), while
 * SQLite `?` is purely positional — so each `?` position must map back to the
 * original parameter index via `paramIndices`. These tests assert the
 * translated SQL and, where params are involved, the mapping table too.
 */
describe('translatePgToSQLite', () => {
	it('converts $n param placeholders to ?', () => {
		const result = translatePgToSQLite('SELECT * FROM t WHERE a = $1 AND b = $2');
		expect(result.sql).toBe('SELECT * FROM t WHERE a = ? AND b = ?');
		expect(result.paramIndices).toEqual([0, 1]);
	});

	it('maps a reused $N placeholder to the same original param index', () => {
		const result = translatePgToSQLite('SELECT * FROM t WHERE a = $1 AND b = $1');
		expect(result.sql).toBe('SELECT * FROM t WHERE a = ? AND b = ?');
		expect(result.paramIndices).toEqual([0, 0]);
	});

	it('converts TO_CHAR with bare column', () => {
		expect(translatePgToSQLite("TO_CHAR(date, 'YYYY-MM')").sql)
			.toBe("strftime('%Y-%m', date)");
	});

	it('converts TO_CHAR with table-qualified column (t.date)', () => {
		expect(translatePgToSQLite("TO_CHAR(t.date, 'YYYY-MM')").sql)
			.toBe("strftime('%Y-%m', t.date)");
	});

	it('converts TO_CHAR with YYYY format', () => {
		expect(translatePgToSQLite("TO_CHAR(date, 'YYYY')").sql)
			.toBe("strftime('%Y', date)");
	});

	it('converts EXTRACT YEAR FROM bare column', () => {
		expect(translatePgToSQLite('EXTRACT(YEAR FROM date)').sql)
			.toBe('CAST(strftime(\'%Y\', date) AS INTEGER)');
	});

	it('converts EXTRACT YEAR FROM table-qualified column', () => {
		expect(translatePgToSQLite('EXTRACT(YEAR FROM t.date)').sql)
			.toBe('CAST(strftime(\'%Y\', t.date) AS INTEGER)');
	});

	it('converts EXTRACT with COALESCE (nested parens)', () => {
		// CURRENT_DATE inside the EXTRACT gets translated to date('now') by the later replacement
		expect(translatePgToSQLite('EXTRACT(YEAR FROM COALESCE(date, CURRENT_DATE))').sql)
			.toBe('CAST(strftime(\'%Y\', COALESCE(date, date(\'now\'))) AS INTEGER)');
	});

	it('converts NOW()', () => {
		expect(translatePgToSQLite('WHERE date <= NOW()').sql)
			.toBe("WHERE date <= datetime('now')");
	});

	it('converts CURRENT_DATE', () => {
		expect(translatePgToSQLite('WHERE date = CURRENT_DATE').sql)
			.toBe("WHERE date = date('now')");
	});

	it('converts CURRENT_TIMESTAMP', () => {
		expect(translatePgToSQLite('WHERE created_at = CURRENT_TIMESTAMP').sql)
			.toBe("WHERE created_at = datetime('now')");
	});

	it('strips Postgres ::int cast', () => {
		const result = translatePgToSQLite('$1::int');
		expect(result.sql).toBe('?');
		expect(result.paramIndices).toEqual([0]);
	});

	it('strips Postgres ::numeric(N,M) cast', () => {
		expect(translatePgToSQLite('value::numeric(12,2)').sql)
			.toBe('value');
	});

	it('handles real-world by-category query', () => {
		const input = `SELECT c.id as category_id, c.name as category_name, c.color as category_color, SUM(t.amount) as total
			 FROM transactions t
			 JOIN categories c ON t.category_id = c.id
			 WHERE TO_CHAR(t.date, 'YYYY-MM') = $1 AND t.type = $2
			 GROUP BY t.category_id, c.id, c.name, c.color
			 ORDER BY total DESC`;
		const expected = `SELECT c.id as category_id, c.name as category_name, c.color as category_color, SUM(t.amount) as total
			 FROM transactions t
			 JOIN categories c ON t.category_id = c.id
			 WHERE strftime('%Y-%m', t.date) = ? AND t.type = ?
			 GROUP BY t.category_id, c.id, c.name, c.color
			 ORDER BY total DESC`;
		const result = translatePgToSQLite(input);
		expect(result.sql).toBe(expected);
		expect(result.paramIndices).toEqual([0, 1]);
	});

	it('handles real-world monthly report query', () => {
		const input = `SELECT TO_CHAR(date, 'YYYY-MM') as month,
					SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
					SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
			 FROM transactions
			 WHERE EXTRACT(YEAR FROM date) = $1::int
			 GROUP BY month
			 ORDER BY month ASC`;
		const expected = `SELECT strftime('%Y-%m', date) as month,
					SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
					SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
			 FROM transactions
			 WHERE CAST(strftime('%Y', date) AS INTEGER) = ?
			 GROUP BY month
			 ORDER BY month ASC`;
		const result = translatePgToSQLite(input);
		expect(result.sql).toBe(expected);
		expect(result.paramIndices).toEqual([0]);
	});

	it('handles TO_CHAR with CURRENT_DATE', () => {
		expect(translatePgToSQLite("TO_CHAR(CURRENT_DATE, 'YYYY-MM')").sql)
			.toBe("strftime('%Y-%m', date('now'))");
	});

	it('handles empty SQL', () => {
		const result = translatePgToSQLite('');
		expect(result.sql).toBe('');
		expect(result.paramIndices).toEqual([]);
	});

	it('leaves plain SQL unchanged', () => {
		expect(translatePgToSQLite('SELECT * FROM categories ORDER BY name ASC').sql)
			.toBe('SELECT * FROM categories ORDER BY name ASC');
	});
});

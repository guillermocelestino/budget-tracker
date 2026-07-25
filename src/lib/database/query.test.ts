import { describe, it, expect } from 'vitest';
import { translatePgToSQLite } from './query';

describe('translatePgToSQLite', () => {
	it('converts $n param placeholders to ?', () => {
		expect(translatePgToSQLite('SELECT * FROM t WHERE a = $1 AND b = $2'))
			.toBe('SELECT * FROM t WHERE a = ? AND b = ?');
	});

	it('converts TO_CHAR with bare column', () => {
		expect(translatePgToSQLite("TO_CHAR(date, 'YYYY-MM')"))
			.toBe("strftime('%Y-%m', date)");
	});

	it('converts TO_CHAR with table-qualified column (t.date)', () => {
		expect(translatePgToSQLite("TO_CHAR(t.date, 'YYYY-MM')"))
			.toBe("strftime('%Y-%m', t.date)");
	});

	it('converts TO_CHAR with YYYY format', () => {
		expect(translatePgToSQLite("TO_CHAR(date, 'YYYY')"))
			.toBe("strftime('%Y', date)");
	});

	it('converts EXTRACT YEAR FROM bare column', () => {
		expect(translatePgToSQLite('EXTRACT(YEAR FROM date)'))
			.toBe('CAST(strftime(\'%Y\', date) AS INTEGER)');
	});

	it('converts EXTRACT YEAR FROM table-qualified column', () => {
		expect(translatePgToSQLite('EXTRACT(YEAR FROM t.date)'))
			.toBe('CAST(strftime(\'%Y\', t.date) AS INTEGER)');
	});

	it('converts EXTRACT with COALESCE (nested parens)', () => {
		// CURRENT_DATE inside the EXTRACT gets translated to date('now') by the later replacement
		expect(translatePgToSQLite('EXTRACT(YEAR FROM COALESCE(date, CURRENT_DATE))'))
			.toBe('CAST(strftime(\'%Y\', COALESCE(date, date(\'now\'))) AS INTEGER)');
	});

	it('converts NOW()', () => {
		expect(translatePgToSQLite('WHERE date <= NOW()'))
			.toBe("WHERE date <= datetime('now')");
	});

	it('converts CURRENT_DATE', () => {
		expect(translatePgToSQLite('WHERE date = CURRENT_DATE'))
			.toBe("WHERE date = date('now')");
	});

	it('converts CURRENT_TIMESTAMP', () => {
		expect(translatePgToSQLite('WHERE created_at = CURRENT_TIMESTAMP'))
			.toBe("WHERE created_at = datetime('now')");
	});

	it('strips Postgres ::int cast', () => {
		expect(translatePgToSQLite('$1::int'))
			.toBe('?');
	});

	it('strips Postgres ::numeric(N,M) cast', () => {
		expect(translatePgToSQLite('value::numeric(12,2)'))
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
		expect(translatePgToSQLite(input)).toBe(expected);
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
		expect(translatePgToSQLite(input)).toBe(expected);
	});

	it('handles TO_CHAR with CURRENT_DATE', () => {
		expect(translatePgToSQLite("TO_CHAR(CURRENT_DATE, 'YYYY-MM')"))
			.toBe("strftime('%Y-%m', date('now'))");
	});

	it('handles empty SQL', () => {
		expect(translatePgToSQLite('')).toBe('');
	});

	it('leaves plain SQL unchanged', () => {
		expect(translatePgToSQLite('SELECT * FROM categories ORDER BY name ASC'))
			.toBe('SELECT * FROM categories ORDER BY name ASC');
	});
});

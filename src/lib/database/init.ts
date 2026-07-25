import { usePostgres, getPgPool, getSQLiteDb } from './index';
import { hashPassword } from '../auth';

const POSTGRES_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS categories (
	id SERIAL PRIMARY KEY,
	name TEXT NOT NULL UNIQUE,
	color TEXT NOT NULL DEFAULT '#6366f1',
	icon TEXT NOT NULL DEFAULT '📁',
	budget_limit NUMERIC(12,2),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
	id SERIAL PRIMARY KEY,
	amount NUMERIC(12,2) NOT NULL CHECK(amount > 0),
	description TEXT NOT NULL,
	date DATE NOT NULL,
	category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
	type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
	id SERIAL PRIMARY KEY,
	username TEXT NOT NULL UNIQUE,
	password_hash TEXT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
`;

const SQLITE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS categories (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL UNIQUE,
	color TEXT NOT NULL DEFAULT '#6366f1',
	icon TEXT NOT NULL DEFAULT '📁',
	budget_limit REAL,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	amount REAL NOT NULL CHECK(amount > 0),
	description TEXT NOT NULL,
	date TEXT NOT NULL,
	category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
	type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	username TEXT NOT NULL UNIQUE,
	password_hash TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
`;

const DEFAULT_CATEGORIES = [
	{ name: 'Salary', color: '#10b981', icon: '💰', budget_limit: null },
	{ name: 'Freelance', color: '#34d399', icon: '💻', budget_limit: null },
	{ name: 'Other Income', color: '#6ee7b7', icon: '💵', budget_limit: null },
	{ name: 'Food & Dining', color: '#ef4444', icon: '🍽️', budget_limit: 500 },
	{ name: 'Transportation', color: '#f97316', icon: '🚗', budget_limit: 200 },
	{ name: 'Shopping', color: '#f59e0b', icon: '🛍️', budget_limit: 300 },
	{ name: 'Entertainment', color: '#8b5cf6', icon: '🎬', budget_limit: 150 },
	{ name: 'Bills & Utilities', color: '#3b82f6', icon: '📄', budget_limit: 400 },
	{ name: 'Healthcare', color: '#ec4899', icon: '🏥', budget_limit: 200 },
	{ name: 'Education', color: '#14b8a6', icon: '📚', budget_limit: 100 },
	{ name: 'Other Expense', color: '#6b7280', icon: '📦', budget_limit: null },
];

export async function initDb(): Promise<void> {
	if (usePostgres) {
		const client = await getPgPool().connect();
		try {
			await client.query(POSTGRES_SCHEMA_SQL);

			const catCount = await client.query('SELECT COUNT(*)::int as count FROM categories');
			if (catCount.rows[0].count === 0) {
				for (const cat of DEFAULT_CATEGORIES) {
					await client.query(
						'INSERT INTO categories (name, color, icon, budget_limit) VALUES ($1, $2, $3, $4)',
						[cat.name, cat.color, cat.icon, cat.budget_limit]
					);
				}
			}

			const userCount = await client.query('SELECT COUNT(*)::int as count FROM users');
			if (userCount.rows[0].count === 0) {
				const hash = hashPassword('Pangdiin@123');
				await client.query(
					'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
					['pangdiin', hash]
				);
			}
		} finally {
			client.release();
		}
	} else {
		const db = await getSQLiteDb();

		db.exec(SQLITE_SCHEMA_SQL);

		const count = db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number };
		if (count.count === 0) {
			const insert = db.prepare(
				'INSERT INTO categories (name, color, icon, budget_limit) VALUES (@name, @color, @icon, @budget_limit)'
			);
			for (const cat of DEFAULT_CATEGORIES) {
				insert.run({ name: cat.name, color: cat.color, icon: cat.icon, budget_limit: cat.budget_limit });
			}
		}

		const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
		if (userCount.count === 0) {
			const hash = hashPassword('Pangdiin@123');
			db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('pangdiin', hash);
		}
	}
}

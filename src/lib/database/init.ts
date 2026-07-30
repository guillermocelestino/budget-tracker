import { usePostgres, getPgPool, getSQLiteDb } from './index';
import { hashPassword } from '../auth';

const POSTGRES_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
	id SERIAL PRIMARY KEY,
	username TEXT NOT NULL UNIQUE,
	password_hash TEXT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
	id SERIAL PRIMARY KEY,
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	name TEXT NOT NULL,
	color TEXT NOT NULL DEFAULT '#6366f1',
	icon TEXT NOT NULL DEFAULT '📁',
	type TEXT NOT NULL DEFAULT 'expense',
	budget_limit NUMERIC(12,2),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS transactions (
	id SERIAL PRIMARY KEY,
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	amount NUMERIC(12,2) NOT NULL,
	description TEXT NOT NULL,
	date DATE NOT NULL,
	category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
	type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lendings (
	id SERIAL PRIMARY KEY,
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	borrower_name TEXT NOT NULL,
	amount NUMERIC(12,2) NOT NULL,
	interest_rate NUMERIC(5,2) DEFAULT 0,
	date_lent DATE NOT NULL,
	due_date DATE,
	status TEXT NOT NULL DEFAULT 'active',
	notes TEXT,
	direction TEXT NOT NULL DEFAULT 'lent' CHECK (direction IN ('lent', 'borrowed')),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_lendings_user_id ON lendings(user_id);
CREATE INDEX IF NOT EXISTS idx_lendings_status ON lendings(status);
`;

const SQLITE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	username TEXT NOT NULL UNIQUE,
	password_hash TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	name TEXT NOT NULL,
	color TEXT NOT NULL DEFAULT '#6366f1',
	icon TEXT NOT NULL DEFAULT '📁',
	type TEXT NOT NULL DEFAULT 'expense',
	budget_limit REAL,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS transactions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	amount REAL NOT NULL,
	description TEXT NOT NULL,
	date TEXT NOT NULL,
	category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
	type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lendings (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	borrower_name TEXT NOT NULL,
	amount REAL NOT NULL,
	interest_rate REAL DEFAULT 0,
	date_lent TEXT NOT NULL,
	due_date TEXT,
	status TEXT NOT NULL DEFAULT 'active',
	notes TEXT,
	direction TEXT NOT NULL DEFAULT 'lent' CHECK (direction IN ('lent', 'borrowed')),
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_lendings_user_id ON lendings(user_id);
CREATE INDEX IF NOT EXISTS idx_lendings_status ON lendings(status);
`;

const DEFAULT_USERS = [
	{ username: 'pangdiin', password: 'Pangdiin@123' },
	{ username: 'celestinobelle', password: 'Pangdiin@123' },
];

const DEFAULT_CATEGORIES = [
	{ name: 'Salary', color: '#10b981', icon: '💰', type: 'income', budget_limit: null },
	{ name: 'Freelance', color: '#34d399', icon: '💻', type: 'income', budget_limit: null },
	{ name: 'Other Income', color: '#6ee7b7', icon: '💵', type: 'income', budget_limit: null },
	{ name: 'Food & Dining', color: '#ef4444', icon: '🍽️', type: 'expense', budget_limit: 500 },
	{ name: 'Transportation', color: '#f97316', icon: '🚗', type: 'expense', budget_limit: 200 },
	{ name: 'Shopping', color: '#f59e0b', icon: '🛍️', type: 'expense', budget_limit: 300 },
	{ name: 'Entertainment', color: '#8b5cf6', icon: '🎬', type: 'expense', budget_limit: 150 },
	{ name: 'Bills & Utilities', color: '#3b82f6', icon: '📄', type: 'expense', budget_limit: 400 },
	{ name: 'Healthcare', color: '#ec4899', icon: '🏥', type: 'expense', budget_limit: 200 },
	{ name: 'Education', color: '#14b8a6', icon: '📚', type: 'expense', budget_limit: 100 },
	{ name: 'Other Expense', color: '#6b7280', icon: '📦', type: 'expense', budget_limit: null },
];

export async function initDb(): Promise<void> {
	if (usePostgres) {
		const client = await getPgPool().connect();
		try {
			await client.query(POSTGRES_SCHEMA_SQL);

			// Idempotent migration: add direction column if missing (for existing DBs)
			const colExists = await client.query(`
				SELECT 1 FROM information_schema.columns
				WHERE table_name = 'lendings' AND column_name = 'direction'
			`);
			if (colExists.rowCount === 0) {
				await client.query(`
					ALTER TABLE lendings ADD COLUMN direction TEXT NOT NULL DEFAULT 'lent'
				`);
				// Add CHECK constraint
				await client.query(`
					ALTER TABLE lendings ADD CONSTRAINT lendings_direction_check
					CHECK (direction IN ('lent', 'borrowed'))
				`);
			}

			const userCount = await client.query('SELECT COUNT(*)::int as count FROM users');
			if (userCount.rows[0].count === 0) {
				for (const u of DEFAULT_USERS) {
					const hash = hashPassword(u.password);
					await client.query(
						'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
						[u.username, hash]
					);
				}
			}

			// Seed per-user categories if none exist
			const catCount = await client.query('SELECT COUNT(*)::int as count FROM categories');
			if (catCount.rows[0].count === 0) {
				const users = await client.query<{ id: number }>('SELECT id FROM users');
				for (const user of users.rows) {
					for (const cat of DEFAULT_CATEGORIES) {
						await client.query(
							'INSERT INTO categories (user_id, name, color, icon, type, budget_limit) VALUES ($1, $2, $3, $4, $5, $6)',
							[user.id, cat.name, cat.color, cat.icon, cat.type, cat.budget_limit]
						);
					}
				}
			}
		} finally {
			client.release();
		}
	} else {
		const db = await getSQLiteDb();

		db.exec(SQLITE_SCHEMA_SQL);

		// Idempotent migration: add direction column if missing (for existing SQLite DBs)
		const columns = db.prepare("PRAGMA table_info(lendings)").all() as { name: string }[];
		const hasDirection = columns.some(c => c.name === 'direction');
		if (!hasDirection) {
			db.exec("ALTER TABLE lendings ADD COLUMN direction TEXT NOT NULL DEFAULT 'lent'");
			// SQLite enforces CHECK constraints, so add it
			db.exec("CREATE INDEX IF NOT EXISTS idx_lendings_direction ON lendings(direction)");
		}

		const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
		if (userCount.count === 0) {
			const insertUser = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
			for (const u of DEFAULT_USERS) {
				const hash = hashPassword(u.password);
				insertUser.run(u.username, hash);
			}
		}

		const catCount = db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number };
		if (catCount.count === 0) {
			const users = db.prepare('SELECT id FROM users').all() as { id: number }[];
			const insertCat = db.prepare(
				'INSERT INTO categories (user_id, name, color, icon, type, budget_limit) VALUES (?, ?, ?, ?, ?, ?)'
			);
			for (const user of users) {
				for (const cat of DEFAULT_CATEGORIES) {
					insertCat.run(user.id, cat.name, cat.color, cat.icon, cat.type, cat.budget_limit);
				}
			}
		}
	}

	// Boot-time self-check: verify all four tables exist
	const requiredTables = ['users', 'categories', 'transactions', 'lendings'];
	if (usePostgres) {
		const client = await getPgPool().connect();
		try {
			const missing: string[] = [];
			for (const table of requiredTables) {
				const res = await client.query(
					`SELECT 1 FROM information_schema.tables WHERE table_name = $1`,
					[table]
				);
				if (res.rowCount === 0) missing.push(table);
			}
			if (missing.length > 0) {
				throw new Error(`Database schema incomplete: missing tables: ${missing.join(', ')}`);
			}
		} finally {
			client.release();
		}
	} else {
		const db = await getSQLiteDb();
		const missing: string[] = [];
		for (const table of requiredTables) {
			const res = db.prepare(
				"SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?"
			).get(table);
			if (!res) missing.push(table);
		}
		if (missing.length > 0) {
			throw new Error(`Database schema incomplete: missing tables: ${missing.join(', ')}`);
		}
	}
}

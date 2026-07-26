/**
 * Migration: Add 'type' column to categories table
 * Date: 2026-07-26
 */
import { getSQLiteDb } from '../index';

export async function runMigration(): Promise<void> {
	const db = await getSQLiteDb();

	// Check if column already exists
	const tableInfo = db.prepare("PRAGMA table_info(categories)").all() as { name: string }[];
	const hasTypeColumn = tableInfo.some(col => col.name === 'type');

	if (!hasTypeColumn) {
		console.log('Adding type column to categories table...');
		db.exec("ALTER TABLE categories ADD COLUMN type TEXT NOT NULL DEFAULT 'expense'");
		console.log('Migration complete: type column added.');
	} else {
		console.log('Migration skipped: type column already exists.');
	}
}

// Run directly if executed via CLI
if (import.meta.url === `file://${process.argv[1]}`) {
	runMigration()
		.then(() => process.exit(0))
		.catch((err) => {
			console.error('Migration failed:', err);
			process.exit(1);
		});
}
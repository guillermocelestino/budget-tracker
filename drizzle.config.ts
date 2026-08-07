import { defineConfig } from 'drizzle-kit';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Minimal .env loader (no dotenv dependency) so `npm run db:*` commands work
 * with the same env file the app reads in dev. Only sets vars that aren't
 * already present in the process environment.
 */
function loadEnvFile(): void {
	const envPath = path.resolve(process.cwd(), '.env');
	if (!fs.existsSync(envPath)) return;
	for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
		const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
		if (m && !(m[1] in process.env)) {
			process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
		}
	}
}
loadEnvFile();

// Canonical name is DATABASE_URL; POSTGRES_URL is a deprecated alias.
const databaseUrl = process.env['DATABASE_URL'] ?? process.env['POSTGRES_URL'];

if (!databaseUrl) {
	console.warn(
		'[drizzle.config] DATABASE_URL (or POSTGRES_URL) is not set. ' +
			'Commands that connect (migrate / push / studio / pull) will fail.'
	);
}

export default defineConfig({
	dialect: 'postgresql',
	schema: './src/lib/database/schema.ts',
	out: './drizzle',
	casing: 'snake_case',
	introspect: { casing: 'preserve' },
	dbCredentials: {
		url: databaseUrl ?? '',
	},
});

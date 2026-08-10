import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Playwright configuration for Budget Tracker E2E tests.
 *
 * Dedicated E2E port 5188 avoids collision with default npm run dev (5173).
 * Auto-seeds demo data (SEED_DEMO=1) before launching dev server.
 *
 * The webServer needs DATABASE_URL pointing to the local-dev Neon branch.
 * We read LOCAL_DEV_DATABASE_URL from .env and set it as DATABASE_URL for the
 * webServer process, since loadEnv.ts skips wiring when SEED_DEMO=1 is set.
 */
function getLocalDevDatabaseUrl(): string | undefined {
	try {
		const raw = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf8');
		for (const line of raw.split('\n')) {
			const m = line.match(/^\s*LOCAL_DEV_DATABASE_URL\s*=\s*(.*)\s*$/);
			if (m) {
				const value = m[1]!.trim();
				const quoted =
					(value.startsWith('"') && value.endsWith('"')) ||
					(value.startsWith("'") && value.endsWith("'"));
				return quoted ? value.slice(1, -1) : value;
			}
		}
	} catch {
		// No .env or key not found
	}
	return undefined;
}

const localDevDatabaseUrl = getLocalDevDatabaseUrl();

export default defineConfig({
	testDir: 'tests/e2e',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	reporter: 'list',
	timeout: 30000,
	use: {
		baseURL: 'http://localhost:5188',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
	webServer: {
		command: localDevDatabaseUrl
			? `DATABASE_URL="${localDevDatabaseUrl}" SEED_DEMO=1 npx tsx scripts/seed-demo.ts && DATABASE_URL="${localDevDatabaseUrl}" SEED_DEMO=1 npx vite dev --port 5188`
			: 'SEED_DEMO=1 npx tsx scripts/seed-demo.ts && SEED_DEMO=1 npx vite dev --port 5188',
		port: 5188,
		reuseExistingServer: !process.env.CI,
		timeout: 120000,
	},
});

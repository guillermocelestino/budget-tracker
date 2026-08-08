import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Budget Tracker E2E tests.
 *
 * Dedicated E2E port 5188 avoids collision with default npm run dev (5173).
 * Auto-seeds demo data (SEED_DEMO=1) before launching dev server.
 */
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
		command: 'SEED_DEMO=1 npx tsx scripts/seed-demo.ts && SEED_DEMO=1 npx vite dev --port 5188',
		port: 5188,
		reuseExistingServer: !process.env.CI,
		timeout: 120000,
	},
});

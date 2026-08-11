import { test, expect, type Page } from '@playwright/test';

/**
 * Auth-6 — Focused authentication test suite (post-Auth.js migration).
 *
 * Covers the real user-facing flow through the existing /login UI and the
 * SvelteKit form action: login page, valid/invalid/unknown/empty credentials,
 * Auth.js session creation + persistence, protected-route access/rejection
 * (pages + API), user identity propagation, and logout.
 *
 * Runs against the seeded demo account (demo / Demo@2026!). Seeded by the
 * Playwright webserver (SEED_DEMO=1). Uses accessible locators.
 */

const DEMO_USERNAME = process.env.E2E_USERNAME || 'demo';
const DEMO_PASSWORD = process.env.E2E_PASSWORD || 'Demo@2026!';

/** A demo-seeded transaction only this user owns — proves user-scoped data. */
const DEMO_TRANSACTION = 'Team dinner';
const DEMO_AMOUNT = '₱1,500.00';

/** Log in through the real /login UI and land on the authenticated /dashboard. */
async function signIn(page: Page): Promise<void> {
	await page.goto('/login');
	await page.getByLabel('Username', { exact: true }).fill(DEMO_USERNAME);
	await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD);
	await page.getByRole('button', { name: 'Sign In', exact: true }).click();
	await page.waitForURL('**/dashboard');
	await expect(page).toHaveURL(/\/dashboard$/);
}

/** Assert an Auth.js session cookie exists in the current context. */
async function expectSession(page: Page): Promise<void> {
	const cookies = await page.context().cookies();
	expect(
		cookies.some(
			(c) => c.name === 'authjs.session-token' || c.name === '__Secure-authjs.session-token'
		)
	).toBe(true);
}

/** Assert NO Auth.js session cookie exists in the current context. */
async function expectNoSession(page: Page): Promise<void> {
	const cookies = await page.context().cookies();
	expect(
		cookies.some(
			(c) => c.name === 'authjs.session-token' || c.name === '__Secure-authjs.session-token'
		)
	).toBe(false);
}

test.describe('Authentication', () => {
	test.describe('1. Login page', () => {
		test('loads without an authenticated session and exposes the login form', async ({ page }) => {
			await page.goto('/login');

			// No authenticated session required to view /login.
			await expect(page).toHaveURL(/\/login$/);
			await expectNoSession(page);

			// The login form and its fields are available.
			await expect(page.locator('form[method="POST"]')).toBeVisible();
			await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
			await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
			await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
		});

		test('password visibility toggle switches the input type', async ({ page }) => {
			await page.goto('/login');

			const passwordInput = page.getByLabel('Password', { exact: true });
			await expect(passwordInput).toHaveAttribute('type', 'password');

			await page.getByRole('button', { name: 'Show password', exact: true }).click();
			await expect(passwordInput).toHaveAttribute('type', 'text');

			await page.getByRole('button', { name: 'Hide password', exact: true }).click();
			await expect(passwordInput).toHaveAttribute('type', 'password');
		});
	});

	test.describe('2. Successful login', () => {
		test('valid credentials sign in, land on the dashboard, and establish an Auth.js session', async ({
			page,
		}) => {
			await signIn(page);

			// Authenticated dashboard loads with demo-scoped data.
			await expect(page.locator('body')).toContainText(DEMO_TRANSACTION);
			await expect(page.locator('body')).toContainText(DEMO_AMOUNT);

			// The Auth.js session cookie was created.
			await expectSession(page);
		});

		test('user identity propagates to other authenticated pages', async ({ page }) => {
			await signIn(page);

			// The authenticated identity is exposed on /settings as the app's
			// username (from event.locals.user → page.data.user).
			await page.goto('/settings');
			await expect(page).toHaveURL(/\/settings$/);
			await expect(page.locator('.profile-name')).toHaveText(DEMO_USERNAME);
		});
	});

	test.describe('3. Invalid password', () => {
		test('stays on /login with the generic error, no session, dashboard stays protected', async ({
			page,
		}) => {
			await page.goto('/login');
			await page.getByLabel('Username', { exact: true }).fill(DEMO_USERNAME);
			await page.getByLabel('Password', { exact: true }).fill('WrongPassword999!');
			await page.getByRole('button', { name: 'Sign In', exact: true }).click();

			// Remains on /login with the generic error.
			await expect(page).toHaveURL(/\/login$/);
			await expect(page.locator('.error-message')).toContainText('Invalid username or password');

			// No session was established.
			await expectNoSession(page);

			// /dashboard remains protected.
			await page.goto('/dashboard');
			await expect(page).toHaveURL(/\/login$/);
		});
	});

	test.describe('4. Unknown username', () => {
		test('yields the same generic error, no session, no user enumeration', async ({ page }) => {
			await page.goto('/login');
			await page.getByLabel('Username', { exact: true }).fill('unknownuser999');
			await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD);
			await page.getByRole('button', { name: 'Sign In', exact: true }).click();

			// Same generic message as an existing user with a wrong password —
			// the response does not reveal whether the username exists.
			await expect(page).toHaveURL(/\/login$/);
			await expect(page.locator('.error-message')).toHaveText('Invalid username or password');
			await expectNoSession(page);
		});
	});

	test.describe('5. Empty credentials', () => {
		test('hits server-side validation, shows the validation message, no session', async ({ page }) => {
			await page.goto('/login');

			// The inputs are HTML `required`, which blocks the submit client-side
			// before the server sees it. Remove that attribute so the submission
			// reaches the real form action and its server-side validation.
			await page.getByLabel('Username', { exact: true }).evaluate((el) => el.removeAttribute('required'));
			await page.getByLabel('Password', { exact: true }).evaluate((el) => el.removeAttribute('required'));
			await page.getByRole('button', { name: 'Sign In', exact: true }).click();

			// Existing validation behavior is intact and displayed.
			await expect(page).toHaveURL(/\/login$/);
			await expect(page.locator('.error-message')).toContainText('Username and password are required');

			// Authentication was not attempted successfully.
			await expectNoSession(page);
		});
	});

	test.describe('6. Session persistence', () => {
		test('session survives a reload and works on another authenticated page', async ({ page }) => {
			await signIn(page);

			// Reload the dashboard — the Auth.js JWT session is re-resolved.
			await page.reload();
			await expect(page).toHaveURL(/\/dashboard$/);
			await expect(page.locator('body')).toContainText(DEMO_TRANSACTION);

			// Navigate to another authenticated page — still authenticated.
			await page.goto('/transactions');
			await expect(page).toHaveURL(/\/transactions$/);
			await expect(page.locator('body')).toContainText('Transactions');

			// The authenticated identity remains the same demo user.
			await page.goto('/settings');
			await expect(page.locator('.profile-name')).toHaveText(DEMO_USERNAME);
		});
	});

	test.describe('7. Protected routes', () => {
		test('unauthenticated page visits bounce to /login', async ({ page }) => {
			await page.goto('/dashboard');
			await expect(page).toHaveURL(/\/login$/);

			await page.goto('/transactions');
			await expect(page).toHaveURL(/\/login$/);
		});

		test('unauthenticated API calls do not expose user data', async ({ page }) => {
			// Hooks 302s every non-public path (including API routes) to /login.
			const res = await page.request.get('/api/transactions', { maxRedirects: 0 });
			expect(res.status()).toBe(302);
			expect(res.headers()['location']).toContain('/login');
		});

		test('authenticated pages and API return user-scoped data', async ({ page }) => {
			await signIn(page);

			await page.goto('/dashboard');
			await expect(page).toHaveURL(/\/dashboard$/);

			await page.goto('/transactions');
			await expect(page).toHaveURL(/\/transactions$/);

			// Authenticated API call succeeds and returns only demo-scoped data.
			const res = await page.request.get('/api/transactions');
			expect(res.status()).toBe(200);
			const body = (await res.json()) as { items: { description: string }[] };
			expect(Array.isArray(body.items)).toBe(true);
			expect(body.items.some((t) => t.description === DEMO_TRANSACTION)).toBe(true);
		});
	});

	test.describe('8. Logout', () => {
		test('logout clears the session and re-protects every route', async ({ page }) => {
			await signIn(page);

			// Log out through the /logout route.
			await page.goto('/logout');
			await expect(page).toHaveURL(/\/login$/);

			// The Auth.js session cookie is gone.
			await expectNoSession(page);

			// Protected routes are rejected again.
			await page.goto('/dashboard', { waitUntil: 'commit' });
			await expect(page).toHaveURL(/\/login$/);
			await page.goto('/transactions', { waitUntil: 'commit' });
			await expect(page).toHaveURL(/\/login$/);
		});
	});
});

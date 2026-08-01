import { test, expect } from '@playwright/test';

/**
 * End-to-End Test Suite for Login Page & Authentication Guards.
 *
 * Uses accessible locators (getByLabel exact / getByRole).
 * Runs against the seeded demo account (demo / Demo@2026!).
 */

const DEMO_USERNAME = process.env.E2E_USERNAME || 'demo';
const DEMO_PASSWORD = process.env.E2E_PASSWORD || 'Demo@2026!';

test.describe('Login & Authentication Flow', () => {
	test('happy path: logs in with valid demo credentials and lands on dashboard with demo-scoped data', async ({
		page,
	}) => {
		await page.goto('/login');

		await page.getByLabel('Username', { exact: true }).fill(DEMO_USERNAME);
		await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD);
		await page.getByRole('button', { name: 'Sign In', exact: true }).click();

		await page.waitForURL('**/dashboard');
		await expect(page).toHaveURL(/\/dashboard$/);

		// Concrete demo-scoped data assertions (User 3 — seeded demo transaction & amount)
		await expect(page.locator('body')).toContainText('Team dinner');
		await expect(page.locator('body')).toContainText('₱1,500.00');
	});

	test('wrong password displays error message and stays on login without session', async ({
		page,
	}) => {
		await page.goto('/login');

		await page.getByLabel('Username', { exact: true }).fill(DEMO_USERNAME);
		await page.getByLabel('Password', { exact: true }).fill('WrongPassword999!');
		await page.getByRole('button', { name: 'Sign In', exact: true }).click();

		await expect(page).toHaveURL(/\/login$/);
		await expect(page.locator('.error-message')).toContainText('Invalid username or password');

		// Session was not created — direct visit to protected route bounces back to /login
		await page.goto('/dashboard');
		await expect(page).toHaveURL(/\/login$/);
	});

	test('unknown username displays error message and stays on login', async ({ page }) => {
		await page.goto('/login');

		await page.getByLabel('Username', { exact: true }).fill('unknownuser999');
		await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD);
		await page.getByRole('button', { name: 'Sign In', exact: true }).click();

		await expect(page).toHaveURL(/\/login$/);
		await expect(page.locator('.error-message')).toContainText('Invalid username or password');
	});

	test('password visibility toggle toggles input type between password and text', async ({
		page,
	}) => {
		await page.goto('/login');

		const passwordInput = page.getByLabel('Password', { exact: true });
		await expect(passwordInput).toHaveAttribute('type', 'password');

		const toggleButton = page.getByRole('button', { name: 'Show password', exact: true });
		await toggleButton.click();
		await expect(passwordInput).toHaveAttribute('type', 'text');

		const hideButton = page.getByRole('button', { name: 'Hide password', exact: true });
		await hideButton.click();
		await expect(passwordInput).toHaveAttribute('type', 'password');
	});

	test('unauthenticated visit to protected route redirects to /login', async ({ page }) => {
		await page.goto('/dashboard');
		await expect(page).toHaveURL(/\/login$/);
	});

	test('session persists across page reload after successful login', async ({ page }) => {
		await page.goto('/login');

		await page.getByLabel('Username', { exact: true }).fill(DEMO_USERNAME);
		await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD);
		await page.getByRole('button', { name: 'Sign In', exact: true }).click();

		await page.waitForURL('**/dashboard');
		await expect(page).toHaveURL(/\/dashboard$/);

		// Reload page
		await page.reload();
		await expect(page).toHaveURL(/\/dashboard$/);
		await expect(page.locator('body')).toContainText('Team dinner');
	});

	test('logout endpoint clears session and re-protects routes', async ({ page }) => {
		// Log in first
		await page.goto('/login');
		await page.getByLabel('Username', { exact: true }).fill(DEMO_USERNAME);
		await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD);
		await page.getByRole('button', { name: 'Sign In', exact: true }).click();
		await page.waitForURL('**/dashboard');

		// Perform logout
		await page.goto('/logout');
		await page.waitForURL('**/login');
		await expect(page).toHaveURL(/\/login$/);

		// Protected route is re-protected
		await page.goto('/dashboard', { waitUntil: 'commit' });
		await expect(page).toHaveURL(/\/login$/);
	});
});

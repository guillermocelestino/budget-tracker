import { test, expect, type Page } from '@playwright/test';

const DEMO_USERNAME = process.env.E2E_USERNAME || 'demo';
const DEMO_PASSWORD = process.env.E2E_PASSWORD || 'Demo@2026!';

async function signIn(page: Page): Promise<void> {
	await page.goto('/dashboard');
	if (page.url().includes('/login')) {
		await page.getByLabel('Username', { exact: true }).fill(DEMO_USERNAME);
		await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD);
		await page.getByRole('button', { name: 'Sign In', exact: true }).click();
		await page.waitForURL('**/dashboard');
	}
	const skipBtn = page.getByRole('button', { name: /Skip/i });
	if (await skipBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
		await skipBtn.click();
	}
}

test.describe('Mobile Money Out Dashboard', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('renders mobile Money Out experience and Pocket Drain analytics at 390px viewport', async ({ page }) => {
		await signIn(page);

		// 1. Check Branding Header
		await expect(page.locator('.branding-title')).toBeVisible({ timeout: 10000 });
		await expect(page.locator('.branding-title')).toHaveText('MONEY OUT');
		await expect(page.getByText('track what leaves your pocket')).toBeVisible();

		// 2. Check Month Selector & Hero Card
		await expect(page.locator('.this-month-pill')).toBeVisible();
		await expect(page.getByText('LEFT YOUR POCKET')).toBeVisible();

		// 3. Check Left Your Pocket Hero Card breakdown
		await expect(page.locator('.col-title', { hasText: 'Spent' })).toBeVisible();
		await expect(page.locator('.col-title', { hasText: 'Lent' })).toBeVisible();
		await expect(page.locator('.col-title', { hasText: 'Repaid' })).toBeVisible();

		// 4. Check Focused Pocket Drain Widget
		await expect(page.getByText('💧 POCKET DRAIN')).toBeVisible();
		await expect(page.locator('.donut-ring')).toBeVisible();
		await expect(page.locator('.status-label')).toBeVisible();
		await expect(page.locator('.rate-diagnostic-text')).toBeVisible();

		// 5. Check Where It Went & Daily Drain analytical components
		await expect(page.getByText('↗ WHERE IT WENT')).toBeVisible();
		await expect(page.getByText(/DAILY DRAIN/)).toBeVisible();

		// 6. Check Still Out Of Your Pocket Card
		await expect(page.getByText('🤝 STILL OUT OF YOUR POCKET')).toBeVisible();

		// 7. Check Floating ＋ Log it CTA
		await expect(page.locator('.log-it-floating-btn')).toBeVisible();

		// 8. Verify BottomNav and SpeedDial are absent on /dashboard
		await expect(page.locator('.bottom-nav')).not.toBeVisible();
		await expect(page.locator('.sd-trigger')).not.toBeVisible();
	});

	test('changing month updates Pocket Drain metrics', async ({ page }) => {
		await signIn(page);

		// Click previous month button ‹
		await page.getByRole('button', { name: 'Previous month' }).click();
		await page.waitForURL('**/dashboard?month=*');

		// Verify Month pill "THIS MONTH" is absent for historical month
		await expect(page.locator('.this-month-pill')).not.toBeVisible();
		await expect(page.getByText('💧 POCKET DRAIN')).toBeVisible();
		await expect(page.getByText('↗ WHERE IT WENT')).toBeVisible();
		await expect(page.getByText(/DAILY DRAIN/)).toBeVisible();
	});

	test('BottomNav appears when navigating to /transactions on mobile', async ({ page }) => {
		await signIn(page);
		await page.goto('/transactions');
		await expect(page.locator('.bottom-nav')).toBeVisible();
	});

	test('opens mobile Log It sheet and interacts with Spent flow', async ({ page }) => {
		await signIn(page);

		// Click ＋ Log it
		await page.locator('.log-it-floating-btn').click();

		// Check sheet step 1: What left your pocket?
		await expect(page.getByText('What left your pocket?')).toBeVisible();
		await expect(page.locator('.spent-type')).toBeVisible();
		await expect(page.locator('.lent-type')).toBeVisible();
		await expect(page.locator('.repaid-type')).toBeVisible();

		// Select Spent
		await page.locator('.spent-type').click();

		// Verify form step 2: Log Expense
		await expect(page.getByText('Log Expense')).toBeVisible();
		await expect(page.getByRole('button', { name: '‹ change' })).toBeVisible();

		// Click ‹ change to return to type selector
		await page.getByRole('button', { name: '‹ change' }).click();
		await expect(page.getByText('What left your pocket?')).toBeVisible();

		// Re-select Spent
		await page.locator('.spent-type').click();

		// Fill amount and submit
		await page.locator('#spent_amount').fill('150.00');
		await page.locator('#spent_desc').fill('Coffee test');
		await page.getByRole('button', { name: 'Log Spent' }).click();

		// 1. Assert logging sheet & backdrop are completely closed/unmounted
		await expect(page.locator('.sheet-modal')).not.toBeVisible();
		await expect(page.locator('.sheet-backdrop')).not.toBeVisible();

		// 2. Assert Mobile Money Punch Overlay is visible as the only active modal layer
		await expect(page.locator('.mobile-punch-backdrop')).toBeVisible();
		await expect(page.locator('.title-wordIn')).toHaveText('MONEY OUT');
		await expect(page.locator('.amount-display')).toContainText('150.00');
		await expect(page.getByText('money left your pocket')).toBeVisible();

		// 3. Overlay disappears after animation completes (~2.9s)
		await expect(page.locator('.mobile-punch-backdrop')).not.toBeVisible({ timeout: 4500 });

		// 4. Assert Coffee test appears in Money Movements feed
		await expect(page.locator('.movement-desc', { hasText: 'Coffee test' }).first()).toBeVisible();
	});

	test('Lent flow closes sheet and displays MONEY AWAY overlay', async ({ page }) => {
		await signIn(page);

		await page.locator('.log-it-floating-btn').click();
		await page.locator('.lent-type').click();

		await page.locator('#lent_amount').fill('500.00');
		await page.locator('#lent_borrower').fill('Alice test');
		await page.getByRole('button', { name: 'Log Lent' }).click();

		// Assert sheet and backdrop are gone
		await expect(page.locator('.sheet-modal')).not.toBeVisible();
		await expect(page.locator('.sheet-backdrop')).not.toBeVisible();

		// Assert Punch Overlay for Lent
		await expect(page.locator('.mobile-punch-backdrop')).toBeVisible();
		await expect(page.locator('.title-wordIn')).toHaveText('MONEY AWAY');
		await expect(page.locator('.amount-display')).toContainText('500.00');
		await expect(page.getByText('money left your hands')).toBeVisible();

		await expect(page.locator('.mobile-punch-backdrop')).not.toBeVisible({ timeout: 4500 });
	});
});

test.describe('Desktop Dashboard Preservation', () => {
	test.use({ viewport: { width: 1280, height: 800 } });

	test('renders existing desktop dashboard unchanged at 1280px viewport', async ({ page }) => {
		await signIn(page);

		// Desktop Command Center Hero
		await expect(page.getByText('MONEY OUT COMMAND CENTER', { exact: true })).toBeVisible();
		await expect(page.getByText('WHERE IS MY MONEY RIGHT NOW')).toBeVisible();

		// Desktop widgets & charts
		await expect(page.getByText('Cash Flow Trend')).toBeVisible();
		await expect(page.getByText('Spending by Category')).toBeVisible();
		await expect(page.getByText('Financial Position')).toBeVisible();

		// Mobile branding header must NOT be visible on desktop
		await expect(page.getByRole('heading', { name: 'MONEY OUT' })).not.toBeVisible();
	});
});

import { test, expect, type Page } from '@playwright/test';

const DEMO_USERNAME = process.env.E2E_USERNAME || 'demo';
const DEMO_PASSWORD = process.env.E2E_PASSWORD || 'Demo@2026!';

function ymd(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

/** Log in through the real /login UI and navigate to /lending. */
async function signInAndNavigateToLending(page: Page): Promise<void> {
	await page.goto('/login');
	await page.getByLabel('Username', { exact: true }).fill(DEMO_USERNAME);
	await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD);
	await page.getByRole('button', { name: 'Sign In', exact: true }).click();
	await page.waitForURL('**/dashboard');
	// First-run "Welcome" tour dialog blocks page interaction — skip it if shown
	const skipTour = page.getByRole('button', { name: 'Skip tour' });
	if (await skipTour.isVisible().catch(() => false)) {
		await skipTour.click();
	}
	await page.goto('/lending');
	await page.waitForURL('**/lending**');
}

test.describe('Lending — Date Lent field in create modal', () => {
	test('Date Lent defaults to today, accepts a chosen date, and the submitted date_lent round-trips to the row', async ({ page }) => {
		await signInAndNavigateToLending(page);

		const borrower = `E2E DateLent ${Date.now() % 1000000}`;

		// 1. Open the create modal via the desktop FAB
		await page.getByRole('button', { name: 'Send money away', exact: true }).click();

		// 2. Date Lent is visible, editable, and defaults to today — not a hardcoded date
		const dateInput = page.locator('#date_lent');
		await expect(dateInput).toBeVisible();
		await expect(dateInput).toBeEnabled();
		const today = new Date();
		await expect(dateInput).toHaveValue(ymd(today));

		// 3. User can change the date before submitting — pick 10 days ago
		const lentDate = new Date(today);
		lentDate.setDate(today.getDate() - 10);
		const lentYmd = ymd(lentDate);
		await dateInput.fill(lentYmd);
		await expect(dateInput).toHaveValue(lentYmd);

		// 4. Fill the required fields and submit
		await page.locator('#borrower_name').fill(borrower);
		await page.locator('#amount').fill('1500');
		await page.locator('.cta-button').click();

		// 5. The new row shows the chosen date (posted as YYYY-MM-DD, rendered MMM D, YYYY)
		const expectedFormatted = lentDate.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
		const row = page.locator('.iou-row', { hasText: borrower });
		await expect(row).toBeVisible({ timeout: 10000 });
		await expect(row).toContainText(`Lent ${expectedFormatted}`);

		// 6. Clean up: delete the created record via the row kebab menu
		//    (the money-punch overlay covers the screen for ~2.9s after create)
		await page.waitForTimeout(3100);
		await row.locator('.row-kebab').click();
		await page.getByRole('menuitem', { name: 'Delete' }).click();
		const confirmDialog = page.getByRole('dialog', { name: 'Delete Lending' });
		await expect(confirmDialog).toBeVisible();
		await confirmDialog.getByRole('button', { name: 'Delete', exact: true }).click();
		await expect(row).toHaveCount(0, { timeout: 10000 });
	});
});

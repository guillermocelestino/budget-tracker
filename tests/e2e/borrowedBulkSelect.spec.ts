import { test, expect, type Page } from '@playwright/test';

const DEMO_USERNAME = process.env.E2E_USERNAME || 'demo';
const DEMO_PASSWORD = process.env.E2E_PASSWORD || 'Demo@2026!';

async function signInAndNavigateToBorrowed(page: Page): Promise<void> {
	await page.goto('/login');
	await page.evaluate(() => {
		localStorage.setItem('budget-tracker-prefs', JSON.stringify({ onboardingDismissed: true }));
	});
	await page.getByLabel('Username', { exact: true }).fill(DEMO_USERNAME);
	await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD);
	await page.getByRole('button', { name: 'Sign In', exact: true }).click();
	await page.waitForURL('**/dashboard');
	await page.evaluate(() => {
		localStorage.setItem('budget-tracker-prefs', JSON.stringify({ onboardingDismissed: true }));
	});
	await page.goto('/borrowed');
	await page.waitForURL('**/borrowed**');

	// If onboarding backdrop card is visible, click Got it / Skip
	const gotItBtn = page.locator('button', { hasText: 'Got it' });
	if (await gotItBtn.isVisible().catch(() => false)) {
		await gotItBtn.click();
	}
}

test.describe('Borrowed Bulk Select & Delete Flow', () => {
	test('enters selection mode via OverflowMenu, selects rows, checks select-all, and cancels', async ({ page }) => {
		await signInAndNavigateToBorrowed(page);

		// 1. Open PageHeader OverflowMenu and click select option
		const overflowBtn = page.locator('.page-actions .overflow-btn');
		await expect(overflowBtn).toBeVisible();
		await overflowBtn.click();

		const selectOption = page.locator('.overflow-option', { hasText: 'Select Transactions' });
		await expect(selectOption).toBeVisible();
		await selectOption.click();

		// 2. Verify bulk-bar appears
		const bulkBar = page.locator('.bulk-bar');
		await expect(bulkBar).toBeVisible();

		const bulkCount = page.locator('.bulk-count');
		await expect(bulkCount).toHaveText('0 selected');

		// 3. Select all using the header checkbox
		const selectAllCheckbox = bulkBar.locator('input[type="checkbox"]');
		await selectAllCheckbox.click();

		// 4. Verify selection count is updated
		const rowCheckboxes = page.locator('.row-checkbox, .iou-card-checkbox-btn input');
		const rowCount = await rowCheckboxes.count();
		if (rowCount > 0) {
			await expect(bulkCount).toHaveText(`${rowCount} selected`);
		}

		// 5. Click Cancel button to exit selection mode
		const cancelBtn = bulkBar.getByRole('button', { name: 'Cancel' });
		await cancelBtn.click();
		await expect(bulkBar).not.toBeVisible();
	});

	test('opens bulk delete confirmation modal for borrowed records', async ({ page }) => {
		await signInAndNavigateToBorrowed(page);

		await page.locator('.page-actions .overflow-btn').click();
		await page.locator('.overflow-option', { hasText: 'Select Transactions' }).click();

		const bulkBar = page.locator('.bulk-bar');
		await bulkBar.locator('input[type="checkbox"]').click();

		const deleteBtn = bulkBar.locator('.btn-bulk-delete');
		await expect(deleteBtn).toBeVisible();
		await deleteBtn.click();

		const modal = page.locator('.modal-card, [role="dialog"]');
		await expect(modal).toBeVisible();
		await expect(modal).toContainText('Delete Borrowings');

		const cancelBtn = modal.getByRole('button', { name: 'Cancel' });
		await cancelBtn.click();
		await expect(modal).not.toBeVisible();
	});
});

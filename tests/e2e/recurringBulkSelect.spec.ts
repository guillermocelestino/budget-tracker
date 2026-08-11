import { test, expect, type Page } from '@playwright/test';

const DEMO_USERNAME = process.env.E2E_USERNAME || 'demo';
const DEMO_PASSWORD = process.env.E2E_PASSWORD || 'Demo@2026!';

async function signInAndNavigateToRecurring(page: Page): Promise<void> {
	await page.goto('/login');
	await page.getByLabel('Username', { exact: true }).fill(DEMO_USERNAME);
	await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD);
	await page.getByRole('button', { name: 'Sign In', exact: true }).click();
	await page.waitForURL('**/dashboard');
	await page.goto('/recurring');
	await page.waitForURL('**/recurring**');
}

test.describe('Recurring Bulk Select & Delete Flow', () => {
	test('enters selection mode via OverflowMenu, selects rows, checks select-all, and cancels', async ({ page }) => {
		await signInAndNavigateToRecurring(page);

		// 1. Open PageHeader OverflowMenu and click "Select Transactions"
		const overflowBtn = page.locator('.overflow-btn').first();
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
		const rowCheckboxes = page.locator('.rr-checkbox');
		const rowCount = await rowCheckboxes.count();
		if (rowCount > 0) {
			await expect(bulkCount).toHaveText(`${rowCount} selected`);
		}

		// 5. Click Cancel button to exit selection mode
		const cancelBtn = bulkBar.getByRole('button', { name: 'Cancel' });
		await cancelBtn.click();
		await expect(bulkBar).not.toBeVisible();
	});

	test('opens bulk delete confirmation modal for recurring rules', async ({ page }) => {
		await signInAndNavigateToRecurring(page);

		await page.locator('.overflow-btn').first().click();
		await page.locator('.overflow-option', { hasText: 'Select Transactions' }).click();

		const bulkBar = page.locator('.bulk-bar');
		await bulkBar.locator('input[type="checkbox"]').click();

		const deleteBtn = bulkBar.getByRole('button', { name: 'Delete Selected' });
		if (await deleteBtn.isEnabled()) {
			await deleteBtn.click();

			const modal = page.locator('[role="dialog"]', { hasText: 'Delete Recurring Transactions' });
			await expect(modal).toBeVisible();

			// Cancel modal
			await modal.getByRole('button', { name: 'Cancel' }).click();
			await expect(modal).not.toBeVisible();
		}
	});
});

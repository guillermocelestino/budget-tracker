import { test, expect, type Page } from '@playwright/test';

const DEMO_USERNAME = process.env.E2E_USERNAME || 'demo';
const DEMO_PASSWORD = process.env.E2E_PASSWORD || 'Demo@2026!';

/** Log in through the real /login UI and land on /dashboard, then navigate to /transactions. */
async function signInAndNavigateToTransactions(page: Page): Promise<void> {
	await page.goto('/login');
	await page.getByLabel('Username', { exact: true }).fill(DEMO_USERNAME);
	await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD);
	await page.getByRole('button', { name: 'Sign In', exact: true }).click();
	await page.waitForURL('**/dashboard');
	await page.goto('/transactions');
	await page.waitForURL('**/transactions**');
}

test.describe('Transactions Custom Date Range & Pagination Interaction', () => {
	test('opens Custom Range UI, verifies inputs, validates range, updates URL and resets page', async ({ page }) => {
		await signInAndNavigateToTransactions(page);

		// 1. Open Date filter menu
		const dateChip = page.locator('button.dock-chip', { hasText: /^Date/ });
		await expect(dateChip).toBeVisible();
		await dateChip.click();

		// 2. Click "Custom Range" preset button
		const customPresetBtn = page.getByRole('menuitem', { name: 'Custom Range' });
		await expect(customPresetBtn).toBeVisible();
		await customPresetBtn.click();

		// 3. Verify Custom Range inputs and Apply button appear
		const fromInput = page.locator('#custom-from');
		const toInput = page.locator('#custom-to');
		const applyBtn = page.locator('button.apply-btn', { hasText: 'Apply' });

		await expect(fromInput).toBeVisible();
		await expect(toInput).toBeVisible();
		await expect(applyBtn).toBeVisible();

		// 4. Test Invalid Range (From > End)
		await fromInput.fill('2026-04-01');
		await toInput.fill('2026-03-01');
		await expect(page.locator('.custom-date-error')).toContainText('From date cannot be after End date');
		await expect(applyBtn).toBeDisabled();

		// 5. Fill Valid Range (From = 2026-01-01, To = 2026-03-31)
		await fromInput.fill('2026-01-01');
		await toInput.fill('2026-03-31');
		await expect(page.locator('.custom-date-error')).toHaveCount(0);
		await expect(applyBtn).toBeEnabled();

		// 6. Click Apply
		await applyBtn.click();

		// 7. Verify resulting URL contains `from=2026-01-01` and `to=2026-03-31`
		await expect(page).toHaveURL(/from=2026-01-01/);
		await expect(page).toHaveURL(/to=2026-03-31/);

		// 8. Verify Date chip label updates to reflect range
		await expect(dateChip).toContainText('2026-01-01 → 2026-03-31');

		// 9. Re-open Date filter and verify inputs retain values
		await dateChip.click();
		await expect(fromInput).toHaveValue('2026-01-01');
		await expect(toInput).toHaveValue('2026-03-31');

		// 10. Clear date filter by clicking "Any Date"
		const anyDateBtn = page.getByRole('menuitem', { name: 'Any Date' });
		await anyDateBtn.click();

		// 11. Verify `from` and `to` are removed from URL
		await expect(page).not.toHaveURL(/from=/);
		await expect(page).not.toHaveURL(/to=/);
	});

	test('supports From-only date filtering in browser interaction', async ({ page }) => {
		await signInAndNavigateToTransactions(page);

		const dateChip = page.locator('button.dock-chip', { hasText: /^Date/ });
		await dateChip.click();
		await page.getByRole('menuitem', { name: 'Custom Range' }).click();

		const fromInput = page.locator('#custom-from');
		const toInput = page.locator('#custom-to');
		const applyBtn = page.locator('button.apply-btn', { hasText: 'Apply' });

		await fromInput.fill('2026-01-01');
		await toInput.fill('');
		await expect(applyBtn).toBeEnabled();

		await applyBtn.click();

		// Verify URL has `from=2026-01-01` and does NOT have `to=`
		await expect(page).toHaveURL(/from=2026-01-01/);
		await expect(page).not.toHaveURL(/to=/);

		// Verify Date chip label shows "Date: From 2026-01-01"
		await expect(dateChip).toContainText('From 2026-01-01');
	});

	test('supports End-only date filtering in browser interaction', async ({ page }) => {
		await signInAndNavigateToTransactions(page);

		const dateChip = page.locator('button.dock-chip', { hasText: /^Date/ });
		await dateChip.click();
		await page.getByRole('menuitem', { name: 'Custom Range' }).click();

		const fromInput = page.locator('#custom-from');
		const toInput = page.locator('#custom-to');
		const applyBtn = page.locator('button.apply-btn', { hasText: 'Apply' });

		await fromInput.fill('');
		await toInput.fill('2026-03-31');
		await expect(applyBtn).toBeEnabled();

		await applyBtn.click();

		// Verify URL has `to=2026-03-31` and does NOT have `from=`
		await expect(page).toHaveURL(/to=2026-03-31/);
		await expect(page).not.toHaveURL(/from=/);

		// Verify Date chip label shows "Date: Up to 2026-03-31"
		await expect(dateChip).toContainText('Up to 2026-03-31');
	});

	test('resets page to 1 when applying a date range filter on page > 1 and asserts visible pagination state', async ({ page }) => {
		await signInAndNavigateToTransactions(page);

		// Navigate to page 2 via URL
		await page.goto('/transactions?page=2');
		await expect(page).toHaveURL(/page=2/);

		// Assert page 2 is active in visible pagination UI if pagination controls are rendered
		const currentPageButton = page.locator('.pager-num.current');
		if (await currentPageButton.count() > 0) {
			await expect(currentPageButton).toHaveText('2');
		}

		// Open Date filter and set From date only
		const dateChip = page.locator('button.dock-chip', { hasText: /^Date/ });
		await dateChip.click();
		await page.getByRole('menuitem', { name: 'Custom Range' }).click();

		const fromInput = page.locator('#custom-from');
		await fromInput.fill('2026-01-01');

		const applyBtn = page.locator('button.apply-btn', { hasText: 'Apply' });
		await applyBtn.click();

		// 1. Assert URL no longer contains `page=2` and contains `from=2026-01-01`
		await expect(page).not.toHaveURL(/page=2/);
		await expect(page).toHaveURL(/from=2026-01-01/);

		// 2. Assert visible pagination UI reflects page 1 active (if paginated) or count label shows page 1 start
		if (await currentPageButton.count() > 0) {
			await expect(page.locator('.pager-num.current')).toHaveText('1');
		}
		const pagerCount = page.locator('.pager-count');
		if (await pagerCount.count() > 0) {
			await expect(pagerCount).toContainText('Showing');
		}
	});
});

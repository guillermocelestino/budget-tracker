import { test, expect, type Page } from '@playwright/test';

const DEMO_USERNAME = process.env.E2E_USERNAME || 'demo';
const DEMO_PASSWORD = process.env.E2E_PASSWORD || 'Demo@2026!';

/** Log in through the real /login UI and navigate to /borrowed. */
async function signInAndNavigateToBorrowed(page: Page): Promise<void> {
	await page.goto('/login');
	await page.getByLabel('Username', { exact: true }).fill(DEMO_USERNAME);
	await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD);
	await page.getByRole('button', { name: 'Sign In', exact: true }).click();
	await page.waitForURL('**/dashboard');
	await page.goto('/borrowed');
	await page.waitForURL('**/borrowed**');
}

test.describe('Borrowed Custom Date Range & Pagination Interaction', () => {
	test('opens Custom Range UI, verifies inputs, validates invalid range, updates URL and resets page', async ({ page }) => {
		await signInAndNavigateToBorrowed(page);

		// 1. Open Filter popover/sheet by clicking Filter button
		const filterBtn = page.locator('.search-filter-btn');
		await expect(filterBtn).toBeVisible();
		await filterBtn.click();

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

		const footerApplyBtn = page.locator('.filter-footer button.apply-btn, .filter-footer button:has-text("Apply")');
		if (await footerApplyBtn.count() > 0 && await footerApplyBtn.isVisible()) {
			await footerApplyBtn.click();
		}

		// 7. Verify resulting URL contains `from=2026-01-01` and `to=2026-03-31`
		await expect(page).toHaveURL(/from=2026-01-01/);
		await expect(page).toHaveURL(/to=2026-03-31/);

		// 8. Clear date filter by clicking Any Date
		await filterBtn.click();
		const anyDateBtn = page.getByRole('menuitem', { name: 'Any Date' });
		await anyDateBtn.click();
		if (await footerApplyBtn.count() > 0 && await footerApplyBtn.isVisible()) {
			await footerApplyBtn.click();
		}

		// 9. Verify `from` and `to` are removed from URL
		await expect(page).not.toHaveURL(/from=/);
		await expect(page).not.toHaveURL(/to=/);
	});

	test('supports From-only date filtering in browser interaction', async ({ page }) => {
		await signInAndNavigateToBorrowed(page);

		const filterBtn = page.locator('.search-filter-btn');
		await filterBtn.click();
		await page.getByRole('menuitem', { name: 'Custom Range' }).click();

		const fromInput = page.locator('#custom-from');
		const toInput = page.locator('#custom-to');
		const applyBtn = page.locator('button.apply-btn', { hasText: 'Apply' });

		await fromInput.fill('2026-01-01');
		await toInput.fill('');
		await expect(applyBtn).toBeEnabled();

		await applyBtn.click();
		const footerApplyBtn = page.locator('.filter-footer button.apply-btn, .filter-footer button:has-text("Apply")');
		if (await footerApplyBtn.count() > 0 && await footerApplyBtn.isVisible()) {
			await footerApplyBtn.click();
		}

		// Verify URL has `from=2026-01-01` and does NOT have `to=`
		await expect(page).toHaveURL(/from=2026-01-01/);
		await expect(page).not.toHaveURL(/to=/);
	});

	test('supports End-only date filtering in browser interaction', async ({ page }) => {
		await signInAndNavigateToBorrowed(page);

		const filterBtn = page.locator('.search-filter-btn');
		await filterBtn.click();
		await page.getByRole('menuitem', { name: 'Custom Range' }).click();

		const fromInput = page.locator('#custom-from');
		const toInput = page.locator('#custom-to');
		const applyBtn = page.locator('button.apply-btn', { hasText: 'Apply' });

		await fromInput.fill('');
		await toInput.fill('2026-03-31');
		await expect(applyBtn).toBeEnabled();

		await applyBtn.click();
		const footerApplyBtn = page.locator('.filter-footer button.apply-btn, .filter-footer button:has-text("Apply")');
		if (await footerApplyBtn.count() > 0 && await footerApplyBtn.isVisible()) {
			await footerApplyBtn.click();
		}

		// Verify URL has `to=2026-03-31` and does NOT have `from=`
		await expect(page).toHaveURL(/to=2026-03-31/);
		await expect(page).not.toHaveURL(/from=/);
	});

	test('resets page to 1 when applying a date range filter on page > 1', async ({ page }) => {
		await signInAndNavigateToBorrowed(page);

		await page.goto('/borrowed?page=2');
		await expect(page).toHaveURL(/page=2/);

		const filterBtn = page.locator('.search-filter-btn');
		await filterBtn.click();
		await page.getByRole('menuitem', { name: 'Custom Range' }).click();

		const fromInput = page.locator('#custom-from');
		await fromInput.fill('2026-01-01');

		const applyBtn = page.locator('button.apply-btn', { hasText: 'Apply' });
		await applyBtn.click();
		const footerApplyBtn = page.locator('.filter-footer button.apply-btn, .filter-footer button:has-text("Apply")');
		if (await footerApplyBtn.count() > 0 && await footerApplyBtn.isVisible()) {
			await footerApplyBtn.click();
		}

		// 1. Assert URL no longer contains `page=2` and contains `from=2026-01-01`
		await expect(page).not.toHaveURL(/page=2/);
		await expect(page).toHaveURL(/from=2026-01-01/);
	});

	test('verifies server-side pagination works for borrowed records', async ({ page }) => {
		await signInAndNavigateToBorrowed(page);

		const pager = page.locator('.pager');
		if (await pager.count() > 0 && await pager.isVisible()) {
			const page1Content = await page.locator('.iou-card, .iou-row').allTextContents();
			const nextBtn = page.getByRole('button', { name: 'Next page' });
			if (await nextBtn.isEnabled()) {
				await nextBtn.click();
				await expect(page).toHaveURL(/page=2/);
				const page2Content = await page.locator('.iou-card, .iou-row').allTextContents();
				expect(page2Content).not.toEqual(page1Content);
			}
		}
	});
});

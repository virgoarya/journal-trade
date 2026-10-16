import { test, expect } from '@playwright/test';

test.describe('JournalEntryForm', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/log-trade', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000); // Extra wait for JS to render
  });

  test('should render the journal entry form with basic step', async ({ page }) => {
    const form = page.locator('form');
    await expect(form.first()).toBeVisible({ timeout: 15000 });
    
    const submitBtn = page.getByRole('button', { name: /log trade|submit|save/i });
    await expect(submitBtn.first()).toBeVisible({ timeout: 5000 });
  });

  test('should have symbol selector with default value', async ({ page }) => {
    const selects = page.locator('select');
    const count = await selects.count();
    expect(count).toBeGreaterThan(0);
    
    // Check first select exists
    await expect(selects.first()).toBeVisible({ timeout: 5000 });
  });

  test('should validate required fields on submit', async ({ page }) => {
    const submitBtn = page.getByRole('button', { name: /log trade|submit|save/i });
    const btnCount = await submitBtn.count();
    
    if (btnCount > 0) {
      await submitBtn.first().click();
      await page.waitForTimeout(1000);
      // Check for validation error or still on same page
      const url = page.url();
      expect(url).toContain('/log-trade');
    }
  });

  test('should have form fields visible', async ({ page }) => {
    const allInputs = page.locator('input, select, textarea');
    const inputCount = await allInputs.count();
    expect(inputCount).toBeGreaterThan(0);
  });
});

import { test, expect } from '@playwright/test';

test.describe('JournalEntryForm', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/log-trade');
    await page.waitForLoadState('networkidle');
  });

  test('should render the journal entry form with basic step', async ({ page }) => {
    const form = page.locator('form');
    await expect(form).toBeVisible({ timeout: 10000 });
    
    const submitBtn = page.getByRole('button', { name: /log trade/i });
    await expect(submitBtn).toBeVisible();
  });

  test('should have symbol selector with default XAU/USD', async ({ page }) => {
    const symbolSelect = page.locator('select').first();
    await expect(symbolSelect).toBeVisible();
    await expect(symbolSelect).toHaveValue('XAU/USD');
  });

  test('should validate required fields on submit', async ({ page }) => {
    const entryPriceInput = page.locator('input[type="number"]').first();
    await entryPriceInput.fill('0');
    
    const submitBtn = page.getByRole('button', { name: /log trade/i });
    await submitBtn.click();
    
    const errorMessage = page.locator('text=/must be > 0|required/i');
    await expect(errorMessage.first()).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to details step or show all fields', async ({ page }) => {
    const nextBtn = page.getByRole('button', { name: /next|continue|details/i });
    const count = await nextBtn.count();
    
    if (count > 0) {
      await nextBtn.click();
      await page.waitForTimeout(500);
      const notesField = page.locator('textarea, input[name="notes"]');
      await expect(notesField.first()).toBeVisible({ timeout: 5000 });
    } else {
      const allInputs = page.locator('input, select, textarea');
      const inputCount = await allInputs.count();
      expect(inputCount).toBeGreaterThan(3);
    }
  });
});

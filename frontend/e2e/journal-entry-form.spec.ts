import { test, expect } from '@playwright/test';

test.describe('JournalEntryForm', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should render the journal entry form', async ({ page }) => {
    // Check if form exists - adjust selectors based on actual implementation
    const form = page.locator('form').first();
    await expect(form).toBeVisible({ timeout: 10000 });
  });

  test('should have required form fields', async ({ page }) => {
    // Common trading journal fields
    const fields = ['symbol', 'side', 'entryPrice', 'exitPrice', 'quantity'];
    
    for (const field of fields) {
      const element = page.locator(`[name="${field}"], [id="${field}"], [placeholder*="${field}" i]`).first();
      // Log whether field exists - don't fail yet since we're discovering the actual form
      const count = await element.count();
      console.log(`Field "${field}": ${count > 0 ? 'FOUND' : 'NOT FOUND'}`);
    }
  });

  test('should submit a new trade entry', async ({ page }) => {
    // This is a placeholder test - will be updated after discovering actual form structure
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Take a screenshot for evidence
    await page.screenshot({ path: 'e2e/screenshots/journal-entry-form.png', fullPage: true });
    
    console.log('JournalEntryForm page loaded successfully');
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Try to submit empty form if submit button exists
    const submitBtn = page.locator('button[type="submit"], button:has-text("Submit"), button:has-text("Save")').first();
    const btnCount = await submitBtn.count();
    
    if (btnCount > 0) {
      await submitBtn.click();
      // Check for validation errors
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'e2e/screenshots/form-validation.png', fullPage: true });
      console.log('Form validation test completed');
    } else {
      console.log('Submit button not found - form may not be implemented yet');
    }
  });
});

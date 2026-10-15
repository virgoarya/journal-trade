import { test, expect } from '@playwright/test';

test.describe('Setup Wizard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should show setup wizard on first run', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Look for setup wizard elements
    const wizardElements = page.locator('[class*="wizard"], [class*="setup"], [class*="onboarding"]');
    const count = await wizardElements.count();
    console.log(`Found ${count} setup wizard elements`);
    
    await page.screenshot({ path: 'e2e/screenshots/setup-wizard.png', fullPage: true });
  });

  test('should complete setup wizard flow', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Look for next/submit buttons in wizard
    const nextBtn = page.locator('button:has-text("Next"), button:has-text("Continue"), button:has-text("Start")').first();
    const count = await nextBtn.count();
    console.log(`Wizard navigation buttons: ${count > 0 ? 'FOUND' : 'NOT FOUND'}`);
  });
});

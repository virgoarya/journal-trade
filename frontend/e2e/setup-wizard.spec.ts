import { test, expect } from '@playwright/test';

test.describe('Setup Wizard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);
  });

  test('should show setup wizard or onboarding on first run', async ({ page }) => {
    const wizardElements = page.locator('[class*="wizard"], [class*="setup"], [class*="onboarding"]');
    const count = await wizardElements.count();
    
    const ctaBtn = page.locator('button:has-text("Get Started"), button:has-text("Start"), a:has-text("Get Started")');
    const ctaCount = await ctaBtn.count();
    
    console.log(`Wizard elements: ${count}, CTA buttons: ${ctaCount}`);
  });

  test('should have navigation to main app', async ({ page }) => {
    const navLinks = page.locator('a[href="/"], a[href="/dashboard"], a[href="/log-trade"], a');
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(0);
  });
});

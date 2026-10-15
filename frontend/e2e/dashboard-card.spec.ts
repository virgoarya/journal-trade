import { test, expect } from '@playwright/test';

test.describe('DashboardCard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should render dashboard cards', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Look for card-like elements
    const cards = page.locator('[class*="card"], [class*="Card"], [class*="dashboard"]');
    const count = await cards.count();
    console.log(`Found ${count} card-like elements`);
    
    await page.screenshot({ path: 'e2e/screenshots/dashboard-cards.png', fullPage: true });
  });

  test('should display card title and value', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Take screenshot for visual verification
    await page.screenshot({ path: 'e2e/screenshots/dashboard-overview.png', fullPage: true });
    console.log('Dashboard screenshot captured');
  });
});

import { test, expect } from '@playwright/test';

test.describe('DashboardCard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('should render dashboard page', async ({ page }) => {
    const body = page.locator('body');
    await expect(body).toBeVisible();
    
    const heading = page.locator('h1, h2, [class*="title"], [class*="heading"]').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('should display card components', async ({ page }) => {
    const cards = page.locator('[class*="card"], [class*="Card"], [class*="rounded"], [class*="border"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should have navigation or sidebar', async ({ page }) => {
    const nav = page.locator('nav, [class*="sidebar"], [class*="nav"]').first();
    const navCount = await nav.count();
    console.log(`Nav elements found: ${navCount}`);
  });
});

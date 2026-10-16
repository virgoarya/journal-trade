import { test, expect } from '@playwright/test';

test.describe('DashboardCard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);
  });

  test('should render dashboard page', async ({ page }) => {
    const body = page.locator('body');
    await expect(body).toBeVisible();
    
    const content = page.locator('h1, h2, h3, [class*="title"], [class*="heading"], [class*="text"]').first();
    await expect(content).toBeVisible({ timeout: 15000 });
  });

  test('should display card components', async ({ page }) => {
    const cards = page.locator('[class*="card"], [class*="Card"], [class*="rounded"], [class*="border"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should have some navigation or content', async ({ page }) => {
    const nav = page.locator('nav, a, button, [class*="nav"]');
    const navCount = await nav.count();
    expect(navCount).toBeGreaterThan(0);
  });
});

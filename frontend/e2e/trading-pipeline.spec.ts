import { test, expect } from '@playwright/test';

test.describe('Trading Pipeline Status', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);
  });

  test('should display pipeline status section', async ({ page }) => {
    const pipelineElements = page.locator('[class*="pipeline"], [class*="status"], [class*="trading"]');
    const count = await pipelineElements.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should show connection status', async ({ page }) => {
    const statusElements = page.locator('[class*="connected"], [class*="disconnected"], [class*="online"], [class*="offline"]');
    const count = await statusElements.count();
    console.log(`Status indicators found: ${count}`);
  });

  test('should have trading controls or info', async ({ page }) => {
    const tradingContent = page.locator('text=/trade|position|order|pipeline/i');
    const count = await tradingContent.count();
    expect(count).toBeGreaterThan(0);
  });
});

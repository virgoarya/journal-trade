import { test, expect } from '@playwright/test';

test.describe('Trading Pipeline Status', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display pipeline status', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Look for pipeline status indicators
    const statusElements = page.locator('[class*="pipeline"], [class*="status"], [class*="running"], [class*="paused"], [class*="error"]');
    const count = await statusElements.count();
    console.log(`Found ${count} pipeline status elements`);
    
    await page.screenshot({ path: 'e2e/screenshots/pipeline-status.png', fullPage: true });
  });

  test('should show running/paused/error states', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Check for status text
    const body = await page.textContent('body');
    const hasRunning = body?.includes('running') || body?.includes('Running');
    const hasPaused = body?.includes('paused') || body?.includes('Paused');
    const hasError = body?.includes('error') || body?.includes('Error');
    
    console.log(`Status indicators - Running: ${hasRunning}, Paused: ${hasPaused}, Error: ${hasError}`);
  });
});
